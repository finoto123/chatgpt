'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { toast } from 'sonner'
import { useTheme } from 'next-themes'
import { atualizarDadosCorte } from '@/app/producao/actions'
import { usePermission } from '@/components/providers/AuthorizationProvider'
import { Scissors, Package, Calendar } from 'lucide-react'

interface PedidoCorte {
  id: string
  numero: string
  cliente: string
  corte_cortador: string | null
  corte_consumo_tecido: number | null
  corte_codigo_ribana: string | null
  corte_consumo_ribana: number | null
  corte_codigo_gola: string | null
  corte_consumo_gola: number | null
  corte_inicio_previsto: string | null
  corte_inicio_real: string | null
  corte_fim_previsto: string | null
  corte_fim_real: string | null
  corte_situacao: string | null
  corte_observacoes: string | null
}

interface DetalhesOrdemDrawerProps {
  pedido: PedidoCorte
  open: boolean
  onClose: () => void
}

const inputStyle = {
  background: 'var(--surface-subtle)',
  border: '1px solid var(--border-color)',
  color: 'var(--fg)',
}

const labelStyle: React.CSSProperties = {
  color: 'var(--fg-muted)',
  fontSize: '11px',
  fontWeight: 600,
  textTransform: 'uppercase',
  letterSpacing: '0.05em',
}

const CONFIG_DARK = {
  'AGUARDANDO CORTE': { label: 'Aguardando Corte', color: '#9CA3AF' },
  'EM ANDAMENTO':     { label: 'Em Andamento',     color: '#60A5FA' },
  'FINALIZADO':       { label: 'Finalizado',       color: '#4ADE80' },
  'ATRASADO':         { label: 'Atrasado',         color: '#F87171' },
}

const CONFIG_LIGHT = {
  'AGUARDANDO CORTE': { label: 'Aguardando Corte', color: '#4B5563' },
  'EM ANDAMENTO':     { label: 'Em Andamento',     color: '#2563EB' },
  'FINALIZADO':       { label: 'Finalizado',       color: '#16A34A' },
  'ATRASADO':         { label: 'Atrasado',         color: '#DC2626' },
}

const SITUACOES = [
  { value: 'AGUARDANDO CORTE', label: 'Aguardando Corte' },
  { value: 'EM ANDAMENTO',     label: 'Em Andamento' },
  { value: 'FINALIZADO',       label: 'Finalizado' },
  { value: 'ATRASADO',         label: 'Atrasado' },
]

export function DetalhesOrdemDrawer({ pedido, open, onClose }: DetalhesOrdemDrawerProps) {
  const canUpdate = usePermission('production.update')
  const router = useRouter()
  const { resolvedTheme } = useTheme()
  const isLight = resolvedTheme === 'light'
  const config = isLight ? CONFIG_LIGHT : CONFIG_DARK

  function toDateInput(val: string | null | undefined): string {
    if (!val) return ''
    return String(val).split('T')[0]
  }

  function buildFormState(p: PedidoCorte) {
    return {
      corte_cortador:        p.corte_cortador ?? '',
      corte_consumo_tecido:  p.corte_consumo_tecido?.toString() ?? '',
      corte_codigo_ribana:   p.corte_codigo_ribana ?? '',
      corte_consumo_ribana:  p.corte_consumo_ribana?.toString() ?? '',
      corte_codigo_gola:     p.corte_codigo_gola ?? '',
      corte_consumo_gola:    p.corte_consumo_gola?.toString() ?? '',
      corte_inicio_previsto: toDateInput(p.corte_inicio_previsto),
      corte_fim_real:        toDateInput(p.corte_fim_real),
      corte_situacao:        p.corte_situacao ?? '',
      corte_observacoes:     p.corte_observacoes ?? '',
    }
  }

  const [form, setForm] = useState(() => buildFormState(pedido))

  function handleChange(field: string, value: string) {
    setForm(prev => ({ ...prev, [field]: value }))
  }

  async function handleSave() {
    setLoading(true)
    try {
      const dados: Record<string, unknown> = {
        corte_cortador:        form.corte_cortador || null,
        corte_consumo_tecido:  form.corte_consumo_tecido ? parseFloat(form.corte_consumo_tecido) : null,
        corte_codigo_ribana:   form.corte_codigo_ribana || null,
        corte_consumo_ribana:  form.corte_consumo_ribana ? parseFloat(form.corte_consumo_ribana) : null,
        corte_codigo_gola:     form.corte_codigo_gola || null,
        corte_consumo_gola:    form.corte_consumo_gola ? parseFloat(form.corte_consumo_gola) : null,
        corte_inicio_previsto: form.corte_inicio_previsto || null,
        corte_fim_real:        form.corte_fim_real || null,
        corte_situacao:        form.corte_situacao || null,
        corte_observacoes:     form.corte_observacoes || null,
      }
      const result = await atualizarDadosCorte(pedido.id, dados)
      if (result.error) {
        toast.error('Erro ao salvar: ' + result.error)
      } else {
        toast.success('Ordem de corte atualizada!')
        router.refresh()
        onClose()
      }
    } finally {
      setLoading(false)
    }
  }

  const [loading, setLoading] = useState(false)
  const situacaoAtual = config[form.corte_situacao as keyof typeof config]

  return (
    <Dialog open={open} onOpenChange={v => !v && onClose()}>
      <DialogContent
        className="w-full sm:max-w-[560px] overflow-y-auto max-h-[90vh] p-0 border"
        style={{ background: 'var(--card-bg)', borderColor: 'var(--border-color)', color: 'var(--fg)' }}
      >
        {/* Header com destaque */}
        <DialogHeader className="px-6 py-5" style={{ borderBottom: '1px solid var(--border-subtle)' }}>
          <div className="flex items-start justify-between">
            <div>
              <DialogTitle className="text-base font-bold text-left" style={{ color: 'var(--fg)' }}>
                Detalhes da Ordem — #{pedido.numero}
              </DialogTitle>
              <p className="text-sm mt-0.5 text-left" style={{ color: 'var(--fg-muted)' }}>{pedido.cliente}</p>
            </div>
            {situacaoAtual && (
              <span
                className="text-xs font-semibold px-2.5 py-1 rounded-full"
                style={{
                  background: `${situacaoAtual.color}20`,
                  color: situacaoAtual.color,
                  border: `1px solid ${situacaoAtual.color}40`,
                }}
              >
                {situacaoAtual.label}
              </span>
            )}
          </div>
        </DialogHeader>

        <div className="px-6 py-5 space-y-6">
          {/* Cortador */}
          <div>
            <div className="flex items-center gap-2 mb-3">
              <Scissors size={13} className="text-green-600 dark:text-green-400" />
              <span className="text-xs font-semibold text-green-600 dark:text-green-400 tracking-wider">
                CORTADOR(A)
              </span>
            </div>
            <input
              disabled={!canUpdate}
              className="w-full rounded-lg px-3 py-2 text-sm focus:outline-none"
              style={inputStyle}
              placeholder="Nome do cortador"
              value={form.corte_cortador}
              onChange={e => handleChange('corte_cortador', e.target.value)}
            />
          </div>

          {/* Consumo de Materiais */}
          <div>
            <div className="flex items-center gap-2 mb-3" style={{ borderBottom: '1px solid var(--border-subtle)', paddingBottom: '10px' }}>
              <Package size={13} className="text-blue-600 dark:text-blue-400" />
              <span className="text-xs font-semibold text-blue-600 dark:text-blue-400 tracking-wider">
                CONSUMO DE MATERIAIS
              </span>
            </div>
            <div className="space-y-3">
              <div>
                <label style={labelStyle}>Consumo de Tecido (kg)</label>
                <input
                  disabled={!canUpdate}
                  type="number"
                  step="0.001"
                  className="mt-1.5 w-full rounded-lg px-3 py-2 text-sm focus:outline-none"
                  style={inputStyle}
                  placeholder="0.000"
                  value={form.corte_consumo_tecido}
                  onChange={e => handleChange('corte_consumo_tecido', e.target.value)}
                />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label style={labelStyle}>Ribana — Código</label>
                  <input
                    disabled={!canUpdate}
                    className="mt-1.5 w-full rounded-lg px-3 py-2 text-sm focus:outline-none"
                    style={inputStyle}
                    placeholder="Código ribana"
                    value={form.corte_codigo_ribana}
                    onChange={e => handleChange('corte_codigo_ribana', e.target.value)}
                  />
                </div>
                <div>
                  <label style={labelStyle}>Ribana — Consumo (kg)</label>
                  <input
                    disabled={!canUpdate}
                    type="number"
                    step="0.001"
                    className="mt-1.5 w-full rounded-lg px-3 py-2 text-sm focus:outline-none"
                    style={inputStyle}
                    placeholder="0.000"
                    value={form.corte_consumo_ribana}
                    onChange={e => handleChange('corte_consumo_ribana', e.target.value)}
                  />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label style={labelStyle}>Gola — Código</label>
                  <input
                    disabled={!canUpdate}
                    className="mt-1.5 w-full rounded-lg px-3 py-2 text-sm focus:outline-none"
                    style={inputStyle}
                    placeholder="Código gola"
                    value={form.corte_codigo_gola}
                    onChange={e => handleChange('corte_codigo_gola', e.target.value)}
                  />
                </div>
                <div>
                  <label style={labelStyle}>Gola — Consumo (un)</label>
                  <input
                    disabled={!canUpdate}
                    type="number"
                    step="1"
                    className="mt-1.5 w-full rounded-lg px-3 py-2 text-sm focus:outline-none"
                    style={inputStyle}
                    placeholder="0"
                    value={form.corte_consumo_gola}
                    onChange={e => handleChange('corte_consumo_gola', e.target.value)}
                  />
                </div>
              </div>
            </div>
          </div>

          <div>
            <div className="flex items-center gap-2 mb-3" style={{ borderBottom: '1px solid var(--border-subtle)', paddingBottom: '10px' }}>
              <Calendar size={13} className="text-amber-600 dark:text-amber-500" />
              <span className="text-xs font-semibold text-amber-600 dark:text-amber-500 tracking-wider">
                DATAS DE PRODUÇÃO
              </span>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label style={labelStyle}>Início Planejado</label>
                <input
                  disabled={!canUpdate}
                  type="date"
                  className="mt-1.5 w-full rounded-lg px-3 py-2 text-sm focus:outline-none"
                  style={inputStyle}
                  value={form.corte_inicio_previsto}
                  onChange={e => handleChange('corte_inicio_previsto', e.target.value)}
                />
              </div>
              <div>
                <label style={labelStyle}>Finalização Real</label>
                <input
                  disabled={!canUpdate}
                  type="date"
                  className="mt-1.5 w-full rounded-lg px-3 py-2 text-sm focus:outline-none"
                  style={inputStyle}
                  value={form.corte_fim_real}
                  onChange={e => handleChange('corte_fim_real', e.target.value)}
                />
              </div>
            </div>
          </div>

          {/* Situação */}
          <div>
            <label style={labelStyle}>Situação</label>
            <select
              disabled={!canUpdate}
              value={form.corte_situacao}
              onChange={e => handleChange('corte_situacao', e.target.value)}
              className="mt-1.5 w-full rounded-lg px-3 py-2 text-sm focus:outline-none"
              style={inputStyle}
            >
              <option value="" style={{ background: 'var(--input-bg)' }}>Selecione a situação</option>
              {SITUACOES.map(s => (
                <option key={s.value} value={s.value} style={{ background: 'var(--input-bg)' }}>{s.label}</option>
              ))}
            </select>
          </div>

          {/* Observações */}
          <div>
            <label style={labelStyle}>Observações de Corte</label>
            <textarea
              disabled={!canUpdate}
              className="mt-1.5 w-full rounded-lg px-3 py-2 text-sm min-h-[80px] resize-none focus:outline-none"
              style={inputStyle}
              placeholder="Observações sobre o corte..."
              value={form.corte_observacoes}
              onChange={e => handleChange('corte_observacoes', e.target.value)}
            />
          </div>

          {/* Botões */}
          <div className="flex gap-3 pt-2" style={{ borderTop: '1px solid var(--border-subtle)' }}>
            {canUpdate && <button
              className="flex-1 rounded-lg py-2 text-sm transition-colors"
              style={{ border: '1px solid var(--border-medium)', color: 'var(--fg-muted)', background: 'transparent' }}
              onClick={onClose}
              disabled={loading}
            >
              Cancelar
            </button>}
            <button
              className="flex-1 rounded-lg py-2 text-sm font-medium transition-colors disabled:opacity-50"
              style={{ background: '#22C55E', color: 'white' }}
              onClick={handleSave}
              disabled={loading}
            >
              {loading ? 'Salvando...' : 'Salvar Alterações'}
            </button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  )
}
