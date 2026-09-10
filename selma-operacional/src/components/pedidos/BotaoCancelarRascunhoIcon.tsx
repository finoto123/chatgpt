'use client'
import { useTransition } from 'react'
import { cancelarPedido } from '@/app/pedidos/actions'
import { toast } from 'sonner'
import { Trash2 } from 'lucide-react'
import { usePermission } from '@/components/providers/AuthorizationProvider'

export function BotaoCancelarRascunhoIcon({ pedidoId, numeroPedido }: { pedidoId: string, numeroPedido: string }) {
  const canCancel = usePermission('orders.cancel')
  const [isPending, startTransition] = useTransition()

  const handleCancelar = () => {
    if (!window.confirm(`Tem certeza que deseja cancelar o rascunho #${numeroPedido}?`)) return
    
    startTransition(async () => {
      const result = await cancelarPedido(pedidoId, 'Cancelado pelo usuário na listagem')
      if (result?.error) {
        toast.error('Erro ao cancelar: ' + result.error)
      } else {
        toast.success('Rascunho cancelado')
      }
    })
  }

  if (!canCancel) return null

  return (
    <button
      onClick={handleCancelar}
      disabled={isPending}
      className="p-1.5 rounded transition-colors disabled:opacity-50 hover:bg-red-900/30"
      style={{ color: 'var(--fg-muted)', background: 'transparent' }}
      title="Cancelar Rascunho"
    >
      <Trash2 size={16} className="text-red-500 hover:text-red-400" />
    </button>
  )
}
