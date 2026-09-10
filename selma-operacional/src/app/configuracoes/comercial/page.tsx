import { Header } from '@/components/layout/Header'
import { CommercialNav } from '@/components/crm/CommercialNav'
import { CommercialSettingsClient } from '@/components/crm/CommercialSettingsClient'
import { CrmPageHeader } from '@/components/crm/CrmUi'
import { requireAnyPermission } from '@/lib/auth/require-user'
import { getCommercialConfig } from '@/lib/supabase/queries/commercial'

export default async function CommercialSettingsPage(){
  await requireAnyPermission(['settings.manage','crm.delete'])
  const data=await getCommercialConfig()
  return <div><Header title="Configurações Comerciais"/><main className="crm-shell"><CommercialNav manager/><CrmPageHeader title="Configurações comerciais" description="Organize funil, score, automações, metas e cadastros do CRM."/><CommercialSettingsClient {...data}/></main></div>
}
