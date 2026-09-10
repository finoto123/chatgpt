import { Header } from '@/components/layout/Header'
import { ComprasClient } from '@/components/compras/ComprasClient'
import { getTecidosParaComprar } from '@/lib/supabase/queries/compras'
import { requirePermission } from '@/lib/auth/require-user'
import { getPurchasingWorkspace } from '@/lib/supabase/queries/operations'
import { PurchasingWorkspace } from '@/components/operations/PurchasingWorkspace'

export default async function ComprasPage() {
  await requirePermission('purchases.view')
  const [tecidos,workspace] = await Promise.all([getTecidosParaComprar(),getPurchasingWorkspace()])

  return (
    <div>
      <Header title="Compras" />
      <PurchasingWorkspace workspace={workspace} fallback={<ComprasClient tecidos={tecidos} />} />
    </div>
  )
}
