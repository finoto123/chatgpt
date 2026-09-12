'use client'
import { useState, useTransition } from 'react'
import { restaurarPedido } from '@/app/pedidos/actions'
import { toast } from 'sonner'
import { RotateCcw } from 'lucide-react'
import { usePermission } from '@/components/providers/AuthorizationProvider'

export function BotaoRestaurarPedido({
  pedidoId,
  numeroPedido,
}: {
  pedidoId: string
  numeroPedido: string
}) {
  const canUpdate = usePermission('orders.update')
  const [aberto, setAberto] = useState(false)
  const [isPending, startTransition] = useTransition()

  const handleRestaurar = () => {
    startTransition(async () => {
      const result = await restaurarPedido(pedidoId)
      if (result?.error) {
        toast.error('Erro ao restaurar: ' + result.error)
      } else {
        toast.success(`Pedido #${numeroPedido} restaurado para Ag. Corte`)
        setAberto(false)
      }
    })
  }

  if (!canUpdate) return null

  if (!aberto) {
    return (
      <button
        onClick={() => setAberto(true)}
        className="p-1 rounded transition-colors"
        title="Restaurar pedido"
        style={{ color: 'var(--fg-muted)' }}
      >
        <RotateCcw size={16} />
      </button>
    )
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center"
      style={{ background: 'rgba(0,0,0,0.6)' }}
    >
      <div
        className="rounded-xl p-5 space-y-3 w-80"
        style={{ background: 'var(--card-bg)', border: '1px solid var(--border-color)' }}
      >
        <p className="text-sm font-medium" style={{ color: 'var(--fg)' }}>
          Restaurar pedido #{numeroPedido}?
        </p>
        <p className="text-xs" style={{ color: 'var(--fg-muted)' }}>
          O pedido voltará para o status &quot;Aguardando Corte&quot;.
        </p>
        <div className="flex gap-2 pt-1">
          <button
            onClick={handleRestaurar}
            disabled={isPending}
            className="flex-1 px-4 py-2 rounded-lg text-sm font-medium transition-colors disabled:opacity-50"
            style={{ background: '#1e7e3e', color: 'white' }}
          >
            {isPending ? 'Restaurando...' : 'Confirmar'}
          </button>
          <button
            onClick={() => setAberto(false)}
            className="px-4 py-2 text-sm transition-colors"
            style={{ color: 'var(--fg-muted)' }}
          >
            Cancelar
          </button>
        </div>
      </div>
    </div>
  )
}
