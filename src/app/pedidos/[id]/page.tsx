import { getPedidoById } from '@/lib/supabase/queries/pedidos'
import { Header } from '@/components/layout/Header'
import { StatusBadge } from '@/components/pedidos/StatusBadge'
import { formatDate, formatBRL, calcularRestoPagar, formatTamanho, exibirCortador, parseModeloParts, labelEtapaEstampa } from '@/lib/utils'
import { StatusPedido, ItemPedido } from '@/types'
import { ArrowLeft, Printer, Package, Scissors, Shirt, CheckCircle, Truck } from 'lucide-react'
import Link from 'next/link'
import { notFound } from 'next/navigation'
import { SecaoEmbalagem } from '@/components/pedidos/SecaoEmbalagem'
import { BotaoCancelarPedido } from '@/components/pedidos/BotaoCancelarPedido'
import { RegistrarPagamentoModal } from '@/components/pedidos/RegistrarPagamentoModal'
import { requirePermission } from '@/lib/auth/require-user'
import { todayBusinessDate } from '@/lib/business-date'
import { isOrderLate } from '@/lib/domain/orders/status'
import { getOrderOperations } from '@/lib/supabase/queries/operations'
import { OrderOperationsWorkspace } from '@/components/operations/OrderOperationsWorkspace'


const STAGES = [
  { key: 'aguardando_corte', label: 'Ag. Corte',  Icon: Package },
  { key: 'corte',            label: 'Corte',       Icon: Scissors },
  { key: 'sublimacao',       label: 'Sublimação',  Icon: Shirt },
  { key: 'dtf',              label: 'DTF',         Icon: Shirt },
  { key: 'bordados',         label: 'Bordados',    Icon: Shirt },
  { key: 'costura',          label: 'Costura',     Icon: Shirt },
  { key: 'acabamento',       label: 'Acabamento',  Icon: CheckCircle },
  { key: 'entregue',         label: 'Entregue',    Icon: Truck },
] as const


interface InfoRowProps { label: string; value: string | null | undefined }
function InfoRow({ label, value }: InfoRowProps) {
  return (
    <div className="flex justify-between items-center py-2.5" style={{ borderBottom: '1px solid var(--border-subtle)' }}>
      <span className="text-xs" style={{ color: 'var(--fg-muted)' }}>{label}</span>
      <span className="text-sm font-medium" style={{ color: 'var(--fg)' }}>{value || '--'}</span>
    </div>
  )
}

interface CardProps { title: string; children: React.ReactNode }
function Card({ title, children }: CardProps) {
  return (
    <div className="rounded-xl p-5" style={{ background: 'var(--card-bg)', border: '1px solid var(--border-color)' }}>
      <h3 className="text-xs font-semibold uppercase tracking-wider mb-3" style={{ color: 'var(--fg-muted)' }}>{title}</h3>
      {children}
    </div>
  )
}

export default async function PedidoDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const context = await requirePermission('orders.view')
  const canViewFinance = context.permissions.includes('finance.view')
  const { id } = await params
  const pedido = await getPedidoById(id, canViewFinance)
  if (!pedido) notFound()
  const operations = await getOrderOperations(id)

  const itens = (pedido.itens_pedido ?? []) as ItemPedido[]
  const qtdeTotal = itens.reduce((s, i) => s + i.qtde, 0)
  const valorTotal = itens.reduce((s, i) => s + i.qtde * i.valor_unitario, 0)
  const restoPagar = calcularRestoPagar(valorTotal, pedido.valor_entrada ?? 0)
  const isAtrasado = pedido.status === 'cancelado' || isOrderLate(pedido.status, pedido.entrega_programado, todayBusinessDate())

  const vendedor = pedido.vendedor as { nome?: string } | null
  const costureira = pedido.costureira as { nome?: string } | null

  const etapasAtivas = (pedido.etapas_ativas as string[] | null) ?? ['corte', 'costura']
  const STAGES_FILTRADAS = STAGES.filter(s =>
    ['aguardando_corte', 'acabamento', 'entregue'].includes(s.key) || etapasAtivas.includes(s.key)
  )
  const currentStageFiltered = STAGES_FILTRADAS.findIndex(s => s.key === pedido.status)
  const currentStageIdx = currentStageFiltered === -1 ? 0 : currentStageFiltered

  const valorPagoAdicional = pedido.valor_pago_adicional ?? 0
  const ledgerPayments = (pedido.payments ?? []).filter((payment: import('@/types').Payment) => payment.status === 'confirmed')
  const totalRecebido = ledgerPayments.length > 0
    ? ledgerPayments.reduce((sum: number, payment: import('@/types').Payment) => sum + Number(payment.amount || 0), 0)
    : (pedido.valor_entrada ?? 0) + valorPagoAdicional
  const restoPagarAtual = Math.max(0, valorTotal - totalRecebido)
  const statusPagamento = totalRecebido >= valorTotal && valorTotal > 0 ? 'pago' : totalRecebido > 0 ? 'parcial' : 'pendente'

  return (
    <div>
      <Header title={`Pedido #${pedido.numero}`} />

      <div className="p-6 space-y-6">

        {/* Top bar */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Link
              href="/pedidos"
              className="flex items-center gap-1.5 text-sm transition-colors"
              style={{ color: 'var(--fg-muted)' }}
            >
              <ArrowLeft size={15} />
              Voltar
            </Link>
            <span className="text-gray-400 dark:text-gray-600">/</span>
            <span className="text-sm font-semibold" style={{ color: 'var(--fg)' }}>#{pedido.numero}</span>
            <span className="text-sm" style={{ color: 'var(--fg-muted)' }}>{pedido.cliente}</span>
            <StatusBadge status={pedido.status as StatusPedido} />
          </div>
          <Link
            href={`/pedidos/${pedido.id}/imprimir`}
            className="flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-colors bg-green-50 dark:bg-green-950/20 border border-green-200 dark:border-green-800/40 text-green-700 dark:text-green-400 hover:bg-green-100 dark:hover:bg-green-950/40"
          >
            <Printer size={14} />
            Imprimir Pedido
          </Link>
        </div>

        {/* KPI row */}
        <div className={`grid gap-4 ${canViewFinance ? 'grid-cols-4' : 'grid-cols-1'}`}>
          {[
            { label: 'Total de Peças',   value: String(qtdeTotal),              sub: 'unidades' },
            ...(canViewFinance ? [
              { label: 'Valor Total', value: formatBRL(valorTotal), sub: 'do pedido' },
              { label: 'Entrada Paga', value: formatBRL(pedido.valor_entrada), sub: 'recebido' },
              { label: 'Resto a Pagar', value: formatBRL(restoPagar), sub: restoPagar > 0 ? 'pendente' : 'quitado', highlight: restoPagar > 0 },
            ] : []),
          ].map(kpi => (
            <div
              key={kpi.label}
              className={`rounded-xl p-4 border transition-all ${
                kpi.highlight
                  ? 'bg-red-50/50 dark:bg-red-950/10 border-red-200 dark:border-red-900/30'
                  : 'bg-card border-border'
              }`}
            >
              <p className="text-xs mb-1" style={{ color: 'var(--fg-muted)' }}>{kpi.label}</p>
              <p className="text-xl font-bold" style={{ color: 'var(--fg)' }}>{kpi.value}</p>
              <p className={`text-xs mt-0.5 ${kpi.highlight ? 'text-red-500 dark:text-red-400' : 'text-gray-500 dark:text-gray-400'}`}>{kpi.sub}</p>
            </div>
          ))}
        </div>

        {/* Production timeline */}
        {!isAtrasado && (
          <div className="rounded-xl p-5" style={{ background: 'var(--card-bg)', border: '1px solid var(--border-color)' }}>
            <h3 className="text-xs font-semibold uppercase tracking-wider mb-4" style={{ color: 'var(--fg-muted)' }}>Progresso de Produção</h3>
            <div className="flex items-center gap-0">
              {STAGES_FILTRADAS.map((stage, i) => {
                const done = i < currentStageIdx
                const active = i === currentStageIdx
                const { Icon } = stage
                return (
                  <div key={stage.key} className="flex items-center flex-1">
                    <div className="flex flex-col items-center gap-1.5 flex-shrink-0">
                      <div
                        className={`w-9 h-9 rounded-full flex items-center justify-center transition-all border-2 ${
                          done
                            ? 'bg-green-600 border-green-600 text-white'
                            : active
                            ? 'bg-green-50 dark:bg-green-950/20 border-green-600 dark:border-green-500 text-green-700 dark:text-green-400'
                            : 'bg-surface border-border text-muted'
                        }`}
                      >
                        <Icon size={15} />
                      </div>
                      <span className={`text-xs ${
                        done
                          ? 'text-green-700 dark:text-green-400 font-medium'
                          : active
                          ? 'text-foreground font-semibold'
                          : 'text-muted'
                      }`}>
                        {stage.label}
                      </span>
                    </div>
                    {i < STAGES_FILTRADAS.length - 1 && (
                      <div
                        className={`h-0.5 flex-1 mx-1 mb-5 transition-all ${
                          i < currentStageIdx ? 'bg-green-600' : 'bg-border'
                        }`}
                      />
                    )}
                  </div>
                )
              })}
            </div>
          </div>
        )}

        {isAtrasado && (
          <div className="rounded-xl p-4 flex items-center gap-3 bg-red-50 dark:bg-red-950/10 border border-red-200 dark:border-red-900/30">
            <span className="w-2 h-2 rounded-full bg-red-500 animate-pulse" />
            <span className="text-sm font-medium text-red-700 dark:text-red-400">
              {pedido.status === 'cancelado' ? 'Pedido cancelado' : 'Pedido em atraso — entrega prevista para ' + formatDate(pedido.entrega_programado)}
            </span>
          </div>
        )}

        <OrderOperationsWorkspace
          order={{
            id: pedido.id,
            number: pedido.numero,
            customer: pedido.cliente,
            deliveryDate: pedido.entrega_programado,
            artRequired: Boolean((pedido as typeof pedido & { art_required?: boolean }).art_required),
          }}
          items={itens}
          operations={operations}
          permissions={{
            manageArt: context.permissions.includes('art.manage'),
            updateProduction: context.permissions.includes('production.update'),
            createPurchases: context.permissions.includes('purchases.create'),
          }}
        />

        {/* Main info grid */}
        <div className="grid grid-cols-3 gap-4">
          <Card title="Informações Gerais">
            <InfoRow label="Cliente"          value={pedido.cliente} />
            <InfoRow label="Vendedor"          value={vendedor?.nome} />
            <InfoRow label="Data do Pedido"    value={formatDate(pedido.data_pedido)} />
            <InfoRow label="Tipo de Estampa"   value={pedido.tipo_estampa} />
            <InfoRow label="Costureira"        value={costureira?.nome} />
            <InfoRow label="Fornec. Tecido"    value={pedido.fornecedor_tecido} />
          </Card>

          <Card title="Datas de Produção">
            <div className="space-y-1">
              {[
                { label: 'Corte',       prog: pedido.corte_programado,       ret: pedido.corte_retorno },
                { label: labelEtapaEstampa(pedido.tipo_estampa),  prog: pedido.estamparia_programado,  ret: pedido.estamparia_retorno },
                { label: 'Costura',     prog: pedido.costura_programado,     ret: pedido.costura_retorno },
              ].map(row => (
                <div key={row.label} className="flex items-center justify-between py-2" style={{ borderBottom: '1px solid var(--border-subtle)' }}>
                  <span className="text-xs w-20" style={{ color: 'var(--fg-muted)' }}>{row.label}</span>
                  <div className="flex gap-4 text-sm">
                    <span style={{ color: 'var(--fg-muted)' }}>{formatDate(row.prog)}</span>
                    <span className={`font-medium ${row.ret ? 'text-green-600 dark:text-green-400' : 'text-gray-500 dark:text-gray-400'}`}>
                      {row.ret ? '↩ ' + formatDate(row.ret) : '—'}
                    </span>
                  </div>
                </div>
              ))}
              <div className="flex items-center justify-between py-2.5 mt-1 rounded-lg px-2 bg-amber-50 dark:bg-amber-950/20 border border-amber-200 dark:border-amber-900/30">
                <span className="text-xs font-semibold text-amber-800 dark:text-amber-400">Entrega</span>
                <span className="text-sm font-bold text-amber-800 dark:text-amber-400">{formatDate(pedido.entrega_programado)}</span>
              </div>
            </div>
          </Card>

          {canViewFinance && <Card title="Pagamento">
            <div className="flex items-center justify-between mb-3">
              <InfoRow label="Forma de Pagamento" value={pedido.forma_pagamento} />
              <span
                className={`text-xs font-semibold px-2 py-0.5 rounded-full ml-2 shrink-0 border ${
                  statusPagamento === 'pago'
                    ? 'bg-green-50 dark:bg-green-950/20 border-green-200 dark:border-green-900/30 text-green-700 dark:text-green-400'
                    : statusPagamento === 'parcial'
                    ? 'bg-amber-50 dark:bg-amber-950/20 border-amber-200 dark:border-amber-900/30 text-amber-800 dark:text-amber-400'
                    : 'bg-red-50 dark:bg-red-950/20 border-red-200 dark:border-red-900/30 text-red-700 dark:text-red-400'
                }`}
              >
                {statusPagamento === 'pago' ? 'PAGO' : statusPagamento === 'parcial' ? 'PARCIAL' : 'PENDENTE'}
              </span>
            </div>
            <div className="space-y-2">
              <div className="flex justify-between items-center">
                <span className="text-xs" style={{ color: 'var(--fg-muted)' }}>Valor Total</span>
                <span className="text-sm font-bold" style={{ color: 'var(--fg)' }}>{formatBRL(valorTotal)}</span>
              </div>
              {ledgerPayments.length > 0 && (
                <div className="mt-3 pt-3 space-y-1.5" style={{ borderTop: '1px solid var(--border-subtle)' }}>
                  <span className="text-xs font-semibold" style={{ color: 'var(--fg-muted)' }}>Lançamentos</span>
                  {ledgerPayments.map((payment: import('@/types').Payment) => (
                    <div key={payment.id} className="flex justify-between text-xs" style={{ color: 'var(--fg-muted)' }}>
                      <span>{payment.payment_date} · {payment.payment_method}</span>
                      <span className="font-medium text-green-700 dark:text-green-400">{formatBRL(Number(payment.amount))}</span>
                    </div>
                  ))}
                </div>
              )}
              <div className="flex justify-between items-center">
                <span className="text-xs" style={{ color: 'var(--fg-muted)' }}>Entrada</span>
                <span className="text-sm text-green-700 dark:text-green-400">– {formatBRL(pedido.valor_entrada)}</span>
              </div>
              {valorPagoAdicional > 0 && (
                <div className="flex justify-between items-center">
                  <span className="text-xs" style={{ color: 'var(--fg-muted)' }}>Pago adicional</span>
                  <span className="text-sm text-green-700 dark:text-green-400">– {formatBRL(valorPagoAdicional)}</span>
                </div>
              )}
              <div className="flex justify-between items-center">
                <span className="text-xs" style={{ color: 'var(--fg-muted)' }}>Total recebido</span>
                <span className="text-sm font-semibold text-green-700 dark:text-green-400">{formatBRL(totalRecebido)}</span>
              </div>
              <div className="h-px" style={{ background: 'var(--border-subtle)' }} />
              <div className="flex justify-between items-center pt-1">
                <span className={`text-xs font-semibold ${restoPagarAtual > 0 ? 'text-red-600 dark:text-red-400' : 'text-green-700 dark:text-green-400'}`}>Resto a Pagar</span>
                <span className={`text-base font-bold ${restoPagarAtual > 0 ? 'text-red-600 dark:text-red-400' : 'text-green-700 dark:text-green-400'}`}>{formatBRL(restoPagarAtual)}</span>
              </div>
              {pedido.embalagem_numero_nf && (
                <div className="mt-3 pt-3" style={{ borderTop: '1px solid var(--border-subtle)' }}>
                  <InfoRow label="N° NF" value={pedido.embalagem_numero_nf} />
                  <InfoRow label="Data NF" value={formatDate(pedido.embalagem_data_nf)} />
                </div>
              )}
            </div>
            {statusPagamento !== 'pago' && restoPagarAtual > 0 && (
              <RegistrarPagamentoModal pedidoId={pedido.id} restoPagar={restoPagarAtual} />
            )}
          </Card>}
        </div>

        {/* Corte details — only if filled */}
        {(pedido.corte_cortador || pedido.corte_consumo_tecido || pedido.corte_situacao) && (
          <Card title="Dados do Corte">
            <div className="grid grid-cols-4 gap-4">
              <InfoRow label="Cortador(a)"        value={exibirCortador(pedido.corte_cortador)} />
              <InfoRow label="Consumo Tecido"     value={pedido.corte_consumo_tecido != null ? `${pedido.corte_consumo_tecido} kg` : null} />
              <InfoRow label="Ribana"             value={pedido.corte_codigo_ribana ? `${pedido.corte_codigo_ribana} / ${pedido.corte_consumo_ribana ?? '--'} kg` : null} />
              <InfoRow label="Gola"               value={pedido.corte_codigo_gola ? `${pedido.corte_codigo_gola} / ${pedido.corte_consumo_gola ?? '--'} un` : null} />
              <InfoRow label="Início Previsto"    value={formatDate(pedido.corte_inicio_previsto)} />
              <InfoRow label="Início Real"        value={formatDate(pedido.corte_inicio_real)} />
              <InfoRow label="Fim Previsto"       value={formatDate(pedido.corte_fim_previsto)} />
              <InfoRow label="Fim Real"           value={formatDate(pedido.corte_fim_real)} />
            </div>
            {pedido.corte_observacoes && (
              <div className="mt-3 p-3 rounded-lg text-sm" style={{ background: 'var(--surface-subtle)', color: 'var(--fg-muted)' }}>
                {pedido.corte_observacoes}
              </div>
            )}
          </Card>
        )}

        {/* Acabamento e Embalagem */}
        <SecaoEmbalagem pedido={{
          ...pedido,
          valor_entrada: canViewFinance ? pedido.valor_entrada : 0,
          valor_pago_adicional: canViewFinance ? pedido.valor_pago_adicional : 0,
          forma_pagamento: canViewFinance ? pedido.forma_pagamento : null,
          status_pagamento: canViewFinance ? pedido.status_pagamento : null,
          itens_pedido: itens.map((item) => ({
            ...item,
            valor_unitario: canViewFinance ? item.valor_unitario : 0,
          })),
          itens: itens.map((item) => ({
            ...item,
            valor_unitario: canViewFinance ? item.valor_unitario : 0,
          })),
        } as unknown as import('@/types').Pedido} />

        {/* Items table */}
        <Card title={`Itens do Pedido (${qtdeTotal} peças)`}>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr style={{ borderBottom: '1px solid var(--border-subtle)' }}>
                  {['Qtde','Tam.','Modelo','Tecido/Cor','Manga','Gola','Acabamento',...(canViewFinance ? ['Vl. Unit.','Total'] : [])].map(h => (
                    <th key={h} className="pb-2.5 text-left text-xs font-medium pr-4" style={{ color: 'var(--fg-muted)' }}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {itens.map((item, i) => {
                  const parsed = parseModeloParts({
                    modelo: item.modelo,
                    manga: item.manga,
                    gola: item.gola,
                    acabamento: item.acabamento
                  })
                  return (
                    <tr
                      key={item.id ?? i}
                      className="transition-colors"
                      style={{ borderBottom: '1px solid var(--border-subtle)' }}
                    >
                      <td className="py-2.5 pr-4 font-semibold" style={{ color: 'var(--fg)' }}>{item.qtde}</td>
                      <td className="py-2.5 pr-4" style={{ color: 'var(--fg-secondary)' }}>{formatTamanho(item.tamanho)}</td>
                      <td className="py-2.5 pr-4" style={{ color: 'var(--fg-secondary)' }}>{parsed.modelo || '--'}</td>
                      <td className="py-2.5 pr-4" style={{ color: 'var(--fg-muted)' }}>{item.tecido_cor || '--'}</td>
                      <td className="py-2.5 pr-4" style={{ color: 'var(--fg-muted)' }}>{parsed.manga || '--'}</td>
                      <td className="py-2.5 pr-4" style={{ color: 'var(--fg-muted)' }}>{parsed.gola || '--'}</td>
                      <td className="py-2.5 pr-4" style={{ color: 'var(--fg-muted)' }}>{parsed.acabamento || '--'}</td>
                      {canViewFinance && <td className="py-2.5 pr-4" style={{ color: 'var(--fg-muted)' }}>{formatBRL(item.valor_unitario)}</td>}
                      {canViewFinance && <td className="py-2.5 font-semibold" style={{ color: 'var(--fg)' }}>{formatBRL(item.qtde * item.valor_unitario)}</td>}
                    </tr>
                  )
                })}
              </tbody>
              {canViewFinance && <tfoot>
                <tr style={{ borderTop: '1px solid var(--border-color)' }}>
                  <td colSpan={7} className="pt-3 text-xs" style={{ color: 'var(--fg-muted)' }}>Total</td>
                  <td />
                  <td className="pt-3 font-bold" style={{ color: 'var(--fg)' }}>{formatBRL(valorTotal)}</td>
                </tr>
              </tfoot>}
            </table>
          </div>
        </Card>

        {/* Observations */}
        {pedido.observacoes && (
          <Card title="Observações">
            <p className="text-sm" style={{ color: 'var(--fg-muted)' }}>{pedido.observacoes}</p>
          </Card>
        )}

        {!['cancelado', 'entregue', 'rascunho'].includes(pedido.status) && (
          <BotaoCancelarPedido pedidoId={pedido.id} numeroPedido={pedido.numero} />
        )}

      </div>
    </div>
  )
}
