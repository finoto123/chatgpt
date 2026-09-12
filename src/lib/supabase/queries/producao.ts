import { createServerSupabaseClient } from '@/lib/supabase/server'
import { todayBusinessDate } from '@/lib/business-date'

export async function getInfoCardsProducao() {
  const supabase = await createServerSupabaseClient()
  const hoje = todayBusinessDate()

  const [reposicao, proximaColeta] = await Promise.all([
    supabase
      .from('estoque_atual')
      .select('codigo, descricao, estoque_atual, estoque_minimo')
      .eq('situacao', 'COMPRAR')
      .order('estoque_atual', { ascending: true })
      .limit(1)
      .maybeSingle(),

    supabase
      .from('envios_oficina')
      .select('*, oficina:oficinas(nome)')
      .eq('status', 'enviado')
      .gte('retorno_previsto', hoje)
      .order('retorno_previsto', { ascending: true })
      .limit(1)
      .maybeSingle(),
  ])

  return {
    tecidoCritico: reposicao.data ?? null,
    proximaColeta: proximaColeta.data ?? null,
  }
}

export async function getFilaCorte(filtros?: { situacao?: string }) {
  const supabase = await createServerSupabaseClient()
  let query = supabase
    .from('pedidos')
    .select(`
      id, numero, cliente, entrega_programado, status,
      corte_cortador, corte_codigo_ribana, corte_consumo_ribana,
      corte_codigo_gola, corte_consumo_gola, corte_situacao,
      corte_inicio_previsto, corte_inicio_real,
      corte_fim_previsto, corte_fim_real, corte_consumo_tecido,
      corte_observacoes,
      itens_pedido(tamanho, qtde, modelo, tecido_cor)
    `)
    .in('status', ['aguardando_corte', 'corte'])
    .order('entrega_programado', { ascending: true })

  if (filtros?.situacao) {
    query = query.eq('corte_situacao', filtros.situacao)
  }

  const { data, error } = await query
  if (error) {
    console.error('Erro ao buscar fila de corte:', error)
    return []
  }
  return data ?? []
}
