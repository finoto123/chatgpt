export interface CommercialAttention { overdue_tasks:number; today_tasks:number; new_leads:number; hot_opportunities:number; without_next_action:number; stale:number; waiting_approval_value:number }
export interface CommercialPriority { id:string; title:string; customer_name:string; score:number; estimated_value:number; expected_close_date:string|null; temperature:string; priority_score:number; reason:string }
export interface CommercialTask { id:string; title:string; type:string; priority:string; due_at:string; opportunity_id:string|null; opportunity_title:string|null; customer_name:string|null }
export interface ClosingSoon { id:string; title:string; customer_name:string; estimated_value:number; score:number; expected_close_date:string }
export interface CommercialCentralData { attention:CommercialAttention; priorities:CommercialPriority[]; tasks:CommercialTask[]; closing_soon:ClosingSoon[] }

export interface AnalyticsSummary { created:number; open:number; won:number; lost:number; won_value:number; conversion_rate:number|null; avg_ticket:number|null; avg_cycle_days:number|null; avg_first_contact_hours:number|null }
export interface FunnelMetric { id:string; name:string; position:number; probability:number; count:number; value:number; weighted:number; stale:number; reached:number; avg_days:number|null; median_days:number|null }
export interface SellerMetric { id:string; full_name:string; open_count:number; pipeline:number; weighted:number; won_count:number; won_value:number; lost_count:number; conversion_rate:number|null; avg_ticket:number|null; avg_cycle_days:number|null; overdue_tasks:number; without_next_action:number; portfolio_customers:number; customers_without_recent_contact:number }
export interface SourceMetric { id:string; name:string; leads:number; opportunities:number; won:number; conversion_rate:number|null; won_value:number; avg_ticket:number|null; avg_cycle_days:number|null; pipeline:number }
export interface RankedLoss { name:string; count:number; lost_value:number }
export interface RevenueTrendPoint { period:string; label:string; value:number }
export interface CommercialAnalyticsData { method:string; summary:AnalyticsSummary; funnel:FunnelMetric[]; sellers:SellerMetric[]; sources:SourceMetric[]; losses:RankedLoss[]; competitors:RankedLoss[]; comparison:{current_won_value:number;previous_won_value:number;change_percent:number|null}; revenue_trend:RevenueTrendPoint[] }

export interface ForecastSeller { id:string; full_name:string; pipeline:number; weighted:number; forecast:number; target:number; won:number }
export interface ForecastData { pipeline_total:number; pipeline_weighted:number; forecast_closing:number; company_target:number; company_won:number; by_seller:ForecastSeller[] }
export interface ReactivationCustomer { id:string; nome:string; contato:string|null; email:string|null; order_count:number; last_order_date:string|null; total_value:number; avg_ticket:number|null; avg_interval_days:number|null; predicted_repurchase_date:string|null; last_contact_at?:string|null; responsible_name?:string|null }
export interface ReactivationData { items:ReactivationCustomer[]; total:number; mode:string; days:number }

export interface CommercialSettings { id:boolean; stale_opportunity_days:number; follow_up_default_days:number; second_follow_up_days:number; third_alert_days:number; warm_lead_threshold:number; hot_lead_threshold:number; use_business_days:boolean; minimum_margin_percent:number; default_quote_validity_days:number; discount_limits:{salesperson:number;commercial:number;manager:number;administrator:number}; require_margin_approval:boolean }
export interface ScoringRule { id:string; code:string; name:string; points:number; active:boolean; exclusive_group:string|null; threshold:number|null; position:number }
export interface AutomationRule { id:string; name:string; event:string; conditions:Record<string,unknown>; action_type:string; action_config:Record<string,unknown>; active:boolean }
export interface SalesTarget { id:string; user_id:string|null; target_type:string; period_start:string; period_end:string; target_value:number; realized_value?:number; user?:{id:string;full_name:string}|null }
export interface SavedView { id:string; module:string; name:string; filters:Record<string,string>; is_default:boolean }
export interface CommercialNotification { id:string; type:string; title:string; body:string|null; entity_type:string|null; entity_id:string|null; read_at:string|null; created_at:string }
