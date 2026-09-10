import { requirePermission } from '@/lib/auth/require-user'
import { createServerSupabaseClient } from '@/lib/supabase/server'
import { PermissionsMatrix, type MatrixPermission, type MatrixRole } from './PermissionsMatrix'

export default async function PermissionsPage() {
  await requirePermission('roles.manage')
  const supabase = await createServerSupabaseClient()
  const [rolesResult, permissionsResult, assignmentsResult] = await Promise.all([
    supabase.from('roles').select('id, code, name').order('name'),
    supabase.from('permissions').select('id, code, name, module').order('module').order('code'),
    supabase.from('role_permissions').select('role_id, permission_id'),
  ])

  if (rolesResult.error || permissionsResult.error || assignmentsResult.error) {
    console.error(
      'Falha ao carregar matriz RBAC:',
      rolesResult.error?.message ?? permissionsResult.error?.message ?? assignmentsResult.error?.message
    )
    throw new Error('Não foi possível carregar a matriz de permissões.')
  }

  return (
    <PermissionsMatrix
      roles={(rolesResult.data ?? []) as MatrixRole[]}
      permissions={(permissionsResult.data ?? []) as MatrixPermission[]}
      assignments={(assignmentsResult.data ?? []).map((item) => `${item.role_id}:${item.permission_id}`)}
    />
  )
}
