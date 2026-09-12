'use server'

import { revalidatePath } from 'next/cache'
import { z } from 'zod'
import { requirePermission } from '@/lib/auth/require-user'
import { safeDatabaseError } from '@/lib/security/errors'
import { discountDecisionSchema, discountRequestSchema, quoteDraftSchema } from '@/lib/schemas/quotes'
import { createServerSupabaseClient } from '@/lib/supabase/server'

type Result<T=undefined>={success:true;data?:T}|{success:false;error:string}
const fail=(error:unknown,message:string):Result=>({success:false,error:safeDatabaseError(error,message,{action:'quotes'})})
const refresh=(id?:string)=>{revalidatePath('/crm/orcamentos');revalidatePath('/crm');revalidatePath('/crm/analytics');if(id)revalidatePath(`/crm/orcamentos/${id}`)}

export async function saveQuote(id:string|null,input:unknown):Promise<Result<{id:string}>>{
  await requirePermission(id?'quotes.update':'quotes.create')
  const parsed=quoteDraftSchema.safeParse(input)
  if(!parsed.success)return{success:false,error:parsed.error.issues[0]?.message??'Revise o orçamento.'}
  const {items,...payload}=parsed.data
  const supabase=await createServerSupabaseClient()
  const {data,error}=await supabase.rpc('save_quote_draft',{p_quote_id:id,p_payload:payload,p_items:items})
  if(error||!data)return fail(error,'Não foi possível salvar o orçamento.') as Result<{id:string}>
  refresh(String(data));return{success:true,data:{id:String(data)}}
}

export async function requestQuoteApproval(input:unknown):Promise<Result>{
  await requirePermission('quotes.update')
  const parsed=discountRequestSchema.safeParse(input)
  if(!parsed.success)return{success:false,error:'Informe o motivo da condição especial.'}
  const supabase=await createServerSupabaseClient()
  const {error}=await supabase.rpc('request_quote_approval',{p_quote_id:parsed.data.quote_id,p_reason:parsed.data.reason})
  if(error)return fail(error,'Não foi possível solicitar aprovação.')
  refresh(parsed.data.quote_id);return{success:true}
}

export async function decideQuoteApproval(input:unknown):Promise<Result>{
  await requirePermission('quotes.approve')
  const parsed=discountDecisionSchema.safeParse(input)
  if(!parsed.success)return{success:false,error:'Decisão inválida.'}
  const supabase=await createServerSupabaseClient()
  const {error}=await supabase.rpc('decide_quote_approval',{p_approval_id:parsed.data.approval_id,p_approve:parsed.data.approve,p_notes:parsed.data.notes})
  if(error)return fail(error,'Não foi possível registrar a decisão.')
  refresh();return{success:true}
}

export async function sendQuote(id:string):Promise<Result<{token?:string;requiresApproval:boolean}>>{
  await requirePermission('quotes.update')
  const parsed=z.string().uuid().safeParse(id)
  if(!parsed.success)return{success:false,error:'Orçamento inválido.'}
  const supabase=await createServerSupabaseClient()
  const {data,error}=await supabase.rpc('send_quote_version',{p_quote_id:parsed.data})
  if(error)return fail(error,'Não foi possível gerar a proposta.') as Result<{token?:string;requiresApproval:boolean}>
  refresh(id);return{success:true,data:{token:data?.token,requiresApproval:Boolean(data?.requires_approval)}}
}

export async function createQuoteVersion(id:string,validUntil?:string):Promise<Result>{
  await requirePermission('quotes.update')
  const parsed=z.object({id:z.string().uuid(),validUntil:z.string().date().optional()}).strict().safeParse({id,validUntil})
  if(!parsed.success)return{success:false,error:'Informe uma nova validade correta.'}
  const supabase=await createServerSupabaseClient()
  const {error}=await supabase.rpc('create_quote_version',{p_quote_id:parsed.data.id,p_valid_until:parsed.data.validUntil??null})
  if(error)return fail(error,'Não foi possível criar uma nova versão.')
  refresh(id);return{success:true}
}

export async function duplicateQuote(id:string):Promise<Result<{id:string}>>{
  await requirePermission('quotes.create')
  const parsed=z.string().uuid().safeParse(id)
  if(!parsed.success)return{success:false,error:'Orçamento inválido.'}
  const supabase=await createServerSupabaseClient()
  const {data,error}=await supabase.rpc('duplicate_quote',{p_quote_id:parsed.data})
  if(error||!data)return fail(error,'Não foi possível duplicar o orçamento.') as Result<{id:string}>
  refresh(String(data));return{success:true,data:{id:String(data)}}
}

export async function convertQuote(id:string):Promise<Result<{orderId:string}>>{
  await requirePermission('quotes.update');await requirePermission('orders.create')
  const parsed=z.string().uuid().safeParse(id)
  if(!parsed.success)return{success:false,error:'Orçamento inválido.'}
  const supabase=await createServerSupabaseClient()
  const {data,error}=await supabase.rpc('convert_quote_to_order',{p_quote_id:parsed.data})
  if(error||!data)return fail(error,'Não foi possível converter a proposta em pedido.') as Result<{orderId:string}>
  refresh(id);revalidatePath('/pedidos');return{success:true,data:{orderId:String(data)}}
}
