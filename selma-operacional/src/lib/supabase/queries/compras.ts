import { createServerSupabaseClient } from '@/lib/supabase/server'
import { EstoqueAtual } from '@/types'

export async function getTecidosParaComprar(): Promise<EstoqueAtual[]> {
  const supabase = await createServerSupabaseClient()
  const { data, error } = await supabase
    .from('estoque_atual')
    .select('*')
    .in('situacao', ['COMPRAR', 'ATENÇÃO'])
    .order('fornecedor')
    .order('descricao')

  if (error) {
    console.error('Erro ao buscar tecidos para comprar:', error.message)
    return []
  }

  return (data ?? []) as EstoqueAtual[]
}
