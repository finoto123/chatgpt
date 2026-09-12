'use server'

import { updateBordadoStatus as updateStatusDb } from '@/lib/supabase/queries/bordados'
import { revalidatePath } from 'next/cache'
import { requirePermission } from '@/lib/auth/require-user'
import { safeDatabaseError } from '@/lib/security/errors'

export async function updateBordadoStatusAction(pedidoId: string, novoStatus: string) {
  await requirePermission('production.update')
  const result = await updateStatusDb(pedidoId, novoStatus)

  if (result.error) {
    return { error: safeDatabaseError(result.error, 'Não foi possível atualizar o bordado.', { action: 'production.embroidery', entityId: pedidoId }) }
  }

  revalidatePath('/bordados')
  revalidatePath('/dashboard')
  revalidatePath('/pedidos')
  return { success: true }
}
