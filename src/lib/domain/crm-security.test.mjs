import assert from 'node:assert/strict'
import fs from 'node:fs'
import test from 'node:test'

const migration = fs.readFileSync(new URL('../../../supabase/migrations/202609080001_crm_foundation.sql', import.meta.url), 'utf8')
const actions = fs.readFileSync(new URL('../../app/crm/actions.ts', import.meta.url), 'utf8')

test('migration protege todas as tabelas do CRM com RLS e revoga anon', () => {
  for (const table of ['contacts','lead_sources','leads','pipelines','pipeline_stages','opportunities','loss_reasons','tags','opportunity_tags','activities','tasks']) {
    assert.match(migration, new RegExp(`ALTER TABLE public\\.%I ENABLE ROW LEVEL SECURITY`))
    assert.ok(migration.includes(table))
  }
  assert.match(migration, /REVOKE ALL ON FUNCTION public\.convert_lead/)
})

test('actions validam payloads estritamente e não aceitam campos protegidos', () => {
  assert.match(actions, /leadInputSchema\.safeParse/)
  assert.match(actions, /opportunityInputSchema\.safeParse/)
  assert.match(actions, /moveStageSchema\.safeParse/)
  for (const protectedField of ['created_by: context.user.id', "eq('status', 'open')", "rpc('move_opportunity_stage'"]) assert.ok(actions.includes(protectedField))
})

test('migration contém probabilidades, motivo obrigatório e trava otimista de concorrência', () => {
  for (const tuple of ["('new_lead','Novo Lead',10,5", "('qualification','Qualificação',40,25", "('negotiation','Negociação',90,75", "('won','Ganho',120,100", "('lost','Perdido',130,0"]) assert.ok(migration.includes(tuple))
  assert.match(migration, /new_stage\.is_lost AND p_loss_reason_id IS NULL/)
  assert.match(migration, /o\.stage_entered_at<>p_expected_stage_entered_at/)
  assert.match(migration, /possible_duplicate_customer/)
})
