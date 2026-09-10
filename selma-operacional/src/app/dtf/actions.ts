'use server'
import { z } from 'zod'
import { revalidatePath } from 'next/cache'
import { createServerSupabaseClient } from '@/lib/supabase/server'
import { getEtapaDepoisDtf } from '@/lib/estampa-flow'
import { requirePermission } from '@/lib/auth/require-user'
import { safeDatabaseError } from '@/lib/security/errors'

const envioSchema = z.object({
  pedido_id:       z.string().uuid('Selecione um pedido'),
  oficina_id:      z.string().uuid('Selecione uma oficina').optional().nullable().or(z.literal('')),
  grade_quantidade: z.record(z.string(), z.coerce.number().min(0)),
  data_envio:      z.string().min(1, 'Data de envio obrigatória'),
  retorno_previsto: z.string().min(1, 'Retorno previsto obrigatório'),
  valor_unitario:  z.coerce.number().optional().default(0),
  observacoes:     z.string().optional(),
  preenchimento_auto: z.boolean().default(true),
}).strict()

export async function registrarEnvioDtf(data: unknown) {
  await requirePermission('production.update')
  const parsed = envioSchema.safeParse(data)
  if (!parsed.success) return { error: parsed.error.flatten() }

  const totalPecas = Object.values(parsed.data.grade_quantidade)
    .reduce((s, v) => s + Number(v), 0)

  const supabase = await createServerSupabaseClient()
  const { error } = await supabase.from('envios_dtf').insert({
    ...parsed.data,
    oficina_id: parsed.data.oficina_id || null,
    total_pecas: totalPecas,
    valor_total: totalPecas * parsed.data.valor_unitario,
    status: 'aguardando',
  })

  if (error) return { error: safeDatabaseError(error, 'Não foi possível registrar o envio DTF.', { action: 'production.dtf.create', entityId: parsed.data.pedido_id }) }
  revalidatePath('/dtf')
  revalidatePath('/dashboard')
  revalidatePath('/pedidos')
  return { success: true }
}

export async function atualizarStatusDtf(envioId: string, status: string) {
  await requirePermission('production.update')
  const parsed = z.object({
    envioId: z.string().uuid(),
    status: z.enum(['aguardando', 'em_producao', 'pronto_para_buscar', 'finalizado']),
  }).strict().safeParse({ envioId, status })
  if (!parsed.success) return { error: 'Dados de status inválidos.' }
  const supabase = await createServerSupabaseClient()
  const update: Record<string, unknown> = { status: parsed.data.status }
  if (parsed.data.status === 'pronto_para_buscar') update.retorno_real = null
  const { error } = await supabase.from('envios_dtf').update(update).eq('id', parsed.data.envioId)
  if (error) return { error: safeDatabaseError(error, 'Não foi possível atualizar o envio DTF.', { action: 'production.dtf.update', entityId: parsed.data.envioId }) }
  revalidatePath('/dtf')
  revalidatePath('/dashboard')
  revalidatePath('/pedidos')
  return { success: true }
}

export async function finalizarDtf(pedidoId: string) {
  await requirePermission('production.update')
  const idParsed = z.string().uuid().safeParse(pedidoId)
  if (!idParsed.success) return { error: 'ID de pedido inválido' }

  const supabase = await createServerSupabaseClient()
  const { data: pedido, error: selectError } = await supabase
    .from('pedidos')
    .select('tipo_estampa, etapas_ativas')
    .eq('id', idParsed.data)
    .single()

  if (selectError) return { error: safeDatabaseError(selectError, 'Não foi possível consultar o pedido.', { action: 'production.dtf.read', entityId: idParsed.data }) }

  const proximoStatus = getEtapaDepoisDtf(pedido?.tipo_estampa, pedido?.etapas_ativas)
  const { error } = await supabase
    .from('pedidos')
    .update({ status: proximoStatus })
    .eq('id', idParsed.data)

  if (error) return { error: safeDatabaseError(error, 'Não foi possível finalizar o DTF.', { action: 'production.dtf.finish', entityId: idParsed.data }) }

  let avisoEnvioAutomatico: string | null = null
  if (proximoStatus === 'costura') {
    const { criarEnvioOficinaAutomatico } = await import('@/lib/supabase/queries/oficinas')
    avisoEnvioAutomatico = await criarEnvioOficinaAutomatico(idParsed.data, supabase)
  }
  revalidatePath('/dtf')
  revalidatePath('/dashboard')
  revalidatePath('/pedidos')
  revalidatePath('/costura')
  return { success: true, proximoStatus, avisoEnvioAutomatico }
}
