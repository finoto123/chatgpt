'use client'

import { useState, useTransition, useMemo } from 'react'
import { toast } from 'sonner'
import {
  Plus,
  Pencil,
  Trash2,
  MapPin,
  Phone,
  Package,
  Loader2,
  X,
  Search,
  ArrowUpDown,
} from 'lucide-react'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { Oficina, Vendedor, Feriado, TipoOficina, TipoVinculo, EnvioOficina } from '@/types'
import { TIPOS_PECA, TIPOS_OFICINA, TIPOS_FERIADO } from '@/lib/constants'
import { formatDate } from '@/lib/utils'
import {
  criarOficina,
  atualizarOficina,
  criarVendedor,
  atualizarVendedor,
  criarFeriado,
  deletarRegistro,
} from '@/app/cadastros/actions'
import { usePermission } from '@/components/providers/AuthorizationProvider'

interface CadastrosClientProps {
  oficinas: Oficina[]
  vendedores: Vendedor[]
  feriados: Feriado[]
  envios: EnvioOficina[]
}

type Ordenacao = 'nome-az' | 'nome-za' | 'pecas-desc' | 'pecas-asc'

function calcularPecasEmMaos(oficina: Oficina, envios: EnvioOficina[]): number {
  return envios
    .filter(e => e.oficina_id === oficina.id && e.status === 'enviado')
    .reduce((s, e) => s + (e.total_pecas ?? 0), 0)
}

function calcularCapacidadeTotal(oficina: Oficina): number {
  return Object.values(oficina.capacidade ?? {}).reduce((s, v) => s + v, 0)
}

const TIPO_OFICINA_COLORS: Record<string, { bg: string; color: string }> = {
  Costura:    { bg: 'rgba(59,130,246,0.15)',  color: '#60A5FA' },
  Bordado: { bg: 'rgba(168,85,247,0.15)',  color: '#A855F7' },
  Sublimação: { bg: 'rgba(236,72,153,0.15)',  color: '#EC4899' },
  DTF: { bg: 'rgba(234,88,12,0.15)', color: '#FB923C' },
  Silk: { bg: 'rgba(20,184,166,0.15)', color: '#2DD4BF' }, // Teal
}

const TIPO_FERIADO_COLORS: Record<string, { bg: string; color: string }> = {
  Nacional:  { bg: 'rgba(59,130,246,0.15)',  color: '#60A5FA' },
  Municipal: { bg: 'rgba(245,158,11,0.15)',  color: '#FCD34D' },
  Estadual:  { bg: 'rgba(34,197,94,0.15)',   color: '#4ADE80' },
}

// ------- MODAL OFICINA -------
interface ModalOficinaProps {
  open: boolean
  onClose: () => void
  oficina?: Oficina
}

function ModalOficina({ open, onClose, oficina }: ModalOficinaProps) {
  const [isPending, startTransition] = useTransition()
  const [nome, setNome] = useState(oficina?.nome ?? '')
  const [tipo, setTipo] = useState<TipoOficina>(oficina?.tipo ?? 'Costura')
  const [tipoVinculo, setTipoVinculo] = useState<TipoVinculo>(oficina?.tipo_vinculo ?? 'EXTERNA')
  const [cidade, setCidade] = useState(oficina?.cidade ?? '')
  const [contato, setContato] = useState(oficina?.contato ?? '')
  const [capacidade, setCapacidade] = useState<Record<string, number>>(
    oficina?.capacidade ?? {}
  )

  const handleSalvar = () => {
    if (!nome.trim()) {
      toast.error('Nome da oficina é obrigatório')
      return
    }
    startTransition(async () => {
      const data = {
        nome: nome.trim(),
        tipo,
        tipo_vinculo: tipoVinculo,
        cidade: cidade.trim() || undefined,
        contato: contato.trim() || undefined,
        capacidade,
      }
      const resultado = oficina
        ? await atualizarOficina({ ...data, id: oficina.id })
        : await criarOficina(data)

      if (resultado.error) {
        toast.error(`Erro: ${resultado.error}`)
      } else {
        toast.success(oficina ? 'Oficina atualizada!' : 'Oficina criada!')
        onClose()
      }
    })
  }

  return (
    <Dialog open={open} onOpenChange={v => !v && onClose()}>
      <DialogContent className="sm:max-w-2xl w-full max-h-[90vh] overflow-y-auto rounded-xl" style={{ background: 'var(--card-bg)', borderColor: 'var(--border-color)', color: 'var(--fg)' }}>
        <DialogHeader>
          <DialogTitle style={{ color: 'var(--fg)' }}>{oficina ? 'Editar Oficina' : 'Nova Oficina'}</DialogTitle>
        </DialogHeader>

        <div className="space-y-4 py-2">
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-1.5">
              <label className="text-sm font-medium" style={{ color: 'var(--fg-muted)' }}>Nome *</label>
              <Input
                value={nome}
                onChange={e => setNome(e.target.value)}
                placeholder="Ex: Ateliê da Maria"
                style={{ background: 'var(--surface-subtle)', borderColor: 'var(--border-color)', color: 'var(--fg)' }}
              />
            </div>
            <div className="space-y-1.5">
              <label className="text-sm font-medium" style={{ color: 'var(--fg-muted)' }}>Tipo</label>
              <Select value={tipo} onValueChange={v => setTipo((v ?? 'Costura') as TipoOficina)}>
                <SelectTrigger style={{ background: 'var(--surface-subtle)', borderColor: 'var(--border-color)', color: 'var(--fg)' }}>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent style={{ background: 'var(--tooltip-bg)', borderColor: 'var(--border-color)', color: 'var(--fg)' }}>
                  {TIPOS_OFICINA.map(t => (
                    <SelectItem key={t} value={t} className="focus:bg-white/8 focus:text-white">{t}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-1.5">
              <label className="text-sm font-medium" style={{ color: 'var(--fg-muted)' }}>Vínculo</label>
              <Select value={tipoVinculo} onValueChange={v => setTipoVinculo((v ?? 'EXTERNA') as TipoVinculo)}>
                <SelectTrigger style={{ background: 'var(--surface-subtle)', borderColor: 'var(--border-color)', color: 'var(--fg)' }}>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent style={{ background: 'var(--tooltip-bg)', borderColor: 'var(--border-color)', color: 'var(--fg)' }}>
                  <SelectItem value="INTERNA" className="focus:bg-white/8 focus:text-white">INTERNA</SelectItem>
                  <SelectItem value="EXTERNA" className="focus:bg-white/8 focus:text-white">EXTERNA</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <label className="text-sm font-medium" style={{ color: 'var(--fg-muted)' }}>Cidade</label>
              <Input
                value={cidade}
                onChange={e => setCidade(e.target.value)}
                placeholder="Ex: São Paulo, SP"
                style={{ background: 'var(--surface-subtle)', borderColor: 'var(--border-color)', color: 'var(--fg)' }}
              />
            </div>
          </div>

          <div className="space-y-1.5">
            <label className="text-sm font-medium" style={{ color: 'var(--fg-muted)' }}>Contato</label>
            <Input
              value={contato}
              onChange={e => setContato(e.target.value)}
              placeholder="Telefone ou e-mail"
              style={{ background: 'var(--surface-subtle)', borderColor: 'var(--border-color)', color: 'var(--fg)' }}
            />
          </div>

          <div className="space-y-1.5">
            <label className="text-sm font-medium" style={{ color: 'var(--fg-muted)' }}>
              Capacidade de Produção (peças/dia)
            </label>
            <div className="grid grid-cols-3 gap-3">
              {TIPOS_PECA.map(tipoPeca => (
                <div key={tipoPeca} className="space-y-1">
                  <label className="text-xs capitalize" style={{ color: 'var(--fg-muted)' }}>{tipoPeca}</label>
                  <Input
                    type="number"
                    min={0}
                    value={capacidade[tipoPeca] ?? ''}
                    onChange={e => {
                      const valor = e.target.value === '' ? undefined : Number(e.target.value)
                      setCapacidade(prev => {
                        const proximo = { ...prev }
                        if (valor === undefined || Number.isNaN(valor)) {
                          delete proximo[tipoPeca]
                        } else {
                          proximo[tipoPeca] = valor
                        }
                        return proximo
                      })
                    }}
                    placeholder="0"
                    style={{ background: 'var(--surface-subtle)', borderColor: 'var(--border-color)', color: 'var(--fg)' }}
                  />
                </div>
              ))}
            </div>
          </div>

        </div>

        <div className="flex justify-end gap-3 pt-2" style={{ borderTop: '1px solid var(--border-subtle)' }}>
          <Button
            variant="outline"
            onClick={onClose}
            disabled={isPending}
            style={{ borderColor: 'var(--border-medium)', color: 'var(--fg-muted)', background: 'transparent' }}
          >
            Cancelar
          </Button>
          <Button
            onClick={handleSalvar}
            disabled={isPending}
            style={{ background: '#22C55E', color: 'white' }}
            className="hover:opacity-90"
          >
            {isPending ? <Loader2 size={16} className="animate-spin mr-2" /> : null}
            {oficina ? 'Salvar Alterações' : 'Criar Oficina'}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  )
}

// ------- CARD OFICINA -------
interface CardOficinaProps {
  oficina: Oficina
  envios: EnvioOficina[]
  onEditar: (oficina: Oficina) => void
  onDeletar: (id: string) => void
  canManage: boolean
}

function CardOficina({ oficina, envios, onEditar, onDeletar, canManage }: CardOficinaProps) {
  const pecasEmMaos = calcularPecasEmMaos(oficina, envios)
  const capacidadeTotal = calcularCapacidadeTotal(oficina)
  const tipoColor = TIPO_OFICINA_COLORS[oficina.tipo] ?? { bg: 'rgba(107,114,128,0.15)', color: '#9CA3AF' }

  return (
    <div
      className="rounded-xl transition-shadow"
      style={{
        background: 'var(--card-bg)',
        border: '1px solid var(--border-color)',
        borderLeft: `4px solid ${tipoColor.color}`,
      }}
    >
      <div className="p-5 space-y-3">
        <div className="flex items-start justify-between gap-2">
          <div className="flex-1 min-w-0">
            <h3 className="font-bold text-base leading-tight truncate" style={{ color: 'var(--fg)' }}>
              {oficina.nome}
            </h3>
          </div>
          {canManage && <div className="flex items-center gap-1 flex-shrink-0">
            <button
              onClick={() => onEditar(oficina)}
              className="p-1.5 rounded transition-colors"
              style={{ color: 'var(--fg-muted)' }}
              onMouseEnter={e => (e.currentTarget.style.color = 'var(--fg)')}
              onMouseLeave={e => (e.currentTarget.style.color = 'var(--fg-muted)')}
            >
              <Pencil size={14} />
            </button>
            <button
              onClick={() => onDeletar(oficina.id)}
              className="p-1.5 rounded transition-colors"
              style={{ color: 'var(--fg-muted)' }}
              onMouseEnter={e => (e.currentTarget.style.color = '#F87171')}
              onMouseLeave={e => (e.currentTarget.style.color = 'var(--fg-muted)')}
            >
              <Trash2 size={14} />
            </button>
          </div>}
        </div>

        <div className="flex flex-wrap gap-2">
          <span
            className="inline-flex items-center px-2 py-0.5 rounded text-xs font-semibold"
            style={{ background: tipoColor.bg, color: tipoColor.color }}
          >
            {oficina.tipo}
          </span>
          <span
            className="inline-flex items-center px-2 py-0.5 rounded text-xs font-semibold"
            style={
              oficina.tipo_vinculo === 'INTERNA'
                ? { background: 'rgba(34,197,94,0.15)', color: '#4ADE80' }
                : { background: 'rgba(107,114,128,0.15)', color: '#9CA3AF' }
            }
          >
            {oficina.tipo_vinculo}
          </span>
        </div>

        <div className="space-y-1.5">
          {oficina.cidade && (
            <div className="flex items-center gap-1.5 text-xs" style={{ color: 'var(--fg-muted)' }}>
              <MapPin size={12} />
              <span>{oficina.cidade}</span>
            </div>
          )}
          {oficina.contato && (
            <div className="flex items-center gap-1.5 text-xs" style={{ color: 'var(--fg-muted)' }}>
              <Phone size={12} />
              <span>{oficina.contato}</span>
            </div>
          )}
        </div>

        <div className="pt-2 space-y-1.5">
          <div className="flex justify-between items-center text-xs" style={{ color: 'var(--fg-muted)' }}>
            <span className="flex items-center gap-1">
              <Package size={11} />
              Peças em mãos
            </span>
            <span className="font-semibold" style={{ color: 'var(--fg)' }}>
              {pecasEmMaos}{capacidadeTotal > 0 ? ` / ${capacidadeTotal}` : ''}
            </span>
          </div>
          {capacidadeTotal > 0 && (
            <div className="h-1.5 rounded-full overflow-hidden" style={{ background: 'var(--border)' }}>
              <div
                className="h-full rounded-full transition-all"
                style={{
                  width: `${Math.min(100, (pecasEmMaos / capacidadeTotal) * 100)}%`,
                  background: pecasEmMaos > capacidadeTotal ? '#EF4444' : '#22C55E',
                }}
              />
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

// ------- MODAL VENDEDOR -------
interface ModalVendedorProps {
  open: boolean
  onClose: () => void
  vendedor?: Vendedor
}

function ModalVendedor({ open, onClose, vendedor }: ModalVendedorProps) {
  const [isPending, startTransition] = useTransition()
  const [nome, setNome] = useState(vendedor?.nome ?? '')
  const [comissao, setComissao] = useState(vendedor ? String(vendedor.comissao_pct) : '')
  const [contato, setContato] = useState(vendedor?.contato ?? '')

  const handleSalvar = () => {
    if (!nome.trim()) {
      toast.error('Nome do vendedor é obrigatório')
      return
    }
    startTransition(async () => {
      const data = {
        nome: nome.trim(),
        comissao_pct: parseFloat(comissao) || 0,
        contato: contato.trim() || undefined,
      }
      const resultado = vendedor
        ? await atualizarVendedor({ ...data, id: vendedor.id })
        : await criarVendedor(data)

      if (resultado.error) {
        toast.error(`Erro: ${resultado.error}`)
      } else {
        toast.success(vendedor ? 'Vendedor atualizado!' : 'Vendedor criado!')
        if (!vendedor) {
          setNome('')
          setComissao('')
          setContato('')
        }
        onClose()
      }
    })
  }

  return (
    <Dialog open={open} onOpenChange={v => !v && onClose()}>
      <DialogContent className="sm:max-w-md w-full rounded-xl" style={{ background: 'var(--card-bg)', borderColor: 'var(--border-color)', color: 'var(--fg)' }}>
        <DialogHeader>
          <DialogTitle style={{ color: 'var(--fg)' }}>{vendedor ? 'Editar Vendedor' : 'Novo Vendedor'}</DialogTitle>
        </DialogHeader>

        <div className="space-y-4 py-2">
          <div className="space-y-1.5">
            <label className="text-sm font-medium" style={{ color: 'var(--fg-muted)' }}>Nome *</label>
            <Input
              value={nome}
              onChange={e => setNome(e.target.value)}
              placeholder="Nome completo"
              style={{ background: 'var(--surface-subtle)', borderColor: 'var(--border-color)', color: 'var(--fg)' }}
            />
          </div>
          <div className="space-y-1.5">
            <label className="text-sm font-medium" style={{ color: 'var(--fg-muted)' }}>Comissão (%)</label>
            <Input
              type="number"
              min="0"
              max="100"
              step="0.01"
              value={comissao}
              onChange={e => setComissao(e.target.value)}
              placeholder="Ex: 5.00"
              style={{ background: 'var(--surface-subtle)', borderColor: 'var(--border-color)', color: 'var(--fg)' }}
            />
          </div>
          <div className="space-y-1.5">
            <label className="text-sm font-medium" style={{ color: 'var(--fg-muted)' }}>Contato</label>
            <Input
              value={contato}
              onChange={e => setContato(e.target.value)}
              placeholder="Telefone ou e-mail"
              style={{ background: 'var(--surface-subtle)', borderColor: 'var(--border-color)', color: 'var(--fg)' }}
            />
          </div>
        </div>

        <div className="flex justify-end gap-3 pt-2" style={{ borderTop: '1px solid var(--border-subtle)' }}>
          <Button
            variant="outline"
            onClick={onClose}
            disabled={isPending}
            style={{ borderColor: 'var(--border-medium)', color: 'var(--fg-muted)', background: 'transparent' }}
          >
            Cancelar
          </Button>
          <Button
            onClick={handleSalvar}
            disabled={isPending}
            style={{ background: '#22C55E', color: 'white' }}
            className="hover:opacity-90"
          >
            {isPending ? <Loader2 size={16} className="animate-spin mr-2" /> : null}
            {vendedor ? 'Salvar Alterações' : 'Criar Vendedor'}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  )
}

// ------- MODAL FERIADO -------
interface ModalFeriadoProps {
  open: boolean
  onClose: () => void
}

function ModalFeriado({ open, onClose }: ModalFeriadoProps) {
  const [isPending, startTransition] = useTransition()
  const [data, setData] = useState('')
  const [nome, setNome] = useState('')
  const [tipo, setTipo] = useState<'Nacional' | 'Municipal' | 'Estadual'>('Nacional')

  const handleSalvar = () => {
    if (!data || !nome.trim()) {
      toast.error('Data e nome são obrigatórios')
      return
    }
    startTransition(async () => {
      const resultado = await criarFeriado({ data, nome: nome.trim(), tipo })
      if (resultado.error) {
        toast.error(`Erro: ${resultado.error}`)
      } else {
        toast.success('Feriado adicionado!')
        setData('')
        setNome('')
        setTipo('Nacional')
        onClose()
      }
    })
  }

  return (
    <Dialog open={open} onOpenChange={v => !v && onClose()}>
      <DialogContent className="sm:max-w-md w-full rounded-xl" style={{ background: 'var(--card-bg)', borderColor: 'var(--border-color)', color: 'var(--fg)' }}>
        <DialogHeader>
          <DialogTitle style={{ color: 'var(--fg)' }}>Adicionar Feriado</DialogTitle>
        </DialogHeader>

        <div className="space-y-4 py-2">
          <div className="space-y-1.5">
            <label className="text-sm font-medium" style={{ color: 'var(--fg-muted)' }}>Data *</label>
            <Input
              type="date"
              value={data}
              onChange={e => setData(e.target.value)}
              className="focus-visible:ring-green-500/30"
            style={{ background: 'var(--surface-subtle)', borderColor: 'var(--border-color)', color: 'var(--fg)' }}
            />
          </div>
          <div className="space-y-1.5">
            <label className="text-sm font-medium" style={{ color: 'var(--fg-muted)' }}>Nome *</label>
            <Input
              value={nome}
              onChange={e => setNome(e.target.value)}
              placeholder="Ex: Natal, Tiradentes..."
              style={{ background: 'var(--surface-subtle)', borderColor: 'var(--border-color)', color: 'var(--fg)' }}
            />
          </div>
          <div className="space-y-1.5">
            <label className="text-sm font-medium" style={{ color: 'var(--fg-muted)' }}>Tipo</label>
            <Select value={tipo} onValueChange={v => setTipo((v ?? 'Nacional') as typeof tipo)}>
              <SelectTrigger style={{ background: 'var(--surface-subtle)', borderColor: 'var(--border-color)', color: 'var(--fg)' }}>
                <SelectValue />
              </SelectTrigger>
              <SelectContent style={{ background: 'var(--tooltip-bg)', borderColor: 'var(--border-color)', color: 'var(--fg)' }}>
                {TIPOS_FERIADO.map(t => (
                  <SelectItem key={t} value={t} className="focus:bg-white/8 focus:text-white">{t}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>

        <div className="flex justify-end gap-3 pt-2" style={{ borderTop: '1px solid var(--border-subtle)' }}>
          <Button
            variant="outline"
            onClick={onClose}
            disabled={isPending}
            style={{ borderColor: 'var(--border-medium)', color: 'var(--fg-muted)', background: 'transparent' }}
          >
            Cancelar
          </Button>
          <Button
            onClick={handleSalvar}
            disabled={isPending}
            style={{ background: '#22C55E', color: 'white' }}
            className="hover:opacity-90"
          >
            {isPending ? <Loader2 size={16} className="animate-spin mr-2" /> : null}
            Adicionar Feriado
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  )
}

// ------- COMPONENTE PRINCIPAL -------
export function CadastrosClient({ oficinas, vendedores, feriados, envios }: CadastrosClientProps) {
  const canManage = usePermission('settings.manage')
  const [modalOficinaAberto, setModalOficinaAberto] = useState(false)
  const [oficinaSelecionada, setOficinaSelecionada] = useState<Oficina | undefined>()
  const [modalVendedorAberto, setModalVendedorAberto] = useState(false)
  const [vendedorSelecionado, setVendedorSelecionado] = useState<Vendedor | undefined>()
  const [modalFeriadoAberto, setModalFeriadoAberto] = useState(false)
  const [isPending, startTransition] = useTransition()

  // Filtros da aba Oficinas
  const [busca, setBusca] = useState('')
  const [filtroTipo, setFiltroTipo] = useState<TipoOficina | 'Todos'>('Todos')
  const [filtroVinculo, setFiltroVinculo] = useState<TipoVinculo | 'Todos'>('Todos')
  const [ordenacao, setOrdenacao] = useState<Ordenacao>('nome-az')

  const oficinasFiltradas = useMemo(() => {
    return oficinas
      .filter(o => {
        if (busca && !o.nome.toLowerCase().includes(busca.toLowerCase())) return false
        if (filtroTipo !== 'Todos' && o.tipo !== filtroTipo) return false
        if (filtroVinculo !== 'Todos' && o.tipo_vinculo !== filtroVinculo) return false
        return true
      })
      .sort((a, b) => {
        if (ordenacao === 'nome-az') return a.nome.localeCompare(b.nome, 'pt-BR')
        if (ordenacao === 'nome-za') return b.nome.localeCompare(a.nome, 'pt-BR')
        const pa = calcularPecasEmMaos(a, envios)
        const pb = calcularPecasEmMaos(b, envios)
        return ordenacao === 'pecas-desc' ? pb - pa : pa - pb
      })
  }, [oficinas, envios, busca, filtroTipo, filtroVinculo, ordenacao])

  const filtrosAtivos = busca !== '' || filtroTipo !== 'Todos' || filtroVinculo !== 'Todos'

  const limparFiltros = () => {
    setBusca('')
    setFiltroTipo('Todos')
    setFiltroVinculo('Todos')
  }

  const handleEditarOficina = (oficina: Oficina) => {
    setOficinaSelecionada(oficina)
    setModalOficinaAberto(true)
  }

  const handleNovaOficina = () => {
    setOficinaSelecionada(undefined)
    setModalOficinaAberto(true)
  }

  const handleEditarVendedor = (vendedor: Vendedor) => {
    setVendedorSelecionado(vendedor)
    setModalVendedorAberto(true)
  }

  const handleNovoVendedor = () => {
    setVendedorSelecionado(undefined)
    setModalVendedorAberto(true)
  }

  const handleDeletar = (tabela: 'oficinas' | 'vendedores' | 'feriados', id: string, nome: string) => {
    if (!confirm(`Confirmar exclusão de "${nome}"?`)) return
    startTransition(async () => {
      const resultado = await deletarRegistro(tabela, id)
      if (resultado.error) {
        toast.error(`Erro: ${resultado.error}`)
      } else {
        toast.success('Registro excluído!')
      }
    })
  }

  return (
    <div className="p-6">
      <Tabs defaultValue="oficinas">
        {/* CABEÇALHO UNIFICADO */}
        <div className="flex items-center justify-between mb-6">
          <TabsList
            style={{ background: 'var(--surface-subtle)', borderColor: 'var(--border-color)' }}
          >
            <TabsTrigger
              value="oficinas"
              className="text-sm"
              style={{ color: 'var(--fg-muted)' }}
            >
              Oficinas e Costureiras ({oficinas.length})
            </TabsTrigger>
            <TabsTrigger
              value="vendedores"
              className="text-sm"
              style={{ color: 'var(--fg-muted)' }}
            >
              Vendedores ({vendedores.length})
            </TabsTrigger>
            <TabsTrigger
              value="feriados"
              className="text-sm"
              style={{ color: 'var(--fg-muted)' }}
            >
              Feriados ({feriados.length})
            </TabsTrigger>
          </TabsList>
        </div>

        {/* ABA: OFICINAS */}
        <TabsContent value="oficinas" className="mt-0 space-y-4">
          {/* TOOLBAR */}
          <div className="flex flex-col gap-3">
            <div className="flex items-center justify-between gap-3">
              {/* Busca */}
              <div className="relative flex-1 max-w-xs">
                <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2" style={{ color: 'var(--fg-muted)' }} />
                <Input
                  value={busca}
                  onChange={e => setBusca(e.target.value)}
                  placeholder="Buscar por nome..."
                  className="pl-9 focus-visible:ring-green-500/30 h-9"
                style={{ background: 'var(--surface-subtle)', borderColor: 'var(--border-color)', color: 'var(--fg)' }}
                />
              </div>

              {/* Filtros */}
              <div className="flex items-center gap-2">
                <Select value={filtroTipo} onValueChange={v => setFiltroTipo(v as TipoOficina | 'Todos')}>
                  <SelectTrigger className="h-9 w-40 text-sm"
                  style={{ background: 'var(--surface-subtle)', borderColor: 'var(--border-color)', color: 'var(--fg)' }}>
                    <SelectValue placeholder="Tipo" />
                  </SelectTrigger>
                  <SelectContent style={{ background: 'var(--tooltip-bg)', borderColor: 'var(--border-color)', color: 'var(--fg)' }}>
                    <SelectItem value="Todos" className="focus:bg-white/8 focus:text-white">Todos os tipos</SelectItem>
                    {TIPOS_OFICINA.map(t => (
                      <SelectItem key={t} value={t} className="focus:bg-white/8 focus:text-white">{t}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>

                <Select value={filtroVinculo} onValueChange={v => setFiltroVinculo(v as TipoVinculo | 'Todos')}>
                  <SelectTrigger className="h-9 w-36 text-sm"
                  style={{ background: 'var(--surface-subtle)', borderColor: 'var(--border-color)', color: 'var(--fg)' }}>
                    <SelectValue placeholder="Vínculo" />
                  </SelectTrigger>
                  <SelectContent style={{ background: 'var(--tooltip-bg)', borderColor: 'var(--border-color)', color: 'var(--fg)' }}>
                    <SelectItem value="Todos" className="focus:bg-white/8 focus:text-white">Todos</SelectItem>
                    <SelectItem value="INTERNA" className="focus:bg-white/8 focus:text-white">INTERNA</SelectItem>
                    <SelectItem value="EXTERNA" className="focus:bg-white/8 focus:text-white">EXTERNA</SelectItem>
                  </SelectContent>
                </Select>

                <Select value={ordenacao} onValueChange={v => setOrdenacao(v as Ordenacao)}>
                  <SelectTrigger className="h-9 w-40 text-sm"
                  style={{ background: 'var(--surface-subtle)', borderColor: 'var(--border-color)', color: 'var(--fg)' }}>
                    <ArrowUpDown size={13} className="mr-1.5 shrink-0" style={{ color: 'var(--fg-muted)' }} />
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent style={{ background: 'var(--tooltip-bg)', borderColor: 'var(--border-color)', color: 'var(--fg)' }}>
                    <SelectItem value="nome-az" className="focus:bg-white/8 focus:text-white">Nome A → Z</SelectItem>
                    <SelectItem value="nome-za" className="focus:bg-white/8 focus:text-white">Nome Z → A</SelectItem>
                    <SelectItem value="pecas-desc" className="focus:bg-white/8 focus:text-white">Mais peças primeiro</SelectItem>
                    <SelectItem value="pecas-asc" className="focus:bg-white/8 focus:text-white">Menos peças primeiro</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              {canManage && <button
                onClick={handleNovaOficina}
                className="flex items-center gap-2 px-4 py-2 text-white rounded-lg text-sm font-semibold transition-colors whitespace-nowrap"
                style={{ background: '#22C55E' }}
              >
                <Plus size={16} />
                Nova Oficina
              </button>}
            </div>

            {/* Linha de sumário */}
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3 flex-wrap">
                {TIPOS_OFICINA.map(tipo => {
                  const count = oficinas.filter(o => o.tipo === tipo).length
                  const cor = TIPO_OFICINA_COLORS[tipo] ?? { bg: 'rgba(107,114,128,0.15)', color: '#9CA3AF' }
                  return (
                    <button
                      key={tipo}
                      onClick={() => setFiltroTipo(filtroTipo === tipo ? 'Todos' : tipo)}
                      className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold transition-opacity"
                      style={{
                        background: cor.bg,
                        color: cor.color,
                        opacity: filtroTipo !== 'Todos' && filtroTipo !== tipo ? 0.4 : 1,
                        outline: filtroTipo === tipo ? `1px solid ${cor.color}` : 'none',
                      }}
                    >
                      {tipo}
                      <span className="font-bold">{count}</span>
                    </button>
                  )
                })}
              </div>
              <div className="flex items-center gap-3">
                {filtrosAtivos && (
                  <button
                    onClick={limparFiltros}
                    className="text-xs flex items-center gap-1 transition-colors"
                    style={{ color: 'var(--fg-muted)' }}
                    onMouseEnter={e => (e.currentTarget.style.color = '#9CA3AF')}
                    onMouseLeave={e => (e.currentTarget.style.color = 'var(--fg-muted)')}
                  >
                    <X size={12} />
                    Limpar filtros
                  </button>
                )}
                <p className="text-xs" style={{ color: 'var(--fg-muted)' }}>
                  {filtrosAtivos
                    ? `${oficinasFiltradas.length} de ${oficinas.length} oficinas`
                    : `${oficinas.length} ${oficinas.length === 1 ? 'oficina cadastrada' : 'oficinas cadastradas'}`
                  }
                </p>
              </div>
            </div>
          </div>

          {/* GRID DE CARDS */}
          {oficinas.length === 0 ? (
            <div
              className="rounded-xl p-12 text-center"
              style={{ background: 'var(--card-bg)', border: '1px solid var(--border-color)' }}
            >
              <p className="text-sm" style={{ color: 'var(--fg-muted)' }}>Nenhuma oficina cadastrada</p>
            </div>
          ) : oficinasFiltradas.length === 0 ? (
            <div
              className="rounded-xl p-12 text-center space-y-3"
              style={{ background: 'var(--card-bg)', border: '1px solid var(--border-color)' }}
            >
              <p className="text-sm" style={{ color: 'var(--fg-muted)' }}>
                Nenhuma oficina encontrada para os filtros aplicados.
              </p>
              <button
                onClick={limparFiltros}
                className="text-sm underline transition-colors"
                style={{ color: '#22C55E' }}
              >
                Limpar filtros
              </button>
            </div>
          ) : (
            <div className="grid grid-cols-3 gap-4">
              {oficinasFiltradas.map(oficina => (
                <CardOficina
                  key={oficina.id}
                  oficina={oficina}
                  envios={envios}
                  onEditar={handleEditarOficina}
                  onDeletar={id => handleDeletar('oficinas', id, oficina.nome)}
                  canManage={canManage}
                />
              ))}
            </div>
          )}

          {canManage && modalOficinaAberto && <ModalOficina
            key={oficinaSelecionada?.id ?? 'nova-oficina'}
            open={modalOficinaAberto}
            onClose={() => setModalOficinaAberto(false)}
            oficina={oficinaSelecionada}
          />}
        </TabsContent>

        {/* ABA: VENDEDORES */}
        <TabsContent value="vendedores" className="mt-0">
          <div className="flex justify-between items-center mb-4">
            <p className="text-sm" style={{ color: 'var(--fg-muted)' }}>
              {vendedores.length} {vendedores.length === 1 ? 'vendedor cadastrado' : 'vendedores cadastrados'}
            </p>
            {canManage && <button
              onClick={handleNovoVendedor}
              className="flex items-center gap-2 px-4 py-2 text-white rounded-lg text-sm font-semibold transition-colors"
              style={{ background: '#22C55E' }}
            >
              <Plus size={16} />
              Novo Vendedor
            </button>}
          </div>

          <div
            className="rounded-xl overflow-hidden"
            style={{ background: 'var(--card-bg)', border: '1px solid var(--border-color)' }}
          >
            <table className="w-full text-sm">
              <thead>
                <tr
                  className="text-xs uppercase tracking-wide"
                  style={{ background: 'rgba(255,255,255,0.04)', borderBottom: '1px solid rgba(255,255,255,0.08)', color: '#6B7280' }}
                >
                  <th className="text-left px-4 py-3 font-medium">Nome</th>
                  <th className="text-right px-4 py-3 font-medium">Comissão %</th>
                  <th className="text-left px-4 py-3 font-medium">Contato</th>
                  <th className="text-center px-4 py-3 font-medium">Ações</th>
                </tr>
              </thead>
              <tbody>
                {vendedores.length === 0 ? (
                  <tr>
                    <td colSpan={4} className="text-center py-10" style={{ color: 'var(--fg-muted)' }}>
                      Nenhum vendedor cadastrado
                    </td>
                  </tr>
                ) : (
                  vendedores.map(v => (
                    <tr key={v.id} style={{ borderBottom: '1px solid var(--border-subtle)' }}>
                      <td className="px-4 py-3 font-medium text-white">{v.nome}</td>
                      <td className="px-4 py-3 text-right" style={{ color: 'var(--fg-muted)' }}>
                        {Number(v.comissao_pct).toFixed(2)}%
                      </td>
                      <td className="px-4 py-3" style={{ color: 'var(--fg-muted)' }}>{v.contato ?? '—'}</td>
                      <td className="px-4 py-3 text-center">
                        {canManage && <div className="flex items-center justify-center gap-1">
                          <button
                            onClick={() => handleEditarVendedor(v)}
                            disabled={isPending}
                            className="p-1.5 rounded transition-colors"
                            style={{ color: 'var(--fg-muted)' }}
                            onMouseEnter={e => (e.currentTarget.style.color = '#9CA3AF')}
                            onMouseLeave={e => (e.currentTarget.style.color = 'var(--fg-muted)')}
                          >
                            <Pencil size={14} />
                          </button>
                          <button
                            onClick={() => handleDeletar('vendedores', v.id, v.nome)}
                            disabled={isPending}
                            className="p-1.5 rounded transition-colors"
                            style={{ color: 'var(--fg-muted)' }}
                            onMouseEnter={e => (e.currentTarget.style.color = '#F87171')}
                            onMouseLeave={e => (e.currentTarget.style.color = 'var(--fg-muted)')}
                          >
                            <Trash2 size={14} />
                          </button>
                        </div>}
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>

          {canManage && modalVendedorAberto && <ModalVendedor
            key={vendedorSelecionado?.id ?? 'novo-vendedor'}
            open={modalVendedorAberto}
            onClose={() => setModalVendedorAberto(false)}
            vendedor={vendedorSelecionado}
          />}
        </TabsContent>

        {/* ABA: FERIADOS */}
        <TabsContent value="feriados" className="mt-0">
          <div className="flex justify-between items-center mb-4">
            <h2 className="text-sm font-medium" style={{ color: 'var(--fg-muted)' }}>
              Calendário de Feriados — {new Date().getFullYear()}
            </h2>
            {canManage && <button
              onClick={() => setModalFeriadoAberto(true)}
              className="flex items-center gap-2 px-4 py-2 text-white rounded-lg text-sm font-semibold transition-colors"
              style={{ background: '#22C55E' }}
            >
              <Plus size={16} />
              Adicionar Feriado
            </button>}
          </div>

          {feriados.length === 0 ? (
            <div
              className="rounded-xl p-12 text-center"
              style={{ background: 'var(--card-bg)', border: '1px solid var(--border-color)' }}
            >
              <p className="text-sm" style={{ color: 'var(--fg-muted)' }}>Nenhum feriado cadastrado</p>
            </div>
          ) : (
            <div className="grid grid-cols-4 gap-3">
              {feriados.map(f => {
                const tipoColor = TIPO_FERIADO_COLORS[f.tipo] ?? { bg: 'rgba(107,114,128,0.15)', color: '#9CA3AF' }
                return (
                  <div
                    key={f.id}
                    className="rounded-xl p-4 flex flex-col gap-2 transition-shadow"
                    style={{ background: 'var(--card-bg)', border: '1px solid var(--border-color)' }}
                  >
                    <div className="flex items-start justify-between gap-2">
                      <p className="text-lg font-bold text-white">
                        {formatDate(f.data, 'dd/MM')}
                      </p>
                      {canManage && <button
                        onClick={() => handleDeletar('feriados', f.id, f.nome)}
                        disabled={isPending}
                        className="p-1 rounded transition-colors"
                        style={{ color: 'var(--fg-muted)' }}
                        onMouseEnter={e => (e.currentTarget.style.color = '#F87171')}
                        onMouseLeave={e => (e.currentTarget.style.color = '#4B5563')}
                      >
                        <X size={13} />
                      </button>}
                    </div>
                    <p className="text-sm font-medium leading-tight text-white">{f.nome}</p>
                    <p className="text-xs" style={{ color: 'var(--fg-muted)' }}>
                      {formatDate(f.data, 'EEEE')}
                    </p>
                    <span
                      className="inline-flex items-center self-start px-2 py-0.5 rounded text-xs font-semibold mt-1"
                      style={{ background: tipoColor.bg, color: tipoColor.color }}
                    >
                      {f.tipo}
                    </span>
                  </div>
                )
              })}
            </div>
          )}

          {canManage && <ModalFeriado
            open={modalFeriadoAberto}
            onClose={() => setModalFeriadoAberto(false)}
          />}
        </TabsContent>
      </Tabs>
    </div>
  )
}
