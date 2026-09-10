import { getPedidoById } from '@/lib/supabase/queries/pedidos'
import { FormularioPedido } from '@/components/print/FormularioPedido'
import { notFound } from 'next/navigation'
import { Pedido } from '@/types'
import { requirePermission } from '@/lib/auth/require-user'

export default async function ImprimirPage({ params }: { params: Promise<{ id: string }> }) {
  const context = await requirePermission('orders.view')
  const canViewFinance = context.permissions.includes('finance.view')
  const { id } = await params
  const pedido = await getPedidoById(id)
  if (!pedido) notFound()
  const rawItems = (pedido.itens ?? pedido.itens_pedido ?? []) as NonNullable<Pedido['itens']>
  const itens = rawItems.map((item) => ({
    ...item,
    valor_unitario: canViewFinance ? item.valor_unitario : 0,
  }))
  const safePedido = {
    ...pedido,
    valor_entrada: canViewFinance ? pedido.valor_entrada : 0,
    valor_pago_adicional: canViewFinance ? pedido.valor_pago_adicional : 0,
    forma_pagamento: canViewFinance ? pedido.forma_pagamento : null,
    status_pagamento: canViewFinance ? pedido.status_pagamento : null,
    itens,
    itens_pedido: itens,
  } as Pedido
  return <FormularioPedido pedido={safePedido} canViewFinance={canViewFinance} />
}
