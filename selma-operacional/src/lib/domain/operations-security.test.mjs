import assert from 'node:assert/strict'
import {readFileSync} from 'node:fs'
import test from 'node:test'

const migration=name=>readFileSync(new URL(`../../../supabase/migrations/${name}`,import.meta.url),'utf8')
const art=migration('202609100001_art_and_technical_sheet.sql')
const materials=migration('202609100002_material_planning.sql')
const purchasing=migration('202609100003_purchasing.sql')
const planning=migration('202609100004_production_capacity.sql')
const actions=readFileSync(new URL('../../app/operacional/actions.ts',import.meta.url),'utf8')
const publicPage=readFileSync(new URL('../../components/operations/PublicArtApproval.tsx',import.meta.url),'utf8')

test('tabelas operacionais internas habilitam RLS e removem anon',()=>{
  for(const [sql,tables] of [[art,['art_approvals','art_access_tokens','technical_sheets']],[materials,['bill_of_materials','bom_items','inventory_reservations']],[purchasing,['suppliers','purchase_orders','purchase_order_items','purchase_receipts']],[planning,['production_settings','production_workcenters','production_plans','production_routes','production_route_steps']]])for(const table of tables){assert.match(sql,new RegExp(`ALTER TABLE public\\.${table} ENABLE ROW LEVEL SECURITY`));assert.match(sql,new RegExp(`REVOKE ALL ON[\\s\\S]{0,240}public\\.${table}`))}
})

test('RPCs privilegiadas fixam search_path e conferem autenticação/permissão',()=>{
  for(const sql of [art,materials,purchasing,planning]){for(const block of sql.matchAll(/CREATE OR REPLACE FUNCTION[\s\S]*?END \$\$;/g)){if(block[0].includes('SECURITY DEFINER')){assert.match(block[0],/SET search_path=pg_catalog,public/);if(!block[0].includes('RETURNS trigger')&&!block[0].includes('get_public_art')&&!block[0].includes('record_art_view')&&!block[0].includes('respond_to_art')&&!block[0].includes('approve_art_version')&&!block[0].includes('insert_production_step')&&!block[0].includes('invalidate_'))assert.match(block[0],/auth\.uid\(\) IS NULL/)}}}
})

test('aprovação pública usa hash, expiração, versão vigente e DTO sem custos',()=>{
  assert.match(art,/token_hash=encode\(extensions\.digest\(p_token,'sha256'\),'hex'\)/)
  assert.match(art,/expires_at>now\(\)/)
  assert.match(art,/newer\.version_number>art\.version_number/)
  const dto=art.match(/CREATE OR REPLACE FUNCTION public\.get_public_art[\s\S]*?END \$\$;/)?.[0]??''
  for(const secret of ['estimated_cost','profit','margin','internal_notes','token_hash'])assert.doesNotMatch(dto,new RegExp(`'${secret}'`))
  assert.doesNotMatch(publicPage,/internal_notes|estimated_cost|margin_percent|profit/)
})

test('upload de arte valida arquivo no servidor e remove órfão quando a RPC falha',()=>{
  assert.match(actions,/validateLayoutFile\(/)
  assert.match(actions,/createArtStoragePath\(/)
  assert.match(actions,/if\(error\|\|!data\)\{await admin\.storage\.from\(LAYOUT_BUCKET\)\.remove/)
})

test('BOM calcula a necessidade no servidor e reserva com locks sem saldo negativo',()=>{
  assert.match(materials,/required:=round\(order_quantity\*\(item->>'quantity_per_unit'\)::numeric\*\(1\+\(item->>'waste_percent'\)::numeric\/100\),4\)/)
  assert.match(materials,/FROM public\.tecidos WHERE id=req\.fabric_id FOR UPDATE/)
  assert.match(materials,/add_quantity:=LEAST\(GREATEST\(req\.required_quantity-already,0\),free\)/)
  assert.match(materials,/inventory_reservation_active_bom_idx/)
})

test('recebimento é parcial, idempotente e alimenta o ledger de estoque',()=>{
  assert.match(purchasing,/operation_id uuid NOT NULL UNIQUE/)
  assert.match(purchasing,/WHERE operation_id=p_operation_id/)
  assert.match(purchasing,/record_inventory_movement\(/)
  assert.match(purchasing,/CASE WHEN all_received THEN 'received' ELSE 'partial' END/)
})

test('liberação exige todos os gates e justificativa de antecipação',()=>{
  for(const gate of ['art_pending','technical_sheet_missing','bom_missing','materials_unreserved','route_missing','plan_missing'])assert.match(planning,new RegExp(gate))
  assert.match(planning,/p_committed_date<plan\.safe_delivery_date AND length\(trim\(COALESCE\(p_override_reason,''\)\)\)<5/)
  assert.match(planning,/order-released-/)
})

test('Lote 8 não cria pagamento nem altera status financeiro',()=>{
  const all=[art,materials,purchasing,planning].join('\n')
  assert.doesNotMatch(all,/INSERT INTO public\.payments|status_pagamento\s*=/i)
})
