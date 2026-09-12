import Link from 'next/link'
import { Header } from '@/components/layout/Header'
import { requireAnyPermission } from '@/lib/auth/require-user'
import { globalCommercialSearch } from '@/lib/supabase/queries/crm'

export default async function SearchPage({ searchParams }: { searchParams: Promise<{ q?: string }> }) {
  await requireAnyPermission(['customers.view', 'orders.view', 'crm.view', 'quotes.view'])
  const { q = '' } = await searchParams
  const results = await globalCommercialSearch(q)
  const groups = [
    { title: 'Clientes', items: results.customers.map((item) => ({ id: item.id, label: item.nome, detail: item.contato || item.email, href: `/clientes/${item.id}` })) },
    { title: 'Pedidos', items: results.orders.map((item) => ({ id: item.id, label: `#${item.numero} · ${item.cliente}`, detail: item.status, href: `/pedidos/${item.id}` })) },
    { title: 'Leads', items: results.leads.map((item) => ({ id: item.id, label: item.name, detail: item.company_name || item.status, href: `/crm/leads?search=${encodeURIComponent(item.name)}` })) },
    { title: 'Oportunidades', items: results.opportunities.map((item) => ({ id: item.id, label: item.title, detail: item.status, href: `/crm/oportunidades/${item.id}` })) },
    { title: 'Orçamentos', items: results.quotes.map((item) => ({ id: item.id, label: item.quote_number, detail: `${(item.customer as unknown as { nome?: string } | null)?.nome ?? ''} · ${item.status}`, href: `/crm/orcamentos/${item.id}` })) },
  ]
  return <div><Header title="Busca global" /><main className="space-y-5 p-6"><h2 className="text-sm text-muted">Resultados para “{q}”</h2>{groups.map((group) => <section key={group.title} className="rounded-xl border" style={{ background: 'var(--card-bg)', borderColor: 'var(--border-color)' }}><h3 className="border-b p-4 font-semibold" style={{ borderColor: 'var(--border-color)' }}>{group.title}</h3>{group.items.map((item) => <Link href={item.href} key={item.id} className="hover-item block border-t px-4 py-3 first:border-0"><strong className="text-sm">{item.label}</strong><span className="ml-2 text-xs text-muted">{item.detail}</span></Link>)}{!group.items.length && <p className="p-4 text-sm text-muted">Nenhum resultado.</p>}</section>)}</main></div>
}
