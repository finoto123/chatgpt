import { StatusBadge } from '@/components/pedidos/StatusBadge'
import { StatusPedido } from '@/types'
import { formatDate } from '@/lib/utils'
import { Calendar } from 'lucide-react'

interface Pedido {
  id: string
  numero: string
  cliente: string
  entrega_programado: string
  status: string
}

export function EntregaProxima({ pedidos }: { pedidos: Pedido[] }) {
  return (
    <div
      className="rounded-xl p-5"
      style={{
        background: 'var(--card-bg)',
        border: '1px solid var(--border-color)',
        boxShadow: 'var(--shadow-sm)',
      }}
    >
      <div className="flex items-center gap-2 mb-4">
        <Calendar size={15} style={{ color: '#b45309' }} />
        <h3 className="font-semibold text-sm" style={{ color: 'var(--fg)' }}>Entregas Próximas</h3>
        <span
          className="text-xs px-2 py-0.5 rounded-full font-medium ml-auto"
          style={{ background: 'rgba(245,158,11,0.12)', color: '#b45309' }}
        >
          7 dias
        </span>
      </div>

      {pedidos.length === 0 ? (
        <p className="text-sm py-6 text-center" style={{ color: 'var(--fg-muted)' }}>
          Nenhuma entrega nos próximos 7 dias
        </p>
      ) : (
        <table className="w-full text-sm">
          <thead>
            <tr
              className="text-xs"
              style={{ borderBottom: '1px solid var(--border-subtle)', color: 'var(--fg-muted)' }}
            >
              <th className="text-left pb-2 font-medium">Pedido</th>
              <th className="text-left pb-2 font-medium">Cliente</th>
              <th className="text-left pb-2 font-medium">Entrega</th>
              <th className="text-left pb-2 font-medium">Status</th>
            </tr>
          </thead>
          <tbody>
            {pedidos.map(p => (
              <tr
                key={p.id}
                className="last:border-0"
                style={{ borderBottom: '1px solid var(--border-subtle)' }}
              >
                <td className="py-2.5 font-semibold text-xs" style={{ color: 'var(--fg)' }}>#{p.numero}</td>
                <td className="py-2.5 text-xs truncate max-w-32" style={{ color: 'var(--fg-muted)' }}>{p.cliente}</td>
                <td className="py-2.5 text-xs font-semibold" style={{ color: '#b45309' }}>
                  {formatDate(p.entrega_programado)}
                </td>
                <td className="py-2.5">
                  <StatusBadge status={p.status as StatusPedido} />
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </div>
  )
}
