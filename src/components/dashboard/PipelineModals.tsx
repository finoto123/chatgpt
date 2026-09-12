'use client'

import { useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { toast } from 'sonner'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { moverParaCorte, moverParaEstamparia, moverParaCostura, moverParaAcabamento } from '@/app/dashboard/actions'

interface BaseModalProps {
  isOpen: boolean
  onClose: () => void
  pedidoId: string
  pedidoNumero: string
}

export interface OficinaOption {
  id: string
  nome: string
  tipo: string
}

interface MoverParaEstampariaPayload {
  targetStatus: 'sublimacao' | 'dtf' | 'bordados'
  oficina_id?: string
  data_envio?: string
  retorno_previsto?: string
  valor_unitario?: number
  total_pecas?: number
  sublimacao_status?: string
  bordado_status?: string
}

export function ModalMoveCorte({ isOpen, onClose, pedidoId, pedidoNumero }: BaseModalProps) {
  const [isPending, startTransition] = useTransition()
  const router = useRouter()

  const handleSubmit = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault()
    const formData = new FormData(e.currentTarget)
    const situacao = formData.get('situacao') as string
    const cortador = formData.get('cortador') as string

    startTransition(async () => {
      const res = await moverParaCorte(pedidoId, { situacao, cortador })
      if (res.error) toast.error(res.error)
      else {
        toast.success('Pedido movido para Corte')
        onClose()
        router.refresh()
      }
    })
  }

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="bg-surface border-border text-foreground shadow-2xl">
        <DialogHeader>
          <DialogTitle className="text-foreground">Mover #{pedidoNumero} para Corte</DialogTitle>
          <DialogDescription className="text-muted">Preencha os dados da produção para liberar o pedido para o corte.</DialogDescription>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-2">
            <label className="text-sm font-medium">Situação do Corte</label>
            <Select name="situacao" required defaultValue="AGUARDANDO CORTE">
              <SelectTrigger>
                <SelectValue placeholder="Selecione..." />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="AGUARDANDO CORTE">Aguardando Corte</SelectItem>
                <SelectItem value="EM ANDAMENTO">Em andamento</SelectItem>
                <SelectItem value="FINALIZADO NO PRAZO">Finalizado (No Prazo)</SelectItem>
                <SelectItem value="FINALIZADO ATRASADO">Finalizado (Atrasado)</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-2">
            <label className="text-sm font-medium text-muted">Nome do Cortador (Opcional)</label>
            <Input name="cortador" placeholder="Ex: João" className="bg-card border-border-medium text-foreground focus:border-blue-500" />
          </div>
          <div className="flex justify-end gap-2 pt-4">
            <Button type="button" variant="outline" onClick={onClose} disabled={isPending} className="bg-transparent border-border-medium text-muted hover:bg-surface-hover hover:text-foreground">Cancelar</Button>
            <Button type="submit" disabled={isPending} className="bg-blue-600 hover:bg-blue-700 text-white">Mover Pedido</Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  )
}

export function ModalMoveEstamparia({ isOpen, onClose, pedidoId, pedidoNumero, targetCol, oficinas, totalPecas }: BaseModalProps & { targetCol: 'sublimacao' | 'dtf' | 'bordados', oficinas: OficinaOption[], totalPecas: number }) {
  const [isPending, startTransition] = useTransition()
  const router = useRouter()
  
  const isDtf = targetCol === 'dtf'
  const isBordado = targetCol === 'bordados'
  const isSublimacao = targetCol === 'sublimacao'

  const handleSubmit = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault()
    const formData = new FormData(e.currentTarget)
    
    startTransition(async () => {
      const data: MoverParaEstampariaPayload = { targetStatus: targetCol }
      if (isDtf) {
        data.oficina_id = String(formData.get('oficina_id') ?? '')
        data.data_envio = String(formData.get('data_envio') ?? '')
        data.retorno_previsto = String(formData.get('retorno_previsto') ?? '')
        data.valor_unitario = Number(formData.get('valor_unitario'))
        data.total_pecas = totalPecas
      } else if (isSublimacao) {
        data.sublimacao_status = String(formData.get('sublimacao_status') ?? '')
      } else if (isBordado) {
        data.bordado_status = String(formData.get('bordado_status') ?? '')
      }

      const res = await moverParaEstamparia(pedidoId, data)
      if (res.error) toast.error(res.error)
      else {
        toast.success(`Pedido movido para ${targetCol.toUpperCase()}`)
        onClose()
        router.refresh()
      }
    })
  }

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="bg-surface border-border text-foreground shadow-2xl">
        <DialogHeader>
          <DialogTitle className="text-foreground">Mover #{pedidoNumero} para {targetCol.toUpperCase()}</DialogTitle>
          <DialogDescription className="text-muted">
            {isDtf && 'Este pedido exige DTF (Externo). Preencha os dados de envio.'}
            {isSublimacao && 'Este pedido exige Sublimação (Interna).'}
            {isBordado && 'Este pedido exige Bordados. Defina o status inicial.'}
          </DialogDescription>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4">
          {isDtf ? (
            <>
              <div className="space-y-2">
                <label className="text-sm font-medium">Oficina de DTF</label>
                <Select name="oficina_id" required>
                  <SelectTrigger><SelectValue placeholder="Selecione a oficina..." /></SelectTrigger>
                  <SelectContent>
                    {oficinas.filter(o => o.tipo === 'DTF').map(o => (
                      <SelectItem key={o.id} value={o.id}>{o.nome}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <label className="text-sm font-medium">Data de Envio</label>
                  <Input type="date" name="data_envio" required />
                </div>
                <div className="space-y-2">
                  <label className="text-sm font-medium">Previsão Retorno</label>
                  <Input type="date" name="retorno_previsto" required />
                </div>
              </div>
              <div className="space-y-2">
                <label className="text-sm font-medium">Valor Unitário Cobrado (R$)</label>
                <Input type="number" step="0.01" name="valor_unitario" placeholder="Ex: 5.50" required />
              </div>
            </>
          ) : isSublimacao ? (
            <div className="space-y-2">
              <label className="text-sm font-medium">Status da Sublimação</label>
              <Select name="sublimacao_status" required defaultValue="aguardando_arte">
                <SelectTrigger><SelectValue placeholder="Selecione..." /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="aguardando_arte">Aguardando Arte</SelectItem>
                  <SelectItem value="impresso">Impresso</SelectItem>
                  <SelectItem value="prensado">Prensado</SelectItem>
                  <SelectItem value="finalizada">Finalizada</SelectItem>
                </SelectContent>
              </Select>
            </div>
          ) : (
            <div className="space-y-2">
              <label className="text-sm font-medium">Status do Bordado</label>
              <Select name="bordado_status" required defaultValue="aguardando_matriz">
                <SelectTrigger><SelectValue placeholder="Selecione..." /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="aguardando_matriz">Aguardando Matriz</SelectItem>
                  <SelectItem value="para_bordar">Para Bordar</SelectItem>
                  <SelectItem value="finalizado">Finalizado</SelectItem>
                </SelectContent>
              </Select>
            </div>
          )}
          <div className="flex justify-end gap-2 pt-4">
            <Button type="button" variant="outline" onClick={onClose} disabled={isPending} className="bg-transparent border-border-medium text-muted hover:bg-surface-hover hover:text-foreground">Cancelar</Button>
            <Button type="submit" disabled={isPending} className="bg-blue-600 hover:bg-blue-700 text-white">Mover Pedido</Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  )
}

export function ModalMoveCostura({ isOpen, onClose, pedidoId, pedidoNumero, oficinas, totalPecas }: BaseModalProps & { oficinas: OficinaOption[], totalPecas: number }) {
  const [isPending, startTransition] = useTransition()
  const router = useRouter()

  const handleSubmit = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault()
    const formData = new FormData(e.currentTarget)
    
    startTransition(async () => {
      const data = {
        oficina_id: formData.get('oficina_id') as string,
        data_envio: formData.get('data_envio') as string,
        retorno_previsto: formData.get('retorno_previsto') as string,
        valor_unitario: Number(formData.get('valor_unitario')),
        total_pecas: totalPecas,
        grade_quantidade: {}, // Simplified for move, can be edited later in oficinas module
      }

      const res = await moverParaCostura(pedidoId, data)
      if (res.error) toast.error(res.error)
      else {
        toast.success('Pedido enviado para Costura')
        onClose()
        router.refresh()
      }
    })
  }

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="bg-surface border-border text-foreground shadow-2xl">
        <DialogHeader>
          <DialogTitle className="text-foreground">Enviar #{pedidoNumero} para Costura</DialogTitle>
          <DialogDescription className="text-muted">
            Defina para qual oficina este pedido será enviado e a data de retorno esperada.
            Serão enviadas {totalPecas} peças.
          </DialogDescription>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-2">
            <label className="text-sm font-medium">Oficina de Costura</label>
            <Select name="oficina_id" required>
              <SelectTrigger><SelectValue placeholder="Selecione a oficina..." /></SelectTrigger>
              <SelectContent>
                {oficinas.filter(o => o.tipo === 'Costura').map(o => (
                  <SelectItem key={o.id} value={o.id}>{o.nome}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <label className="text-sm font-medium">Data de Envio</label>
              <Input type="date" name="data_envio" required />
            </div>
            <div className="space-y-2">
              <label className="text-sm font-medium">Previsão Retorno</label>
              <Input type="date" name="retorno_previsto" required />
            </div>
          </div>
          <div className="space-y-2">
            <label className="text-sm font-medium text-muted">Valor Unitário Combinado (R$)</label>
            <Input type="number" step="0.01" name="valor_unitario" placeholder="Ex: 3.50" required className="bg-card border-border-medium text-foreground focus:border-blue-500" />
          </div>
          <div className="flex justify-end gap-2 pt-4">
            <Button type="button" variant="outline" onClick={onClose} disabled={isPending} className="bg-transparent border-border-medium text-muted hover:bg-surface-hover hover:text-foreground">Cancelar</Button>
            <Button type="submit" disabled={isPending} className="bg-blue-600 hover:bg-blue-700 text-white">Enviar</Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  )
}

export function ModalMoveAcabamento({ isOpen, onClose, pedidoId, pedidoNumero }: BaseModalProps) {
  const [isPending, startTransition] = useTransition()
  const router = useRouter()

  const handleSubmit = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault()
    const formData = new FormData(e.currentTarget)
    
    startTransition(async () => {
      const situacao = formData.get('situacao') as string
      const res = await moverParaAcabamento(pedidoId, { situacao })
      if (res.error) toast.error(res.error)
      else {
        toast.success('Pedido movido para Acabamento')
        onClose()
        router.refresh()
      }
    })
  }

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="bg-surface border-border text-foreground shadow-2xl">
        <DialogHeader>
          <DialogTitle className="text-foreground">Mover #{pedidoNumero} para Acabamento</DialogTitle>
          <DialogDescription className="text-muted">
            Como está a situação da embalagem/acabamento?
          </DialogDescription>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-2">
            <label className="text-sm font-medium">Situação da Embalagem</label>
            <Select name="situacao" required defaultValue="AGUARDANDO CONFERENCIA">
              <SelectTrigger><SelectValue placeholder="Selecione..." /></SelectTrigger>
              <SelectContent>
                <SelectItem value="AGUARDANDO CONFERENCIA">Aguardando Conferência</SelectItem>
                <SelectItem value="EM ANDAMENTO">Em andamento</SelectItem>
                <SelectItem value="ENTREGUE NO PRAZO">Finalizado (Pronto para entrega)</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="flex justify-end gap-2 pt-4">
            <Button type="button" variant="outline" onClick={onClose} disabled={isPending} className="bg-transparent border-border-medium text-muted hover:bg-surface-hover hover:text-foreground">Cancelar</Button>
            <Button type="submit" disabled={isPending} className="bg-blue-600 hover:bg-blue-700 text-white">Finalizar Produção</Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  )
}
