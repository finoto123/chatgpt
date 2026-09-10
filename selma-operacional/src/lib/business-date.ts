/** Datas de negócio usam o fuso da operação, não UTC do servidor/navegador. */
export const BUSINESS_TIME_ZONE = 'America/Sao_Paulo'

export function todayBusinessDate(now: Date = new Date()): string {
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone: BUSINESS_TIME_ZONE,
    year: 'numeric', month: '2-digit', day: '2-digit',
  }).formatToParts(now).reduce<Record<string, string>>((acc, part) => { acc[part.type] = part.value; return acc }, {})
  return `${parts.year}-${parts.month}-${parts.day}`
}

export function formatBusinessDate(value: string | Date | null | undefined): string {
  if (!value) return ''
  const date = typeof value === 'string' ? new Date(`${value.slice(0, 10)}T12:00:00`) : value
  return new Intl.DateTimeFormat('pt-BR', { timeZone: BUSINESS_TIME_ZONE }).format(date)
}

export function parseBusinessDate(value: string): Date {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) throw new Error('Data de negócio inválida')
  return new Date(`${value}T12:00:00-03:00`)
}
