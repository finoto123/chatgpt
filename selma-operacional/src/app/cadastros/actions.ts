'use server'

import { z } from 'zod'
import { createServerSupabaseClient } from '@/lib/supabase/server'
import { revalidatePath } from 'next/cache'
import { requirePermission } from '@/lib/auth/require-user'
import { safeDatabaseError } from '@/lib/security/errors'

const oficinaSchema = z.object({
  nome: z.string().trim().min(2).max(160),
  tipo: z.enum(['Costura', 'Bordado', 'Sublimação', 'DTF', 'Silk']),
  tipo_vinculo: z.enum(['INTERNA', 'EXTERNA']),
  cidade: z.string().trim().max(120).optional(),
  contato: z.string().trim().max(120).optional(),
  capacidade: z.record(z.string().max(80), z.number().min(0)).default({}),
}).strict()
const vendedorSchema = z.object({
  nome: z.string().trim().min(2).max(160),
  comissao_pct: z.number().min(0).max(100),
  contato: z.string().trim().max(120).optional(),
}).strict()
const feriadoSchema = z.object({
  data: z.iso.date(),
  nome: z.string().trim().min(2).max(160),
  tipo: z.enum(['Nacional', 'Municipal', 'Estadual']),
}).strict()

export async function criarOficina(
  data: unknown
): Promise<{ success?: boolean; error?: string }> {
  await requirePermission('settings.manage')
  const parsed = oficinaSchema.safeParse(data)
  if (!parsed.success) return { error: 'Dados da oficina inválidos.' }
  const supabase = await createServerSupabaseClient()
  const { error } = await supabase.from('oficinas').insert(parsed.data)
  if (error) return { error: safeDatabaseError(error, 'Não foi possível criar a oficina.', { action: 'settings.workshop.create' }) }
  revalidatePath('/cadastros')
  return { success: true }
}

export async function atualizarOficina(
  data: unknown
): Promise<{ success?: boolean; error?: string }> {
  await requirePermission('settings.manage')
  const parsed = oficinaSchema.extend({ id: z.string().uuid() }).safeParse(data)
  if (!parsed.success) return { error: 'Dados da oficina inválidos.' }
  const supabase = await createServerSupabaseClient()
  const { id, ...resto } = parsed.data
  const { error } = await supabase.from('oficinas').update(resto).eq('id', id)
  if (error) return { error: safeDatabaseError(error, 'Não foi possível atualizar a oficina.', { action: 'settings.workshop.update', entityId: id }) }
  revalidatePath('/cadastros')
  revalidatePath('/oficinas')
  return { success: true }
}

export async function criarVendedor(
  data: unknown
): Promise<{ success?: boolean; error?: string }> {
  await requirePermission('settings.manage')
  const parsed = vendedorSchema.safeParse(data)
  if (!parsed.success) return { error: 'Dados do vendedor inválidos.' }
  const supabase = await createServerSupabaseClient()
  const { error } = await supabase.from('vendedores').insert(parsed.data)
  if (error) return { error: safeDatabaseError(error, 'Não foi possível criar o vendedor.', { action: 'settings.salesperson.create' }) }
  revalidatePath('/cadastros')
  return { success: true }
}

export async function atualizarVendedor(
  data: unknown
): Promise<{ success?: boolean; error?: string }> {
  await requirePermission('settings.manage')
  const parsed = vendedorSchema.extend({ id: z.string().uuid() }).safeParse(data)
  if (!parsed.success) return { error: 'Dados do vendedor inválidos.' }
  const supabase = await createServerSupabaseClient()
  const { id, ...resto } = parsed.data
  const { error } = await supabase.from('vendedores').update(resto).eq('id', id)
  if (error) return { error: safeDatabaseError(error, 'Não foi possível atualizar o vendedor.', { action: 'settings.salesperson.update', entityId: id }) }
  revalidatePath('/cadastros')
  return { success: true }
}

export async function criarFeriado(
  data: unknown
): Promise<{ success?: boolean; error?: string }> {
  await requirePermission('settings.manage')
  const parsed = feriadoSchema.safeParse(data)
  if (!parsed.success) return { error: 'Dados do feriado inválidos.' }
  const supabase = await createServerSupabaseClient()
  const { error } = await supabase.from('feriados').insert(parsed.data)
  if (error) return { error: safeDatabaseError(error, 'Não foi possível criar o feriado.', { action: 'settings.holiday.create' }) }
  revalidatePath('/cadastros')
  return { success: true }
}

export async function deletarRegistro(
  tabela: 'oficinas' | 'vendedores' | 'feriados',
  id: string
): Promise<{ success?: boolean; error?: string }> {
  await requirePermission('settings.manage')
  const idParsed = z.string().uuid().safeParse(id)
  if (!idParsed.success) return { error: 'ID inválido' }

  const supabase = await createServerSupabaseClient()

  if (tabela === 'oficinas') {
    const { count: pedidosVinculados } = await supabase
      .from('pedidos')
      .select('id', { count: 'exact', head: true })
      .eq('costureira_id', idParsed.data)
    const { count: enviosVinculados } = await supabase
      .from('envios_oficina')
      .select('id', { count: 'exact', head: true })
      .eq('oficina_id', idParsed.data)
    const total = (pedidosVinculados ?? 0) + (enviosVinculados ?? 0)
    if (total > 0) {
      return { error: `Esta oficina está vinculada a ${total} pedido(s) e não pode ser excluída.` }
    }
  }

  if (tabela === 'vendedores') {
    const { count: pedidosVinculados } = await supabase
      .from('pedidos')
      .select('id', { count: 'exact', head: true })
      .eq('vendedor_id', idParsed.data)
    if ((pedidosVinculados ?? 0) > 0) {
      return { error: `Este vendedor está vinculado a ${pedidosVinculados} pedido(s) e não pode ser excluído.` }
    }
  }

  const { error } = await supabase.from(tabela).delete().eq('id', idParsed.data)
  if (error) return { error: safeDatabaseError(error, 'Não foi possível excluir o registro.', { action: 'settings.delete', entityId: idParsed.data }) }
  revalidatePath('/cadastros')
  if (tabela === 'oficinas') revalidatePath('/oficinas')
  if (tabela === 'vendedores') revalidatePath('/pedidos')
  return { success: true }
}
