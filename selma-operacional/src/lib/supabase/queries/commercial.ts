import 'server-only'
import { createServerSupabaseClient } from '@/lib/supabase/server'
import type { AutomationRule, CommercialAnalyticsData, CommercialCentralData, CommercialNotification, CommercialSettings, ForecastData, ReactivationData, SalesTarget, SavedView, ScoringRule } from '@/types/commercial'
import type { PaymentTermTemplate } from '@/types/quotes'

async function rpc<T>(name:string,args:Record<string,unknown>){const supabase=await createServerSupabaseClient();const {data,error}=await supabase.rpc(name,args);if(error)throw error;return data as T}
export const getCommercialCentral=(userId?:string)=>rpc<CommercialCentralData>('get_commercial_central',{p_user_id:userId||null})
export async function getCommercialAnalytics(filters:{start:string;end:string;userId?:string;sourceId?:string;pipelineId?:string}) {
  const data=await rpc<Omit<CommercialAnalyticsData,'revenue_trend'>>('get_commercial_analytics',{p_start:filters.start,p_end:filters.end,p_user_id:filters.userId||null,p_source_id:filters.sourceId||null,p_pipeline_id:filters.pipelineId||null})
  const supabase=await createServerSupabaseClient()
  const endExclusive=new Date(`${filters.end}T12:00:00Z`);endExclusive.setUTCDate(endExclusive.getUTCDate()+1)
  let query=supabase.from('opportunities').select('won_at,final_value,estimated_value').eq('status','won').gte('won_at',`${filters.start}T00:00:00Z`).lt('won_at',endExclusive.toISOString()).order('won_at').limit(1000)
  if(filters.userId)query=query.eq('assigned_user_id',filters.userId)
  if(filters.sourceId)query=query.eq('source_id',filters.sourceId)
  if(filters.pipelineId)query=query.eq('pipeline_id',filters.pipelineId)
  const {data:won,error}=await query
  if(error)throw error
  const span=(new Date(filters.end).getTime()-new Date(filters.start).getTime())/86_400_000
  const monthly=span>62
  const grouped=new Map<string,number>()
  for(const item of won??[]){if(!item.won_at)continue;const date=String(item.won_at).slice(0,10);const key=monthly?date.slice(0,7):date;grouped.set(key,(grouped.get(key)??0)+Number(item.final_value??item.estimated_value??0))}
  const revenue_trend=[...grouped].map(([period,value])=>({period,label:monthly?new Intl.DateTimeFormat('pt-BR',{month:'short',year:'2-digit',timeZone:'UTC'}).format(new Date(`${period}-01T12:00:00Z`)):new Intl.DateTimeFormat('pt-BR',{day:'2-digit',month:'short',timeZone:'UTC'}).format(new Date(`${period}T12:00:00Z`)),value}))
  return {...data,revenue_trend} as CommercialAnalyticsData
}
export const getSalesForecast=(start:string,end:string,userId?:string)=>rpc<ForecastData>('get_sales_forecast',{p_start:start,p_end:end,p_user_id:userId||null})
export async function getReactivationCustomers(days:number,mode:string,minTicket:number,page:number){
  const base=await rpc<ReactivationData>('get_reactivation_customers',{p_days:days,p_mode:mode,p_min_ticket:minTicket,p_limit:50,p_offset:(Math.max(1,page)-1)*50})
  const ids=base.items.map(item=>item.id)
  if(!ids.length)return base
  const supabase=await createServerSupabaseClient()
  const [opportunities,activities]=await Promise.all([
    supabase.from('opportunities').select('customer_id,assigned:profiles!opportunities_assigned_user_id_fkey(full_name)').in('customer_id',ids).eq('status','open').order('created_at',{ascending:false}).limit(300),
    supabase.from('activities').select('customer_id,occurred_at').in('customer_id',ids).order('occurred_at',{ascending:false}).limit(500),
  ])
  if(opportunities.error)throw opportunities.error
  if(activities.error)throw activities.error
  const responsible=new Map<string,string>();for(const item of opportunities.data??[]){const assigned=Array.isArray(item.assigned)?item.assigned[0]:item.assigned;if(item.customer_id&&!responsible.has(item.customer_id)&&assigned?.full_name)responsible.set(item.customer_id,assigned.full_name)}
  const contacts=new Map<string,string>();for(const item of activities.data??[]){if(item.customer_id&&!contacts.has(item.customer_id))contacts.set(item.customer_id,item.occurred_at)}
  return {...base,items:base.items.map(item=>({...item,responsible_name:responsible.get(item.id)??null,last_contact_at:contacts.get(item.id)??null}))}
}

export async function getCommercialConfig(){
  const supabase=await createServerSupabaseClient()
  const [settings,scoring,automations,targets,pipelines,stages,sources,reasons,profiles,paymentTerms]=await Promise.all([
    supabase.from('commercial_settings').select('*').single(),
    supabase.from('scoring_rules').select('*').order('position'),
    supabase.from('automation_rules').select('*').order('name'),
    supabase.from('sales_targets').select('*,user:profiles!sales_targets_user_id_fkey(id,full_name)').order('period_start',{ascending:false}).limit(50),
    supabase.from('pipelines').select('id,code,name,is_default,active').order('name'),
    supabase.from('pipeline_stages').select('id,pipeline_id,code,name,position,probability,is_won,is_lost,active').order('position'),
    supabase.from('lead_sources').select('id,code,name,position,active').order('position'),
    supabase.from('loss_reasons').select('id,code,name,position,active').order('position'),
    supabase.from('profiles').select('id,full_name').eq('active',true).order('full_name'),
    supabase.from('payment_term_templates').select('id,name,description,rules,active').order('name'),
  ])
  const error=[settings,scoring,automations,targets,pipelines,stages,sources,reasons,profiles,paymentTerms].find(result=>result.error)?.error
  if(error)throw error
  const targetRows=(targets.data??[]) as unknown as SalesTarget[]
  let enrichedTargets=targetRows
  if(targetRows.length){
    const start=targetRows.reduce((value,item)=>item.period_start<value?item.period_start:value,targetRows[0].period_start)
    const end=targetRows.reduce((value,item)=>item.period_end>value?item.period_end:value,targetRows[0].period_end)
    const endExclusive=new Date(`${end}T12:00:00Z`);endExclusive.setUTCDate(endExclusive.getUTCDate()+1)
    const won=await supabase.from('opportunities').select('assigned_user_id,final_value,estimated_value,won_at').eq('status','won').gte('won_at',`${start}T00:00:00Z`).lt('won_at',endExclusive.toISOString()).limit(5000)
    if(won.error)throw won.error
    enrichedTargets=targetRows.map(target=>{const rows=(won.data??[]).filter(item=>item.won_at&&String(item.won_at).slice(0,10)>=target.period_start&&String(item.won_at).slice(0,10)<=target.period_end&&(!target.user_id||item.assigned_user_id===target.user_id));const realized_value=target.target_type==='opportunities_won'?rows.length:rows.reduce((sum,item)=>sum+Number(item.final_value??item.estimated_value??0),0);return {...target,realized_value}})
  }
  return {settings:settings.data as CommercialSettings,scoring:(scoring.data??[]) as ScoringRule[],automations:(automations.data??[]) as AutomationRule[],targets:enrichedTargets,pipelines:pipelines.data??[],stages:stages.data??[],sources:sources.data??[],reasons:reasons.data??[],profiles:profiles.data??[],paymentTerms:(paymentTerms.data??[]) as PaymentTermTemplate[]}
}
export async function getCommercialSettings(){const supabase=await createServerSupabaseClient();const {data,error}=await supabase.from('commercial_settings').select('*').single();if(error)throw error;return data as CommercialSettings}
export async function getSavedViews(module:string){const supabase=await createServerSupabaseClient();const {data,error}=await supabase.from('saved_views').select('id,module,name,filters,is_default').eq('module',module).order('name');if(error)throw error;return (data??[]) as SavedView[]}
export async function getCommercialNotifications(){const supabase=await createServerSupabaseClient();const {data,error}=await supabase.from('notifications').select('id,type,title,body,entity_type,entity_id,read_at,created_at').order('created_at',{ascending:false}).limit(30);if(error)throw error;return (data??[]) as CommercialNotification[]}
