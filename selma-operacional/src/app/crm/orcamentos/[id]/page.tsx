import Link from 'next/link'
import { notFound } from 'next/navigation'
import { ArrowLeft, Banknote, CalendarDays, CircleDollarSign, Percent, Receipt, TrendingUp } from 'lucide-react'
import { CommercialNav } from '@/components/crm/CommercialNav'
import { CrmPageHeader, EmptyState, MetricCard, SectionCard } from '@/components/crm/CrmUi'
import { Header } from '@/components/layout/Header'
import { QuoteEditor } from '@/components/quotes/QuoteEditor'
import { QuoteStatusBadge } from '@/components/quotes/QuoteStatusBadge'
import { requirePermission } from '@/lib/auth/require-user'
import { getCommercialSettings } from '@/lib/supabase/queries/commercial'
import { getQuoteById,getQuoteLookups } from '@/lib/supabase/queries/quotes'
import { formatBRL,formatDate } from '@/lib/utils'
import type { QuoteVersion } from '@/types/quotes'
import { getPreliminarySafeDate } from '@/lib/supabase/queries/operations'

export default async function QuotePage({params}:{params:Promise<{id:string}>}){
  const context=await requirePermission('quotes.view');const {id}=await params;const data=await getQuoteById(id);if(!data)notFound()
  const [lookups,settings]=await Promise.all([getQuoteLookups(data.quote.opportunity_id),getCommercialSettings()]);if(!lookups.opportunity)notFound()
  const version=data.quote.current_version;const manager=context.roles.some(role=>['administrator','manager'].includes(role.code))
  const preliminary=await getPreliminarySafeDate(version?totalQuantity(version):Number(lookups.opportunity.estimated_quantity??1),version?.items?.[0]?.customization_type??'',data.quote.desired_delivery_date)
  const receivables=data.receivables as Array<{id:string;description:string;amount:number;due_date:string;status:string;installment_number:number;allocations?:Array<{amount:number;payment?:{status:string}|Array<{status:string}>}>}>
  const received=receivables.reduce((sum,row)=>sum+(row.allocations??[]).reduce((inner,allocation)=>{const payment=Array.isArray(allocation.payment)?allocation.payment[0]:allocation.payment;return inner+(payment?.status==='confirmed'?Number(allocation.amount):0)},0),0)
  const entryExpected=version?expectedEntry(version):0
  return <div><Header title={data.quote.quote_number}/><main className="crm-shell">
    <CommercialNav manager={manager}/>
    <Link className="inline-flex items-center gap-1 text-sm text-muted hover:text-foreground" href="/crm/orcamentos"><ArrowLeft size={15}/>Voltar aos orçamentos</Link>
    <CrmPageHeader title={data.quote.quote_number} description={`${data.quote.customer?.nome??'Cliente'} · ${data.quote.opportunity?.title??'Oportunidade'}`} actions={<QuoteStatusBadge status={data.quote.status}/>}/>
    {version&&<div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3 2xl:grid-cols-6">
      <MetricCard compact label="Venda" value={formatBRL(Number(version.total_amount))} icon={<CircleDollarSign size={17}/>} tone="success"/>
      <MetricCard compact label="Custo estimado" value={formatBRL(Number(version.estimated_cost))} icon={<Receipt size={17}/>}/>
      <MetricCard compact label="Lucro estimado" value={formatBRL(Number(version.estimated_profit))} icon={<Banknote size={17}/>} tone={Number(version.estimated_profit)>=0?'success':'danger'}/>
      <MetricCard compact label="Margem" value={`${Number(version.margin_percent).toFixed(2)}%`} icon={<Percent size={17}/>} tone={Number(version.margin_percent)<settings.minimum_margin_percent?'warning':'success'}/>
      <MetricCard compact label="Markup" value={version.markup==null?'—':`${Number(version.markup).toFixed(2)}x`} icon={<TrendingUp size={17}/>}/>
      <MetricCard compact label="Validade" value={validityLabel(version.valid_until)} icon={<CalendarDays size={17}/>} tone={version.valid_until<today()?'danger':'neutral'}/>
    </div>}
    {version?.sent_at&&<SectionCard title="Acompanhamento da proposta"><div className="grid gap-4 p-4 sm:grid-cols-2 lg:grid-cols-4"><Datum label="Enviado" value={formatDate(version.sent_at)}/><Datum label="Primeira visualização" value={formatDate(version.first_viewed_at)}/><Datum label="Última visualização" value={formatDate(version.last_viewed_at)}/><Datum label="Visualizações" value={String(version.view_count)}/></div></SectionCard>}
    {version&&['approved','converted'].includes(data.quote.status)&&<SectionCard title="Condição financeira" description={data.quote.status==='approved'?'Os recebíveis serão criados somente na conversão em pedido.':'Parcelas reais vinculadas ao pedido.'}><div className="grid gap-4 p-4 sm:grid-cols-3"><Datum label="Entrada prevista" value={formatBRL(entryExpected)}/><Datum label="Recebido" value={formatBRL(received)}/><Datum label="Restante" value={formatBRL(Math.max(0,Number(version.total_amount)-received))}/></div>{receivables.length>0&&<div className="overflow-x-auto border-t" style={{borderColor:'var(--border-subtle)'}}><table className="crm-table"><thead><tr><th>Parcela</th><th>Descrição</th><th>Vencimento</th><th>Valor</th><th>Status</th></tr></thead><tbody>{receivables.map(row=><tr key={row.id}><td>{row.installment_number}</td><td>{row.description}</td><td>{formatDate(row.due_date)}</td><td>{formatBRL(Number(row.amount))}</td><td>{row.status}</td></tr>)}</tbody></table></div>}</SectionCard>}
    <QuoteEditor quote={data.quote} opportunity={lookups.opportunity as never} terms={lookups.terms} fabrics={lookups.fabrics} defaultValidUntil={data.quote.valid_until} minimumMarginPercent={settings.minimum_margin_percent} requireMarginApproval={settings.require_margin_approval} approvals={data.approvals} canApprove={context.permissions.includes('quotes.approve')} preliminarySafeDate={preliminary}/>
    <div className="grid gap-5 xl:grid-cols-2">
      <SectionCard title="Versões" description="Cada proposta enviada permanece preservada.">{data.versions.length?<div className="divide-y" style={{borderColor:'var(--border-subtle)'}}>{data.versions.map((item,index)=><VersionRow key={item.id} version={item} previous={data.versions[index+1]}/>)}</div>:<EmptyState title="Sem versões" description="Salve o primeiro rascunho para criar a versão inicial."/>}</SectionCard>
      <SectionCard title="Histórico comercial" description="Atividades automáticas e manuais do orçamento.">{data.activities.length?<div className="divide-y p-4 pt-1" style={{borderColor:'var(--border-subtle)'}}>{data.activities.map(activity=><div key={activity.id} className="py-3 text-sm"><div className="flex justify-between gap-4"><strong>{activity.title}</strong><span className="shrink-0 text-xs text-muted">{formatDate(activity.occurred_at)}</span></div>{activity.description&&<p className="mt-1 text-muted">{activity.description}</p>}</div>)}</div>:<EmptyState title="Nenhum evento registrado" description="As ações do orçamento aparecerão aqui."/>}</SectionCard>
    </div>
  </main></div>
}

function Datum({label,value}:{label:string;value:string}){return <div><p className="text-xs text-muted">{label}</p><strong className="mt-1 block text-sm">{value||'—'}</strong></div>}
function totalQuantity(version:QuoteVersion){return version.items.reduce((sum,item)=>sum+Number(item.quantity),0)}
function paymentName(version:QuoteVersion){return String(version.payment_terms_snapshot?.name??'')}
function VersionRow({version,previous}:{version:QuoteVersion;previous?:QuoteVersion}){const changes=previous?[Number(version.total_amount)!==Number(previous.total_amount)?`Valor: ${formatBRL(Number(previous.total_amount))} → ${formatBRL(Number(version.total_amount))}`:'',totalQuantity(version)!==totalQuantity(previous)?`Quantidade: ${totalQuantity(previous)} → ${totalQuantity(version)}`:'',Number(version.discount_amount)!==Number(previous.discount_amount)?`Desconto: ${formatBRL(Number(previous.discount_amount))} → ${formatBRL(Number(version.discount_amount))}`:'',version.desired_delivery_date!==previous.desired_delivery_date?`Prazo: ${formatDate(previous.desired_delivery_date)} → ${formatDate(version.desired_delivery_date)}`:'',version.valid_until!==previous.valid_until?`Validade: ${formatDate(previous.valid_until)} → ${formatDate(version.valid_until)}`:'',paymentName(version)!==paymentName(previous)?`Pagamento: ${paymentName(previous)} → ${paymentName(version)}`:''].filter(Boolean):[];return <div className="p-4 text-sm"><div className="flex flex-wrap justify-between gap-2"><div><strong>v{version.version_number}</strong><span className="ml-2 text-muted">{version.creator?.full_name??'Usuário'} · {formatDate(version.created_at)}</span></div><span>{formatBRL(Number(version.total_amount))} · {version.status}</span></div>{changes.length>0&&<ul className="mt-2 space-y-1 text-xs text-muted">{changes.map(change=><li key={change}>{change}</li>)}</ul>}</div>}
function expectedEntry(version:QuoteVersion){const rules=version.payment_terms_snapshot?.rules as {installments?:Array<{percent?:number;due_type?:string}>}|undefined;const first=rules?.installments?.[0];return first&&first.due_type==='order_date'?Math.round(Number(version.total_amount)*Number(first.percent??0))/100:0}
function today(){return new Intl.DateTimeFormat('en-CA',{timeZone:'America/Sao_Paulo',year:'numeric',month:'2-digit',day:'2-digit'}).format(new Date())}
function validityLabel(date:string){const diff=Math.round((new Date(`${date}T12:00:00-03:00`).getTime()-new Date(`${today()}T12:00:00-03:00`).getTime())/86400000);if(diff<0)return'Expirada';if(diff===0)return'Vence hoje';if(diff<=3)return`${diff} dia${diff===1?'':'s'}`;return formatDate(date)}
