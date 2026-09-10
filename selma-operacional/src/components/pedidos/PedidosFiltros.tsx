'use client'

import { useRouter, useSearchParams, usePathname } from 'next/navigation'
import { useCallback } from 'react'
import { StatusPedido } from '@/types'

const STATUS_OPTIONS: StatusPedido[] = [
  'aguardando_corte','corte','sublimacao','dtf','bordados','costura','acabamento','entregue','atrasado','cancelado'
]

export function PedidosFiltros() {
  const router = useRouter()
  const pathname = usePathname()
  const searchParams = useSearchParams()

  const updateParam = useCallback((key: string, value: string) => {
    const params = new URLSearchParams(searchParams.toString())
    if (value === '' || value === 'todos') {
      params.delete(key)
    } else {
      params.set(key, value)
    }
    params.delete('page')
    router.push(`${pathname}?${params.toString()}`)
  }, [router, pathname, searchParams])

  return (
    <div className="flex gap-2">
      <input
        defaultValue={searchParams.get('search') ?? ''}
        placeholder="Buscar cliente ou pedido..."
        className="rounded-lg px-3 py-2 text-sm w-64 focus:outline-none"
        style={{
          background: 'var(--input-bg)',
          border: '1px solid var(--border-color)',
          color: 'var(--fg)',
        }}
        onChange={e => updateParam('search', e.target.value)}
      />
      <select
        defaultValue={searchParams.get('status') ?? 'todos'}
        className="rounded-lg px-3 py-2 text-sm"
        style={{
          background: 'var(--input-bg)',
          border: '1px solid var(--border-color)',
          color: 'var(--fg-secondary)',
        }}
        onChange={e => updateParam('status', e.target.value)}
      >
        <option value="todos">Todos os status</option>
        {STATUS_OPTIONS.map(s => (
          <option key={s} value={s}>{s.replace('_', ' ')}</option>
        ))}
      </select>
    </div>
  )
}
