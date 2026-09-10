'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { BarChart3, FileText, Kanban, LayoutDashboard, RefreshCcw, Settings, UsersRound } from 'lucide-react'
import { cn } from '@/lib/utils'

const links = [
  ['/crm', 'Central', LayoutDashboard],
  ['/crm/funil', 'Funil', Kanban],
  ['/crm/leads', 'Leads', UsersRound],
  ['/crm/orcamentos', 'Orçamentos', FileText],
  ['/crm/analytics', 'Analytics', BarChart3],
  ['/crm/reativacao', 'Reativação', RefreshCcw],
  ['/configuracoes/comercial', 'Configurações', Settings],
] as const

export function CommercialNav({ manager = false }: { manager?: boolean }) {
  const pathname = usePathname()
  return <div className="overflow-x-auto pb-1">
    <nav aria-label="Navegação do CRM" className="inline-flex min-w-max gap-1 rounded-xl border bg-surface p-1" style={{borderColor:'var(--border-color)'}}>
      {links.filter(([href]) => manager || href !== '/configuracoes/comercial').map(([href, label, Icon]) => {
        const active = href === '/crm' ? pathname === href : pathname.startsWith(href)
        return <Link key={href} href={href} aria-current={active ? 'page' : undefined} className={cn(
          'crm-focus flex h-9 items-center gap-2 rounded-lg px-3 text-sm font-medium whitespace-nowrap transition-colors',
          active ? 'bg-card text-foreground shadow-sm' : 'text-muted hover:bg-surface-hover hover:text-foreground',
        )}><Icon size={15} className={active ? 'text-green-600 dark:text-green-400' : ''}/>{label}</Link>
      })}
    </nav>
  </div>
}
