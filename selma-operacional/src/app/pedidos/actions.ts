'use server'

import { createServerSupabaseClient } from '@/lib/supabase/server'
import { createAdminSupabaseClient } from '@/lib/supabase/admin'
import { revalidatePath } from 'next/cache'
import { etapasAtivasSchema, itemPedidoRascunhoSchema, pedidoSchema } from '@/lib/schemas/pedido'
import { corteSchema } from '@/lib/schemas/corte'
import { z } from 'zod'
import { requireAnyPermission, requirePermission, requireUser } from '@/lib/auth/require-user'
import {
  createLayoutStoragePath,
  extractLayoutStoragePath,
  LAYOUT_BUCKET,
  validateLayoutFile,
} from '@/lib/security/upload'
import { enforceRateLimit } from '@/lib/security/rate-limit'
import { reportServerError, safeActionFailure, safeDatabaseError } from '@/lib/security/errors'
import { todayBusinessDate } from '@/lib/business-date'

type ServerClient = Awaited<ReturnType<typeof createServerSupabaseClient>>

/**
 * Substitui os itens de um pedido SEM risco de perda de dados.
 * Insere os novos itens primeiro e só apaga os antigos depois que o insert
 * deu certo. Se o insert falhar, os itens antigos permanecem intactos.
 * Retorna a mensagem de erro (string) ou null em caso de sucesso.
 */
async function _substituirItensPedido(
  supabase: ServerClient,
  pedidoId: string,
  itens: Array<Record<string, unknown>>,
): Promise<string | null> {
  // 1. Captura os ids dos itens já salvos ANTES de mexer em qualquer coisa.
  const { data: existentes, error: selError } = await supabase
    .from('itens_pedido')
    .select('id')
    .eq('pedido_id', pedidoId)
  if (selError) return safeDatabaseError(selError, 'Não foi possível preparar os itens do pedido.', { action: 'order.items.read', entityId: pedidoId })

  // 2. Insere os novos itens (convivem temporariamente com os antigos).
  if (itens.length > 0) {
    const itensData = itens.map(item => ({
      pedido_id: pedidoId,
      qtde: Number(item.qtde) || 0,
      // tamanho e modelo são NOT NULL no banco. Em rascunhos o usuário pode
      // deixar em branco, então usamos string vazia (que satisfaz NOT NULL)
      // em vez de null — caso contrário o INSERT falha e os itens se perdem.
      tamanho: (item.tamanho as string) || '',
      modelo: (item.modelo as string) || '',
      tecido_cor: (item.tecido_cor as string) || null,
      manga: (item.manga as string) || null,
      gola: (item.gola as string) || null,
      acabamento: (item.acabamento as string) || null,
      observacao: (item.observacao as string) || null,
      valor_unitario: Number(item.valor_unitario) || 0,
    }))
    const { error: insError } = await supabase.from('itens_pedido').insert(itensData)
    // Se falhar, os itens antigos NÃO foram tocados — nada se perde.
    if (insError) return safeDatabaseError(insError, 'Não foi possível salvar os itens do pedido.', { action: 'order.items.create', entityId: pedidoId })
  }

  // 3. Só agora remove os itens antigos, já que os novos estão garantidos.
  if (existentes && existentes.length > 0) {
    const ids = existentes.map(e => e.id)
    const { error: delError } = await supabase.from('itens_pedido').delete().in('id', ids)
    // Falha aqui no pior caso deixa itens duplicados, mas nunca perde dados.
    if (delError) return safeDatabaseError(delError, 'Não foi possível substituir os itens anteriores.', { action: 'order.items.delete', entityId: pedidoId })
  }

  return null
}

export async function gerarProximoNumeroPedido(): Promise<string> {
  await requirePermission('orders.create')
  const supabase = await createServerSupabaseClient()
  const { data, error } = await supabase.rpc('next_order_number')
  if (error || !data) return `${String(Date.now()).slice(-4)}-${todayBusinessDate().slice(2, 4)}`
  return data as string
}

export async function criarPedido(values: unknown) {
  await requireUser()
  const parsed = pedidoSchema.safeParse(values)
  if (!parsed.success) return { error: parsed.error.flatten() }
  await requirePermission(parsed.data.id ? 'orders.update' : 'orders.create')

  if (!parsed.data.itens || parsed.data.itens.length === 0) {
    return { error: { formErrors: ['Pedido deve ter ao menos 1 item'], fieldErrors: {} } }
  }

  const supabase = await createServerSupabaseClient()
  const { itens, id, layout_pdf_url: _layoutPdfUrl, ...pedidoDataRaw } = parsed.data

  const pedidoData = {
    ...pedidoDataRaw,
    cliente_id: pedidoDataRaw.cliente_id || null,
    vendedor_id: pedidoDataRaw.vendedor_id || null,
    costureira_id: pedidoDataRaw.costureira_id || null,
    estampa_oficina_id: pedidoDataRaw.estampa_oficina_id || null,
    corte_programado: pedidoDataRaw.corte_programado || null,
    corte_retorno: pedidoDataRaw.corte_retorno || null,
    estamparia_programado: pedidoDataRaw.estamparia_programado || null,
    estamparia_retorno: pedidoDataRaw.estamparia_retorno || null,
    sublimacao_programado: pedidoDataRaw.sublimacao_programado || null,
    sublimacao_retorno: pedidoDataRaw.sublimacao_retorno || null,
    costura_programado: pedidoDataRaw.costura_programado || null,
    costura_retorno: pedidoDataRaw.costura_retorno || null,
    tipo_estampa: pedidoDataRaw.tipo_estampa || null,
    forma_pagamento: pedidoDataRaw.forma_pagamento || null,
    fornecedor_tecido: pedidoDataRaw.fornecedor_tecido || null,
    observacoes: pedidoDataRaw.observacoes || null,
  }

  let status: string = 'aguardando_corte'
  if (id) {
    const { data: pedidoAtual, error: selectError } = await supabase
      .from('pedidos')
      .select('status')
      .eq('id', id)
      .single()
    if (selectError) return { error: safeDatabaseError(selectError, 'Não foi possível consultar o pedido.', { action: 'order.read', entityId: id }) }
    if (pedidoAtual && pedidoAtual.status !== 'rascunho') {
      status = pedidoAtual.status
    }
  }

  const rpcItems = itens.map(item => ({ ...item, qtde: Number(item.qtde), valor_unitario: Number(item.valor_unitario) }))
  const rpcOrder = { ...pedidoData, status }
  const rpc = id
    ? await supabase.rpc('update_order_with_items', { p_order_id: id, p_order: rpcOrder, p_items: rpcItems })
    : await supabase.rpc('create_order_with_items', { p_order: rpcOrder, p_items: rpcItems, p_client_operation_id: null })
  if (rpc.error || !rpc.data) return { error: safeDatabaseError(rpc.error ?? new Error('RPC não retornou pedido'), 'Não foi possível salvar o pedido atomicamente.', { action: id ? 'order.update' : 'order.create', entityId: id }) }
  const pedidoId = rpc.data as string

  revalidatePath('/pedidos')
  revalidatePath('/dashboard')
  return { success: true, pedidoId }
}

export async function uploadLayoutPedido(formData: FormData) {
  const context = await requireAnyPermission(['orders.create', 'orders.update'])
  const pedidoId = z.string().uuid().safeParse(formData.get('pedidoId'))
  const arquivo = formData.get('arquivo')
  if (!pedidoId.success) return { error: 'Pedido inválido.', errorCode: 'VALIDATION_FAILED' }
  if (!(arquivo instanceof File)) {
    return { error: 'Selecione um arquivo de layout.', errorCode: 'VALIDATION_FAILED' }
  }

  const rateLimit = await enforceRateLimit({
    scope: 'layout-upload',
    identifier: context.user.id,
    limit: 12,
    windowSeconds: 60,
  })
  if (!rateLimit.allowed) {
    return { error: 'Muitos uploads em sequência. Aguarde um minuto.', errorCode: 'RATE_LIMITED' }
  }

  const userSupabase = await createServerSupabaseClient()
  const { data: pedido, error: pedidoError } = await userSupabase
    .from('pedidos')
    .select('id, layout_pdf_url')
    .eq('id', pedidoId.data)
    .single()
  if (pedidoError || !pedido) {
    return { error: 'Pedido não encontrado ou não autorizado.', errorCode: 'NOT_FOUND' }
  }

  const bytes = new Uint8Array(await arquivo.arrayBuffer())
  const validation = validateLayoutFile(arquivo.name, arquivo.type, arquivo.size, bytes)
  if (!validation.ok) {
    return { error: validation.message, errorCode: 'VALIDATION_FAILED' }
  }

  const admin = createAdminSupabaseClient()
  const storagePath = createLayoutStoragePath(pedidoId.data, validation.extension)
  const { error: uploadError } = await admin.storage
    .from(LAYOUT_BUCKET)
    .upload(storagePath, bytes, {
      contentType: validation.mime,
      upsert: false,
    })

  if (uploadError) {
    return safeActionFailure(uploadError, 'LAYOUT_UPLOAD_FAILED', 'Não foi possível enviar o layout.', {
      action: 'file.upload',
      userId: context.user.id,
      entity: 'pedido',
      entityId: pedidoId.data,
    })
  }

  const { error: attachError } = await userSupabase.rpc('attach_order_layout', {
    _order_id: pedidoId.data,
    _storage_path: storagePath,
    _original_name: arquivo.name.replace(/[\\/\u0000-\u001f]/g, '_').slice(0, 180),
    _mime_type: validation.mime,
    _size_bytes: arquivo.size,
  })

  if (attachError) {
    await admin.storage.from(LAYOUT_BUCKET).remove([storagePath])
    return safeActionFailure(attachError, 'LAYOUT_ATTACH_FAILED', 'Não foi possível associar o layout ao pedido.', {
      action: 'file.attach',
      userId: context.user.id,
      entity: 'pedido',
      entityId: pedidoId.data,
    })
  }

  const oldPath = extractLayoutStoragePath(pedido.layout_pdf_url)
  if (oldPath && oldPath !== storagePath) {
    const { error: removeError } = await admin.storage.from(LAYOUT_BUCKET).remove([oldPath])
    if (removeError) {
      reportServerError(removeError, {
        action: 'file.remove_previous',
        userId: context.user.id,
        entity: 'pedido',
        entityId: pedidoId.data,
      })
    }
  }

  revalidatePath('/pedidos/' + pedidoId.data)
  return { success: true, path: storagePath }
}

const STATUS_PEDIDO_ENUM = z.enum([
  'rascunho', 'aguardando_corte', 'corte', 'sublimacao', 'dtf',
  'bordados', 'costura', 'acabamento', 'entregue', 'cancelado',
])

export async function atualizarStatusPedido(id: string, status: string) {
  await requirePermission('orders.update')
  const idParsed = z.string().uuid().safeParse(id)
  if (!idParsed.success) return { error: 'ID de pedido inválido' }
  const statusParsed = STATUS_PEDIDO_ENUM.safeParse(status)
  if (!statusParsed.success) return { error: 'Status inválido' }
  const supabase = await createServerSupabaseClient()
  const { error } = await supabase
    .from('pedidos')
    .update({ status: statusParsed.data })
    .eq('id', idParsed.data)
  if (error) return { error: safeDatabaseError(error, 'Não foi possível atualizar o status do pedido.', { action: 'order.status', entityId: idParsed.data }) }
  revalidatePath('/pedidos')
  revalidatePath(`/pedidos/${id}`)
  revalidatePath('/producao')
  revalidatePath('/dashboard')
  return { success: true }
}

export async function atualizarCorte(id: string, dados: unknown) {
  await requirePermission('production.update')
  const idParsed = z.string().uuid().safeParse(id)
  if (!idParsed.success) return { error: 'ID de pedido inválido' }
  const parsed = corteSchema.safeParse(dados)
  if (!parsed.success) return { error: 'Dados de corte inválidos' }
  const supabase = await createServerSupabaseClient()
  const { error } = await supabase.from('pedidos').update(parsed.data).eq('id', idParsed.data)
  if (error) return { error: safeDatabaseError(error, 'Não foi possível atualizar o corte.', { action: 'production.cut', entityId: idParsed.data }) }
  revalidatePath('/producao')
  revalidatePath('/pedidos')
  return { success: true }
}

const embalagemSchema = z.object({
  pedidoId: z.string().uuid(),
  embalagem_inicio_real:  z.string().optional(),
  embalagem_fim_real:     z.string().optional(),
  embalagem_data_nf:      z.string().optional(),
  embalagem_numero_nf:    z.string().optional(),
  embalagem_defeitos:     z.string().optional(),
  embalagem_situacao:     z.string().optional(),
  embalagem_observacoes:  z.string().optional(),
  atualizarStatus: z.boolean().optional(),
})

export async function salvarEmbalagem(data: unknown) {
  await requirePermission('production.update')
  const parsed = embalagemSchema.safeParse(data)
  if (!parsed.success) return { error: parsed.error.flatten() }
  const { pedidoId, atualizarStatus, ...campos } = parsed.data
  const updateData: Record<string, unknown> = { ...campos }
  if (atualizarStatus && campos.embalagem_fim_real) updateData.status = 'acabamento'
  const supabase = await createServerSupabaseClient()
  const { error } = await supabase.from('pedidos').update(updateData).eq('id', pedidoId)
  if (error) return { error: safeDatabaseError(error, 'Não foi possível salvar a embalagem.', { action: 'production.packaging', entityId: pedidoId }) }
  revalidatePath(`/pedidos/${pedidoId}`)
  revalidatePath('/pedidos')
  revalidatePath('/dashboard')
  return { success: true }
}

export async function marcarComoEntregue(pedidoId: string) {
  await requirePermission('production.update')
  const idParsed = z.string().uuid().safeParse(pedidoId)
  if (!idParsed.success) return { error: 'ID de pedido inválido' }
  const supabase = await createServerSupabaseClient()
  const { error } = await supabase
    .from('pedidos')
    .update({ status: 'entregue' })
    .eq('id', idParsed.data)
  if (error) return { error: safeDatabaseError(error, 'Não foi possível marcar o pedido como entregue.', { action: 'order.deliver', entityId: idParsed.data }) }
  revalidatePath(`/pedidos/${pedidoId}`)
  revalidatePath('/pedidos')
  revalidatePath('/dashboard')
  revalidatePath('/financeiro')
  return { success: true }
}

// ── SALVAR RASCUNHO ──────────────────────────────────────────────
export async function salvarRascunho(values: unknown) {
  await requireUser()
  const schema = z.object({
    id: z.string().uuid().optional(),
    numero: z.string().optional().default(''),
    cliente: z.string().optional().default(''),
    cliente_id: z.string().uuid().optional().or(z.literal('')),
    vendedor_id: z.string().uuid().optional().or(z.literal('')),
    data_pedido: z.string().optional(),
    tipo_estampa: z.string().optional(),
    costureira_id: z.string().uuid().optional().or(z.literal('')),
    estampa_oficina_id: z.string().uuid().optional().or(z.literal('')),
    forma_pagamento: z.string().optional(),
    fornecedor_tecido: z.string().optional(),
    valor_entrada: z.coerce.number().default(0),
    corte_programado: z.string().optional(),
    corte_retorno: z.string().optional(),
    estamparia_programado: z.string().optional(),
    estamparia_retorno: z.string().optional(),
    sublimacao_programado: z.string().optional(),
    sublimacao_retorno: z.string().optional(),
    costura_programado: z.string().optional(),
    costura_retorno: z.string().optional(),
    entrega_programado: z.string().optional(),
    etapas_ativas: etapasAtivasSchema.optional(),
    observacoes: z.string().optional(),
    layout_pdf_url: z.string().optional(),
    itens: z.array(itemPedidoRascunhoSchema).max(500).default([]),
  }).strict()

  const parsed = schema.safeParse(values)
  if (!parsed.success) return { error: parsed.error.flatten() }
  await requirePermission(parsed.data.id ? 'orders.update' : 'orders.create')

  const supabase = await createServerSupabaseClient()
  const { itens, id, etapas_ativas, layout_pdf_url: _layoutPdfUrl, ...pedidoData } = parsed.data

  const dadosParaSalvar = {
    ...pedidoData,
    etapas_ativas: etapas_ativas ?? ['corte', 'costura'],
    cliente_id: pedidoData.cliente_id || null,
    vendedor_id: pedidoData.vendedor_id || null,
    costureira_id: pedidoData.costureira_id || null,
    estampa_oficina_id: pedidoData.estampa_oficina_id || null,
    corte_programado: pedidoData.corte_programado || null,
    corte_retorno: pedidoData.corte_retorno || null,
    estamparia_programado: pedidoData.estamparia_programado || null,
    estamparia_retorno: pedidoData.estamparia_retorno || null,
    sublimacao_programado: pedidoData.sublimacao_programado || null,
    sublimacao_retorno: pedidoData.sublimacao_retorno || null,
    costura_programado: pedidoData.costura_programado || null,
    costura_retorno: pedidoData.costura_retorno || null,
    tipo_estampa: pedidoData.tipo_estampa || null,
    forma_pagamento: pedidoData.forma_pagamento || null,
    fornecedor_tecido: pedidoData.fornecedor_tecido || null,
    observacoes: pedidoData.observacoes || null,
    status: 'rascunho' as const,
    data_pedido: pedidoData.data_pedido || todayBusinessDate(),
    entrega_programado: pedidoData.entrega_programado || '2099-12-31',
  }

  const rpcItems = itens.map(item => ({
    ...item,
    qtde: Number(item.qtde),
    valor_unitario: Number(item.valor_unitario),
  }))
  const rpc = await supabase.rpc('save_order_draft', {
    p_order_id: id ?? null,
    p_order: dadosParaSalvar,
    p_items: rpcItems,
  })
  if (rpc.error || !rpc.data) return { error: safeDatabaseError(rpc.error ?? new Error('RPC não retornou pedido'), 'Não foi possível salvar o rascunho atomicamente.', { action: id ? 'order.draft.update' : 'order.draft.create', entityId: id }) }
  const pedidoId = rpc.data as string

  revalidatePath('/pedidos')
  return { success: true, pedidoId }
}

// ── PUBLICAR RASCUNHO ────────────────────────────────────────────
export async function publicarRascunho(pedidoId: string) {
  await requirePermission('orders.update')
  const supabase = await createServerSupabaseClient()

  const { data: pedido, error: pedidoError } = await supabase
    .from('pedidos')
    .select('entrega_programado')
    .eq('id', pedidoId)
    .single()

  if (pedidoError) return { error: safeDatabaseError(pedidoError, 'Não foi possível consultar o rascunho.', { action: 'order.publish.read', entityId: pedidoId }) }

  if (!pedido.entrega_programado || pedido.entrega_programado === '2099-12-31') {
    return { error: 'Defina uma data de entrega antes de publicar' }
  }

  const { data: itens, error: itensError } = await supabase
    .from('itens_pedido')
    .select('id, valor_unitario')
    .eq('pedido_id', pedidoId)

  if (itensError) return { error: safeDatabaseError(itensError, 'Não foi possível consultar os itens do pedido.', { action: 'order.publish.items', entityId: pedidoId }) }

  if (!itens || itens.length === 0) {
    return { error: 'Adicione ao menos 1 item antes de publicar' }
  }

  const temItemSemValor = itens.some(i => i.valor_unitario == null || i.valor_unitario < 0)
  if (temItemSemValor) {
    return { error: 'Todos os itens devem ter valor unitário zero ou maior' }
  }

  const { error: updateError } = await supabase.from('pedidos')
    .update({ status: 'aguardando_corte' })
    .eq('id', pedidoId)
  if (updateError) return { error: safeDatabaseError(updateError, 'Não foi possível publicar o rascunho.', { action: 'order.publish', entityId: pedidoId }) }

  revalidatePath('/pedidos')
  revalidatePath('/dashboard')
  return { success: true }
}

// ── REGISTRAR PAGAMENTO ──────────────────────────────────────────
export async function registrarPagamento(pedidoId: string, valorAdicional: number, marcarComoPago: boolean) {
  await requirePermission('finance.update')
  const idParsed = z.string().uuid().safeParse(pedidoId)
  if (!idParsed.success) return { error: 'ID de pedido inválido' }
  const valorParsed = z.number().min(0).safeParse(valorAdicional)
  if (!valorParsed.success) return { error: 'Valor inválido' }
  const supabase = await createServerSupabaseClient()
  const { error } = await supabase.rpc('record_payment', {
    p_order_id: idParsed.data,
    p_amount: valorParsed.data,
    p_payment_method: 'other',
    p_payment_date: todayBusinessDate(),
    p_reference: marcarComoPago ? 'quitação manual' : null,
    p_notes: null,
    p_client_operation_id: null,
  })
  if (error) return { error: safeDatabaseError(error, 'Não foi possível registrar o pagamento atomicamente.', { action: 'finance.payment', entityId: idParsed.data }) }
  revalidatePath(`/pedidos/${pedidoId}`)
  revalidatePath('/pedidos')
  revalidatePath('/financeiro')
  revalidatePath('/dashboard')
  return { success: true }
}

// ── RESTAURAR PEDIDO CANCELADO ───────────────────────────────────
export async function restaurarPedido(pedidoId: string) {
  await requirePermission('orders.update')
  const idParsed = z.string().uuid().safeParse(pedidoId)
  if (!idParsed.success) return { error: 'ID de pedido inválido' }
  const supabase = await createServerSupabaseClient()
  const { error } = await supabase.from('pedidos')
    .update({ status: 'aguardando_corte' })
    .eq('id', idParsed.data)
  if (error) return { error: safeDatabaseError(error, 'Não foi possível restaurar o pedido.', { action: 'order.restore', entityId: idParsed.data }) }
  revalidatePath('/pedidos')
  revalidatePath('/producao')
  revalidatePath('/dashboard')
  return { success: true }
}

// ── CANCELAR PEDIDO ──────────────────────────────────────────────
export async function cancelarPedido(pedidoId: string, motivo?: string) {
  await requirePermission('orders.cancel')
  const idParsed = z.string().uuid().safeParse(pedidoId)
  if (!idParsed.success) return { error: 'ID de pedido inválido' }
  const motivoParsed = z.string().max(500).optional().safeParse(motivo)
  if (!motivoParsed.success) return { error: 'Motivo muito longo' }
  const supabase = await createServerSupabaseClient()

  const observacao = motivoParsed.data
    ? `[CANCELADO em ${new Date().toLocaleDateString('pt-BR')}: ${motivoParsed.data}]`
    : `[CANCELADO em ${new Date().toLocaleDateString('pt-BR')}]`

  const { data: pedidoAtual, error: selectError } = await supabase
    .from('pedidos')
    .select('observacoes')
    .eq('id', idParsed.data)
    .single()

  if (selectError) return { error: safeDatabaseError(selectError, 'Não foi possível consultar o pedido.', { action: 'order.cancel.read', entityId: idParsed.data }) }

  const { error } = await supabase.from('pedidos').update({
    status: 'cancelado',
    observacoes: pedidoAtual.observacoes
      ? `${pedidoAtual.observacoes}\n${observacao}`
      : observacao,
  }).eq('id', idParsed.data)

  if (error) return { error: safeDatabaseError(error, 'Não foi possível cancelar o pedido.', { action: 'order.cancel', entityId: idParsed.data }) }
  revalidatePath('/pedidos')
  revalidatePath('/producao')
  revalidatePath('/dashboard')
  return { success: true }
}
