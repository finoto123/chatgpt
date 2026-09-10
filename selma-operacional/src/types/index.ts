export type StatusPedido =
  | 'rascunho' | 'aguardando_corte' | 'corte' | 'estamparia' | 'sublimacao' | 'dtf' | 'bordados'
  | 'costura' | 'acabamento' | 'entregue' | 'atrasado' | 'cancelado'

export type SituacaoEstoque = 'OK' | 'ATENÇÃO' | 'COMPRAR'
export type TipoMovimentacao = 'Entrada' | 'Saída'
export type TipoOficina = 'Costura' | 'Bordado' | 'Sublimação' | 'DTF' | 'Silk'
export type TipoVinculo = 'INTERNA' | 'EXTERNA'
export type StatusEnvio = 'enviado' | 'retornado' | 'pago' | 'atraso_retorno' | 'pendente_pagamento'

export interface Vendedor {
  id: string
  nome: string
  comissao_pct: number
  contato: string | null
  created_at: string
}

export interface Oficina {
  id: string
  nome: string
  tipo: TipoOficina
  cidade: string | null
  contato: string | null
  tipo_vinculo: TipoVinculo
  capacidade: Record<string, number>
  created_at: string
}

export interface ItemPedido {
  id: string
  pedido_id: string
  qtde: number
  tamanho: string
  modelo: string
  observacao?: string | null
  tecido_cor?: string | null
  manga?: string | null
  gola?: string | null
  acabamento?: string | null
  valor_unitario: number
  valor_total?: number
}

export interface Cliente {
  id: string
  nome: string
  contato: string | null
  email: string | null
  cidade: string | null
  observacoes: string | null
  created_at: string
  updated_at: string
  total_pedidos?: number
  total_pecas?: number
  valor_total?: number
  data_ultimo_pedido?: string | null
}

export interface Pedido {
  id: string
  numero: string
  cliente: string
  cliente_id: string | null
  vendedor_id: string | null
  data_pedido: string
  tipo_estampa: string | null
  costureira_id: string | null
  costureira?: Oficina
  estampa_oficina_id: string | null
  estampa_oficina?: Oficina
  forma_pagamento: string | null
  fornecedor_tecido: string | null
  valor_entrada: number
  corte_programado: string | null
  corte_retorno: string | null
  estamparia_programado: string | null
  estamparia_retorno: string | null
  sublimacao_programado: string | null
  sublimacao_retorno: string | null
  costura_programado: string | null
  costura_retorno: string | null
  entrega_programado: string
  status: StatusPedido
  corte_cortador: string | null
  corte_inicio_previsto: string | null
  corte_inicio_real: string | null
  corte_fim_previsto: string | null
  corte_fim_real: string | null
  corte_consumo_tecido: number | null
  corte_codigo_ribana: string | null
  corte_consumo_ribana: number | null
  corte_codigo_gola: string | null
  corte_consumo_gola: number | null
  corte_situacao: string | null
  corte_observacoes: string | null
  embalagem_status?: 'aguardando' | 'finalizando' | 'entregue' | null
  embalagem_inicio_real: string | null
  embalagem_fim_real: string | null
  embalagem_data_nf: string | null
  embalagem_numero_nf: string | null
  embalagem_defeitos: string | null
  embalagem_situacao: string | null
  embalagem_observacoes: string | null

  // Sublimação
  sublimacao_status?: 'aguardando_papel' | 'para_estampar' | 'finalizada' | null
  sublimacao_inicio?: string | null
  sublimacao_fim?: string | null
  sublimacao_obs?: string | null

  // Bordados (Módulo 3)
  bordado_status?: 'aguardando_matriz' | 'para_bordar' | 'finalizado'
  bordado_inicio?: string
  bordado_fim?: string
  bordado_obs?: string

  etapas_ativas: string[] | null
  valor_pago_adicional: number | null
  status_pagamento: 'pendente' | 'parcial' | 'pago' | null
  layout_pdf_url: string | null
  observacoes: string | null
  created_at: string
  updated_at: string
  vendedor?: Vendedor
  itens?: ItemPedido[]
  valor_total?: number
  qtde_total?: number
  payments?: Payment[]
}

export interface Payment {
  id: string
  order_id?: string
  amount: number
  payment_method: string
  payment_date: string
  reference?: string | null
  status: 'confirmed' | 'reversed'
  created_at: string
}

export interface Tecido {
  id: string
  codigo: string
  descricao: string
  unidade: string
  fornecedor: string | null
  rendimento_metros: number | null
  estoque_minimo: number
  valor_unitario: number | null
  created_at: string
}

export interface EstoqueAtual extends Tecido {
  estoque_atual: number
  situacao: SituacaoEstoque
}

export interface MovimentacaoEstoque {
  id: string
  tecido_id: string
  data_movimentacao: string
  tipo: TipoMovimentacao
  quantidade: number
  fornecedor: string | null
  numero_nf: string | null
  valor_unitario: number | null
  valor_total_nf: number | null
  observacao: string | null
  created_at: string
  tecido?: Tecido
}

export interface EnvioOficina {
  id: string
  pedido_id: string
  oficina_id: string
  modelo: string | null
  grade_quantidade: Record<string, number>
  total_pecas: number | null
  data_envio: string | null
  valor_unitario: number | null
  valor_total: number | null
  retorno_previsto: string | null
  retorno_real: string | null
  qt_retornada_1a_entrega: number | null
  status: StatusEnvio
  observacoes: string | null
  created_at: string
  pedido?: Pedido
  oficina?: Oficina
}

export interface ConfiguracaoFinanceiro {
  id: string
  meta_anual: number
  despesas_fixas_mensais: number
}

export interface Feriado {
  id: string
  data: string
  nome: string
  tipo: 'Nacional' | 'Municipal' | 'Estadual'
}

export interface DashboardKpis {
  totalPedidosAtivos: number
  totalPecasProducao: number
  totalPecasAtraso: number
  metaMensal: number
}
