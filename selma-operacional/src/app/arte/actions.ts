'use server'
import { enforceRateLimit } from '@/lib/security/rate-limit'
import { createServerSupabaseClient } from '@/lib/supabase/server'
import { z } from 'zod'

export async function respondToArt(action:'approve'|'request_change',input:unknown){
  const parsed=z.object({token:z.string().regex(/^[a-f0-9]{64}$/),name:z.string().trim().min(2).max(120),changeText:z.string().trim().max(1000).nullable()}).strict().safeParse(input)
  if(!parsed.success||(action==='request_change'&&(parsed.data.changeText?.length??0)<3))return{success:false,error:'Preencha os campos obrigatórios.'}
  const limiter=await enforceRateLimit({scope:'public-art-response',identifier:parsed.data.token.slice(0,24),limit:10,windowSeconds:300});if(!limiter.allowed)return{success:false,error:'Muitas tentativas. Aguarde alguns minutos.'}
  const supabase=await createServerSupabaseClient();const {error}=await supabase.rpc(action==='approve'?'approve_art_version':'respond_to_art',action==='approve'?{p_token:parsed.data.token,p_name:parsed.data.name}:{p_token:parsed.data.token,p_action:'request_change',p_name:parsed.data.name,p_change_text:parsed.data.changeText})
  return error?{success:false,error:'Este link expirou, foi substituído ou já recebeu uma resposta.'}:{success:true}
}
