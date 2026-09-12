'use client'

import Link from 'next/link'
import { useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { Loader2, Sparkles, UsersRound } from 'lucide-react'
import { toast } from 'sonner'
import { createReactivationTasks } from '@/app/crm/intelligence-actions'
import { formatBRL, formatDate } from '@/lib/utils'
import type { ReactivationData, ReactivationCustomer } from '@/types/commercial'
import type { CrmProfile } from '@/types/crm'
import { EmptyState, SectionCard } from './CrmUi'

const segments=[['?mode=inactive&days=90','90 dias'],['?mode=inactive&days=180','180 dias'],['?mode=inactive&days=365','365 dias'],['?mode=no_orders','Sem pedido'],['?mode=recompra','Recompra prevista'],['?mode=high_ticket','Alto ticket']] as const

export function ReactivationClient({data,profiles,params}:{data:ReactivationData;profiles:CrmProfile[];params:{mode:string;days:number;minTicket:number}}){
  const router=useRouter();const [selected,setSelected]=useState<string[]>([]);const [assigned,setAssigned]=useState(profiles[0]?.id??'');const [due,setDue]=useState('');const [pending,startTransition]=useTransition()
  function create(){startTransition(async()=>{const result=await createReactivationTasks({customer_ids:selected,assigned_user_id:assigned,due_at:new Date(due).toISOString(),title:'Contato de reativação comercial'});if(result.success){toast.success(`${result.data?.count??0} tarefas criadas.`);setSelected([]);router.refresh()}else toast.error(result.error)})}
  const active=(href:string)=>{const url=new URL(href,'https://local');const mode=url.searchParams.get('mode');const days=Number(url.searchParams.get('days'));return params.mode===mode&&(mode!=='inactive'||params.days===days)}
  return <div className="space-y-4">
    <div className="flex flex-wrap items-center gap-2">{segments.map(([href,label])=><Link key={href} href={href} className={`crm-focus rounded-full border px-3 py-2 text-sm transition-colors ${active(href)?'border-green-600 bg-green-500/10 text-green-600 dark:text-green-400':'hover:bg-surface-hover'}`}>{label}</Link>)}<form className="ml-auto flex flex-wrap gap-2"><input type="hidden" name="mode" value={params.mode}/>{params.mode==='inactive'&&<label className="sr-only">Dias sem comprar<input name="days" type="number" min="1" defaultValue={params.days}/></label>}{params.mode==='high_ticket'&&<label className="flex items-center gap-2 text-xs text-muted">Ticket mínimo<input name="minTicket" type="number" min="0" defaultValue={params.minTicket} className="crm-control w-36"/></label>}<button className="crm-focus h-10 rounded-lg border px-3 text-sm hover:bg-surface-hover">Aplicar</button></form></div>

    <SectionCard title="Clientes sugeridos" description={`${data.total} clientes encontrados com base no histórico real de pedidos.`}>
      <div className="overflow-x-auto"><table className="crm-table"><thead><tr>{['','Cliente','Pedidos','Última compra','Último contato','Responsável','Potencial','Razão da sugestão'].map(header=><th key={header}>{header}</th>)}</tr></thead><tbody>{data.items.map(customer=><tr key={customer.id}><td><input aria-label={`Selecionar ${customer.nome}`} type="checkbox" checked={selected.includes(customer.id)} onChange={event=>setSelected(current=>event.target.checked?[...current,customer.id]:current.filter(id=>id!==customer.id))}/></td><td><strong className="block font-medium">{customer.nome}</strong><span className="text-xs text-muted">{customer.contato||customer.email||'Sem contato'}</span></td><td>{customer.order_count}</td><td className="whitespace-nowrap">{formatDate(customer.last_order_date)}</td><td className="whitespace-nowrap">{formatDate(customer.last_contact_at)}</td><td>{customer.responsible_name||'Não atribuído'}</td><td className="whitespace-nowrap font-medium">{potential(customer,params.mode)}</td><td><span className="inline-flex max-w-56 rounded-lg bg-surface-hover px-2.5 py-1.5 text-xs">{reason(customer,params)}</span></td></tr>)}{!data.items.length&&<tr><td colSpan={8} className="p-0"><EmptyState icon={<UsersRound size={21}/>} title="Nenhum cliente neste segmento" description="Altere o período ou escolha outro segmento de reativação."/></td></tr>}</tbody></table></div>
    </SectionCard>

    <div className="crm-card sticky bottom-3 z-10 flex flex-col gap-3 p-4 shadow-lg lg:flex-row lg:items-end"><div className="mr-auto"><p className="font-medium"><strong>{selected.length}</strong> selecionados</p><p className="text-xs text-muted">Crie tarefas internas para organizar a abordagem.</p></div><label className="text-xs text-muted">Atribuir vendedor<select value={assigned} onChange={event=>setAssigned(event.target.value)} className="crm-control mt-1 min-w-48">{profiles.map(profile=><option key={profile.id} value={profile.id}>{profile.full_name}</option>)}</select></label><label className="text-xs text-muted">Definir vencimento<input type="datetime-local" value={due} onChange={event=>setDue(event.target.value)} className="crm-control mt-1"/></label><button disabled={!selected.length||!assigned||!due||pending} onClick={create} className="crm-focus flex h-10 items-center justify-center gap-2 rounded-lg bg-green-600 px-4 text-sm font-medium text-white disabled:opacity-50">{pending?<Loader2 className="animate-spin" size={15}/>:<Sparkles size={15}/>}Criar tarefas</button></div>
  </div>
}

function potential(customer:ReactivationCustomer,mode:string){if(mode==='high_ticket')return customer.avg_ticket==null?'—':formatBRL(Number(customer.avg_ticket));if(mode==='no_orders')return 'A desenvolver';return formatBRL(Number(customer.avg_ticket??customer.total_value))}
function reason(customer:ReactivationCustomer,params:{mode:string;days:number;minTicket:number}){if(params.mode==='no_orders')return 'Cliente ainda sem pedido';if(params.mode==='recompra')return `Recompra prevista para ${formatDate(customer.predicted_repurchase_date)}`;if(params.mode==='high_ticket')return `Ticket médio acima de ${formatBRL(params.minTicket)}`;if(!customer.last_order_date)return 'Sem compra registrada';const days=Math.max(0,Math.floor((Date.now()-new Date(`${customer.last_order_date}T12:00:00`).getTime())/86_400_000));return `${days} dias sem comprar`}
