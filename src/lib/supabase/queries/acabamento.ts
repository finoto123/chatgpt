import { createServerSupabaseClient } from '@/lib/supabase/server'

export async function getPedidosAcabamento() {
  const supabase = await createServerSupabaseClient()
  const { data, error } = await supabase
    .from('pedidos')
    .select(`
      id, numero, cliente, entrega_programado, status,
      embalagem_status, embalagem_inicio_real, embalagem_fim_real,
      embalagem_numero_nf, embalagem_data_nf, embalagem_defeitos, embalagem_situacao,
      itens_pedido(qtde)
    `)
    .in('status', ['acabamento', 'entregue'])
    .order('entrega_programado', { ascending: true })

  if (error) throw error
  return data ?? []
}
