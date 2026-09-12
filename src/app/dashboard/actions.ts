'use server'

import { createServerSupabaseClient } from '@/lib/supabase/server'
import { revalidatePath } from 'next/cache'
import { z } from 'zod'
import { requirePermission } from '@/lib/auth/require-user'
import { safeDatabaseError } from '@/lib/security/errors'
import { todayBusinessDate } from '@/lib/business-date'

const ESTAMPARIA_STATUS = z.enum(['sublimacao', 'dtf', 'bordados', 'costura'])

export interface PedidoAtrasado {
  id: string
  numero: string
  cliente: string
  entrega_programado: string
  status: string
}

export async function getPedidosAtrasados(): Promise<PedidoAtrasado[]> {
  await requirePermission('dashboard.view')
  const supabase = await createServerSupabaseClient()
  const hoje = todayBusinessDate()

  const { data, error } = await supabase
    .from('pedidos')
    .select('id, numero, cliente, entrega_programado, status')
    .lt('entrega_programado', hoje)
    .not('status', 'in', '("entregue","cancelado")')
    .order('entrega_programado', { ascending: true })
    .limit(20)

  if (error) {
    console.error('Erro ao buscar pedidos em atraso:', error)
    return []
  }
  return data ?? []
}

export async function moverParaCorte(pedidoId: string, data: { situacao: string; cortador: string }) {
  await requirePermission('production.update')
  const supabase = await createServerSupabaseClient()
  const { error } = await supabase
    .from('pedidos')
    .update({
      status: 'corte',
      corte_situacao: data.situacao,
      corte_cortador: data.cortador,
    })
    .eq('id', pedidoId)

  if (error) return { error: safeDatabaseError(error, 'Não foi possível mover o pedido para corte.', { action: 'production.stage_change', entityId: pedidoId }) }
  revalidatePath('/dashboard')
  revalidatePath('/producao')
  return { success: true }
}

export async function moverParaEstamparia(
  pedidoId: string,
  data: {
    targetStatus: string
    sublimacao_status?: string
    bordado_status?: string
    oficina_id?: string
    data_envio?: string
    retorno_previsto?: string
    valor_unitario?: number
    grade_quantidade?: Record<string, number>
    total_pecas?: number
  }
) {
  await requirePermission('production.update')
  const idParsed = z.string().uuid().safeParse(pedidoId)
  if (!idParsed.success) return { error: 'ID de pedido inválido' }
  const targetParsed = ESTAMPARIA_STATUS.safeParse(data.targetStatus)
  if (!targetParsed.success) return { error: 'Status de destino inválido' }

  const supabase = await createServerSupabaseClient()

  // Pre-flight: se saindo de 'bordados', verificar bordado_status === 'finalizado'
  const { data: pedidoAtual, error: selectError } = await supabase
    .from('pedidos')
    .select('status, bordado_status')
    .eq('id', idParsed.data)
    .single()

  if (selectError) return { error: safeDatabaseError(selectError, 'Não foi possível consultar o pedido.', { action: 'production.stage.read', entityId: idParsed.data }) }

  if (pedidoAtual?.status === 'bordados' && pedidoAtual.bordado_status !== 'finalizado') {
    return { error: 'Finalize o bordado antes de avançar o pedido' }
  }

  const updateData: Record<string, unknown> = { status: targetParsed.data }

  if (data.sublimacao_status) {
    updateData.sublimacao_status = data.sublimacao_status
  }
  if (data.bordado_status) {
    updateData.bordado_status = data.bordado_status
  }

  // Se tem dados de DTF externo, cria o envio_oficina ANTES de mudar o status do
  // pedido — se o insert falhar, o pedido permanece no status atual em vez de
  // avançar sem um envio correspondente.
  if (data.oficina_id && data.data_envio && data.retorno_previsto && data.valor_unitario !== undefined) {
    const valor_total = (data.total_pecas || 0) * data.valor_unitario
    const { error: envioError } = await supabase.from('envios_oficina').insert({
      pedido_id: idParsed.data,
      oficina_id: data.oficina_id,
      data_envio: data.data_envio,
      retorno_previsto: data.retorno_previsto,
      valor_unitario: data.valor_unitario,
      valor_total: valor_total,
      grade_quantidade: data.grade_quantidade || {},
      total_pecas: data.total_pecas || 0,
      status: 'enviado'
    })

    if (envioError) return { error: safeDatabaseError(envioError, 'Não foi possível registrar o envio externo.', { action: 'production.workshop.create', entityId: idParsed.data }) }
  }

  const { error: updateError } = await supabase
    .from('pedidos')
    .update(updateData)
    .eq('id', idParsed.data)

  if (updateError) return { error: safeDatabaseError(updateError, 'Não foi possível avançar o pedido.', { action: 'production.stage_change', entityId: idParsed.data }) }

  revalidatePath('/dashboard')
  revalidatePath('/sublimacao')
  revalidatePath('/dtf')
  revalidatePath('/bordados')
  revalidatePath('/pedidos')
  return { success: true }
}

export async function moverParaCostura(
  pedidoId: string,
  data: {
    oficina_id: string
    data_envio: string
    retorno_previsto: string
    valor_unitario: number
    grade_quantidade: Record<string, number>
    total_pecas: number
  }
) {
  await requirePermission('production.update')
  const idParsed = z.string().uuid().safeParse(pedidoId)
  if (!idParsed.success) return { error: 'ID de pedido inválido' }

  const supabase = await createServerSupabaseClient()

  // Cria o envio_oficina ANTES de mudar o status do pedido — se o insert
  // falhar, o pedido permanece em 'sublimacao'/'dtf'/'bordados' em vez de
  // avançar para 'costura' sem um envio correspondente.
  const valor_total = data.total_pecas * data.valor_unitario
  const { error: envioError } = await supabase.from('envios_oficina').insert({
    pedido_id: idParsed.data,
    oficina_id: data.oficina_id,
    data_envio: data.data_envio,
    retorno_previsto: data.retorno_previsto,
    valor_unitario: data.valor_unitario,
    valor_total: valor_total,
    grade_quantidade: data.grade_quantidade,
    total_pecas: data.total_pecas,
    status: 'enviado'
  })

  if (envioError) return { error: safeDatabaseError(envioError, 'Não foi possível registrar o envio para costura.', { action: 'production.workshop.create', entityId: idParsed.data }) }

  const { error: updateError } = await supabase
    .from('pedidos')
    .update({ status: 'costura' })
    .eq('id', idParsed.data)

  if (updateError) return { error: safeDatabaseError(updateError, 'Não foi possível avançar o pedido.', { action: 'production.stage_change', entityId: idParsed.data }) }

  revalidatePath('/dashboard')
  revalidatePath('/oficinas')
  return { success: true }
}

export async function moverParaAcabamento(pedidoId: string, data: { situacao: string }) {
  await requirePermission('production.update')
  const supabase = await createServerSupabaseClient()
  const { error } = await supabase
    .from('pedidos')
    .update({
      status: 'acabamento',
      embalagem_situacao: data.situacao,
    })
    .eq('id', pedidoId)

  if (error) return { error: safeDatabaseError(error, 'Não foi possível mover o pedido para acabamento.', { action: 'production.stage_change', entityId: pedidoId }) }
  revalidatePath('/dashboard')
  revalidatePath('/acabamento')
  return { success: true }
}
