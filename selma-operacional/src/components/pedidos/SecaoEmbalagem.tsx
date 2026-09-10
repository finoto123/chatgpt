'use client'

import { useState } from 'react'
import { useForm } from 'react-hook-form'
import { z } from 'zod'
import { zodResolver } from '@hookform/resolvers/zod'
import { toast } from 'sonner'
import { Save, CheckCircle2, PackageCheck } from 'lucide-react'
import { salvarEmbalagem, marcarComoEntregue } from '@/app/pedidos/actions'
import { Pedido } from '@/types'
import { usePermission } from '@/components/providers/AuthorizationProvider'

// ─── Esquema de validação ────────────────────────────────────────────────────

const embalagemFormSchema = z.object({
  embalagem_inicio_real:  z.string().optional(),
  embalagem_fim_real:     z.string().optional(),
  embalagem_data_nf:      z.string().optional(),
  embalagem_numero_nf:    z.string().optional(),
  embalagem_defeitos:     z.string().optional(),
  embalagem_situacao:     z.string().optional(),
  embalagem_observacoes:  z.string().optional(),
  atualizarStatus: z.boolean().optional(),
})

type EmbalagemFormValues = z.infer<typeof embalagemFormSchema>

// ─── Opções de situação ──────────────────────────────────────────────────────

const SITUACAO_OPCOES = [
  { value: 'Aguardando',    label: 'Aguardando' },
  { value: 'Em Embalagem',  label: 'Em Embalagem' },
  { value: 'Finalizado',    label: 'Finalizado' },
  { value: 'Entregue',      label: 'Entregue' },
]

// ─── Props ───────────────────────────────────────────────────────────────────

interface SecaoEmbalagemProps {
  pedido: Pedido
}

// ─── Helpers de estilo ───────────────────────────────────────────────────────

const inputStyle: React.CSSProperties = {
  background: 'var(--input-bg)',
  border: '1px solid var(--border-color)',
  color: 'var(--fg)',
  borderRadius: '0.5rem',
  padding: '0.5rem 0.75rem',
  fontSize: '0.875rem',
  width: '100%',
  outline: 'none',
}

const labelStyle: React.CSSProperties = {
  display: 'block',
  fontSize: '0.75rem',
  fontWeight: 500,
  color: 'var(--fg-muted)',
  marginBottom: '0.375rem',
}

// ─── Componente ──────────────────────────────────────────────────────────────

export function SecaoEmbalagem({ pedido }: SecaoEmbalagemProps) {
  const canUpdate = usePermission('production.update')
  const [salvando, setSalvando] = useState(false)
  const [entregando, setEntregando] = useState(false)
  const [confirmandoEntrega, setConfirmandoEntrega] = useState(false)

  const { register, handleSubmit, formState: { isDirty } } = useForm<EmbalagemFormValues>({
    resolver: zodResolver(embalagemFormSchema),
    defaultValues: {
      embalagem_inicio_real:  pedido.embalagem_inicio_real  ?? '',
      embalagem_fim_real:     pedido.embalagem_fim_real     ?? '',
      embalagem_data_nf:      pedido.embalagem_data_nf      ?? '',
      embalagem_numero_nf:    pedido.embalagem_numero_nf    ?? '',
      embalagem_defeitos:     pedido.embalagem_defeitos      ?? '',
      embalagem_situacao:     pedido.embalagem_situacao      ?? '',
      embalagem_observacoes:  pedido.embalagem_observacoes   ?? '',
      atualizarStatus: false,
    },
  })

  // Salvar dados de embalagem
  async function onSubmit(values: EmbalagemFormValues) {
    setSalvando(true)
    try {
      // Limpa strings vazias para undefined (não atualiza campos não preenchidos)
      const payload: Record<string, unknown> = { pedidoId: pedido.id }
      for (const [key, val] of Object.entries(values)) {
        if (key === 'atualizarStatus') {
          payload[key] = val
        } else {
          payload[key] = val === '' ? undefined : val
        }
      }
      const result = await salvarEmbalagem(payload)
      if (result?.error) {
        toast.error('Erro ao salvar embalagem. Tente novamente.')
      } else {
        toast.success('Dados de embalagem salvos com sucesso!')
      }
    } catch {
      toast.error('Erro ao salvar embalagem. Tente novamente.')
    } finally {
      setSalvando(false)
    }
  }

  // Marcar como entregue (dois cliques para confirmação)
  async function handleMarcarEntregue() {
    if (!confirmandoEntrega) {
      setConfirmandoEntrega(true)
      // Reseta o estado de confirmação após 3 segundos se não clicar novamente
      setTimeout(() => setConfirmandoEntrega(false), 3000)
      return
    }

    setEntregando(true)
    setConfirmandoEntrega(false)
    try {
      const result = await marcarComoEntregue(pedido.id)
      if (result?.error) {
        toast.error('Erro ao atualizar status. Tente novamente.')
      } else {
        toast.success('Pedido marcado como entregue!')
      }
    } catch {
      toast.error('Erro ao atualizar status. Tente novamente.')
    } finally {
      setEntregando(false)
    }
  }

  const jaEntregue = pedido.status === 'entregue'

  if (!canUpdate) return null

  return (
    <div
      className="rounded-xl p-5"
      style={{ background: 'var(--card-bg)', border: '1px solid var(--border-color)' }}
    >
      {/* Cabeçalho */}
      <div className="flex items-center justify-between mb-5">
        <div className="flex items-center gap-2">
          <PackageCheck size={16} className="text-green-600 dark:text-green-400" />
          <h3
            className="text-xs font-semibold uppercase tracking-wider"
            style={{ color: 'var(--fg-muted)' }}
          >
            Acabamento e Embalagem
          </h3>
        </div>
        {jaEntregue && (
          <span
            className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium"
            style={{ background: 'rgba(34,197,94,0.15)', color: '#4ADE80' }}
          >
            <CheckCircle2 size={12} />
            Entregue
          </span>
        )}
      </div>

      <form onSubmit={handleSubmit(onSubmit)} noValidate>
        {/* Grade de campos */}
        <div className="grid grid-cols-3 gap-4 mb-4">

          {/* Início Real */}
          <div>
            <label style={labelStyle}>Início Real</label>
            <input
              type="date"
              style={inputStyle}
              {...register('embalagem_inicio_real')}
            />
          </div>

          {/* Fim Real */}
          <div>
            <label style={labelStyle}>Fim Real</label>
            <input
              type="date"
              style={inputStyle}
              {...register('embalagem_fim_real')}
            />
          </div>

          {/* Situação */}
          <div>
            <label style={labelStyle}>Situação</label>
            <select
              style={{ ...inputStyle, cursor: 'pointer' }}
              {...register('embalagem_situacao')}
            >
              <option value="">Selecionar...</option>
              {SITUACAO_OPCOES.map(op => (
                <option key={op.value} value={op.value}>{op.label}</option>
              ))}
            </select>
          </div>

          {/* Data da NF */}
          <div>
            <label style={labelStyle}>Data da Nota Fiscal</label>
            <input
              type="date"
              style={inputStyle}
              {...register('embalagem_data_nf')}
            />
          </div>

          {/* Número da NF */}
          <div>
            <label style={labelStyle}>N° Nota Fiscal</label>
            <input
              type="text"
              placeholder="Ex: 001234"
              style={inputStyle}
              {...register('embalagem_numero_nf')}
            />
          </div>

        </div>

        {/* Defeitos */}
        <div className="mb-4">
          <label style={labelStyle}>Defeitos / Não-Conformidades</label>
          <textarea
            rows={2}
            placeholder="Descreva eventuais defeitos ou não-conformidades encontradas..."
            style={{
              ...inputStyle,
              resize: 'vertical',
              minHeight: '3.5rem',
              fontFamily: 'inherit',
            }}
            {...register('embalagem_defeitos')}
          />
        </div>

        {/* Observações */}
        <div className="mb-5">
          <label style={labelStyle}>Observações de Embalagem</label>
          <textarea
            rows={2}
            placeholder="Observações gerais sobre o processo de embalagem..."
            style={{
              ...inputStyle,
              resize: 'vertical',
              minHeight: '3.5rem',
              fontFamily: 'inherit',
            }}
            {...register('embalagem_observacoes')}
          />
        </div>

        {/* Checkbox: atualizar status para Acabamento */}
        {!jaEntregue && (
          <div className="flex items-center gap-2 mb-5">
            <input
              type="checkbox"
              id="atualizarStatus"
              className="w-4 h-4 rounded accent-green-500"
              {...register('atualizarStatus')}
            />
            <label
              htmlFor="atualizarStatus"
              className="text-xs cursor-pointer select-none"
              style={{ color: 'var(--fg-muted)' }}
            >
              Atualizar status do pedido para <strong className="text-green-600 dark:text-green-400">Acabamento</strong> ao salvar
              (requer data de Fim Real preenchida)
            </label>
          </div>
        )}

        {/* Rodapé com botões */}
        <div className="flex items-center justify-between pt-4" style={{ borderTop: '1px solid var(--border-color)' }}>

          {/* Botão Marcar como Entregue */}
          {!jaEntregue ? (
            <button
              type="button"
              onClick={handleMarcarEntregue}
              disabled={entregando}
              className="flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-all"
              style={
                confirmandoEntrega
                  ? { background: 'rgba(34,197,94,0.25)', border: '1px solid rgba(34,197,94,0.5)', color: '#4ADE80', cursor: 'pointer' }
                  : { background: 'rgba(34,197,94,0.1)', border: '1px solid rgba(34,197,94,0.3)', color: '#4ADE80', cursor: 'pointer' }
              }
            >
              <CheckCircle2 size={14} />
              {entregando
                ? 'Atualizando...'
                : confirmandoEntrega
                ? 'Clique novamente para confirmar'
                : 'Marcar como Entregue'}
            </button>
          ) : (
            <div />
          )}

          {/* Botão Salvar */}
          <button
            type="submit"
            disabled={salvando || !isDirty}
            className="flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-all"
            style={{
              background: salvando || !isDirty
                ? 'rgba(30,126,62,0.15)'
                : 'rgba(30,126,62,0.25)',
              border: '1px solid rgba(30,126,62,0.4)',
              color: salvando || !isDirty ? '#4ade8066' : '#4ADE80',
              cursor: salvando || !isDirty ? 'not-allowed' : 'pointer',
            }}
          >
            <Save size={14} />
            {salvando ? 'Salvando...' : 'Salvar Embalagem'}
          </button>
        </div>
      </form>
    </div>
  )
}
