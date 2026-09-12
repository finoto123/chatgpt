'use client'

import { useState } from 'react'
import { Plus } from 'lucide-react'
import { MovimentacaoDrawer } from './MovimentacaoDrawer'
import { LinhaEstoqueEditavel } from './LinhaEstoqueEditavel'
import { EstoqueAtual } from '@/types'
import { usePermission } from '@/components/providers/AuthorizationProvider'

interface EstoqueTableProps {
  itens: EstoqueAtual[]
}

export function EstoqueTable({ itens }: EstoqueTableProps) {
  const canAdjust = usePermission('inventory.adjust')
  const [movDrawerOpen, setMovDrawerOpen] = useState(false)
  const [search, setSearch] = useState('')

  const filtered = search
    ? itens.filter(
        i =>
          i.descricao.toLowerCase().includes(search.toLowerCase()) ||
          i.codigo.toLowerCase().includes(search.toLowerCase()) ||
          (i.fornecedor ?? '').toLowerCase().includes(search.toLowerCase())
      )
    : itens

  return (
    <>
      {/* Barra de ações */}
      <div className="flex items-center gap-3 mb-4">
        <input
          type="text"
          placeholder="Buscar por tecido, código ou fornecedor..."
          className="rounded-lg px-3 py-2 text-sm w-80 focus:outline-none"
          style={{
            background: 'var(--input-bg)',
            border: '1px solid var(--border-color)',
            color: 'var(--fg)',
          }}
          value={search}
          onChange={e => setSearch(e.target.value)}
        />
        {canAdjust && <button
          onClick={() => setMovDrawerOpen(true)}
          className="flex items-center gap-2 px-4 py-2 text-white rounded-lg text-sm font-semibold transition-colors"
          style={{ background: '#22C55E' }}
        >
          <Plus size={15} />
          Movimentação
        </button>}
      </div>

      <div
        className="rounded-xl overflow-hidden"
        style={{ background: 'var(--card-bg)', border: '1px solid var(--border-color)', boxShadow: 'var(--shadow-sm)' }}
      >
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead style={{ background: 'var(--input-bg)', borderBottom: '1px solid var(--border-color)' }}>
              <tr>
                {['Código', 'Descrição', 'Fornecedor', 'Unid.', 'Estoque Atual', 'Mín.', 'Situação', 'Valor Unit.', 'Total', ''].map((h, i) => (
                  <th
                    key={i}
                    className="px-4 py-3 text-left text-xs font-medium uppercase tracking-wide whitespace-nowrap"
                    style={{ color: 'var(--fg-muted)' }}
                  >
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {filtered.length === 0 ? (
                <tr>
                  <td colSpan={10} className="text-center py-10" style={{ color: 'var(--fg-muted)' }}>
                    Nenhum item encontrado
                  </td>
                </tr>
              ) : (
                filtered.map(item => (
                  <LinhaEstoqueEditavel key={item.id} item={item} />
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      <p className="text-xs mt-2" style={{ color: 'var(--fg-muted)' }}>
        💡 Clique em Valor Unit. ou Mín. para editar diretamente na tabela.
      </p>

      {canAdjust && <MovimentacaoDrawer
        open={movDrawerOpen}
        onClose={() => setMovDrawerOpen(false)}
        tecidos={itens}
      />}
    </>
  )
}
