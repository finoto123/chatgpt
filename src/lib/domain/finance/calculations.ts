export function orderTotal(items: Array<{ qtde: number; valor_unitario: number }>): number {
  return items.reduce((sum, item) => sum + (Number(item.qtde) || 0) * (Number(item.valor_unitario) || 0), 0)
}

export function confirmedReceived(payments: Array<{ amount: number; status?: string }>): number {
  return payments.reduce((sum, payment) => sum + (payment.status === 'reversed' ? 0 : Number(payment.amount) || 0), 0)
}

export function balanceDue(total: number, received: number): number {
  return Math.max(0, Number(total) - Number(received))
}

export function paymentStatus(total: number, received: number): 'pendente' | 'parcial' | 'pago' {
  if (total > 0 && received >= total) return 'pago'
  if (received > 0) return 'parcial'
  return 'pendente'
}
