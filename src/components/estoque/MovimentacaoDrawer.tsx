'use client'

import { useState } from 'react'
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { toast } from 'sonner'
import { registrarMovimentacao } from '@/app/estoque/actions'
import { cn } from '@/lib/utils'
import { todayBusinessDate } from '@/lib/business-date'

interface TecidoSimples {
  id: string
  codigo: string
  descricao: string
  unidade: string
  estoque_atual: number
}

interface MovimentacaoDrawerProps {
  open: boolean
  onClose: () => void
  tecidos: TecidoSimples[]
}

const inputStyle: React.CSSProperties = {
  background: 'var(--surface-subtle)',
  border: '1px solid var(--border-color)',
  color: 'var(--fg)',
  borderRadius: '8px',
}

export function MovimentacaoDrawer({ open, onClose, tecidos }: MovimentacaoDrawerProps) {
  const [loading, setLoading] = useState(false)
  const [tipo, setTipo] = useState<'Entrada' | 'Saída'>('Entrada')
  const [tecidoId, setTecidoId] = useState('')
  const [quantidade, setQuantidade] = useState('')
  const [data, setData] = useState(() => todayBusinessDate())
  const [fornecedor, setFornecedor] = useState('')
  const [numeroNf, setNumeroNf] = useState('')
  const [valorUnitario, setValorUnitario] = useState('')
  const [observacao, setObservacao] = useState('')

  const valorTotal = (parseFloat(quantidade) || 0) * (parseFloat(valorUnitario) || 0)

  const tecidoSelecionado = tecidos.find(t => t.id === tecidoId)
  const unidade = tecidoSelecionado?.unidade ?? ''
  const excedeEstoque =
    tipo === 'Saída' &&
    tecidoSelecionado !== undefined &&
    (parseFloat(quantidade) || 0) > tecidoSelecionado.estoque_atual

  function reset() {
    setTipo('Entrada')
    setTecidoId('')
    setQuantidade('')
    setData(todayBusinessDate())
    setFornecedor('')
    setNumeroNf('')
    setValorUnitario('')
    setObservacao('')
  }

  function closeAndReset() {
    reset()
    onClose()
  }

  async function handleSave() {
    if (!tecidoId) { toast.error('Selecione um tecido'); return }
    if (!quantidade || parseFloat(quantidade) <= 0) { toast.error('Informe a quantidade'); return }

    setLoading(true)
    try {
      const result = await registrarMovimentacao({
        tecido_id: tecidoId,
        data_movimentacao: data,
        tipo,
        quantidade: parseFloat(quantidade),
        fornecedor: fornecedor || undefined,
        numero_nf: numeroNf || undefined,
        valor_unitario: valorUnitario ? parseFloat(valorUnitario) : undefined,
        observacao: observacao || undefined,
      })

      if (result.error) {
        toast.error('Erro ao registrar: ' + String(result.error))
      } else {
        toast.success('Movimentação registrada com sucesso!')
        closeAndReset()
      }
    } finally {
      setLoading(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={v => !v && closeAndReset()}>
      <DialogContent className="sm:max-w-md w-full rounded-xl max-h-[90vh] overflow-y-auto" style={{ background: 'var(--card-bg)', borderColor: 'var(--border-color)', color: 'var(--fg)' }}>
        <DialogHeader>
          <DialogTitle style={{ color: 'var(--fg)' }}>Nova Movimentação de Estoque</DialogTitle>
        </DialogHeader>

        <div className="space-y-4 mt-2">
          {/* Tipo de Operação */}
          <div>
            <label className="text-xs font-medium text-gray-400 mb-2 block">Tipo de Operação</label>
            <div className="flex gap-2">
              <button
                onClick={() => setTipo('Entrada')}
                className={cn(
                  'flex-1 py-2.5 rounded-lg text-sm font-semibold border transition-colors',
                  tipo === 'Entrada'
                    ? 'border-green-500/50 bg-green-500/10 text-green-400'
                    : 'border-white/10 text-gray-500 hover:bg-white/[0.04]'
                )}
              >
                Entrada
              </button>
              <button
                onClick={() => setTipo('Saída')}
                className={cn(
                  'flex-1 py-2.5 rounded-lg text-sm font-semibold border transition-colors',
                  tipo === 'Saída'
                    ? 'border-red-500/50 bg-red-500/10 text-red-400'
                    : 'border-white/10 text-gray-500 hover:bg-white/[0.04]'
                )}
              >
                Saída
              </button>
            </div>
          </div>

          {/* Tecido */}
          <div>
            <label className="text-xs font-medium text-gray-400">Tecido *</label>
            <Select value={tecidoId} onValueChange={(v) => setTecidoId(v ?? '')}>
              <SelectTrigger
                className="mt-1"
                style={{ background: 'var(--surface-subtle)', borderColor: 'var(--border-color)', color: 'var(--fg)' }}
              >
                <SelectValue placeholder="Selecione o tecido" />
              </SelectTrigger>
              <SelectContent style={{ background: 'var(--tooltip-bg)', borderColor: 'var(--border-color)', color: 'var(--fg)' }}>
                {tecidos.map(t => (
                  <SelectItem key={t.id} value={t.id} className="focus:bg-white/[0.06] focus:text-white">
                    [{t.codigo}] {t.descricao}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* Quantidade e Unidade */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-xs font-medium text-gray-400">Quantidade *</label>
              <input
                type="number"
                step="0.001"
                min="0.001"
                className="mt-1 w-full px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-green-500"
                style={inputStyle}
                placeholder="0.000"
                value={quantidade}
                onChange={e => setQuantidade(e.target.value)}
              />
              {excedeEstoque && (
                <p className="mt-1 text-xs font-medium text-amber-500">
                  Atenção: quantidade maior que o estoque atual ({tecidoSelecionado?.estoque_atual.toFixed(3)} {unidade})
                </p>
              )}
            </div>
            <div>
              <label className="text-xs font-medium text-gray-400">Unidade</label>
              <div
                className="mt-1 px-3 py-2 rounded-lg text-sm"
                style={{ background: 'var(--surface-subtle)', border: '1px solid var(--border-color)', color: 'var(--fg-muted)' }}
              >
                {unidade || '—'}
              </div>
            </div>
          </div>

          {/* Data */}
          <div>
            <label className="text-xs font-medium text-gray-400">Data do Registro</label>
            <input
              type="date"
              className="mt-1 w-full px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-green-500"
              style={inputStyle}
              value={data}
              onChange={e => setData(e.target.value)}
            />
          </div>

          {/* Fornecedor */}
          <div>
            <label className="text-xs font-medium text-gray-400">Fornecedor</label>
            <input
              className="mt-1 w-full px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-green-500"
              style={inputStyle}
              placeholder="Nome do fornecedor"
              value={fornecedor}
              onChange={e => setFornecedor(e.target.value)}
            />
          </div>

          {/* N° NF */}
          <div>
            <label className="text-xs font-medium text-gray-400">N° Nota Fiscal</label>
            <input
              className="mt-1 w-full px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-green-500"
              style={inputStyle}
              placeholder="Número da NF"
              value={numeroNf}
              onChange={e => setNumeroNf(e.target.value)}
            />
          </div>

          {/* Valores */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-xs font-medium text-gray-400">Valor Unitário (R$)</label>
              <input
                type="number"
                step="0.01"
                min="0"
                className="mt-1 w-full px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-green-500"
                style={inputStyle}
                placeholder="0,00"
                value={valorUnitario}
                onChange={e => setValorUnitario(e.target.value)}
              />
            </div>
            <div>
              <label className="text-xs font-medium text-gray-400">Valor Total NF</label>
              <div
                className="mt-1 px-3 py-2 rounded-lg text-sm font-semibold"
                style={{ background: 'rgba(34,197,94,0.08)', border: '1px solid rgba(34,197,94,0.2)', color: '#4ADE80' }}
              >
                {new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(valorTotal)}
              </div>
            </div>
          </div>

          {/* Observações */}
          <div>
            <label className="text-xs font-medium text-gray-400">Observações</label>
            <textarea
              className="mt-1 w-full px-3 py-2 text-sm rounded-lg resize-none focus:outline-none focus:ring-1 focus:ring-green-500 min-h-[70px]"
              style={inputStyle}
              placeholder="Observações sobre a movimentação..."
              value={observacao}
              onChange={e => setObservacao(e.target.value)}
            />
          </div>

          {/* Botões */}
          <div className="flex justify-end gap-2 pt-2">
            <Button variant="ghost" onClick={closeAndReset} disabled={loading} className="text-gray-400">
              Cancelar
            </Button>
            <Button
              onClick={handleSave}
              disabled={loading}
              style={{
                background: tipo === 'Entrada' ? '#22C55E' : '#EF4444',
                color: 'white',
              }}
              className="hover:opacity-90"
            >
              {loading ? 'Salvando...' : 'Confirmar'}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  )
}
