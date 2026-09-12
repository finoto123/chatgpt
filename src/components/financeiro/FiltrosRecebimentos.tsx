'use client'

import { useRouter, useSearchParams } from 'next/navigation'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'

const MESES = [
  { value: 'todos', label: 'Todos os meses' },
  { value: '1', label: 'Janeiro' },
  { value: '2', label: 'Fevereiro' },
  { value: '3', label: 'Março' },
  { value: '4', label: 'Abril' },
  { value: '5', label: 'Maio' },
  { value: '6', label: 'Junho' },
  { value: '7', label: 'Julho' },
  { value: '8', label: 'Agosto' },
  { value: '9', label: 'Setembro' },
  { value: '10', label: 'Outubro' },
  { value: '11', label: 'Novembro' },
  { value: '12', label: 'Dezembro' },
]

const STATUS_OPCOES = [
  { value: 'todos', label: 'Todos os status' },
  { value: 'pago', label: 'Pago' },
  { value: 'parcial', label: 'Parcial' },
  { value: 'pendente', label: 'Pendente' },
]

export function FiltrosRecebimentos() {
  const router = useRouter()
  const sp = useSearchParams()
  const mes: string = sp.get('mes') ?? 'todos'
  const status: string = sp.get('status') ?? 'todos'

  const atualizar = (key: string, value: string | null) => {
    if (value === null) return
    const params = new URLSearchParams(sp.toString())
    if (value === 'todos') {
      params.delete(key)
    } else {
      params.set(key, value)
    }
    router.push(`/financeiro?${params.toString()}`, { scroll: false })
  }

  return (
    <div className="flex items-center gap-3">
      <span className="text-sm font-medium" style={{ color: 'var(--fg-muted)' }}>
        Filtrar:
      </span>
      <Select value={mes} onValueChange={v => atualizar('mes', v)}>
        <SelectTrigger
          className="w-44 text-sm"
          style={{ background: 'var(--input-bg)', border: '1px solid var(--border-color)', color: 'var(--fg)' }}
        >
          <SelectValue placeholder="Mês" />
        </SelectTrigger>
        <SelectContent style={{ background: 'var(--tooltip-bg)', border: '1px solid var(--tooltip-border)', color: 'var(--fg)' }}>
          {MESES.map(m => (
            <SelectItem
              key={m.value}
              value={m.value}
              className="focus:bg-white/8 focus:text-white"
            >
              {m.label}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
      <Select value={status} onValueChange={v => atualizar('status', v)}>
        <SelectTrigger
          className="w-44 text-sm"
          style={{ background: 'var(--input-bg)', border: '1px solid var(--border-color)', color: 'var(--fg)' }}
        >
          <SelectValue placeholder="Status" />
        </SelectTrigger>
        <SelectContent style={{ background: 'var(--tooltip-bg)', border: '1px solid var(--tooltip-border)', color: 'var(--fg)' }}>
          {STATUS_OPCOES.map(s => (
            <SelectItem
              key={s.value}
              value={s.value}
              className="focus:bg-white/8 focus:text-white"
            >
              {s.label}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    </div>
  )
}
