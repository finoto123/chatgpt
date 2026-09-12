'use server'
import { z } from 'zod'
import { revalidatePath } from 'next/cache'
import { createServerSupabaseClient } from '@/lib/supabase/server'
import { requirePermission } from '@/lib/auth/require-user'
import { safeDatabaseError } from '@/lib/security/errors'
import { todayBusinessDate } from '@/lib/business-date'

export async function moverAcabamento(
  pedidoId: string,
  novoStatus: 'aguardando' | 'finalizando' | 'entregue',
  extra?: { numero_nf?: string; data_nf?: string }
) {
  await requirePermission('production.update')
  const idParsed = z.string().uuid().safeParse(pedidoId)
  if (!idParsed.success) return { error: 'ID de pedido inválido' }
  const supabase = await createServerSupabaseClient()
  const hoje = todayBusinessDate()

  const update: Record<string, unknown> = { embalagem_status: novoStatus }

  if (novoStatus === 'finalizando') {
    update.embalagem_inicio_real = hoje
    update.status = 'acabamento'
  }

  if (novoStatus === 'entregue') {
    update.embalagem_fim_real = hoje
    update.status = 'entregue'
    if (extra?.numero_nf) update.embalagem_numero_nf = extra.numero_nf
    if (extra?.data_nf)   update.embalagem_data_nf   = extra.data_nf
  }

  const { error } = await supabase.from('pedidos').update(update).eq('id', idParsed.data)
  if (error) return { error: safeDatabaseError(error, 'Não foi possível atualizar o acabamento.', { action: 'production.finishing', entityId: idParsed.data }) }

  revalidatePath('/acabamento')
  revalidatePath('/pedidos')
  revalidatePath('/dashboard')
  revalidatePath('/financeiro')
  return { success: true }
}
