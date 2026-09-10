import { z } from 'zod'

export const ETAPAS_ATIVAS = ['corte', 'estampa', 'sublimacao', 'dtf', 'bordados', 'costura', 'acabamento'] as const

export const etapasAtivasSchema = z.array(z.string()).max(ETAPAS_ATIVAS.length).refine(
  (items) => items.every((item) => ETAPAS_ATIVAS.includes(item as typeof ETAPAS_ATIVAS[number])),
  'Etapa inválida',
)

export const itemPedidoSchema = z.object({
  id: z.string().uuid().optional(),
  qtde: z.number().min(1, 'Mínimo 1 peça'),
  tamanho: z.string().min(1, 'Informe o tamanho'),
  modelo: z.string().min(1, 'Informe o modelo'),
  observacao: z.string().optional(),
  tecido_cor: z.string().optional(),
  manga: z.string().optional(),
  gola: z.string().optional(),
  acabamento: z.string().optional(),
  valor_unitario: z.number().min(0, 'Valor não pode ser negativo'),
}).strict()

export const itemPedidoRascunhoSchema = z.object({
  id: z.string().uuid().optional(),
  qtde: z.coerce.number().min(0),
  tamanho: z.string().max(40).optional(),
  modelo: z.string().max(120).optional(),
  tecido_cor: z.string().max(120).optional(),
  manga: z.string().max(80).optional(),
  gola: z.string().max(80).optional(),
  acabamento: z.string().max(120).optional(),
  observacao: z.string().max(1000).optional(),
  valor_unitario: z.coerce.number().min(0),
}).strict()

export const pedidoSchema = z.object({
  id: z.string().uuid().optional(),
  numero: z.string().min(1, 'Número do pedido obrigatório'),
  cliente: z.string().min(2, 'Nome do cliente obrigatório'),
  cliente_id: z.string().uuid().optional().or(z.literal('')),
  vendedor_id: z.string().uuid().optional().or(z.literal('')),
  data_pedido: z.string().min(1, 'Data obrigatória'),
  tipo_estampa: z.string().optional(),
  costureira_id: z.string().uuid().optional().or(z.literal('')),
  estampa_oficina_id: z.string().uuid().optional().or(z.literal('')),
  forma_pagamento: z.string().optional(),
  fornecedor_tecido: z.string().optional(),
  valor_entrada: z.number().min(0),
  corte_programado: z.string().optional(),
  corte_retorno: z.string().optional(),
  estamparia_programado: z.string().optional(),
  estamparia_retorno: z.string().optional(),
  sublimacao_programado: z.string().optional(),
  sublimacao_retorno: z.string().optional(),
  costura_programado: z.string().optional(),
  costura_retorno: z.string().optional(),
  entrega_programado: z.string().min(1, 'Data de entrega obrigatória'),
  etapas_ativas: etapasAtivasSchema.optional(),
  observacoes: z.string().optional(),
  // Somente para exibição no formulário. Server Actions nunca persistem este
  // valor vindo do cliente; o vínculo é feito pelo RPC de upload validado.
  layout_pdf_url: z.string().max(2048).optional(),
  itens: z.array(itemPedidoSchema).min(1, 'Adicione ao menos 1 item'),
}).strict().refine(data => {
  const total = data.itens.reduce((s, i) => s + i.qtde * i.valor_unitario, 0)
  return data.valor_entrada <= total
}, { message: 'Entrada não pode ser maior que o valor total', path: ['valor_entrada'] })
  .superRefine((data, ctx) => {
    const etapas: [string, string][] = [
      ['corte_programado', 'corte_retorno'],
      ['estamparia_programado', 'estamparia_retorno'],
      ['sublimacao_programado', 'sublimacao_retorno'],
      ['costura_programado', 'costura_retorno'],
    ]
    for (const [programadoKey, retornoKey] of etapas) {
      const programado = data[programadoKey as keyof typeof data] as string | undefined
      const retorno = data[retornoKey as keyof typeof data] as string | undefined
      if (programado && retorno && retorno < programado) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: 'Data de retorno não pode ser anterior à data programada',
          path: [retornoKey],
        })
      }
    }
  })

export type PedidoFormValues = z.infer<typeof pedidoSchema>
