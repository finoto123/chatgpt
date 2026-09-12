'use client'

import Link from 'next/link'
import { useRouter, useSearchParams } from 'next/navigation'
import { useEffect, useState, useTransition } from 'react'
import { CalendarClock, CircleDollarSign, GripVertical, Loader2, Plus, UserRound } from 'lucide-react'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { usePermission } from '@/components/providers/AuthorizationProvider'
import { createOpportunity, moveOpportunityStage } from '@/app/crm/actions'
import { winOpportunity } from '@/app/crm/intelligence-actions'
import { daysInStage } from '@/lib/domain/crm'
import { formatBRL, formatDate } from '@/lib/utils'
import { createClient } from '@/lib/supabase/client'
import type { CrmContact, CrmCustomer, CrmProfile, CrmTag, LeadSource, LossReason, Opportunity, PipelineStage } from '@/types/crm'
import { EmptyState, HealthBadge, TemperatureBadge } from './CrmUi'

type Pipeline = { id: string; code: string; name: string; is_default: boolean }
type Props = { opportunities: Opportunity[]; stages: PipelineStage[]; pipelines: Pipeline[]; reasons: LossReason[]; sources: LeadSource[]; profiles: CrmProfile[]; customers: CrmCustomer[]; contacts: CrmContact[]; tags: CrmTag[]; defaultUserId: string; initialCustomerId?: string }
const control = 'w-full rounded-lg border px-3 py-2 text-sm outline-none focus:ring-1 focus:ring-green-500 bg-transparent'

export function CrmKanban({ opportunities, stages, pipelines, reasons, sources, profiles, customers, contacts, defaultUserId, initialCustomerId }: Props) {
  const canCreate = usePermission('crm.create')
  const canUpdate = usePermission('crm.update')
  const router = useRouter()
  const queryCustomer=useSearchParams().get('customer')??undefined
  const selectedCustomer=initialCustomerId??queryCustomer
  const [pending, startTransition] = useTransition()
  const [dragged, setDragged] = useState<Opportunity | null>(null)
  const [dropTargetId, setDropTargetId] = useState<string | null>(null)
  const [loss, setLoss] = useState<{ opportunity: Opportunity; stage: PipelineStage } | null>(null)
  const [win, setWin] = useState<Opportunity | null>(null)
  const [newOpen, setNewOpen] = useState(Boolean(selectedCustomer))
  const [staleDays,setStaleDays]=useState(7)
  useEffect(()=>{if(!process.env.NEXT_PUBLIC_SUPABASE_URL)return;createClient().from('commercial_settings').select('stale_opportunity_days').single().then(({data})=>{if(data)setStaleDays(Number(data.stale_opportunity_days))})},[])
  const pipeline = pipelines.find((item) => item.is_default) ?? pipelines[0]
  const visibleStages = stages.filter((stage) => stage.pipeline_id === pipeline?.id)

  function move(opportunity: Opportunity, stage: PipelineStage, extra?: { lossReasonId?: string; competitor?: string; notes?: string }) {
    startTransition(async () => {
      const result = await moveOpportunityStage({ opportunity_id: opportunity.id, stage_id: stage.id, loss_reason_id: extra?.lossReasonId || null, competitor_name: extra?.competitor || null, notes: extra?.notes || null, expected_stage_entered_at: opportunity.stage_entered_at })
      if (!result.success) toast.error(result.error)
      else { toast.success(stage.is_won ? 'Oportunidade marcada como ganha.' : stage.is_lost ? 'Perda registrada.' : 'Etapa atualizada.'); setLoss(null); router.refresh() }
    })
  }

  function drop(stage: PipelineStage) {
    if (!dragged || !canUpdate || dragged.stage_id === stage.id) return
    if (stage.is_lost) setLoss({ opportunity: dragged, stage })
    else if (stage.is_won) setWin(dragged)
    else move(dragged, stage)
    setDragged(null)
    setDropTargetId(null)
  }

  return <>
    <div className="flex flex-col justify-between gap-3 sm:flex-row sm:items-center">
      <div><h2 className="text-lg font-semibold">Pipeline {pipeline?.name}</h2><p className="text-xs text-muted">Arraste os cards para atualizar a etapa.</p></div>
      {canCreate && <Button className="h-10" onClick={() => setNewOpen(true)}><Plus />Nova oportunidade</Button>}
    </div>
    <div className="flex snap-x gap-3 overflow-x-auto scroll-smooth pb-4 items-start" aria-label={`Pipeline ${pipeline?.name ?? ''}`}>
      {visibleStages.map((stage) => {
        const cards = opportunities.filter((opportunity) => opportunity.stage_id === stage.id)
        const total = cards.reduce((sum, item) => sum + Number(item.estimated_value), 0)
        const highlighted=dropTargetId===stage.id&&dragged?.stage_id!==stage.id
        return <section key={stage.id} className={`w-80 shrink-0 snap-start rounded-xl border transition-[border-color,background-color,box-shadow] ${highlighted?'border-green-500 bg-green-500/5 shadow-lg':''}`} style={!highlighted?{ background: 'var(--card-bg)', borderColor: 'var(--border-color)' }:undefined} onDragOver={(event) => {if(canUpdate){event.preventDefault();setDropTargetId(stage.id)}}} onDragLeave={(event)=>{if(!event.currentTarget.contains(event.relatedTarget as Node))setDropTargetId(null)}} onDrop={() => drop(stage)}>
          <header className="border-b p-3.5" style={{ borderColor: 'var(--border-color)' }}>
            <div className="flex items-center justify-between gap-2"><strong className="truncate text-sm">{stage.name}</strong><span className="rounded-full bg-surface-hover px-2 py-0.5 text-xs font-medium">{cards.length}</span></div>
            <div className="mt-1.5 flex justify-between text-xs text-muted"><span className="font-medium text-foreground">{formatBRL(total)}</span><span>{stage.probability}% prob.</span></div>
          </header>
          <div className="min-h-36 space-y-2 p-2.5">
            {cards.map((opportunity) => {const overdue=Boolean(opportunity.next_activity_at&&new Date(opportunity.next_activity_at)<new Date());const stale=Math.floor((Date.now()-new Date(opportunity.last_activity_at??opportunity.created_at).getTime())/86400000);return <article key={opportunity.id} draggable={canUpdate && opportunity.status === 'open'} onDragStart={() => setDragged(opportunity)} onDragEnd={()=>{setDragged(null);setDropTargetId(null)}} className={`crm-card-interactive rounded-xl border p-3.5 shadow-sm ${canUpdate&&opportunity.status==='open'?'cursor-grab active:cursor-grabbing':''} ${dragged?.id===opportunity.id?'scale-[.98] opacity-50':''}`} style={{ background: 'var(--bg-surface)', borderColor: 'var(--border-color)' }}>
              <Link href={`/crm/oportunidades/${opportunity.id}`} className="block">
                <div className="flex gap-2 justify-between"><div className="min-w-0"><strong className="block truncate text-sm">{opportunity.customer?.nome ?? 'Cliente'}</strong><p className="mt-0.5 line-clamp-2 text-xs text-muted">{opportunity.title}</p></div>{canUpdate && <GripVertical size={16} aria-label="Arrastar oportunidade" className="text-muted shrink-0" />}</div>
                <p className="mt-3 flex items-baseline gap-1.5 font-semibold"><CircleDollarSign size={14} className="text-green-600"/>{formatBRL(Number(opportunity.estimated_value))}<span className="text-xs font-normal text-muted">· {opportunity.estimated_quantity} peças</span></p>
                <div className="mt-2.5 flex flex-wrap gap-1.5"><TemperatureBadge value={opportunity.temperature} score={opportunity.score}/>{overdue?<HealthBadge kind="danger" label="Tarefa atrasada"/>:!opportunity.next_activity_at?<HealthBadge kind="warning" label="Sem próxima ação"/>:null}{stale>=staleDays&&opportunity.status==='open'&&<HealthBadge kind="warning" label={`Parada há ${stale} dias`}/>}</div>
                <div className="mt-3 flex items-center justify-between gap-2 border-t pt-2.5 text-[11px] text-muted" style={{borderColor:'var(--border-subtle)'}}><span className="flex min-w-0 items-center gap-1 truncate"><UserRound size={12}/>{opportunity.assigned?.full_name ?? 'Não informado'}</span><span>{daysInStage(opportunity.stage_entered_at)} dias</span></div>
                <p className={`mt-2 flex items-center gap-1 text-[11px] ${overdue?'text-rose-600 dark:text-rose-400':'text-muted'}`}><CalendarClock size={12}/>{opportunity.next_activity_at ? `${overdue?'Atrasada · ':''}${formatDate(opportunity.next_activity_at)}` : 'Próxima ação não definida'}</p>
              </Link>
            </article>})}
            {!cards.length && <EmptyState title="Etapa vazia" description="Arraste uma oportunidade para esta etapa."/>}
          </div>
        </section>
      })}
    </div>
    <LossDialog open={Boolean(loss)} reasons={reasons} pending={pending} onClose={() => setLoss(null)} onConfirm={(reasonId, competitor, notes) => loss && move(loss.opportunity, loss.stage, { lossReasonId: reasonId, competitor, notes })}/>
    <WinDialog opportunity={win} pending={pending} onClose={()=>setWin(null)} onConfirm={(value,date,notes)=>win&&startTransition(async()=>{const result=await winOpportunity({opportunity_id:win.id,final_value:value,closed_at:new Date(date).toISOString(),notes:notes||null,expected_stage_entered_at:win.stage_entered_at});if(!result.success)toast.error(result.error);else{toast.success('Oportunidade marcada como ganha.');setWin(null);router.refresh()}})}/>
    <NewOpportunityDialog open={newOpen} onClose={() => setNewOpen(false)} pipeline={pipeline} stages={visibleStages} customers={customers} contacts={contacts} profiles={profiles} sources={sources} defaultUserId={defaultUserId} initialCustomerId={selectedCustomer}/>
    {pending && <div className="fixed bottom-5 right-5 rounded-lg bg-green-600 text-white px-3 py-2 text-sm flex gap-2"><Loader2 className="animate-spin"/>Salvando</div>}
  </>
}

function WinDialog({opportunity,pending,onClose,onConfirm}:{opportunity:Opportunity|null;pending:boolean;onClose:()=>void;onConfirm:(value:number,date:string,notes:string)=>void}){const [value,setValue]=useState('');const [date,setDate]=useState('');const [notes,setNotes]=useState('');const open=Boolean(opportunity);return <Dialog open={open} onOpenChange={v=>!v&&onClose()}><DialogContent><DialogHeader><DialogTitle>Confirmar oportunidade ganha</DialogTitle></DialogHeader><label className="text-xs">Valor final *<input type="number" min="0" step="0.01" className={`${control} mt-1`} value={value||String(opportunity?.estimated_value??'')} onChange={e=>setValue(e.target.value)}/></label><label className="text-xs">Data do fechamento *<input type="datetime-local" max={new Date().toISOString().slice(0,16)} className={`${control} mt-1`} value={date} onChange={e=>setDate(e.target.value)}/></label><label className="text-xs">Observações<textarea className={`${control} mt-1`} rows={3} value={notes} onChange={e=>setNotes(e.target.value)}/></label><div className="flex justify-end gap-2"><Button variant="ghost" onClick={onClose}>Cancelar</Button><Button disabled={pending||!date||Number(value||opportunity?.estimated_value)<0} onClick={()=>onConfirm(Number(value||opportunity?.estimated_value),date,notes)}>Confirmar ganho</Button></div></DialogContent></Dialog>}

function LossDialog({ open, reasons, pending, onClose, onConfirm }: { open: boolean; reasons: LossReason[]; pending: boolean; onClose: () => void; onConfirm: (reason: string, competitor: string, notes: string) => void }) {
  const [reason, setReason] = useState(''); const [competitor, setCompetitor] = useState(''); const [notes, setNotes] = useState('')
  return <Dialog open={open} onOpenChange={(value) => !value && onClose()}><DialogContent><DialogHeader><DialogTitle>Registrar oportunidade perdida</DialogTitle></DialogHeader><label className="text-xs">Motivo *</label><select className={control} value={reason} onChange={(e) => setReason(e.target.value)}><option value="">Selecione</option>{reasons.map((item) => <option key={item.id} value={item.id}>{item.name}</option>)}</select><label className="text-xs">Concorrente</label><input className={control} value={competitor} onChange={(e) => setCompetitor(e.target.value)}/><label className="text-xs">Observações</label><textarea className={control} rows={3} value={notes} onChange={(e) => setNotes(e.target.value)}/><div className="flex justify-end gap-2"><Button variant="ghost" onClick={onClose}>Cancelar</Button><Button variant="destructive" disabled={!reason || pending} onClick={() => onConfirm(reason, competitor, notes)}>Confirmar perda</Button></div></DialogContent></Dialog>
}

function NewOpportunityDialog({ open, onClose, pipeline, stages, customers, contacts, profiles, sources, defaultUserId, initialCustomerId }: { open: boolean; onClose: () => void; pipeline?: Pipeline; stages: PipelineStage[]; customers: CrmCustomer[]; contacts: CrmContact[]; profiles: CrmProfile[]; sources: LeadSource[]; defaultUserId: string; initialCustomerId?: string }) {
  const router = useRouter(); const [pending, startTransition] = useTransition(); const firstStage = stages.find((item) => !item.is_won && !item.is_lost)
  const [form, setForm] = useState({ title: '', customer_id: initialCustomerId ?? '', contact_id: '', stage_id: firstStage?.id ?? '', assigned_user_id: profiles.some((profile) => profile.id === defaultUserId) ? defaultUserId : profiles[0]?.id ?? '', source_id: '', estimated_value: '0', estimated_quantity: '0', temperature: 'warm', expected_close_date: '', desired_delivery_date: '', notes: '' })
  const update = (key: string, value: string) => setForm((current) => ({ ...current, [key]: value }))
  function submit() { if (!pipeline || !form.stage_id) return; startTransition(async () => { const result = await createOpportunity({ ...form, contact_id: form.contact_id || null, pipeline_id: pipeline.id }); if (!result.success) toast.error(result.error); else { toast.success('Oportunidade criada.'); onClose(); router.push(`/crm/oportunidades/${result.data?.id}`) } }) }
  return <Dialog open={open} onOpenChange={(value) => !value && onClose()}><DialogContent className="sm:max-w-2xl"><DialogHeader><DialogTitle>Nova oportunidade</DialogTitle></DialogHeader><div className="grid sm:grid-cols-2 gap-3">
    <Field label="Título *"><input className={control} value={form.title} onChange={(e) => update('title', e.target.value)}/></Field>
    <Field label="Cliente *"><select className={control} value={form.customer_id} onChange={(e) => update('customer_id', e.target.value)}><option value="">Selecione</option>{customers.map((item) => <option key={item.id} value={item.id}>{item.nome}</option>)}</select></Field>
    <Field label="Contato"><select className={control} value={form.contact_id} onChange={(e) => update('contact_id', e.target.value)}><option value="">Sem contato</option>{contacts.filter((item) => item.customer_id === form.customer_id).map((item) => <option key={item.id} value={item.id}>{item.name}</option>)}</select></Field>
    <Field label="Etapa *"><select className={control} value={form.stage_id} onChange={(e) => update('stage_id', e.target.value)}>{stages.filter((item) => !item.is_won && !item.is_lost).map((item) => <option key={item.id} value={item.id}>{item.name}</option>)}</select></Field>
    <Field label="Responsável *"><select className={control} value={form.assigned_user_id} onChange={(e) => update('assigned_user_id', e.target.value)}>{profiles.map((item) => <option key={item.id} value={item.id}>{item.full_name}</option>)}</select></Field>
    <Field label="Origem"><select className={control} value={form.source_id} onChange={(e) => update('source_id', e.target.value)}><option value="">Não informada</option>{sources.map((item) => <option key={item.id} value={item.id}>{item.name}</option>)}</select></Field>
    <Field label="Valor estimado"><input className={control} type="number" min="0" step="0.01" value={form.estimated_value} onChange={(e) => update('estimated_value', e.target.value)}/></Field>
    <Field label="Quantidade"><input className={control} type="number" min="0" value={form.estimated_quantity} onChange={(e) => update('estimated_quantity', e.target.value)}/></Field>
    <Field label="Temperatura"><select className={control} value={form.temperature} onChange={(e) => update('temperature', e.target.value)}><option value="cold">Fria</option><option value="warm">Morna</option><option value="hot">Quente</option></select></Field>
    <Field label="Previsão de fechamento"><input className={control} type="date" value={form.expected_close_date} onChange={(e) => update('expected_close_date', e.target.value)}/></Field>
    <Field label="Entrega desejada"><input className={control} type="date" value={form.desired_delivery_date} onChange={(e) => update('desired_delivery_date', e.target.value)}/></Field>
    <Field label="Observações"><textarea className={control} rows={2} value={form.notes} onChange={(e) => update('notes', e.target.value)}/></Field>
  </div><div className="flex justify-end gap-2"><Button variant="ghost" onClick={onClose}>Cancelar</Button><Button onClick={submit} disabled={pending || !form.title || !form.customer_id || !form.assigned_user_id}>{pending && <Loader2 className="animate-spin"/>}Criar</Button></div></DialogContent></Dialog>
}

function Field({ label, children }: { label: string; children: React.ReactNode }) { return <label className="text-xs space-y-1"><span>{label}</span>{children}</label> }
