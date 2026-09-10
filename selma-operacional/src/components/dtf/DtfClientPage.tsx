'use client'
import { useState, useMemo, useTransition } from 'react'
import { RegistrarEnvioDtfDrawer } from './RegistrarEnvioDtfDrawer'
import { atualizarStatusDtf } from '@/app/dtf/actions'
import { toast } from 'sonner'
import { usePermission } from '@/components/providers/AuthorizationProvider'

const FILTROS = [
  { valor: null,                label: 'Todos' },
  { valor: 'atrasado',          label: '🔴 Atrasado' },
  { valor: 'aguardando',        label: '🟡 Aguardando' },
  { valor: 'pronto_para_buscar',label: '🟢 Pronto para buscar' },
]

interface EnvioDtf {
  id: string
  statusCalculado: string
  pedido?: { numero: string; cliente: string }
  oficina?: { nome: string }
  grade_quantidade?: Record<string, number>
  data_envio: string | null
  retorno_previsto: string | null
}

interface PedidoDtfOption {
  id: string
  numero: string
  cliente: string
}

interface OficinaDtfOption {
  id: string
  nome: string
  tipo?: string
}

interface DtfClientPageProps {
  envios: EnvioDtf[]
  pedidos: PedidoDtfOption[]
  oficinas: OficinaDtfOption[]
}

export function DtfClientPage({ envios, pedidos, oficinas }: DtfClientPageProps) {
  const canUpdate = usePermission('production.update')
  const [drawerAberto, setDrawerAberto] = useState(false)
  const [filtro, setFiltro] = useState<string | null>(null)
  const [isPending, startTransition] = useTransition()

  const enviosFiltrados = useMemo(() => {
    if (!filtro) return envios
    return envios.filter((e) => e.statusCalculado === filtro)
  }, [envios, filtro])

  const marcarPronto = (envioId: string) => {
    startTransition(async () => {
      const result = await atualizarStatusDtf(envioId, 'pronto_para_buscar')
      if (result?.error) toast.error('Erro ao atualizar status')
      else toast.success('Marcado como pronto para buscar!')
    })
  }

  const COR_STATUS: Record<string, string> = {
    aguardando:         'text-amber-700 bg-amber-50 border-amber-200 dark:text-amber-400 dark:bg-amber-950/20 dark:border-amber-800/30',
    pronto_para_buscar: 'text-green-700 bg-green-50 border-green-200 dark:text-green-400 dark:bg-green-950/20 dark:border-green-800/30',
    atrasado:           'text-red-700 bg-red-50 border-red-200 dark:text-red-400 dark:bg-red-950/20 dark:border-red-800/30',
    em_transito:        'text-blue-700 bg-blue-50 border-blue-200 dark:text-blue-400 dark:bg-blue-950/20 dark:border-blue-800/30',
  }
  const LABEL_STATUS: Record<string, string> = {
    aguardando: 'Aguardando', pronto_para_buscar: 'Pronto para buscar',
    atrasado: 'Atrasado', em_transito: 'Em trânsito',
  }

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-semibold" style={{ color: 'var(--fg)' }}>DTF</h1>
          <p className="text-sm text-gray-500 mt-1">Envios para DTF externa</p>
        </div>
        {canUpdate && <button onClick={() => setDrawerAberto(true)}
          className="px-4 py-2 bg-green-600 dark:bg-green-600 text-white rounded-lg text-sm font-medium hover:bg-green-700 dark:hover:bg-green-500 transition-colors">
          + Registrar Envio
        </button>}
      </div>

      {/* Filtros */}
      <div className="flex items-center gap-2 flex-wrap">
        <span className="text-xs text-gray-500">Filtrar:</span>
        {FILTROS.map(f => (
          <button key={String(f.valor)} onClick={() => setFiltro(f.valor)}
            className={`px-3 py-1.5 rounded-full text-xs font-medium border transition-all ${
              filtro === f.valor
                ? 'bg-green-600 text-white border-green-600 hover:bg-green-700'
                : 'text-gray-500 dark:text-gray-400 border-border hover:border-gray-400 dark:hover:border-gray-500'
            }`}>
            {f.label}
          </button>
        ))}
      </div>

      {/* Tabela */}
      <div className="bg-card border border-border rounded-xl overflow-hidden">
        <table className="w-full">
          <thead>
            <tr className="border-b border-border">
              {['PEDIDO','CLIENTE','OFICINA','GRADE','ENVIO','RETORNO','STATUS','AÇÃO'].map(h => (
                <th key={h} className="px-3 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wide">
                  {h}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {enviosFiltrados.length === 0 && (
              <tr><td colSpan={9} className="px-4 py-10 text-center text-sm text-gray-600">Nenhum envio encontrado</td></tr>
            )}
            {enviosFiltrados.map((e) => {
              const statusKey = e.statusCalculado as string
              return (
                <tr key={e.id} className="border-b border-border hover:bg-surface-hover transition-colors">
                  <td className="px-3 py-3 text-sm font-mono text-gray-400 dark:text-gray-500">#{e.pedido?.numero}</td>
                  <td className="px-3 py-3 text-sm text-foreground max-w-[140px] truncate">{e.pedido?.cliente}</td>
                  <td className="px-3 py-3 text-sm text-muted">{e.oficina?.nome ?? '—'}</td>
                  <td className="px-3 py-3 text-xs text-gray-400">
                    {Object.entries(e.grade_quantidade ?? {})
                      .filter(([,v]) => Number(v) > 0)
                      .map(([k,v]) => `${k}/${v}`)
                      .join(' ')}
                  </td>
                  <td className="px-3 py-3 text-sm text-muted">
                    {e.data_envio ? new Date(e.data_envio + 'T12:00:00').toLocaleDateString('pt-BR') : '—'}
                  </td>
                  <td className="px-3 py-3 text-sm text-muted">
                    {e.retorno_previsto ? new Date(e.retorno_previsto + 'T12:00:00').toLocaleDateString('pt-BR') : '—'}
                  </td>
                  <td className="px-3 py-3">
                    <span className={`text-xs px-2 py-1 rounded-full border ${COR_STATUS[statusKey] ?? 'text-gray-500 bg-gray-100 border-gray-200 dark:text-gray-400 dark:bg-gray-800 dark:border-gray-700'}`}>
                      {LABEL_STATUS[statusKey] ?? statusKey}
                    </span>
                  </td>
                  <td className="px-3 py-3">
                    {canUpdate && statusKey === 'aguardando' && (
                      <button onClick={() => marcarPronto(e.id)} disabled={isPending}
                        className="text-xs px-3 py-1 bg-green-50 dark:bg-green-950/20 text-green-700 dark:text-green-400 border border-green-200 dark:border-green-800/40 rounded-full hover:bg-green-100 dark:hover:bg-green-950/40 transition-colors disabled:opacity-50">
                        Pronto →
                      </button>
                    )}
                  </td>
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>

      {canUpdate && <RegistrarEnvioDtfDrawer
        aberto={drawerAberto}
        onClose={() => setDrawerAberto(false)}
        pedidos={pedidos}
        oficinas={oficinas}
      />}
    </div>
  )
}
