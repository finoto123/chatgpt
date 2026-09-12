'use client'

import Link from 'next/link'
import { useMemo, useState, useTransition, useRef, useEffect } from 'react'
import { createPortal } from 'react-dom'
import { useRouter } from 'next/navigation'
import { StatusPedido } from '@/types'
import { formatDate } from '@/lib/utils'
import { atualizarStatusPedido } from '@/app/pedidos/actions'
import { Calendar, Package, MoreHorizontal, MoveRight, User, Hash } from 'lucide-react'
import { toast } from 'sonner'
import { ModalMoveCorte, ModalMoveEstamparia, ModalMoveCostura, ModalMoveAcabamento, type OficinaOption } from './PipelineModals'
import { usePermission } from '@/components/providers/AuthorizationProvider'

const COLUNAS: { status: StatusPedido; label: string; color: string; dimBg: string; border: string }[] = [
  { status: 'aguardando_corte', label: 'Aguardando Corte', color: '#818CF8', dimBg: 'rgba(79,70,229,0.1)', border: 'rgba(79,70,229,0.3)' },
  { status: 'corte',            label: 'Corte',            color: '#22D3EE', dimBg: 'rgba(8,145,178,0.1)', border: 'rgba(8,145,178,0.3)' },
  { status: 'sublimacao',       label: 'Estampa',          color: '#C084FC', dimBg: 'rgba(124,58,237,0.1)', border: 'rgba(124,58,237,0.3)' },
  { status: 'dtf',              label: 'DTF',              color: '#F472B6', dimBg: 'rgba(244,114,182,0.1)', border: 'rgba(244,114,182,0.3)' },
  { status: 'bordados',         label: 'Bordados',         color: '#10B981', dimBg: 'rgba(16,185,129,0.1)', border: 'rgba(16,185,129,0.3)' },
  { status: 'costura',          label: 'Oficinas Externas',color: '#FCD34D', dimBg: 'rgba(245,158,11,0.1)', border: 'rgba(245,158,11,0.3)' },
  { status: 'acabamento',       label: 'Acabamento',       color: '#34D399', dimBg: 'rgba(5,150,105,0.1)', border: 'rgba(5,150,105,0.3)' },
  { status: 'entregue',         label: 'Entregue',         color: '#4ADE80', dimBg: 'rgba(34,197,94,0.1)', border: 'rgba(34,197,94,0.3)' },
]

interface PedidoKanban {
  id: string
  numero: string
  cliente: string
  entrega_programado: string
  status: string
  tipo_estampa: string | null
  itens_pedido: { qtde: number }[]
}

function DropdownOpcoes({
  currentStatus,
  onMove,
}: {
  currentStatus: string
  onMove: (novoStatus: StatusPedido) => void
}) {
  const [open, setOpen] = useState(false)
  const [coords, setCoords] = useState({ top: 0, right: 0 })
  const btnRef = useRef<HTMLButtonElement>(null)

  useEffect(() => {
    if (!open) return
    const close = () => setOpen(false)
    window.addEventListener('scroll', close, { capture: true })
    return () => window.removeEventListener('scroll', close, { capture: true })
  }, [open])

  const handleOpen = () => {
    if (btnRef.current) {
      const rect = btnRef.current.getBoundingClientRect()
      setCoords({ top: rect.bottom + 8, right: window.innerWidth - rect.right })
    }
    setOpen(v => !v)
  }

  return (
    <div onClick={e => { e.preventDefault(); e.stopPropagation() }}>
      <button
        ref={btnRef}
        onClick={handleOpen}
        title="Mover para outra etapa"
        className="p-1.5 rounded-md bg-input text-muted hover:text-foreground hover:bg-surface-hover transition-colors shadow-sm border border-transparent hover:border-border-medium"
      >
        <MoreHorizontal size={14} />
      </button>

      {open && typeof window !== 'undefined' && createPortal(
        <>
          <div className="fixed inset-0 z-[200]" onClick={() => setOpen(false)} />
          <div
            className="fixed z-[201] rounded-xl overflow-hidden py-1.5 min-w-44 animate-in fade-in zoom-in-95 duration-200"
            style={{
              top: coords.top,
              right: coords.right,
              background: 'var(--card-bg)',
              border: '1px solid var(--border-medium)',
              boxShadow: '0 10px 25px -5px rgba(0, 0, 0, 0.5), 0 8px 10px -6px rgba(0, 0, 0, 0.3)',
            }}
          >
            <div className="px-3 py-1.5 mb-1 border-b border-border-medium">
              <p className="text-[10px] font-bold text-muted uppercase tracking-widest flex items-center gap-1.5">
                <MoveRight size={10} /> Mover para
              </p>
            </div>
            
            <div className="max-h-64 overflow-y-auto custom-scrollbar">
              {COLUNAS.map(col => {
                const isActive = col.status === currentStatus
                return (
                  <button
                    key={col.status}
                    onClick={() => {
                      if (!isActive) {
                        setOpen(false)
                        onMove(col.status)
                      }
                    }}
                    disabled={isActive}
                    className={`w-full text-left px-3 py-2 text-sm transition-colors flex items-center justify-between ${
                        isActive 
                          ? 'bg-surface-hover text-brand-green font-medium' 
                          : 'text-muted hover:bg-surface-hover hover:text-foreground'
                      }`}
                  >
                    <span className="flex items-center gap-2">
                        <span className="w-2 h-2 rounded-full" style={{ background: col.color }} />
                        {col.label}
                    </span>
                  </button>
                )
              })}
            </div>
          </div>
        </>,
        document.body
      )}
    </div>
  )
}

function RenderBadges({ tipoEstampa }: { tipoEstampa: string | null }) {
  if (!tipoEstampa) return null
  
  const text = tipoEstampa.toUpperCase()
  const hasSub = text.includes('SUBLIMAÇÃO') || text.includes('SUBLIMACAO')
  const hasDtf = text.includes('DTF')
  const hasBordado = text.includes('BORDADO')
  
  if (!hasSub && !hasDtf && !hasBordado) return null

  return (
    <div className="flex flex-wrap gap-1.5 mt-2">
      {hasSub && (
        <span className="px-1.5 py-0.5 rounded text-[9px] font-bold tracking-wider bg-indigo-950/40 text-indigo-400 border border-indigo-500/20">
          SUBLIMAÇÃO
        </span>
      )}
      {hasDtf && (
        <span className="px-1.5 py-0.5 rounded text-[9px] font-bold tracking-wider bg-pink-950/40 text-pink-400 border border-pink-500/20">
          DTF
        </span>
      )}
      {hasBordado && (
        <span className="px-1.5 py-0.5 rounded text-[9px] font-bold tracking-wider bg-emerald-950/40 text-emerald-400 border border-emerald-500/20">
          BORDADO
        </span>
      )}
    </div>
  )
}

export function PipelineKanban({ pedidos, oficinas = [] }: { pedidos: PedidoKanban[], oficinas?: OficinaOption[] }) {
  const canUpdateOrders = usePermission('orders.update')
  const canUpdateProduction = usePermission('production.update')
  const router = useRouter()
  const [, startTransition] = useTransition()
  
  // State for modais
  const [modalType, setModalType] = useState<StatusPedido | null>(null)
  const [selectedPedido, setSelectedPedido] = useState<PedidoKanban | null>(null)

  const grupos = useMemo(() => {
    return COLUNAS.reduce((acc, col) => {
      acc[col.status] = pedidos.filter(p => p.status === col.status)
      return acc
    }, {} as Record<string, PedidoKanban[]>)
  }, [pedidos])

  const handleMoveIntent = (pedido: PedidoKanban, novoStatus: StatusPedido) => {
    // If moving to specific stages, open modal instead of raw move
    if (['corte', 'sublimacao', 'dtf', 'bordados', 'costura', 'acabamento'].includes(novoStatus)) {
      setSelectedPedido(pedido)
      setModalType(novoStatus)
    } else {
      // Direct move for others (e.g. aguardando_corte, entregue, atrasado, cancelado)
      startTransition(async () => {
        const result = await atualizarStatusPedido(pedido.id, novoStatus)
        if (result?.error) toast.error('Erro ao atualizar')
        else {
          toast.success('Pedido movido com sucesso')
          router.refresh()
        }
      })
    }
  }

  const closeModals = () => {
    setModalType(null)
    setSelectedPedido(null)
  }

  const totalPecasSelected = selectedPedido?.itens_pedido?.reduce((s, i) => s + i.qtde, 0) || 0

  return (
    <div className="rounded-2xl bg-background border border-border overflow-hidden shadow-xl">
      
      {/* RENDER MODALS */}
      {selectedPedido && modalType === 'corte' && (
        <ModalMoveCorte isOpen={true} onClose={closeModals} pedidoId={selectedPedido.id} pedidoNumero={selectedPedido.numero} />
      )}
      {selectedPedido && ['sublimacao', 'dtf', 'bordados'].includes(modalType as string) && (
        <ModalMoveEstamparia 
          isOpen={true} 
          onClose={closeModals} 
          pedidoId={selectedPedido.id} 
          pedidoNumero={selectedPedido.numero} 
          targetCol={modalType as 'sublimacao' | 'dtf' | 'bordados'}
          oficinas={oficinas} 
          totalPecas={totalPecasSelected} 
        />
      )}
      {selectedPedido && modalType === 'costura' && (
        <ModalMoveCostura isOpen={true} onClose={closeModals} pedidoId={selectedPedido.id} pedidoNumero={selectedPedido.numero} oficinas={oficinas} totalPecas={totalPecasSelected} />
      )}
      {selectedPedido && modalType === 'acabamento' && (
        <ModalMoveAcabamento isOpen={true} onClose={closeModals} pedidoId={selectedPedido.id} pedidoNumero={selectedPedido.numero} />
      )}

      <div className="p-5 border-b border-border bg-gradient-to-r from-card to-background">
        <h2 className="text-xl font-bold text-foreground tracking-tight flex items-center gap-2">
          <span className="w-1.5 h-6 bg-blue-500 rounded-full inline-block" />
          Pipeline de Produção Global
        </h2>
        <p className="text-xs text-muted mt-1 ml-3.5">
          Acompanhe o fluxo exato de cada pedido em tempo real.
        </p>
      </div>

      <div className="p-4 overflow-x-auto custom-scrollbar-kanban" style={{ paddingBottom: '24px' }}>
        <div className="flex gap-4 min-w-max">
          {COLUNAS.map(col => (
            <div 
              key={col.status} 
              className="flex-shrink-0 w-72 flex flex-col bg-card/50 rounded-xl border border-border"
            >
              {/* Kanban Column Header */}
              <div 
                className="p-3.5 border-b border-border flex items-center justify-between rounded-t-xl"
                style={{ background: `linear-gradient(to right, ${col.dimBg}, transparent)` }}
              >
                <div className="flex items-center gap-2.5">
                  <div 
                    className="w-3 h-3 rounded-full flex-shrink-0 shadow-[0_0_8px_rgba(0,0,0,0.5)]" 
                    style={{ background: col.color, boxShadow: `0 0 10px ${col.color}40` }} 
                  />
                  <span className="text-sm font-bold tracking-wide" style={{ color: col.color }}>
                    {col.label}
                  </span>
                </div>
                <div 
                  className="px-2 py-0.5 rounded-md text-xs font-bold"
                  style={{ background: col.dimBg, color: col.color, border: `1px solid ${col.border}` }}
                >
                  {grupos[col.status]?.length ?? 0}
                </div>
              </div>

              {/* Kanban Cards */}
              <div className="p-3 space-y-3 min-h-[150px] overflow-y-auto max-h-[60vh] custom-scrollbar">
                {grupos[col.status]?.map(pedido => {
                  const total = pedido.itens_pedido?.reduce((s, i) => s + i.qtde, 0) ?? 0
                  
                  return (
                    <div 
                      key={pedido.id} 
                      className="group relative rounded-xl bg-input border border-border-medium hover:border-gray-500 transition-all duration-200 hover:shadow-lg hover:-translate-y-0.5 overflow-hidden"
                    >
                      {/* Left color bar */}
                      <div className="absolute left-0 top-0 bottom-0 w-1" style={{ background: col.color }} />
                      
                      <div className="p-3 pl-4">
                        {/* Header: Order Number & Actions */}
                        <div className="flex items-start justify-between gap-2 mb-2">
                          <Link href={`/pedidos?search=${encodeURIComponent(pedido.numero)}`} className="hover:opacity-80">
                            <span className="flex items-center gap-1 text-sm font-bold text-foreground bg-foreground/5 px-2 py-0.5 rounded-md border border-border-medium">
                              <Hash size={12} className="text-muted" />
                              {pedido.numero}
                            </span>
                          </Link>
                          {(canUpdateOrders || canUpdateProduction) && <DropdownOpcoes
                            currentStatus={pedido.status}
                            onMove={(novoStatus) => handleMoveIntent(pedido, novoStatus)}
                          />}
                        </div>

                        {/* Client Name */}
                        <Link href={`/pedidos?search=${encodeURIComponent(pedido.numero)}`} className="block group-hover:opacity-90">
                          <p className="text-xs text-muted font-medium bg-foreground/5 px-2 py-0.5 rounded border border-border-medium flex items-center gap-1 mb-3">
                            <User size={12} className="text-muted" />
                            {pedido.cliente}
                          </p>

                          {/* Estamparia Badges */}
                          <RenderBadges tipoEstampa={pedido.tipo_estampa} />

                          {/* Footer Data */}
                          <div className="flex items-center justify-between mt-3.5 pt-3 border-t border-border">
                            <div className="flex items-center gap-1.5 text-xs text-muted bg-surface-hover px-2 py-1 rounded-md border border-border">
                              <Package size={12} className="text-muted" />
                              <span className="font-semibold text-foreground">{total}</span>
                              <span className="text-[10px] uppercase">pçs</span>
                            </div>
                            
                            <div 
                              className="flex items-center gap-1.5 text-xs px-2 py-1 rounded-md border"
                              style={{ 
                                color: col.color, 
                                background: col.dimBg,
                                borderColor: col.border 
                              }}
                            >
                              <Calendar size={11} />
                              <span className="font-semibold">
                                {formatDate(pedido.entrega_programado)}
                              </span>
                            </div>
                          </div>
                        </Link>
                      </div>
                    </div>
                  )
                })}
                
                {(!grupos[col.status] || grupos[col.status].length === 0) && (
                  <div className="flex flex-col items-center justify-center h-20 text-center opacity-40 border border-dashed border-border rounded-lg">
                    <p className="text-xs text-muted tracking-wide">Vazio</p>
                  </div>
                )}
              </div>
            </div>
          ))}
        </div>
      </div>
      
      {/* Custom styles for the kanban scrollbar */}
      <style dangerouslySetInnerHTML={{__html: `
        .custom-scrollbar-kanban::-webkit-scrollbar {
          height: 8px;
        }
        .custom-scrollbar-kanban::-webkit-scrollbar-track {
          background: var(--scrollbar-track);
          border-radius: 8px;
        }
        .custom-scrollbar-kanban::-webkit-scrollbar-thumb {
          background: var(--scrollbar-thumb);
          border-radius: 8px;
        }
        .custom-scrollbar-kanban::-webkit-scrollbar-thumb:hover {
          background: var(--scrollbar-thumb-hover);
        }
      `}} />
    </div>
  )
}
