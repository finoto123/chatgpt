import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import test from 'node:test'

const source = readFileSync(
  new URL('./deskcomm-commercial-bridge.ts', import.meta.url),
  'utf8'
)

test('bridge expõe somente os contratos comerciais permitidos', () => {
  for (const method of [
    'findOrCreateSelmaCustomer',
    'createSelmaQuote',
    'getSelmaQuote',
    'getSelmaOrders',
    'getSelmaOrderStatus',
  ]) {
    assert.match(source, new RegExp(`\\b${method}\\b`))
  }
})
test('bridge não expõe mutações de fábrica', () => {
  for (const forbidden of [
    'moveProduction',
    'adjustInventory',
    'releaseProduction',
    'updateCutting',
    'updateEmbroidery',
    'updateDtf',
    'updateSublimation',
    'updateFinance',
  ]) {
    assert.doesNotMatch(source, new RegExp(`\\b${forbidden}\\b`))
  }
})
