import Link from 'next/link'
import { AlertTriangle, CalendarCheck2, CalendarClock, CheckCircle2, CircleDollarSign, Flame, Goal, MoveRight, Sparkles, Target, TimerOff, TrendingUp } from 'lucide-react'
import { formatBRL, formatDate } from '@/lib/utils'
import type { CommercialCentralData, ForecastData } from '@/types/commercial'
import { CentralTaskActions } from './CentralTaskActions'
import { EmptyState, HealthBadge, MetricCard, SectionCard, TemperatureBadge } from './CrmUi'

export function CommercialCentral({ data, forecast }: { data: CommercialCentralData; forecast: ForecastData }) {
  const target = Number(forecast.company_target || forecast.by_seller[0]?.target || 0)
  const won = Number(forecast.company_won || forecast.by_seller[0]?.won || 0)
  const progress = target > 0 ? Math.min(100, Math.round(won / target * 100)) : 0
  const closingValue = data.closing_soon.reduce((sum, item) => sum + Number(item.estimated_value), 0)

  return <div className="space-y-5">
    <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
      <MetricCard label="Pipeline aberto" value={formatBRL(Number(forecast.pipeline_total))} icon={<CircleDollarSign size={18}/>} detail="Valor das oportunidades abertas"/>
      <MetricCard label="Forecast" value={formatBRL(Number(forecast.forecast_closing))} icon={<TrendingUp size={18}/>} detail="Fechamento previsto no período" tone="success"/>
      <MetricCard label="Fechamentos previstos" value={formatBRL(closingValue)} icon={<CalendarCheck2 size={18}/>} detail={`${data.closing_soon.length} nos próximos 14 dias`} tone="warning"/>
      <MetricCard label="Meta" value={target ? formatBRL(target) : 'Não definida'} icon={<Goal size={18}/>} detail={target ? `${progress}% atingido` : 'Configure uma meta comercial'}/>
    </div>

    <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
      <MetricCard compact label="Tarefas hoje" value={data.attention.today_tasks} icon={<CalendarClock size={16}/>} />
      <MetricCard compact label="Tarefas vencidas" value={data.attention.overdue_tasks} icon={<TimerOff size={16}/>} tone={data.attention.overdue_tasks ? 'danger' : 'success'} />
      <MetricCard compact label="Sem próxima ação" value={data.attention.without_next_action} icon={<AlertTriangle size={16}/>} tone={data.attention.without_next_action ? 'warning' : 'success'} />
      <MetricCard compact label="Oportunidades paradas" value={data.attention.stale} icon={<TimerOff size={16}/>} tone={data.attention.stale ? 'warning' : 'success'} />
    </div>

    <div className="grid gap-5 xl:grid-cols-[minmax(0,1.65fr)_minmax(320px,.75fr)]">
      <SectionCard title="Prioridades do dia" description="Ordenadas por atraso, score, prazo e valor." action={<Link href="/crm/funil" className="crm-focus text-sm font-medium text-green-600 hover:underline">Ver funil</Link>}>
        <div className="divide-y" style={{borderColor:'var(--border-subtle)'}}>
          {data.priorities.map(item => <Link href={`/crm/oportunidades/${item.id}`} key={item.id} className="crm-focus group flex flex-col gap-3 p-4 transition-colors hover:bg-surface-hover sm:flex-row sm:items-center sm:px-5">
            <span className="grid size-10 shrink-0 place-items-center rounded-xl bg-amber-500/10 text-amber-600 dark:text-amber-400"><AlertTriangle size={18}/></span>
            <div className="min-w-0 flex-1">
              <p className="truncate font-semibold">{item.customer_name}</p>
              <p className="truncate text-sm text-muted">{item.title} · {formatBRL(Number(item.estimated_value))}</p>
              <div className="mt-2 flex flex-wrap gap-1.5"><TemperatureBadge value={item.temperature} score={item.score}/><HealthBadge kind="warning" label={item.reason || 'Revisar oportunidade'}/></div>
            </div>
            <span className="inline-flex items-center gap-1 text-sm font-medium text-green-600 opacity-80 group-hover:opacity-100">Abrir oportunidade<MoveRight size={15}/></span>
          </Link>)}
          {!data.priorities.length && <EmptyState icon={<CheckCircle2 size={21}/>} title="Tudo em dia" description="Nenhuma oportunidade exige atenção neste momento."/>}
        </div>
      </SectionCard>

      <SectionCard title="Forecast do período" description="Projeção e progresso da meta.">
        <div className="space-y-4 p-5">
          <ForecastRow label="Pipeline" value={formatBRL(Number(forecast.pipeline_total))}/>
          <ForecastRow label="Ponderado" value={formatBRL(Number(forecast.pipeline_weighted))}/>
          <ForecastRow label="Fechamento previsto" value={formatBRL(Number(forecast.forecast_closing))} strong/>
          <div className="border-t pt-4" style={{borderColor:'var(--border-subtle)'}}>
            <div className="flex items-end justify-between gap-3"><div><p className="text-xs text-muted">Meta realizada</p><p className="mt-1 font-semibold">{formatBRL(won)} <span className="font-normal text-muted">/ {target ? formatBRL(target) : '—'}</span></p></div><strong className="text-lg text-green-600 dark:text-green-400">{progress}%</strong></div>
            <div className="mt-3 h-2 overflow-hidden rounded-full bg-surface-hover" role="progressbar" aria-label="Progresso da meta" aria-valuenow={progress} aria-valuemin={0} aria-valuemax={100}><div className="h-full rounded-full bg-green-600 transition-all" style={{width:`${progress}%`}}/></div>
          </div>
          <Link href="/crm/analytics" className="crm-focus inline-flex items-center gap-1 text-sm font-medium text-green-600 hover:underline">Abrir análise completa<MoveRight size={14}/></Link>
        </div>
      </SectionCard>
    </div>

    <div className="grid gap-4 lg:grid-cols-2">
      <CompactList title="Tarefas urgentes" icon={<CalendarClock size={17}/>} items={data.tasks.map(item => ({id:item.id,title:item.title,sub:`${item.customer_name ?? 'Sem cliente'} · ${formatDate(item.due_at)}`,href:item.opportunity_id ? `/crm/oportunidades/${item.opportunity_id}` : '/tarefas',taskId:item.id}))}/>
      <CompactList title="Fechamentos nos próximos 14 dias" icon={<Flame size={17}/>} items={data.closing_soon.map(item => ({id:item.id,title:item.title,sub:`${item.customer_name} · ${formatBRL(Number(item.estimated_value))} · ${formatDate(item.expected_close_date)}`,href:`/crm/oportunidades/${item.id}`}))}/>
    </div>

    <div className="grid gap-3 sm:grid-cols-2">
      <MetricCard compact label="Oportunidades quentes" value={data.attention.hot_opportunities} icon={<Sparkles size={16}/>} tone="danger"/>
      <MetricCard compact label="Aguardando aprovação" value={formatBRL(Number(data.attention.waiting_approval_value))} icon={<Target size={16}/>} tone="warning"/>
    </div>
  </div>
}

function ForecastRow({ label, value, strong = false }: { label: string; value: string; strong?: boolean }) { return <div className="flex items-center justify-between gap-3 text-sm"><span className="text-muted">{label}</span><strong className={strong ? 'text-green-600 dark:text-green-400' : ''}>{value}</strong></div> }

function CompactList({ title, icon, items }: { title: string; icon: React.ReactNode; items: Array<{id:string;title:string;sub:string;href:string;taskId?:string}> }) {
  return <SectionCard title={title} action={<span className="text-muted">{icon}</span>}>
    <div className="divide-y" style={{borderColor:'var(--border-subtle)'}}>{items.map(item => <div key={item.id} className="flex items-center gap-2 px-4 py-3 hover:bg-surface-hover"><Link href={item.href} className="crm-focus min-w-0 flex-1"><p className="truncate text-sm font-medium">{item.title}</p><p className="truncate text-xs text-muted">{item.sub}</p></Link>{item.taskId && <CentralTaskActions taskId={item.taskId}/>}</div>)}{!items.length && <EmptyState title="Nada pendente" description="Nenhum item precisa da sua atenção nesta seção."/>}</div>
  </SectionCard>
}
