import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { etapasAtivasSchema, itemPedidoRascunhoSchema } from './pedido.ts'

test('rascunho aceita a etapa agrupadora de estampa usada pelo formulário', () => {
  assert.equal(etapasAtivasSchema.safeParse(['corte', 'estampa', 'costura']).success, true)
  assert.equal(etapasAtivasSchema.safeParse(['corte', 'etapa_inventada']).success, false)
})

test('rascunho aceita o id do item existente sem aceitar metadados do banco', () => {
  const item = {
    id: '11111111-1111-4111-8111-111111111111',
    qtde: 1,
    tamanho: 'M',
    modelo: 'Camiseta',
    valor_unitario: 52,
  }
  assert.equal(itemPedidoRascunhoSchema.safeParse(item).success, true)
  assert.equal(itemPedidoRascunhoSchema.safeParse({ ...item, pedido_id: item.id }).success, false)
})

test('salvamento usa a RPC exclusiva de rascunhos e preserva IDs de itens', () => {
  const action = readFileSync(new URL('../../app/pedidos/actions.ts', import.meta.url), 'utf8')
  const migration = readFileSync(
    new URL('../../../supabase/migrations/202609090002_order_draft_persistence.sql', import.meta.url),
    'utf8',
  )

  assert.match(action, /supabase\.rpc\('save_order_draft'/)
  assert.doesNotMatch(action, /\{ id: _itemId, \.\.\.item \}/)
  assert.match(migration, /WHERE id = v_item_id AND pedido_id = v_order_id/)
  assert.match(migration, /AND NOT \(id = ANY\(v_kept_item_ids\)\)/)
})

test('rascunho não depende de número pré-gerado nem dispara recálculo comercial', () => {
  const action = readFileSync(new URL('../../app/pedidos/actions.ts', import.meta.url), 'utf8')
  const drawer = readFileSync(new URL('../../components/pedidos/NovoPedidoDrawer.tsx', import.meta.url), 'utf8')
  const migration = readFileSync(
    new URL('../../../supabase/migrations/202609090003_order_draft_stability.sql', import.meta.url),
    'utf8',
  )

  assert.match(action, /numero: z\.string\(\)\.optional\(\)\.default\(''\)/)
  const draftHandler = drawer.slice(
    drawer.indexOf('async function handleSalvarRascunho'),
    drawer.indexOf('if (!isAuthorized)'),
  )
  assert.doesNotMatch(draftHandler, /gerarProximoNumeroPedido\(\)/)
  assert.match(migration, /NEW\.status NOT IN \('rascunho', 'cancelado'\)/)
  assert.match(migration, /IF NOT old_counts AND NOT new_counts THEN[\s\S]*RETURN NEW/)
})
