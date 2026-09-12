export const ORDER_STATUSES = [
  'rascunho', 'aguardando_corte', 'corte', 'estamparia', 'sublimacao',
  'dtf', 'bordados', 'costura', 'acabamento', 'entregue', 'cancelado',
] as const
export type OrderStatus = typeof ORDER_STATUSES[number]

export const ORDER_STATUS_META: Record<OrderStatus, { label: string; order: number; isFinal: boolean; isCancelled: boolean }> = {
  rascunho: { label: 'Rascunho', order: 0, isFinal: false, isCancelled: false },
  aguardando_corte: { label: 'Aguardando corte', order: 1, isFinal: false, isCancelled: false },
  corte: { label: 'Corte', order: 2, isFinal: false, isCancelled: false },
  estamparia: { label: 'Estamparia', order: 3, isFinal: false, isCancelled: false },
  sublimacao: { label: 'Sublimação', order: 4, isFinal: false, isCancelled: false },
  dtf: { label: 'DTF', order: 5, isFinal: false, isCancelled: false },
  bordados: { label: 'Bordados', order: 6, isFinal: false, isCancelled: false },
  costura: { label: 'Costura', order: 7, isFinal: false, isCancelled: false },
  acabamento: { label: 'Acabamento', order: 8, isFinal: false, isCancelled: false },
  entregue: { label: 'Entregue', order: 9, isFinal: true, isCancelled: false },
  cancelado: { label: 'Cancelado', order: 10, isFinal: true, isCancelled: true },
}

export function isOrderLate(status: string, dueDate: string | null | undefined, today: string): boolean {
  return Boolean(dueDate && dueDate < today && status in ORDER_STATUS_META && !ORDER_STATUS_META[status as OrderStatus].isFinal)
}

export function totalPieces(items: Array<{ qtde?: number | null }>): number {
  return items.reduce((sum, item) => sum + Math.max(0, Number(item.qtde) || 0), 0)
}
