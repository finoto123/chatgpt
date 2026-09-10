import { createServerSupabaseClient } from '@/lib/supabase/server'

export async function getPedidosSublimacao() {
  const supabase = await createServerSupabaseClient()
  const { data, error } = await supabase
    .from('pedidos')
    .select(`
      id, numero, cliente, entrega_programado, status,
      tipo_estampa, sublimacao_status,
      sublimacao_inicio, sublimacao_fim, sublimacao_obs,
      itens_pedido(qtde, tamanho, modelo)
    `)
    .in('status', ['sublimacao', 'dtf', 'estamparia'])
    .order('entrega_programado', { ascending: true })

  if (error) throw error
  return data ?? []
}
