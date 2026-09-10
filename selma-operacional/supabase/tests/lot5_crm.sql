-- Teste transacional do Lote 5. Execute com um usuário autenticado de homologação.
BEGIN;

DO $$
DECLARE
  v_pipeline uuid;
  v_first_stage uuid;
  v_lost_stage uuid;
BEGIN
  SELECT id INTO v_pipeline FROM public.pipelines WHERE code='commercial';
  SELECT id INTO v_first_stage FROM public.pipeline_stages WHERE pipeline_id=v_pipeline AND code='new_lead';
  SELECT id INTO v_lost_stage FROM public.pipeline_stages WHERE pipeline_id=v_pipeline AND code='lost';
  IF v_pipeline IS NULL OR v_first_stage IS NULL OR v_lost_stage IS NULL THEN
    RAISE EXCEPTION 'seed do pipeline incompleto';
  END IF;
  IF (SELECT probability FROM public.pipeline_stages WHERE id=v_first_stage)<>5 THEN
    RAISE EXCEPTION 'probabilidade inicial incorreta';
  END IF;
END $$;

DO $$
BEGIN
  IF public.crm_normalize_phone('(17) 99999-9999') <> '5517999999999' THEN
    RAISE EXCEPTION 'normalização de telefone incorreta';
  END IF;
END $$;

DO $$
BEGIN
  IF pg_get_functiondef('public.convert_lead(uuid,uuid,boolean,boolean,boolean,text)'::regprocedure) NOT LIKE '%FOR UPDATE%' THEN
    RAISE EXCEPTION 'convert_lead não bloqueia o lead para garantir atomicidade';
  END IF;
  IF pg_get_functiondef('public.move_opportunity_stage(uuid,uuid,uuid,text,text,timestamptz)'::regprocedure) NOT LIKE '%40001%' THEN
    RAISE EXCEPTION 'move_opportunity_stage não possui proteção de concorrência';
  END IF;
END $$;

DO $$
DECLARE table_name text;
BEGIN
  FOREACH table_name IN ARRAY ARRAY['contacts','lead_sources','leads','pipelines','pipeline_stages','opportunities','loss_reasons','tags','opportunity_tags','activities','tasks'] LOOP
    IF NOT EXISTS (SELECT 1 FROM pg_class c JOIN pg_namespace n ON n.oid=c.relnamespace WHERE n.nspname='public' AND c.relname=table_name AND c.relrowsecurity) THEN
      RAISE EXCEPTION 'RLS ausente em %',table_name;
    END IF;
  END LOOP;
END $$;

-- As RPCs de conversão, mudança de etapa, tarefa e reabertura exigem auth.uid(),
-- permissões CRM e dados reais de homologação. O bloco abaixo confirma que não são públicas.
DO $$
BEGIN
  IF has_function_privilege('anon','public.convert_lead(uuid,uuid,boolean,boolean,boolean,text)','EXECUTE') THEN
    RAISE EXCEPTION 'anon não pode executar convert_lead';
  END IF;
  IF has_function_privilege('anon','public.move_opportunity_stage(uuid,uuid,uuid,text,text,timestamptz)','EXECUTE') THEN
    RAISE EXCEPTION 'anon não pode mover oportunidades';
  END IF;
END $$;

ROLLBACK;
