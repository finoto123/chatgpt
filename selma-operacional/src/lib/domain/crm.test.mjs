import assert from 'node:assert/strict'
import test from 'node:test'
import { daysInStage, isTaskOverdue, nextPendingTask, normalizeCrmEmail, normalizeCrmPhone, stageOutcome, weightedValue } from './crm.ts'

test('normaliza telefone brasileiro, e-mail e valores vazios', () => {
  assert.equal(normalizeCrmPhone('(17) 99999-9999'), '5517999999999')
  assert.equal(normalizeCrmPhone('+55 17 99999-9999'), '5517999999999')
  assert.equal(normalizeCrmPhone(''), null)
  assert.equal(normalizeCrmEmail('  VENDAS@Exemplo.COM '), 'vendas@exemplo.com')
})

test('calcula dias na etapa e valor ponderado sem produzir negativos', () => {
  assert.equal(daysInStage('2026-09-01T12:00:00Z', new Date('2026-09-04T12:00:00Z')), 3)
  assert.equal(weightedValue(1000, 55), 550)
  assert.equal(weightedValue(-100, 120), 0)
})

test('identifica atraso e a próxima tarefa pendente', () => {
  const tasks = [
    { status: 'completed', due_at: '2026-09-01T10:00:00Z' },
    { status: 'pending', due_at: '2026-09-10T10:00:00Z' },
    { status: 'pending', due_at: '2026-09-08T10:00:00Z' },
  ]
  assert.equal(isTaskOverdue('pending', tasks[2].due_at, new Date('2026-09-09T10:00:00Z')), true)
  assert.equal(nextPendingTask(tasks)?.due_at, '2026-09-08T10:00:00Z')
})

test('ganho, perda e motivo obrigatório seguem as regras do pipeline', () => {
  assert.deepEqual(stageOutcome({ is_won: true, is_lost: false }), { status: 'won', valid: true })
  assert.deepEqual(stageOutcome({ is_won: false, is_lost: true }), { status: 'lost', valid: false })
  assert.deepEqual(stageOutcome({ is_won: false, is_lost: true }, 'reason-id'), { status: 'lost', valid: true })
  assert.equal(weightedValue(10_000, 75), 7_500)
})
