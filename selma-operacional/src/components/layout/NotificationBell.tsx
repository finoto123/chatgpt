'use client'

import { Bell, Clock } from 'lucide-react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { useEffect, useRef, useState } from 'react'
import { differenceInDays, format, parseISO } from 'date-fns'
import { ptBR } from 'date-fns/locale'
import { getPedidosAtrasados, type PedidoAtrasado } from '@/app/dashboard/actions'
import { markCommercialNotificationRead } from '@/app/crm/intelligence-actions'
import { usePermission } from '@/components/providers/AuthorizationProvider'
import { createClient } from '@/lib/supabase/client'
import type { CommercialNotification } from '@/types/commercial'

export function NotificationBell() {
  const router=useRouter()
  const canViewDashboard = usePermission('dashboard.view')
  const canViewCrm = usePermission('crm.view')
  const [pedidos, setPedidos] = useState<PedidoAtrasado[]>([])
  const [commercial, setCommercial] = useState<CommercialNotification[]>([])
  const [open, setOpen] = useState(false)
  const ref = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (canViewDashboard) getPedidosAtrasados().then(setPedidos)
  }, [canViewDashboard])

  useEffect(() => {
    if (!canViewCrm) return
    const supabase=createClient()
    supabase.from('notifications').select('id,type,title,body,entity_type,entity_id,read_at,created_at').order('created_at',{ascending:false}).limit(20).then(({data})=>setCommercial((data??[]) as CommercialNotification[]))
  }, [canViewCrm])

  useEffect(() => {
    if (!open) return
    function handleClickOutside(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) {
        setOpen(false)
      }
    }
    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [open])

  if (!canViewDashboard && !canViewCrm) return null
  const unread=commercial.filter(item=>!item.read_at).length

  return (
    <div ref={ref} className="relative">
      <button
        onClick={() => setOpen(o => !o)}
        className="relative p-2 rounded-lg transition-colors hover-item"
        style={{ color: 'var(--fg-muted)' }}
        aria-label="Notificações"
      >
        <Bell size={17} />
        {pedidos.length + unread > 0 && (
          <span
            className="absolute top-1 right-1 min-w-[16px] h-4 px-0.5 rounded-full flex items-center justify-center text-[10px] font-bold text-white"
            style={{ background: '#ef4444', lineHeight: 1 }}
          >
            {pedidos.length + unread > 99 ? '99+' : pedidos.length + unread}
          </span>
        )}
      </button>

      {open && (
        <div
          className="absolute right-0 mt-1 w-80 rounded-xl shadow-2xl z-50 overflow-hidden"
          style={{
            background: 'var(--tooltip-bg)',
            border: '1px solid var(--border-color)',
          }}
        >
          <div
            className="px-4 py-3 flex items-center justify-between"
            style={{ borderBottom: '1px solid var(--border-subtle)' }}
          >
            <span className="text-sm font-semibold" style={{ color: 'var(--fg)' }}>
              Notificações
            </span>
            {pedidos.length + unread > 0 && (
              <span
                className="text-xs px-2 py-0.5 rounded-full font-medium"
                style={{ background: '#ef44441a', color: '#ef4444' }}
              >
                {pedidos.length + unread} pendente{pedidos.length + unread !== 1 ? 's' : ''}
              </span>
            )}
          </div>

          <div className="max-h-80 overflow-y-auto">
            {commercial.map(item=><button key={item.id} onClick={async()=>{await markCommercialNotificationRead(item.id);setCommercial(current=>current.map(x=>x.id===item.id?{...x,read_at:new Date().toISOString()}:x));if(item.entity_type==='opportunity'&&item.entity_id)router.push(`/crm/oportunidades/${item.entity_id}`);else if(item.entity_type==='lead')router.push('/crm/leads');else if(item.entity_type==='task')router.push('/tarefas')}} className={`w-full text-left px-4 py-3 hover-item border-b ${item.read_at?'opacity-60':''}`}><p className="text-xs font-semibold">{item.title}</p>{item.body&&<p className="text-xs text-muted mt-1">{item.body}</p>}</button>)}
            {pedidos.length === 0 && commercial.length === 0 ? (
              <div className="px-4 py-6 text-center">
                <p className="text-sm" style={{ color: 'var(--fg-muted)' }}>
                  Nenhuma notificação
                </p>
              </div>
            ) : (
              pedidos.map(pedido => {
                const diasAtraso = differenceInDays(
                  new Date(),
                  parseISO(pedido.entrega_programado)
                )
                return (
                  <Link
                    key={pedido.id}
                    href={`/pedidos/${pedido.id}`}
                    onClick={() => setOpen(false)}
                    className="flex items-start gap-3 px-4 py-3 transition-colors hover-item"
                    style={{ borderBottom: '1px solid var(--border-subtle)' }}
                  >
                    <div
                      className="mt-0.5 p-1.5 rounded-lg flex-shrink-0"
                      style={{ background: '#ef44441a' }}
                    >
                      <Clock size={12} style={{ color: '#ef4444' }} />
                    </div>
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center justify-between gap-2">
                        <span className="text-xs font-semibold" style={{ color: 'var(--fg)' }}>
                          #{pedido.numero}
                        </span>
                        <span className="text-xs flex-shrink-0" style={{ color: '#ef4444' }}>
                          {diasAtraso}d atraso
                        </span>
                      </div>
                      <p className="text-xs truncate mt-0.5" style={{ color: 'var(--fg-muted)' }}>
                        {pedido.cliente}
                      </p>
                      <p className="text-xs mt-0.5" style={{ color: 'var(--fg-muted)' }}>
                        Entrega:{' '}
                        {format(parseISO(pedido.entrega_programado), "dd/MM/yyyy", { locale: ptBR })}
                      </p>
                    </div>
                  </Link>
                )
              })
            )}
          </div>

          {pedidos.length > 0 && (
            <div style={{ borderTop: '1px solid var(--border-subtle)' }}>
              <Link
                href="/pedidos?status=atrasado"
                onClick={() => setOpen(false)}
                className="flex items-center justify-center px-4 py-3 text-xs font-medium transition-colors hover-item"
                style={{ color: '#22c55e' }}
              >
                Ver todos os atrasados
              </Link>
            </div>
          )}
        </div>
      )}
    </div>
  )
}
