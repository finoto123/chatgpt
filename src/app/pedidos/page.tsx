import { getPedidos } from '@/lib/supabase/queries/pedidos'
import { createServerSupabaseClient } from '@/lib/supabase/server'
import { Header } from '@/components/layout/Header'
import { StatusBadge } from '@/components/pedidos/StatusBadge'
import { NovoPedidoDrawer } from '@/components/pedidos/NovoPedidoDrawer'
import { PedidosFiltros } from '@/components/pedidos/PedidosFiltros'
import { StatusPedido, Vendedor, Oficina, Cliente } from '@/types'
import { formatDate, formatBRL } from '@/lib/utils'
import { Eye, Printer } from 'lucide-react'
import { AbasPedidos } from '@/components/pedidos/AbasPedidos'
import { BotaoPublicarRascunho } from '@/components/pedidos/BotaoPublicarRascunho'
import { BotaoCancelarRascunhoIcon } from '@/components/pedidos/BotaoCancelarRascunhoIcon'
import { BotaoRestaurarPedido } from '@/components/pedidos/BotaoRestaurarPedido'
import Link from 'next/link'
import { Suspense } from 'react'
import { hasPermission, requirePermission } from '@/lib/auth/require-user'

export default async function PedidosPage({
  searchParams,
}: {
  searchParams: Promise<{ status?: string; search?: string; page?: string; aba?: string }>
}) {
  await requirePermission('orders.view')
  const [canViewFinance, canUpdateOrders] = await Promise.all([
    hasPermission('finance.view'),
    hasPermission('orders.update'),
  ])
  const canUseFullEditor = canViewFinance && canUpdateOrders
  const params = await searchParams
  const supabase = await createServerSupabaseClient()
  const aba = params.aba ?? 'ativos'

  const { count: qtdeRascunhos } = await supabase
    .from('pedidos')
    .select('*', { count: 'exact', head: true })
    .eq('status', 'rascunho')

  const [{ pedidos, total }, vendedoresRes, oficinasRes, clientesRes] = await Promise.all([
    getPedidos({ 
      status: aba === 'ativos' ? params.status : aba === 'rascunhos' ? 'rascunho' : 'cancelado',
      statusExcluir: aba === 'ativos' ? ['rascunho', 'cancelado'] : [],
      search: params.search, 
      page: Number(params.page ?? 0) 
    }),
    supabase.from('vendedores').select('id, nome').order('nome'),
    supabase.from('oficinas').select('id, nome, tipo').order('nome'),
    supabase.from('clientes').select('id, nome, cidade').order('nome'),
  ])

  const vendedores = (vendedoresRes.data ?? []) as Vendedor[]
  const oficinas = (oficinasRes.data ?? []) as Oficina[]
  const clientes = (clientesRes.data ?? []) as Cliente[]
  const totalPages = Math.ceil(total / 20)
  const currentPage = Number(params.page ?? 0)

  return (
    <div>
      <Header title="Pedidos" />
      <div className="p-6 space-y-4">
        <AbasPedidos abaAtiva={aba} qtdeRascunhos={qtdeRascunhos ?? 0} />
        <div className="flex items-center justify-between">
          <Suspense fallback={<div className="h-9 w-80 rounded-lg" style={{ background: 'var(--input-bg)' }} />}>
            <PedidosFiltros />
          </Suspense>
          <NovoPedidoDrawer vendedores={vendedores} oficinas={oficinas} clientes={clientes} />
        </div>

        <div
          className="rounded-xl overflow-hidden"
          style={{ background: 'var(--card-bg)', border: '1px solid var(--border-color)', boxShadow: 'var(--shadow-sm)' }}
        >
          <table className="w-full text-sm">
            <thead style={{ background: 'var(--input-bg)', borderBottom: '1px solid var(--border-color)' }}>
              <tr>
                {['N° Pedido','Cliente','Vendedor','Data','Entrega','Peças',...(canViewFinance ? ['Valor Total'] : []),'Status','Ações'].map(h => (
                  <th key={h} className="px-4 py-3 text-left text-xs font-medium uppercase tracking-wide" style={{ color: 'var(--fg-muted)' }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {pedidos.length === 0 ? (
                <tr><td colSpan={9} className="text-center py-8" style={{ color: 'var(--fg-muted)' }}>Nenhum pedido encontrado</td></tr>
              ) : pedidos.map(pedido => (
                <tr
                  key={pedido.id}
                  className="transition-colors hover-item"
                  style={{ borderBottom: '1px solid var(--border-subtle)' }}
                >
                  <td className="px-4 py-3 font-semibold" style={{ color: 'var(--fg)' }}>#{pedido.numero}</td>
                  <td className="px-4 py-3 max-w-[160px]" style={{ color: 'var(--fg-secondary)' }}>
                    <span className="truncate block" title={pedido.cliente}>{pedido.cliente}</span>
                  </td>
                  <td className="px-4 py-3" style={{ color: 'var(--fg-muted)' }}>{(pedido.vendedor as { nome?: string } | null)?.nome ?? '--'}</td>
                  <td className="px-4 py-3" style={{ color: 'var(--fg-muted)' }}>{formatDate(pedido.data_pedido)}</td>
                  <td className="px-4 py-3 font-medium" style={{ color: '#F59E0B' }}>{formatDate(pedido.entrega_programado)}</td>
                  <td className="px-4 py-3 text-center" style={{ color: 'var(--fg-secondary)' }}>{(pedido as { qtde_total?: number }).qtde_total ?? 0}</td>
                  {canViewFinance && <td className="px-4 py-3 font-semibold" style={{ color: 'var(--fg)' }}>{formatBRL((pedido as { valor_total?: number }).valor_total)}</td>}
                  <td className="px-4 py-3">
                    <StatusBadge status={pedido.status as StatusPedido} />
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-2">
                      {canUseFullEditor && aba === 'ativos' && (
                        <NovoPedidoDrawer
                          vendedores={vendedores}
                          oficinas={oficinas}
                          clientes={clientes}
                          pedidoInicial={pedido as never}
                          triggerMode="editar"
                        />
                      )}
                      {aba === 'rascunhos' && (
                        <>
                          <BotaoPublicarRascunho pedidoId={pedido.id} />
                          {canUseFullEditor && <NovoPedidoDrawer
                            vendedores={vendedores}
                            oficinas={oficinas}
                            clientes={clientes}
                            pedidoInicial={pedido as never}
                            triggerMode="editar"
                          />}
                          <BotaoCancelarRascunhoIcon pedidoId={pedido.id} numeroPedido={pedido.numero} />
                        </>
                      )}
                      {aba === 'cancelados' && (
                        <BotaoRestaurarPedido pedidoId={pedido.id} numeroPedido={pedido.numero} />
                      )}
                      <Link href={`/pedidos/${pedido.id}`} className="p-1 rounded transition-colors" style={{ color: 'var(--fg-muted)' }}>
                        <Eye size={16} />
                      </Link>
                      <Link href={`/pedidos/${pedido.id}/imprimir`} className="p-1 rounded transition-colors" style={{ color: 'var(--fg-muted)' }}>
                        <Printer size={16} />
                      </Link>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {totalPages > 1 && (
          <div className="flex items-center justify-between text-sm" style={{ color: 'var(--fg-muted)' }}>
            <span>{total} pedidos no total</span>
            <div className="flex gap-2">
              {currentPage > 0 && (
                <Link
                  href={`?page=${currentPage - 1}`}
                  className="px-3 py-1.5 rounded-lg transition-colors"
                  style={{ border: '1px solid var(--border-color)', background: 'var(--input-bg)', color: 'var(--fg-secondary)' }}
                >← Anterior</Link>
              )}
              <span className="px-3 py-1.5">Página {currentPage + 1} de {totalPages}</span>
              {currentPage < totalPages - 1 && (
                <Link
                  href={`?page=${currentPage + 1}`}
                  className="px-3 py-1.5 rounded-lg transition-colors"
                  style={{ border: '1px solid var(--border-color)', background: 'var(--input-bg)', color: 'var(--fg-secondary)' }}
                >Próximo →</Link>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
