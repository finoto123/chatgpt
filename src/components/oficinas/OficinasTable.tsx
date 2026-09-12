'use client'

import { useMemo, useState } from 'react'
import { Search, Pencil } from 'lucide-react'
import { formatDate, formatBRL } from '@/lib/utils'
import { RegistrarEnvioDrawer } from './RegistrarEnvioDrawer'
import { ConfirmarRetornoDrawer } from './ConfirmarRetornoDrawer'
import { usePermission } from '@/components/providers/AuthorizationProvider'

const STATUS_CONFIG: Record<string, { label: string; bg: string; color: string }> = {
  enviado: { label: 'Aguardando', bg: 'rgba(59,130,246,0.15)', color: '#60A5FA' },
  costurando: { label: 'Costurando', bg: 'rgba(129,140,248,0.15)', color: '#818CF8' },
  retornado: { label: 'Pronto para buscar', bg: 'rgba(245,158,11,0.15)', color: '#F59E0B' },
  finalizado: { label: 'Finalizado', bg: 'rgba(34,197,94,0.15)', color: '#4ADE80' },
  pago: { label: 'Pago', bg: 'rgba(22,163,74,0.15)', color: '#16A34A' },
  atraso_retorno: { label: 'Atrasado', bg: 'rgba(239,68,68,0.15)', color: '#F87171' },
  pendente_pagamento: { label: 'Pend. Pagamento', bg: 'rgba(245,158,11,0.15)', color: '#FCD34D' },
}

type FiltroStatus = null | 'enviado' | 'costurando' | 'atraso_retorno' | 'retornado' | 'pago' | 'pendente_pagamento' | 'finalizado'

const FILTROS: { valor: FiltroStatus; label: string; tone?: 'red' | 'yellow' | 'green' | 'blue' | 'indigo' }[] = [
  { valor: 'enviado', label: 'Aguardando', tone: 'yellow' },
  { valor: 'costurando', label: 'Costurando', tone: 'indigo' },
  { valor: 'atraso_retorno', label: 'Atrasado', tone: 'red' },
  { valor: 'retornado', label: 'Pronto para buscar', tone: 'blue' },
  { valor: 'finalizado', label: 'Finalizado', tone: 'green' },
]

interface ItemPedido {
  qtde: number
  tamanho: string
  modelo: string
  valor_unitario: number
}

interface PedidoSimples {
  id: string
  numero: string
  cliente: string
  costura_programado: string | null
  costura_retorno: string | null
  costureira_id: string | null
  itens_pedido?: ItemPedido[]
}

interface OficinaSimples {
  id: string
  nome: string
  tipo: string
}

interface EnvioRow {
  id: string
  pedido_id: string
  oficina_id: string
  modelo: string | null
  grade_quantidade: Record<string, number>
  total_pecas: number | null
  data_envio: string | null
  valor_unitario: number | null
  valor_total: number | null
  retorno_previsto: string | null
  retorno_real: string | null
  qt_retornada_1a_entrega: number | null
  status: string
  observacoes: string | null
  pedido: { numero: string; cliente: string } | null
  oficina: { nome: string } | null
}

interface OficinasTableProps {
  envios: EnvioRow[]
  pedidos: PedidoSimples[]
  oficinas: OficinaSimples[]
}

function StatusBadge({ status }: { status: string }) {
  const cfg = STATUS_CONFIG[status] ?? { label: status, bg: '#f9fafb', color: '#6b7280' }
  return (
    <span
      className="px-2 py-0.5 rounded-full text-xs font-semibold whitespace-nowrap"
      style={{ backgroundColor: cfg.bg, color: cfg.color }}
    >
      {cfg.label}
    </span>
  )
}

function formatGrade(grade: Record<string, number> | null | unknown): string {
  if (!grade || typeof grade !== 'object' || Array.isArray(grade)) return '---'
  const gradeObj = grade as Record<string, unknown>
  const entries = Object.entries(gradeObj)
    .filter(([, v]) => Number(v) > 0)
    .map(([k, v]) => `${k}/${Number(v)}`)
  if (entries.length === 0) return '---'
  return entries.join(' ')
}

const hojeStr = new Date().toLocaleDateString('sv-SE')

function getEffectiveStatus(envio: EnvioRow) {
  if (
    (envio.status === 'enviado' || envio.status === 'costurando') &&
    envio.retorno_previsto &&
    envio.retorno_previsto < hojeStr
  ) {
    return 'atraso_retorno'
  }
  return envio.status
}

function isStatusFiltroPrincipal(envio: EnvioRow) {
  const status = getEffectiveStatus(envio)
  return status === 'enviado' || status === 'costurando' || status === 'atraso_retorno' || status === 'retornado' || status === 'finalizado'
}

function Dot({ tone }: { tone?: 'red' | 'yellow' | 'green' | 'blue' | 'indigo' }) {
  if (!tone) return null
  const color = tone === 'red' ? '#F43F5E' : tone === 'yellow' ? '#FBBF24' : tone === 'green' ? '#4ADE80' : tone === 'indigo' ? '#818CF8' : '#3B82F6'
  return <span className="h-2.5 w-2.5 rounded-full" style={{ background: color, boxShadow: `0 0 14px ${color}66` }} />
}

export function OficinasTable({ envios, pedidos, oficinas }: OficinasTableProps) {
  const canUpdate = usePermission('workshops.update')
  const canViewFinance = usePermission('finance.view')
  const [envioDrawerOpen, setEnvioDrawerOpen] = useState(false)
  const [retornoEnvio, setRetornoEnvio] = useState<EnvioRow | null>(null)
  const [filtroAtivo, setFiltroAtivo] = useState<FiltroStatus>(null)
  const [busca, setBusca] = useState('')

  const enviosFiltrados = useMemo(() => {
    const enviosPorStatus = filtroAtivo
      ? envios.filter(envio => getEffectiveStatus(envio) === filtroAtivo)
      : envios.filter(isStatusFiltroPrincipal)

    const termo = busca.trim().toLowerCase()
    if (!termo) return enviosPorStatus

    return enviosPorStatus.filter(envio => {
      const campos = [
        envio.pedido?.numero,
        envio.pedido?.cliente,
        envio.oficina?.nome,
        envio.modelo,
        formatGrade(envio.grade_quantidade),
      ]

      return campos.some(campo => String(campo ?? '').toLowerCase().includes(termo))
    })
  }, [envios, filtroAtivo, busca])


  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-semibold" style={{ color: 'var(--fg)' }}>Costura</h1>
          <p className="text-sm mt-1" style={{ color: 'var(--fg-muted)' }}>Envios para oficinas externas</p>
        </div>
        {canUpdate && <button
          onClick={() => setEnvioDrawerOpen(true)}
          className="px-4 py-2 bg-green-600 dark:bg-green-600 text-white rounded-lg text-sm font-medium hover:bg-green-700 dark:hover:bg-green-500 transition-colors"
        >
          + Registrar Envio
        </button>}
      </div>

      <div className="flex items-center justify-between gap-3 flex-wrap">
        <div className="flex items-center gap-2 flex-wrap">
          <span className="text-xs" style={{ color: 'var(--fg-muted)' }}>Filtrar:</span>
          {FILTROS.map(f => (
            <button
              key={String(f.valor)}
              onClick={() => setFiltroAtivo(f.valor)}
              className={`inline-flex items-center gap-2 px-3 py-1.5 rounded-full text-xs font-medium border transition-all ${
                filtroAtivo === f.valor
                  ? 'bg-green-600 text-white border-green-600 hover:bg-green-700'
                  : 'text-gray-500 dark:text-gray-400 border-border hover:border-gray-400 dark:hover:border-gray-500'
              }`}
            >
              <Dot tone={f.tone} />
              {f.label}
            </button>
          ))}
        </div>

        <div className="relative min-w-[260px] flex-1 max-w-sm">
          <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2" style={{ color: 'var(--fg-muted)' }} />
          <input
            value={busca}
            onChange={event => setBusca(event.target.value)}
            placeholder="Buscar pedido, cliente ou oficina..."
            className="w-full rounded-lg py-2 pl-9 pr-3 text-sm outline-none transition-colors"
            style={{
              background: 'var(--input-bg)',
              border: '1px solid var(--border-color)',
              color: 'var(--fg)',
            }}
          />
        </div>
      </div>


      <div
        className="rounded-xl overflow-hidden"
        style={{ background: 'var(--card-bg)', border: '1px solid var(--border-color)', boxShadow: 'var(--shadow-sm)' }}
      >
        <div className="overflow-x-auto">
          <table className="w-full text-sm min-w-[900px]">
            <thead style={{ background: 'var(--input-bg)', borderBottom: '1px solid var(--border-color)' }}>
              <tr>
                {['N° Pedido', 'Cliente', 'Modelo', 'TAM/QTDE', 'Total', 'Oficina', 'Envio', 'Val. Unit', 'Total R$', 'Previsto', 'Retorno', 'Status', 'Ações'].map(h => (
                  <th key={h} className="px-3 py-3 text-left text-xs font-medium uppercase tracking-wide whitespace-nowrap" style={{ color: 'var(--fg-muted)' }}>
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {enviosFiltrados.length === 0 ? (
                <tr>
                  <td colSpan={13} className="text-center py-10" style={{ color: 'var(--fg-muted)' }}>
                    Nenhum envio registrado
                  </td>
                </tr>
              ) : enviosFiltrados.map(envio => (
                <tr
                  key={envio.id}
                  className="transition-colors hover-item"
                  style={{ borderBottom: '1px solid var(--border-subtle)' }}
                >
                  <td className="px-3 py-3 font-semibold whitespace-nowrap" style={{ color: 'var(--fg)' }}>
                    #{envio.pedido?.numero ?? '---'}
                  </td>
                  <td className="px-3 py-3 max-w-[140px]" style={{ color: 'var(--fg-secondary)' }}>
                    <span className="truncate block" title={envio.pedido?.cliente ?? ''}>{envio.pedido?.cliente ?? '---'}</span>
                  </td>
                  <td className="px-3 py-3 max-w-[120px]" style={{ color: 'var(--fg-muted)' }}>
                    <span className="truncate block" title={envio.modelo ?? ''}>{envio.modelo ?? '---'}</span>
                  </td>
                  <td className="px-3 py-3 text-xs font-mono whitespace-nowrap" style={{ color: 'var(--fg-muted)' }}>
                    {formatGrade(envio.grade_quantidade)}
                  </td>
                  <td className="px-3 py-3 text-center font-medium" style={{ color: 'var(--fg)' }}>
                    {envio.total_pecas ?? 0}
                  </td>
                  <td className="px-3 py-3 whitespace-nowrap" style={{ color: 'var(--fg-muted)' }}>
                    {envio.oficina?.nome ?? '---'}
                  </td>
                  <td className="px-3 py-3 whitespace-nowrap" style={{ color: 'var(--fg-muted)' }}>
                    {formatDate(envio.data_envio)}
                  </td>
                  <td className="px-3 py-3" style={{ color: 'var(--fg-muted)' }}>
                    {canViewFinance && envio.valor_unitario ? formatBRL(envio.valor_unitario) : '---'}
                  </td>
                  <td className="px-3 py-3 font-medium whitespace-nowrap" style={{ color: 'var(--fg)' }}>
                    {canViewFinance ? formatBRL(envio.valor_total) : '---'}
                  </td>
                  <td className="px-3 py-3 whitespace-nowrap" style={{ color: 'var(--fg-muted)' }}>
                    {formatDate(envio.retorno_previsto)}
                  </td>
                  <td className="px-3 py-3 whitespace-nowrap">
                    {envio.retorno_real ? (
                      <span style={{ color: '#16a34a' }} className="font-medium">{formatDate(envio.retorno_real)}</span>
                    ) : (
                      <span style={{ color: 'var(--fg-muted)' }}>---</span>
                    )}
                  </td>
                  <td className="px-3 py-3">
                    <StatusBadge status={getEffectiveStatus(envio)} />
                  </td>
                  <td className="px-3 py-3">
                    {canUpdate && <button
                      className="p-1.5 rounded-md transition-colors hover:bg-surface-hover"
                      style={{ color: 'var(--fg-muted)' }}
                      onClick={() => setRetornoEnvio(envio)}
                      title="Editar status / retorno"
                    >
                      <Pencil size={15} />
                    </button>}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {canUpdate && <RegistrarEnvioDrawer
        open={envioDrawerOpen}
        onClose={() => setEnvioDrawerOpen(false)}
        pedidos={pedidos}
        oficinas={oficinas}
      />}

      {canUpdate && retornoEnvio && (
        <ConfirmarRetornoDrawer
          envio={retornoEnvio}
          open={true}
          onClose={() => setRetornoEnvio(null)}
        />
      )}
    </div>
  )
}
