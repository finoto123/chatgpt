import Link from 'next/link'
import { notFound } from 'next/navigation'
import { ArrowLeft, Calendar, CircleDollarSign, UserRound } from 'lucide-react'
import { Header } from '@/components/layout/Header'
import { OpportunityWorkspace } from '@/components/crm/OpportunityWorkspace'
import { requirePermission } from '@/lib/auth/require-user'
import { daysInStage } from '@/lib/domain/crm'
import { dataQualityWarnings, opportunityHealth } from '@/lib/domain/commercial-intelligence'
import { getCrmLookups, getOpportunityById } from '@/lib/supabase/queries/crm'
import { getCommercialSettings } from '@/lib/supabase/queries/commercial'
import { getOpportunityQuotes } from '@/lib/supabase/queries/quotes'
import { QuoteQuickActions } from '@/components/quotes/QuoteQuickActions'
import { formatBRL, formatDate } from '@/lib/utils'
import { getPreliminarySafeDate } from '@/lib/supabase/queries/operations'

export default async function OpportunityPage({ params, searchParams }: { params: Promise<{ id: string }>; searchParams: Promise<{ activityPage?: string }> }) {
  const context = await requirePermission('crm.view')
  const { id } = await params
  const query = await searchParams
  const [data, lookups, settings, quotes] = await Promise.all([getOpportunityById(id, Number(query.activityPage) || 1), getCrmLookups(), getCommercialSettings(), getOpportunityQuotes(id)])
  if (!data) notFound()
  const opportunity = data.opportunity
  const preliminary=await getPreliminarySafeDate(Number(opportunity.estimated_quantity||1),'',opportunity.desired_delivery_date)
  const manager = context.roles.some((role) => ['administrator', 'manager'].includes(role.code))
  const now=new Date();const inactivityDays=Math.max(0,Math.floor((now.getTime()-new Date(opportunity.last_activity_at??opportunity.created_at).getTime())/86400000));const pendingTasks=data.tasks.filter(task=>task.status==='pending');const health=opportunityHealth({status:opportunity.status,hasOverdueTask:pendingTasks.some(task=>new Date(task.due_at)<now),inactivityDays,staleDays:settings.stale_opportunity_days,hasFutureTask:pendingTasks.some(task=>new Date(task.due_at)>=now),expectedCloseDate:opportunity.expected_close_date,today:now.toISOString().slice(0,10)});const warnings=dataQualityWarnings({phone:opportunity.contact?.phone??opportunity.customer?.contato,assignedUserId:opportunity.assigned_user_id,value:Number(opportunity.estimated_value),quantity:Number(opportunity.estimated_quantity),expectedCloseDate:opportunity.expected_close_date,hasFutureTask:pendingTasks.some(task=>new Date(task.due_at)>=now)})
  const summary = [
    ['Valor estimado', formatBRL(Number(opportunity.estimated_value))], ['Quantidade', `${opportunity.estimated_quantity} peças`],
    ['Entrega desejada', formatDate(opportunity.desired_delivery_date)], ['Previsão de fechamento', formatDate(opportunity.expected_close_date)],
    ['Origem', opportunity.source?.name ?? 'Não informada'], ['Responsável', opportunity.assigned?.full_name ?? 'Não informado'],
    ['Último contato', formatDate(opportunity.last_activity_at)], ['Próxima ação', formatDate(opportunity.next_activity_at)],
    ['Dias na etapa', `${daysInStage(opportunity.stage_entered_at)} dias`], ['Temperatura', opportunity.temperature],
  ]
  return <div><Header title={opportunity.title}/><main className="p-6 space-y-5">
    <Link className="inline-flex gap-1 text-sm text-muted" href="/crm"><ArrowLeft size={15}/>Voltar ao CRM</Link>
    <nav className="flex gap-1 border-b text-sm"><a href="#resumo" className="px-3 py-2 border-b-2 border-green-600">Resumo</a><a href="#atividades" className="px-3 py-2">Atividades</a><a href="#tarefas" className="px-3 py-2">Tarefas</a><Link href={`/clientes/${opportunity.customer_id}`} className="px-3 py-2">Cliente</Link></nav>
    <div id="resumo" className="rounded-xl border p-5" style={{background:'var(--card-bg)',borderColor:'var(--border-color)'}}>
      <div className="flex justify-between gap-4"><div><h1 className="text-xl font-bold">{opportunity.title}</h1><Link className="text-sm text-green-600" href={`/clientes/${opportunity.customer_id}`}>{opportunity.customer?.nome}</Link></div><span className="rounded-full px-3 py-1 h-fit text-sm bg-surface-hover">{opportunity.status}</span></div>
      <div className="flex flex-wrap gap-2 mt-3"><span className={`rounded-full px-2 py-1 text-xs ${health==='healthy'?'bg-green-500/10 text-green-600':health==='attention'?'bg-amber-500/10 text-amber-600':'bg-red-500/10 text-red-600'}`}>Saúde: {health==='healthy'?'saudável':health==='attention'?'atenção':'crítica'}</span>{opportunity.expected_close_date&&opportunity.expected_close_date<now.toISOString().slice(0,10)&&opportunity.status==='open'&&<span className="rounded-full px-2 py-1 text-xs bg-red-500/10 text-red-600">Fechamento vencido</span>}{warnings.map(w=><span key={w} className="rounded-full px-2 py-1 text-xs bg-amber-500/10 text-amber-600">{w}</span>)}</div>
      <div className="grid sm:grid-cols-2 xl:grid-cols-5 gap-4 mt-5">{summary.map(([label,value])=><div key={label}><p className="text-xs text-muted">{label}</p><p className="text-sm font-medium mt-1">{value}</p></div>)}</div>
      <div className="flex gap-5 mt-5 text-sm"><span className="flex gap-2"><CircleDollarSign size={16}/>{formatBRL(Number(opportunity.estimated_value))}</span><span className="flex gap-2"><UserRound size={16}/>{opportunity.assigned?.full_name}</span><span className="flex gap-2"><Calendar size={16}/>{formatDate(opportunity.expected_close_date)}</span></div>
      {opportunity.notes&&<p className="text-sm text-muted mt-4 whitespace-pre-wrap">{opportunity.notes}</p>}
    </div>
    {preliminary&&<div className="rounded-xl border p-4" style={{background:'var(--card-bg)',borderColor:'var(--border-color)'}}><div className="flex flex-col justify-between gap-3 sm:flex-row sm:items-center"><div><p className="text-xs font-semibold uppercase tracking-wide text-muted">Viabilidade operacional preliminar</p><p className="mt-1 text-sm">Primeira data segura estimada: <strong>{formatDate(preliminary.earliest_safe_date)}</strong></p></div><span className={`w-fit rounded-full px-2.5 py-1 text-xs font-medium ${preliminary.risk_level==='safe'?'bg-green-500/10 text-green-600':preliminary.risk_level==='attention'?'bg-amber-500/10 text-amber-600':'bg-red-500/10 text-red-600'}`}>{preliminary.risk_level==='safe'?'Prazo seguro':preliminary.risk_level==='attention'?'Prazo exige atenção':'Alto risco de prazo'}</span></div><p className="mt-2 text-xs text-muted">Estimativa anterior à ficha técnica, materiais reservados e filas reais do pedido.</p></div>}
    <section className="crm-card overflow-hidden"><div className="flex items-center justify-between gap-3 border-b p-4" style={{borderColor:'var(--border-subtle)'}}><div><h2 className="font-semibold">Orçamentos</h2><p className="text-xs text-muted">Propostas vinculadas a esta oportunidade.</p></div>{opportunity.status==='open'&&context.permissions.includes('quotes.create')&&<Link href={`/crm/orcamentos/novo?opportunity=${opportunity.id}`} className="crm-focus rounded-lg bg-green-600 px-3 py-2 text-sm font-medium text-white">Criar orçamento</Link>}</div><div className="divide-y" style={{borderColor:'var(--border-subtle)'}}>{quotes.map(q=><div key={q.id} className="grid gap-2 p-4 text-sm hover:bg-surface-hover sm:grid-cols-[1fr_auto_auto_auto_auto] sm:items-center"><strong>{q.quote_number}</strong><span>v{Array.isArray(q.current_version)?q.current_version[0]?.version_number:(q.current_version as {version_number?:number}|null)?.version_number}</span><span>{formatBRL(Number(q.total_amount))} · {Number(q.margin_percent).toFixed(2)}%</span><span>{q.status} · {formatDate(q.valid_until)}</span><QuoteQuickActions id={q.id} status={q.status} canCreate={context.permissions.includes('quotes.create')} canUpdate={context.permissions.includes('quotes.update')}/></div>)}{!quotes.length&&<p className="p-4 text-sm text-muted">Nenhum orçamento criado.</p>}</div></section>
    <OpportunityWorkspace {...data} stages={lookups.stages} reasons={lookups.reasons} tags={lookups.tags} manager={manager}/>
    {data.activityCount > 30 && <div className="flex justify-center gap-2 text-sm">{data.activityPage > 1 && <Link className="border rounded-lg px-3 py-2" href={`?activityPage=${data.activityPage-1}#atividades`}>Atividades anteriores</Link>}{data.activityPage*30 < data.activityCount && <Link className="border rounded-lg px-3 py-2" href={`?activityPage=${data.activityPage+1}#atividades`}>Mais atividades</Link>}</div>}
  </main></div>
}
