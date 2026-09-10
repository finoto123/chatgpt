'use client'

import { useState } from 'react'
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { toast } from 'sonner'
import { confirmarRetorno } from '@/app/oficinas/actions'

interface EnvioSimples {
  id: string
  pedido: { numero: string; cliente: string } | null
  total_pecas: number | null
  data_envio: string | null
  status: string
  retorno_real: string | null
  qt_retornada_1a_entrega: number | null
  observacoes: string | null
}

interface ConfirmarRetornoDrawerProps {
  envio: EnvioSimples
  open: boolean
  onClose: () => void
}

export function ConfirmarRetornoDrawer({ envio, open, onClose }: ConfirmarRetornoDrawerProps) {
  if (!open) return null
  return <ConfirmarRetornoForm key={envio.id} envio={envio} onClose={onClose} />
}

function ConfirmarRetornoForm({ envio, onClose }: Omit<ConfirmarRetornoDrawerProps, 'open'>) {
  const [loading, setLoading] = useState(false)
  const [qt1Entrega, setQt1Entrega] = useState(envio.qt_retornada_1a_entrega?.toString() ?? '')
  const [retornoReal, setRetornoReal] = useState(envio.retorno_real ?? '')
  const [status, setStatus] = useState(envio.status)
  const [observacoes, setObservacoes] = useState(envio.observacoes ?? '')

  async function handleSave() {
    const precisaRetorno = ['retornado', 'finalizado'].includes(status)
    if (precisaRetorno && !retornoReal) {
      toast.error('Informe a data de retorno real')
      return
    }

    if (envio.data_envio && retornoReal && retornoReal < envio.data_envio) {
      toast.error('Data de retorno não pode ser anterior à data de envio')
      return
    }

    setLoading(true)
    try {
      const result = await confirmarRetorno(envio.id, {
        retorno_real: retornoReal || null,
        qt_retornada_1a_entrega: parseInt(qt1Entrega) || 0,
        status: status,
        observacoes: observacoes || undefined,
      })

      if (result.error) {
        toast.error('Erro ao salvar alterações: ' + result.error)
      } else {
        toast.success('Envio atualizado com sucesso!')
        onClose()
      }
    } finally {
      setLoading(false)
    }
  }

  return (
    <Dialog open onOpenChange={v => !v && onClose()}>
      <DialogContent className="sm:max-w-[460px] p-6 max-h-[90vh] overflow-y-auto bg-card border-border border shadow-2xl">
        <DialogHeader>
          <DialogTitle className="text-foreground text-xl">Editar Envio / Retorno</DialogTitle>
          {envio.pedido && (
            <p className="text-sm text-gray-500">
              Pedido #{envio.pedido.numero} — {envio.pedido.cliente}
            </p>
          )}
        </DialogHeader>

        <div className="mt-4 space-y-4">
          <div className="flex gap-2 text-sm text-muted">
            <span>Total enviado:</span>
            <span className="font-semibold text-foreground">{envio.total_pecas ?? 0} peças</span>
          </div>

          <div>
            <label className="text-xs font-semibold text-muted uppercase tracking-wide">Status da Costura *</label>
            <select
              value={status}
              onChange={e => {
                const val = e.target.value
                setStatus(val)
                if (['retornado', 'finalizado'].includes(val)) {
                  if (!qt1Entrega || qt1Entrega === '0' || qt1Entrega === '') {
                    setQt1Entrega(envio.total_pecas?.toString() ?? '')
                  }
                  if (!retornoReal) {
                    setRetornoReal(new Date().toLocaleDateString('sv-SE'))
                  }
                }
              }}
              className="mt-1.5 w-full rounded-lg px-3 py-2 text-sm focus:outline-none bg-input border border-border text-foreground focus:border-green-600 dark:focus:border-green-500"
            >
              <option value="enviado" className="bg-card text-foreground">Aguardando</option>
              <option value="costurando" className="bg-card text-foreground">Costurando</option>
              <option value="retornado" className="bg-card text-foreground">Pronto para buscar</option>
              <option value="finalizado" className="bg-card text-foreground">Finalizado (Próx: Acabamento)</option>
            </select>
          </div>

          <div>
            <label className="text-xs font-semibold text-muted uppercase tracking-wide">Qt. Retornada na 1ª Entrega</label>
            <Input
              type="number"
              min="0"
              className="mt-1"
              placeholder="0"
              value={qt1Entrega}
              onChange={e => setQt1Entrega(e.target.value)}
            />
          </div>

          <div>
            <label className="text-xs font-semibold text-muted uppercase tracking-wide">
              Data de Retorno Real {['retornado', 'finalizado'].includes(status) ? '*' : ''}
            </label>
            <Input
              type="date"
              className="mt-1"
              value={retornoReal}
              onChange={e => setRetornoReal(e.target.value)}
            />
          </div>

          <div>
            <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Observações</label>
            <textarea
              className="mt-1 w-full rounded-md bg-input border border-border text-foreground p-2 text-sm min-h-[70px] focus:outline-none focus:ring-2 focus:ring-green-600/30"
              placeholder="Observações sobre o retorno..."
              value={observacoes}
              onChange={e => setObservacoes(e.target.value)}
            />
          </div>

          <div className="flex gap-3 pt-2">
            <Button variant="outline" className="flex-1" onClick={onClose} disabled={loading}>
              Cancelar
            </Button>
            <Button
              className="flex-1 bg-green-600 hover:bg-green-700 dark:hover:bg-green-500 text-white"
              onClick={handleSave}
              disabled={loading}
            >
              {loading ? 'Salvando...' : 'Salvar Alterações'}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  )
}
