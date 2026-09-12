'use client'

import { useState, useTransition, useMemo } from 'react'
import { useRouter } from 'next/navigation'
import { toast } from 'sonner'
import {
  Plus, Pencil, Trash2, Search, Loader2,
  Phone, MapPin, X,
} from 'lucide-react'
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Cliente } from '@/types'
import { formatBRL } from '@/lib/utils'
import { criarCliente, atualizarCliente, deletarCliente } from '@/app/clientes/actions'
import { usePermission } from '@/components/providers/AuthorizationProvider'

interface Props {
  clientes: Cliente[]
  searchInicial: string
  canViewFinance: boolean
}

// ------- MODAL CLIENTE -------
interface ModalClienteProps {
  open: boolean
  onClose: () => void
  cliente?: Cliente
}

function ModalCliente({ open, onClose, cliente }: ModalClienteProps) {
  const [isPending, startTransition] = useTransition()
  const [nome, setNome] = useState(cliente?.nome ?? '')
  const [contato, setContato] = useState(cliente?.contato ?? '')
  const [email, setEmail] = useState(cliente?.email ?? '')
  const [cidade, setCidade] = useState(cliente?.cidade ?? '')
  const [observacoes, setObservacoes] = useState(cliente?.observacoes ?? '')

  const inputStyle = {
    background: 'var(--surface-subtle)',
    border: '1px solid var(--border-color)',
    color: 'var(--fg)',
    borderRadius: '8px',
  }

  function handleSubmit() {
    if (!nome.trim()) { toast.error('Nome obrigatório'); return }
    startTransition(async () => {
      const data = { nome, contato: contato || undefined, email: email || undefined, cidade: cidade || undefined, observacoes: observacoes || undefined }
      const resultado = cliente
        ? await atualizarCliente(cliente.id, data)
        : await criarCliente(data)
      if (resultado.error) {
        toast.error(`Erro: ${resultado.error}`)
      } else {
        toast.success(cliente ? 'Cliente atualizado!' : 'Cliente cadastrado!')
        onClose()
      }
    })
  }

  return (
    <Dialog open={open} onOpenChange={v => !v && onClose()}>
      <DialogContent className="sm:max-w-md w-full rounded-xl" style={{ background: 'var(--card-bg)', borderColor: 'var(--border-color)', color: 'var(--fg)' }}>
        <DialogHeader>
          <DialogTitle style={{ color: 'var(--fg)' }}>{cliente ? 'Editar Cliente' : 'Novo Cliente'}</DialogTitle>
        </DialogHeader>

        <div className="space-y-3 mt-2">
          <div>
            <label className="text-xs font-medium text-muted">Nome *</label>
            <input
              value={nome}
              onChange={e => setNome(e.target.value)}
              className="mt-1 w-full rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-green-500 placeholder-muted"
              style={inputStyle}
              placeholder="Nome do cliente"
            />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-xs font-medium text-muted">Telefone / WhatsApp</label>
              <input
                value={contato}
                onChange={e => setContato(e.target.value)}
                className="mt-1 w-full rounded-lg px-3 py-2 text-sm focus:outline-none"
                style={inputStyle}
                placeholder="(17) 99999-9999"
              />
            </div>
            <div>
              <label className="text-xs font-medium text-muted">Cidade</label>
              <input
                value={cidade}
                onChange={e => setCidade(e.target.value)}
                className="mt-1 w-full rounded-lg px-3 py-2 text-sm focus:outline-none"
                style={inputStyle}
                placeholder="Catanduva"
              />
            </div>
          </div>
          <div>
            <label className="text-xs font-medium text-muted">E-mail</label>
            <input
              type="email"
              value={email}
              onChange={e => setEmail(e.target.value)}
              className="mt-1 w-full rounded-lg px-3 py-2 text-sm focus:outline-none"
              style={inputStyle}
              placeholder="cliente@email.com"
            />
          </div>
          <div>
            <label className="text-xs font-medium text-muted">Observações</label>
            <textarea
              value={observacoes}
              onChange={e => setObservacoes(e.target.value)}
              rows={2}
              className="mt-1 w-full rounded-lg px-3 py-2 text-sm resize-none focus:outline-none"
              style={inputStyle}
              placeholder="Informações adicionais..."
            />
          </div>
        </div>

        <div className="flex justify-end gap-2 mt-4">
          <Button variant="ghost" onClick={onClose} className="text-muted hover:text-foreground">Cancelar</Button>
          <Button
            onClick={handleSubmit}
            disabled={isPending}
            className="bg-green-600 dark:bg-green-600 text-white hover:bg-green-700 dark:hover:bg-green-500"
          >
            {isPending ? <Loader2 size={16} className="animate-spin mr-2" /> : null}
            {cliente ? 'Salvar Alterações' : 'Cadastrar Cliente'}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  )
}

// ------- COMPONENTE PRINCIPAL -------
export function ClientesClient({ clientes, searchInicial, canViewFinance }: Props) {
  const canCreate = usePermission('customers.create')
  const canUpdate = usePermission('customers.update')
  const canDelete = usePermission('customers.delete')
  const router = useRouter()
  const [search, setSearch] = useState(searchInicial)
  const [filtroDias, setFiltroDias] = useState<string>('todos')
  const [modalAberto, setModalAberto] = useState(false)
  const [clienteSelecionado, setClienteSelecionado] = useState<Cliente | undefined>()
  const [deletando, setDeletando] = useState<string | null>(null)
  const [isPending, startTransition] = useTransition()

  const clientesFiltrados = useMemo(() => {
    let filtrados = clientes

    const q = search.toLowerCase()
    if (q) {
      filtrados = filtrados.filter(c =>
        c.nome.toLowerCase().includes(q) ||
        (c.cidade ?? '').toLowerCase().includes(q) ||
        (c.contato ?? '').includes(q)
      )
    }

    if (filtroDias !== 'todos') {
      const dias = parseInt(filtroDias, 10)
      const dataLimite = new Date()
      dataLimite.setDate(dataLimite.getDate() - dias)
      
      filtrados = filtrados.filter(c => {
        if (!c.data_ultimo_pedido) return false
        const dataPedido = new Date(c.data_ultimo_pedido)
        return dataPedido >= dataLimite
      })
    }

    return filtrados
  }, [clientes, search, filtroDias])

  function abrirEditar(c: Cliente) {
    setClienteSelecionado(c)
    setModalAberto(true)
  }

  function fecharModal() {
    setModalAberto(false)
    setClienteSelecionado(undefined)
  }

  function handleDeletar(id: string) {
    if (!confirm('Excluir este cliente? Pedidos vinculados não serão apagados.')) return
    setDeletando(id)
    startTransition(async () => {
      const resultado = await deletarCliente(id)
      setDeletando(null)
      if (resultado.error) toast.error(`Erro: ${resultado.error}`)
      else toast.success('Cliente removido')
    })
  }

  const totalClientes = clientes.length
  const comPedidos = clientes.filter(c => (c.total_pedidos ?? 0) > 0).length

  return (
    <>
      <div className="grid grid-cols-3 gap-4 mb-6">
        {[
          { label: 'Total de Clientes', value: totalClientes, cor: 'text-green-700 dark:text-green-400' },
          { label: 'Com Pedidos', value: comPedidos, cor: 'text-blue-700 dark:text-blue-400' },
          { label: 'Sem Pedidos', value: totalClientes - comPedidos, cor: 'text-gray-600 dark:text-gray-400' },
        ].map(k => (
          <div
            key={k.label}
            className="rounded-xl p-4 border"
            style={{ background: 'var(--card-bg)', borderColor: 'var(--border-color)' }}
          >
            <p className="text-xs font-medium uppercase tracking-wide" style={{ color: 'var(--fg-muted)' }}>{k.label}</p>
            <p className={`text-2xl font-bold mt-1 ${k.cor}`}>{k.value}</p>
          </div>
        ))}
      </div>

      {/* Barra de ações */}
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-3">
          <div className="relative w-72">
            <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
            <input
              value={search}
              onChange={e => setSearch(e.target.value)}
              placeholder="Buscar por nome, cidade..."
              className="w-full pl-9 pr-3 py-2 text-sm rounded-lg focus:outline-none"
              style={{ background: 'var(--input-bg)', border: '1px solid var(--border-color)', color: 'var(--fg)' }}
            />
            {search && (
              <button onClick={() => setSearch('')} className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400">
                <X size={14} />
              </button>
            )}
          </div>
          
          <select
            value={filtroDias}
            onChange={e => setFiltroDias(e.target.value)}
            className="px-3 py-2 text-sm rounded-lg focus:outline-none cursor-pointer"
            style={{ background: 'var(--input-bg)', border: '1px solid var(--border-color)', color: 'var(--fg)' }}
          >
            <option value="todos">Qualquer data (Último pedido)</option>
            <option value="30">Últimos 30 dias</option>
            <option value="60">Últimos 60 dias</option>
            <option value="90">Últimos 90 dias</option>
          </select>
        </div>
        
        {canCreate && <Button
          onClick={() => { setClienteSelecionado(undefined); setModalAberto(true) }}
          className="bg-green-600 dark:bg-green-600 text-white hover:bg-green-700 dark:hover:bg-green-500 flex items-center gap-2"
        >
          <Plus size={16} />
          Novo Cliente
        </Button>}
      </div>

      {/* Tabela */}
      <div className="rounded-xl overflow-hidden" style={{ background: 'var(--card-bg)', border: '1px solid var(--border-color)' }}>
        <table className="w-full text-sm">
          <thead style={{ background: 'var(--input-bg)', borderBottom: '1px solid var(--border-color)' }}>
            <tr>
              {['Cliente', 'Contato', 'Cidade', 'Pedidos', 'Peças', ...(canViewFinance ? ['Valor Total'] : []), 'Ações'].map(h => (
                <th key={h} className="px-4 py-3 text-left text-xs font-medium uppercase tracking-wide" style={{ color: 'var(--fg-muted)' }}>
                  {h}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {clientesFiltrados.length === 0 ? (
              <tr>
                <td colSpan={7} className="text-center py-10" style={{ color: 'var(--fg-muted)' }}>
                  Nenhum cliente encontrado
                </td>
              </tr>
            ) : clientesFiltrados.map(c => (
              <tr
                key={c.id}
                className="hover-item cursor-pointer transition-colors"
                style={{ borderBottom: '1px solid var(--border-subtle)' }}
                onClick={() => router.push(`/clientes/${c.id}`)}
              >
                <td className="px-4 py-3">
                  <div className="flex items-center gap-2">
                    <div
                      className="w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold flex-shrink-0 bg-green-50 dark:bg-green-950/20 text-green-700 dark:text-green-400 border border-green-200 dark:border-green-850/20"
                    >
                      {c.nome[0]}
                    </div>
                    <span className="font-medium" style={{ color: 'var(--fg)' }}>{c.nome}</span>
                  </div>
                </td>
                <td className="px-4 py-3" style={{ color: 'var(--fg-muted)' }}>
                  {c.contato ? (
                    <span className="flex items-center gap-1"><Phone size={12} />{c.contato}</span>
                  ) : '—'}
                </td>
                <td className="px-4 py-3" style={{ color: 'var(--fg-muted)' }}>
                  {c.cidade ? (
                    <span className="flex items-center gap-1"><MapPin size={12} />{c.cidade}</span>
                  ) : '—'}
                </td>
                <td className="px-4 py-3 text-center">
                  <span
                    className={`inline-flex items-center justify-center w-6 h-6 rounded-full text-xs font-bold border ${
                      (c.total_pedidos ?? 0) > 0
                        ? 'bg-green-50 dark:bg-green-950/20 text-green-700 dark:text-green-400 border-green-200 dark:border-green-900/30'
                        : 'bg-surface border-border text-muted'
                    }`}
                  >
                    {c.total_pedidos ?? 0}
                  </span>
                </td>
                <td className="px-4 py-3 text-center" style={{ color: 'var(--fg-secondary)' }}>
                  {(c.total_pecas ?? 0) > 0 ? c.total_pecas : '—'}
                </td>
                {canViewFinance && <td className="px-4 py-3 font-semibold" style={{ color: 'var(--fg)' }}>
                  {(c.valor_total ?? 0) > 0 ? formatBRL(c.valor_total) : '—'}
                </td>}
                <td className="px-4 py-3" onClick={e => e.stopPropagation()}>
                  <div className="flex items-center gap-1">
                    {canUpdate && <button
                      onClick={() => abrirEditar(c)}
                      className="p-1.5 rounded-lg transition-colors hover-item"
                      style={{ color: 'var(--fg-muted)' }}
                      title="Editar"
                    >
                      <Pencil size={14} />
                    </button>}
                    {canDelete && <button
                      onClick={() => handleDeletar(c.id)}
                      disabled={deletando === c.id || isPending}
                      className="p-1.5 rounded-lg transition-colors hover:bg-red-500/10 text-red-500 hover:text-red-600 dark:hover:text-red-400"
                      title="Excluir"
                    >
                      {deletando === c.id
                        ? <Loader2 size={14} className="animate-spin" />
                        : <Trash2 size={14} />}
                    </button>}
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>

        <div className="px-4 py-2 text-xs" style={{ color: 'var(--fg-muted)', borderTop: '1px solid var(--border-subtle)' }}>
          {clientesFiltrados.length} de {totalClientes} clientes
        </div>
      </div>

      {(canCreate || canUpdate) && <ModalCliente
        open={modalAberto}
        onClose={fecharModal}
        cliente={clienteSelecionado}
      />}
    </>
  )
}
