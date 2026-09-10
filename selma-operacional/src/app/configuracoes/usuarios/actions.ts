'use server'

import { revalidatePath } from 'next/cache'
import { z } from 'zod'
import { requirePermission } from '@/lib/auth/require-user'
import { createAdminSupabaseClient } from '@/lib/supabase/admin'
import { createServerSupabaseClient } from '@/lib/supabase/server'
import { createAuditLog } from '@/lib/audit/audit'
import { enforceRateLimit } from '@/lib/security/rate-limit'
import { safeDatabaseError } from '@/lib/security/errors'

export interface UserActionResult {
  success?: string
  error?: string
}

const inviteSchema = z.object({
  email: z.string().trim().email('Informe um e-mail válido.'),
  fullName: z.string().trim().min(2, 'Informe o nome.').max(120, 'Nome muito longo.'),
})

const userIdSchema = z.string().uuid('Usuário inválido.')
const rolesSchema = z.object({
  userId: z.string().uuid('Usuário inválido.'),
  roleIds: z.array(z.string().uuid('Papel inválido.')).max(8),
})

export async function inviteUserAction(
  _previousState: UserActionResult,
  formData: FormData
): Promise<UserActionResult> {
  const context = await requirePermission('users.manage')
  const parsed = inviteSchema.safeParse({
    email: formData.get('email'),
    fullName: formData.get('fullName'),
  })

  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? 'Revise os dados informados.' }
  }

  const rateLimit = await enforceRateLimit({
    scope: 'user-invite',
    identifier: context.user.id,
    limit: 5,
    windowSeconds: 300,
  })
  if (!rateLimit.allowed) {
    return { error: 'Muitos convites em sequência. Aguarde alguns minutos.' }
  }

  const admin = createAdminSupabaseClient()
  const { error } = await admin.auth.admin.inviteUserByEmail(parsed.data.email, {
    data: { full_name: parsed.data.fullName },
  })

  if (error) {
    console.error('Falha ao convidar usuário:', error.message)
    return { error: 'Não foi possível enviar o convite. Verifique se o e-mail já está cadastrado.' }
  }

  try {
    await createAuditLog({
      userId: context.user.id,
      action: 'user.invite',
      entityType: 'user',
      metadata: { email: parsed.data.email, fullName: parsed.data.fullName },
    })
  } catch {
    return { error: 'O convite foi enviado, mas a auditoria falhou. Contate o administrador.' }
  }

  revalidatePath('/configuracoes/usuarios')
  return { success: 'Convite enviado com segurança pelo Supabase Auth.' }
}

export async function setUserActiveAction(userId: string, active: boolean): Promise<UserActionResult> {
  await requirePermission('users.manage')
  const parsedId = userIdSchema.safeParse(userId)
  if (!parsedId.success || typeof active !== 'boolean') return { error: 'Dados inválidos.' }

  const supabase = await createServerSupabaseClient()
  const { error } = await supabase.rpc('set_profile_active', {
    _target_user_id: parsedId.data,
    _active: active,
  })

  if (error) {
    console.error('Falha ao alterar status do usuário:', error.message)
    return { error: safeDatabaseError(error, 'Não foi possível alterar o status do usuário.', { action: 'user.active', entityId: parsedId.data }) }
  }

  revalidatePath('/configuracoes/usuarios')
  return { success: active ? 'Usuário ativado.' : 'Usuário desativado.' }
}

export async function setUserRolesAction(userId: string, roleIds: string[]): Promise<UserActionResult> {
  await requirePermission('users.manage')
  const parsed = rolesSchema.safeParse({ userId, roleIds })
  if (!parsed.success) return { error: 'Papéis inválidos.' }

  const supabase = await createServerSupabaseClient()
  const { error } = await supabase.rpc('set_user_roles', {
    _target_user_id: parsed.data.userId,
    _role_ids: parsed.data.roleIds,
  })

  if (error) {
    console.error('Falha ao alterar papéis do usuário:', error.message)
    return { error: safeDatabaseError(error, 'Não foi possível alterar os papéis do usuário.', { action: 'user.roles', entityId: parsed.data.userId }) }
  }

  revalidatePath('/configuracoes/usuarios')
  return { success: 'Papéis atualizados.' }
}
