'use server'

import { z } from 'zod'
import { createServerSupabaseClient } from '@/lib/supabase/server'
import { getPrimeiraEtapaDepoisCorte } from '@/lib/estampa-flow'
import { revalidatePath } from 'next/cache'
import { corteSchema as dadosCorteSchema } from '@/lib/schemas/corte'
import { requirePermission } from '@/lib/auth/require-user'
import { safeDatabaseError } from '@/lib/security/errors'

export async function atualizarDadosCorte(
  pedidoId: string,
  dados: unknown
): Promise<{ success?: boolean; error?: string; avisoEnvioAutomatico?: string | null }> {
  await requirePermission('production.update')
  const idParsed = z.string().uuid().safeParse(pedidoId)
  if (!idParsed.success) return { error: 'ID de pedido inválido' }
  const parsed = dadosCorteSchema.safeParse(dados)
  if (!parsed.success) return { error: 'Dados de corte inválidos' }

  const supabase = await createServerSupabaseClient()
  const updateData: Record<string, unknown> = { ...parsed.data }

  const { data: pedidoAtual, error: selectError } = await supabase
    .from('pedidos')
    .select('status, tipo_estampa, etapas_ativas')
    .eq('id', idParsed.data)
    .single()

  if (selectError) return { error: safeDatabaseError(selectError, 'Não foi possível consultar o pedido.', { action: 'production.cut.read', entityId: idParsed.data }) }

  let avisoEnvioAutomatico: string | null = null

  if (parsed.data.corte_situacao === 'FINALIZADO') {
    const proximoStatus = getPrimeiraEtapaDepoisCorte(pedidoAtual?.tipo_estampa, pedidoAtual?.etapas_ativas)
    updateData.status = proximoStatus

    const { error: updateError } = await supabase.from('pedidos').update(updateData).eq('id', idParsed.data)
    if (updateError) return { error: safeDatabaseError(updateError, 'Não foi possível atualizar o corte.', { action: 'production.cut', entityId: idParsed.data }) }

    if (proximoStatus === 'costura') {
      const { criarEnvioOficinaAutomatico } = await import('@/lib/supabase/queries/oficinas')
      avisoEnvioAutomatico = await criarEnvioOficinaAutomatico(idParsed.data, supabase)
    }
  } else {
    if (
      ['EM ANDAMENTO', 'ATRASADO'].includes(parsed.data.corte_situacao ?? '') &&
      pedidoAtual?.status === 'aguardando_corte'
    ) {
      updateData.status = 'corte'
    }

    const { error } = await supabase.from('pedidos').update(updateData).eq('id', idParsed.data)
    if (error) return { error: safeDatabaseError(error, 'Não foi possível atualizar o corte.', { action: 'production.cut', entityId: idParsed.data }) }
  }

  revalidatePath('/producao')
  revalidatePath('/dashboard')
  revalidatePath('/sublimacao')
  revalidatePath('/dtf')
  revalidatePath('/bordados')
  return { success: true, avisoEnvioAutomatico }
}
