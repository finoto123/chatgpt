'use server'

import { revalidatePath } from 'next/cache'
import { z } from 'zod'
import { requirePermission } from '@/lib/auth/require-user'
import { safeDatabaseError } from '@/lib/security/errors'
import { createServerSupabaseClient } from '@/lib/supabase/server'
import { activityInputSchema, contactInputSchema, convertLeadSchema, leadInputSchema, moveStageSchema, opportunityInputSchema, reopenOpportunitySchema, taskInputSchema } from '@/lib/schemas/crm'

type Result<T = undefined> = { success: true; data?: T } | { success: false; error: string; duplicateCustomerId?: string }
const nullable = <T>(value: T | null | undefined) => value || null
function refreshCrm(id?: string, customerId?: string) { revalidatePath('/crm'); revalidatePath('/crm/leads'); revalidatePath('/tarefas'); if (id) revalidatePath(`/crm/oportunidades/${id}`); if (customerId) revalidatePath(`/clientes/${customerId}`) }

export async function createLead(input: unknown): Promise<Result<{ id: string }>> {
  const context = await requirePermission('crm.create')
  const parsed = leadInputSchema.safeParse(input)
  if (!parsed.success) return { success: false, error: 'Revise os dados do lead.' }
  const data = parsed.data
  const supabase = await createServerSupabaseClient()
  const result = await supabase.from('leads').insert({ ...data, company_name: nullable(data.company_name), phone: nullable(data.phone), whatsapp: nullable(data.whatsapp), email: nullable(data.email), source_id: nullable(data.source_id), notes: nullable(data.notes), created_by: context.user.id }).select('id').single()
  if (result.error) return { success: false, error: safeDatabaseError(result.error, 'Não foi possível criar o lead.', { action: 'crm.lead.create' }) }
  refreshCrm(); return { success: true, data: result.data }
}

export async function updateLead(id: string, input: unknown): Promise<Result> {
  await requirePermission('crm.update')
  const parsed = z.object({ id: z.string().uuid(), input: leadInputSchema }).strict().safeParse({ id, input })
  if (!parsed.success) return { success: false, error: 'Revise os dados do lead.' }
  const data = parsed.data.input
  const supabase = await createServerSupabaseClient()
  const { error } = await supabase.from('leads').update({ ...data, company_name: nullable(data.company_name), phone: nullable(data.phone), whatsapp: nullable(data.whatsapp), email: nullable(data.email), source_id: nullable(data.source_id), notes: nullable(data.notes) }).eq('id', parsed.data.id).in('status', ['new','working','qualified'])
  if (error) return { success: false, error: safeDatabaseError(error, 'Não foi possível atualizar o lead.', { action: 'crm.lead.update', entityId: id }) }
  refreshCrm(); return { success: true }
}

export async function setLeadStatus(id: string, status: 'working' | 'qualified' | 'disqualified'): Promise<Result> {
  await requirePermission('crm.update')
  const parsed = z.object({ id: z.string().uuid(), status: z.enum(['working','qualified','disqualified']) }).strict().safeParse({ id, status })
  if (!parsed.success) return { success: false, error: 'Lead inválido.' }
  const supabase = await createServerSupabaseClient()
  const { error } = await supabase.from('leads').update({ status }).eq('id', id).neq('status', 'converted')
  if (error) return { success: false, error: safeDatabaseError(error, 'Não foi possível atualizar o lead.', { action: status === 'disqualified' ? 'crm.lead.disqualify' : 'crm.lead.status', entityId: id }) }
  refreshCrm(); return { success: true }
}

export async function findLeadDuplicates(leadId: string): Promise<Result<Array<{ id: string; nome: string; contato: string | null; email: string | null }>>> {
  await requirePermission('crm.view')
  const id = z.string().uuid().safeParse(leadId); if (!id.success) return { success: false, error: 'Lead inválido.' }
  const supabase = await createServerSupabaseClient()
  const lead = await supabase.from('leads').select('phone_normalized,whatsapp_normalized,email_normalized').eq('id', id.data).single()
  if (lead.error) return { success: false, error: 'Não foi possível verificar duplicidades.' }
  const candidates = await supabase.from('clientes').select('id,nome,contato,email').limit(500)
  if (candidates.error) return { success: false, error: 'Não foi possível verificar duplicidades.' }
  const normalized = (value: string | null) => (value ?? '').replace(/\D/g, '').replace(/^0/, '55')
  const data = (candidates.data ?? []).filter((customer) => (lead.data.email_normalized && customer.email?.trim().toLowerCase() === lead.data.email_normalized) || ([lead.data.phone_normalized, lead.data.whatsapp_normalized].filter(Boolean).includes(normalized(customer.contato))))
  return { success: true, data }
}

export async function convertLead(input: unknown): Promise<Result<Record<string, string | null>>> {
  await requirePermission('crm.update')
  const parsed = convertLeadSchema.safeParse(input); if (!parsed.success) return { success: false, error: 'Revise as opções de conversão.' }
  const supabase = await createServerSupabaseClient()
  const { data, error } = await supabase.rpc('convert_lead', { p_lead_id: parsed.data.lead_id, p_customer_id: nullable(parsed.data.customer_id), p_create_new_customer: parsed.data.create_new_customer, p_create_contact: parsed.data.create_contact, p_create_opportunity: parsed.data.create_opportunity, p_opportunity_title: nullable(parsed.data.opportunity_title) })
  if (error) {
    const match = error.message?.match(/possible_duplicate_customer:([0-9a-f-]{36})/i)
    return { success: false, error: match ? 'Encontramos um cliente possivelmente duplicado. Selecione-o antes de continuar.' : safeDatabaseError(error, 'Não foi possível converter o lead.', { action: 'crm.lead.convert', entityId: parsed.data.lead_id }), duplicateCustomerId: match?.[1] }
  }
  refreshCrm(data?.opportunity_id, data?.customer_id); return { success: true, data }
}

export async function createOpportunity(input: unknown): Promise<Result<{ id: string }>> {
  const context = await requirePermission('crm.create')
  const parsed = opportunityInputSchema.safeParse(input); if (!parsed.success) return { success: false, error: 'Revise os dados da oportunidade.' }
  const data = parsed.data; const supabase = await createServerSupabaseClient()
  const { data: row, error } = await supabase.from('opportunities').insert({ ...data, contact_id: nullable(data.contact_id), source_id: nullable(data.source_id), expected_close_date: nullable(data.expected_close_date), desired_delivery_date: nullable(data.desired_delivery_date), notes: nullable(data.notes), created_by: context.user.id }).select('id').single()
  if (error) return { success: false, error: safeDatabaseError(error, 'Não foi possível criar a oportunidade.', { action: 'crm.opportunity.create' }) }
  refreshCrm(row.id, data.customer_id); return { success: true, data: row }
}

export async function updateOpportunity(id: string, input: unknown): Promise<Result> {
  await requirePermission('crm.update')
  const parsed = z.object({ id: z.string().uuid(), input: opportunityInputSchema.omit({ pipeline_id: true, stage_id: true, customer_id: true }) }).strict().safeParse({ id, input })
  if (!parsed.success) return { success: false, error: 'Revise os dados da oportunidade.' }
  const data = parsed.data.input; const supabase = await createServerSupabaseClient()
  const { error } = await supabase.from('opportunities').update({ ...data, contact_id: nullable(data.contact_id), source_id: nullable(data.source_id), expected_close_date: nullable(data.expected_close_date), desired_delivery_date: nullable(data.desired_delivery_date), notes: nullable(data.notes) }).eq('id', id).eq('status', 'open')
  if (error) return { success: false, error: safeDatabaseError(error, 'Não foi possível atualizar a oportunidade.', { action: 'crm.opportunity.update', entityId: id }) }
  refreshCrm(id); return { success: true }
}

export async function moveOpportunityStage(input: unknown): Promise<Result> {
  await requirePermission('crm.update')
  const parsed = moveStageSchema.safeParse(input); if (!parsed.success) return { success: false, error: 'Revise a mudança de etapa.' }
  const data = parsed.data; const supabase = await createServerSupabaseClient()
  const { error } = await supabase.rpc('move_opportunity_stage', { p_opportunity_id: data.opportunity_id, p_stage_id: data.stage_id, p_loss_reason_id: nullable(data.loss_reason_id), p_competitor_name: nullable(data.competitor_name), p_notes: nullable(data.notes), p_expected_stage_entered_at: data.expected_stage_entered_at })
  if (error) return { success: false, error: safeDatabaseError(error, error.code === '40001' ? 'A oportunidade mudou. Atualize a página e tente novamente.' : 'Não foi possível mover a oportunidade.', { action: 'crm.opportunity.stage', entityId: data.opportunity_id }) }
  refreshCrm(data.opportunity_id); return { success: true }
}

export async function reopenOpportunity(input: unknown): Promise<Result> {
  await requirePermission('crm.update')
  const parsed = reopenOpportunitySchema.safeParse(input); if (!parsed.success) return { success: false, error: 'Revise os dados da reabertura.' }
  const supabase = await createServerSupabaseClient(); const { error } = await supabase.rpc('reopen_opportunity', { p_opportunity_id: parsed.data.opportunity_id, p_stage_id: parsed.data.stage_id, p_reason: parsed.data.reason })
  if (error) return { success: false, error: safeDatabaseError(error, 'Não foi possível reabrir a oportunidade.', { action: 'crm.opportunity.reopen', entityId: parsed.data.opportunity_id }) }
  refreshCrm(parsed.data.opportunity_id); return { success: true }
}

export async function archiveOpportunity(id: string): Promise<Result> {
  await requirePermission('crm.delete')
  const parsed = z.string().uuid().safeParse(id); if (!parsed.success) return { success: false, error: 'Oportunidade inválida.' }
  const supabase = await createServerSupabaseClient(); const { error } = await supabase.rpc('archive_opportunity', { p_opportunity_id: id })
  if (error) return { success: false, error: safeDatabaseError(error, 'Não foi possível arquivar a oportunidade.', { action: 'crm.opportunity.archive', entityId: id }) }
  refreshCrm(id); return { success: true }
}

export async function addContact(input: unknown): Promise<Result<{ id: string }>> {
  const context = await requirePermission('crm.create'); const parsed = contactInputSchema.safeParse(input); if (!parsed.success) return { success: false, error: 'Revise os dados do contato.' }
  const data = parsed.data; const supabase = await createServerSupabaseClient(); const { data: row, error } = await supabase.from('contacts').insert({ ...data, email: nullable(data.email), phone: nullable(data.phone), whatsapp: nullable(data.whatsapp), job_title: nullable(data.job_title), notes: nullable(data.notes), created_by: context.user.id }).select('id').single()
  if (error) return { success: false, error: safeDatabaseError(error, 'Não foi possível criar o contato.', { action: 'crm.contact.create' }) }
  refreshCrm(undefined, data.customer_id); return { success: true, data: row }
}

export async function recordActivity(input: unknown): Promise<Result> {
  await requirePermission('crm.create'); const parsed = activityInputSchema.safeParse(input); if (!parsed.success) return { success: false, error: 'Revise os dados da atividade.' }
  const data = parsed.data; const supabase = await createServerSupabaseClient(); const { error } = await supabase.rpc('record_crm_activity', { p_opportunity_id: data.opportunity_id, p_contact_id: nullable(data.contact_id), p_type: data.type, p_title: data.title, p_description: nullable(data.description), p_occurred_at: nullable(data.occurred_at) })
  if (error) return { success: false, error: safeDatabaseError(error, 'Não foi possível registrar a atividade.', { action: 'crm.activity.create', entityId: data.opportunity_id }) }
  refreshCrm(data.opportunity_id); return { success: true }
}

export async function createTask(input: unknown): Promise<Result> {
  await requirePermission('crm.create'); const parsed = taskInputSchema.safeParse(input); if (!parsed.success) return { success: false, error: 'Revise os dados da tarefa.' }
  const data = parsed.data; const supabase = await createServerSupabaseClient(); const { error } = await supabase.rpc('create_crm_task', { p_opportunity_id: nullable(data.opportunity_id), p_customer_id: nullable(data.customer_id), p_contact_id: nullable(data.contact_id), p_type: data.type, p_title: data.title, p_description: nullable(data.description), p_due_at: data.due_at, p_priority: data.priority })
  if (error) return { success: false, error: safeDatabaseError(error, 'Não foi possível criar a tarefa.', { action: 'crm.task.create' }) }
  refreshCrm(data.opportunity_id ?? undefined, data.customer_id ?? undefined); return { success: true }
}

export async function finishTask(id: string, cancel = false): Promise<Result> {
  await requirePermission('crm.update'); const parsed = z.object({ id: z.string().uuid(), cancel: z.boolean() }).strict().safeParse({ id, cancel }); if (!parsed.success) return { success: false, error: 'Tarefa inválida.' }
  const supabase = await createServerSupabaseClient(); const { error } = await supabase.rpc('complete_crm_task', { p_task_id: id, p_cancel: cancel })
  if (error) return { success: false, error: safeDatabaseError(error, 'Não foi possível atualizar a tarefa.', { action: cancel ? 'crm.task.cancel' : 'crm.task.complete', entityId: id }) }
  refreshCrm(); return { success: true }
}

export async function rescheduleTask(id: string, dueAt: string): Promise<Result> {
  await requirePermission('crm.update'); const parsed = z.object({ id: z.string().uuid(), dueAt: z.string().datetime() }).strict().safeParse({ id, dueAt }); if (!parsed.success) return { success: false, error: 'Nova data inválida.' }
  const supabase = await createServerSupabaseClient(); const { error } = await supabase.from('tasks').update({ due_at: dueAt }).eq('id', id).eq('status', 'pending')
  if (error) return { success: false, error: safeDatabaseError(error, 'Não foi possível reagendar a tarefa.', { action: 'crm.task.reschedule', entityId: id }) }
  refreshCrm(); return { success: true }
}

export async function setOpportunityTags(opportunityId: string, tagIds: string[]): Promise<Result> {
  await requirePermission('crm.update')
  const parsed = z.object({ opportunityId: z.string().uuid(), tagIds: z.array(z.string().uuid()).max(20) }).strict().safeParse({ opportunityId, tagIds: [...new Set(tagIds)] })
  if (!parsed.success) return { success: false, error: 'Seleção de tags inválida.' }
  const supabase = await createServerSupabaseClient()
  const { error } = await supabase.rpc('set_opportunity_tags', { p_opportunity_id: parsed.data.opportunityId, p_tag_ids: parsed.data.tagIds })
  if (error) return { success: false, error: safeDatabaseError(error, 'Não foi possível salvar as tags.', { action: 'crm.opportunity.tags', entityId: opportunityId }) }
  refreshCrm(opportunityId); return { success: true }
}
