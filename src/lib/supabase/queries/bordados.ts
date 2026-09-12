import { createServerSupabaseClient } from '@/lib/supabase/server'
import { todayBusinessDate } from '@/lib/business-date'
import { getEtapaDepoisBordado } from '@/lib/estampa-flow'
import { Pedido } from '@/types'

export async function getPedidosBordado(): Promise<Pedido[]> {
  const supabase = await createServerSupabaseClient()

  const { data, error } = await supabase
    .from('pedidos')
    .select(`
      id,
      numero,
      cliente,
      entrega_programado,
      bordado_status,
      itens_pedido(qtde)
    `)
    .eq('status', 'bordados')
    .order('entrega_programado', { ascending: true })

  if (error) throw error
  if (!data) return []

  // Ensure itens is mapped properly just like in other queries
  return data.map((p) => ({
    ...p,
    itens: p.itens_pedido || [],
  })) as unknown as Pedido[]
}

export async function updateBordadoStatus(pedidoId: string, status: string) {
  const supabase = await createServerSupabaseClient()

  const updateData: Record<string, unknown> = { bordado_status: status }

  if (status === 'para_bordar') {
    updateData.bordado_inicio = todayBusinessDate()
  } else if (status === 'finalizado') {
    updateData.bordado_fim = todayBusinessDate()
    const { data: pedido, error: selectError } = await supabase
      .from('pedidos')
      .select('tipo_estampa, etapas_ativas')
      .eq('id', pedidoId)
      .single()

    if (selectError) return { error: selectError }
    updateData.status = getEtapaDepoisBordado(pedido?.tipo_estampa, pedido?.etapas_ativas)
  }

  const { error } = await supabase
    .from('pedidos')
    .update(updateData)
    .eq('id', pedidoId)

  if (error) {
    console.error('Erro ao atualizar status do bordado:', error)
    return { error }
  }

  let avisoEnvioAutomatico: string | null = null
  if (updateData.status === 'costura') {
    const { criarEnvioOficinaAutomatico } = await import('@/lib/supabase/queries/oficinas')
    avisoEnvioAutomatico = await criarEnvioOficinaAutomatico(pedidoId, supabase)
  }

  return { success: true, avisoEnvioAutomatico }
}
