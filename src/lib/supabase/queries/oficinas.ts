import { createServerSupabaseClient, type ServerSupabaseClient } from '@/lib/supabase/server'
import { format, startOfMonth, endOfMonth } from 'date-fns'

export async function getEnviosOficina() {
  const supabase = await createServerSupabaseClient()
  const { data, error } = await supabase
    .from('envios_oficina')
    .select(`*, pedido:pedidos(numero, cliente), oficina:oficinas(nome)`)
    .order('created_at', { ascending: false })
  if (error) {
    console.error('Erro ao buscar envios de oficina:', error)
    return []
  }
  return data ?? []
}

export async function getKpisOficinas() {
  const supabase = await createServerSupabaseClient()
  const mesInicio = format(startOfMonth(new Date()), 'yyyy-MM-dd')
  const mesFim = format(endOfMonth(new Date()), 'yyyy-MM-dd')

  const [producao, aguardando, aPagar, pago] = await Promise.all([
    supabase
      .from('envios_oficina')
      .select('total_pecas')
      .not('status', 'eq', 'retornado'),
    supabase
      .from('envios_oficina')
      .select('*', { count: 'exact', head: true })
      .eq('status', 'enviado'),
    supabase
      .from('envios_oficina')
      .select('valor_total')
      .eq('status', 'pendente_pagamento')
      .gte('data_envio', mesInicio)
      .lte('data_envio', mesFim),
    supabase
      .from('envios_oficina')
      .select('valor_total')
      .eq('status', 'pago')
      .gte('data_envio', mesInicio)
      .lte('data_envio', mesFim),
  ])

  return {
    totalProducao:
      (producao.data as { total_pecas: number | null }[] | null)?.reduce(
        (s, i) => s + (i.total_pecas ?? 0),
        0
      ) ?? 0,
    aguardandoRetorno: aguardando.count ?? 0,
    aPagarMes:
      (aPagar.data as { valor_total: number | null }[] | null)?.reduce(
        (s, i) => s + (i.valor_total ?? 0),
        0
      ) ?? 0,
    pagoMes:
      (pago.data as { valor_total: number | null }[] | null)?.reduce(
        (s, i) => s + (i.valor_total ?? 0),
        0
      ) ?? 0,
  }
}

export async function getOficinasAtivas() {
  const supabase = await createServerSupabaseClient()
  const { data, error } = await supabase
    .from('oficinas')
    .select('id, nome, tipo')
    .order('nome')
  if (error) {
    console.error('Erro ao buscar oficinas:', error)
    return []
  }
  return data ?? []
}

export async function getPedidosAtivosParaEnvio() {
  const supabase = await createServerSupabaseClient()
  const { data, error } = await supabase
    .from('pedidos')
    .select('id, numero, cliente, costura_programado, costura_retorno, costureira_id, itens_pedido(qtde, tamanho, modelo, valor_unitario)')
    .eq('status', 'costura')
    .order('numero')
  if (error) {
    console.error('Erro ao buscar pedidos ativos:', error)
    return []
  }
  return data ?? []
}

interface ItemPedidoEnvio {
  qtde: number
  tamanho: string | null
  modelo: string | null
  valor_unitario: number | null
}

/**
 * Cria o envio de oficina automático quando um pedido avança para 'costura'.
 * Retorna uma mensagem de erro (string) em caso de falha, ou null em caso de
 * sucesso — o chamador decide se bloqueia a transição de status ou apenas avisa.
 */
export async function criarEnvioOficinaAutomatico(
  pedidoId: string,
  supabase: ServerSupabaseClient
): Promise<string | null> {
  // 1. Buscar detalhes do pedido
  const { data: pedido, error: fetchErr } = await supabase
    .from('pedidos')
    .select(`
      id, numero, cliente, costureira_id,
      costura_programado, costura_retorno,
      itens_pedido(qtde, tamanho, modelo, valor_unitario)
    `)
    .eq('id', pedidoId)
    .single()

  if (fetchErr || !pedido) {
    console.error('Erro ao carregar pedido para envio automático:', fetchErr)
    return fetchErr?.message ?? 'Pedido não encontrado ao gerar envio automático de oficina'
  }

  // 2. Determinar oficina_id - Não selecionar oficina automaticamente se for null
  const oficinaId = pedido.costureira_id
  if (!oficinaId) {
    console.warn('Pedido sem costureira cadastrada. Não será gerado o envio de oficina automático.')
    return 'Pedido sem costureira cadastrada — defina a oficina antes de avançar para costura'
  }

  // 3. Compilar modelo, grade e valores
  const grade: Record<string, number> = {}
  let totalPecas = 0
  let valorUnitario = 0
  const modelosSet = new Set<string>()

  const itensPedido = (pedido.itens_pedido ?? []) as ItemPedidoEnvio[]
  if (itensPedido.length > 0) {
    itensPedido.forEach(item => {
      const tam = (item.tamanho ?? '').toUpperCase().trim()
      const TAMANHOS = ['PP', 'P', 'M', 'G', 'GG', 'G1', 'G2', 'G3', 'G4', 'EG']
      if (TAMANHOS.includes(tam)) {
        grade[tam] = (grade[tam] || 0) + item.qtde
      }
      totalPecas += item.qtde
      if (item.modelo) modelosSet.add(item.modelo)
    })
    valorUnitario = itensPedido[0].valor_unitario ?? 0
  }

  const modeloStr = Array.from(modelosSet).join(', ')
  const valorTotal = totalPecas * valorUnitario

  // 4. Inserir na tabela envios_oficina usando a RPC segura para evitar duplicidade paralela
  const { error: rpcErr } = await supabase.rpc('criar_envio_oficina_seguro', {
    p_pedido_id: pedidoId,
    p_oficina_id: oficinaId,
    p_modelo: modeloStr || null,
    p_grade: grade,
    p_total_pecas: totalPecas,
    p_data_envio: pedido.costura_programado || new Date().toLocaleDateString('sv-SE'),
    p_retorno_previsto: pedido.costura_retorno || null,
    p_valor_unitario: valorUnitario,
    p_valor_total: valorTotal
  })

  if (rpcErr) {
    console.error('Erro ao inserir envio automático de oficina via RPC:', rpcErr.message)
    return rpcErr.message
  }

  return null
}
