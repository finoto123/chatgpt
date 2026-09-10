import { RefreshCw } from 'lucide-react'
import { Header } from '@/components/layout/Header'
import { CommercialNav } from '@/components/crm/CommercialNav'
import { CommercialAnalytics } from '@/components/crm/CommercialAnalytics'
import { CrmPageHeader, FilterBar } from '@/components/crm/CrmUi'
import { requirePermission } from '@/lib/auth/require-user'
import { getCommercialAnalytics, getSalesForecast } from '@/lib/supabase/queries/commercial'
import { getCrmLookups } from '@/lib/supabase/queries/crm'
import { getQuoteDashboardStats } from '@/lib/supabase/queries/quotes'

export default async function AnalyticsPage({searchParams}:{searchParams:Promise<{start?:string;end?:string;user?:string;source?:string;pipeline?:string}>}){
  const context=await requirePermission('crm.view');const query=await searchParams;const now=new Date();const start=query.start??new Date(now.getFullYear(),now.getMonth(),1).toISOString().slice(0,10);const end=query.end??new Date(now.getFullYear(),now.getMonth()+1,0).toISOString().slice(0,10);const manager=context.roles.some(role=>['administrator','manager'].includes(role.code));const user=manager?query.user:context.user.id
  const [data,forecast,lookups,quotes]=await Promise.all([getCommercialAnalytics({start,end,userId:user,sourceId:query.source,pipelineId:query.pipeline}),getSalesForecast(start,end,user),getCrmLookups(),getQuoteDashboardStats(start,end)])
  return <div><Header title="Analytics Comercial"/><main className="crm-shell"><CommercialNav manager={manager}/><CrmPageHeader title="Analytics comercial" description="Receita, conversão e eficiência do time em uma visão gerencial."/><form><FilterBar actions={<button className="crm-focus flex h-10 items-center gap-2 rounded-lg bg-green-600 px-4 text-sm font-medium text-white"><RefreshCw size={15}/>Atualizar</button>}>
    <label className="text-xs text-muted">Início<input aria-label="Início do período" type="date" name="start" defaultValue={start} className="crm-control mt-1"/></label><label className="text-xs text-muted">Fim<input aria-label="Fim do período" type="date" name="end" defaultValue={end} className="crm-control mt-1"/></label>
    {manager&&<select aria-label="Vendedor" name="user" defaultValue={user??''} className="crm-control min-w-44 self-end"><option value="">Todos os vendedores</option>{lookups.profiles.map(item=><option key={item.id} value={item.id}>{item.full_name}</option>)}</select>}
    <select aria-label="Origem" name="source" defaultValue={query.source??''} className="crm-control min-w-40 self-end"><option value="">Todas as origens</option>{lookups.sources.map(item=><option key={item.id} value={item.id}>{item.name}</option>)}</select><select aria-label="Pipeline" name="pipeline" defaultValue={query.pipeline??''} className="crm-control min-w-40 self-end"><option value="">Todos os pipelines</option>{lookups.pipelines.map(item=><option key={item.id} value={item.id}>{item.name}</option>)}</select>
  </FilterBar></form><CommercialAnalytics data={data} forecast={forecast} quotes={quotes}/></main></div>
}
