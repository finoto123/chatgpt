import {
  getEnviosOficina,
  getOficinasAtivas,
  getPedidosAtivosParaEnvio,
} from '@/lib/supabase/queries/oficinas'
import { OficinasTable } from '@/components/oficinas/OficinasTable'
import { requirePermission } from '@/lib/auth/require-user'

export default async function OficinasPage() {
  const context = await requirePermission('workshops.view')
  const [envios, oficinas, pedidos] = await Promise.all([
    getEnviosOficina(),
    getOficinasAtivas(),
    getPedidosAtivosParaEnvio(),
  ])
  const canViewFinance = context.permissions.includes('finance.view')
  const safeEnvios = canViewFinance
    ? envios
    : envios.map((envio) => ({
        ...envio,
        valor_unitario: null,
        valor_total: null,
      }))
  const safePedidos = canViewFinance
    ? pedidos
    : pedidos.map((pedido) => ({
        ...pedido,
        itens_pedido: pedido.itens_pedido.map((item) => ({
          ...item,
          valor_unitario: 0,
        })),
      }))

  return (
    <div className="p-6">
      <OficinasTable
        envios={safeEnvios as never}
        pedidos={safePedidos as never}
        oficinas={oficinas as never}
      />
    </div>
  )
}
