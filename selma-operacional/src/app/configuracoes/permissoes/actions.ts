'use server'

import { revalidatePath } from 'next/cache'
import { z } from 'zod'
import { requirePermission } from '@/lib/auth/require-user'
import { createServerSupabaseClient } from '@/lib/supabase/server'
import { safeDatabaseError } from '@/lib/security/errors'

const updatePermissionSchema = z.object({
  roleId: z.string().uuid(),
  permissionId: z.string().uuid(),
  enabled: z.boolean(),
})

export async function setRolePermissionAction(
  roleId: string,
  permissionId: string,
  enabled: boolean
): Promise<{ success?: boolean; error?: string }> {
  await requirePermission('roles.manage')
  const parsed = updatePermissionSchema.safeParse({ roleId, permissionId, enabled })
  if (!parsed.success) return { error: 'Dados de permissão inválidos.' }

  const supabase = await createServerSupabaseClient()
  const { error } = await supabase.rpc('set_role_permission', {
    _role_id: parsed.data.roleId,
    _permission_id: parsed.data.permissionId,
    _enabled: parsed.data.enabled,
  })

  if (error) {
    console.error('Falha ao alterar matriz de permissões:', error.message)
    return { error: safeDatabaseError(error, 'Não foi possível alterar a permissão.', { action: 'role.permission', entityId: parsed.data.roleId }) }
  }

  revalidatePath('/configuracoes/permissoes')
  return { success: true }
}
