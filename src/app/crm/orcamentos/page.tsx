import Link from 'next/link'
import { CheckCircle2, Clock3, FilePenLine, FileText, Hourglass, Send } from 'lucide-react'
import { CommercialNav } from '@/components/crm/CommercialNav'
import { CrmPageHeader, EmptyState, FilterBar, MetricCard, SectionCard } from '@/components/crm/CrmUi'
import { Header } from '@/components/layout/Header'
import { QuoteStatusBadge } from '@/components/quotes/QuoteStatusBadge'
import { QuoteQuickActions } from '@/components/quotes/QuoteQuickActions'
import { requirePermission } from '@/lib/auth/require-user'
import { getCrmLookups } from '@/lib/supabase/queries/crm'
import { getQuoteDashboardStats, getQuotes, type QuoteFilters } from '@/lib/supabase/queries/quotes'
import { formatBRL, formatDate } from '@/lib/utils'
import type { Quote } from '@/types/quotes'

type Params=Omit<QuoteFilters,'page'>&{page?:string}
const statuses=['draft','ready','sent','viewed','change_requested','approved','rejected','expired','converted'] as const

export default async function QuotesPage({searchParams}:{searchParams:Promise<Params>}){
  const context=await requirePermission('quotes.view')
  const filters=await searchParams
  const [{quotes,count,page},lookups,stats]=await Promise.all([getQuotes({...filters,page:Number(filters.page)||1}),getCrmLookups(),getQuoteDashboardStats()])
  const manager=context.roles.some(role=>['administrator','manager'].includes(role.code))
  const canCreate=context.permissions.includes('quotes.create');const canUpdate=context.permissions.includes('quotes.update')
  return <div><Header title="Orçamentos"/><main className="crm-shell">
    <CommercialNav manager={manager}/>
    <CrmPageHeader title="Orçamentos" description="Propostas, versões e condições comerciais em um único fluxo."/>
    <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3 2xl:grid-cols-6">
      <MetricCard compact label="Em elaboração" value={stats.draft} icon={<FilePenLine size={17}/>}/>
      <MetricCard compact label="Enviados" value={stats.sent} icon={<Send size={17}/>} detail={formatBRL(stats.sentValue)} tone="success"/>
      <MetricCard compact label="Aguardando retorno" value={stats.waiting} icon={<Clock3 size={17}/>} detail={formatBRL(stats.waitingValue)} tone="warning"/>
      <MetricCard compact label="Aprovados" value={stats.approved} icon={<CheckCircle2 size={17}/>} detail={formatBRL(stats.approvedValue)} tone="success"/>
      <MetricCard compact label="Expirados" value={stats.expired} icon={<Hourglass size={17}/>} tone={stats.expired?'danger':'neutral'}/>
      <MetricCard compact label="Taxa de aprovação" value={`${stats.approvalRate}%`} icon={<FileText size={17}/>} detail={`Margem média ${stats.averageMargin}%`}/>
    </div>
    <form>
      <FilterBar actions={<><Link href="/crm/orcamentos" className="crm-focus inline-flex h-10 items-center rounded-lg border px-3 text-sm" style={{borderColor:'var(--border-medium)'}}>Limpar</Link><button className="crm-focus h-10 rounded-lg bg-green-600 px-4 text-sm font-medium text-white">Filtrar</button></>}>
        <input name="search" defaultValue={filters.search} placeholder="Número, cliente ou oportunidade" aria-label="Buscar orçamento" className="crm-control lg:min-w-64"/>
        <select name="status" defaultValue={filters.status??''} aria-label="Status" className="crm-control"><option value="">Todos os status</option>{statuses.map(status=><option key={status} value={status}>{statusLabel(status)}</option>)}</select>
        <select name="assigned" defaultValue={filters.assigned??''} aria-label="Responsável" className="crm-control"><option value="">Todos os responsáveis</option>{lookups.profiles.map(profile=><option key={profile.id} value={profile.id}>{profile.full_name}</option>)}</select>
        <select name="customer" defaultValue={filters.customer??''} aria-label="Cliente" className="crm-control"><option value="">Todos os clientes</option>{lookups.customers.map(customer=><option key={customer.id} value={customer.id}>{customer.nome}</option>)}</select>
        <select name="source" defaultValue={filters.source??''} aria-label="Origem" className="crm-control"><option value="">Todas as origens</option>{lookups.sources.map(source=><option key={source.id} value={source.id}>{source.name}</option>)}</select>
        <select name="pipeline" defaultValue={filters.pipeline??''} aria-label="Pipeline" className="crm-control"><option value="">Todos os pipelines</option>{lookups.pipelines.map(pipeline=><option key={pipeline.id} value={pipeline.id}>{pipeline.name}</option>)}</select>
        <input type="date" name="from" defaultValue={filters.from} aria-label="Criado a partir de" className="crm-control"/>
        <input type="date" name="to" defaultValue={filters.to} aria-label="Criado até" className="crm-control"/>
        <input type="number" min="-100" max="100" step="0.01" name="marginMin" defaultValue={filters.marginMin} placeholder="Margem mínima %" aria-label="Margem mínima" className="crm-control"/>
        <input type="number" min="0" step="0.01" name="valueMin" defaultValue={filters.valueMin} placeholder="Valor mínimo" aria-label="Valor mínimo" className="crm-control"/>
        <input type="number" min="0" step="0.01" name="valueMax" defaultValue={filters.valueMax} placeholder="Valor máximo" aria-label="Valor máximo" className="crm-control"/>
        <select name="validity" defaultValue={filters.validity??''} aria-label="Validade" className="crm-control"><option value="">Qualquer validade</option><option value="today">Vence hoje</option><option value="three_days">Vence em até 3 dias</option><option value="expired">Expirada</option></select>
      </FilterBar>
    </form>
    <SectionCard>
      <div className="hidden overflow-x-auto md:block"><table className="crm-table min-w-[1200px]"><thead><tr><th>Número</th><th>Cliente</th><th>Oportunidade</th><th>Responsável</th><th>Versão</th><th>Valor</th><th>Margem</th><th>Status</th><th>Validade</th><th>Atualizado</th><th>Ações</th></tr></thead><tbody>{quotes.map(quote=><tr key={quote.id}><td><Link className="font-semibold text-green-600 dark:text-green-400" href={`/crm/orcamentos/${quote.id}`}>{quote.quote_number}</Link></td><td>{quote.customer?.nome}</td><td>{quote.opportunity?.title}</td><td>{quote.assigned?.full_name}</td><td>v{currentVersion(quote)}</td><td className="font-medium">{formatBRL(Number(quote.total_amount))}</td><td>{Number(quote.margin_percent).toFixed(2)}%</td><td><QuoteStatusBadge status={quote.status}/></td><td>{validityLabel(quote.valid_until)}</td><td>{formatDate(quote.updated_at)}</td><td><QuoteQuickActions id={quote.id} status={quote.status} canCreate={canCreate} canUpdate={canUpdate}/></td></tr>)}</tbody></table></div>
      <div className="divide-y md:hidden" style={{borderColor:'var(--border-subtle)'}}>{quotes.map(quote=><Link key={quote.id} href={`/crm/orcamentos/${quote.id}`} className="block space-y-2 p-4 hover:bg-surface-hover"><div className="flex items-start justify-between gap-3"><div><strong>{quote.quote_number}</strong><p className="text-sm text-muted">{quote.customer?.nome}</p></div><QuoteStatusBadge status={quote.status}/></div><p className="truncate text-xs text-muted">{quote.opportunity?.title} · {quote.assigned?.full_name}</p><div className="flex justify-between text-sm"><strong>{formatBRL(Number(quote.total_amount))}</strong><span>{Number(quote.margin_percent).toFixed(2)}% · v{currentVersion(quote)}</span></div></Link>)}</div>
      {!quotes.length&&<EmptyState title="Nenhum orçamento encontrado" description="Ajuste os filtros ou crie um orçamento pela oportunidade." icon={<FileText size={20}/>}/>} 
    </SectionCard>
    <div className="flex items-center justify-between text-sm text-muted"><span>{count} orçamento{count===1?'':'s'}</span><div className="flex gap-3">{page>1&&<Link className="text-foreground" href={pageLink(filters,page-1)}>Anterior</Link>}{page*25<count&&<Link className="text-foreground" href={pageLink(filters,page+1)}>Próxima</Link>}</div></div>
  </main></div>
}

function currentVersion(quote:Quote){const version=quote.current_version as unknown as {version_number?:number}|Array<{version_number?:number}>|null;return Array.isArray(version)?version[0]?.version_number??1:version?.version_number??1}
function pageLink(filters:Params,page:number){const values=new URLSearchParams();Object.entries(filters).forEach(([key,value])=>{if(value&&key!=='page')values.set(key,String(value))});values.set('page',String(page));return `?${values.toString()}`}
function validityLabel(date:string){const today=new Intl.DateTimeFormat('en-CA',{timeZone:'America/Sao_Paulo',year:'numeric',month:'2-digit',day:'2-digit'}).format(new Date());const diff=Math.round((new Date(`${date}T12:00:00-03:00`).getTime()-new Date(`${today}T12:00:00-03:00`).getTime())/86400000);if(diff<0)return'Expirada';if(diff===0)return'Vence hoje';if(diff<=3)return`Vence em ${diff} dia${diff===1?'':'s'}`;return formatDate(date)}
function statusLabel(status:string){return({draft:'Rascunho',ready:'Aguardando aprovação',sent:'Enviado',viewed:'Visualizado',change_requested:'Alteração solicitada',approved:'Aprovado',rejected:'Recusado',expired:'Expirado',converted:'Convertido'} as Record<string,string>)[status]??status}
