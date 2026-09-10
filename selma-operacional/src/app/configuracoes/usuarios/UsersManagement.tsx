'use client'

import { useActionState, useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { toast } from 'sonner'
import { inviteUserAction, setUserActiveAction, setUserRolesAction, type UserActionResult } from './actions'

export interface ManagedUser {
  id: string
  fullName: string
  email: string | null
  active: boolean
  updatedAt: string
  roleIds: string[]
}

export interface ManagedRole {
  id: string
  code: string
  name: string
}

const initialInviteState: UserActionResult = {}

function InviteForm() {
  const [state, formAction, pending] = useActionState(inviteUserAction, initialInviteState)

  return (
    <form action={formAction} className="grid gap-3 rounded-xl border p-4 md:grid-cols-[1fr_1fr_auto]"
      style={{ background: 'var(--card-bg)', borderColor: 'var(--border-color)' }}>
      <div>
        <label htmlFor="fullName" className="mb-1 block text-xs font-medium text-[var(--fg-muted)]">Nome</label>
        <input id="fullName" name="fullName" required maxLength={120} className="w-full rounded-lg border bg-transparent px-3 py-2 text-sm" />
      </div>
      <div>
        <label htmlFor="email" className="mb-1 block text-xs font-medium text-[var(--fg-muted)]">E-mail</label>
        <input id="email" name="email" type="email" required className="w-full rounded-lg border bg-transparent px-3 py-2 text-sm" />
      </div>
      <button disabled={pending} className="self-end rounded-lg bg-green-600 px-4 py-2 text-sm font-medium text-white disabled:opacity-50">
        {pending ? 'Enviando…' : 'Convidar'}
      </button>
      {(state.error || state.success) && (
        <p className={`text-sm md:col-span-3 ${state.error ? 'text-red-600' : 'text-green-600'}`}>
          {state.error ?? state.success}
        </p>
      )}
    </form>
  )
}

export function UsersManagement({ users, roles, currentUserId, canManage, canManageRoles }: {
  users: ManagedUser[]
  roles: ManagedRole[]
  currentUserId: string
  canManage: boolean
  canManageRoles: boolean
}) {
  const router = useRouter()
  const [isPending, startTransition] = useTransition()
  const [draftRoles, setDraftRoles] = useState<Record<string, string[]>>(
    Object.fromEntries(users.map((user) => [user.id, user.roleIds]))
  )

  function run(task: () => Promise<UserActionResult>) {
    startTransition(async () => {
      const result = await task()
      if (result.error) toast.error(result.error)
      if (result.success) {
        toast.success(result.success)
        router.refresh()
      }
    })
  }

  return (
    <div className="space-y-6 p-6 lg:p-8">
      <div>
        <h1 className="text-2xl font-semibold">Usuários</h1>
        <p className="mt-1 text-sm text-[var(--fg-muted)]">Perfis, status e papéis vinculados ao Supabase Auth.</p>
      </div>

      {canManage && <InviteForm />}

      <div className="overflow-x-auto rounded-xl border" style={{ borderColor: 'var(--border-color)' }}>
        <table className="w-full min-w-[850px] text-left text-sm">
          <thead className="bg-black/[0.03] text-xs uppercase text-[var(--fg-muted)] dark:bg-white/[0.04]">
            <tr>
              <th className="px-4 py-3">Nome / e-mail</th>
              <th className="px-4 py-3">Status</th>
              <th className="px-4 py-3">Papéis</th>
              <th className="px-4 py-3">Atualizado em</th>
            </tr>
          </thead>
          <tbody>
            {users.map((user) => (
              <tr key={user.id} className="border-t align-top" style={{ borderColor: 'var(--border-color)' }}>
                <td className="px-4 py-4">
                  <p className="font-medium">{user.fullName || 'Sem nome'} {user.id === currentUserId && '(você)'}</p>
                  <p className="mt-1 text-xs text-[var(--fg-muted)]">{user.email ?? 'Sem e-mail'}</p>
                </td>
                <td className="px-4 py-4">
                  {canManage ? (
                    <button disabled={isPending} onClick={() => run(() => setUserActiveAction(user.id, !user.active))}
                      className={`rounded-full px-3 py-1 text-xs font-medium ${user.active ? 'bg-green-100 text-green-800' : 'bg-gray-200 text-gray-700'}`}>
                      {user.active ? 'Ativo' : 'Inativo'}
                    </button>
                  ) : <span>{user.active ? 'Ativo' : 'Inativo'}</span>}
                </td>
                <td className="px-4 py-4">
                  <div className="grid grid-cols-2 gap-2">
                    {roles.map((role) => {
                      const selected = (draftRoles[user.id] ?? []).includes(role.id)
                      const disabled = !canManage || (role.code === 'administrator' && !canManageRoles) || isPending
                      return (
                        <label key={role.id} className="flex items-center gap-2 text-xs">
                          <input type="checkbox" checked={selected} disabled={disabled} onChange={(event) => {
                            const next = event.target.checked
                              ? [...(draftRoles[user.id] ?? []), role.id]
                              : (draftRoles[user.id] ?? []).filter((id) => id !== role.id)
                            setDraftRoles((current) => ({ ...current, [user.id]: next }))
                            run(() => setUserRolesAction(user.id, next))
                          }} />
                          {role.name}
                        </label>
                      )
                    })}
                  </div>
                </td>
                <td className="px-4 py-4 text-xs text-[var(--fg-muted)]">
                  {new Intl.DateTimeFormat('pt-BR', { dateStyle: 'short', timeStyle: 'short' }).format(new Date(user.updatedAt))}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}
