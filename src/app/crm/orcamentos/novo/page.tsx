import { notFound } from 'next/navigation'
import { CommercialNav } from '@/components/crm/CommercialNav'
import { CrmPageHeader } from '@/components/crm/CrmUi'
import { Header } from '@/components/layout/Header'
import { QuoteEditor } from '@/components/quotes/QuoteEditor'
import { requirePermission } from '@/lib/auth/require-user'
import { parseBusinessDate,todayBusinessDate } from '@/lib/business-date'
import { getCommercialSettings } from '@/lib/supabase/queries/commercial'
import { getQuoteLookups } from '@/lib/supabase/queries/quotes'
import { getPreliminarySafeDate } from '@/lib/supabase/queries/operations'

export default async function NewQuotePage({searchParams}:{searchParams:Promise<{opportunity?:string}>}){
  const context=await requirePermission('quotes.create');const {opportunity}=await searchParams;if(!opportunity)notFound()
  const [data,settings]=await Promise.all([getQuoteLookups(opportunity),getCommercialSettings()]);if(!data.opportunity)notFound()
  const preliminary=await getPreliminarySafeDate(Number(data.opportunity.estimated_quantity??1),'',data.opportunity.desired_delivery_date)
  const validUntil=parseBusinessDate(todayBusinessDate());validUntil.setDate(validUntil.getDate()+settings.default_quote_validity_days)
  const manager=context.roles.some(role=>['administrator','manager'].includes(role.code))
  return <div><Header title="Novo orçamento"/><main className="crm-shell"><CommercialNav manager={manager}/><CrmPageHeader title="Novo orçamento" description="Dados da oportunidade já preenchidos. Valores e custos serão recalculados no servidor."/><QuoteEditor opportunity={data.opportunity as never} terms={data.terms} fabrics={data.fabrics} defaultValidUntil={validUntil.toISOString().slice(0,10)} minimumMarginPercent={settings.minimum_margin_percent} requireMarginApproval={settings.require_margin_approval} preliminarySafeDate={preliminary}/></main></div>
}
