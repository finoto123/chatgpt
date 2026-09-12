'use client'
import { useState, useTransition } from 'react'
import { toast } from 'sonner'
import { moverAcabamento } from '@/app/acabamento/actions'
import { usePermission } from '@/components/providers/AuthorizationProvider'
import { todayBusinessDate } from '@/lib/business-date'

const COLUNAS = [
  { id: 'aguardando',  label: 'Aguardando',  descricao: 'Peças prontas aguardando acabamento', cor: 'text-yellow-400', borda: 'border-yellow-800/30', bg: 'bg-yellow-950/10' },
  { id: 'finalizando', label: 'Finalizando', descricao: 'Em processo de embalagem',            cor: 'text-blue-400',   borda: 'border-blue-800/30',   bg: 'bg-blue-950/10' },
  { id: 'entregue',    label: 'Entregue',    descricao: 'Pedido entregue ao cliente',           cor: 'text-green-400',  borda: 'border-green-800/30',  bg: 'bg-green-950/10' },
]

type Pedido = {
  id: string; numero: string; cliente: string
  entrega_programado: string; status: string
  embalagem_status: string | null; embalagem_numero_nf: string | null
  itens_pedido: { qtde: number }[]
}

export function AcabamentoKanban({ aguardando, finalizando, entregue }: {
  aguardando: Pedido[]; finalizando: Pedido[]; entregue: Pedido[]
}) {
  const canUpdate = usePermission('production.update')
  const [isPending, startTransition] = useTransition()
  const [confirmando, setConfirmando] = useState<Pedido | null>(null)
  const [nfNum, setNfNum] = useState('')
  const [nfData, setNfData] = useState('')

  const mover = (
    pedidoId: string,
    status: 'aguardando' | 'finalizando' | 'entregue',
    extra?: { numero_nf?: string; data_nf?: string }
  ) => {
    startTransition(async () => {
      const result = await moverAcabamento(pedidoId, status, extra)
      if (result?.error) toast.error('Erro: ' + result.error)
      else toast.success(status === 'entregue' ? '✓ Pedido entregue!' : 'Status atualizado!')
    })
  }

  const confirmarEntrega = () => {
    if (!confirmando) return
    mover(confirmando.id, 'entregue', { numero_nf: nfNum || undefined, data_nf: nfData || undefined })
    setConfirmando(null)
    setNfNum('')
    setNfData('')
  }

  const hoje = todayBusinessDate()
  const grupos = [aguardando, finalizando, entregue]

  const renderCard = (pedido: Pedido, colId: string) => {
    const atrasado = pedido.entrega_programado < hoje
    const totalPecas = pedido.itens_pedido?.reduce((s, i) => s + i.qtde, 0) ?? 0

    return (
      <div key={pedido.id} className="bg-card border border-border-medium rounded-lg p-3 space-y-2">
        <div className="flex items-start justify-between gap-2">
          <div>
            <p className="text-sm font-medium text-foreground">#{pedido.numero}</p>
            <p className="text-xs text-muted truncate max-w-[140px]">{pedido.cliente}</p>
          </div>
          <span className={`text-xs font-medium flex-shrink-0 ${atrasado ? 'text-red-400' : 'text-gray-500'}`}>
            {new Date(pedido.entrega_programado + 'T12:00:00').toLocaleDateString('pt-BR')}
          </span>
        </div>

        <div className="flex items-center justify-between text-xs text-gray-500">
          <span>{totalPecas} peças</span>
        </div>

        {pedido.embalagem_numero_nf && (
          <p className="text-xs text-blue-400">NF: {pedido.embalagem_numero_nf}</p>
        )}

        {/* Botões de ação */}
        {canUpdate && colId === 'aguardando' && (
          <button onClick={() => mover(pedido.id, 'finalizando')} disabled={isPending}
            className="w-full text-xs py-1.5 px-2 bg-input border border-border-medium text-muted rounded hover:border-blue-700 hover:text-blue-400 transition-all disabled:opacity-50">
            Iniciar embalagem →
          </button>
        )}
        {canUpdate && colId === 'finalizando' && (
          <button onClick={() => setConfirmando(pedido)} disabled={isPending}
            className="w-full text-xs py-1.5 px-2 bg-green-950/30 border border-green-800/40 text-green-400 rounded hover:bg-green-900/40 transition-all disabled:opacity-50">
            🚚 Marcar como Entregue
          </button>
        )}
        {colId === 'entregue' && (
          <span className="text-xs text-green-500">✓ Entregue</span>
        )}
      </div>
    )
  }

  return (
    <>
      <div className="grid grid-cols-3 gap-4">
        {COLUNAS.map((col, idx) => (
          <div key={col.id} className={`rounded-xl border ${col.borda} ${col.bg} p-4 min-h-[300px]`}>
            <div className="flex items-center justify-between mb-1">
              <h3 className={`text-sm font-semibold ${col.cor}`}>{col.label}</h3>
              <span className="text-xs bg-[#1a1a2e] text-gray-500 px-2 py-0.5 rounded-full">
                {grupos[idx].length}
              </span>
            </div>
            <p className="text-xs text-gray-600 mb-4">{col.descricao}</p>

            <div className="space-y-3">
              {grupos[idx].length === 0 && (
                <p className="text-xs text-gray-600 text-center py-8">Nenhum pedido</p>
              )}
              {grupos[idx].map(p => renderCard(p, col.id))}
            </div>
          </div>
        ))}
      </div>

      {/* Modal de confirmação de entrega */}
      {canUpdate && confirmando && (
        <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50">
          <div className="bg-card border border-border-medium rounded-xl p-6 w-full max-w-md mx-4 space-y-4">
            <h3 className="text-foreground font-semibold">Confirmar entrega</h3>
            <p className="text-sm text-muted">
              Pedido #{confirmando.numero} — {confirmando.cliente}
            </p>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="text-xs text-muted mb-1 block uppercase tracking-wide">N° NF (opcional)</label>
                <input type="text" value={nfNum} onChange={e => setNfNum(e.target.value)}
                  placeholder="NF-001234"
                  className="w-full bg-input border border-border-medium rounded-lg px-3 py-2 text-sm text-foreground focus:outline-none focus:border-[#1e7e3e]" />
              </div>
              <div>
                <label className="text-xs text-muted mb-1 block uppercase tracking-wide">Data NF (opcional)</label>
                <input type="date" value={nfData} onChange={e => setNfData(e.target.value)}
                  className="w-full bg-input border border-border-medium rounded-lg px-3 py-2 text-sm text-foreground focus:outline-none focus:border-[#1e7e3e]" />
              </div>
            </div>

            <div className="flex gap-3 pt-2">
              <button onClick={confirmarEntrega} disabled={isPending}
                className="flex-1 px-4 py-2 bg-[#1e7e3e] text-white rounded-lg text-sm font-medium hover:bg-[#2d9b54] transition-colors disabled:opacity-50">
                {isPending ? 'Salvando...' : '✓ Confirmar Entrega'}
              </button>
              <button onClick={() => setConfirmando(null)}
                className="px-4 py-2 text-muted hover:text-foreground text-sm transition-colors">
                Cancelar
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  )
}
