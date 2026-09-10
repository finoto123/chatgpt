-- Lote 6 — testes transacionais de schema, RLS, regras e dias úteis.
-- Pode ser executado no SQL Editor após a migration. Tudo é revertido ao final.
BEGIN;

INSERT INTO public.feriados(data,nome,tipo) VALUES('2026-09-07','Independência do Brasil','Nacional') ON CONFLICT DO NOTHING;

DO $$
DECLARE missing text[]; exposed text[];
BEGIN
  SELECT array_agg(name) INTO missing FROM unnest(ARRAY['commercial_settings','scoring_rules','automation_rules','automation_runs','opportunity_stage_history','sales_targets','saved_views','notifications']) name
  WHERE to_regclass('public.'||name) IS NULL;
  IF missing IS NOT NULL THEN RAISE EXCEPTION 'Tabelas ausentes: %',missing; END IF;
  SELECT array_agg(c.relname) INTO exposed FROM pg_class c JOIN pg_namespace n ON n.oid=c.relnamespace WHERE n.nspname='public' AND c.relname=ANY(ARRAY['commercial_settings','scoring_rules','automation_rules','automation_runs','opportunity_stage_history','sales_targets','saved_views','notifications']) AND NOT c.relrowsecurity;
  IF exposed IS NOT NULL THEN RAISE EXCEPTION 'RLS ausente: %',exposed; END IF;
  IF has_table_privilege('anon','public.notifications','SELECT') OR has_table_privilege('anon','public.automation_runs','SELECT') THEN RAISE EXCEPTION 'anon recebeu acesso comercial'; END IF;
END $$;

DO $$
DECLARE function_name text;
BEGIN
  FOREACH function_name IN ARRAY ARRAY['get_commercial_central','get_commercial_analytics','get_sales_forecast','get_reactivation_customers','create_reactivation_tasks','save_commercial_settings','save_crm_view','mark_notification_read','recalculate_opportunity_score','set_opportunity_temperature_override','run_commercial_daily_check','win_opportunity'] LOOP
    IF NOT EXISTS(SELECT 1 FROM pg_proc p JOIN pg_namespace n ON n.oid=p.pronamespace WHERE n.nspname='public' AND p.proname=function_name) THEN RAISE EXCEPTION 'RPC ausente: %',function_name; END IF;
  END LOOP;
END $$;

DO $$
DECLARE friday timestamptz:='2026-09-04 12:00:00-03'; next_day timestamptz;
BEGIN
  SELECT public.crm_add_business_days(friday,1) INTO next_day;
  IF (next_day AT TIME ZONE 'America/Sao_Paulo')::date<>'2026-09-08'::date THEN RAISE EXCEPTION 'Dia útil/feriado incorreto: %',next_day; END IF;
  IF (SELECT count(*) FROM public.scoring_rules WHERE active)<10 THEN RAISE EXCEPTION 'Seeds de score incompletos'; END IF;
  IF (SELECT count(*) FROM public.automation_rules)<5 THEN RAISE EXCEPTION 'Seeds de automação incompletos'; END IF;
  IF EXISTS(SELECT name,event,count(*) FROM public.automation_rules GROUP BY name,event HAVING count(*)>1) THEN RAISE EXCEPTION 'Automação duplicada'; END IF;
  IF NOT EXISTS(SELECT 1 FROM public.commercial_settings WHERE id AND warm_lead_threshold<hot_lead_threshold) THEN RAISE EXCEPTION 'Configuração comercial inválida'; END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS(SELECT 1 FROM pg_constraint WHERE conname='opportunity_won_final_value_check') THEN RAISE EXCEPTION 'Constraint de valor final ausente'; END IF;
  IF NOT EXISTS(SELECT 1 FROM pg_indexes WHERE schemaname='public' AND indexname='notifications_user_unread_idx') THEN RAISE EXCEPTION 'Índice de notificações ausente'; END IF;
  IF NOT EXISTS(SELECT 1 FROM pg_indexes WHERE schemaname='public' AND indexname='automation_rules_seed_unique_idx') THEN RAISE EXCEPTION 'Índice idempotente ausente'; END IF;
END $$;

DO $$
DECLARE opportunity_id uuid; first_runs bigint; second_runs bigint;
BEGIN
  SELECT id INTO opportunity_id FROM public.opportunities WHERE status='open' LIMIT 1;
  IF opportunity_id IS NOT NULL THEN
    PERFORM public.crm_recalculate_score_internal(opportunity_id);
    IF NOT EXISTS(SELECT 1 FROM public.opportunities WHERE id=opportunity_id AND score_updated_at IS NOT NULL AND jsonb_typeof(score_breakdown)='array') THEN RAISE EXCEPTION 'Recálculo de score falhou'; END IF;
    PERFORM public.run_commercial_daily_check();
    SELECT count(*) INTO first_runs FROM public.automation_runs;
    PERFORM public.run_commercial_daily_check();
    SELECT count(*) INTO second_runs FROM public.automation_runs;
    IF second_runs<>first_runs THEN RAISE EXCEPTION 'Daily check não foi idempotente: % -> %',first_runs,second_runs; END IF;
  END IF;
END $$;

ROLLBACK;
