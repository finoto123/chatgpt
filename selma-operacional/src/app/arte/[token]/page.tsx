import { notFound } from 'next/navigation'
import { z } from 'zod'
import { PublicArtApproval } from '@/components/operations/PublicArtApproval'
import { getPublicArt } from '@/lib/supabase/queries/operations'
import { createServerSupabaseClient } from '@/lib/supabase/server'

export default async function PublicArtPage({params}:{params:Promise<{token:string}>}){const {token}=await params;const parsed=z.string().regex(/^[a-f0-9]{64}$/).safeParse(token);if(!parsed.success)notFound();const art=await getPublicArt(parsed.data);if(!art)notFound();if(art.unavailable)return <main className="flex min-h-screen items-center justify-center bg-zinc-950 p-4 text-white"><div className="max-w-md rounded-2xl border border-white/10 bg-white/5 p-8 text-center"><p className="text-sm text-amber-400">ARTE INDISPONÍVEL</p><h1 className="mt-2 text-2xl font-semibold">{art.reason==='newer_version'?'Existe uma versão mais recente.':'Este link expirou.'}</h1><p className="mt-3 text-zinc-400">Solicite o link atualizado ao responsável comercial.</p></div></main>;const supabase=await createServerSupabaseClient();await supabase.rpc('record_art_view',{p_token:parsed.data});return <PublicArtApproval art={art} token={parsed.data}/>}
