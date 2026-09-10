'use client'

import { useState, useEffect } from 'react'
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { toast } from 'sonner'
import { registrarEnvio } from '@/app/oficinas/actions'

const TAMANHOS = ['PP', 'P', 'M', 'G', 'GG', 'G1', 'G2', 'G3', 'G4', 'EG']

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

interface RegistrarEnvioDrawerProps {
  open: boolean
  onClose: () => void
  pedidos: PedidoSimples[]
  oficinas: OficinaSimples[]
}

const labelStyle = { color: 'var(--fg-muted)', fontSize: '11px', fontWeight: 600, textTransform: 'uppercase' as const, letterSpacing: '0.05em' }

export function RegistrarEnvioDrawer({ open, onClose, pedidos, oficinas }: RegistrarEnvioDrawerProps) {
  const [loading, setLoading] = useState(false)
  const [pedidoId, setPedidoId] = useState('')
  const [oficinaId, setOficinaId] = useState('')
  const [modelo, setModelo] = useState('')
  const [grade, setGrade] = useState<Record<string, string>>({})
  const [dataEnvio, setDataEnvio] = useState('')
  const [retornoPrevisto, setRetornoPrevisto] = useState('')
  const [valorUnitario, setValorUnitario] = useState('')
  const [valorUnitarioTocado, setValorUnitarioTocado] = useState(false)
  const [observacoes, setObservacoes] = useState('')

  const [buscaPedido, setBuscaPedido] = useState('')
  const [sugestoesPedido, setSugestoesPedido] = useState<PedidoSimples[]>([])
  const [mostrarSugestoes, setMostrarSugestoes] = useState(false)

  function handlePedidoInput(val: string) {
    setBuscaPedido(val)
    if (!val) {
      setPedidoId('')
      setSugestoesPedido([])
      setMostrarSugestoes(false)
      return
    }

    const q = val.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase().replace('#', '')
    const filtrados = pedidos.filter(p => {
      const num = (p.numero ?? '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase()
      const cli = (p.cliente ?? '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase()
      return num.includes(q) || cli.includes(q)
    })
    setSugestoesPedido(filtrados)
    setMostrarSugestoes(true)
  }

  function selecionarPedido(p: PedidoSimples) {
    setPedidoId(p.id)
    setBuscaPedido(`#${p.numero} — ${p.cliente}`)
    setMostrarSugestoes(false)
  }

  const totalPecas = TAMANHOS.reduce((sum, t) => sum + (parseInt(grade[t] ?? '0') || 0), 0)
  const valorTotal = totalPecas * (parseFloat(valorUnitario) || 0)

  function reset() {
    setPedidoId('')
    setOficinaId('')
    setModelo('')
    setGrade({})
    setDataEnvio('')
    setRetornoPrevisto('')
    setValorUnitario('')
    setValorUnitarioTocado(false)
    setObservacoes('')
    setBuscaPedido('')
    setSugestoesPedido([])
    setMostrarSugestoes(false)
  }

  function closeAndReset() {
    reset()
    onClose()
  }

  function handleAutofill() {
    const p = pedidos.find(item => item.id === pedidoId)
    if (!p) return

    // 1. Modelo / Descrição
    if (p.itens_pedido && p.itens_pedido.length > 0) {
      const modelos = Array.from(new Set(p.itens_pedido.map(i => i.modelo).filter(Boolean)))
      setModelo(modelos.join(', '))
    }

    // 2. Grade de quantidade
    if (p.itens_pedido) {
      const novaGrade: Record<string, string> = {}
      p.itens_pedido.forEach(item => {
        const tam = (item.tamanho ?? '').toUpperCase().trim()
        if (TAMANHOS.includes(tam)) {
          const valAtual = parseInt(novaGrade[tam] ?? '0')
          novaGrade[tam] = (valAtual + item.qtde).toString()
        }
      })
      setGrade(novaGrade)
    }

    // 3. Datas
    if (p.costura_programado) {
      setDataEnvio(p.costura_programado)
    }
    if (p.costura_retorno) {
      setRetornoPrevisto(p.costura_retorno)
    }

    // 4. Oficina padrão
    if (p.costureira_id) {
      setOficinaId(p.costureira_id)
    } else {
      setOficinaId('')
    }

    // 5. Valor unitário (primeiro item)
    if (p.itens_pedido && p.itens_pedido.length > 0) {
      const val = p.itens_pedido[0].valor_unitario
      setValorUnitario(val.toString())
      setValorUnitarioTocado(true)
    }

    toast.success('Dados do pedido preenchidos automaticamente!')
  }

  useEffect(() => {
    if (!mostrarSugestoes) return
    const handleOutsideClick = (e: MouseEvent) => {
      const target = e.target as HTMLElement
      if (!target.closest('.pedido-search-container')) {
        setMostrarSugestoes(false)
      }
    }
    document.addEventListener('mousedown', handleOutsideClick)
    return () => document.removeEventListener('mousedown', handleOutsideClick)
  }, [mostrarSugestoes])

  async function handleSave() {
    if (!pedidoId) { toast.error('Selecione um pedido'); return }
    if (!oficinaId) { toast.error('Selecione uma oficina'); return }
    if (!dataEnvio) { toast.error('Informe a data de envio'); return }
    if (!retornoPrevisto) { toast.error('Informe o retorno previsto'); return }
    setValorUnitarioTocado(true)
    if (!valorUnitario || parseFloat(valorUnitario) <= 0) {
      toast.error('Informe o valor unitário (deve ser maior que zero)')
      return
    }

    setLoading(true)
    try {
      const gradeNum: Record<string, number> = {}
      TAMANHOS.forEach(t => {
        const v = parseInt(grade[t] ?? '0') || 0
        if (v > 0) gradeNum[t] = v
      })

      const result = await registrarEnvio({
        pedido_id: pedidoId,
        oficina_id: oficinaId,
        modelo: modelo || undefined,
        grade_quantidade: gradeNum,
        total_pecas: totalPecas,
        data_envio: dataEnvio,
        retorno_previsto: retornoPrevisto,
        valor_unitario: parseFloat(valorUnitario) || 0,
        valor_total: valorTotal,
        observacoes: observacoes || undefined,
      })

      if (result.error) {
        toast.error('Erro ao registrar envio: ' + result.error)
      } else {
        toast.success('Envio registrado com sucesso!')
        closeAndReset()
      }
    } finally {
      setLoading(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={v => !v && closeAndReset()}>
      <DialogContent
        className="sm:max-w-[720px] p-6 max-h-[90vh] overflow-y-auto bg-card border-border border shadow-2xl"
      >
        <DialogHeader>
          <DialogTitle className="text-foreground text-xl">Registrar Envio para Oficina</DialogTitle>
        </DialogHeader>

        <div className="mt-6 space-y-5">
          {/* Pedido */}
          <div className="relative pedido-search-container">
            <label style={labelStyle}>Pedido *</label>
            <div className="flex gap-2 mt-1.5">
              <div className="relative flex-1">
                <input
                  type="text"
                  value={buscaPedido}
                  onChange={e => handlePedidoInput(e.target.value)}
                  onFocus={() => {
                    const q = buscaPedido.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase().replace('#', '')
                    const filtrados = q 
                      ? pedidos.filter(p => {
                          const num = (p.numero ?? '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase()
                          const cli = (p.cliente ?? '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase()
                          return num.includes(q) || cli.includes(q)
                        })
                      : pedidos.slice(0, 8)
                    setSugestoesPedido(filtrados)
                    setMostrarSugestoes(true)
                  }}
                  placeholder="Busque por número ou cliente..."
                  className="w-full rounded-lg px-3 py-2 text-sm focus:outline-none bg-input border border-border text-foreground focus:border-green-600 dark:focus:border-green-500 placeholder-muted"
                  autoComplete="off"
                />
                {mostrarSugestoes && sugestoesPedido.length > 0 && (
                  <div
                    className="absolute z-[100] left-0 right-0 rounded-lg overflow-hidden shadow-xl max-h-60 overflow-y-auto"
                    style={{ background: 'var(--tooltip-bg)', border: '1px solid var(--tooltip-border)', top: 'calc(100% + 4px)' }}
                  >
                    {sugestoesPedido.map(p => (
                      <button
                        key={p.id}
                        type="button"
                        onMouseDown={() => selecionarPedido(p)}
                        className="w-full text-left px-3 py-2 text-sm transition-colors hover:bg-surface-hover flex items-center justify-between"
                        style={{ color: 'var(--fg)', borderBottom: '1px solid var(--border-subtle)' }}
                      >
                        <span>#{p.numero} — {p.cliente}</span>
                      </button>
                    ))}
                  </div>
                )}
              </div>
              {pedidoId && (
                <button
                  type="button"
                  onClick={handleAutofill}
                  className="px-3 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg text-sm font-medium transition-colors whitespace-nowrap flex items-center gap-1.5 border-0 cursor-pointer"
                  title="Preencher com dados do pedido"
                >
                  ⚡ Autopreencher
                </button>
              )}
            </div>
          </div>

          {/* Oficina */}
          <div>
            <label style={labelStyle}>Oficina *</label>
            <select
              value={oficinaId}
              onChange={e => setOficinaId(e.target.value)}
              className="mt-1.5 w-full rounded-lg px-3 py-2 text-sm focus:outline-none bg-input border border-border text-foreground focus:border-green-600 dark:focus:border-green-500"
            >
              <option value="" className="bg-card text-foreground">Selecione a oficina</option>
              {oficinas.filter(o => o.tipo === 'Costura').map(o => (
                <option key={o.id} value={o.id} className="bg-card text-foreground">
                  {o.nome}
                </option>
              ))}
            </select>
          </div>

          {/* Modelo */}
          <div>
            <label style={labelStyle}>Modelo / Descrição</label>
            <input
              className="mt-1.5 w-full rounded-lg px-3 py-2 text-sm focus:outline-none bg-input border border-border text-foreground focus:border-green-600 dark:focus:border-green-500 placeholder-muted"
              placeholder="Ex: Camiseta manga curta"
              value={modelo}
              onChange={e => setModelo(e.target.value)}
            />
          </div>

          <div>
            <label style={labelStyle}>Grade de Quantidade</label>
            <div className="mt-2 grid grid-cols-10 gap-1.5">
              {TAMANHOS.map(tam => (
                <div key={tam} className="flex flex-col items-center gap-1">
                  <span className="text-xs font-semibold" style={{ color: 'var(--fg-muted)' }}>{tam}</span>
                  <input
                    type="number"
                    min="0"
                    className="w-full text-center rounded px-1.5 py-1.5 text-sm focus:outline-none bg-input border border-border text-foreground focus:border-green-600 dark:focus:border-green-500 placeholder-muted"
                    placeholder="0"
                    value={grade[tam] ?? ''}
                    onChange={e => setGrade(prev => ({ ...prev, [tam]: e.target.value }))}
                  />
                </div>
              ))}
            </div>
            <p className="text-xs mt-2" style={{ color: 'var(--fg-muted)' }}>
              Total: <span className="font-semibold" style={{ color: 'var(--fg)' }}>{totalPecas} peças</span>
            </p>
          </div>

          {/* Datas */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label style={labelStyle}>Data de Envio *</label>
              <input
                type="date"
                className="mt-1.5 w-full bg-input border border-border text-foreground rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-green-600 dark:focus:border-green-500"
                value={dataEnvio}
                onChange={e => setDataEnvio(e.target.value)}
              />
            </div>
            <div>
              <label style={labelStyle}>Retorno Previsto *</label>
              <input
                type="date"
                className="mt-1.5 w-full bg-input border border-border text-foreground rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-green-600 dark:focus:border-green-500"
                value={retornoPrevisto}
                onChange={e => setRetornoPrevisto(e.target.value)}
              />
            </div>
          </div>

          {/* Valores */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label style={labelStyle}>
                Valor Unitário (R$) <span className="text-red-500">*</span>
              </label>
              <input
                type="number"
                step="0.01"
                min="0.01"
                required
                className={`mt-1.5 w-full rounded-lg px-3 py-2 text-sm focus:outline-none bg-input border text-foreground focus:border-green-600 dark:focus:border-green-500 placeholder-muted ${
                  valorUnitarioTocado && (!valorUnitario || parseFloat(valorUnitario) <= 0)
                    ? 'border-red-500'
                    : 'border-border'
                }`}
                placeholder="0,00"
                value={valorUnitario}
                onChange={e => setValorUnitario(e.target.value)}
                onBlur={() => setValorUnitarioTocado(true)}
              />
              {valorUnitarioTocado && (!valorUnitario || parseFloat(valorUnitario) <= 0) && (
                <p className="text-xs mt-1 text-red-500 font-medium">
                  Valor unitário é obrigatório — informe o valor por peça (R$)
                </p>
              )}
            </div>
            <div>
              <label style={labelStyle}>Valor Total Previsto</label>
              <div
                className="mt-1.5 px-3 py-2 rounded-lg text-sm font-semibold bg-green-50 dark:bg-green-950/20 border border-green-200 dark:border-green-900/30 text-green-700 dark:text-green-400"
              >
                {new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(valorTotal)}
              </div>
            </div>
          </div>

          {/* Observações */}
          <div>
            <label style={labelStyle}>Observações</label>
            <textarea
              className="mt-1.5 w-full bg-input border border-border text-foreground rounded-lg px-3 py-2 text-sm min-h-[80px] resize-none focus:outline-none focus:border-green-600 dark:focus:border-green-500 placeholder-muted"
              placeholder="Observações sobre o envio..."
              value={observacoes}
              onChange={e => setObservacoes(e.target.value)}
            />
          </div>

          {/* Botões */}
          <div className="flex gap-3 pt-4 border-t border-border">
            <button
              className="flex-1 rounded-lg py-2 text-sm transition-colors bg-transparent border border-border text-muted hover:bg-surface-hover hover:text-foreground"
              onClick={closeAndReset}
              disabled={loading}
            >
              Cancelar
            </button>
            <button
              className="flex-1 rounded-lg py-2 text-sm font-medium transition-colors disabled:opacity-50 bg-blue-600 hover:bg-blue-700 text-white"
              onClick={handleSave}
              disabled={loading}
            >
              {loading ? 'Salvando...' : 'Salvar Registro'}
            </button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  )
}
