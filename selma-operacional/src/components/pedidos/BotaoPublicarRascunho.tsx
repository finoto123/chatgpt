'use client'
import { useTransition } from 'react'
import { publicarRascunho } from '@/app/pedidos/actions'
import { toast } from 'sonner'
import { usePermission } from '@/components/providers/AuthorizationProvider'

export function BotaoPublicarRascunho({ pedidoId }: { pedidoId: string }) {
  const canUpdate = usePermission('orders.update')
  const [isPending, startTransition] = useTransition()

  const handlePublicar = () => {
    startTransition(async () => {
      const result = await publicarRascunho(pedidoId)
      if (result?.error) {
        toast.error(result.error)
      } else {
        toast.success('Rascunho publicado com sucesso!')
      }
    })
  }

  if (!canUpdate) return null

  return (
    <button 
      onClick={handlePublicar}
      disabled={isPending}
      className="text-xs px-3 py-1 bg-[#1e7e3e] text-white rounded-full hover:bg-[#2d9b54] transition-colors disabled:opacity-50"
    >
      {isPending ? 'Publicando...' : 'Publicar →'}
    </button>
  )
}
