import { notFound } from 'next/navigation'
import Link from 'next/link'
import { getClienteById, getPedidosPorCliente } from '@/lib/supabase/queries/clientes'
import { Header } from '@/components/layout/Header'
import { StatusBadge } from '@/components/pedidos/StatusBadge'
import { StatusPedido } from '@/types'
import { formatBRL, formatDate } from '@/lib/utils'
import { ArrowLeft, Phone, Mail, MapPin, ShoppingBag, Package, DollarSign, Eye, Printer } from 'lucide-react'
import { hasPermission, requirePermission } from '@/lib/auth/require-user'
import { getCrmLookups, getCustomerCrmSummary } from '@/lib/supabase/queries/crm'
import { CustomerCrmSection } from '@/components/crm/CustomerCrmSection'

export default async function ClienteDetalhePage({ params }: { params: Promise<{ id: string }> }) {
  await requirePermission('customers.view')
  const canViewFinance = await hasPermission('finance.view')
  const canViewCrm = await hasPermission('crm.view')
  const { id } = await params
  const [cliente, pedidos, crm, crmLookups] = await Promise.all([
    getClienteById(id),
    getPedidosPorCliente(id, ''),
    canViewCrm ? getCustomerCrmSummary(id) : Promise.resolve(null),
    canViewCrm ? getCrmLookups() : Promise.resolve(null),
  ])

  if (!cliente) notFound()

  const totalPedidos = pedidos.length
  const totalPecas = pedidos.reduce((s, p) => s + (p.qtde_total ?? 0), 0)
  const valorTotal = pedidos.reduce((s, p) => s + (p.valor_total ?? 0), 0)
  const pedidosAtivos = pedidos.filter(p => !['entregue', 'cancelado'].includes(p.status)).length

  return (
    <div>
      <Header title={cliente.nome} />
      <div className="p-6 space-y-6">

        {/* Voltar */}
        <Link
          href="/clientes"
          className="inline-flex items-center gap-1.5 text-sm hover:text-green-600 transition-colors"
          style={{ color: '#6b7280' }}
        >
          <ArrowLeft size={15} />
          Voltar para Clientes
        </Link>

        {/* Info do cliente */}
        <div
          className="rounded-xl p-5"
          style={{ background: 'var(--card-bg)', border: '1px solid var(--border-color)' }}
        >
          <div className="flex items-start gap-4">
            <div
              className="w-14 h-14 rounded-full flex items-center justify-center text-xl font-bold flex-shrink-0"
              style={{ background: 'rgba(34,197,94,0.12)', color: '#16a34a' }}
            >
              {cliente.nome[0]}
            </div>
            <div className="flex-1">
              <h2 className="text-lg font-bold" style={{ color: 'var(--fg)' }}>{cliente.nome}</h2>
              <div className="flex flex-wrap gap-4 mt-2">
                {cliente.contato && (
                  <span className="flex items-center gap-1.5 text-sm" style={{ color: 'var(--fg-muted)' }}>
                    <Phone size={13} />{cliente.contato}
                  </span>
                )}
                {cliente.email && (
                  <span className="flex items-center gap-1.5 text-sm" style={{ color: 'var(--fg-muted)' }}>
                    <Mail size={13} />{cliente.email}
                  </span>
                )}
                {cliente.cidade && (
                  <span className="flex items-center gap-1.5 text-sm" style={{ color: 'var(--fg-muted)' }}>
                    <MapPin size={13} />{cliente.cidade}
                  </span>
                )}
              </div>
              {cliente.observacoes && (
                <p className="mt-2 text-sm" style={{ color: 'var(--fg-muted)' }}>{cliente.observacoes}</p>
              )}
            </div>
          </div>
        </div>

        {/* KPIs */}
        <div className={`grid gap-4 ${canViewFinance ? 'grid-cols-4' : 'grid-cols-3'}`}>
          {[
            { label: 'Total de Pedidos', value: totalPedidos, icon: ShoppingBag, color: '#22C55E' },
            { label: 'Pedidos Ativos', value: pedidosAtivos, icon: Package, color: '#60A5FA' },
            { label: 'Total de Peças', value: totalPecas, icon: Package, color: '#A78BFA' },
            ...(canViewFinance ? [{ label: 'Valor Total', value: formatBRL(valorTotal), icon: DollarSign, color: '#F59E0B', isText: true }] : []),
          ].map(k => (
            <div
              key={k.label}
              className="rounded-xl p-4"
              style={{ background: 'var(--card-bg)', border: '1px solid var(--border-color)' }}
            >
              <p className="text-xs font-medium uppercase tracking-wide" style={{ color: 'var(--fg-muted)' }}>{k.label}</p>
              <p className="text-2xl font-bold mt-1" style={{ color: k.color }}>
                {k.isText ? k.value : k.value}
              </p>
            </div>
          ))}
        </div>

        {crm && crmLookups && (
          <CustomerCrmSection
            customerId={id}
            {...crm}
            pipelineId={(crmLookups.pipelines.find((pipeline) => pipeline.is_default) ?? crmLookups.pipelines[0])?.id ?? ''}
            stages={crmLookups.stages}
            profiles={crmLookups.profiles}
            sources={crmLookups.sources}
          />
        )}

        {/* Pedidos do cliente */}
        <div>
          <h3 className="text-base font-semibold mb-3" style={{ color: 'var(--fg)' }}>
            Histórico de Pedidos
          </h3>

          <div className="rounded-xl overflow-hidden" style={{ background: 'var(--card-bg)', border: '1px solid var(--border-color)' }}>
            <table className="w-full text-sm">
              <thead style={{ background: 'var(--input-bg)', borderBottom: '1px solid var(--border-color)' }}>
                <tr>
                  {['N° Pedido', 'Data', 'Entrega', 'Peças', ...(canViewFinance ? ['Valor Total'] : []), 'Status', 'Ações'].map(h => (
                    <th key={h} className="px-4 py-3 text-left text-xs font-medium uppercase tracking-wide" style={{ color: 'var(--fg-muted)' }}>
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {pedidos.length === 0 ? (
                  <tr>
                    <td colSpan={7} className="text-center py-8" style={{ color: 'var(--fg-muted)' }}>
                      Nenhum pedido encontrado para este cliente
                    </td>
                  </tr>
                ) : pedidos.map(pedido => (
                  <tr
                    key={pedido.id}
                    className="hover-item transition-colors"
                    style={{ borderBottom: '1px solid var(--border-subtle)' }}
                  >
                    <td className="px-4 py-3 font-semibold" style={{ color: 'var(--fg)' }}>#{pedido.numero}</td>
                    <td className="px-4 py-3" style={{ color: 'var(--fg-muted)' }}>{formatDate(pedido.data_pedido)}</td>
                    <td className="px-4 py-3 font-medium" style={{ color: '#b45309' }}>{formatDate(pedido.entrega_programado)}</td>
                    <td className="px-4 py-3 text-center" style={{ color: 'var(--fg-secondary)' }}>{pedido.qtde_total ?? 0}</td>
                    {canViewFinance && <td className="px-4 py-3 font-semibold" style={{ color: 'var(--fg)' }}>{formatBRL(pedido.valor_total)}</td>}
                    <td className="px-4 py-3">
                      <StatusBadge status={pedido.status as StatusPedido} />
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-2">
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
        </div>

      </div>
    </div>
  )
}
