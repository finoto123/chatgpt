import { Header } from '@/components/layout/Header'
import { CommercialNav } from '@/components/crm/CommercialNav'
import { CrmPageHeader } from '@/components/crm/CrmUi'
import { ReactivationClient } from '@/components/crm/ReactivationClient'
import { requirePermission } from '@/lib/auth/require-user'
import { getReactivationCustomers } from '@/lib/supabase/queries/commercial'
import { getCrmLookups } from '@/lib/supabase/queries/crm'

export default async function ReactivationPage({searchParams}:{searchParams:Promise<{mode?:string;days?:string;minTicket?:string;page?:string}>}){
  const context=await requirePermission('crm.view');const query=await searchParams;const modes=['inactive','no_orders','recompra','high_ticket'];const mode=modes.includes(query.mode??'')?query.mode!:'inactive';const days=Math.min(3650,Math.max(1,Number(query.days)||90));const minTicket=Math.max(0,Number(query.minTicket)||10000);const page=Math.max(1,Number(query.page)||1);const [data,lookups]=await Promise.all([getReactivationCustomers(days,mode,minTicket,page),getCrmLookups()]);const manager=context.roles.some(role=>['administrator','manager'].includes(role.code))
  return <div><Header title="Reativação de Clientes"/><main className="crm-shell"><CommercialNav manager={manager}/><CrmPageHeader title="Carteira para reativação" description="Clientes com maior potencial de uma nova compra, priorizados pelo histórico comercial."/><ReactivationClient data={data} profiles={lookups.profiles} params={{mode,days,minTicket}}/></main></div>
}
