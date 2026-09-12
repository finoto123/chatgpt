export type CapacityUnit='piece'|'minute'|'point'|'meter'|'hour'
export type OperationalRisk='safe'|'attention'|'high_risk'|'impossible'

const round4=(value:number)=>Math.round((value+Number.EPSILON)*10000)/10000

export function calculateBomRequirement(quantity:number,quantityPerUnit:number,wastePercent:number){
  if(quantity<=0||quantityPerUnit<=0||wastePercent<0||wastePercent>100)throw new Error('Invalid BOM values')
  return round4(quantity*quantityPerUnit*(1+wastePercent/100))
}

export function calculateAvailableStock(physical:number,reserved:number){return Math.max(0,round4(physical-reserved))}

export function calculateReservation(required:number,alreadyReserved:number,available:number){
  const missing=Math.max(0,required-alreadyReserved);const reservedNow=Math.min(missing,Math.max(0,available))
  return{reservedNow:round4(reservedNow),shortage:round4(missing-reservedNow),complete:missing-reservedNow<=0.0001}
}

export function aggregatePurchaseSuggestions(lines:Array<{materialId:string;unit:string;shortage:number;orderId:string}>){
  const grouped=new Map<string,{materialId:string;unit:string;quantity:number;orderIds:Set<string>}>()
  for(const line of lines){if(line.shortage<=0)continue;const key=`${line.materialId}:${line.unit}`;const current=grouped.get(key)??{materialId:line.materialId,unit:line.unit,quantity:0,orderIds:new Set<string>()};current.quantity+=line.shortage;current.orderIds.add(line.orderId);grouped.set(key,current)}
  return[...grouped.values()].map(item=>({materialId:item.materialId,unit:item.unit,quantity:round4(item.quantity),orderIds:[...item.orderIds].sort()}))
}

export function capacityUtilization(planned:number,dailyCapacity:number){if(dailyCapacity<=0)throw new Error('Capacity must be positive');return Math.round(planned/dailyCapacity*1000)/10}

export function addOperationalBusinessDays(start:string,days:number,holidays=new Set<string>(),workingDays=new Set([1,2,3,4,5])){
  if(days<0)throw new Error('Days must be nonnegative');const date=new Date(`${start}T12:00:00Z`);let added=0
  while(added<days){date.setUTCDate(date.getUTCDate()+1);const iso=date.toISOString().slice(0,10);if(workingDays.has(date.getUTCDay())&&!holidays.has(iso))added++}
  return date.toISOString().slice(0,10)
}

export function deriveRouting(customization:string){const value=customization.toLowerCase();if(value.includes('sublim'))return['sublimation','cut','sewing','finishing','dispatch'];if(value.includes('bord'))return['cut','embroidery','sewing','finishing','dispatch'];if(value.includes('dtf'))return['cut','dtf','sewing','finishing','dispatch'];return['cut','sewing','finishing','dispatch']}

export function calculateDeterministicSafeDate(input:{today:string;requested?:string|null;artRequired:boolean;artApproved:boolean;materialAvailableDate?:string|null;uncoveredShortage?:boolean;steps:Array<{name:string;durationDays:number;queueDays?:number}>;safetyBufferDays:number;holidays?:Set<string>}){
  const blockers:Array<{code:string;label:string}>=[];const explanation:Array<{area:string;status:'ok'|'attention'|'blocked';detail:string}>=[];const holidays=input.holidays??new Set<string>()
  if(input.artRequired&&!input.artApproved){blockers.push({code:'art_pending',label:'Arte pendente'});explanation.push({area:'Arte',status:'blocked',detail:'Aprovação do cliente pendente'})}else explanation.push({area:'Arte',status:'ok',detail:'Aprovação concluída ou dispensada'})
  if(input.uncoveredShortage){blockers.push({code:'material_shortage',label:'Material sem cobertura'});explanation.push({area:'Materiais',status:'blocked',detail:'Existe falta sem compra confirmada'})}
  let cursor=input.materialAvailableDate&&input.materialAvailableDate>input.today?input.materialAvailableDate:input.today
  for(const step of input.steps){const queue=Math.max(0,step.queueDays??0);cursor=addOperationalBusinessDays(cursor,queue+Math.max(1,Math.ceil(step.durationDays)),holidays);explanation.push({area:step.name,status:queue>0?'attention':'ok',detail:queue>0?`Fila adiciona ${queue} dia(s)`:`${Math.max(1,Math.ceil(step.durationDays))} dia(s) planejado(s)`})}
  const safeDate=addOperationalBusinessDays(cursor,Math.max(0,input.safetyBufferDays),holidays);let risk:OperationalRisk
  if(blockers.length)risk='impossible';else if(!input.requested||safeDate<=input.requested)risk='safe';else if(safeDate<=addOperationalBusinessDays(input.requested,2,holidays))risk='attention';else risk='high_risk'
  return{earliestSafeDate:safeDate,riskLevel:risk,explanation,blockingReasons:blockers}
}
