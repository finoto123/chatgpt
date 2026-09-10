export type Temperature = 'cold' | 'warm' | 'hot'
export type OpportunityHealth = 'healthy' | 'attention' | 'critical'

export interface ScoreRule { code: string; name: string; points: number; active: boolean; exclusiveGroup?: string | null; threshold?: number }
export interface ScoreSignals { company: boolean; phone: boolean; email: boolean; quantity: number; desiredDate: boolean; stage: 'other'|'quote'|'negotiation'|'waiting_approval'; existingCustomer: boolean; hasOrders: boolean; inactivityDays: number; recentActivity: boolean; hasFutureTask: boolean; hasOverdueTask: boolean }

export function calculateScore(signals: ScoreSignals, rules: ScoreRule[]) {
  const applied: Array<{ code: string; label: string; points: number }> = []
  const rule = (code: string) => rules.find((item) => item.code === code && item.active)
  const apply = (code: string) => { const item=rule(code); if(item){applied.push({code,label:item.name,points:item.points})} }
  if(signals.company)apply('company_present'); if(signals.phone)apply('valid_phone'); if(signals.email)apply('email_present')
  const quantityRule=rules.filter((item)=>item.active&&item.exclusiveGroup==='quantity'&&(item.threshold??Infinity)<=signals.quantity).sort((a,b)=>(b.threshold??0)-(a.threshold??0))[0]; if(quantityRule)applied.push({code:quantityRule.code,label:quantityRule.name,points:quantityRule.points})
  if(signals.desiredDate)apply('desired_date')
  if(signals.stage==='waiting_approval')apply('stage_waiting_approval'); else if(signals.stage==='negotiation')apply('stage_negotiation'); else if(signals.stage==='quote')apply('stage_quote')
  if(signals.existingCustomer)apply('existing_customer'); if(signals.hasOrders)apply('customer_has_orders'); if(signals.recentActivity)apply('recent_activity')
  const inactivityRule=rules.filter((item)=>item.active&&item.exclusiveGroup==='inactivity'&&(item.threshold??Infinity)<=signals.inactivityDays).sort((a,b)=>(b.threshold??0)-(a.threshold??0))[0]; if(inactivityRule)applied.push({code:inactivityRule.code,label:inactivityRule.name,points:inactivityRule.points})
  if(!signals.hasFutureTask)apply('without_next_action'); if(signals.hasOverdueTask)apply('overdue_task')
  return { score: Math.min(100,Math.max(0,applied.reduce((sum,item)=>sum+item.points,0))), breakdown: applied }
}

export function temperatureForScore(score:number,warmThreshold=31,hotThreshold=61):Temperature{return score>=hotThreshold?'hot':score>=warmThreshold?'warm':'cold'}
export function effectiveTemperature(calculated:Temperature,override?:Temperature|null):Temperature{return override??calculated}
export function opportunityHealth(input:{status:string;hasOverdueTask:boolean;inactivityDays:number;staleDays:number;hasFutureTask:boolean;expectedCloseDate?:string|null;today:string}):OpportunityHealth{if(input.status!=='open')return'healthy';const closeOverdue=Boolean(input.expectedCloseDate&&input.expectedCloseDate<input.today);if(input.hasOverdueTask||(input.inactivityDays>=input.staleDays*2&&!input.hasFutureTask)||closeOverdue)return'critical';if(input.inactivityDays>=input.staleDays||!input.hasFutureTask)return'attention';return'healthy'}
export function dataQualityWarnings(input:{phone?:string|null;assignedUserId?:string|null;value:number;quantity:number;expectedCloseDate?:string|null;hasFutureTask:boolean}){return [!input.phone&&'Sem telefone',!input.assignedUserId&&'Sem responsável',input.value<=0&&'Sem valor',input.quantity<=0&&'Sem quantidade',!input.expectedCloseDate&&'Sem prazo',!input.hasFutureTask&&'Sem próxima ação'].filter(Boolean) as string[]}
export function addBusinessDays(date:Date,days:number,holidayDates=new Set<string>()){const result=new Date(date);let remaining=Math.max(0,days);while(remaining){result.setDate(result.getDate()+1);const iso=result.toISOString().slice(0,10);if(result.getDay()!==0&&result.getDay()!==6&&!holidayDates.has(iso))remaining--}return result}
export function weightedForecast(items:Array<{value:number;probability:number}>){return items.reduce((sum,item)=>sum+Math.max(0,item.value)*Math.min(100,Math.max(0,item.probability))/100,0)}
export function targetProgress(won:number,target:number){const safeTarget=Math.max(0,target);return{won,gap:Math.max(0,safeTarget-won),percent:safeTarget===0?null:Math.round(won/safeTarget*1000)/10}}
export function conversionRate(won:number,lost:number){const closed=won+lost;return closed===0?null:Math.round(won/closed*1000)/10}
export function averageCycleDays(items:Array<{createdAt:string;wonAt:string}>){if(!items.length)return null;return items.reduce((sum,item)=>sum+(new Date(item.wonAt).getTime()-new Date(item.createdAt).getTime())/86400000,0)/items.length}
