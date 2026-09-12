import { createServerSupabaseClient } from '@/lib/supabase/server'
import { endOfMonth, format, startOfMonth } from 'date-fns'
import { balanceDue } from '@/lib/domain/finance/calculations'

export interface DadosMes {
  mes: string
  faturamento: number
}

export interface KpisFinanceiro {
  metaAnual: number
  despesasFixasMensais: number
  totalAnual: number
  totalMes: number
  totalAReceber: number
  metaMensal: number
  // Quantidade de pedidos em aberto (não entregues/cancelados)
  pedidosAbertosCount: number
  // Data do pedido em aberto mais antigo (ISO string), para calcular dias pendentes
  pedidosMaisAntigoPendente: string | null
}

export interface RecebimentoPedido {
  id: string
  numero: string
  cliente: string
  forma_pagamento: string | null
  valor_entrada: number
  valor_pago_adicional: number
  entrega_programado: string
  status: string
  vendedor: { nome: string } | null
  valor_total: number
  status_pagamento: string
}

export async function getFaturamentoMensal(ano: number): Promise<DadosMes[]> {
  const supabase = await createServerSupabaseClient()

  const { data, error } = await supabase
    .from('pedidos')
    .select('entrega_programado, itens_pedido(qtde, valor_unitario)')
    .not('status', 'in', '("cancelado")')
    .neq('entrega_programado', '2099-12-31')
    .gte('entrega_programado', `${ano}-01-01`)
    .lte('entrega_programado', `${ano}-12-31`)

  if (error) {
    console.error('Erro ao buscar faturamento mensal:', error.message)
    return Array.from({ length: 12 }, (_, i) => ({
      mes: ['Jan','Fev','Mar','Abr','Mai','Jun','Jul','Ago','Set','Out','Nov','Dez'][i],
      faturamento: 0
    }))
  }

  const meses = ['Jan', 'Fev', 'Mar', 'Abr', 'Mai', 'Jun', 'Jul', 'Ago', 'Set', 'Out', 'Nov', 'Dez']
  const porMes = Array.from({ length: 12 }, () => 0)

  ;(data ?? []).forEach((p) => {
    const mes = new Date(p.entrega_programado + 'T00:00:00').getMonth()
    const fat = (p.itens_pedido as { qtde: number; valor_unitario: number }[])?.reduce(
      (s, i) => s + i.qtde * i.valor_unitario,
      0
    ) ?? 0
    porMes[mes] += fat
  })

  return meses.map((nome, i) => ({ mes: nome, faturamento: porMes[i] }))
}

export async function getKpisFinanceiro(): Promise<KpisFinanceiro> {
  const supabase = await createServerSupabaseClient()
  const ano = new Date().getFullYear()
  const hoje = new Date()
  const mesInicio = format(startOfMonth(hoje), 'yyyy-MM-dd')
  const mesFim = format(endOfMonth(hoje), 'yyyy-MM-dd')

  const [config, pedidosAno, pedidosMes, pedidosAbertos, payments] = await Promise.all([
    supabase.from('configuracoes_financeiro').select('*').single(),
    supabase
      .from('pedidos')
      .select('entrega_programado, itens_pedido(qtde, valor_unitario)')
      .not('status', 'in', '("cancelado")')
      .neq('entrega_programado', '2099-12-31')
      .gte('entrega_programado', `${ano}-01-01`)
      .lte('entrega_programado', `${ano}-12-31`),
    supabase
      .from('pedidos')
      .select('itens_pedido(qtde, valor_unitario)')
      .not('status', 'in', '("cancelado")')
      .neq('entrega_programado', '2099-12-31')
      .gte('entrega_programado', mesInicio)
      .lte('entrega_programado', mesFim),
    supabase
      .from('pedidos')
      .select('id, itens_pedido(qtde, valor_unitario), valor_entrada, valor_pago_adicional, data_pedido')
      .not('status', 'in', '("entregue","cancelado")')
      // Ordena por data_pedido asc para identificar o mais antigo no índice 0
      .order('data_pedido', { ascending: true }),
    supabase.from('payments').select('order_id, amount, status').eq('status', 'confirmed'),
  ])

  const calcFat = (pedidos: { itens_pedido: { qtde: number; valor_unitario: number }[] | null }[] | null) =>
    (pedidos ?? []).reduce((s, p) => {
      return s + ((p.itens_pedido as { qtde: number; valor_unitario: number }[]) ?? []).reduce(
        (ss, i) => ss + i.qtde * i.valor_unitario,
        0
      )
    }, 0)

  if (config.error || pedidosAno.error || pedidosMes.error || pedidosAbertos.error || payments.error) {
    console.error('Erro ao buscar KPIs financeiros:', config.error || pedidosAno.error || pedidosMes.error || pedidosAbertos.error || payments.error)
  }

  const totalAnual = calcFat(pedidosAno.data as { itens_pedido: { qtde: number; valor_unitario: number }[] | null }[])
  const totalMes = calcFat(pedidosMes.data as { itens_pedido: { qtde: number; valor_unitario: number }[] | null }[])

  type PedidoAberto = {
    itens_pedido: { qtde: number; valor_unitario: number }[] | null
    valor_entrada: number | null
    valor_pago_adicional: number | null
    data_pedido: string
  }

  const pedidosAbertosData = (pedidosAbertos.data ?? []) as (PedidoAberto & { id?: string })[]
  const paidByOrder = new Map<string, number>()
  for (const payment of (payments.data ?? []) as Array<{ order_id: string; amount: number }>) {
    paidByOrder.set(payment.order_id, (paidByOrder.get(payment.order_id) ?? 0) + Number(payment.amount || 0))
  }

  const totalAReceber = pedidosAbertosData.reduce((s, p) => {
    const total = (p.itens_pedido ?? []).reduce(
      (ss, i) => ss + i.qtde * i.valor_unitario,
      0
    )
    const totalRecebido = p.id ? (paidByOrder.get(p.id) ?? 0) : ((p.valor_entrada ?? 0) + (p.valor_pago_adicional ?? 0))
    return s + balanceDue(total, totalRecebido)
  }, 0)

  // Pedido mais antigo em aberto — já ordenado por data_pedido asc
  const pedidosMaisAntigoPendente = pedidosAbertosData[0]?.data_pedido ?? null

  const metaAnual = config.data?.meta_anual ?? 1500000
  const despesasFixasMensais = config.data?.despesas_fixas_mensais ?? 28000

  return {
    metaAnual,
    despesasFixasMensais,
    totalAnual,
    totalMes,
    totalAReceber,
    metaMensal: metaAnual / 12,
    pedidosAbertosCount: pedidosAbertosData.length,
    pedidosMaisAntigoPendente,
  }
}

export async function getRecebimentosPorPedido(
  mes?: string,
  status?: string
): Promise<RecebimentoPedido[]> {
  const supabase = await createServerSupabaseClient()
  const anoAtual = new Date().getFullYear()

  let query = supabase
    .from('pedidos')
    .select(`
      id, numero, cliente, forma_pagamento, valor_entrada,
      valor_pago_adicional, status_pagamento, entrega_programado, status,
      vendedor:vendedores(nome),
      itens_pedido(qtde, valor_unitario)
    `)
    .not('status', 'in', '("cancelado")')
    .neq('entrega_programado', '2099-12-31')
    .order('entrega_programado', { ascending: false })
    .limit(100)

  if (mes && mes !== 'todos') {
    const m = mes.padStart(2, '0')
    // Filtra pelo mês no ano atual
    query = query
      .gte('entrega_programado', `${anoAtual}-${m}-01`)
      .lte('entrega_programado', `${anoAtual}-${m}-31`)
  }

  const { data, error } = await query

  if (error) {
    console.error('Erro ao buscar recebimentos:', error.message)
    return []
  }

  type PedidoRow = {
    id: string
    numero: string
    cliente: string
    forma_pagamento: string | null
    valor_entrada: number | null
    valor_pago_adicional: number | null
    status_pagamento: string | null
    entrega_programado: string
    status: string
    vendedor: { nome: string }[] | null
    itens_pedido: { qtde: number; valor_unitario: number }[] | null
  }

  const recebimentos = ((data ?? []) as unknown as PedidoRow[]).map(p => {
    const valorTotal = (p.itens_pedido ?? []).reduce(
      (s, i) => s + i.qtde * i.valor_unitario,
      0
    )
    const entrada = p.valor_entrada ?? 0
    const valorPagoAdicional = p.valor_pago_adicional ?? 0
    const totalRecebido = entrada + valorPagoAdicional
    const statusPagamento: string =
      p.status_pagamento ??
      (totalRecebido >= valorTotal && valorTotal > 0
        ? 'pago'
        : totalRecebido > 0 && totalRecebido < valorTotal
        ? 'parcial'
        : 'pendente')

    return {
      id: p.id,
      numero: p.numero,
      cliente: p.cliente,
      forma_pagamento: p.forma_pagamento,
      valor_entrada: entrada,
      valor_pago_adicional: valorPagoAdicional,
      entrega_programado: p.entrega_programado,
      status: p.status,
      vendedor: Array.isArray(p.vendedor) ? (p.vendedor[0] ?? null) : p.vendedor,
      valor_total: valorTotal,
      status_pagamento: statusPagamento,
    }
  })

  // Filtra por status de pagamento se fornecido
  if (status && status !== 'todos') {
    return recebimentos.filter(r => r.status_pagamento === status)
  }

  return recebimentos
}
