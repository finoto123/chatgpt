import assert from 'node:assert/strict'
import { readFileSync,readdirSync } from 'node:fs'
import test from 'node:test'
import {
  INITIAL_ROLE_PERMISSIONS,
  PERMISSION_CODES,
  canAccess,
} from './rbac.ts'

const context = (role, active = true) => ({
  active,
  permissions: INITIAL_ROLE_PERMISSIONS[role],
})

test('administrador possui todas as permissões explicitamente', () => {
  assert.equal(PERMISSION_CODES.length, 40)
  assert.deepEqual(INITIAL_ROLE_PERMISSIONS.administrator, PERMISSION_CODES)
})

test('anônimo e usuário inativo não são autorizados', () => {
  assert.equal(canAccess(null, 'orders.view'), false)
  assert.equal(canAccess(context('administrator', false), 'orders.view'), false)
})

test('produção não acessa financeiro', () => {
  assert.equal(canAccess(context('production'), 'production.update'), true)
  assert.equal(canAccess(context('production'), 'finance.view'), false)
})

test('financeiro não altera produção', () => {
  assert.equal(canAccess(context('finance'), 'finance.update'), true)
  assert.equal(canAccess(context('finance'), 'production.update'), false)
})

test('estoque ajusta estoque e vendedor não gerencia usuários', () => {
  assert.equal(canAccess(context('inventory'), 'inventory.adjust'), true)
  assert.equal(canAccess(context('salesperson'), 'users.manage'), false)
})

test('migrations e aplicacao possuem as mesmas 40 permissoes', () => {
  const directory = new URL('../../../supabase/migrations/', import.meta.url)
  const migration = readdirSync(directory).filter(name=>name.endsWith('.sql')).map(name=>readFileSync(new URL(name,directory),'utf8')).join('\n')
  const sqlCodes = [...new Set([...migration.matchAll(/\('([a-z][a-z0-9_]*\.[a-z][a-z0-9_]*)'\s*,\s*'[^']*'\s*,\s*'[a-z]+'/g)].map(match=>match[1]))]
  assert.deepEqual(sqlCodes.sort(), [...PERMISSION_CODES].sort())
})
