import { Header } from '@/components/layout/Header'
import { CommercialInbox } from '@/features/commercial/inbox/CommercialInbox'
import { requirePermission } from '@/lib/auth/require-user'

export default async function CommercialInboxPage() {
  await requirePermission('crm.view')

  return (
    <div className="flex h-full min-h-[640px] flex-col">
      <Header title="Inbox comercial" />
      <CommercialInbox />
    </div>
  )
}
