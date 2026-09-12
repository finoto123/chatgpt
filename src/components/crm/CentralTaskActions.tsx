'use client'
import { useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { toast } from 'sonner'
import { finishTask, rescheduleTask } from '@/app/crm/actions'
export function CentralTaskActions({taskId}:{taskId:string}){const router=useRouter();const [pending,startTransition]=useTransition();const complete=()=>startTransition(async()=>{const r=await finishTask(taskId);if(!r.success)toast.error(r.error);else{toast.success('Tarefa concluída.');router.refresh()}});const reschedule=()=>{const value=prompt('Nova data e hora (AAAA-MM-DD HH:mm):');if(!value)return;const date=new Date(value);if(Number.isNaN(date.getTime())){toast.error('Data inválida.');return}startTransition(async()=>{const r=await rescheduleTask(taskId,date.toISOString());if(!r.success)toast.error(r.error);else{toast.success('Tarefa reagendada.');router.refresh()}})};return <span className="flex gap-1"><button disabled={pending} onClick={complete} className="rounded border px-2 py-1 text-[11px] text-green-600">Concluir</button><button disabled={pending} onClick={reschedule} className="rounded border px-2 py-1 text-[11px]">Reagendar</button></span>}
