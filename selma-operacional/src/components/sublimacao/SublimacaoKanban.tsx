'use client'
import { useTransition } from 'react'
import { toast } from 'sonner'
import { atualizarSublimacao } from '@/app/sublimacao/actions'
import { usePermission } from '@/components/providers/AuthorizationProvider'
import { todayBusinessDate } from '@/lib/business-date'

const COLUNAS = [
  { id: 'aguardando_papel', label: 'Aguardando Papel', cor: 'text-amber-700 dark:text-amber-400', borda: 'border-amber-200 dark:border-amber-900/30', bg: 'bg-amber-500/5 dark:bg-amber-950/10' },
  { id: 'para_estampar',    label: 'Para Estampar',    cor: 'text-blue-700 dark:text-blue-400',   borda: 'border-blue-200 dark:border-blue-900/30',   bg: 'bg-blue-500/5 dark:bg-blue-950/10' },
  { id: 'finalizada',       label: 'Finalizada',       cor: 'text-green-700 dark:text-green-400',  borda: 'border-green-200 dark:border-green-900/30',  bg: 'bg-green-500/5 dark:bg-green-950/10' },
]

const PROXIMA: Record<string, string> = {
  aguardando_papel: 'para_estampar',
  para_estampar:    'finalizada',
}
const LABEL_BOTAO: Record<string, string> = {
  aguardando_papel: 'Papel chegou → Para estampar',
  para_estampar:    'Finalizar estamparia',
}

interface PedidoSublimacao {
  id: string
  numero: string
  cliente: string
  entrega_programado: string
  tipo_estampa: string | null
  itens_pedido: { qtde: number }[]
}

export function SublimacaoKanban({ aguardandoPapel, paraEstampar, finalizada }: {
  aguardandoPapel: PedidoSublimacao[]
  paraEstampar:    PedidoSublimacao[]
  finalizada:      PedidoSublimacao[]
}) {
  const canUpdate = usePermission('production.update')
  const [isPending, startTransition] = useTransition()

  const moverPedido = (pedidoId: string, statusAtual: string) => {
    const proximo = PROXIMA[statusAtual]
    if (!proximo) return
    startTransition(async () => {
      const result = await atualizarSublimacao({
        pedidoId,
        sublimacao_status: proximo,
      })
      if (result?.error) toast.error('Erro ao mover pedido')
      else toast.success('Pedido atualizado!')
    })
  }

  const grupos = [aguardandoPapel, paraEstampar, finalizada]
  const hoje = todayBusinessDate()

  return (
    <div className="grid grid-cols-3 gap-4">
      {COLUNAS.map((col, idx) => (
        <div key={col.id} className={`rounded-xl border ${col.borda} ${col.bg} p-4 min-h-[300px]`}>
          <div className="flex items-center justify-between mb-4">
            <h3 className={`text-sm font-semibold ${col.cor}`}>{col.label}</h3>
            <span className="text-xs bg-surface border border-border text-muted px-2 py-0.5 rounded-full font-medium">
              {grupos[idx].length}
            </span>
          </div>

          <div className="space-y-3">
            {grupos[idx].length === 0 && (
              <p className="text-xs text-gray-600 text-center py-8">Nenhum pedido</p>
            )}
            {grupos[idx].map((pedido) => {
              const atrasado = pedido.entrega_programado < hoje
              const totalPecas = pedido.itens_pedido?.reduce((s, i) => s + i.qtde, 0) ?? 0
              return (
                <div key={pedido.id}
                  className="bg-card border border-border rounded-lg p-3 space-y-2">
                  <div className="flex items-start justify-between gap-2">
                    <div>
                      <div className="flex items-center gap-1.5 flex-wrap">
                        <p className="text-sm font-medium text-foreground">#{pedido.numero}</p>
                        {pedido.tipo_estampa && (
                          <span className="px-1.5 py-0.5 rounded text-[8px] font-bold uppercase bg-blue-100 text-blue-800 dark:bg-blue-950/40 dark:text-blue-400 border border-blue-200 dark:border-blue-800/20">
                            {pedido.tipo_estampa}
                          </span>
                        )}
                      </div>
                      <p className="text-xs text-muted truncate max-w-[150px]">{pedido.cliente}</p>
                    </div>
                    <span className={`text-xs font-medium flex-shrink-0 ${atrasado ? 'text-red-600 dark:text-red-400' : 'text-muted'}`}>
                      {new Date(pedido.entrega_programado + 'T12:00:00').toLocaleDateString('pt-BR')}
                    </span>
                  </div>
                  <p className="text-xs text-muted">{totalPecas} peça{totalPecas !== 1 ? 's' : ''}</p>
                  {canUpdate && PROXIMA[col.id] && (
                    <button
                      onClick={() => moverPedido(pedido.id, col.id)}
                      disabled={isPending}
                      className="w-full text-xs py-1.5 px-2 bg-input border border-border text-foreground rounded hover:border-green-600 dark:hover:border-green-500 hover:text-green-700 dark:hover:text-green-400 transition-all disabled:opacity-50"
                    >
                      {LABEL_BOTAO[col.id]} →
                    </button>
                  )}
                </div>
              )
            })}
          </div>
        </div>
      ))}
    </div>
  )
}
