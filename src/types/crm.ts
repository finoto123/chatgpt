export type LeadStatus = 'new' | 'working' | 'qualified' | 'converted' | 'disqualified'
export type OpportunityStatus = 'open' | 'won' | 'lost' | 'archived'
export type Temperature = 'cold' | 'warm' | 'hot'
export type TaskStatus = 'pending' | 'completed' | 'cancelled'

export interface CrmProfile { id: string; full_name: string }
export interface CrmCustomer { id: string; nome: string; contato?: string | null; email?: string | null }
export interface LeadSource { id: string; code: string; name: string }
export interface PipelineStage { id: string; pipeline_id: string; code: string; name: string; position: number; probability: number; is_won: boolean; is_lost: boolean }
export interface LossReason { id: string; code: string; name: string }
export interface CrmContact { id: string; customer_id: string; name: string; job_title: string | null; department?: string | null; phone: string | null; whatsapp: string | null; email: string | null; is_primary: boolean; active: boolean }
export interface CrmTag { id: string; name: string; color: string }

export interface Lead {
  id: string; name: string; company_name: string | null; phone: string | null; whatsapp: string | null; email: string | null
  source_id: string | null; assigned_user_id: string; status: LeadStatus; notes: string | null; created_at: string; updated_at: string
  source?: LeadSource | null; assigned?: CrmProfile | null
}

export interface Opportunity {
  id: string; title: string; customer_id: string; contact_id: string | null; pipeline_id: string; stage_id: string
  assigned_user_id: string; source_id: string | null; estimated_value: number; final_value: number | null; estimated_quantity: number
  temperature: Temperature; score: number; expected_close_date: string | null; desired_delivery_date: string | null
  calculated_temperature?: Temperature; temperature_override?: Temperature | null; score_updated_at?: string | null; score_breakdown?: Array<{code:string;label:string;points:number}>
  stage_entered_at: string; last_activity_at: string | null; next_activity_at: string | null; status: OpportunityStatus
  loss_reason_id: string | null; competitor_name: string | null; notes: string | null; created_at: string
  customer?: CrmCustomer | null; contact?: CrmContact | null; assigned?: CrmProfile | null; stage?: PipelineStage | null
  source?: LeadSource | null; opportunity_tags?: Array<{ tags: CrmTag | null }>
}

export interface CrmActivity { id: string; type: string; title: string; description: string | null; occurred_at: string; user?: CrmProfile | null; metadata?: Record<string, unknown> }
export interface CrmTask { id: string; opportunity_id: string | null; customer_id: string | null; contact_id: string | null; assigned_user_id: string; type: string; title: string; description: string | null; due_at: string; priority: 'low' | 'normal' | 'high' | 'urgent'; status: TaskStatus; completed_at: string | null; opportunity?: Pick<Opportunity, 'id' | 'title'> | null; customer?: CrmCustomer | null }
export interface CrmDashboard { open_opportunities: number; pipeline_value: number; weighted_pipeline: number; overdue_tasks: number; without_next_action: number; won_month: number; lost_month: number }
