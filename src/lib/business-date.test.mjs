import test from 'node:test'
import assert from 'node:assert/strict'

function businessDate(now) {
  const parts = new Intl.DateTimeFormat('en-CA', { timeZone: 'America/Sao_Paulo', year: 'numeric', month: '2-digit', day: '2-digit' })
    .formatToParts(now).reduce((a, p) => (a[p.type] = p.value, a), {})
  return `${parts.year}-${parts.month}-${parts.day}`
}

test('data comercial respeita virada UTC para São Paulo', () => {
  assert.equal(businessDate(new Date('2026-09-07T03:30:00Z')), '2026-09-07')
  assert.equal(businessDate(new Date('2026-09-07T02:30:00Z')), '2026-09-06')
})
