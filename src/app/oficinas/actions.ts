'use server'

import { z } from 'zod'
import { createServerSupabaseClient } from '@/lib/supabase/server'
import { revalidatePath } from 'next/cache'
import { requirePermission } from '@/lib/auth/require-user'
import { safeDatabaseError } from '@/lib/security/errors'

const registrarEnvioSchema = z.object({
  pedido_id: z.string().uuid(),
  oficina_id: z.string().uuid(),
  modelo: z.string().optional(),
  grade_quantidade: z.record(z.string(), z.number().int().min(0)),
  total_pecas: z.number().int().min(0),
  data_envio: z.string().min(1, 'Data de envio é obrigatória'),
  retorno_previsto: z.string().min(1, 'Retorno previsto é obrigatório'),
  valor_unitario: z.number().min(0.01, 'Valor unitário é obrigatório — informe o valor por peça (R$)'),
  observacoes: z.string().optional(),
}).strict()

export async function registrarEnvio(data: {
  pedido_id: string
  oficina_id: string
  modelo?: string
  grade_quantidade: Record<string, number>
  total_pecas: number
  data_envio: string
  retorno_previsto: string
  valor_unitario: number
  valor_total: number
  observacoes?: string
}): Promise<{ success?: boolean; error?: string }> {
  await requirePermission('workshops.update')
  // Extraímos valor_total do input mas recalculamos server-side para garantir consistência
  const { valor_total: _ignorado, ...restoDados } = data
  const parsed = registrarEnvioSchema.safeParse(restoDados)
  if (!parsed.success) {
    const mensagem = parsed.error.issues[0]?.message ?? 'Dados inválidos'
    return { error: mensagem }
  }

  // Recalcula valor_total no servidor a partir dos valores validados
  const valorTotalCalculado = parsed.data.total_pecas * parsed.data.valor_unitario

  const supabase = await createServerSupabaseClient()
  const { error } = await supabase.from('envios_oficina').insert({
    ...parsed.data,
    valor_total: valorTotalCalculado,
    status: 'enviado',
  })
  if (error) return { error: safeDatabaseError(error, 'Não foi possível registrar o envio.', { action: 'workshop.shipment.create', entityId: parsed.data.pedido_id }) }
  revalidatePath('/oficinas')
  return { success: true }
}

const confirmarRetornoSchema = z.object({
  retorno_real: z.string().optional().nullable().or(z.literal('')),
  qt_retornada_1a_entrega: z.number().int().min(0).optional(),
  status: z.enum(['enviado', 'costurando', 'retornado', 'pago', 'atraso_retorno', 'pendente_pagamento', 'finalizado']),
  observacoes: z.string().optional(),
}).strict()

export async function confirmarRetorno(
  id: string,
  dados: {
    retorno_real?: string | null
    qt_retornada_1a_entrega?: number
    status: string
    observacoes?: string
  }
): Promise<{ success?: boolean; error?: string }> {
  await requirePermission('workshops.update')
  const idParsed = z.string().uuid().safeParse(id)
  if (!idParsed.success) return { error: 'ID inválido' }

  const parsed = confirmarRetornoSchema.safeParse(dados)
  if (!parsed.success) {
    const mensagem = parsed.error.issues[0]?.message ?? 'Dados inválidos'
    return { error: mensagem }
  }

  const supabase = await createServerSupabaseClient()
  
  // Buscar o pedido_id antes de atualizar o status do envio
  const { data: envio, error: fetchError } = await supabase
    .from('envios_oficina')
    .select('pedido_id')
    .eq('id', idParsed.data)
    .single()

  if (fetchError) return { error: safeDatabaseError(fetchError, 'Não foi possível consultar o envio.', { action: 'workshop.shipment.read', entityId: idParsed.data }) }

  const updateData = {
    ...parsed.data,
    retorno_real: parsed.data.retorno_real || null,
  }

  const { error } = await supabase
    .from('envios_oficina')
    .update(updateData)
    .eq('id', idParsed.data)

  if (error) return { error: safeDatabaseError(error, 'Não foi possível atualizar o retorno.', { action: 'workshop.shipment.update', entityId: idParsed.data }) }

  // Se o envio foi finalizado, avança o status do pedido para 'acabamento'
  if (parsed.data.status === 'finalizado') {
    const { error: orderError } = await supabase
      .from('pedidos')
      .update({ status: 'acabamento' })
      .eq('id', envio.pedido_id)
    if (orderError) return { error: safeDatabaseError(orderError, 'Não foi possível avançar o pedido.', { action: 'production.stage_change', entityId: envio.pedido_id }) }
  } else if (['enviado', 'costurando', 'retornado', 'atraso_retorno'].includes(parsed.data.status)) {
    // Se voltou para uma etapa ativa de costura, garante que o status do pedido seja 'costura'
    const { error: orderError } = await supabase
      .from('pedidos')
      .update({ status: 'costura' })
      .eq('id', envio.pedido_id)
    if (orderError) return { error: safeDatabaseError(orderError, 'Não foi possível atualizar o pedido.', { action: 'production.stage_change', entityId: envio.pedido_id }) }
  }

  revalidatePath('/oficinas')
  revalidatePath('/dashboard')
  revalidatePath('/pedidos')
  return { success: true }
}
