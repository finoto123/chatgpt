'use client'
import { useState, useTransition } from 'react'
import { registrarPagamento } from '@/app/pedidos/actions'
import { toast } from 'sonner'
import { formatBRL } from '@/lib/utils'
import { usePermission } from '@/components/providers/AuthorizationProvider'

interface Props {
  pedidoId: string
  restoPagar: number
  compact?: boolean
}

export function RegistrarPagamentoModal({ pedidoId, restoPagar, compact = false }: Props) {
  const canUpdateFinance = usePermission('finance.update')
  const [aberto, setAberto] = useState(false)
  const [valor, setValor] = useState('')
  const [marcarComoPago, setMarcarComoPago] = useState(false)
  const [isPending, startTransition] = useTransition()

  const valorNum = parseFloat(valor.replace(',', '.')) || 0

  function handleSubmit() {
    if (!marcarComoPago && valorNum <= 0) {
      toast.error('Informe um valor maior que zero')
      return
    }
    startTransition(async () => {
      const result = await registrarPagamento(pedidoId, marcarComoPago ? restoPagar : valorNum, marcarComoPago)
      if (result?.error) {
        toast.error('Erro: ' + result.error)
      } else {
        toast.success('Pagamento registrado!')
        setAberto(false)
        setValor('')
        setMarcarComoPago(false)
      }
    })
  }

  if (!canUpdateFinance) return null

  return (
    <>
      {!aberto ? (
        <button
          onClick={() => setAberto(true)}
          className={`${compact ? 'px-3 py-1.5' : 'w-full mt-3 py-2'} rounded-lg text-xs font-semibold border transition-colors bg-green-50 dark:bg-green-950/20 border-green-200 dark:border-green-800/40 text-green-700 dark:text-green-400 hover:bg-green-100 dark:hover:bg-green-900/50`}
        >
          {compact ? 'Dar baixa' : '+ Registrar Pagamento'}
        </button>
      ) : (
        <div
          className="mt-3 rounded-lg p-3 space-y-3"
          style={{ background: 'var(--surface-subtle)', border: '1px solid var(--border-color)' }}
        >
          <p className="text-xs font-semibold" style={{ color: 'var(--fg-muted)' }}>
            Registrar pagamento — Resto a pagar: {formatBRL(restoPagar)}
          </p>

          <div>
            <label className="text-xs" style={{ color: 'var(--fg-muted)' }}>Valor recebido R$</label>
            <input
              type="number"
              step="0.01"
              min={0}
              value={valor}
              onChange={e => setValor(e.target.value)}
              disabled={marcarComoPago}
              placeholder="0,00"
              className="mt-1 w-full rounded-lg px-3 py-2 text-sm focus:outline-none"
              style={{ background: 'var(--input-bg)', border: '1px solid var(--border-color)', color: 'var(--fg)' }}
            />
          </div>

          <label className="flex items-center gap-2 cursor-pointer">
            <input
              type="checkbox"
              checked={marcarComoPago}
              onChange={e => setMarcarComoPago(e.target.checked)}
              className="w-4 h-4 accent-green-500"
            />
            <span className="text-xs" style={{ color: 'var(--fg-muted)' }}>
              Marcar como pago total ({formatBRL(restoPagar)})
            </span>
          </label>

          <div className="flex gap-2 pt-1">
            <button
              onClick={handleSubmit}
              disabled={isPending}
              className="flex-1 py-2 rounded-lg text-xs font-medium transition-colors disabled:opacity-50"
              style={{ background: '#16a34a', color: 'white' }}
            >
              {isPending ? 'Salvando...' : 'Confirmar'}
            </button>
            <button
              onClick={() => { setAberto(false); setValor(''); setMarcarComoPago(false) }}
              className="px-3 py-2 text-xs transition-colors"
              style={{ color: 'var(--fg-muted)' }}
            >
              Cancelar
            </button>
          </div>
        </div>
      )}
    </>
  )
}
