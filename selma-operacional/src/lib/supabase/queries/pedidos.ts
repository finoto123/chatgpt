import { createServerSupabaseClient } from '@/lib/supabase/server'
import { todayBusinessDate } from '@/lib/business-date'

export async function getPedidos(filtros?: { status?: string; search?: string; page?: number, statusExcluir?: string[] }) {
  const supabase = await createServerSupabaseClient()
  const pageSize = 20
  const page = filtros?.page ?? 0

  let query = supabase
    .from('pedidos')
    .select(
      `*, vendedor:vendedores(nome), costureira:oficinas!costureira_id(nome), estampa_oficina:oficinas!estampa_oficina_id(nome), itens:itens_pedido(*)`,
      { count: 'exact' }
    )
    .order('created_at', { ascending: false })
    .range(page * pageSize, (page + 1) * pageSize - 1)

  if (filtros?.status === 'atrasado') {
    const hoje = todayBusinessDate()
    query = query
      .lt('entrega_programado', hoje)
      .not('status', 'in', '("entregue","cancelado")')
  } else if (filtros?.status && filtros.status !== 'todos') {
    query = query.eq('status', filtros.status)
  }

  if (filtros?.statusExcluir && filtros.statusExcluir.length > 0) {
    const list = filtros.statusExcluir.map(s => `"${s}"`).join(',')
    query = query.not('status', 'in', `(${list})`)
  }

  if (filtros?.search) {
    const search = filtros.search.replace(/[,().]/g, '')
    query = query.or(`cliente.ilike.%${search}%,numero.ilike.%${search}%`)
  }

  const { data, count, error } = await query

  if (error) {
    console.error('Erro ao buscar pedidos:', error.message)
    return { pedidos: [], total: 0 }
  }

  return {
    pedidos: (data ?? []).map(p => ({
      ...p,
      qtde_total: (p.itens as { qtde: number; valor_unitario: number }[])?.reduce((s, i) => s + i.qtde, 0) ?? 0,
      valor_total: p.commercial_total_amount ?? (p.itens as { qtde: number; valor_unitario: number }[])?.reduce((s, i) => s + i.qtde * i.valor_unitario, 0) ?? 0,
    })),
    total: count ?? 0,
  }
}

export async function getPedidoById(id: string, includePayments = false) {
  const supabase = await createServerSupabaseClient()
  const { data, error } = await supabase
    .from('pedidos')
    .select(`
      *,
      vendedor:vendedores(id, nome),
      costureira:oficinas!costureira_id(id, nome),
      estampa_oficina:oficinas!estampa_oficina_id(id, nome),
      itens_pedido(
        id,
        qtde,
        tamanho,
        modelo,
        tecido_cor,
        manga,
        gola,
        acabamento,
        observacao,
        valor_unitario
      )
    `)
    .eq('id', id)
    .maybeSingle()

  if (error) {
    console.error('getPedidoById error:', error)
    return null
  }

  // Mapeia itens_pedido para itens (campo esperado pelo tipo Pedido)
  if (data) {
    let payments: Array<Record<string, unknown>> = []
    if (includePayments) {
      const paymentResult = await supabase
        .from('payments')
        .select('id, amount, payment_method, payment_date, reference, status, created_at')
        .eq('order_id', id)
        .order('created_at', { ascending: false })

      if (paymentResult.error) {
        console.error('getPedidoById payments error:', paymentResult.error)
      } else {
        payments = paymentResult.data ?? []
      }
    }

    return {
      ...data,
      itens: (data as unknown as { itens_pedido: unknown[] }).itens_pedido ?? [],
      payments,
    }
  }
  return null
}

export async function getPedidosAtivos() {
  const supabase = await createServerSupabaseClient()
  const { data } = await supabase
    .from('pedidos')
    .select('id, numero, cliente, status')
    .not('status', 'in', '("entregue","cancelado")')
    .order('numero')
  return data ?? []
}
