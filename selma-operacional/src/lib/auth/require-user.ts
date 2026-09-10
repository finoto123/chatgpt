import 'server-only'

import { cache } from 'react'
import { redirect } from 'next/navigation'
import type { User } from '@supabase/supabase-js'
import { z } from 'zod'
import { createServerSupabaseClient } from '@/lib/supabase/server'
import { canAccess, type PermissionCode } from './rbac'
import { LOGIN_PATH } from './session'

const authorizationPayloadSchema = z.object({
  profile: z.object({
    id: z.string().uuid(),
    full_name: z.string(),
    email: z.string().nullable(),
    phone: z.string().nullable(),
    avatar_url: z.string().nullable(),
    active: z.boolean(),
    updated_at: z.string(),
  }),
  roles: z.array(z.object({
    id: z.string().uuid(),
    code: z.string(),
    name: z.string(),
  })),
  permissions: z.array(z.string()),
})

export type AuthorizationProfile = z.infer<typeof authorizationPayloadSchema>['profile']
export type AuthorizationRole = z.infer<typeof authorizationPayloadSchema>['roles'][number]

export interface AuthorizationContext {
  user: User
  profile: AuthorizationProfile
  roles: AuthorizationRole[]
  permissions: string[]
  primaryRole: AuthorizationRole | null
}

interface AuthorizationState {
  user: User | null
  context: AuthorizationContext | null
}

// React cache is scoped to the current server request/render. It avoids repeating
// the authorization RPC without retaining permissions between different users.
const getAuthorizationState = cache(async (): Promise<AuthorizationState> => {
  const supabase = await createServerSupabaseClient()
  const { data: userData, error: userError } = await supabase.auth.getUser()

  if (userError || !userData.user) {
    return { user: null, context: null }
  }

  const { data, error } = await supabase.rpc('get_my_authorization_context')
  if (error) {
    console.error('Falha ao carregar contexto de autorização:', error.message)
    return { user: userData.user, context: null }
  }

  const parsed = authorizationPayloadSchema.safeParse(data)
  if (!parsed.success) {
    return { user: userData.user, context: null }
  }

  return {
    user: userData.user,
    context: {
      user: userData.user,
      ...parsed.data,
      primaryRole: parsed.data.roles[0] ?? null,
    },
  }
})

export async function getCurrentUser(): Promise<User | null> {
  return (await getAuthorizationState()).user
}

export async function getOptionalAuthorizationContext(): Promise<AuthorizationContext | null> {
  return (await getAuthorizationState()).context
}

export async function requireAuthorizationContext(): Promise<AuthorizationContext> {
  const state = await getAuthorizationState()

  if (!state.user) {
    redirect(`${LOGIN_PATH}?reason=session_expired`)
  }

  if (!state.context?.profile.active) {
    redirect('/acesso-desativado')
  }

  return state.context
}

export async function requireUser(): Promise<User> {
  return (await requireAuthorizationContext()).user
}

export async function hasPermission(permission: PermissionCode): Promise<boolean> {
  const context = await getOptionalAuthorizationContext()
  return canAccess(context ? {
    active: context.profile.active,
    permissions: context.permissions,
  } : null, permission)
}

export async function requirePermission(permission: PermissionCode): Promise<AuthorizationContext> {
  const context = await requireAuthorizationContext()

  if (!canAccess({ active: context.profile.active, permissions: context.permissions }, permission)) {
    redirect(`/acesso-negado?permission=${encodeURIComponent(permission)}`)
  }

  return context
}

export async function requireAnyPermission(
  permissions: readonly PermissionCode[]
): Promise<AuthorizationContext> {
  const context = await requireAuthorizationContext()
  const authorized = permissions.some((permission) =>
    canAccess({ active: context.profile.active, permissions: context.permissions }, permission))

  if (!authorized) redirect('/acesso-negado')
  return context
}

export type PermissionCheck =
  | { ok: true; context: AuthorizationContext }
  | { ok: false; status: 401 | 403 }

export async function checkPermission(permission: PermissionCode): Promise<PermissionCheck> {
  const state = await getAuthorizationState()

  if (!state.user) return { ok: false, status: 401 }
  if (!state.context?.profile.active || !canAccess({
    active: state.context.profile.active,
    permissions: state.context.permissions,
  }, permission)) {
    return { ok: false, status: 403 }
  }

  return { ok: true, context: state.context }
}
