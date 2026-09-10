'use client'

import { useState, useTransition } from 'react'
import { toast } from 'sonner'
import { setRolePermissionAction } from './actions'

export interface MatrixRole {
  id: string
  code: string
  name: string
}

export interface MatrixPermission {
  id: string
  code: string
  name: string
  module: string
}

export function PermissionsMatrix({ roles, permissions, assignments }: {
  roles: MatrixRole[]
  permissions: MatrixPermission[]
  assignments: string[]
}) {
  const [enabled, setEnabled] = useState(() => new Set(assignments))
  const [pendingKeys, setPendingKeys] = useState(() => new Set<string>())
  const [, startTransition] = useTransition()

  function toggle(role: MatrixRole, permission: MatrixPermission, checked: boolean) {
    const key = `${role.id}:${permission.id}`
    setEnabled((current) => {
      const next = new Set(current)
      if (checked) next.add(key)
      else next.delete(key)
      return next
    })
    setPendingKeys((current) => new Set(current).add(key))

    startTransition(async () => {
      const result = await setRolePermissionAction(role.id, permission.id, checked)
      setPendingKeys((current) => {
        const next = new Set(current)
        next.delete(key)
        return next
      })
      if (result.error) {
        setEnabled((current) => {
          const next = new Set(current)
          if (checked) next.delete(key)
          else next.add(key)
          return next
        })
        toast.error(result.error)
      } else {
        toast.success('Permissão atualizada.')
      }
    })
  }

  return (
    <div className="space-y-6 p-6 lg:p-8">
      <div>
        <h1 className="text-2xl font-semibold">Papéis e permissões</h1>
        <p className="mt-1 text-sm text-[var(--fg-muted)]">
          Matriz persistida no banco. O papel Administrador mantém todas as permissões explícitas.
        </p>
      </div>

      <div className="overflow-auto rounded-xl border" style={{ borderColor: 'var(--border-color)' }}>
        <table className="w-full min-w-[1100px] text-left text-sm">
          <thead className="sticky top-0 z-10 bg-[var(--card-bg)] text-xs uppercase text-[var(--fg-muted)]">
            <tr>
              <th className="sticky left-0 bg-[var(--card-bg)] px-4 py-3">Permissão</th>
              {roles.map((role) => <th key={role.id} className="px-3 py-3 text-center">{role.name}</th>)}
            </tr>
          </thead>
          <tbody>
            {permissions.map((permission) => (
              <tr key={permission.id} className="border-t" style={{ borderColor: 'var(--border-color)' }}>
                <td className="sticky left-0 bg-[var(--card-bg)] px-4 py-3">
                  <p className="font-medium">{permission.name}</p>
                  <p className="mt-0.5 font-mono text-xs text-[var(--fg-muted)]">{permission.code}</p>
                </td>
                {roles.map((role) => {
                  const key = `${role.id}:${permission.id}`
                  return (
                    <td key={role.id} className="px-3 py-3 text-center">
                      <input
                        type="checkbox"
                        aria-label={`${permission.name} para ${role.name}`}
                        checked={enabled.has(key)}
                        disabled={role.code === 'administrator' || pendingKeys.has(key)}
                        onChange={(event) => toggle(role, permission, event.target.checked)}
                        className="h-4 w-4 accent-green-600"
                      />
                    </td>
                  )
                })}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}
