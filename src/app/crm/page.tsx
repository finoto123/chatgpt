import { Header } from '@/components/layout/Header'
import { CommercialNav } from '@/components/crm/CommercialNav'
import { CommercialCentral } from '@/components/crm/CommercialCentral'
import { CrmPageHeader } from '@/components/crm/CrmUi'
import { requirePermission } from '@/lib/auth/require-user'
import { getCommercialCentral, getSalesForecast } from '@/lib/supabase/queries/commercial'
import { getCrmLookups } from '@/lib/supabase/queries/crm'

export default async function CrmPage({ searchParams }: { searchParams: Promise<{user?:string}> }) {
  const context = await requirePermission('crm.view')
  const query = await searchParams
  const manager = context.roles.some(role => ['administrator', 'manager'].includes(role.code))
  const selected = manager && query.user ? query.user : context.user.id
  const today = new Date()
  const start = new Date(today.getFullYear(), today.getMonth(), 1).toISOString().slice(0, 10)
  const end = new Date(today.getFullYear(), today.getMonth() + 1, 0).toISOString().slice(0, 10)
  const [data, forecast, lookups] = await Promise.all([getCommercialCentral(selected), getSalesForecast(start, end, selected), getCrmLookups()])

  const portfolio = manager ? <form className="flex items-center gap-2">
    <label htmlFor="crm-user" className="sr-only">Carteira</label>
    <select id="crm-user" name="user" defaultValue={selected} className="crm-control min-w-52">
      {lookups.profiles.map(profile => <option key={profile.id} value={profile.id}>{profile.full_name}</option>)}
    </select>
    <button className="crm-focus h-10 rounded-lg bg-green-600 px-4 text-sm font-medium text-white hover:bg-green-500">Abrir</button>
  </form> : undefined

  return <div><Header title="Central Comercial"/><main className="crm-shell">
    <CommercialNav manager={manager}/>
    <CrmPageHeader title="Central comercial" description="Prioridades, pipeline e resultados que precisam da sua atenção hoje." actions={portfolio}/>
    <CommercialCentral data={data} forecast={forecast}/>
  </main></div>
}
