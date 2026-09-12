import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import test from 'node:test'
import {
  LAYOUT_MAX_BYTES,
  createLayoutStoragePath,
  validateLayoutFile,
} from './upload.ts'

function source(relativePath) {
  return readFileSync(new URL(`../../../${relativePath}`, import.meta.url), 'utf8')
}

test('valida magic bytes, MIME, extensão e limite do layout', () => {
  const pdf = new Uint8Array([0x25, 0x50, 0x44, 0x46, 0x2d, 0x31])
  assert.equal(validateLayoutFile('layout.pdf', 'application/pdf', pdf.length, pdf).ok, true)
  assert.equal(validateLayoutFile('layout.pdf', 'application/pdf', pdf.length, new Uint8Array([0x4d, 0x5a])).ok, false)
  assert.equal(validateLayoutFile('layout.exe', 'application/octet-stream', 2, new Uint8Array([0x4d, 0x5a])).ok, false)
  assert.equal(validateLayoutFile('layout.pdf', 'image/png', pdf.length, pdf).ok, false)
  assert.equal(validateLayoutFile('layout.pdf', 'application/pdf', LAYOUT_MAX_BYTES + 1, pdf).ok, false)
})

test('path gerado ignora nome original e impede path traversal', () => {
  const orderId = '11111111-1111-4111-8111-111111111111'
  const path = createLayoutStoragePath(orderId, 'pdf')
  assert.match(path, /^11111111-1111-4111-8111-111111111111\/[0-9a-f-]{36}\.pdf$/)
  assert.doesNotMatch(path, /\.\.|evil|\\/)
})

test('audit log é append-only, sanitizado e protegido por audit.view', () => {
  const migration = source('supabase/migrations/202609070001_audit_storage_security.sql')
  assert.match(migration, /CREATE TABLE IF NOT EXISTS public\.audit_logs/)
  assert.match(migration, /public\.has_permission\('audit\.view'\)/)
  assert.doesNotMatch(migration, /CREATE POLICY audit_logs_(?:update|delete|insert)/)
  assert.match(migration, /sanitize_audit_json/)
  assert.match(migration, /password\|senha\|token\|secret/)
  assert.match(migration, /CREATE TRIGGER audit_/)
})

test('fallback administrativo de auditoria aceita somente login e logout do próprio usuário', () => {
  const audit = source('src/lib/audit/audit.ts')
  assert.match(audit, /\['auth\.login', 'auth\.logout'\]\.includes\(input\.action\)/)
  assert.match(audit, /input\.entityType !== 'user'/)
  assert.match(audit, /input\.entityId !== input\.userId/)
  assert.match(audit, /source: 'application_admin_fallback'/)
})

test('Storage nega anônimo e signed URL exige orders.view', () => {
  const migration = source('supabase/migrations/202609070001_audit_storage_security.sql')
  const storage = source('src/lib/security/storage.ts')
  assert.match(migration, /'pedidos-layouts', 'pedidos-layouts', false/)
  assert.match(migration, /FOR SELECT TO authenticated/)
  assert.doesNotMatch(migration, /FOR SELECT TO anon/)
  assert.match(storage, /requirePermission\('orders\.view'\)/)
  assert.match(storage, /createSignedUrl\(path, SIGNED_LAYOUT_TTL_SECONDS\)/)
})

test('actions críticas não devolvem mensagens brutas do Supabase', () => {
  const actionFiles = [
    'src/app/clientes/actions.ts',
    'src/app/pedidos/actions.ts',
    'src/app/estoque/actions.ts',
    'src/app/dashboard/actions.ts',
    'src/app/producao/actions.ts',
    'src/app/oficinas/actions.ts',
    'src/app/dtf/actions.ts',
    'src/app/sublimacao/actions.ts',
  ]
  for (const path of actionFiles) {
    assert.doesNotMatch(source(path), /return\s+\{\s*error:\s*\w+Error?\.message/)
  }
})

test('schemas críticos rejeitam mass assignment', () => {
  assert.match(source('src/lib/schemas/pedido.ts'), /\}\)\.strict\(\)\.refine/)
  assert.match(source('src/app/clientes/actions.ts'), /clienteSchema[\s\S]*?\}\)\.strict\(\)/)
  assert.match(source('src/app/estoque/actions.ts'), /editarTecidoSchema[\s\S]*?\}\)\.strict\(\)/)
  assert.doesNotMatch(source('src/app/clientes/actions.ts'), /\.insert\(\{\s*\.\.\.data/)
})

test('PDF.js rejeita JavaScript actions e não habilita scripting', () => {
  const renderer = source('src/components/print/PdfLayoutCanvas.tsx')
  assert.match(renderer, /pdf\.getJSActions\(\)/)
  assert.match(renderer, /page\.getJSActions\(\)/)
  assert.doesNotMatch(renderer, /enableScripting:\s*true/)
})
