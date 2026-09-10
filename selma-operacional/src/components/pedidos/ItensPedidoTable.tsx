'use client'

import { UseFieldArrayAppend, UseFieldArrayRemove, useFormContext, useWatch } from 'react-hook-form'
import { PedidoFormValues } from '@/lib/schemas/pedido'
import { formatBRL } from '@/lib/utils'
import { Trash2, Plus } from 'lucide-react'
import { MODELOS_MANGA, MODELOS_GOLA, MODELOS_ACABAMENTO, TAMANHOS, MODELOS_PECA } from '@/lib/constants'

const cellInput = {
  background: 'var(--surface-subtle)',
  border: '1px solid var(--border-color)',
  color: 'var(--fg)',
}

interface Props {
  fields: { id: string }[]
  append: UseFieldArrayAppend<PedidoFormValues, 'itens'>
  remove: UseFieldArrayRemove
}

export function ItensPedidoTable({ fields, append, remove }: Props) {
  const { register, formState: { errors } } = useFormContext<PedidoFormValues>()
  const itens = useWatch({ name: 'itens' }) ?? []

  const qtdeTotal = itens.reduce((s: number, i: { qtde?: unknown; valor_unitario?: unknown }) => s + (Number(i?.qtde) || 0), 0)
  const subtotal = itens.reduce((s: number, i: { qtde?: unknown; valor_unitario?: unknown }) => s + (Number(i?.qtde) || 0) * (Number(i?.valor_unitario) || 0), 0)

  return (
    <div>
      <datalist id="tamanhos-list">
        {TAMANHOS.map(t => <option key={t} value={t} />)}
      </datalist>
      <datalist id="modelos-list">
        {MODELOS_PECA.map(m => <option key={m} value={m} />)}
      </datalist>
      <datalist id="mangas-list">
        {MODELOS_MANGA.map(m => <option key={m} value={m} />)}
      </datalist>
      <datalist id="golas-list">
        {MODELOS_GOLA.map(g => <option key={g} value={g} />)}
      </datalist>
      <datalist id="acabamentos-list">
        {MODELOS_ACABAMENTO.map(a => <option key={a} value={a} />)}
      </datalist>

      <div
        className="overflow-x-auto rounded-lg"
        style={{ background: 'var(--card-bg)', border: '1px solid var(--border-color)' }}
      >
        <table className="w-full text-xs">
          <thead style={{ background: 'var(--surface-subtle)', borderBottom: '1px solid var(--border-color)' }}>
            <tr>
              {['QTDE', 'TAM', 'MODELO', 'TECIDO/COR', 'MANGA', 'GOLA', 'ACABAMENTO', 'UNIT R$', 'TOTAL', ''].map(h => (
                <th key={h} className="px-2 py-2 text-left font-semibold whitespace-nowrap" style={{ color: 'var(--fg-muted)' }}>{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {fields.map((field, index) => {
              const qtde = Number(itens[index]?.qtde) || 0
              const valor = Number(itens[index]?.valor_unitario) || 0
              return (
                <tr key={field.id} style={{ borderBottom: '1px solid var(--border-subtle)' }}>
                  <td className="px-1 py-1">
                    <input
                      type="number"
                      min={1}
                      {...register(`itens.${index}.qtde`, { valueAsNumber: true })}
                      className="w-12 rounded px-1.5 py-1 text-xs focus:outline-none"
                      style={cellInput}
                    />
                  </td>
                  <td className="px-1 py-1">
                    <input
                      list="tamanhos-list"
                      {...register(`itens.${index}.tamanho`)}
                      className="w-14 rounded px-1 py-1 text-xs focus:outline-none"
                      style={cellInput}
                      placeholder="P"
                    />
                  </td>
                  <td className="px-1 py-1">
                    <input
                      list="modelos-list"
                      {...register(`itens.${index}.modelo`)}
                      className="w-24 rounded px-1 py-1 text-xs focus:outline-none"
                      style={cellInput}
                      placeholder="Modelo..."
                    />
                  </td>
                  <td className="px-1 py-1">
                    <input
                      {...register(`itens.${index}.tecido_cor`)}
                      className="w-24 rounded px-1.5 py-1 text-xs focus:outline-none"
                      style={cellInput}
                      placeholder="Branco"
                    />
                  </td>
                  <td className="px-1 py-1">
                    <input
                      list="mangas-list"
                      {...register(`itens.${index}.manga`)}
                      className="rounded px-1 py-1 text-xs w-20 focus:outline-none"
                      style={cellInput}
                      placeholder="Manga..."
                    />
                  </td>
                  <td className="px-1 py-1">
                    <input
                      list="golas-list"
                      {...register(`itens.${index}.gola`)}
                      className="rounded px-1 py-1 text-xs w-20 focus:outline-none"
                      style={cellInput}
                      placeholder="Gola..."
                    />
                  </td>
                  <td className="px-1 py-1">
                    <input
                      list="acabamentos-list"
                      {...register(`itens.${index}.acabamento`)}
                      className="rounded px-1 py-1 text-xs w-24 focus:outline-none"
                      style={cellInput}
                      placeholder="Acab..."
                    />
                  </td>
                  <td className="px-1 py-1">
                    <input
                      type="number"
                      step="0.01"
                      min={0}
                      {...register(`itens.${index}.valor_unitario`, { valueAsNumber: true })}
                      className="w-20 rounded px-1.5 py-1 text-xs focus:outline-none"
                      style={cellInput}
                      placeholder="0,00"
                    />
                  </td>
                  <td className="px-2 py-1 text-right font-medium" style={{ color: 'var(--fg)' }}>
                    {formatBRL(qtde * valor)}
                  </td>
                  <td className="px-1 py-1">
                    <button type="button" onClick={() => remove(index)} className="p-1 text-red-600 dark:text-red-400 hover:text-red-700 dark:hover:text-red-300">
                      <Trash2 size={14} />
                    </button>
                  </td>
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>

      {(errors.itens?.root?.message ?? (errors.itens as { message?: string } | undefined)?.message) && (
        <p className="text-red-600 dark:text-red-400 text-xs mt-1">
          {errors.itens?.root?.message ?? (errors.itens as { message?: string } | undefined)?.message}
        </p>
      )}

      <button
        type="button"
        onClick={() => append({ qtde: 1, tamanho: '', modelo: '', valor_unitario: 0 })}
        className="mt-2 flex items-center gap-1 text-xs font-medium text-brand-green"
      >
        <Plus size={14} /> Adicionar Item
      </button>

      <div className="mt-2 flex justify-end gap-6 text-sm">
        <span style={{ color: 'var(--fg-muted)' }}>Qtde Total: <strong style={{ color: 'var(--fg)' }}>{qtdeTotal}</strong></span>
        <span style={{ color: 'var(--fg-muted)' }}>Subtotal: <strong className="text-green-600 dark:text-green-400">{formatBRL(subtotal)}</strong></span>
      </div>
    </div>
  )
}

