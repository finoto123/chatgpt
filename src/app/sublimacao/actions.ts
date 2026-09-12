'use server'

import { z } from 'zod'
import { revalidatePath } from 'next/cache'
import { createServerSupabaseClient } from '@/lib/supabase/server'
import { getEtapaDepoisEstampa } from '@/lib/estampa-flow'
import { requirePermission } from '@/lib/auth/require-user'
import { safeDatabaseError } from '@/lib/security/errors'
import { todayBusinessDate } from '@/lib/business-date'

const schema = z.object({
  pedidoId: z.string().uuid(),
  sublimacao_status: z.enum(['aguardando_papel', 'para_estampar', 'finalizada']),
  sublimacao_inicio: z.string().optional(),
  sublimacao_fim: z.string().optional(),
  sublimacao_obs: z.string().optional(),
}).strict()

export async function atualizarSublimacao(data: unknown) {
  await requirePermission('production.update')
  const parsed = schema.safeParse(data)
  if (!parsed.success) return { error: parsed.error.flatten() }

  const supabase = await createServerSupabaseClient()
  const { pedidoId, ...rest } = parsed.data
  const campos: Record<string, unknown> = { ...rest }

  if (campos.sublimacao_status === 'finalizada') {
    if (!campos.sublimacao_fim) {
      campos.sublimacao_fim = todayBusinessDate()
    }

    const { data: pedido, error: selectError } = await supabase
      .from('pedidos')
      .select('tipo_estampa, etapas_ativas')
      .eq('id', pedidoId)
      .single()

    if (selectError) return { error: safeDatabaseError(selectError, 'Não foi possível consultar o pedido.', { action: 'production.sublimation.read', entityId: pedidoId }) }
    campos.status = getEtapaDepoisEstampa(pedido?.tipo_estampa, pedido?.etapas_ativas)
  }

  if (campos.sublimacao_status === 'para_estampar' && !campos.sublimacao_inicio) {
    campos.sublimacao_inicio = todayBusinessDate()
  }

  const { error } = await supabase
    .from('pedidos')
    .update(campos)
    .eq('id', pedidoId)

  if (error) return { error: safeDatabaseError(error, 'Não foi possível atualizar a sublimação.', { action: 'production.sublimation', entityId: pedidoId }) }

  let avisoEnvioAutomatico: string | null = null
  if (campos.status === 'costura') {
    const { criarEnvioOficinaAutomatico } = await import('@/lib/supabase/queries/oficinas')
    avisoEnvioAutomatico = await criarEnvioOficinaAutomatico(pedidoId, supabase)
  }

  revalidatePath('/sublimacao')
  revalidatePath('/bordados')
  revalidatePath('/oficinas')
  revalidatePath('/dashboard')
  revalidatePath('/pedidos')
  return { success: true, avisoEnvioAutomatico }
}
