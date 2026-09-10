import { requirePermission, hasPermission } from '@/lib/auth/require-user'
import { createServerSupabaseClient } from '@/lib/supabase/server'
import { UsersManagement, type ManagedRole, type ManagedUser } from './UsersManagement'

export default async function UsersPage() {
  const context = await requirePermission('users.view')
  const [canManage, canManageRoles] = await Promise.all([
    hasPermission('users.manage'),
    hasPermission('roles.manage'),
  ])
  const supabase = await createServerSupabaseClient()

  const [profilesResult, rolesResult] = await Promise.all([
    supabase
      .from('profiles')
      .select('id, full_name, email, active, updated_at, user_roles(role_id, roles(id, code, name))')
      .order('full_name'),
    supabase.from('roles').select('id, code, name').order('name'),
  ])

  if (profilesResult.error || rolesResult.error) {
    console.error('Falha ao consultar usuários:', profilesResult.error?.message ?? rolesResult.error?.message)
    throw new Error('Não foi possível carregar os usuários.')
  }

  const users: ManagedUser[] = (profilesResult.data ?? []).map((profile) => {
    const assignments = (profile.user_roles ?? []) as unknown as Array<{
      role_id: string
      roles: { id: string; code: string; name: string } | null
    }>
    return {
      id: profile.id,
      fullName: profile.full_name,
      email: profile.email,
      active: profile.active,
      updatedAt: profile.updated_at,
      roleIds: assignments.map((assignment) => assignment.role_id),
    }
  })

  return (
    <UsersManagement
      users={users}
      roles={(rolesResult.data ?? []) as ManagedRole[]}
      currentUserId={context.user.id}
      canManage={canManage}
      canManageRoles={canManageRoles}
    />
  )
}
