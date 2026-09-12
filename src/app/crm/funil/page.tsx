import { Filter, Search } from 'lucide-react'
import { Header } from '@/components/layout/Header'
import { CommercialNav } from '@/components/crm/CommercialNav'
import { CrmKanban } from '@/components/crm/CrmKanban'
import { SavedViewButton } from '@/components/crm/SavedViewButton'
import { CrmPageHeader, FilterBar, FilterChip, MetricCard } from '@/components/crm/CrmUi'
import { requirePermission } from '@/lib/auth/require-user'
import { getCrmBoard, getCrmDashboard, getCrmLookups } from '@/lib/supabase/queries/crm'
import { getSavedViews } from '@/lib/supabase/queries/commercial'
import { formatBRL } from '@/lib/utils'

type Filters={assigned?:string;source?:string;temperature?:string;search?:string;status?:string;stage?:string;tag?:string;period?:string;overdue?:string;withoutNext?:string;stale?:string;customer?:string}

export default async function FunnelPage({ searchParams }: { searchParams: Promise<Filters> }) {
  const context = await requirePermission('crm.view')
  const filters = await searchParams
  const manager = context.roles.some(role => ['administrator', 'manager'].includes(role.code))
  const [opportunities, dashboard, lookups, views] = await Promise.all([getCrmBoard(filters), getCrmDashboard(), getCrmLookups(), getSavedViews('crm')])
  const labels:Partial<Record<keyof Filters,string>>={assigned:'Responsável',source:'Origem',temperature:'Temperatura',search:'Busca',stage:'Etapa',tag:'Tag',period:'Período',overdue:'Tarefa atrasada',withoutNext:'Sem próxima ação',stale:'Parada'}
  const displayValue=(key:keyof Filters,value:string)=> key==='assigned'?lookups.profiles.find(x=>x.id===value)?.full_name??value:key==='source'?lookups.sources.find(x=>x.id===value)?.name??value:key==='stage'?lookups.stages.find(x=>x.id===value)?.name??value:key==='tag'?lookups.tags.find(x=>x.id===value)?.name??value:key==='temperature'?({hot:'Quente',warm:'Morna',cold:'Fria'}[value]??value):['overdue','withoutNext','stale'].includes(key)?'Sim':key==='period'?`${value} dias`:value
  const removeHref=(remove:keyof Filters)=>{const params=new URLSearchParams();for(const [key,value] of Object.entries(filters)){if(key!==remove&&value)params.set(key,value)}const text=params.toString();return text?`?${text}`:'/crm/funil'}

  return <div><Header title="Funil Comercial"/><main className="crm-shell">
    <CommercialNav manager={manager}/>
    <CrmPageHeader title="Funil comercial" description="Acompanhe o pipeline e mova cada negócio para a próxima etapa."/>

    <div className="grid gap-2 sm:grid-cols-3 xl:grid-cols-6">
      <MetricCard compact label="Abertas" value={dashboard.open_opportunities}/>
      <MetricCard compact label="Pipeline" value={formatBRL(Number(dashboard.pipeline_value))}/>
      <MetricCard compact label="Ponderado" value={formatBRL(Number(dashboard.weighted_pipeline))}/>
      <MetricCard compact label="Tarefas atrasadas" value={dashboard.overdue_tasks} tone={dashboard.overdue_tasks?'danger':'success'}/>
      <MetricCard compact label="Sem próxima ação" value={dashboard.without_next_action} tone={dashboard.without_next_action?'warning':'success'}/>
      <MetricCard compact label="Ganhas / perdidas" value={`${dashboard.won_month} / ${dashboard.lost_month}`}/>
    </div>

    <form>
      <FilterBar actions={<><SavedViewButton filters={filters}/><button className="crm-focus h-10 rounded-lg bg-green-600 px-4 text-sm font-medium text-white">Aplicar</button></>}>
        <label className="relative min-w-56 flex-1"><span className="sr-only">Buscar oportunidade</span><Search className="pointer-events-none absolute left-3 top-3 text-muted" size={16}/><input name="search" defaultValue={filters.search} placeholder="Buscar oportunidade" className="crm-control pl-9"/></label>
        <select aria-label="Responsável" name="assigned" defaultValue={filters.assigned??''} className="crm-control min-w-44"><option value="">Responsável</option>{lookups.profiles.map(x=><option key={x.id} value={x.id}>{x.full_name}</option>)}</select>
        <select aria-label="Origem" name="source" defaultValue={filters.source??''} className="crm-control min-w-40"><option value="">Origem</option>{lookups.sources.map(x=><option key={x.id} value={x.id}>{x.name}</option>)}</select>
        <select aria-label="Temperatura" name="temperature" defaultValue={filters.temperature??''} className="crm-control min-w-36"><option value="">Temperatura</option><option value="cold">Fria</option><option value="warm">Morna</option><option value="hot">Quente</option></select>
        <select aria-label="Etapa" name="stage" defaultValue={filters.stage??''} className="crm-control min-w-40"><option value="">Etapa</option>{lookups.stages.map(x=><option key={x.id} value={x.id}>{x.name}</option>)}</select>
        <details className="relative"><summary className="crm-focus flex h-10 cursor-pointer list-none items-center gap-2 rounded-lg border px-3 text-sm" style={{borderColor:'var(--border-color)'}}><Filter size={15}/>Filtros</summary><div className="absolute right-0 z-30 mt-2 grid w-72 gap-3 rounded-xl border bg-card p-4 shadow-lg">
          <label className="text-xs text-muted">Tag<select name="tag" defaultValue={filters.tag??''} className="crm-control mt-1"><option value="">Todas</option>{lookups.tags.map(x=><option key={x.id} value={x.id}>{x.name}</option>)}</select></label>
          <label className="text-xs text-muted">Período<select name="period" defaultValue={filters.period??''} className="crm-control mt-1"><option value="">Qualquer período</option><option value="7">7 dias</option><option value="30">30 dias</option><option value="90">90 dias</option></select></label>
          {[['overdue','Tarefa atrasada'],['withoutNext','Sem próxima ação'],['stale','Oportunidade parada']].map(([name,label])=><label key={name} className="flex items-center gap-2 text-sm"><input type="checkbox" name={name} value="1" defaultChecked={filters[name as keyof Filters]==='1'}/>{label}</label>)}
        </div></details>
      </FilterBar>
    </form>

    {(views.length>0||Object.entries(filters).some(([key,value])=>value&&labels[key as keyof Filters]))&&<div className="flex flex-wrap items-center gap-2">
      {views.map(view=><a key={view.id} href={`?${new URLSearchParams(view.filters).toString()}`} className="crm-focus rounded-full border px-3 py-1.5 text-xs hover:bg-surface-hover">{view.name}</a>)}
      {Object.entries(filters).filter(([key,value])=>value&&labels[key as keyof Filters]).map(([key,value])=><FilterChip key={key} label={`${labels[key as keyof Filters]}: ${displayValue(key as keyof Filters,value!)}`} href={removeHref(key as keyof Filters)}/>)}
    </div>}

    <CrmKanban opportunities={opportunities} {...lookups} defaultUserId={context.user.id}/>
  </main></div>
}
