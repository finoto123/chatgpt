'use client'

import { Search } from 'lucide-react'
import { useRouter } from 'next/navigation'
import { useEffect, useRef, useState } from 'react'
import { NotificationBell } from './NotificationBell'
import { ThemeToggle } from './ThemeToggle'
import { useAuthorization } from '@/components/providers/AuthorizationProvider'

interface HeaderProps {
  title: string
}

export function Header({ title }: HeaderProps) {
  const [search, setSearch] = useState('')
  const searchRef = useRef<HTMLInputElement>(null)
  const router = useRouter()
  const authorization = useAuthorization()
  const canSearch = Boolean(authorization?.permissions.some((permission) => ['orders.view', 'customers.view', 'crm.view', 'quotes.view'].includes(permission)))
  const displayName = authorization?.profile.fullName || authorization?.profile.email || 'Usuário'

  function handleSearch(e: React.KeyboardEvent<HTMLInputElement>) {
    if (e.key !== 'Enter' || !search.trim()) return
    router.push(`/buscar?q=${encodeURIComponent(search.trim())}`)
  }

  useEffect(() => {
    function focusSearch(event: KeyboardEvent) {
      if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === 'k') {
        event.preventDefault()
        searchRef.current?.focus()
      }
    }
    window.addEventListener('keydown', focusSearch)
    return () => window.removeEventListener('keydown', focusSearch)
  }, [])

  return (
    <header
      className="h-14 flex items-center justify-between px-6 flex-shrink-0"
      style={{
        background: 'var(--header-bg)',
        borderBottom: '1px solid var(--border-color)',
        boxShadow: '0 1px 3px rgba(0,0,0,0.1)',
      }}
    >
      <h1 className="text-base font-semibold" style={{ color: 'var(--fg)' }}>{title}</h1>
      <div className="flex items-center gap-3">
        {canSearch && <div className="relative">
          <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2" style={{ color: 'var(--fg-muted)' }} />
          <input
            ref={searchRef}
            type="text"
            placeholder="Buscar tudo... Ctrl K"
            value={search}
            onChange={e => setSearch(e.target.value)}
            onKeyDown={handleSearch}
            className="pl-9 pr-4 py-1.5 text-sm rounded-lg w-56 focus:outline-none transition-all"
            style={{
              background: 'var(--bg-surface-hover)',
              border: '1px solid var(--border-color)',
              color: 'var(--fg)',
            }}
          />
        </div>}
        <NotificationBell />
        <ThemeToggle />
        <div
          className="w-7 h-7 rounded-full flex items-center justify-center text-white text-xs font-semibold"
          style={{ background: 'linear-gradient(135deg, #16A34A 0%, #22C55E 100%)' }}
        >
          {displayName.charAt(0).toLocaleUpperCase('pt-BR')}
        </div>
      </div>
    </header>
  )
}
