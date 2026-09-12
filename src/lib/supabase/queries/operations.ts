import 'server-only'
import { createAdminSupabaseClient } from '@/lib/supabase/admin'
import { createServerSupabaseClient } from '@/lib/supabase/server'
import type { OrderOperations,ProductionPlan,PublicArt } from '@/types/operations'

const emptyOperations:OrderOperations={available:false,arts:[],technicalSheets:[],requirements:[],plan:null,blockers:[],fabrics:[],purchaseOrders:[]}

export async function getOrderOperations(orderId:string):Promise<OrderOperations>{
  const supabase=await createServerSupabaseClient()
  const [arts,sheets,requirements,plans,fabrics,purchases,blockers]=await Promise.all([
    supabase.from('art_approvals').select('id,order_id,order_item_id,version_number,status,file_path,description,width,height,placement,colors,customer_notes,created_at,sent_at,viewed_at,approved_at,approved_by_name,change_request_text').eq('order_id',orderId).order('version_number',{ascending:false}),
    supabase.from('technical_sheets').select('id,order_id,order_item_id,version,status,product_name,model,fabric,color,customization_type,grade_snapshot,construction_notes,measurement_notes,production_notes,approved_at').eq('order_id',orderId).order('version',{ascending:false}),
    supabase.from('material_requirements').select('*').eq('order_id',orderId),
    supabase.from('production_plans').select('id,order_id,version,status,requested_delivery_date,safe_delivery_date,committed_delivery_date,risk_level,explanation,blocking_reasons,calculated_at').eq('order_id',orderId).order('version',{ascending:false}).limit(1),
    supabase.from('estoque_atual').select('id,codigo,descricao,unidade,estoque_atual').order('descricao'),
    supabase.from('purchase_orders').select('id,number,status,expected_date,items:purchase_order_items(id,fabric_id,quantity,received_quantity,unit,required_for_order_id)').neq('status','cancelled').order('created_at',{ascending:false}).limit(100),
    supabase.rpc('get_order_release_blockers',{p_order_id:orderId}),
  ])
  if(arts.error||sheets.error||requirements.error||plans.error||fabrics.error||purchases.error||blockers.error)return emptyOperations
  let plan=(plans.data?.[0]??null) as unknown as ProductionPlan|null
  if(plan){const {data:route}=await supabase.from('production_routes').select('id,status,steps:production_route_steps(id,position,estimated_quantity,estimated_duration,status,planned_start,planned_end,actual_start,actual_end,workcenter:production_workcenters(id,code,name,capacity_unit,daily_capacity))').eq('production_plan_id',plan.id).maybeSingle();plan={...plan,route:route as never}}
  const purchaseOrders=(purchases.data??[]).map(order=>({...order,items:(order.items??[]).filter((item:{required_for_order_id?:string|null})=>item.required_for_order_id===orderId)})).filter(order=>order.items.length>0)
  const admin=createAdminSupabaseClient()
  const signedArts=await Promise.all((arts.data??[]).map(async art=>{const {data}=await admin.storage.from('pedidos-layouts').createSignedUrl(art.file_path,10*60);return{...art,preview_url:data?.signedUrl??null}}))
  return{available:true,arts:signedArts as never,technicalSheets:(sheets.data??[]) as never,requirements:(requirements.data??[]) as never,plan,blockers:(blockers.data??[]) as never,fabrics:(fabrics.data??[]) as never,purchaseOrders:purchaseOrders as never}
}

export async function getPublicArt(token:string):Promise<PublicArt|null>{
  const supabase=await createServerSupabaseClient();const {data,error}=await supabase.rpc('get_public_art',{p_token:token})
  if(error||!data)return null
  const result=data as unknown as PublicArt
  if(result.unavailable)return result
  const admin=createAdminSupabaseClient();const {data:signed}=await admin.storage.from('pedidos-layouts').createSignedUrl(result.file_path,10*60)
  return{...result,file_path:'',preview_url:signed?.signedUrl??null}
}

export async function getProductionPlanningDashboard(start?:string,end?:string){
  const supabase=await createServerSupabaseClient();const [{data:dashboard,error},{data:plans}]=await Promise.all([
    supabase.rpc('get_pcp_dashboard',{p_start:start??null,p_end:end??null}),
    supabase.from('production_plans').select('id,order_id,version,status,requested_delivery_date,safe_delivery_date,committed_delivery_date,risk_level,blocking_reasons,order:pedidos(id,numero,cliente,entrega_programado,production_released_at,responsible:profiles!pedidos_commercial_assigned_user_id_fkey(full_name))').in('status',['blocked','ready','released','in_progress']).order('safe_delivery_date').limit(200),
  ])
  return error||plans===null?{available:false,dashboard:null,plans:[]}:{available:true,dashboard,plans:plans??[]}
}

export async function getPurchasingWorkspace(){
  const supabase=await createServerSupabaseClient();const [suggestions,orders,suppliers]=await Promise.all([
    supabase.from('purchase_suggestions').select('*').order('suggested_quantity',{ascending:false}),
    supabase.from('purchase_orders').select('id,number,status,expected_date,total,created_at,supplier:suppliers(id,name),items:purchase_order_items(id,fabric_id,description,quantity,received_quantity,unit,unit_cost,total,required_for_order_id)').order('created_at',{ascending:false}).limit(200),
    supabase.from('suppliers').select('*').order('name'),
  ])
  return suggestions.error||orders.error||suppliers.error?{available:false,suggestions:[],orders:[],suppliers:[]}:{available:true,suggestions:suggestions.data??[],orders:orders.data??[],suppliers:suppliers.data??[]}
}

export async function getPreliminarySafeDate(quantity:number,customization:string,requested:string|null){
  const supabase=await createServerSupabaseClient();const {data,error}=await supabase.rpc('calculate_preliminary_safe_delivery_date',{p_quantity:quantity,p_customization:customization,p_requested:requested})
  return error?null:data as {earliest_safe_date:string;risk_level:string;calculation_mode:string;explanation:unknown[]}|null
}
