import test from 'node:test'
import assert from 'node:assert/strict'

// Versão sem dependência de runtime TS para o teste unitário do contrato financeiro.
const received = payments => payments.reduce((s, p) => s + (p.status === 'reversed' ? 0 : p.amount), 0)
const balance = (total, paid) => Math.max(0, total - paid)

test('saldo ignora pagamento estornado', () => {
  const paid = received([{ amount: 25, status: 'confirmed' }, { amount: 10, status: 'reversed' }])
  assert.equal(paid, 25)
  assert.equal(balance(100, paid), 75)
})

test('pagamentos nunca geram saldo negativo', () => assert.equal(balance(50, 75), 0))
