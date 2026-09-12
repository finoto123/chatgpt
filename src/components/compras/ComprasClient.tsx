'use client'

import { useState, useMemo } from 'react'
import { Printer, AlertTriangle, ShoppingCart, TrendingDown, Truck } from 'lucide-react'
import { KpiCard } from '@/components/shared/KpiCard'
import { formatBRL } from '@/lib/utils'
import { EstoqueAtual, SituacaoEstoque } from '@/types'

interface ComprasClientProps {
  tecidos: EstoqueAtual[]
}

const SITUACAO_CONFIG: Record<SituacaoEstoque, { label: string; bg: string; color: string }> = {
  COMPRAR: { label: 'COMPRAR', bg: 'rgba(239,68,68,0.12)', color: '#dc2626' },
  ATENÇÃO: { label: 'ATENÇÃO', bg: 'rgba(245,158,11,0.12)', color: '#b45309' },
  OK: { label: 'OK', bg: 'rgba(34,197,94,0.12)', color: '#15803d' },
}

export function ComprasClient({ tecidos }: ComprasClientProps) {
  // Estado para quantidades editáveis (tecido.id -> quantidade)
  const [quantidades, setQuantidades] = useState<Record<string, number>>(() => {
    const inicial: Record<string, number> = {}
    tecidos.forEach(t => {
      const deficit = (t.estoque_minimo ?? 0) - (t.estoque_atual ?? 0)
      inicial[t.id] = Math.max(0, deficit)
    })
    return inicial
  })

  const tecidosParaComprar = useMemo(() => tecidos.filter(t => t.situacao === 'COMPRAR'), [tecidos])
  const tecidosAtencao = useMemo(() => tecidos.filter(t => t.situacao === 'ATENÇÃO'), [tecidos])

  const valorEstimado = useMemo(() => {
    return tecidos.reduce((soma, t) => {
      const qtde = quantidades[t.id] ?? 0
      const valorUnit = t.valor_unitario ?? 0
      return soma + qtde * valorUnit
    }, 0)
  }, [tecidos, quantidades])

  // Agrupa tecidos por fornecedor
  const grupos = useMemo(() => {
    const mapa = new Map<string, EstoqueAtual[]>()
    tecidos.forEach(t => {
      const fornecedor = t.fornecedor ?? 'Sem Fornecedor'
      if (!mapa.has(fornecedor)) mapa.set(fornecedor, [])
      mapa.get(fornecedor)!.push(t)
    })
    return Array.from(mapa.entries()).sort(([a], [b]) => a.localeCompare(b))
  }, [tecidos])

  const subtotalPorFornecedor = useMemo(() => {
    const mapa: Record<string, number> = {}
    grupos.forEach(([fornecedor, items]) => {
      mapa[fornecedor] = items.reduce((s, t) => {
        const qtde = quantidades[t.id] ?? 0
        const valorUnit = t.valor_unitario ?? 0
        return s + qtde * valorUnit
      }, 0)
    })
    return mapa
  }, [grupos, quantidades])

  const atualizarQuantidade = (id: string, valor: string) => {
    const num = parseFloat(valor)
    setQuantidades(prev => ({ ...prev, [id]: isNaN(num) ? 0 : Math.max(0, num) }))
  }

  return (
    <>
      <style>{`
        @media print {
          .no-print { display: none !important; }
          nav, aside, header { display: none !important; }
          @page { margin: 15mm; }
          body { font-size: 11px; }
          table { border-collapse: collapse; width: 100%; }
          th, td { border: 1px solid #ccc; padding: 4px 6px; }
        }
      `}</style>

      <div className="p-6 space-y-6">
        {/* KPI Cards */}
        <div className="grid grid-cols-3 gap-4 no-print">
          <KpiCard
            title="Para Comprar"
            value={tecidosParaComprar.length}
            icon={<ShoppingCart size={18} />}
            alert={tecidosParaComprar.length > 0}
          />
          <KpiCard
            title="Em Atenção"
            value={tecidosAtencao.length}
            icon={<AlertTriangle size={18} />}
          />
          <KpiCard
            title="Valor Estimado de Compra"
            value={formatBRL(valorEstimado)}
            icon={<TrendingDown size={18} />}
          />
        </div>

        {/* Barra de ação */}
        <div className="flex justify-between items-center no-print">
          <p className="text-sm" style={{ color: 'var(--fg-muted)' }}>
            {tecidos.length} {tecidos.length === 1 ? 'item' : 'itens'} que precisam de reposição
          </p>
          <button
            onClick={() => window.print()}
            className="flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-colors"
            style={{ border: '1px solid #16a34a', color: '#16a34a' }}
          >
            <Printer size={16} />
            Gerar Lista de Compras
          </button>
        </div>

        {/* Título para impressão */}
        <div className="hidden print:block text-center mb-4">
          <h1 className="text-xl font-bold">Selma Bordados e Confecções</h1>
          <h2 className="text-base">Lista de Compras — {new Date().toLocaleDateString('pt-BR')}</h2>
        </div>

        {tecidos.length === 0 ? (
          <div
            className="rounded-xl p-12 text-center"
            style={{ background: 'var(--card-bg)', border: '1px solid var(--border-color)' }}
          >
            <ShoppingCart size={40} className="mx-auto mb-3" style={{ color: 'var(--fg-muted)' }} />
            <p className="font-medium" style={{ color: 'var(--fg-secondary)' }}>Nenhum item para comprar</p>
            <p className="text-sm mt-1" style={{ color: 'var(--fg-muted)' }}>Todos os tecidos estão com estoque adequado</p>
          </div>
        ) : (
          <div
            className="rounded-xl overflow-hidden"
            style={{ background: 'var(--card-bg)', border: '1px solid var(--border-color)', boxShadow: 'var(--shadow-sm)' }}
          >
            <table className="w-full text-sm">
              <thead style={{ background: 'var(--input-bg)', borderBottom: '1px solid var(--border-color)' }}>
                <tr className="text-xs uppercase tracking-wide" style={{ color: 'var(--fg-muted)' }}>
                  <th className="text-left px-4 py-3 font-medium">Código</th>
                  <th className="text-left px-4 py-3 font-medium">Descrição</th>
                  <th className="text-center px-3 py-3 font-medium">Unid.</th>
                  <th className="text-right px-3 py-3 font-medium">Estoque Atual</th>
                  <th className="text-right px-3 py-3 font-medium">Mín.</th>
                  <th className="text-right px-3 py-3 font-medium">Déficit</th>
                  <th className="text-right px-3 py-3 font-medium no-print">Qtde a Comprar</th>
                  <th className="text-right px-3 py-3 font-medium">Valor Unit.</th>
                  <th className="text-right px-3 py-3 font-medium">Valor Est.</th>
                  <th className="text-center px-3 py-3 font-medium">Situação</th>
                </tr>
              </thead>
              <tbody>
                {grupos.map(([fornecedor, items]) => {
                  const subtotal = subtotalPorFornecedor[fornecedor] ?? 0
                  return [
                    <tr key={`header-${fornecedor}`} style={{ background: 'var(--input-bg)', borderBottom: '1px solid var(--border-color)' }}>
                      <td colSpan={10} className="px-4 py-2.5 text-xs font-semibold" style={{ color: 'var(--fg-muted)' }}>
                        <div className="flex items-center gap-2">
                          <Truck size={14} style={{ color: 'var(--fg-muted)' }} />
                          FORNECEDOR: {fornecedor}
                        </div>
                      </td>
                    </tr>,
                    ...items.map(tecido => {
                      const deficit = (tecido.estoque_minimo ?? 0) - (tecido.estoque_atual ?? 0)
                      const qtde = quantidades[tecido.id] ?? 0
                      const valorUnit = tecido.valor_unitario ?? 0
                      const valorEst = qtde * valorUnit
                      const situacao = SITUACAO_CONFIG[tecido.situacao]
                      const rowBg = tecido.situacao === 'COMPRAR'
                        ? 'rgba(239,68,68,0.08)'
                        : tecido.situacao === 'ATENÇÃO'
                        ? 'rgba(245,158,11,0.08)'
                        : 'transparent'

                      return (
                        <tr
                          key={tecido.id}
                          className="hover-item transition-colors"
                          style={{ borderBottom: '1px solid var(--border-subtle)', background: rowBg }}
                        >
                          <td className="px-4 py-3 font-mono text-xs" style={{ color: 'var(--fg-muted)' }}>{tecido.codigo}</td>
                          <td className="px-4 py-3 font-medium max-w-[180px]" style={{ color: 'var(--fg)' }}>
                            <span className="truncate block" title={tecido.descricao}>{tecido.descricao}</span>
                          </td>
                          <td className="px-3 py-3 text-center" style={{ color: 'var(--fg-muted)' }}>{tecido.unidade}</td>
                          <td
                            className="px-3 py-3 text-right font-medium"
                            style={{ color: tecido.estoque_atual <= 0 ? '#dc2626' : '#b45309' }}
                          >
                            {Number(tecido.estoque_atual).toLocaleString('pt-BR', { maximumFractionDigits: 3 })}
                          </td>
                          <td className="px-3 py-3 text-right" style={{ color: 'var(--fg-muted)' }}>
                            {Number(tecido.estoque_minimo).toLocaleString('pt-BR', { maximumFractionDigits: 3 })}
                          </td>
                          <td
                            className="px-3 py-3 text-right font-medium"
                            style={{ color: deficit > 0 ? '#dc2626' : '#9ca3af' }}
                          >
                            {deficit > 0 ? `-${Number(deficit).toLocaleString('pt-BR', { maximumFractionDigits: 3 })}` : '0'}
                          </td>
                          <td className="px-3 py-3 text-right no-print">
                            <input
                              type="number"
                              min="0"
                              step="0.001"
                              value={qtde}
                              onChange={e => atualizarQuantidade(tecido.id, e.target.value)}
                              className="w-24 text-right rounded px-2 py-1 text-sm focus:outline-none"
                              style={{ background: 'var(--input-bg)', border: '1px solid var(--border-medium)', color: 'var(--fg)' }}
                            />
                          </td>
                          <td className="px-3 py-3 text-right" style={{ color: 'var(--fg-muted)' }}>
                            {valorUnit > 0 ? formatBRL(valorUnit) : '—'}
                          </td>
                          <td className="px-3 py-3 text-right font-medium" style={{ color: 'var(--fg)' }}>
                            {valorEst > 0 ? formatBRL(valorEst) : '—'}
                          </td>
                          <td className="px-3 py-3 text-center">
                            <span
                              className="inline-flex items-center px-2 py-0.5 rounded text-xs font-semibold"
                              style={{ background: situacao.bg, color: situacao.color }}
                            >
                              {situacao.label}
                            </span>
                          </td>
                        </tr>
                      )
                    }),
                    <tr
                      key={`subtotal-${fornecedor}`}
                      style={{ background: 'var(--input-bg)', borderBottom: '1px solid var(--border-color)' }}
                    >
                      <td colSpan={8} className="px-4 py-2.5 text-right text-xs font-medium" style={{ color: 'var(--fg-muted)' }}>
                        Subtotal {fornecedor}:
                      </td>
                      <td className="px-3 py-2.5 text-right text-sm font-semibold" style={{ color: 'var(--fg)' }}>
                        {subtotal > 0 ? formatBRL(subtotal) : '—'}
                      </td>
                      <td />
                    </tr>,
                  ]
                })}

                <tr style={{ borderTop: '2px solid var(--border-medium)', background: 'var(--input-bg)' }}>
                  <td colSpan={8} className="px-4 py-3 text-right font-bold" style={{ color: 'var(--fg-muted)' }}>
                    Total Geral:
                  </td>
                  <td className="px-3 py-3 text-right font-bold text-lg" style={{ color: '#15803d' }}>
                    {formatBRL(valorEstimado)}
                  </td>
                  <td />
                </tr>
              </tbody>
            </table>
          </div>
        )}
      </div>
    </>
  )
}
