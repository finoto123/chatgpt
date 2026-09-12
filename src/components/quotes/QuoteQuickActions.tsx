'use client'

import Link from 'next/link'
import { useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { Copy,FileClock,Loader2 } from 'lucide-react'
import { toast } from 'sonner'
import { createQuoteVersion,duplicateQuote } from '@/app/crm/orcamentos/actions'
import { Button } from '@/components/ui/button'

export function QuoteQuickActions({id,status,canCreate,canUpdate}:{id:string;status:string;canCreate:boolean;canUpdate:boolean}){
  const router=useRouter();const [pending,start]=useTransition();const versionable=['sent','viewed','change_requested','approved','rejected','expired'].includes(status)
  const runVersion=()=>start(async()=>{const result=await createQuoteVersion(id);if(!result.success)toast.error(result.error);else{toast.success('Nova versão criada.');router.push(`/crm/orcamentos/${id}`);router.refresh()}})
  const runDuplicate=()=>start(async()=>{const result=await duplicateQuote(id);if(!result.success)toast.error(result.error);else if(result.data){toast.success('Orçamento duplicado.');router.push(`/crm/orcamentos/${result.data.id}`)}})
  return <div className="flex flex-wrap items-center gap-1"><Link className="crm-focus rounded-md px-2 py-1 text-xs font-medium text-green-600 hover:bg-green-500/10 dark:text-green-400" href={`/crm/orcamentos/${id}`}>Abrir</Link>{canUpdate&&versionable&&<Button type="button" variant="ghost" size="xs" disabled={pending} onClick={runVersion}>{pending?<Loader2 className="animate-spin"/>:<FileClock/>}Criar versão</Button>}{canCreate&&<Button type="button" variant="ghost" size="xs" disabled={pending} onClick={runDuplicate}><Copy/>Duplicar</Button>}</div>
}
