'use client'

import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { useEffect, useState, useTransition } from 'react'
import { ArrowRight, CheckCircle, Loader2, MoreHorizontal, Pencil, Plus, Search, UserCheck, UsersRound, XCircle } from 'lucide-react'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { usePermission } from '@/components/providers/AuthorizationProvider'
import { convertLead, createLead, findLeadDuplicates, setLeadStatus, updateLead } from '@/app/crm/actions'
import type { CrmCustomer, CrmProfile, Lead, LeadSource } from '@/types/crm'
import { CrmPageHeader, EmptyState, FilterBar, LeadStatusBadge } from './CrmUi'

const statusNames = { new: 'Novo', working: 'Em contato', qualified: 'Qualificado', converted: 'Convertido', disqualified: 'Desqualificado' }
type LeadFilters={search?:string;status?:string;assigned?:string;source?:string}

export function LeadsClient({ leads, count, page, filters, customers, profiles, sources, defaultUserId }: { leads: Lead[]; count: number; page: number; filters: LeadFilters; customers: CrmCustomer[]; profiles: CrmProfile[]; sources: LeadSource[]; defaultUserId: string }) {
  const canCreate = usePermission('crm.create')
  const canUpdate = usePermission('crm.update')
  const router = useRouter()
  const [pending, startTransition] = useTransition()
  const [editing, setEditing] = useState<Lead | null | undefined>(undefined)
  const [convert, setConvert] = useState<Lead | null>(null)
  const pageHref=(next:number)=>`?${new URLSearchParams({...Object.fromEntries(Object.entries(filters).filter(([,v])=>v)),page:String(next)}).toString()}`
  function status(id: string, value: 'working'|'qualified'|'disqualified') { startTransition(async () => { const result = await setLeadStatus(id, value); if (!result.success) toast.error(result.error); else { toast.success('Lead atualizado.'); router.refresh() } }) }
  const newButton=canCreate?<Button className="h-10" onClick={() => setEditing(null)}><Plus/>Novo lead</Button>:undefined

  return <div className="space-y-5">
    <CrmPageHeader title="Leads" description="Gerencie contatos ainda não convertidos em oportunidade." actions={newButton}/>
    <form><FilterBar actions={<Button className="h-10" type="submit"><Search/>Buscar</Button>}>
      <label className="relative min-w-60 flex-1"><span className="sr-only">Buscar lead</span><Search className="absolute left-3 top-3 text-muted" size={16}/><input name="search" defaultValue={filters.search} className="crm-control pl-9" placeholder="Nome, empresa ou e-mail"/></label>
      <select aria-label="Status" name="status" defaultValue={filters.status??''} className="crm-control min-w-40"><option value="">Todos os status</option>{Object.entries(statusNames).map(([key,value])=><option key={key} value={key}>{value}</option>)}</select>
      <select aria-label="Responsável" name="assigned" defaultValue={filters.assigned??''} className="crm-control min-w-44"><option value="">Responsável</option>{profiles.map(profile=><option key={profile.id} value={profile.id}>{profile.full_name}</option>)}</select>
      <select aria-label="Origem" name="source" defaultValue={filters.source??''} className="crm-control min-w-40"><option value="">Origem</option>{sources.map(source=><option key={source.id} value={source.id}>{source.name}</option>)}</select>
    </FilterBar></form>

    <div className="crm-card overflow-x-auto">
      <table className="crm-table"><thead><tr>{['Lead','Contato','Origem','Responsável','Status','Última interação','Criado','Ações'].map(item=><th key={item}>{item}</th>)}</tr></thead>
        <tbody>{leads.map(lead=><tr key={lead.id}>
          <td><strong className="block font-medium">{lead.name}</strong><span className="text-xs text-muted">{lead.company_name||'Sem empresa informada'}</span></td>
          <td className="text-xs"><div>{lead.whatsapp||lead.phone?<a className="hover:text-green-600 hover:underline" href={`tel:${lead.whatsapp||lead.phone}`}>{lead.whatsapp||lead.phone}</a>:'—'}</div><div className="text-muted">{lead.email||'Sem e-mail'}</div></td>
          <td>{lead.source?.name??'—'}</td><td>{lead.assigned?.full_name??'—'}</td><td><LeadStatusBadge status={lead.status}/></td>
          <td className="whitespace-nowrap text-xs">{new Intl.DateTimeFormat('pt-BR').format(new Date(lead.updated_at))}</td>
          <td className="whitespace-nowrap text-xs text-muted">{new Intl.DateTimeFormat('pt-BR').format(new Date(lead.created_at))}</td>
          <td>{canUpdate&&!['converted','disqualified'].includes(lead.status)?<details className="relative"><summary aria-label={`Ações do lead ${lead.name}`} className="crm-focus grid size-8 cursor-pointer list-none place-items-center rounded-lg hover:bg-surface-hover"><MoreHorizontal size={17}/></summary><div className="absolute right-0 z-20 mt-1 w-48 rounded-xl border bg-card p-1.5 shadow-lg">
            <MenuButton icon={<Pencil/>} label="Abrir e editar" onClick={()=>setEditing(lead)}/><MenuButton icon={<UserCheck/>} label="Marcar em contato" onClick={()=>status(lead.id,'working')}/><MenuButton icon={<CheckCircle/>} label="Qualificar" onClick={()=>status(lead.id,'qualified')}/><MenuButton icon={<ArrowRight/>} label="Converter" onClick={()=>setConvert(lead)}/><MenuButton danger icon={<XCircle/>} label="Desqualificar" onClick={()=>status(lead.id,'disqualified')}/>
          </div></details>:<span className="text-xs text-muted">—</span>}</td>
        </tr>)}
        {!leads.length&&<tr><td colSpan={8} className="p-0"><EmptyState icon={<UsersRound size={21}/>} title="Nenhum lead ainda" description="Adicione um novo lead ou aguarde integrações futuras." action={newButton}/></td></tr>}</tbody>
      </table>
    </div>

    <div className="flex items-center justify-between gap-3 text-sm text-muted"><span>{count} lead{count===1?'':'s'}</span><div className="flex gap-2">{page>1&&<Link className="crm-focus rounded-lg border px-3 py-1.5 hover:bg-surface-hover" href={pageHref(page-1)}>Anterior</Link>}{page*30<count&&<Link className="crm-focus rounded-lg border px-3 py-1.5 hover:bg-surface-hover" href={pageHref(page+1)}>Próxima</Link>}</div></div>
    <LeadDialog key={editing?.id??(editing===null?'new':'closed')} lead={editing} onClose={()=>setEditing(undefined)} profiles={profiles} sources={sources} defaultUserId={defaultUserId}/>
    <ConvertDialog lead={convert} onClose={()=>setConvert(null)} customers={customers}/>
    {pending&&<div className="fixed bottom-5 right-5 flex gap-2 rounded-lg bg-green-600 px-3 py-2 text-white shadow-lg"><Loader2 className="animate-spin"/>Salvando</div>}
  </div>
}

function MenuButton({icon,label,onClick,danger=false}:{icon:React.ReactNode;label:string;onClick:()=>void;danger?:boolean}){return <button type="button" onClick={onClick} className={`crm-focus flex w-full items-center gap-2 rounded-lg px-2.5 py-2 text-left text-sm hover:bg-surface-hover ${danger?'text-rose-600 dark:text-rose-400':''}`}><span className="[&_svg]:size-4">{icon}</span>{label}</button>}

function LeadDialog({ lead, onClose, profiles, sources, defaultUserId }: { lead: Lead | null | undefined; onClose: () => void; profiles: CrmProfile[]; sources: LeadSource[]; defaultUserId: string }) {
  const router=useRouter();const [pending,startTransition]=useTransition();const [form,setForm]=useState({name:lead?.name??'',company_name:lead?.company_name??'',phone:lead?.phone??'',whatsapp:lead?.whatsapp??'',email:lead?.email??'',source_id:lead?.source_id??'',assigned_user_id:lead?.assigned_user_id??(profiles.some(profile=>profile.id===defaultUserId)?defaultUserId:profiles[0]?.id??''),notes:lead?.notes??''});const update=(key:string,value:string)=>setForm(current=>({...current,[key]:value}))
  function submit(){startTransition(async()=>{const result=lead?await updateLead(lead.id,form):await createLead(form);if(!result.success)toast.error(result.error);else{toast.success(lead?'Alterações salvas.':'Lead criado.');onClose();router.refresh()}})}
  return <Dialog open={lead!==undefined} onOpenChange={value=>!value&&onClose()}><DialogContent className="sm:max-w-xl"><DialogHeader><DialogTitle>{lead?'Editar lead':'Novo lead'}</DialogTitle></DialogHeader><div className="grid gap-3 sm:grid-cols-2">{[['name','Nome *'],['company_name','Empresa'],['phone','Telefone'],['whatsapp','WhatsApp'],['email','E-mail']].map(([key,label])=><Field key={key} label={label}><input className="crm-control" value={form[key as keyof typeof form]} onChange={event=>update(key,event.target.value)}/></Field>)}<Field label="Origem"><select className="crm-control" value={form.source_id} onChange={event=>update('source_id',event.target.value)}><option value="">Não informada</option>{sources.map(item=><option key={item.id} value={item.id}>{item.name}</option>)}</select></Field><Field label="Responsável *"><select className="crm-control" value={form.assigned_user_id} onChange={event=>update('assigned_user_id',event.target.value)}>{profiles.map(item=><option key={item.id} value={item.id}>{item.full_name}</option>)}</select></Field><label className="space-y-1 text-xs sm:col-span-2">Observações<textarea className="crm-control min-h-24 py-2" value={form.notes} onChange={event=>update('notes',event.target.value)}/></label></div><div className="flex justify-end gap-2"><Button variant="ghost" onClick={onClose}>Cancelar</Button><Button disabled={pending||!form.name||!form.assigned_user_id} onClick={submit}>{pending&&<Loader2 className="animate-spin"/>}{lead?'Salvar':'Criar lead'}</Button></div></DialogContent></Dialog>
}

function ConvertDialog({lead,onClose,customers}:{lead:Lead|null;onClose:()=>void;customers:CrmCustomer[]}){
  const router=useRouter();const [pending,startTransition]=useTransition();const [customerId,setCustomerId]=useState('');const [createNew,setCreateNew]=useState(false);const [createContact,setCreateContact]=useState(true);const [createOpportunity,setCreateOpportunity]=useState(true);const [title,setTitle]=useState('');const [duplicates,setDuplicates]=useState<CrmCustomer[]>([])
  useEffect(()=>{if(!lead)return;void findLeadDuplicates(lead.id).then(result=>{if(result.success){setDuplicates(result.data??[]);if(result.data?.[0])setCustomerId(result.data[0].id)}})},[lead])
  function submit(){if(!lead)return;startTransition(async()=>{const result=await convertLead({lead_id:lead.id,customer_id:createNew?null:customerId||null,create_new_customer:createNew,create_contact:createContact,create_opportunity:createOpportunity,opportunity_title:title||null});if(!result.success){toast.error(result.error);if(result.duplicateCustomerId){setCustomerId(result.duplicateCustomerId);setCreateNew(false)}}else{toast.success('Lead convertido.');onClose();if(result.data?.opportunity_id)router.push(`/crm/oportunidades/${result.data.opportunity_id}`);else router.refresh()}})}
  return <Dialog open={Boolean(lead)} onOpenChange={value=>!value&&onClose()}><DialogContent className="sm:max-w-lg"><DialogHeader><DialogTitle>Converter lead: {lead?.name}</DialogTitle></DialogHeader>{duplicates.length>0&&<div className="rounded-lg border border-amber-500/40 bg-amber-500/10 p-3 text-sm"><strong>Possíveis duplicados:</strong>{duplicates.map(item=><button className="mt-1 block underline" key={item.id} onClick={()=>{setCustomerId(item.id);setCreateNew(false)}}>{item.nome} — {item.contato||item.email}</button>)}</div>}<Field label="Cliente existente"><select disabled={createNew} className="crm-control" value={customerId} onChange={event=>setCustomerId(event.target.value)}><option value="">Selecione</option>{customers.map(item=><option key={item.id} value={item.id}>{item.nome}</option>)}</select></Field><Check label="Criar novo cliente com os dados do lead" checked={createNew} set={setCreateNew}/><Check label="Criar contato" checked={createContact} set={setCreateContact}/><Check label="Criar oportunidade" checked={createOpportunity} set={setCreateOpportunity}/>{createOpportunity&&<Field label="Título da oportunidade"><input className="crm-control" value={title} onChange={event=>setTitle(event.target.value)} placeholder={lead?.company_name||lead?.name}/></Field>}<div className="flex justify-end gap-2"><Button variant="ghost" onClick={onClose}>Cancelar</Button><Button disabled={pending||(!createNew&&!customerId)} onClick={submit}>{pending&&<Loader2 className="animate-spin"/>}Converter</Button></div></DialogContent></Dialog>
}

function Field({label,children}:{label:string;children:React.ReactNode}){return <label className="space-y-1 text-xs"><span>{label}</span>{children}</label>}
function Check({label,checked,set}:{label:string;checked:boolean;set:(value:boolean)=>void}){return <label className="flex items-center gap-2 text-sm"><input type="checkbox" checked={checked} onChange={event=>set(event.target.checked)}/>{label}</label>}
