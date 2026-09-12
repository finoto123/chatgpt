'use client'

import { useState, useEffect } from 'react'
import { useForm, FormProvider, useFieldArray, useWatch } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { useRouter } from 'next/navigation'
import { toast } from 'sonner'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog'
import { pedidoSchema, PedidoFormValues } from '@/lib/schemas/pedido'
import { criarPedido, salvarRascunho, gerarProximoNumeroPedido, uploadLayoutPedido } from '@/app/pedidos/actions'
import { ItensPedidoTable } from './ItensPedidoTable'
import { formatBRL, calcularRestoPagar } from '@/lib/utils'
import { Vendedor, Oficina, Cliente, Pedido } from '@/types'
import { Plus, Paperclip, X, Pencil } from 'lucide-react'
import { TIPOS_ESTAMPA, FORNECEDORES_TECIDO, FORMAS_PAGAMENTO } from '@/lib/constants'
import { usePermission } from '@/components/providers/AuthorizationProvider'
import { todayBusinessDate } from '@/lib/business-date'

const inputStyle = {
  background: 'var(--surface-subtle)',
  border: '1px solid var(--border-color)',
  color: 'var(--fg)',
}

interface Props {
  vendedores: Vendedor[]
  oficinas: Oficina[]
  clientes: Cliente[]
  pedidoInicial?: Pedido
  triggerMode?: 'novo' | 'editar'
}

function pedidoToFormValues(pedido: Pedido): PedidoFormValues {
  return {
    id: pedido.id,
    numero: pedido.numero,
    cliente: pedido.cliente,
    cliente_id: pedido.cliente_id ?? '',
    vendedor_id: pedido.vendedor_id ?? '',
    data_pedido: pedido.data_pedido,
    tipo_estampa: pedido.tipo_estampa ?? '',
    costureira_id: pedido.costureira_id ?? '',
    estampa_oficina_id: pedido.estampa_oficina_id ?? '',
    forma_pagamento: pedido.forma_pagamento ?? '',
    fornecedor_tecido: pedido.fornecedor_tecido ?? '',
    valor_entrada: Number(pedido.valor_entrada ?? 0),
    corte_programado: pedido.corte_programado ?? '',
    corte_retorno: pedido.corte_retorno ?? '',
    estamparia_programado: pedido.estamparia_programado ?? '',
    estamparia_retorno: pedido.estamparia_retorno ?? '',
    sublimacao_programado: pedido.sublimacao_programado ?? '',
    sublimacao_retorno: pedido.sublimacao_retorno ?? '',
    costura_programado: pedido.costura_programado ?? '',
    costura_retorno: pedido.costura_retorno ?? '',
    entrega_programado: pedido.entrega_programado,
    etapas_ativas: pedido.etapas_ativas ?? undefined,
    observacoes: pedido.observacoes ?? '',
    layout_pdf_url: pedido.layout_pdf_url ?? undefined,
    itens: (pedido.itens ?? []).map((item) => ({
      id: item.id,
      qtde: Number(item.qtde),
      tamanho: item.tamanho,
      modelo: item.modelo,
      tecido_cor: item.tecido_cor ?? undefined,
      manga: item.manga ?? undefined,
      gola: item.gola ?? undefined,
      acabamento: item.acabamento ?? undefined,
      observacao: item.observacao ?? undefined,
      valor_unitario: Number(item.valor_unitario),
    })),
  }
}


const ETAPAS_OPCOES = [
  { key: 'corte',    label: 'CORTE',    prog: 'corte_programado',      ret: 'corte_retorno' },
  { key: 'estampa',  label: 'ESTAMPA',  prog: 'estamparia_programado', ret: 'estamparia_retorno' },
  { key: 'costura',  label: 'COSTURA',  prog: 'costura_programado',    ret: 'costura_retorno' },
] as const

function splitTiposEstampa(value: string | null | undefined) {
  return (value ?? '')
    .split(',')
    .map(item => item.trim())
    .filter(Boolean)
}

function normalizeEstampa(value: string) {
  return value
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
}

export function NovoPedidoDrawer({ vendedores, oficinas, clientes, pedidoInicial, triggerMode = 'novo' }: Props) {
  const canCreate = usePermission('orders.create')
  const canUpdate = usePermission('orders.update')
  const isAuthorized = pedidoInicial || triggerMode === 'editar' ? canUpdate : canCreate
  const [open, setOpen] = useState(false)
  const [savingDraft, setSavingDraft] = useState(false)
  const [layoutFile, setLayoutFile] = useState<File | null>(null)
  const [clienteSugestoes, setClienteSugestoes] = useState<Cliente[]>([])
  const [mostrarSugestoes, setMostrarSugestoes] = useState(false)
  const [etapasAtivas, setEtapasAtivas] = useState<string[]>(
    pedidoInicial?.etapas_ativas ?? ['corte', 'costura']
  )
  const router = useRouter()

  function toggleEtapa(key: string) {
    setEtapasAtivas(prev =>
      prev.includes(key) ? prev.filter(e => e !== key) : [...prev, key]
    )
  }

  const methods = useForm<PedidoFormValues>({
    resolver: zodResolver(pedidoSchema),
    defaultValues: pedidoInicial ? pedidoToFormValues(pedidoInicial) : {
      numero: '',
      data_pedido: todayBusinessDate(),
      cliente: '',
      valor_entrada: 0,
      itens: [],
    },
  })

  const { register, control, handleSubmit, setValue, formState: { errors, isSubmitting } } = methods

  useEffect(() => {
    if (isAuthorized && open && !pedidoInicial) {
      gerarProximoNumeroPedido().then(num => setValue('numero', num))
    }
  }, [isAuthorized, open, pedidoInicial, setValue])
  const { fields, append, remove } = useFieldArray({ control, name: 'itens' })
  const itens = useWatch({ control, name: 'itens' }) ?? []
  const entrada = useWatch({ control, name: 'valor_entrada' }) ?? 0
  const tipoEstampa = useWatch({ control, name: 'tipo_estampa' })
  const clienteNome = useWatch({ control, name: 'cliente' }) ?? ''

  const subtotal = itens.reduce((s, i) => s + (Number(i?.qtde) || 0) * (Number(i?.valor_unitario) || 0), 0)
  const restoPagar = calcularRestoPagar(subtotal, Number(entrada))
  const podeSubmit = itens.length > 0 && itens.every(i =>
    Number(i?.qtde) > 0 &&
    String(i?.tamanho ?? '').trim().length > 0 &&
    String(i?.modelo ?? '').trim().length > 0 &&
    Number(i?.valor_unitario) >= 0
  ) && !isSubmitting
  const tiposEstampaSelecionados = splitTiposEstampa(tipoEstampa)

  function toggleTipoEstampa(tipo: string) {
    const existe = tiposEstampaSelecionados.includes(tipo)
    const proximos = existe
      ? tiposEstampaSelecionados.filter(item => item !== tipo)
      : [...tiposEstampaSelecionados, tipo]
    setValue('tipo_estampa', proximos.join(', '))
    setValue('estampa_oficina_id', '')
  }

  const oficinasEstampaDisponiveis = oficinas.filter(oficina => {
    if (tiposEstampaSelecionados.length === 0) return false
    const tipoOficina = normalizeEstampa(oficina.tipo ?? '')
    return tiposEstampaSelecionados.some(tipo => {
      const tipoSelecionado = normalizeEstampa(tipo)
      if (tipoSelecionado === 'bordado') return tipoOficina === 'bordado'
      if (tipoSelecionado === 'dtf') return tipoOficina === 'dtf'
      return tipoOficina !== 'costura' && tipoOficina !== 'bordado'
    })
  })

  function handleClienteInput(val: string) {
    setValue('cliente', val)
    setValue('cliente_id', undefined)
    if (val.length >= 1) {
      const q = val.toLowerCase()
      const filtrados = clientes.filter(c => c.nome.toLowerCase().includes(q)).slice(0, 8)
      setClienteSugestoes(filtrados)
      setMostrarSugestoes(filtrados.length > 0)
    } else {
      setMostrarSugestoes(false)
    }
  }

  function selecionarCliente(c: Cliente) {
    setValue('cliente', c.nome)
    setValue('cliente_id', c.id)
    setMostrarSugestoes(false)
  }

  async function uploadLayout(pedidoId: string): Promise<boolean> {
    if (!layoutFile) return true

    const formData = new FormData()
    formData.append('arquivo', layoutFile)
    formData.append('pedidoId', pedidoId)
    const result = await uploadLayoutPedido(formData)

    if ('error' in result && result.error) {
      toast.error('Erro ao enviar layout: ' + result.error)
      return false
    }

    if ('path' in result && result.path) setValue('layout_pdf_url', result.path)
    setLayoutFile(null)
    return true
  }

  async function salvar(imprimir = false) {
    await handleSubmit(
      async (values) => {
        const result = await criarPedido({
          ...values,
          etapas_ativas: etapasAtivas,
        })
        if ('error' in result && result.error) {
          const errMsg = typeof result.error === 'string'
            ? result.error
            : JSON.stringify(result.error)
          toast.error('Erro ao salvar: ' + errMsg)
          return
        }
        if (!result.pedidoId || !await uploadLayout(result.pedidoId)) return
        toast.success('Pedido salvo com sucesso!')
        setOpen(false)
        if (imprimir && 'pedidoId' in result) {
          router.push(`/pedidos/${result.pedidoId}/imprimir`)
        }
      },
      (fieldErrors) => {
        const msgs = Object.values(fieldErrors).flat()
        const first = msgs.find((e): e is { message: string } => {
          if (!e || typeof e !== 'object' || !('message' in e)) return false
          return typeof (e as { message?: unknown }).message === 'string'
        })
        toast.error(first?.message ?? 'Preencha os campos obrigatórios antes de salvar')
      }
    )()
  }

  async function handleSalvarRascunho() {
    if (savingDraft) return
    setSavingDraft(true)
    const values = methods.getValues()
    try {
      const result = await salvarRascunho({
        ...values,
        numero: values.numero ?? '',
        etapas_ativas: etapasAtivas,
      })
      if (result?.error) {
        const message = typeof result.error === 'string'
          ? result.error
          : JSON.stringify(result.error)
        toast.error('Erro ao salvar rascunho: ' + message)
        return
      }

      if (!result.pedidoId) {
        toast.error('O banco não retornou o rascunho salvo.')
        return
      }

      setValue('id', result.pedidoId)
      toast.success('Rascunho salvo! Você pode continuar editando.')
      router.refresh()

      // O rascunho permanece salvo mesmo se o envio opcional do layout falhar.
      await uploadLayout(result.pedidoId)
    } catch {
      toast.error('Não foi possível salvar o rascunho. Tente novamente.')
    } finally {
      setSavingDraft(false)
    }
  }

  if (!isAuthorized) return null

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger 
        className={triggerMode === 'novo' ? "flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-colors bg-green-600 dark:bg-green-600 text-white hover:bg-green-700 dark:hover:bg-green-500 border-0" : "text-muted hover:text-green-600 dark:hover:text-green-400 transition-colors p-1"}
        title={triggerMode === 'editar' ? "Editar pedido" : undefined}
      >
        {triggerMode === 'novo' ? (
          <>
            <Plus size={16} />
            Novo Pedido
          </>
        ) : (
          <Pencil size={16} />
        )}
      </DialogTrigger>
      <DialogContent 
        className="w-[95vw] sm:max-w-7xl overflow-y-auto max-h-[95vh] p-6 rounded-xl" 
        style={{ background: 'var(--card-bg)', color: 'var(--fg)', border: '1px solid var(--border-color)' }}
      >
        <DialogHeader className="px-6 py-5" style={{ borderBottom: '1px solid var(--border-subtle)' }}>
          <div className="flex items-center justify-between">
            <DialogTitle className="text-xl font-bold" style={{ color: 'var(--fg)' }}>
              {pedidoInicial ? 'Editar Pedido' : 'Novo Pedido'}
            </DialogTitle>
          </div>
        </DialogHeader>

        <FormProvider {...methods}>
          <form className="space-y-5 mt-4">
            {/* Seção 1 — Informações Gerais */}
            <div>
              <h3 className="text-sm font-semibold mb-3 pb-1" style={{ color: 'var(--fg-muted)', borderBottom: '1px solid var(--border-subtle)' }}>
                Informações Gerais
              </h3>
              <div className="grid grid-cols-2 gap-3">
                <div className="relative">
                  <label className="text-xs font-medium" style={{ color: 'var(--fg-muted)' }}>Cliente *</label>
                  <input
                    value={clienteNome}
                    onChange={e => handleClienteInput(e.target.value)}
                    onBlur={() => setTimeout(() => setMostrarSugestoes(false), 150)}
                    onFocus={() => {
                      const val = methods.getValues('cliente') ?? ''
                      if (val.length >= 1) {
                        const q = val.toLowerCase()
                        const f = clientes.filter(c => c.nome.toLowerCase().includes(q)).slice(0, 8)
                        setClienteSugestoes(f)
                        setMostrarSugestoes(f.length > 0)
                      }
                    }}
                    placeholder="Digite para buscar ou criar cliente..."
                    autoComplete="off"
                    className="mt-1 w-full rounded-lg px-3 py-2 text-sm focus:outline-none"
                    style={inputStyle}
                  />
                  {errors.cliente && <p className="text-red-400 text-xs mt-0.5">{errors.cliente.message}</p>}
                  {mostrarSugestoes && (
                    <div
                      className="absolute z-50 left-0 right-0 rounded-lg overflow-hidden shadow-xl"
                      style={{ background: 'var(--tooltip-bg)', border: '1px solid var(--tooltip-border)', top: 'calc(100% + 2px)' }}
                    >
                      {clienteSugestoes.map(c => (
                        <button
                          key={c.id}
                          type="button"
                          onMouseDown={() => selecionarCliente(c)}
                          className="w-full text-left px-3 py-2 text-sm transition-colors hover-item flex items-center justify-between"
                          style={{ color: 'var(--fg)', borderBottom: '1px solid var(--border-subtle)' }}
                        >
                          <span>{c.nome}</span>
                          {c.cidade && <span className="text-xs ml-2 shrink-0" style={{ color: 'var(--fg-muted)' }}>{c.cidade}</span>}
                        </button>
                      ))}
                    </div>
                  )}
                </div>
                <div>
                  <label className="text-xs font-medium" style={{ color: 'var(--fg-muted)' }}>N° Pedido *</label>
                  <input
                    {...register('numero')}
                    className="mt-1 w-full rounded-lg px-3 py-2 text-sm focus:outline-none"
                    style={inputStyle}
                  />
                </div>
                <div>
                  <label className="text-xs font-medium" style={{ color: 'var(--fg-muted)' }}>Vendedor</label>
                  <select
                    {...register('vendedor_id')}
                    className="mt-1 w-full rounded-lg px-3 py-2 text-sm focus:outline-none"
                    style={inputStyle}
                  >
                    <option value="" style={{ background: 'var(--input-bg)' }}>Selecionar...</option>
                    {vendedores.map(v => (
                      <option key={v.id} value={v.id} style={{ background: 'var(--input-bg)' }}>{v.nome}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="text-xs font-medium" style={{ color: 'var(--fg-muted)' }}>Data do Pedido *</label>
                  <input
                    type="date"
                    {...register('data_pedido')}
                    className="mt-1 w-full rounded-lg px-3 py-2 text-sm focus:outline-none"
                    style={inputStyle}
                  />
                </div>
              </div>
            </div>

            {/* Seção 2 — Prazos */}
            <div>
              <h3 className="text-sm font-semibold mb-3 pb-1" style={{ color: 'var(--fg-muted)', borderBottom: '1px solid var(--border-subtle)' }}>
                Prazos de Produção
              </h3>
              <div
                className="rounded-lg overflow-hidden"
                style={{ border: '1px solid var(--border-color)' }}
              >
                <table className="w-full text-xs">
                  <thead style={{ background: 'var(--surface-subtle)', borderBottom: '1px solid var(--border-color)' }}>
                    <tr>
                      <th className="px-2 py-2 text-center font-medium w-10" style={{ color: 'var(--fg-muted)' }}>✓</th>
                      <th className="px-3 py-2 text-left font-medium" style={{ color: 'var(--fg-muted)' }}>ETAPA</th>
                      <th className="px-3 py-2 text-center font-medium" style={{ color: 'var(--fg-muted)' }}>DATA PROGRAMADA</th>
                      <th className="px-3 py-2 text-center font-medium" style={{ color: 'var(--fg-muted)' }}>DATA RETORNO</th>
                    </tr>
                  </thead>
                  <tbody>
                    {ETAPAS_OPCOES.map(row => {
                      const ativa = etapasAtivas.includes(row.key)
                      return (
                        <tr key={row.key} style={{ borderBottom: '1px solid var(--border-subtle)', opacity: ativa ? 1 : 0.4 }}>
                          <td className="px-2 py-2 text-center">
                            <input
                              type="checkbox"
                              checked={ativa}
                              onChange={() => toggleEtapa(row.key)}
                              className="w-4 h-4 cursor-pointer accent-green-500"
                            />
                          </td>
                          <td className="px-3 py-2 font-medium" style={{ color: 'var(--fg-muted)' }}>{row.label}</td>
                          <td className="px-2 py-1 text-center">
                            <input
                              type="date"
                              {...register(row.prog as keyof PedidoFormValues)}
                              disabled={!ativa}
                              className="rounded px-2 py-1 text-xs w-full focus:outline-none"
                              style={inputStyle}
                            />
                          </td>
                          <td className="px-2 py-1 text-center">
                            <input
                              type="date"
                              {...register(row.ret as keyof PedidoFormValues)}
                              disabled={!ativa}
                              className="rounded px-2 py-1 text-xs w-full focus:outline-none"
                              style={inputStyle}
                            />
                          </td>
                        </tr>
                      )
                    })}
                    <tr className="bg-amber-500/10">
                      <td />
                      <td className="px-3 py-2 font-semibold text-amber-700 dark:text-amber-400">ENTREGA *</td>
                      <td className="px-2 py-1" colSpan={2}>
                        <input
                          type="date"
                          {...register('entrega_programado')}
                          className="rounded px-2 py-1 text-xs w-full focus:outline-none bg-amber-50 dark:bg-amber-950/20 border border-amber-200 dark:border-amber-800/30 text-amber-700 dark:text-amber-400"
                        />
                        {errors.entrega_programado && (
                          <p className="text-red-400 text-xs">{errors.entrega_programado.message}</p>
                        )}
                      </td>
                    </tr>
                  </tbody>
                </table>
              </div>
              <div className="grid grid-cols-4 gap-3 mt-3">
                <div className="col-span-2">
                  <label className="text-xs font-medium" style={{ color: 'var(--fg-muted)' }}>Tipo de Estampa</label>
                  <input type="hidden" {...register('tipo_estampa')} />
                  <div className="mt-1 flex flex-wrap gap-2 rounded-lg p-2" style={inputStyle}>
                    {TIPOS_ESTAMPA.map(t => {
                      const checked = tiposEstampaSelecionados.includes(t)
                      const isBordado = normalizeEstampa(t) === 'bordado'
                      return (
                        <button
                          key={t}
                          type="button"
                          onClick={() => toggleTipoEstampa(t)}
                          className={`rounded-full border px-3 py-1.5 text-xs font-medium transition-all ${
                            checked
                              ? isBordado
                                ? 'border-emerald-500 bg-emerald-500 text-white'
                                : 'border-blue-500 bg-blue-500 text-white'
                              : 'border-border text-muted hover:border-border-medium hover:text-foreground'
                          }`}
                        >
                          {isBordado ? 'Bordado' : t}
                        </button>
                      )
                    })}
                  </div>
                  <p className="mt-1 text-[11px]" style={{ color: 'var(--fg-muted)' }}>
                    Marque uma ou mais opções. Tudo que não for Bordado entra como Estampa.
                  </p>
                </div>
                <div>
                  <label className="text-xs font-medium" style={{ color: 'var(--fg-muted)' }}>Oficina de Estampa/Bordado</label>
                  <select
                    {...register('estampa_oficina_id')}
                    className="mt-1 w-full rounded-lg px-3 py-2 text-sm focus:outline-none"
                    style={inputStyle}
                  >
                    <option value="" style={{ background: 'var(--input-bg)' }}>Selecionar...</option>
                    {oficinasEstampaDisponiveis.map(o => (
                      <option key={o.id} value={o.id} style={{ background: 'var(--input-bg)' }}>
                        {o.nome} ({o.tipo})
                      </option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="text-xs font-medium" style={{ color: 'var(--fg-muted)' }}>Oficina de Costura</label>
                  <select
                    {...register('costureira_id')}
                    className="mt-1 w-full rounded-lg px-3 py-2 text-sm focus:outline-none"
                    style={inputStyle}
                  >
                    <option value="" style={{ background: 'var(--input-bg)' }}>Selecionar...</option>
                    {oficinas.filter(o => o.tipo === 'Costura').map(o => (
                      <option key={o.id} value={o.id} style={{ background: 'var(--input-bg)' }}>{o.nome}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="text-xs font-medium" style={{ color: 'var(--fg-muted)' }}>Fornecedor do Tecido</label>
                  <input
                    {...register('fornecedor_tecido')}
                    list="fornecedores-tecido-list"
                    placeholder="Ex: DOPTEX, EF Tecidos..."
                    className="mt-1 w-full rounded-lg px-3 py-2 text-sm focus:outline-none"
                    style={inputStyle}
                  />
                  <datalist id="fornecedores-tecido-list">
                    {FORNECEDORES_TECIDO.map(f => <option key={f} value={f} />)}
                  </datalist>
                </div>
              </div>
            </div>

            {/* Seção 3 — Itens */}
            <div>
              <h3 className="text-sm font-semibold mb-3 pb-1" style={{ color: 'var(--fg-muted)', borderBottom: '1px solid var(--border-subtle)' }}>
                Itens do Pedido
              </h3>
              <ItensPedidoTable fields={fields} append={append} remove={remove} />
            </div>

            {/* Seção 4 — Pagamento */}
            <div>
              <h3 className="text-sm font-semibold mb-3 pb-1" style={{ color: 'var(--fg-muted)', borderBottom: '1px solid var(--border-subtle)' }}>
                Pagamento e Observações
              </h3>
              <div className="grid grid-cols-3 gap-3">
                <div>
                  <label className="text-xs font-medium" style={{ color: 'var(--fg-muted)' }}>Forma de Pagamento</label>
                  <input
                    {...register('forma_pagamento')}
                    list="formas-pagamento-list"
                    placeholder="Ex: PIX, Boleto 2x, 30/60..."
                    className="mt-1 w-full rounded-lg px-3 py-2 text-sm focus:outline-none"
                    style={inputStyle}
                  />
                  <datalist id="formas-pagamento-list">
                    {FORMAS_PAGAMENTO.map(f => <option key={f} value={f} />)}
                  </datalist>
                </div>
                <div>
                  <label className="text-xs font-medium" style={{ color: 'var(--fg-muted)' }}>Valor de Entrada R$</label>
                  <input
                    type="number"
                    step="0.01"
                    min={0}
                    {...register('valor_entrada', { valueAsNumber: true })}
                    className="mt-1 w-full rounded-lg px-3 py-2 text-sm focus:outline-none"
                    style={inputStyle}
                  />
                  {errors.valor_entrada && (
                    <p className="text-red-400 text-xs mt-0.5">{errors.valor_entrada.message}</p>
                  )}
                </div>
                <div>
                  <label className="text-xs font-medium" style={{ color: 'var(--fg-muted)' }}>Resto a Pagar</label>
                  <div
                    className="mt-1 w-full rounded-lg px-3 py-2 text-sm font-semibold bg-green-50 dark:bg-green-950/10 border border-green-200 dark:border-green-800/30 text-green-700 dark:text-green-400"
                  >
                    {formatBRL(restoPagar)}
                  </div>
                </div>
              </div>
              <div className="mt-3">
                <label className="text-xs font-medium" style={{ color: 'var(--fg-muted)' }}>Observações</label>
                <textarea
                  {...register('observacoes')}
                  rows={3}
                  className="mt-1 w-full rounded-lg px-3 py-2 text-sm resize-none focus:outline-none"
                  style={inputStyle}
                />
              </div>
            </div>

            {/* Seção 5 — Layout PDF */}
            <div>
              <h3 className="text-sm font-semibold mb-3 pb-1" style={{ color: 'var(--fg-muted)', borderBottom: '1px solid var(--border-subtle)' }}>
                Layout do Pedido
              </h3>
              <div>
                <label className="text-xs font-medium" style={{ color: 'var(--fg-muted)' }}>Anexar Layout</label>
                {layoutFile ? (
                  <div
                    className="mt-1 flex items-center gap-2 rounded-lg px-3 py-2 text-sm bg-green-50 dark:bg-green-950/10 border border-green-200 dark:border-green-800/30"
                  >
                    <Paperclip size={14} className="text-green-600 dark:text-green-400" />
                    <span className="flex-1 truncate text-xs text-green-700 dark:text-green-400">{layoutFile.name}</span>
                    <button
                      type="button"
                      onClick={() => setLayoutFile(null)}
                      className="p-0.5 rounded hover:opacity-70"
                      style={{ color: 'var(--fg-muted)' }}
                    >
                      <X size={14} />
                    </button>
                  </div>
                ) : (
                  <label
                    className="mt-1 flex items-center gap-2 rounded-lg px-3 py-2 text-sm cursor-pointer transition-colors hover:opacity-80"
                    style={{ background: 'var(--surface-subtle)', border: '1px dashed var(--border-medium)', color: 'var(--fg-muted)' }}
                  >
                    <Paperclip size={14} />
                    <span className="text-xs">Clique para selecionar PDF ou imagem...</span>
                    <input
                      type="file"
                      accept=".pdf,application/pdf,image/png,image/jpeg,image/webp"
                      className="hidden"
                      onChange={e => setLayoutFile(e.target.files?.[0] ?? null)}
                    />
                  </label>
                )}
              </div>
            </div>

            {/* Rodapé */}
            <div className="flex gap-2 pt-2" style={{ borderTop: '1px solid var(--border-subtle)' }}>
              <button
                type="button"
                onClick={() => setOpen(false)}
                className="px-4 rounded-lg py-2 text-sm transition-colors"
                style={{ border: '1px solid var(--border-medium)', color: 'var(--fg-muted)', background: 'transparent' }}
              >
                Cancelar
              </button>

              <button
                type="button"
                onClick={handleSalvarRascunho}
                disabled={isSubmitting || savingDraft}
                className="px-4 py-2 border border-border text-muted hover:text-foreground hover:bg-surface-hover hover:border-border-medium rounded-lg text-sm transition-all bg-transparent disabled:opacity-50"
              >
                {savingDraft ? 'Salvando rascunho…' : '📝 Salvar Rascunho'}
              </button>

              <button
                type="button"
                onClick={() => salvar(true)}
                disabled={!podeSubmit}
                className="px-4 rounded-lg py-2 text-sm font-medium transition-colors disabled:opacity-50"
                style={{ background: 'var(--fg)', color: 'var(--bg)' }}
              >
                Salvar e Imprimir
              </button>

              <button
                type="button"
                onClick={() => salvar(false)}
                disabled={!podeSubmit}
                className="flex-1 rounded-lg py-2 text-sm font-medium transition-colors disabled:opacity-50"
                style={{ background: '#22C55E', color: 'white' }}
              >
                Salvar Pedido →
              </button>
            </div>
          </form>
        </FormProvider>
      </DialogContent>
    </Dialog>
  )
}
