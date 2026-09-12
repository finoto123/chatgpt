import 'server-only'

import { createServerSupabaseClient } from '@/lib/supabase/server'
import type { CrmActivity, CrmContact, CrmDashboard, CrmTask, Lead, Opportunity } from '@/types/crm'

const OPPORTUNITY_SELECT = `id,title,customer_id,contact_id,pipeline_id,stage_id,assigned_user_id,source_id,estimated_value,final_value,estimated_quantity,temperature,calculated_temperature,temperature_override,score,score_updated_at,score_breakdown,expected_close_date,desired_delivery_date,stage_entered_at,last_activity_at,next_activity_at,status,loss_reason_id,competitor_name,notes,created_at,customer:clientes(id,nome,contato,email),contact:contacts(id,customer_id,name,job_title,phone,whatsapp,email,is_primary,active),assigned:profiles!opportunities_assigned_user_id_fkey(id,full_name),stage:pipeline_stages(id,pipeline_id,code,name,position,probability,is_won,is_lost),source:lead_sources(id,code,name),opportunity_tags(tags(id,name,color))`

export async function getCrmLookups() {
  const supabase = await createServerSupabaseClient()
  const [pipelines, stages, reasons, sources, profiles, customers, contacts, tags] = await Promise.all([
    supabase.from('pipelines').select('id,code,name,is_default').eq('active', true).order('name'),
    supabase.from('pipeline_stages').select('id,pipeline_id,code,name,position,probability,is_won,is_lost').eq('active', true).order('position'),
    supabase.from('loss_reasons').select('id,code,name').eq('active', true).order('position'),
    supabase.from('lead_sources').select('id,code,name').eq('active', true).order('position'),
    supabase.from('profiles').select('id,full_name').eq('active', true).order('full_name').limit(100),
    supabase.from('clientes').select('id,nome,contato,email').order('nome').limit(200),
    supabase.from('contacts').select('id,customer_id,name,job_title,department,phone,whatsapp,email,is_primary,active').eq('active', true).order('name').limit(500),
    supabase.from('tags').select('id,name,color').eq('active', true).order('name'),
  ])
  const error = [pipelines, stages, reasons, sources, profiles, customers, contacts, tags].find((result) => result.error)?.error
  if (error) throw error
  return { pipelines: pipelines.data ?? [], stages: stages.data ?? [], reasons: reasons.data ?? [], sources: sources.data ?? [], profiles: profiles.data ?? [], customers: customers.data ?? [], contacts: contacts.data ?? [], tags: tags.data ?? [] }
}

export async function getCrmBoard(filters: { assigned?: string; source?: string; temperature?: string; search?: string; status?: string; stage?: string; tag?: string; period?: string; overdue?: string; withoutNext?: string; stale?: string } = {}) {
  const supabase = await createServerSupabaseClient()
  let query = supabase.from('opportunities').select(OPPORTUNITY_SELECT).neq('status', 'archived').order('stage_entered_at').limit(300)
  if (filters.assigned) query = query.eq('assigned_user_id', filters.assigned)
  if (filters.source) query = query.eq('source_id', filters.source)
  if (filters.temperature) query = query.eq('temperature', filters.temperature)
  if (filters.status) query = query.eq('status', filters.status)
  if (filters.stage) query = query.eq('stage_id', filters.stage)
  if (filters.withoutNext === '1') query = query.is('next_activity_at', null)
  if (filters.overdue === '1') query = query.lt('next_activity_at', new Date().toISOString())
  if (filters.stale === '1') {
    const settings = await supabase.from('commercial_settings').select('stale_opportunity_days').single()
    if (settings.error) throw settings.error
    const threshold=new Date(Date.now() - Number(settings.data.stale_opportunity_days) * 86_400_000).toISOString()
    query = query.or(`last_activity_at.lt.${threshold},and(last_activity_at.is.null,created_at.lt.${threshold})`)
  }
  if (filters.period && /^\d+$/.test(filters.period)) query = query.gte('created_at', new Date(Date.now() - Number(filters.period) * 86_400_000).toISOString())
  if (filters.tag) {
    const tagged = await supabase.from('opportunity_tags').select('opportunity_id').eq('tag_id', filters.tag).limit(500)
    if (tagged.error) throw tagged.error
    const ids = (tagged.data ?? []).map((item) => item.opportunity_id)
    if (!ids.length) return []
    query = query.in('id', ids)
  }
  if (filters.search) query = query.ilike('title', `%${filters.search.replace(/[%_,()]/g, '')}%`)
  const { data, error } = await query
  if (error) throw error
  return (data ?? []) as unknown as Opportunity[]
}

export async function getCrmDashboard(): Promise<CrmDashboard> {
  const supabase = await createServerSupabaseClient()
  const { data, error } = await supabase.rpc('get_crm_dashboard')
  if (error) throw error
  return (data ?? { open_opportunities: 0, pipeline_value: 0, weighted_pipeline: 0, overdue_tasks: 0, without_next_action: 0, won_month: 0, lost_month: 0 }) as CrmDashboard
}

export async function getLeads(params: { search?: string; status?: string; assigned?: string; source?: string; page?: number }) {
  const supabase = await createServerSupabaseClient()
  const page = Math.max(1, params.page ?? 1)
  const from = (page - 1) * 30
  let query = supabase.from('leads').select('id,name,company_name,phone,whatsapp,email,source_id,assigned_user_id,status,notes,created_at,updated_at,source:lead_sources(id,code,name),assigned:profiles!leads_assigned_user_id_fkey(id,full_name)', { count: 'exact' }).order('created_at', { ascending: false }).range(from, from + 29)
  if (params.status) query = query.eq('status', params.status)
  if (params.assigned) query = query.eq('assigned_user_id', params.assigned)
  if (params.source) query = query.eq('source_id', params.source)
  if (params.search) {
    const safe = params.search.replace(/[%_,()]/g, '')
    query = query.or(`name.ilike.%${safe}%,company_name.ilike.%${safe}%,email.ilike.%${safe}%`)
  }
  const { data, error, count } = await query
  if (error) throw error
  return { leads: (data ?? []) as unknown as Lead[], count: count ?? 0, page }
}

export async function getOpportunityById(id: string, activityPage = 1) {
  const supabase = await createServerSupabaseClient()
  const safeActivityPage = Math.max(1, activityPage)
  const activityFrom = (safeActivityPage - 1) * 30
  const [opportunity, activities, tasks, contacts] = await Promise.all([
    supabase.from('opportunities').select(OPPORTUNITY_SELECT).eq('id', id).single(),
    supabase.from('activities').select('id,type,title,description,metadata,occurred_at,user:profiles!activities_user_id_fkey(id,full_name)', { count: 'exact' }).eq('opportunity_id', id).order('occurred_at', { ascending: false }).range(activityFrom, activityFrom + 29),
    supabase.from('tasks').select('id,opportunity_id,customer_id,contact_id,assigned_user_id,type,title,description,due_at,priority,status,completed_at').eq('opportunity_id', id).order('due_at'),
    supabase.from('contacts').select('id,customer_id,name,job_title,phone,whatsapp,email,is_primary,active').eq('customer_id', (await supabase.from('opportunities').select('customer_id').eq('id', id).single()).data?.customer_id ?? id).eq('active', true).order('is_primary', { ascending: false }),
  ])
  if (opportunity.error) return null
  if (activities.error) throw activities.error
  if (tasks.error) throw tasks.error
  const value = opportunity.data as unknown as Opportunity
  return { opportunity: value, activities: (activities.data ?? []) as unknown as CrmActivity[], activityCount: activities.count ?? 0, activityPage: safeActivityPage, tasks: (tasks.data ?? []) as unknown as CrmTask[], contacts: (contacts.data ?? []) as CrmContact[] }
}

export async function getMyTasks(userId: string) {
  const supabase = await createServerSupabaseClient()
  const { data, error } = await supabase.from('tasks').select('id,opportunity_id,customer_id,contact_id,assigned_user_id,type,title,description,due_at,priority,status,completed_at,opportunity:opportunities(id,title),customer:clientes(id,nome)').eq('assigned_user_id', userId).order('due_at').limit(400)
  if (error) throw error
  return (data ?? []) as unknown as CrmTask[]
}

export async function getCustomerCrmSummary(customerId: string) {
  const supabase = await createServerSupabaseClient()
  const [contacts, opportunities, activities, tasks] = await Promise.all([
    supabase.from('contacts').select('id,customer_id,name,job_title,phone,whatsapp,email,is_primary,active').eq('customer_id', customerId).eq('active', true).order('is_primary', { ascending: false }),
    supabase.from('opportunities').select(OPPORTUNITY_SELECT).eq('customer_id', customerId).neq('status', 'archived').order('created_at', { ascending: false }).limit(50),
    supabase.from('activities').select('id,type,title,description,metadata,occurred_at,user:profiles!activities_user_id_fkey(id,full_name)').eq('customer_id', customerId).order('occurred_at', { ascending: false }).limit(20),
    supabase.from('tasks').select('id,opportunity_id,customer_id,contact_id,assigned_user_id,type,title,description,due_at,priority,status,completed_at').eq('customer_id', customerId).eq('status', 'pending').order('due_at').limit(20),
  ])
  const error = [contacts, opportunities, activities, tasks].find((result) => result.error)?.error
  if (error) throw error
  return { contacts: (contacts.data ?? []) as CrmContact[], opportunities: (opportunities.data ?? []) as unknown as Opportunity[], activities: (activities.data ?? []) as unknown as CrmActivity[], tasks: (tasks.data ?? []) as CrmTask[] }
}

export async function globalCommercialSearch(term: string) {
  const supabase = await createServerSupabaseClient()
  const safe = term.replace(/[%_,()]/g, '').trim()
  if (safe.length < 2) return { customers: [], orders: [], leads: [], opportunities: [], quotes: [] }
  const [customers, orders, leads, opportunities] = await Promise.all([
    supabase.from('clientes').select('id,nome,contato,email').or(`nome.ilike.%${safe}%,email.ilike.%${safe}%`).limit(8),
    supabase.from('pedidos').select('id,numero,cliente,status').or(`numero.ilike.%${safe}%,cliente.ilike.%${safe}%`).limit(8),
    supabase.from('leads').select('id,name,company_name,status').or(`name.ilike.%${safe}%,company_name.ilike.%${safe}%`).limit(8),
    supabase.from('opportunities').select('id,title,status,customer:clientes(nome)').ilike('title', `%${safe}%`).limit(8),
  ])
  const quoteFilters = [`quote_number.ilike.%${safe}%`]
  const customerIds = (customers.data ?? []).map((item) => item.id)
  const opportunityIds = (opportunities.data ?? []).map((item) => item.id)
  if (customerIds.length) quoteFilters.push(`customer_id.in.(${customerIds.join(',')})`)
  if (opportunityIds.length) quoteFilters.push(`opportunity_id.in.(${opportunityIds.join(',')})`)
  const quotes = await supabase.from('quotes').select('id,quote_number,status,customer:clientes(nome),opportunity:opportunities(title)').or(quoteFilters.join(',')).limit(8)
  return { customers: customers.data ?? [], orders: orders.data ?? [], leads: leads.data ?? [], opportunities: opportunities.data ?? [], quotes: quotes.data ?? [] }
}
