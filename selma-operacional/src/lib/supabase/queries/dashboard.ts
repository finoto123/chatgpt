import { createServerSupabaseClient } from '@/lib/supabase/server'
import { addDays, format } from 'date-fns'
import { todayBusinessDate } from '@/lib/business-date'


export async function getDashboardKpis() {
  const supabase = await createServerSupabaseClient()
  const hoje = todayBusinessDate()

  const [ativos, atraso, pecasProducao] = await Promise.all([
    supabase.from('pedidos')
      .select('itens_pedido(qtde)', { count: 'exact' })
      .not('status', 'in', '("entregue","cancelado")'),

    supabase.from('pedidos')
      .select('*', { count: 'exact', head: true })
      .lt('entrega_programado', hoje)
      .not('status', 'in', '("entregue","cancelado")'),

    supabase.from('itens_pedido')
      .select('qtde, pedido:pedidos!inner(status)')
      .not('pedido.status', 'in', '("entregue","cancelado")'),
  ])

  if (ativos.error || atraso.error || pecasProducao.error) {
    console.error('Erro ao buscar KPIs do dashboard:', ativos.error || atraso.error || pecasProducao.error)
    return { totalPedidosAtivos: 0, totalPecasAtraso: 0, totalPecasProducao: 0 }
  }

  return {
    totalPedidosAtivos: ativos.count ?? 0,
    totalPecasAtraso: (atraso.data as Array<{ itens_pedido: Array<{ qtde: number }> | null }> | null ?? []).reduce((sum, p) => sum + (p.itens_pedido ?? []).reduce((s, i) => s + (i.qtde || 0), 0), 0),
    totalPecasProducao: (pecasProducao.data as { qtde: number }[] | null)?.reduce((s, i) => s + (i.qtde || 0), 0) ?? 0,
  }
}

export async function getPipelineKanban() {
  const supabase = await createServerSupabaseClient()
  const { data, error } = await supabase
    .from('pedidos')
    .select('id, numero, cliente, entrega_programado, status, tipo_estampa, itens_pedido(qtde, tamanho)')
    .not('status', 'in', '("entregue","cancelado")')
    .order('entrega_programado', { ascending: true })
  if (error) return []
  return data ?? []
}

export async function getPedidosEntregaProxima() {
  const supabase = await createServerSupabaseClient()
  const hoje = todayBusinessDate()
  const em7dias = format(addDays(new Date(), 7), 'yyyy-MM-dd')
  const { data, error } = await supabase
    .from('pedidos')
    .select('id, numero, cliente, entrega_programado, status')
    .gte('entrega_programado', hoje)
    .lte('entrega_programado', em7dias)
    .not('status', 'in', '("entregue","cancelado")')
    .order('entrega_programado')
  if (error) return []
  return data ?? []
}

export async function getTecidosParaComprar() {
  const supabase = await createServerSupabaseClient()
  const { data, error } = await supabase
    .from('estoque_atual')
    .select('*')
    .in('situacao', ['COMPRAR', 'ATENÇÃO'])
    .limit(5)
  if (error) return []
  return data ?? []
}

export async function getResumoEstamparia() {
  const supabase = await createServerSupabaseClient()
  
  const [sublimacao, dtf, bordado] = await Promise.all([
    supabase.from('pedidos')
      .select('*', { count: 'exact', head: true })
      .ilike('tipo_estampa', '%SUBLIMAÇÃO%')
      .not('status', 'in', '("entregue","cancelado")')
      .not('sublimacao_status', 'eq', 'finalizada'),
      
    supabase.from('pedidos')
      .select('*', { count: 'exact', head: true })
      .ilike('tipo_estampa', '%DTF%')
      .not('status', 'in', '("entregue","cancelado")')
      .not('dtf_status', 'eq', 'finalizado'),
      
    supabase.from('pedidos')
      .select('*', { count: 'exact', head: true })
      .ilike('tipo_estampa', '%BORDADO%')
      .not('status', 'in', '("entregue","cancelado")')
      .not('bordado_status', 'eq', 'finalizado'),
  ])

  if (sublimacao.error || dtf.error || bordado.error) {
    console.error('Erro ao buscar resumo estamparia:', sublimacao.error || dtf.error || bordado.error)
  }

  return {
    sublimacao: sublimacao.count ?? 0,
    dtf: dtf.count ?? 0,
    bordado: bordado.count ?? 0,
  }
}

export async function getResumoOficinas() {
  const supabase = await createServerSupabaseClient()
  const { data, error } = await supabase
    .from('envios_oficina')
    .select('total_pecas, qt_retornada_1a_entrega')
    .eq('status', 'enviado')

  if (error) return 0
  let pecasExternas = 0
  if (data) {
    pecasExternas = data.reduce((acc, curr) => {
      const enviadas = curr.total_pecas || 0
      const retornadas = curr.qt_retornada_1a_entrega || 0
      return acc + (enviadas - retornadas)
    }, 0)
  }
  
  return pecasExternas
}

export async function getResumoFinanceiro() {
  const supabase = await createServerSupabaseClient()
  
  // Total a receber = soma de (valor total do pedido - valor entrada) onde status não é entregue ou cancelado
  const { data, error } = await supabase
    .from('pedidos')
    .select('valor_entrada, valor_pago_adicional, itens_pedido(qtde, valor_unitario)')
    .not('status', 'in', '("entregue","cancelado")')

  if (error) return 0
  let aReceber = 0
  if (data) {
    data.forEach(pedido => {
      const itens = pedido.itens_pedido as Array<{ qtde: number; valor_unitario: number }> | null
      const totalPedido = itens?.reduce((s, i) => s + (i.qtde * i.valor_unitario), 0) || 0
      const entrada = pedido.valor_entrada || 0
      const pagoAdicional = pedido.valor_pago_adicional || 0
      const resto = totalPedido - entrada - pagoAdicional
      if (resto > 0) aReceber += resto
    })
  }
  
  return aReceber
}

export async function getOficinas() {
  const supabase = await createServerSupabaseClient()
  const { data, error } = await supabase
    .from('oficinas')
    .select('id, nome, tipo')
    .order('nome')
  if (error) return []
  return data ?? []
}
