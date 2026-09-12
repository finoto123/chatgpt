import { createServerSupabaseClient } from '@/lib/supabase/server'
import { Cliente } from '@/types'

export async function getClientes(search?: string): Promise<Cliente[]> {
  const supabase = await createServerSupabaseClient()

  let query = supabase
    .from('clientes')
    .select('*')
    .order('nome')

  if (search && search.length >= 2) {
    query = query.ilike('nome', `%${search}%`)
  }

  const { data } = await query
  return (data ?? []) as Cliente[]
}

export async function getClienteById(id: string) {
  const supabase = await createServerSupabaseClient()
  const { data, error } = await supabase
    .from('clientes')
    .select('*')
    .eq('id', id)
    .single()

  if (error) return null
  return data as Cliente
}

export async function getClientesComEstatisticas(): Promise<Cliente[]> {
  const supabase = await createServerSupabaseClient()

  const { data: clientes } = await supabase
    .from('clientes')
    .select('*')
    .order('nome')

  if (!clientes || clientes.length === 0) return []

  // Busca pedidos agrupados por cliente_id
  const { data: pedidosAgrupados } = await supabase
    .from('pedidos')
    .select('cliente_id, id, cliente, data_pedido')
    .not('cliente_id', 'is', null)

  // Busca itens para calcular valor e peças
  const pedidoIds = (pedidosAgrupados ?? []).map(p => p.id)
  const { data: itens } = pedidoIds.length > 0
    ? await supabase
        .from('itens_pedido')
        .select('pedido_id, qtde, valor_unitario')
        .in('pedido_id', pedidoIds)
    : { data: [] }

  const statsMap: Record<string, { total_pedidos: number; total_pecas: number; valor_total: number; data_ultimo_pedido: string | null }> = {}

  for (const p of pedidosAgrupados ?? []) {
    if (!p.cliente_id) continue
    if (!statsMap[p.cliente_id]) {
      statsMap[p.cliente_id] = { total_pedidos: 0, total_pecas: 0, valor_total: 0, data_ultimo_pedido: null }
    }
    statsMap[p.cliente_id].total_pedidos++
    
    if (p.data_pedido) {
      if (!statsMap[p.cliente_id].data_ultimo_pedido || p.data_pedido > statsMap[p.cliente_id].data_ultimo_pedido!) {
        statsMap[p.cliente_id].data_ultimo_pedido = p.data_pedido
      }
    }
  }

  for (const item of itens ?? []) {
    const pedido = (pedidosAgrupados ?? []).find(p => p.id === item.pedido_id)
    if (!pedido?.cliente_id) continue
    if (!statsMap[pedido.cliente_id]) {
      statsMap[pedido.cliente_id] = { total_pedidos: 0, total_pecas: 0, valor_total: 0, data_ultimo_pedido: null }
    }
    statsMap[pedido.cliente_id].total_pecas += item.qtde ?? 0
    statsMap[pedido.cliente_id].valor_total += (item.qtde ?? 0) * (item.valor_unitario ?? 0)
  }

  return clientes.map(c => ({
    ...c,
    total_pedidos: statsMap[c.id]?.total_pedidos ?? 0,
    total_pecas: statsMap[c.id]?.total_pecas ?? 0,
    valor_total: statsMap[c.id]?.valor_total ?? 0,
    data_ultimo_pedido: statsMap[c.id]?.data_ultimo_pedido ?? null,
  })) as Cliente[]
}

export async function getPedidosPorCliente(clienteId: string, clienteNome: string) {
  const supabase = await createServerSupabaseClient()

  const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i
  if (!uuidRegex.test(clienteId)) return []

  const selectFields = `*, vendedor:vendedores(nome), itens_pedido(qtde, valor_unitario)`

  const [byId, byNome] = await Promise.all([
    supabase
      .from('pedidos')
      .select(selectFields)
      .eq('cliente_id', clienteId)
      .order('created_at', { ascending: false }),
    supabase
      .from('pedidos')
      .select(selectFields)
      .ilike('cliente', clienteNome)
      .is('cliente_id', null)
      .order('created_at', { ascending: false }),
  ])

  const seen = new Set<string>()
  const combined = [...(byId.data ?? []), ...(byNome.data ?? [])].filter(p => {
    if (seen.has(p.id)) return false
    seen.add(p.id)
    return true
  })

  return combined.map(p => ({
    ...p,
    qtde_total: (p.itens_pedido as { qtde: number; valor_unitario: number }[])
      ?.reduce((s: number, i: { qtde: number; valor_unitario: number }) => s + i.qtde, 0) ?? 0,
    valor_total: (p.itens_pedido as { qtde: number; valor_unitario: number }[])
      ?.reduce((s: number, i: { qtde: number; valor_unitario: number }) => s + i.qtde * i.valor_unitario, 0) ?? 0,
  }))
}
