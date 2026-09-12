'use client'

import { createContext, useContext, useMemo, type ReactNode } from 'react'
import type { PermissionCode } from '@/lib/auth/rbac'

export interface ClientAuthorization {
  active: boolean
  permissions: string[]
  profile: {
    fullName: string
    email: string | null
  }
  primaryRole: {
    code: string
    name: string
  } | null
}

const AuthorizationContext = createContext<ClientAuthorization | null>(null)

export function AuthorizationProvider({
  authorization,
  children,
}: {
  authorization: ClientAuthorization | null
  children: ReactNode
}) {
  const value = useMemo(() => authorization, [authorization])
  return (
    <AuthorizationContext.Provider value={value}>
      {children}
    </AuthorizationContext.Provider>
  )
}

export function useAuthorization() {
  return useContext(AuthorizationContext)
}

export function usePermission(permission: PermissionCode) {
  const authorization = useAuthorization()
  return Boolean(authorization?.active && authorization.permissions.includes(permission))
}
