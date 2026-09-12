'use client'

import { useMemo, useState } from 'react'
import { ChevronDown, ChevronLeft, ChevronRight, ChevronUp, ChevronsUpDown } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { RegistrarPagamentoModal } from '@/components/pedidos/RegistrarPagamentoModal'
import { formatBRL, formatDate } from '@/lib/utils'
import type { RecebimentoPedido } from '@/lib/supabase/queries/financeiro'

const ANO_ATUAL = new Date().getFullYear()
const ITENS_POR_PAGINA = 20

const STATUS_PAGAMENTO: Record<string, { label: string; bg: string; color: string }> = {
  pago: { label: 'PAGO', bg: 'rgba(34,197,94,0.12)', color: '#15803d' },
  parcial: { label: 'PARCIAL', bg: 'rgba(245,158,11,0.12)', color: '#b45309' },
  pendente: { label: 'PENDENTE', bg: 'rgba(239,68,68,0.12)', color: '#dc2626' },
}

type Coluna =
  | 'numero'
  | 'cliente'
  | 'vendedor'
  | 'entrega_programado'
  | 'valor_total'
  | 'valor_entrada'
  | 'valor_pago_adicional'
  | 'resto'
  | 'status_pagamento'

type Direcao = 'asc' | 'desc'

function IconeOrdem({ ativa, direcao }: { ativa: boolean; direcao: Direcao }) {
  if (!ativa) return <ChevronsUpDown size={13} className="opacity-35" />
  return direcao === 'asc' ? <ChevronUp size={13} /> : <ChevronDown size={13} />
}

function ThOrdenavel({
  col,
  label,
  colAtual,
  direcao,
  onOrdenar,
  className,
}: {
  col: Coluna
  label: string
  colAtual: Coluna
  direcao: Direcao
  onOrdenar: (col: Coluna) => void
  className?: string
}) {
  return (
    <th
      className={`px-3 py-3 font-medium cursor-pointer select-none hover:opacity-80 transition-opacity ${className ?? ''}`}
      onClick={() => onOrdenar(col)}
    >
      <span className="inline-flex items-center gap-1">
        {label}
        <IconeOrdem ativa={col === colAtual} direcao={direcao} />
      </span>
    </th>
  )
}

function getResto(r: RecebimentoPedido) {
  return Math.max(0, r.valor_total - r.valor_entrada - r.valor_pago_adicional)
}

export function TabelaRecebimentos({ recebimentos }: { recebimentos: RecebimentoPedido[] }) {
  const [colOrdem, setColOrdem] = useState<Coluna>('entrega_programado')
  const [direcao, setDirecao] = useState<Direcao>('desc')
  const [pagina, setPagina] = useState(1)

  const alternarOrdem = (col: Coluna) => {
    if (col === colOrdem) {
      setDirecao(d => (d === 'asc' ? 'desc' : 'asc'))
    } else {
      setColOrdem(col)
      setDirecao('asc')
    }
    setPagina(1)
  }

  const ordenados = useMemo(() => {
    return [...recebimentos].sort((a, b) => {
      let va: string | number
      let vb: string | number

      switch (colOrdem) {
        case 'numero': va = a.numero; vb = b.numero; break
        case 'cliente': va = a.cliente; vb = b.cliente; break
        case 'vendedor': va = a.vendedor?.nome ?? ''; vb = b.vendedor?.nome ?? ''; break
        case 'entrega_programado': va = a.entrega_programado; vb = b.entrega_programado; break
        case 'valor_total': va = a.valor_total; vb = b.valor_total; break
        case 'valor_entrada': va = a.valor_entrada; vb = b.valor_entrada; break
        case 'valor_pago_adicional': va = a.valor_pago_adicional; vb = b.valor_pago_adicional; break
        case 'resto': va = getResto(a); vb = getResto(b); break
        case 'status_pagamento': va = a.status_pagamento; vb = b.status_pagamento; break
        default: va = ''; vb = ''
      }

      const cmp =
        typeof va === 'number'
          ? va - (vb as number)
          : String(va).localeCompare(String(vb), 'pt-BR')

      return direcao === 'asc' ? cmp : -cmp
    })
  }, [recebimentos, colOrdem, direcao])

  const totalPaginas = Math.max(1, Math.ceil(ordenados.length / ITENS_POR_PAGINA))
  const inicio = (pagina - 1) * ITENS_POR_PAGINA
  const paginaAtual = ordenados.slice(inicio, inicio + ITENS_POR_PAGINA)

  const totalValor = recebimentos.reduce((s, r) => s + r.valor_total, 0)
  const totalEntradas = recebimentos.reduce((s, r) => s + r.valor_entrada, 0)
  const totalAdicionais = recebimentos.reduce((s, r) => s + r.valor_pago_adicional, 0)
  const totalRecebido = totalEntradas + totalAdicionais
  const totalPendente = recebimentos.reduce((s, r) => s + getResto(r), 0)

  const thProps = { colAtual: colOrdem, direcao, onOrdenar: alternarOrdem }

  return (
    <>
      <div className="overflow-x-auto">
        <table className="w-full text-sm min-w-[1120px]">
          <thead style={{ background: 'var(--input-bg)', borderBottom: '1px solid var(--border-color)' }}>
            <tr className="text-xs uppercase tracking-wide" style={{ color: 'var(--fg-muted)' }}>
              <ThOrdenavel col="numero" label="N° Pedido" {...thProps} className="text-left" />
              <ThOrdenavel col="cliente" label="Cliente" {...thProps} className="text-left" />
              <ThOrdenavel col="vendedor" label="Vendedor" {...thProps} className="text-left" />
              <ThOrdenavel col="entrega_programado" label="Entrega" {...thProps} className="text-center" />
              <ThOrdenavel col="valor_total" label="Valor Total" {...thProps} className="text-right" />
              <ThOrdenavel col="valor_entrada" label="Entrada" {...thProps} className="text-right" />
              <ThOrdenavel col="valor_pago_adicional" label="Pago Adic." {...thProps} className="text-right" />
              <ThOrdenavel col="resto" label="Resto" {...thProps} className="text-right" />
              <th className="text-center px-3 py-3 font-medium">Forma Pgto.</th>
              <ThOrdenavel col="status_pagamento" label="Status" {...thProps} className="text-center" />
              <th className="text-center px-3 py-3 font-medium">Baixa</th>
            </tr>
          </thead>
          <tbody>
            {paginaAtual.length === 0 ? (
              <tr>
                <td colSpan={11} className="text-center py-12" style={{ color: 'var(--fg-muted)' }}>
                  Nenhum recebimento encontrado
                </td>
              </tr>
            ) : (
              paginaAtual.map(r => {
                const restoPagar = getResto(r)
                const statusPag = r.status_pagamento as 'pago' | 'parcial' | 'pendente'
                const statusConf = STATUS_PAGAMENTO[statusPag] ?? STATUS_PAGAMENTO.pendente

                return (
                  <tr
                    key={r.id}
                    className="transition-colors hover-item"
                    style={{ borderBottom: '1px solid var(--border-subtle)' }}
                  >
                    <td className="px-3 py-3 font-mono text-xs font-semibold" style={{ color: 'var(--fg)' }}>#{r.numero}</td>
                    <td className="px-3 py-3 font-medium max-w-[160px]" style={{ color: 'var(--fg-secondary)' }}>
                      <span className="truncate block" title={r.cliente}>{r.cliente}</span>
                    </td>
                    <td className="px-3 py-3" style={{ color: 'var(--fg-muted)' }}>{r.vendedor?.nome ?? '---'}</td>
                    <td className="px-3 py-3 text-center" style={{ color: 'var(--fg-muted)' }}>
                      {r.entrega_programado === `${ANO_ATUAL}-12-31`
                        ? <span className="italic text-xs" style={{ color: 'var(--fg-muted)' }}>sem data</span>
                        : formatDate(r.entrega_programado)}
                    </td>
                    <td className="px-3 py-3 text-right font-medium" style={{ color: 'var(--fg)' }}>{formatBRL(r.valor_total)}</td>
                    <td className="px-3 py-3 text-right" style={{ color: r.valor_entrada > 0 ? '#16a34a' : 'var(--fg-muted)' }}>
                      {r.valor_entrada > 0 ? formatBRL(r.valor_entrada) : '---'}
                    </td>
                    <td className="px-3 py-3 text-right" style={{ color: r.valor_pago_adicional > 0 ? '#16a34a' : 'var(--fg-muted)' }}>
                      {r.valor_pago_adicional > 0 ? formatBRL(r.valor_pago_adicional) : '---'}
                    </td>
                    <td className="px-3 py-3 text-right font-medium" style={{ color: restoPagar > 0 ? '#dc2626' : 'var(--fg-muted)' }}>
                      {restoPagar > 0 ? formatBRL(restoPagar) : '---'}
                    </td>
                    <td className="px-3 py-3 text-center text-xs" style={{ color: 'var(--fg-muted)' }}>{r.forma_pagamento ?? ''}</td>
                    <td className="px-3 py-3 text-center">
                      <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-semibold" style={{ background: statusConf.bg, color: statusConf.color }}>
                        {statusConf.label}
                      </span>
                    </td>
                    <td className="px-3 py-3 text-center min-w-44">
                      {restoPagar > 0 && statusPag !== 'pago' ? (
                        <RegistrarPagamentoModal pedidoId={r.id} restoPagar={restoPagar} compact />
                      ) : (
                        <span className="text-xs text-green-700 dark:text-green-400">Quitado</span>
                      )}
                    </td>
                  </tr>
                )
              })
            )}
          </tbody>
          {recebimentos.length > 0 && (
            <tfoot>
              <tr className="font-semibold text-sm" style={{ borderTop: '2px solid var(--border-medium)', background: 'var(--input-bg)' }}>
                <td colSpan={4} className="px-3 py-3 text-right" style={{ color: 'var(--fg-muted)' }}>
                  Totais ({recebimentos.length}):
                </td>
                <td className="px-3 py-3 text-right" style={{ color: 'var(--fg)' }}>{formatBRL(totalValor)}</td>
                <td className="px-3 py-3 text-right" style={{ color: '#16a34a' }}>{formatBRL(totalEntradas)}</td>
                <td className="px-3 py-3 text-right" style={{ color: '#16a34a' }}>{formatBRL(totalAdicionais)}</td>
                <td className="px-3 py-3 text-right" style={{ color: '#dc2626' }}>{totalPendente > 0 ? formatBRL(totalPendente) : '---'}</td>
                <td colSpan={3} className="px-3 py-3 text-right text-xs" style={{ color: 'var(--fg-muted)' }}>
                  Recebido: {formatBRL(totalRecebido)}
                </td>
              </tr>
            </tfoot>
          )}
        </table>
      </div>

      {totalPaginas > 1 && (
        <div className="flex items-center justify-between px-5 py-3" style={{ borderTop: '1px solid var(--border-subtle)' }}>
          <span className="text-xs" style={{ color: 'var(--fg-muted)' }}>Página {pagina} de {totalPaginas}</span>
          <div className="flex items-center gap-2">
            <Button variant="outline" size="sm" onClick={() => setPagina(p => Math.max(1, p - 1))} disabled={pagina === 1} className="gap-1 text-xs h-8">
              <ChevronLeft size={14} />
              Anterior
            </Button>
            <Button variant="outline" size="sm" onClick={() => setPagina(p => Math.min(totalPaginas, p + 1))} disabled={pagina === totalPaginas} className="gap-1 text-xs h-8">
              Próximo
              <ChevronRight size={14} />
            </Button>
          </div>
        </div>
      )}
    </>
  )
}
