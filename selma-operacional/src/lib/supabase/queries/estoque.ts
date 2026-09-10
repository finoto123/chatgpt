import { createServerSupabaseClient } from '@/lib/supabase/server'
import { EstoqueAtual } from '@/types'

export async function getEstoqueAtual(search?: string): Promise<EstoqueAtual[]> {
  const supabase = await createServerSupabaseClient()
  let query = supabase.from('estoque_atual').select('*').order('descricao')
  if (search) {
    const termo = search.replace(/[,().]/g, '')
    query = query.or(
      `descricao.ilike.%${termo}%,codigo.ilike.%${termo}%,fornecedor.ilike.%${termo}%`
    )
  }
  const { data, error } = await query
  if (error) {
    console.error('Erro ao buscar estoque:', error)
    return []
  }
  return (data ?? []) as EstoqueAtual[]
}

export async function getKpisEstoque() {
  const supabase = await createServerSupabaseClient()
  const { data, error } = await supabase.from('estoque_atual').select('*')
  if (error) {
    console.error('Erro ao buscar KPIs de estoque:', error)
    return { totalItens: 0, valorTotal: 0, paraComprar: 0, emAtencao: 0 }
  }
  const itens = (data ?? []) as EstoqueAtual[]
  return {
    totalItens: itens.length,
    valorTotal: itens.reduce((s, i) => s + i.estoque_atual * (i.valor_unitario ?? 0), 0),
    paraComprar: itens.filter(i => i.situacao === 'COMPRAR').length,
    emAtencao: itens.filter(i => i.situacao === 'ATENÇÃO').length,
  }
}

export async function getTecidosList() {
  const supabase = await createServerSupabaseClient()
  const { data, error } = await supabase
    .from('tecidos')
    .select('id, codigo, descricao, unidade')
    .order('descricao')
  if (error) {
    console.error('Erro ao buscar tecidos:', error)
    return []
  }
  return data ?? []
}
