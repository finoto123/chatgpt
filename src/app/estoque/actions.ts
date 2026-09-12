'use server'

import { z } from 'zod'
import { createServerSupabaseClient } from '@/lib/supabase/server'
import { revalidatePath } from 'next/cache'
import { requirePermission } from '@/lib/auth/require-user'
import { safeDatabaseError } from '@/lib/security/errors'
import { todayBusinessDate } from '@/lib/business-date'

// =============================================
// Editar tecido: valor_unitario e estoque_minimo
// =============================================

const editarTecidoSchema = z.object({
  id: z.string().uuid(),
  valor_unitario: z.coerce.number().min(0),
  estoque_minimo: z.coerce.number().min(0),
}).strict()

export async function editarTecido(data: unknown): Promise<{ success?: boolean; error?: string }> {
  await requirePermission('inventory.update')
  const parsed = editarTecidoSchema.safeParse(data)
  if (!parsed.success) return { error: 'Dados inválidos' }

  const supabase = await createServerSupabaseClient()
  const { error } = await supabase
    .from('tecidos')
    .update({
      valor_unitario: parsed.data.valor_unitario,
      estoque_minimo: parsed.data.estoque_minimo,
      updated_at: new Date().toISOString(),
    })
    .eq('id', parsed.data.id)

  if (error) return { error: safeDatabaseError(error, 'Não foi possível atualizar o tecido.', { action: 'inventory.update', entityId: parsed.data.id }) }

  revalidatePath('/estoque')
  revalidatePath('/compras')
  revalidatePath('/dashboard')
  return { success: true }
}

const movSchema = z.object({
  tecido_id: z.string().uuid(),
  data_movimentacao: z.string(),
  tipo: z.enum(['Entrada', 'Saída']),
  quantidade: z.coerce.number().positive('Quantidade deve ser positiva'),
  fornecedor: z.string().optional(),
  numero_nf: z.string().optional(),
  valor_unitario: z.coerce.number().min(0).optional(),
  observacao: z.string().optional(),
}).strict()

export async function registrarMovimentacao(formData: unknown): Promise<{ success?: boolean; error?: string }> {
  await requirePermission('inventory.adjust')
  const parsed = movSchema.safeParse(formData)
  if (!parsed.success) {
    return { error: parsed.error.flatten().formErrors.join(', ') || 'Dados inválidos' }
  }

  const supabase = await createServerSupabaseClient()
  const { error } = await supabase.rpc('record_inventory_movement', {
    p_tecido_id: parsed.data.tecido_id,
    p_data: parsed.data.data_movimentacao || todayBusinessDate(),
    p_tipo: parsed.data.tipo,
    p_quantidade: parsed.data.quantidade,
    p_fornecedor: parsed.data.fornecedor || null,
    p_numero_nf: parsed.data.numero_nf || null,
    p_valor_unitario: parsed.data.valor_unitario ?? null,
    p_observacao: parsed.data.observacao || null,
    p_reference_type: null,
    p_reference_id: null,
  })
  if (error) return { error: safeDatabaseError(error, 'Não foi possível registrar a movimentação.', { action: 'inventory.adjust', entityId: parsed.data.tecido_id }) }

  revalidatePath('/estoque')
  revalidatePath('/compras')
  revalidatePath('/dashboard')
  return { success: true }
}
