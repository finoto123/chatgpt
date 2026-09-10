'use client'
import { useState, useTransition, useEffect } from 'react'
import { useForm, useWatch } from 'react-hook-form'
import { toast } from 'sonner'
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { registrarEnvioDtf } from '@/app/dtf/actions'

const TAMANHOS = ['PP', 'P', 'M', 'G', 'GG', 'G1', 'G2', 'G3', 'G4', 'EG']

export function RegistrarEnvioDtfDrawer({
  aberto, onClose, pedidos, oficinas,
}: {
  aberto: boolean
  onClose: () => void
  pedidos: { id: string; numero: string; cliente: string }[]
  oficinas: { id: string; nome: string; tipo?: string }[]
}) {
  const [preenchimentoAuto, setPreenchimentoAuto] = useState(true)
  const [grade, setGrade] = useState<Record<string, number>>({})
  const [totalPecas, setTotalPecas] = useState(0)
  const [isPending, startTransition] = useTransition()

  const { register, handleSubmit, control, reset, formState: { errors } } = useForm({
    defaultValues: {
      pedido_id: '', oficina_id: '', data_envio: '', retorno_previsto: '',
      valor_unitario: 0, observacoes: '',
    },
  })

  const pedidoSelecionado = useWatch({ control, name: 'pedido_id' })

  useEffect(() => {
    if (!preenchimentoAuto || !pedidoSelecionado) return
    fetch(`/api/pedidos/${pedidoSelecionado}/grade`)
      .then(r => r.json())
      .then(({ grade: g, total }) => {
        setGrade(g ?? {})
        setTotalPecas(total ?? 0)
      })
      .catch(() => toast.error('Erro ao buscar grade do pedido'))
  }, [pedidoSelecionado, preenchimentoAuto])

  const atualizarGrade = (tam: string, val: number) => {
    const novaGrade = { ...grade, [tam]: val }
    setGrade(novaGrade)
    setTotalPecas(Object.values(novaGrade).reduce((s, v) => s + v, 0))
  }

  const onSubmit = (values: {
    pedido_id: string
    oficina_id: string
    data_envio: string
    retorno_previsto: string
    valor_unitario: number
    observacoes: string
  }) => {
    const gradeValida: Record<string, number> = {}
    Object.entries(grade).forEach(([k, v]) => { if (Number(v) > 0) gradeValida[k] = Number(v) })

    if (Object.keys(gradeValida).length === 0) {
      toast.error('Preencha ao menos 1 tamanho na grade')
      return
    }

    startTransition(async () => {
      const result = await registrarEnvioDtf({ ...values, grade_quantidade: gradeValida, preenchimento_auto: preenchimentoAuto })
      if (result?.error) {
        const msgs = typeof result.error === 'string'
          ? result.error
          : Object.values(result.error.fieldErrors ?? {}).flat().join(', ')
        toast.error(msgs || 'Erro ao registrar envio')
      } else {
        toast.success('Envio DTF registrado!')
        reset()
        setGrade({})
        setTotalPecas(0)
        onClose()
      }
    })
  }

  const INPUT = "w-full bg-input border border-border rounded-lg px-3 py-2 text-sm text-foreground focus:outline-none focus:border-green-600 dark:focus:border-green-500 placeholder-muted"
  const LABEL = "text-xs text-muted mb-1 block uppercase tracking-wide font-medium"

  const oficinasDtf = oficinas.filter(o => o.tipo === 'DTF')

  return (
    <Dialog open={aberto} onOpenChange={onClose}>
      <DialogContent className="bg-card border border-border max-w-5xl w-[95vw] h-[90vh] flex flex-col p-0 overflow-hidden">
        <DialogHeader className="px-6 py-5 border-b border-border shrink-0">
          <DialogTitle className="text-xl font-bold text-foreground">Registrar Envio DTF</DialogTitle>
        </DialogHeader>

        <div className="flex-1 overflow-y-auto px-6 py-4">
          <form id="dtf-form" onSubmit={handleSubmit(onSubmit)} className="space-y-6">
          {/* Pedido */}
          <div>
            <label className={LABEL}>PEDIDO *</label>
            <select {...register('pedido_id')} className={INPUT}>
              <option value="">Selecione o pedido</option>
              {pedidos.map(p => (
                <option key={p.id} value={p.id}>#{p.numero} — {p.cliente}</option>
              ))}
            </select>
            {errors.pedido_id && <p className="text-red-400 text-xs mt-1">{String(errors.pedido_id.message)}</p>}
          </div>

          {/* Oficina */}
          <div>
            <label className={LABEL}>OFICINA (Apenas tipo DTF)</label>
            <select {...register('oficina_id')} className={INPUT}>
              <option value="">Selecione a oficina (opcional)</option>
              {oficinasDtf.map(o => (
                <option key={o.id} value={o.id}>{o.nome}</option>
              ))}
            </select>
            {oficinasDtf.length === 0 && (
              <p className="text-yellow-500 text-xs mt-1">
                Nenhuma oficina com tipo &quot;DTF&quot; foi encontrada nos cadastros.
              </p>
            )}
          </div>

          {/* Toggle Auto/Manual */}
          <div>
            <label className={LABEL}>GRADE DE QUANTIDADES</label>
            <div className="flex items-center gap-3 mb-3">
              <button type="button" onClick={() => setPreenchimentoAuto(!preenchimentoAuto)}
                className={`px-3 py-1.5 rounded-full text-xs font-medium border transition-all ${
                  preenchimentoAuto
                    ? 'bg-green-600 text-white border-green-600 hover:bg-green-700'
                    : 'text-gray-500 dark:text-gray-400 border-border hover:border-gray-400 dark:hover:border-gray-500'
                }`}>
                {preenchimentoAuto ? '⚡ Automático' : '✏️ Manual'}
              </button>
              <span className="text-xs text-gray-600">
                {preenchimentoAuto
                  ? 'Grade do pedido selecionado'
                  : 'Preencha manualmente'}
              </span>
            </div>

            {/* Grade de tamanhos */}
            <div className="grid grid-cols-3 gap-2">
                {TAMANHOS.map(tam => (
                  <div key={tam} className="flex items-center gap-2">
                    <span className="text-xs text-gray-400 w-8 flex-shrink-0">{tam}</span>
                    <input
                      type="number" min={0} value={grade[tam] ?? ''}
                      onChange={e => atualizarGrade(tam, Number(e.target.value))}
                      readOnly={preenchimentoAuto && !!pedidoSelecionado}
                      className={`w-full bg-input border rounded px-2 py-1.5 text-sm text-center text-foreground focus:outline-none ${
                        preenchimentoAuto && pedidoSelecionado
                          ? 'border-border text-muted cursor-not-allowed'
                          : 'border-border focus:border-green-600 dark:focus:border-green-500'
                      }`}
                    />
                  </div>
                ))}
            </div>
            <p className="text-xs text-muted mt-2">
              Total: <strong className="text-foreground">{totalPecas} peças</strong>
            </p>
          </div>

          {/* Datas */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className={LABEL}>DATA DE ENVIO *</label>
              <input type="date" {...register('data_envio')} className={INPUT} />
              {errors.data_envio && <p className="text-red-400 text-xs mt-1">{String(errors.data_envio.message)}</p>}
            </div>
            <div>
              <label className={LABEL}>RETORNO PREVISTO *</label>
              <input type="date" {...register('retorno_previsto')} className={INPUT} />
              {errors.retorno_previsto && <p className="text-red-400 text-xs mt-1">{String(errors.retorno_previsto.message)}</p>}
            </div>
          </div>

          {/* Observações */}
          <div>
            <label className={LABEL}>OBSERVAÇÕES</label>
            <textarea rows={2} placeholder="Observações..." {...register('observacoes')}
              className={`${INPUT} resize-none`} />
          </div>
        </form>
        </div>

        <div className="px-6 py-4 border-t border-border bg-surface flex justify-end gap-3 shrink-0">
          <button type="button" onClick={onClose} className="px-5 py-2.5 text-sm text-muted hover:text-foreground transition-colors">
            Cancelar
          </button>
          <button type="submit" form="dtf-form" disabled={isPending}
            className="px-6 py-2.5 bg-green-600 text-white rounded-lg text-sm font-medium hover:bg-green-700 disabled:opacity-50 transition-colors">
            {isPending ? 'Salvando...' : 'Salvar Registro →'}
          </button>
        </div>
      </DialogContent>
    </Dialog>
  )
}
