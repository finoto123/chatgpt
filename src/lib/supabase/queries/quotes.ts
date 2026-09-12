import 'server-only'

import { createServerSupabaseClient } from '@/lib/supabase/server'
import type { DiscountApproval, PaymentTermTemplate, PublicProposal, Quote, QuoteDashboardStats, QuoteVersion } from '@/types/quotes'

const QUOTE_SELECT = 'id,quote_number,opportunity_id,customer_id,contact_id,assigned_user_id,status,currency,current_version_id,valid_until,desired_delivery_date,payment_term_id,commercial_notes,internal_notes,subtotal,discount_amount,discount_percent,freight_amount,additional_amount,total_amount,estimated_cost,estimated_profit,margin_percent,markup,created_at,updated_at,sent_at,approved_at,rejected_at,converted_at,converted_order_id,customer:clientes(id,nome,contato,email),contact:contacts(id,name,email,phone,whatsapp),assigned:profiles!quotes_assigned_user_id_fkey(id,full_name),opportunity:opportunities!inner(id,title,source_id,pipeline_id)'
const VERSION_SELECT = 'id,quote_id,version_number,status,subtotal,discount_amount,discount_percent,freight_amount,additional_amount,total_amount,estimated_cost,estimated_profit,margin_percent,markup,payment_terms_snapshot,valid_until,desired_delivery_date,customer_snapshot,commercial_snapshot,created_by,creator:profiles!quote_versions_created_by_fkey(full_name),created_at,sent_at,approved_at,rejected_at,first_viewed_at,last_viewed_at,view_count,items:quote_items(id,description,product_type,model,fabric_id,fabric_name_snapshot,color,customization_type,quantity,unit_price,unit_cost,cost_source,discount_amount,subtotal,estimated_cost,estimated_profit,notes,position,sizes:quote_item_sizes(id,size,quantity,position))'
const uuidPattern = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i
const datePattern = /^\d{4}-\d{2}-\d{2}$/

export type QuoteFilters = {
  status?: string
  assigned?: string
  customer?: string
  search?: string
  from?: string
  to?: string
  marginMin?: string
  valueMin?: string
  valueMax?: string
  validity?: string
  response?: string
  source?: string
  pipeline?: string
  page?: number
}

export async function getQuotes(params: QuoteFilters = {}) {
  const supabase = await createServerSupabaseClient()
  const page = Math.max(1, params.page ?? 1)
  let relatedCustomerIds: string[] = []
  let relatedOpportunityIds: string[] = []
  const safeSearch = params.search?.replace(/[%_,()]/g, '').trim().slice(0, 80)
  if (safeSearch) {
    const [customers, opportunities] = await Promise.all([
      supabase.from('clientes').select('id').ilike('nome', `%${safeSearch}%`).limit(50),
      supabase.from('opportunities').select('id').ilike('title', `%${safeSearch}%`).limit(50),
    ])
    relatedCustomerIds = (customers.data ?? []).map((item) => item.id)
    relatedOpportunityIds = (opportunities.data ?? []).map((item) => item.id)
  }
  let query = supabase.from('quotes')
    .select(`${QUOTE_SELECT},current_version:quote_versions!quotes_current_version_matches_quote_fkey(version_number)`, { count: 'exact' })
    .order('created_at', { ascending: false })
    .range((page - 1) * 25, page * 25 - 1)
  if (params.status) query = query.eq('status', params.status)
  if (params.assigned && uuidPattern.test(params.assigned)) query = query.eq('assigned_user_id', params.assigned)
  if (params.customer && uuidPattern.test(params.customer)) query = query.eq('customer_id', params.customer)
  if (safeSearch) {
    const filters = [`quote_number.ilike.%${safeSearch}%`]
    if (relatedCustomerIds.length) filters.push(`customer_id.in.(${relatedCustomerIds.join(',')})`)
    if (relatedOpportunityIds.length) filters.push(`opportunity_id.in.(${relatedOpportunityIds.join(',')})`)
    query = query.or(filters.join(','))
  }
  if (params.source && uuidPattern.test(params.source)) query = query.eq('opportunity.source_id', params.source)
  if (params.pipeline && uuidPattern.test(params.pipeline)) query = query.eq('opportunity.pipeline_id', params.pipeline)
  if (params.from && datePattern.test(params.from)) query = query.gte('created_at', `${params.from}T00:00:00-03:00`)
  if (params.to && datePattern.test(params.to)) query = query.lte('created_at', `${params.to}T23:59:59-03:00`)
  const marginMin = Number(params.marginMin)
  const valueMin = Number(params.valueMin)
  const valueMax = Number(params.valueMax)
  if (params.marginMin && Number.isFinite(marginMin)) query = query.gte('margin_percent', marginMin)
  if (params.valueMin && Number.isFinite(valueMin)) query = query.gte('total_amount', valueMin)
  if (params.valueMax && Number.isFinite(valueMax)) query = query.lte('total_amount', valueMax)
  const today = businessDate()
  if (params.validity === 'today') query = query.eq('valid_until', today)
  if (params.validity === 'three_days') query = query.gte('valid_until', today).lte('valid_until', addDays(today, 3))
  if (params.validity === 'expired') query = query.lt('valid_until', today)
  if (params.response === 'approved') query = query.in('status', ['approved', 'converted'])
  if (params.response === 'waiting') query = query.in('status', ['sent', 'viewed'])
  const { data, error, count } = await query
  if (error) throw error
  return { quotes: (data ?? []) as unknown as Quote[], count: count ?? 0, page }
}

export async function getQuoteById(id: string) {
  const supabase = await createServerSupabaseClient()
  const quote = await supabase.from('quotes').select(`${QUOTE_SELECT},current_version:quote_versions!quotes_current_version_matches_quote_fkey(${VERSION_SELECT})`).eq('id', id).maybeSingle()
  if (quote.error) throw quote.error
  if (!quote.data) return null
  const convertedOrderId = (quote.data as unknown as Quote).converted_order_id
  const [versions, approvals, activities, receivables] = await Promise.all([
    supabase.from('quote_versions').select(VERSION_SELECT).eq('quote_id', id).order('version_number', { ascending: false }).limit(20),
    supabase.from('discount_approvals').select('id,quote_id,quote_version_id,discount_percent,margin_percent,reason,status,requested_at,decision_notes,requested_by_profile:profiles!discount_approvals_requested_by_fkey(full_name),approved_by_profile:profiles!discount_approvals_approved_by_fkey(full_name),rejected_by_profile:profiles!discount_approvals_rejected_by_fkey(full_name)').eq('quote_id', id).order('requested_at', { ascending: false }),
    supabase.from('activities').select('id,title,description,occurred_at,metadata,user:profiles(full_name)').contains('metadata', { quote_id: id }).order('occurred_at', { ascending: false }).limit(30),
    convertedOrderId ? supabase.from('accounts_receivable').select('id,description,amount,due_date,status,installment_number,allocations:payment_allocations(amount,payment:payments(status))').eq('order_id', convertedOrderId).order('installment_number') : Promise.resolve({ data: [], error: null }),
  ])
  const error = versions.error ?? approvals.error ?? activities.error ?? receivables.error
  if (error) throw error
  return {
    quote: quote.data as unknown as Quote,
    versions: (versions.data ?? []) as unknown as QuoteVersion[],
    approvals: (approvals.data ?? []) as unknown as DiscountApproval[],
    activities: activities.data ?? [],
    receivables: receivables.data ?? [],
  }
}

export async function getQuoteLookups(opportunityId?: string) {
  const supabase = await createServerSupabaseClient()
  const [terms, fabrics, profiles, opportunity] = await Promise.all([
    supabase.from('payment_term_templates').select('id,name,description,rules,active').eq('active', true).order('name'),
    supabase.from('tecidos').select('id,codigo,descricao,valor_unitario').order('descricao').limit(300),
    supabase.from('profiles').select('id,full_name').eq('active', true).order('full_name'),
    opportunityId ? supabase.from('opportunities').select('id,title,customer_id,contact_id,assigned_user_id,desired_delivery_date,estimated_quantity,customer:clientes(id,nome,contacts(id,name,active)),contact:contacts(id,name)').eq('id', opportunityId).maybeSingle() : Promise.resolve({ data: null, error: null }),
  ])
  const error = [terms, fabrics, profiles, opportunity].find((result) => result.error)?.error
  if (error) throw error
  return { terms: (terms.data ?? []) as PaymentTermTemplate[], fabrics: fabrics.data ?? [], profiles: profiles.data ?? [], opportunity: opportunity.data }
}

export async function getPublicProposal(token: string) {
  const supabase = await createServerSupabaseClient()
  const { data, error } = await supabase.rpc('get_public_proposal', { p_token: token })
  if (error) throw error
  return data as PublicProposal | null
}

export async function getOpportunityQuotes(opportunityId: string) {
  const supabase = await createServerSupabaseClient()
  const { data, error } = await supabase.from('quotes').select('id,quote_number,status,total_amount,margin_percent,valid_until,current_version:quote_versions!quotes_current_version_matches_quote_fkey(version_number)').eq('opportunity_id', opportunityId).order('created_at', { ascending: false }).limit(20)
  if (error) throw error
  return data ?? []
}

export async function getQuoteDashboardStats(start?: string, end?: string): Promise<QuoteDashboardStats> {
  const supabase = await createServerSupabaseClient()
  const { data, error } = await supabase.rpc('get_quote_dashboard_stats', { p_start: start ?? null, p_end: end ?? null })
  if (error || !data) return emptyDashboardStats()
  const row = data as Record<string, number>
  return { created:Number(row.created??0),draft:Number(row.draft??0),sent:Number(row.sent??0),sentValue:Number(row.sent_value??0),waiting:Number(row.waiting??0),waitingValue:Number(row.waiting_value??0),approved:Number(row.approved??0),approvedValue:Number(row.approved_value??0),expired:Number(row.expired??0),approvalRate:Number(row.approval_rate??0),averageMargin:Number(row.average_margin??0),pendingApprovals:Number(row.pending_approvals??0),pendingApprovalValue:Number(row.pending_approval_value??0) }
}

function emptyDashboardStats(): QuoteDashboardStats { return { created:0,draft:0,sent:0,sentValue:0,waiting:0,waitingValue:0,approved:0,approvedValue:0,expired:0,approvalRate:0,averageMargin:0,pendingApprovals:0,pendingApprovalValue:0 } }
function businessDate() { return new Intl.DateTimeFormat('en-CA', { timeZone: 'America/Sao_Paulo', year: 'numeric', month: '2-digit', day: '2-digit' }).format(new Date()) }
function addDays(date: string, days: number) { const value = new Date(`${date}T12:00:00-03:00`); value.setDate(value.getDate() + days); return value.toISOString().slice(0, 10) }
