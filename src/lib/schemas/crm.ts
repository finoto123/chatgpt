import { z } from 'zod'

const optionalText = (max: number) => z.string().trim().max(max).optional().nullable()
const optionalUuid = z.string().uuid().optional().nullable()

export const leadInputSchema = z.object({
  name: z.string().trim().min(2).max(160), company_name: optionalText(160), phone: optionalText(40), whatsapp: optionalText(40),
  email: z.string().trim().email().max(254).or(z.literal('')).optional().nullable(), source_id: optionalUuid,
  assigned_user_id: z.string().uuid(), notes: optionalText(2000),
}).strict()

export const contactInputSchema = z.object({
  customer_id: z.string().uuid(), name: z.string().trim().min(2).max(160), job_title: optionalText(120), department: optionalText(120), phone: optionalText(40),
  whatsapp: optionalText(40), email: z.string().trim().email().max(254).or(z.literal('')).optional().nullable(), is_primary: z.boolean().default(false), notes: optionalText(2000),
}).strict()

export const opportunityInputSchema = z.object({
  title: z.string().trim().min(2).max(200), customer_id: z.string().uuid(), contact_id: optionalUuid,
  pipeline_id: z.string().uuid(), stage_id: z.string().uuid(), assigned_user_id: z.string().uuid(), source_id: optionalUuid,
  estimated_value: z.coerce.number().min(0).max(999999999999), estimated_quantity: z.coerce.number().int().min(0).max(10000000),
  temperature: z.enum(['cold','warm','hot']), expected_close_date: optionalText(10), desired_delivery_date: optionalText(10), notes: optionalText(4000),
}).strict()

export const convertLeadSchema = z.object({ lead_id: z.string().uuid(), customer_id: optionalUuid, create_new_customer: z.boolean(), create_contact: z.boolean(), create_opportunity: z.boolean(), opportunity_title: optionalText(200) }).strict()
export const moveStageSchema = z.object({ opportunity_id: z.string().uuid(), stage_id: z.string().uuid(), loss_reason_id: optionalUuid, competitor_name: optionalText(160), notes: optionalText(1000), expected_stage_entered_at: z.string().datetime() }).strict()
export const reopenOpportunitySchema = z.object({ opportunity_id: z.string().uuid(), stage_id: z.string().uuid(), reason: z.string().trim().min(3).max(1000) }).strict()
export const activityInputSchema = z.object({ opportunity_id: z.string().uuid(), contact_id: optionalUuid, type: z.enum(['call','whatsapp','email','meeting','note']), title: z.string().trim().min(2).max(200), description: optionalText(4000), occurred_at: z.string().datetime().optional().nullable() }).strict()
export const taskInputSchema = z.object({ opportunity_id: optionalUuid, customer_id: optionalUuid, contact_id: optionalUuid, type: z.enum(['call','whatsapp','email','meeting','send_quote','follow_up','request_information','collect_deposit','return_contact','other']), title: z.string().trim().min(2).max(200), description: optionalText(2000), due_at: z.string().datetime(), priority: z.enum(['low','normal','high','urgent']) }).strict().refine((value) => value.opportunity_id || value.customer_id, 'Informe a oportunidade ou cliente.')
