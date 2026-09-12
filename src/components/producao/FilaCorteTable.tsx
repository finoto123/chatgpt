'use client'

import { useState, useMemo } from 'react'
import { Pencil, Scissors, Clock, AlertTriangle } from 'lucide-react'
import { formatDate, exibirCortador } from '@/lib/utils'
import { DetalhesOrdemDrawer } from './DetalhesOrdemDrawer'

interface ItemPedidoCorte {
  tamanho: string
  qtde: number
  modelo: string
  tecido_cor: string | null
}

interface PedidoCorte {
  id: string
  numero: string
  cliente: string
  entrega_programado: string
  status: string
  corte_cortador: string | null
  corte_codigo_ribana: string | null
  corte_consumo_ribana: number | null
  corte_codigo_gola: string | null
  corte_consumo_gola: number | null
  corte_situacao: string | null
  corte_inicio_previsto: string | null
  corte_inicio_real: string | null
  corte_fim_previsto: string | null
  corte_fim_real: string | null
  corte_consumo_tecido: number | null
  corte_observacoes: string | null
  itens_pedido: ItemPedidoCorte[]
}

interface FilaCorteTableProps {
  pedidos: PedidoCorte[]
}

const SITUACAO_CONFIG: Record<string, { label: string; className: string }> = {
  'FINALIZADO': { label: 'Finalizado', className: 'text-green-600 dark:text-green-400 bg-green-50 dark:bg-green-950/20 border-green-200 dark:border-green-800/30' },
  'EM ANDAMENTO': { label: 'Em Andamento', className: 'text-blue-600 dark:text-blue-400 bg-blue-50 dark:bg-blue-950/20 border-blue-200 dark:border-blue-800/30' },
  'AGUARDANDO CORTE': { label: 'Aguardando Corte', className: 'text-gray-600 dark:text-gray-400 bg-gray-50 dark:bg-gray-950/20 border-gray-200 dark:border-gray-800/30' },
  'ATRASADO': { label: 'Atrasado', className: 'text-red-600 dark:text-red-400 bg-red-50 dark:bg-red-950/20 border-red-200 dark:border-red-800/30' },
}

function SituacaoBadge({ situacao }: { situacao: string | null }) {
  const cfg = SITUACAO_CONFIG[situacao ?? 'AGUARDANDO CORTE'] ?? SITUACAO_CONFIG['AGUARDANDO CORTE']
  return (
    <span className={`px-2.5 py-0.5 rounded-full text-xs font-semibold border ${cfg.className}`}>
      {cfg.label}
    </span>
  )
}

function formatGrade(itens: ItemPedidoCorte[]): string {
  if (!itens || itens.length === 0) return '—'
  return itens.map(i => `${formatTamanho(i.tamanho)}/${i.qtde}`).join(' ')
}

function formatTamanho(tam: string | number | null): string {
  if (tam === null || tam === undefined) return '—'
  const s = String(tam)
  return s.endsWith('.0') ? s.slice(0, -2) : s
}



export function FilaCorteTable({ pedidos }: FilaCorteTableProps) {
  const [selectedPedido, setSelectedPedido] = useState<PedidoCorte | null>(null)
  const [filtroAtivo, setFiltroAtivo] = useState<string | null>(null)
  const totalAtrasados = pedidos.filter(p => p.corte_situacao === 'ATRASADO').length
  const totalAndamento = pedidos.filter(p => p.corte_situacao === 'EM ANDAMENTO').length
  const totalFila = pedidos.filter(p => p.corte_situacao !== 'FINALIZADO').length

  const pedidosFiltrados = useMemo(() => {
    return pedidos.filter(p => {
      const sit = p.corte_situacao || 'AGUARDANDO CORTE'
      if (!filtroAtivo) return sit !== 'FINALIZADO' // Default esconde finalizados
      if (filtroAtivo === 'pendente') return sit === 'AGUARDANDO CORTE' || sit === 'PENDENTE'
      if (filtroAtivo === 'em_andamento') return sit === 'EM ANDAMENTO'
      if (filtroAtivo === 'finalizado') return sit === 'FINALIZADO'
      if (filtroAtivo === 'atrasado') return sit === 'ATRASADO'
      return true
    })
  }, [pedidos, filtroAtivo])

  return (
    <>
      {/* KPI counters as clickable filters */}
      <div className="grid grid-cols-3 gap-4 mb-6">
        {[
          { id: null,           title: 'Total na Fila', value: totalFila,        icon: <Scissors size={18} />,       activeClass: 'border-brand-green bg-green-50 dark:bg-green-950/10' },
          { id: 'em_andamento', title: 'Em Andamento',  value: totalAndamento,   icon: <Clock size={18} />,          activeClass: 'border-blue-600 dark:border-blue-400 bg-blue-50 dark:bg-blue-950/10' },
          { id: 'atrasado',     title: 'Em Atraso',     value: totalAtrasados,   icon: <AlertTriangle size={18} />,  activeClass: 'border-orange-500 dark:border-orange-400 bg-orange-50 dark:bg-orange-950/10', alert: totalAtrasados > 0 },
        ].map(card => (
          <div
            key={card.id ?? 'total'}
            onClick={() => setFiltroAtivo(card.id)}
            className={`cursor-pointer rounded-xl p-5 border-2 transition-all bg-card ${
              filtroAtivo === card.id
                ? card.activeClass
                : 'border-border-medium hover:border-gray-500'
            }`}
          >
            <div className={`flex items-center gap-2 mb-2 ${card.alert ? 'text-red-600 dark:text-red-400' : 'text-muted'}`}>
              {card.icon}
              <p className="text-xs font-medium uppercase tracking-wide">
                {card.title}
              </p>
            </div>
            <p className={`text-3xl font-bold ${
              card.alert && card.value > 0 ? 'text-orange-600 dark:text-orange-400' : 'text-foreground'
            }`}>
              {card.value}
            </p>
            {filtroAtivo === card.id && (
              <p className="text-xs text-green-600 dark:text-green-400 mt-1">● Filtrando</p>
            )}
          </div>
        ))}
      </div>

      <div className="flex items-center gap-2 mb-4 flex-wrap">
        <span className="text-xs text-gray-500 mr-1">Ver:</span>
        {[
          { valor: null,          label: 'Todos da Fila' },
          { valor: 'pendente',    label: 'Aguardando' },
          { valor: 'em_andamento',label: 'Em Andamento' },
          { valor: 'atrasado',    label: 'Atrasado' },
        ].map(f => (
          <button
            key={String(f.valor)}
            onClick={() => setFiltroAtivo(f.valor)}
            className={`px-3 py-1.5 rounded-full text-xs font-medium border transition-all ${
              filtroAtivo === f.valor
                ? 'bg-[#1e7e3e] text-white border-[#1e7e3e]'
                : 'bg-transparent text-muted border-border-medium hover:border-gray-500 hover:text-foreground'
            }`}
          >
            {f.label}
          </button>
        ))}
        {filtroAtivo && (
          <button
            onClick={() => setFiltroAtivo(null)}
            className="text-xs text-muted hover:text-foreground px-2 ml-1"
          >
            ✕ Limpar
          </button>
        )}
        <span className="text-xs text-muted ml-auto">
          {pedidosFiltrados.length} de {pedidos.length} pedidos
        </span>
      </div>
      <div
        className="rounded-xl overflow-hidden"
        style={{ background: 'var(--card-bg)', border: '1px solid var(--border-color)', boxShadow: 'var(--shadow-sm)' }}
      >
        <table className="w-full text-sm">
          <thead style={{ background: 'var(--input-bg)', borderBottom: '1px solid var(--border-color)' }}>
            <tr>
              {['N° Pedido', 'Cliente', 'Entrega', 'Cortador(a)', 'Ribana', 'Gola', 'TAM/QTDE', 'Situação', 'Ação'].map(h => (
                <th key={h} className="px-4 py-3 text-left text-xs font-medium uppercase tracking-wide" style={{ color: 'var(--fg-muted)' }}>
                  {h}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {pedidosFiltrados.length === 0 ? (
              <tr>
                <td colSpan={9} className="text-center py-10" style={{ color: 'var(--fg-muted)' }}>
                  Nenhuma ordem de corte encontrada
                </td>
              </tr>
            ) : pedidosFiltrados.map(pedido => {
              const atrasado = pedido.corte_situacao === 'ATRASADO'
              return (
                <tr
                  key={pedido.id}
                  className="transition-colors hover-item"
                  style={{
                    borderBottom: '1px solid var(--border-subtle)',
                    background: atrasado ? 'rgba(239,68,68,0.08)' : 'transparent',
                  }}
                >
                  <td className="px-4 py-3 font-semibold" style={{ color: 'var(--fg)' }}>#{pedido.numero}</td>
                  <td className="px-4 py-3 max-w-[160px]" style={{ color: 'var(--fg-secondary)' }}>
                    <span className="truncate block" title={pedido.cliente}>{pedido.cliente}</span>
                  </td>
                  <td className="px-4 py-3 font-medium" style={{ color: atrasado ? '#EF4444' : 'var(--fg-secondary)' }}>
                    {formatDate(pedido.entrega_programado)}
                  </td>
                  <td className="px-4 py-3" style={{ color: 'var(--fg-muted)' }}>{exibirCortador(pedido.corte_cortador)}</td>
                  <td className="px-4 py-3 text-xs" style={{ color: 'var(--fg-muted)' }}>
                    {pedido.corte_codigo_ribana
                      ? `${pedido.corte_codigo_ribana} / ${pedido.corte_consumo_ribana ?? 0}kg`
                      : '—'}
                  </td>
                  <td className="px-4 py-3 text-xs" style={{ color: 'var(--fg-muted)' }}>
                    {pedido.corte_codigo_gola
                      ? `${pedido.corte_codigo_gola} / ${pedido.corte_consumo_gola ?? 0}un`
                      : '—'}
                  </td>
                  <td className="px-4 py-3 text-xs font-mono" style={{ color: 'var(--fg-muted)' }}>
                    {formatGrade(pedido.itens_pedido)}
                  </td>
                  <td className="px-4 py-3">
                    <SituacaoBadge situacao={pedido.corte_situacao} />
                  </td>
                  <td className="px-4 py-3">
                    <button
                      className="p-1.5 rounded-md transition-colors"
                      style={{ color: 'var(--fg-muted)' }}
                      onClick={() => setSelectedPedido(pedido)}
                      title="Editar ordem de corte"
                    >
                      <Pencil size={15} />
                    </button>
                  </td>
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>

      {selectedPedido && (
        <DetalhesOrdemDrawer
          key={selectedPedido.id}
          pedido={selectedPedido}
          open={true}
          onClose={() => setSelectedPedido(null)}
        />
      )}
    </>
  )
}
