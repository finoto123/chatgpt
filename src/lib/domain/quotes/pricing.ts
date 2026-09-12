export interface PricingItem {
  quantity: number
  unitPrice: number
  unitCost: number
  discountAmount?: number
}

export interface PricingInput {
  items: PricingItem[]
  discountAmount?: number
  freightAmount?: number
  additionalAmount?: number
}

const money = (value: number) => Math.round((Number.isFinite(value) ? value : 0) * 100) / 100

export function calculateQuotePricing(input: PricingInput) {
  const subtotal = money(input.items.reduce((sum, item) => sum + Math.max(0, item.quantity) * Math.max(0, item.unitPrice) - Math.max(0, item.discountAmount ?? 0), 0))
  const estimatedCost = money(input.items.reduce((sum, item) => sum + Math.max(0, item.quantity) * Math.max(0, item.unitCost), 0))
  const discountAmount = money(Math.min(subtotal, Math.max(0, input.discountAmount ?? 0)))
  const freightAmount = money(Math.max(0, input.freightAmount ?? 0))
  const additionalAmount = money(Math.max(0, input.additionalAmount ?? 0))
  const totalAmount = money(subtotal - discountAmount + freightAmount + additionalAmount)
  const estimatedProfit = money(totalAmount - estimatedCost)
  const discountPercent = subtotal > 0 ? money(discountAmount / subtotal * 100) : 0
  const marginPercent = totalAmount > 0 ? money(estimatedProfit / totalAmount * 100) : 0
  const markup = estimatedCost > 0 ? money(totalAmount / estimatedCost) : null
  return { subtotal, discountAmount, discountPercent, freightAmount, additionalAmount, totalAmount, estimatedCost, estimatedProfit, marginPercent, markup }
}

export function gradeMatchesQuantity(quantity: number, sizes: Array<{ quantity: number }>) {
  return sizes.length === 0 || sizes.every((size) => Number.isInteger(size.quantity) && size.quantity > 0) && sizes.reduce((sum, size) => sum + size.quantity, 0) === quantity
}

export function requiresCommercialApproval(discountPercent: number, discountLimit: number, marginPercent: number, minimumMargin: number) {
  return discountPercent > discountLimit || marginPercent < minimumMargin
}

export function isQuoteExpired(validUntil: string, businessDate: string) {
  return validUntil < businessDate
}
