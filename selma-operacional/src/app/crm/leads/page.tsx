import { Header } from '@/components/layout/Header'
import { CommercialNav } from '@/components/crm/CommercialNav'
import { LeadsClient } from '@/components/crm/LeadsClient'
import { requirePermission } from '@/lib/auth/require-user'
import { getCrmLookups, getLeads } from '@/lib/supabase/queries/crm'

type Filters={search?:string;status?:string;assigned?:string;source?:string;page?:string}

export default async function LeadsPage({ searchParams }: { searchParams: Promise<Filters> }) {
  const context=await requirePermission('crm.view')
  const filters=await searchParams
  const manager=context.roles.some(role=>['administrator','manager'].includes(role.code))
  const [result,lookups]=await Promise.all([getLeads({...filters,page:Number(filters.page)||1}),getCrmLookups()])
  return <div><Header title="Leads"/><main className="crm-shell"><CommercialNav manager={manager}/><LeadsClient {...result} filters={filters} customers={lookups.customers} profiles={lookups.profiles} sources={lookups.sources} defaultUserId={context.user.id}/></main></div>
}
