'use client'

import { useState, useTransition } from 'react'
import { editarTecido } from '@/app/estoque/actions'
import { toast } from 'sonner'
import { formatBRL } from '@/lib/utils'
import { EstoqueAtual, SituacaoEstoque } from '@/types'
import { usePermission } from '@/components/providers/AuthorizationProvider'

const SITUACAO_COLOR: Record<SituacaoEstoque, string> = {
  COMPRAR: '#F87171',
  ATENÇÃO: '#FCD34D',
  OK: '#4ADE80',
}

const SITUACAO_CONFIG: Record<SituacaoEstoque, { label: string; bg: string; color: string }> = {
  OK: { label: 'OK', bg: 'rgba(34,197,94,0.12)', color: '#15803d' },
  ATENÇÃO: { label: 'Atenção', bg: 'rgba(245,158,11,0.12)', color: '#b45309' },
  COMPRAR: { label: 'Comprar', bg: 'rgba(239,68,68,0.12)', color: '#dc2626' },
}

const inputStyle = {
  background: 'var(--input-bg)',
  border: '1px solid var(--border-medium)',
  color: 'var(--fg)',
  borderRadius: '4px',
  padding: '2px 6px',
  fontSize: '13px',
}

export function LinhaEstoqueEditavel({ item }: { item: EstoqueAtual }) {
  const canUpdate = usePermission('inventory.update')
  const [editando, setEditando] = useState(false)
  const [valorUnit, setValorUnit] = useState<number>(item.valor_unitario ?? 0)
  const [minimo, setMinimo] = useState<number>(item.estoque_minimo ?? 0)
  const [isPending, startTransition] = useTransition()

  function salvar() {
    startTransition(async () => {
      const result = await editarTecido({
        id: item.id,
        valor_unitario: valorUnit,
        estoque_minimo: minimo,
      })
      if (result?.error) {
        toast.error('Erro ao salvar: ' + result.error)
      } else {
        toast.success('Tecido atualizado!')
        setEditando(false)
      }
    })
  }

  function cancelar() {
    setEditando(false)
    setValorUnit(item.valor_unitario ?? 0)
    setMinimo(item.estoque_minimo ?? 0)
  }

  const rowStyle =
    item.situacao === 'COMPRAR'
      ? { background: 'rgba(239,68,68,0.08)' }
      : item.situacao === 'ATENÇÃO'
      ? { background: 'rgba(245,158,11,0.08)' }
      : {}

  const cfg = SITUACAO_CONFIG[item.situacao]

  return (
    <tr style={{ ...rowStyle, borderBottom: '1px solid var(--border-subtle)' }} className="hover-item transition-colors">
      {/* Código */}
      <td className="px-4 py-3 font-mono text-xs" style={{ color: 'var(--fg-muted)' }}>
        {item.codigo}
      </td>

      {/* Descrição */}
      <td className="px-4 py-3 font-medium max-w-[200px]" style={{ color: 'var(--fg)' }}>
        <span className="truncate block" title={item.descricao}>{item.descricao}</span>
      </td>

      {/* Fornecedor */}
      <td className="px-4 py-3 max-w-[140px]" style={{ color: 'var(--fg-muted)' }}>
        <span className="truncate block" title={item.fornecedor ?? ''}>{item.fornecedor ?? '—'}</span>
      </td>

      {/* Unidade */}
      <td className="px-4 py-3 text-center" style={{ color: 'var(--fg-muted)' }}>
        {item.unidade}
      </td>

      {/* Estoque Atual */}
      <td className="px-4 py-3 text-center">
        <span style={{ color: SITUACAO_COLOR[item.situacao], fontWeight: 600 }}>
          {item.estoque_atual.toFixed(3)}
        </span>
      </td>

      {/* Mínimo — editável */}
      <td className="px-4 py-3 text-center">
        {editando && canUpdate ? (
          <input
            type="number"
            min={0}
            step={0.001}
            value={minimo}
            onChange={e => setMinimo(Number(e.target.value))}
            style={{ ...inputStyle, width: '80px', textAlign: 'center' }}
            autoFocus
          />
        ) : (
          <span
            onClick={canUpdate ? () => setEditando(true) : undefined}
            className={canUpdate ? 'cursor-pointer transition-colors' : undefined}
            style={{ color: 'var(--fg-muted)' }}
            title="Clique para editar"
          >
            {item.estoque_minimo.toFixed(3)}
          </span>
        )}
      </td>

      {/* Situação */}
      <td className="px-4 py-3">
        <span
          className="px-2 py-0.5 rounded-full text-xs font-semibold"
          style={{ backgroundColor: cfg.bg, color: cfg.color }}
        >
          {cfg.label}
        </span>
      </td>

      {/* Valor Unitário — editável */}
      <td className="px-4 py-3">
        {editando && canUpdate ? (
          <input
            type="number"
            min={0}
            step={0.01}
            value={valorUnit}
            onChange={e => setValorUnit(Number(e.target.value))}
            style={{ ...inputStyle, width: '96px', textAlign: 'right' }}
          />
        ) : (
          <span
            onClick={canUpdate ? () => setEditando(true) : undefined}
            className={canUpdate ? 'cursor-pointer transition-colors' : undefined}
            style={{
              color: item.valor_unitario ? 'var(--fg-secondary)' : '#F87171',
              fontStyle: item.valor_unitario ? 'normal' : 'italic',
            }}
            title="Clique para editar"
          >
            {item.valor_unitario ? formatBRL(item.valor_unitario) : '— editar'}
          </span>
        )}
      </td>

      {/* Total */}
      <td className="px-4 py-3 font-medium" style={{ color: 'var(--fg)' }}>
        {formatBRL(item.estoque_atual * (editando ? valorUnit : (item.valor_unitario ?? 0)))}
      </td>

      {/* Ação */}
      <td className="px-4 py-3 text-center">
        {editando && canUpdate ? (
          <div className="flex gap-1 justify-center">
            <button
              onClick={salvar}
              disabled={isPending}
              className="text-xs px-2 py-1 rounded font-semibold disabled:opacity-50 transition-colors"
              style={{ background: '#22C55E', color: 'white' }}
              title="Salvar"
            >
              {isPending ? '...' : '✓'}
            </button>
            <button
              onClick={cancelar}
              className="text-xs px-2 py-1 rounded transition-colors"
              style={{ background: 'var(--input-bg)', color: 'var(--fg-muted)', border: '1px solid var(--border-medium)' }}
              title="Cancelar"
            >
              ✕
            </button>
          </div>
        ) : canUpdate ? (
          <button
            onClick={() => setEditando(true)}
            className="transition-colors"
            style={{ color: 'var(--fg-muted)', fontSize: '14px' }}
            title="Editar preço e estoque mínimo"
          >
            ✏️
          </button>
        ) : null}
      </td>
    </tr>
  )
}
