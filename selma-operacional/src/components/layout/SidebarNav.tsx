'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import {
  Activity,
  ArrowRight,
  BarChart3,
  Bot,
  CalendarDays,
  ClipboardList,
  DollarSign,
  FileText,
  History,
  Inbox,
  Kanban,
  LayoutDashboard,
  ListTodo,
  Megaphone,
  MessageSquareText,
  Package,
  PlugZap,
  Radar,
  Route,
  Scissors,
  Settings,
  ShieldCheck,
  ShoppingCart,
  UserCog,
  Users,
  Webhook,
  Workflow,
} from 'lucide-react'
import { cn } from '@/lib/utils'
import { useAuthorization } from '@/components/providers/AuthorizationProvider'
import type { PermissionCode } from '@/lib/auth/rbac'

type Section = 'atendimento' | 'crm' | 'ia' | 'canais' | 'analise' | 'sales'

interface MenuItem {
  href: string
  label: string
  icon: typeof LayoutDashboard
  permission: PermissionCode
  section?: Section
  zone?: 'deskcomm'
}

const MENU_ITEMS: MenuItem[] = [
  { href: '/dashboard', label: 'Dashboard', icon: LayoutDashboard, permission: 'dashboard.view' },

  // Zona Comercial: código e rotas do DeskcommCRM, servido em /comercial.
  { href: '/comercial/app/inbox', label: 'Inbox', icon: Inbox, permission: 'crm.view', section: 'atendimento', zone: 'deskcomm' },
  { href: '/comercial/app/radar', label: 'Radar', icon: Radar, permission: 'crm.view', section: 'atendimento', zone: 'deskcomm' },
  { href: '/comercial/app/agenda', label: 'Agenda', icon: CalendarDays, permission: 'crm.view', section: 'atendimento', zone: 'deskcomm' },
  { href: '/comercial/app/templates', label: 'Respostas rápidas', icon: MessageSquareText, permission: 'crm.view', section: 'atendimento', zone: 'deskcomm' },

  { href: '/comercial/app/kanban', label: 'Funis', icon: Kanban, permission: 'crm.view', section: 'crm', zone: 'deskcomm' },
  { href: '/comercial/app/contacts', label: 'Contatos', icon: Users, permission: 'crm.view', section: 'crm', zone: 'deskcomm' },
  { href: '/comercial/app/tasks', label: 'Tarefas', icon: ListTodo, permission: 'crm.view', section: 'crm', zone: 'deskcomm' },
  { href: '/comercial/app/crm', label: 'Ver tudo em CRM', icon: ArrowRight, permission: 'crm.view', section: 'crm', zone: 'deskcomm' },
  { href: '/crm/orcamentos', label: 'Orçamentos', icon: FileText, permission: 'quotes.view', section: 'crm' },

  { href: '/comercial/app/ai/agents', label: 'Agentes', icon: Bot, permission: 'crm.view', section: 'ia', zone: 'deskcomm' },
  { href: '/comercial/app/ai/followups', label: 'Follow-ups', icon: Workflow, permission: 'crm.view', section: 'ia', zone: 'deskcomm' },
  { href: '/comercial/app/ai/routers', label: 'Roteadores', icon: Route, permission: 'crm.view', section: 'ia', zone: 'deskcomm' },
  { href: '/comercial/app/ai', label: 'Ver tudo em IA', icon: ArrowRight, permission: 'crm.view', section: 'ia', zone: 'deskcomm' },

  { href: '/comercial/app/connections', label: 'Conexões', icon: PlugZap, permission: 'settings.view', section: 'canais', zone: 'deskcomm' },
  { href: '/comercial/app/webhooks', label: 'Webhooks', icon: Webhook, permission: 'settings.view', section: 'canais', zone: 'deskcomm' },

  { href: '/comercial/app/metrics', label: 'Desempenho', icon: BarChart3, permission: 'crm.view', section: 'analise', zone: 'deskcomm' },
  { href: '/comercial/app/ads/meta', label: 'Meta Ads', icon: Megaphone, permission: 'crm.view', section: 'analise', zone: 'deskcomm' },
  { href: '/comercial/app/activities', label: 'Atividades', icon: Activity, permission: 'crm.view', section: 'analise', zone: 'deskcomm' },
  { href: '/comercial/app/analise', label: 'Ver tudo em Análise', icon: ArrowRight, permission: 'crm.view', section: 'analise', zone: 'deskcomm' },
  { href: '/comercial/app/settings', label: 'Configurações comerciais', icon: Settings, permission: 'settings.view', zone: 'deskcomm' },

  // Selma operacional: rotas e páginas originais preservadas.
  { href: '/pedidos', label: 'Pedidos', icon: ClipboardList, permission: 'orders.view', section: 'sales' },
  { href: '/producao', label: 'Corte', icon: Scissors, permission: 'production.view' },
  { href: '/sublimacao', label: 'Sublimação', icon: Package, permission: 'production.view' },
  { href: '/dtf', label: 'DTF', icon: Package, permission: 'production.view' },
  { href: '/bordados', label: 'Bordados', icon: Package, permission: 'production.view' },
  { href: '/oficinas', label: 'Oficinas Externas', icon: Users, permission: 'workshops.view' },
  { href: '/acabamento', label: 'Acabamento', icon: Package, permission: 'production.view' },
  { href: '/estoque', label: 'Estoque de Tecidos', icon: Package, permission: 'inventory.view' },
  { href: '/compras', label: 'Compras', icon: ShoppingCart, permission: 'purchases.view' },
  { href: '/financeiro', label: 'Financeiro', icon: DollarSign, permission: 'finance.view' },
  { href: '/cadastros', label: 'Cadastros', icon: Settings, permission: 'settings.view' },
  { href: '/configuracoes/usuarios', label: 'Usuários', icon: UserCog, permission: 'users.view' },
  { href: '/configuracoes/permissoes', label: 'Permissões', icon: ShieldCheck, permission: 'roles.manage' },
  { href: '/configuracoes/auditoria', label: 'Auditoria', icon: History, permission: 'audit.view' },
]

const SECTION_LABELS: Record<Section, string> = {
  atendimento: 'Atendimento',
  crm: 'CRM',
  ia: 'Agente de IA',
  canais: 'Canais',
  analise: 'Análise',
  sales: 'Vendas',
}

export function SidebarNav() {
  const pathname = usePathname()
  const authorization = useAuthorization()
  const visibleItems = MENU_ITEMS.filter(({ permission }) =>
    authorization?.permissions.includes(permission)
  )

  return (
    <nav className="space-y-0.5 px-3 py-3" aria-label="Navegação principal">
      {visibleItems.map(({ href, label, icon: Icon, section, zone }, index) => {
        const previousSection = visibleItems[index - 1]?.section
        const active = pathname === href || pathname.startsWith(`${href}/`)
        const className = cn(
          'relative flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium transition-all duration-150'
        )
        const style = active
          ? { background: 'var(--brand-green-dim)', color: 'var(--brand-green)' }
          : { color: 'var(--fg-muted)' }
        const content = (
          <>
            {active && (
              <span
                className="absolute left-0 top-1/2 h-5 w-0.5 -translate-y-1/2 rounded-r-full"
                style={{ background: '#22C55E' }}
              />
            )}
            <Icon size={17} style={{ color: active ? '#22C55E' : undefined }} />
            {label}
          </>
        )

        return (
          <div key={href}>
            {section && section !== previousSection && (
              <p
                className="px-3 pb-1 pt-4 text-[10px] font-semibold uppercase tracking-widest"
                style={{ color: 'var(--fg-muted)' }}
              >
                {SECTION_LABELS[section]}
              </p>
            )}
            {zone === 'deskcomm' ? (
              <a href={href} className={className} style={style}>
                {content}
              </a>
            ) : (
              <Link href={href} className={className} style={style}>
                {content}
              </Link>
            )}
          </div>
        )
      })}
    </nav>
  )
}
