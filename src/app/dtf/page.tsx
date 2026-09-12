import { getEnviosDtf, getPedidosParaDtf } from '@/lib/supabase/queries/dtf'
import { getOficinasAtivas } from '@/lib/supabase/queries/oficinas'
import { DtfClientPage } from '@/components/dtf/DtfClientPage'
import { requirePermission } from '@/lib/auth/require-user'

export default async function DtfPage() {
  await requirePermission('production.view')
  const [envios, pedidos, oficinas] = await Promise.all([
    getEnviosDtf(),
    getPedidosParaDtf(),
    getOficinasAtivas(),
  ])
  return <div className="p-6"><DtfClientPage envios={envios} pedidos={pedidos} oficinas={oficinas} /></div>
}
