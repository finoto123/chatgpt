'use client'
import { useState, useTransition } from 'react'
import { cancelarPedido } from '@/app/pedidos/actions'
import { toast } from 'sonner'
import { usePermission } from '@/components/providers/AuthorizationProvider'

export function BotaoCancelarPedido({
  pedidoId,
  numeroPedido,
}: {
  pedidoId: string
  numeroPedido: string
}) {
  const canCancel = usePermission('orders.cancel')
  const [aberto, setAberto] = useState(false)
  const [motivo, setMotivo] = useState('')
  const [isPending, startTransition] = useTransition()

  const handleCancelar = () => {
    startTransition(async () => {
      const result = await cancelarPedido(pedidoId, motivo || undefined)
      if (result?.error) {
        toast.error('Erro ao cancelar: ' + result.error)
      } else {
        toast.success('Pedido cancelado')
        setAberto(false)
      }
    })
  }

  if (!canCancel) return null

  return (
    <div className="mt-6 pt-4 border-t border-[#2a2a4a]">
      {!aberto ? (
        <button
          onClick={() => setAberto(true)}
          className="text-sm text-red-500/70 hover:text-red-400 transition-colors"
        >
          🚫 Cancelar este pedido
        </button>
      ) : (
        <div className="bg-red-950/20 border border-red-900/40 rounded-xl p-4 space-y-3">
          <p className="text-sm text-red-400 font-medium">
            ⚠️ Cancelar pedido #{numeroPedido}?
          </p>
          <input
            type="text"
            placeholder="Motivo do cancelamento (opcional)"
            value={motivo}
            onChange={e => setMotivo(e.target.value)}
            className="w-full bg-[#1a1a2e] border border-[#2a2a4a] rounded-lg px-3 py-2 text-sm text-white placeholder-gray-600 focus:outline-none focus:border-red-700"
          />
          <div className="flex gap-2">
            <button
              onClick={handleCancelar}
              disabled={isPending}
              className="px-4 py-2 bg-red-700 text-white rounded-lg text-sm hover:bg-red-600 transition-colors disabled:opacity-50"
            >
              {isPending ? 'Cancelando...' : 'Confirmar Cancelamento'}
            </button>
            <button
              onClick={() => setAberto(false)}
              className="px-4 py-2 text-gray-400 hover:text-white text-sm transition-colors"
            >
              Voltar
            </button>
          </div>
        </div>
      )}
    </div>
  )
}
