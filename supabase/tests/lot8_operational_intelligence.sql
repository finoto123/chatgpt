-- Lote 8 — contrato de schema e smoke tests seguros. Executar em staging após as quatro migrations.
BEGIN;

DO $$
DECLARE missing text; public_leak boolean;
BEGIN
  SELECT string_agg(name,', ') INTO missing FROM unnest(ARRAY[
    'art_approvals','art_access_tokens','technical_sheets','bill_of_materials','bom_items','inventory_reservations',
    'suppliers','purchase_orders','purchase_order_items','purchase_receipts','production_settings','production_workcenters',
    'production_plans','production_routes','production_route_steps'
  ]) name WHERE to_regclass('public.'||name) IS NULL;
  IF missing IS NOT NULL THEN RAISE EXCEPTION 'Tabelas ausentes: %',missing; END IF;

  IF EXISTS(SELECT 1 FROM pg_class WHERE oid=ANY(ARRAY[
    'public.art_approvals'::regclass,'public.art_access_tokens'::regclass,'public.technical_sheets'::regclass,
    'public.bill_of_materials'::regclass,'public.bom_items'::regclass,'public.inventory_reservations'::regclass,
    'public.suppliers'::regclass,'public.purchase_orders'::regclass,'public.purchase_order_items'::regclass,'public.purchase_receipts'::regclass,
    'public.production_settings'::regclass,'public.production_workcenters'::regclass,'public.production_plans'::regclass,
    'public.production_routes'::regclass,'public.production_route_steps'::regclass
  ]) AND NOT relrowsecurity) THEN RAISE EXCEPTION 'RLS ausente em tabela do Lote 8'; END IF;

  SELECT bool_or(has_table_privilege('anon',oid,'SELECT,INSERT,UPDATE,DELETE')) INTO public_leak FROM pg_class WHERE oid=ANY(ARRAY[
    'public.art_approvals'::regclass,'public.technical_sheets'::regclass,'public.bill_of_materials'::regclass,
    'public.inventory_reservations'::regclass,'public.purchase_orders'::regclass,'public.purchase_receipts'::regclass,
    'public.production_plans'::regclass,'public.production_route_steps'::regclass
  ]);
  IF public_leak THEN RAISE EXCEPTION 'anon recebeu privilégio direto em dados internos'; END IF;

  IF public.operational_add_business_days(date '2026-12-31',1,NULL)<>date '2027-01-01'
     AND NOT EXISTS(SELECT 1 FROM public.feriados WHERE data=date '2027-01-01') THEN
    RAISE EXCEPTION 'Cálculo de dia útil inconsistente';
  END IF;

  IF NOT EXISTS(SELECT 1 FROM public.production_workcenters WHERE code IN('cut','sewing','finishing','dispatch') GROUP BY true HAVING count(DISTINCT code)=4) THEN
    RAISE EXCEPTION 'Centros produtivos obrigatórios ausentes';
  END IF;

  IF to_regprocedure('public.create_art_version(uuid,uuid,text,text,numeric,numeric,text,text[],text,text)') IS NULL
    OR to_regprocedure('public.reserve_order_materials(uuid)') IS NULL
    OR to_regprocedure('public.receive_purchase_order(uuid,uuid,text,text,jsonb)') IS NULL
    OR to_regprocedure('public.release_order_to_production(uuid,date,text,uuid)') IS NULL THEN
    RAISE EXCEPTION 'RPC obrigatória ausente';
  END IF;
END $$;

ROLLBACK;
