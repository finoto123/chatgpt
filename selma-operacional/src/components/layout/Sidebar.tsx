'use client'

import { SidebarNav } from './SidebarNav'
import { LogOut, UserRound } from 'lucide-react'
import { usePathname } from 'next/navigation'
import Link from 'next/link'
import { logout } from '@/app/login/actions'
import { useAuthorization } from '@/components/providers/AuthorizationProvider'

export function Sidebar() {
  const pathname = usePathname()
  const authorization = useAuthorization()

  if (!authorization || pathname === '/login' || pathname === '/acesso-desativado') return null

  const displayName = authorization.profile.fullName || authorization.profile.email || 'Usuário'
  const initial = displayName.charAt(0).toLocaleUpperCase('pt-BR')

  return (
    <aside
      className="w-60 flex-shrink-0 flex flex-col h-full print:hidden transition-colors"
      style={{
        backgroundColor: 'var(--sidebar-bg)',
        borderRight: '1px solid var(--border-color)',
      }}
    >
      <div className="px-5 py-5">
        <div className="flex items-center">
          <div>
            <p className="font-semibold text-sm leading-tight" style={{ color: 'var(--fg)' }}>Selma Bordados</p>
            <p className="text-xs" style={{ color: 'var(--fg-muted)' }}>Gestão Operacional</p>
          </div>
        </div>
      </div>

      <div style={{ height: '1px', background: 'var(--border-color)', margin: '0 16px' }} />

      <div className="sidebar-scroll min-h-0 flex-1 overflow-y-auto overscroll-contain">
        <SidebarNav />
      </div>

      <div className="shrink-0 space-y-2 border-t p-4" style={{ borderColor: 'var(--border-color)' }}>
        <div
          className="flex items-center gap-3 px-3 py-3 rounded-lg"
          style={{ background: 'var(--bg-surface)' }}
        >
          <div
            className="w-7 h-7 rounded-full flex items-center justify-center text-white text-xs font-semibold flex-shrink-0"
            style={{ background: 'linear-gradient(135deg, #16A34A 0%, #22C55E 100%)' }}
          >
            {initial}
          </div>
          <div className="min-w-0">
            <p className="text-xs font-medium leading-tight truncate" style={{ color: 'var(--fg)' }}>{displayName}</p>
            <p className="text-xs truncate" style={{ color: 'var(--fg-muted)' }}>{authorization.primaryRole?.name ?? 'Sem papel'}</p>
          </div>
        </div>
        <Link
          href="/minha-conta"
          className="flex w-full items-center gap-2 rounded-lg px-3 py-2 text-xs font-medium transition hover:bg-black/5 dark:hover:bg-white/5"
          style={{ color: 'var(--fg-muted)' }}
        >
          <UserRound size={15} aria-hidden="true" />
          Minha conta
        </Link>
        <form action={logout}>
          <button
            type="submit"
            className="flex w-full items-center gap-2 rounded-lg px-3 py-2 text-xs font-medium transition hover:bg-black/5 dark:hover:bg-white/5"
            style={{ color: 'var(--fg-muted)' }}
          >
            <LogOut size={15} aria-hidden="true" />
            Sair
          </button>
        </form>
      </div>
    </aside>
  )
}
