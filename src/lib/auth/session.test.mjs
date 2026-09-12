import assert from 'node:assert/strict'
import test from 'node:test'
import { readFileSync } from 'node:fs'
import {
  DEFAULT_AUTHENTICATED_PATH,
  hasSupabaseAuthCookie,
  sanitizeNextPath,
} from './session.ts'

test('mantém somente destinos internos seguros', () => {
  assert.equal(sanitizeNextPath('/pedidos?status=aberto#lista'), '/pedidos?status=aberto#lista')
  assert.equal(sanitizeNextPath('https://evil.example'), DEFAULT_AUTHENTICATED_PATH)
  assert.equal(sanitizeNextPath('//evil.example'), DEFAULT_AUTHENTICATED_PATH)
  assert.equal(sanitizeNextPath('/\\evil.example'), DEFAULT_AUTHENTICATED_PATH)
  assert.equal(sanitizeNextPath('///evil.example/path'), DEFAULT_AUTHENTICATED_PATH)
  assert.equal(sanitizeNextPath('/%5cevil.example'), DEFAULT_AUTHENTICATED_PATH)
  assert.equal(sanitizeNextPath('javascript:alert(1)'), DEFAULT_AUTHENTICATED_PATH)
  assert.equal(sanitizeNextPath('https:%2f%2fevil.example'), DEFAULT_AUTHENTICATED_PATH)
  assert.equal(sanitizeNextPath('/login'), DEFAULT_AUTHENTICATED_PATH)
})

test('reconhece cookies Supabase inteiros e fragmentados', () => {
  assert.equal(hasSupabaseAuthCookie(['theme', 'sb-project-auth-token']), true)
  assert.equal(hasSupabaseAuthCookie(['sb-project-auth-token.1']), true)
  assert.equal(hasSupabaseAuthCookie(['theme', 'session']), false)
})

test('proposta pública possui exceção restrita no proxy', () => {
  const source = readFileSync(new URL('../supabase/proxy.ts', import.meta.url), 'utf8')
  assert.match(source, /pathname\.startsWith\('\/proposta\/'\)/)
  assert.doesNotMatch(source, /pathname\.startsWith\('\/crm'/)
})

test('proxy cobre APIs e responde 401 em vez de redirecionar JSON', () => {
  const proxy = readFileSync(new URL('../supabase/proxy.ts', import.meta.url), 'utf8')
  const entrypoint = readFileSync(new URL('../../proxy.ts', import.meta.url), 'utf8')
  assert.match(entrypoint, /matcher: \[/)
  assert.doesNotMatch(entrypoint, /\(\?!api\|/)
  assert.match(proxy, /isApiRoute/)
  assert.match(proxy, /NextResponse\.json\(/)
  assert.match(proxy, /status: 401/)
})
