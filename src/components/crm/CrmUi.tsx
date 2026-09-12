import type { ReactNode } from 'react'
import Link from 'next/link'
import { ArrowDownRight, ArrowUpRight, Inbox, X } from 'lucide-react'
import { cn } from '@/lib/utils'

export function CrmPageHeader({
  eyebrow = 'CRM Comercial', title, description, actions,
}: { eyebrow?: string; title: string; description: string; actions?: ReactNode }) {
  return <header className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
    <div className="min-w-0">
      <p className="mb-1 text-xs font-semibold tracking-wide text-green-600 dark:text-green-400">{eyebrow}</p>
      <h1 className="text-2xl font-semibold tracking-tight sm:text-[28px]">{title}</h1>
      <p className="mt-1 max-w-3xl text-sm text-muted">{description}</p>
    </div>
    {actions && <div className="flex shrink-0 flex-wrap items-center gap-2">{actions}</div>}
  </header>
}

export function MetricCard({
  label, value, icon, detail, change, tone = 'neutral', compact = false,
}: { label: string; value: ReactNode; icon?: ReactNode; detail?: string; change?: number | null; tone?: 'neutral'|'success'|'warning'|'danger'; compact?: boolean }) {
  const toneClass = { neutral: 'text-muted', success: 'text-green-600 dark:text-green-400', warning: 'text-amber-600 dark:text-amber-400', danger: 'text-rose-600 dark:text-rose-400' }[tone]
  return <div className={cn('crm-card min-w-0', compact ? 'p-3.5' : 'p-4 sm:p-5')}>
    <div className="flex items-start justify-between gap-3">
      <div className="min-w-0">
        <p className="truncate text-xs font-medium text-muted">{label}</p>
        <p className={cn('mt-1 truncate font-semibold tracking-tight', compact ? 'text-xl' : 'text-2xl sm:text-[28px]')}>{value}</p>
      </div>
      {icon && <span className={cn('grid size-9 shrink-0 place-items-center rounded-lg bg-surface-hover', toneClass)}>{icon}</span>}
    </div>
    {(detail || change != null) && <div className="mt-2 flex items-center gap-2 text-xs">
      {change != null && <span className={cn('inline-flex items-center gap-0.5 font-medium', change >= 0 ? 'text-green-600 dark:text-green-400' : 'text-rose-600 dark:text-rose-400')}>
        {change >= 0 ? <ArrowUpRight size={13}/> : <ArrowDownRight size={13}/>}{Math.abs(change)}%
      </span>}
      {detail && <span className="truncate text-muted">{detail}</span>}
    </div>}
  </div>
}

export function SectionCard({ title, description, action, children, className }: { title?: string; description?: string; action?: ReactNode; children: ReactNode; className?: string }) {
  return <section className={cn('crm-card overflow-hidden', className)}>
    {(title || action) && <header className="flex items-start justify-between gap-4 border-b px-4 py-3.5 sm:px-5" style={{borderColor:'var(--border-subtle)'}}>
      <div><h2 className="text-base font-semibold sm:text-lg">{title}</h2>{description && <p className="mt-0.5 text-xs text-muted">{description}</p>}</div>
      {action}
    </header>}
    {children}
  </section>
}

export function EmptyState({ title, description, action, icon }: { title: string; description: string; action?: ReactNode; icon?: ReactNode }) {
  return <div className="flex min-h-44 flex-col items-center justify-center px-5 py-10 text-center">
    <span className="mb-3 grid size-11 place-items-center rounded-xl bg-surface-hover text-muted">{icon ?? <Inbox size={20}/>}</span>
    <p className="font-medium">{title}</p><p className="mt-1 max-w-md text-sm text-muted">{description}</p>
    {action && <div className="mt-4">{action}</div>}
  </div>
}

export function FilterBar({ children, actions }: { children: ReactNode; actions?: ReactNode }) {
  return <div className="crm-card flex flex-col gap-3 p-3 xl:flex-row xl:items-center">
    <div className="grid min-w-0 flex-1 gap-2 sm:grid-cols-2 lg:flex lg:flex-wrap">{children}</div>
    {actions && <div className="flex shrink-0 flex-wrap gap-2">{actions}</div>}
  </div>
}

export function FilterChip({ label, href }: { label: string; href: string }) {
  return <Link href={href} className="crm-focus inline-flex h-7 items-center gap-1 rounded-full border px-2.5 text-xs text-foreground hover:bg-surface-hover" style={{borderColor:'var(--border-medium)'}}>{label}<X size={12}/></Link>
}

export function TemperatureBadge({ value, score }: { value?: string | null; score?: number }) {
  const config = value === 'hot' ? ['Quente','bg-rose-500/10 text-rose-600 dark:text-rose-400'] : value === 'cold' ? ['Fria','bg-sky-500/10 text-sky-600 dark:text-sky-400'] : ['Morna','bg-amber-500/10 text-amber-700 dark:text-amber-400']
  return <span className={cn('inline-flex items-center rounded-full px-2 py-1 text-[11px] font-medium',config[1])}>{config[0]}{score != null ? ` · ${score}` : ''}</span>
}

export function HealthBadge({ kind, label }: { kind: 'danger'|'warning'|'neutral'|'success'; label: string }) {
  const styles={danger:'bg-rose-500/10 text-rose-600 dark:text-rose-400',warning:'bg-amber-500/10 text-amber-700 dark:text-amber-400',neutral:'bg-surface-hover text-muted',success:'bg-green-500/10 text-green-600 dark:text-green-400'}
  return <span className={cn('inline-flex rounded-full px-2 py-1 text-[11px] font-medium',styles[kind])}>{label}</span>
}

export function LeadStatusBadge({ status }: { status: string }) {
  const map:Record<string,[string,string]>={new:['Novo','bg-blue-500/10 text-blue-600 dark:text-blue-400'],working:['Em contato','bg-amber-500/10 text-amber-700 dark:text-amber-400'],qualified:['Qualificado','bg-violet-500/10 text-violet-600 dark:text-violet-400'],converted:['Convertido','bg-green-500/10 text-green-600 dark:text-green-400'],disqualified:['Desqualificado','bg-surface-hover text-muted']}
  const item=map[status]??[status,'bg-surface-hover text-muted']
  return <span className={cn('inline-flex rounded-full px-2.5 py-1 text-xs font-medium',item[1])}>{item[0]}</span>
}
