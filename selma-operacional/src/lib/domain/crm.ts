export type CrmTaskStatus = 'pending' | 'completed' | 'cancelled'

export function normalizeCrmPhone(value: string | null | undefined): string | null {
  const digits = (value ?? '').replace(/\D/g, '')
  if (!digits) return null
  if (digits.length === 10 || digits.length === 11) return `55${digits}`
  if (digits.startsWith('0') && (digits.length === 11 || digits.length === 12)) return `55${digits.slice(1)}`
  return digits
}

export function normalizeCrmEmail(value: string | null | undefined): string | null {
  const normalized = (value ?? '').trim().toLocaleLowerCase('pt-BR')
  return normalized || null
}

export function daysInStage(stageEnteredAt: string, now = new Date()): number {
  const entered = new Date(stageEnteredAt)
  if (Number.isNaN(entered.getTime())) return 0
  return Math.max(0, Math.floor((now.getTime() - entered.getTime()) / 86_400_000))
}

export function isTaskOverdue(status: CrmTaskStatus, dueAt: string, now = new Date()): boolean {
  return status === 'pending' && new Date(dueAt).getTime() < now.getTime()
}

export function weightedValue(value: number, probability: number): number {
  if (!Number.isFinite(value) || !Number.isFinite(probability)) return 0
  return Math.max(0, value) * Math.min(100, Math.max(0, probability)) / 100
}

export function nextPendingTask<T extends { status: CrmTaskStatus; due_at: string }>(tasks: T[]): T | null {
  return tasks
    .filter((task) => task.status === 'pending')
    .sort((a, b) => new Date(a.due_at).getTime() - new Date(b.due_at).getTime())[0] ?? null
}

export function stageOutcome(stage: { is_won: boolean; is_lost: boolean }, lossReasonId?: string | null) {
  if (stage.is_won) return { status: 'won' as const, valid: true }
  if (stage.is_lost) return { status: 'lost' as const, valid: Boolean(lossReasonId) }
  return { status: 'open' as const, valid: true }
}
