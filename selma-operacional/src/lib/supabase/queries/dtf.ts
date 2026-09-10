import { createServerSupabaseClient } from '@/lib/supabase/server'
import { todayBusinessDate } from '@/lib/business-date'

export async function getEnviosDtf() {
  const supabase = await createServerSupabaseClient()
  const { data, error } = await supabase
    .from('envios_dtf')
    .select(`
      *,
      pedido:pedidos(numero, cliente, entrega_programado),
      oficina:oficinas(nome)
    `)
    .order('created_at', { ascending: false })

  if (error) return []
  const hoje = todayBusinessDate()
  return (data ?? []).map(e => ({
    ...e,
    statusCalculado:
      !e.retorno_real && e.retorno_previsto && e.retorno_previsto < hoje
        ? 'atrasado'
        : e.status,
  }))
}

export async function getPedidosParaDtf() {
  const supabase = await createServerSupabaseClient()
  const { data, error } = await supabase
    .from('pedidos')
    .select('id, numero, cliente')
    .eq('status', 'dtf')
    .order('numero', { ascending: false })
  if (error) return []
  return data ?? []
}
