'use server'

import { redirect } from 'next/navigation'
import { z } from 'zod'
import { createServerSupabaseClient } from '@/lib/supabase/server'
import { sanitizeNextPath } from '@/lib/auth/session'
import { createAuditLog } from '@/lib/audit/audit'
import { enforceRateLimit } from '@/lib/security/rate-limit'
import { reportServerError } from '@/lib/security/errors'

export interface LoginState {
  error?: string
}

const loginSchema = z.object({
  email: z.string().trim().email('Informe um e-mail válido.'),
  password: z.string().min(1, 'Informe a senha.'),
  next: z.string().optional(),
})

export async function login(_previousState: LoginState, formData: FormData): Promise<LoginState> {
  const parsed = loginSchema.safeParse({
    email: formData.get('email'),
    password: formData.get('password'),
    next: formData.get('next') || undefined,
  })

  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? 'Revise os dados informados.' }
  }

  const rateLimit = await enforceRateLimit({
    scope: 'login',
    identifier: parsed.data.email,
    limit: 8,
    windowSeconds: 60,
  })
  if (!rateLimit.allowed) {
    return { error: 'Muitas tentativas. Aguarde um minuto e tente novamente.' }
  }

  const supabase = await createServerSupabaseClient()
  const { data, error } = await supabase.auth.signInWithPassword({
    email: parsed.data.email,
    password: parsed.data.password,
  })

  if (error) {
    return { error: 'E-mail ou senha inválidos.' }
  }

  try {
    await createAuditLog({
      userId: data.user.id,
      action: 'auth.login',
      entityType: 'user',
      entityId: data.user.id,
      metadata: { method: 'password' },
    })
  } catch (auditError) {
    await supabase.auth.signOut({ scope: 'local' })
    reportServerError(auditError, { action: 'auth.login.audit', userId: data.user.id })
    return { error: 'Não foi possível concluir o login com segurança.' }
  }

  redirect(sanitizeNextPath(parsed.data.next))
}

export async function logout() {
  const supabase = await createServerSupabaseClient()
  const { data } = await supabase.auth.getUser()
  if (data.user) {
    try {
      await createAuditLog({
        userId: data.user.id,
        action: 'auth.logout',
        entityType: 'user',
        entityId: data.user.id,
      })
    } catch (auditError) {
      reportServerError(auditError, { action: 'auth.logout.audit', userId: data.user.id })
      throw new Error('Não foi possível encerrar a sessão com segurança.')
    }
  }
  const { error } = await supabase.auth.signOut({ scope: 'local' })

  if (error) {
    throw new Error('Não foi possível encerrar a sessão.', { cause: error })
  }

  redirect('/login?reason=signed_out')
}
