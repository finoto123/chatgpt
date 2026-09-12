-- Lote 6 — Inteligência comercial e gestão do funil.
-- Incremental sobre o Lote 5. Aplicar primeiro em staging/homologação.

-- Repara a fundação de auditoria quando o banco real não recebeu integralmente
-- a migration do Lote 3. Nenhum registro existente é removido.
DROP FUNCTION IF EXISTS public.write_audit_log(uuid,text,text,text,jsonb,jsonb,jsonb);
DROP FUNCTION IF EXISTS public.write_audit_log(uuid,text,name,text,jsonb,jsonb,jsonb);
CREATE TABLE IF NOT EXISTS public.audit_logs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(), user_id uuid, action text,
  entity_type text, entity_id text, old_values jsonb, new_values jsonb,
  metadata jsonb DEFAULT '{}'::jsonb, ip_address text, user_agent text,
  created_at timestamptz DEFAULT now()
);
ALTER TABLE public.audit_logs ADD COLUMN IF NOT EXISTS id uuid DEFAULT gen_random_uuid();
ALTER TABLE public.audit_logs ADD COLUMN IF NOT EXISTS user_id uuid;
ALTER TABLE public.audit_logs ADD COLUMN IF NOT EXISTS action text;
ALTER TABLE public.audit_logs ADD COLUMN IF NOT EXISTS entity_type text;
ALTER TABLE public.audit_logs ADD COLUMN IF NOT EXISTS entity_id text;
ALTER TABLE public.audit_logs ADD COLUMN IF NOT EXISTS old_values jsonb;
ALTER TABLE public.audit_logs ADD COLUMN IF NOT EXISTS new_values jsonb;
ALTER TABLE public.audit_logs ADD COLUMN IF NOT EXISTS metadata jsonb DEFAULT '{}'::jsonb;
ALTER TABLE public.audit_logs ADD COLUMN IF NOT EXISTS ip_address text;
ALTER TABLE public.audit_logs ADD COLUMN IF NOT EXISTS user_agent text;
ALTER TABLE public.audit_logs ADD COLUMN IF NOT EXISTS created_at timestamptz DEFAULT now();
UPDATE public.audit_logs SET action=COALESCE(action,'legacy'),entity_type=COALESCE(entity_type,'legacy'),metadata=COALESCE(metadata,'{}'::jsonb),created_at=COALESCE(created_at,now());
UPDATE public.audit_logs SET id=gen_random_uuid() WHERE id IS NULL;
CREATE UNIQUE INDEX IF NOT EXISTS audit_logs_id_compat_idx ON public.audit_logs(id);
CREATE INDEX IF NOT EXISTS audit_logs_user_id_idx ON public.audit_logs(user_id);
CREATE INDEX IF NOT EXISTS audit_logs_entity_type_idx ON public.audit_logs(entity_type);
CREATE INDEX IF NOT EXISTS audit_logs_entity_id_idx ON public.audit_logs(entity_id);
CREATE INDEX IF NOT EXISTS audit_logs_created_at_idx ON public.audit_logs(created_at DESC);
ALTER TABLE public.audit_logs ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.audit_logs FROM PUBLIC,anon,authenticated;
GRANT SELECT ON public.audit_logs TO authenticated;
DROP POLICY IF EXISTS audit_logs_select_authorized ON public.audit_logs;
CREATE POLICY audit_logs_select_authorized ON public.audit_logs FOR SELECT TO authenticated USING(public.has_permission('audit.view'));

CREATE OR REPLACE FUNCTION public.sanitize_audit_json(_value jsonb)
RETURNS jsonb LANGUAGE sql IMMUTABLE SET search_path=pg_catalog,public AS $$
  SELECT CASE
    WHEN _value IS NULL THEN NULL
    WHEN jsonb_typeof(_value)='object' THEN COALESCE((SELECT jsonb_object_agg(e.key,public.sanitize_audit_json(e.value)) FROM jsonb_each(_value) e WHERE e.key !~* '(password|senha|token|secret|service.?role|cookie|authorization|api.?key)'),'{}'::jsonb)
    WHEN jsonb_typeof(_value)='array' THEN COALESCE((SELECT jsonb_agg(public.sanitize_audit_json(a.value)) FROM jsonb_array_elements(_value) a),'[]'::jsonb)
    ELSE _value END
$$;
REVOKE ALL ON FUNCTION public.sanitize_audit_json(jsonb) FROM PUBLIC,anon,authenticated;

CREATE OR REPLACE FUNCTION public.write_audit_log(
  _user_id uuid,_action text,_entity_type text,_entity_id text DEFAULT NULL,
  _old_values jsonb DEFAULT NULL,_new_values jsonb DEFAULT NULL,
  _metadata jsonb DEFAULT '{}'::jsonb,_ip_address text DEFAULT NULL,_user_agent text DEFAULT NULL
)
RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog,public AS $$
DECLARE created_id uuid;
BEGIN
  IF _action IS NULL OR length(_action) NOT BETWEEN 1 AND 120 OR _entity_type IS NULL OR length(_entity_type) NOT BETWEEN 1 AND 120 THEN RAISE EXCEPTION 'Evento de auditoria inválido'; END IF;
  INSERT INTO public.audit_logs(user_id,action,entity_type,entity_id,old_values,new_values,metadata,ip_address,user_agent)
  VALUES(_user_id,_action,_entity_type,left(_entity_id,255),public.sanitize_audit_json(_old_values),public.sanitize_audit_json(_new_values),public.sanitize_audit_json(COALESCE(_metadata,'{}'::jsonb)),left(_ip_address,64),left(_user_agent,512))
  RETURNING id INTO created_id;
  RETURN created_id;
END $$;
REVOKE ALL ON FUNCTION public.write_audit_log(uuid,text,text,text,jsonb,jsonb,jsonb,text,text) FROM PUBLIC,anon,authenticated;

-- Compatibilidade para os triggers do Lote 5 já instalados. A chamada com
-- pg_catalog.name é encaminhada para a função canônica de nove argumentos.
CREATE OR REPLACE FUNCTION public.write_audit_log(
  _user_id uuid,_action text,_entity_type name,_entity_id text,
  _old_values jsonb,_new_values jsonb,_metadata jsonb
)
RETURNS uuid LANGUAGE sql SECURITY DEFINER SET search_path=pg_catalog,public AS $$
  SELECT public.write_audit_log(_user_id,_action,_entity_type::text,_entity_id,_old_values,_new_values,_metadata,NULL::text,NULL::text)
$$;
REVOKE ALL ON FUNCTION public.write_audit_log(uuid,text,name,text,jsonb,jsonb,jsonb) FROM PUBLIC,anon,authenticated;

CREATE TABLE IF NOT EXISTS public.commercial_settings (
  id boolean PRIMARY KEY DEFAULT true CHECK(id),
  stale_opportunity_days integer NOT NULL DEFAULT 7 CHECK(stale_opportunity_days BETWEEN 1 AND 365),
  follow_up_default_days integer NOT NULL DEFAULT 2 CHECK(follow_up_default_days BETWEEN 1 AND 30),
  second_follow_up_days integer NOT NULL DEFAULT 5 CHECK(second_follow_up_days BETWEEN 2 AND 60),
  third_alert_days integer NOT NULL DEFAULT 10 CHECK(third_alert_days BETWEEN 3 AND 90),
  warm_lead_threshold integer NOT NULL DEFAULT 31 CHECK(warm_lead_threshold BETWEEN 1 AND 99),
  hot_lead_threshold integer NOT NULL DEFAULT 61 CHECK(hot_lead_threshold BETWEEN 2 AND 100),
  use_business_days boolean NOT NULL DEFAULT true,
  updated_by uuid REFERENCES public.profiles(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(), updated_at timestamptz NOT NULL DEFAULT now(),
  CHECK(warm_lead_threshold < hot_lead_threshold)
);
INSERT INTO public.commercial_settings(id) VALUES(true) ON CONFLICT(id) DO NOTHING;

CREATE TABLE IF NOT EXISTS public.scoring_rules (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(), code text NOT NULL UNIQUE,
  name text NOT NULL, description text, entity_type text NOT NULL DEFAULT 'opportunity' CHECK(entity_type='opportunity'),
  event_or_field text NOT NULL, operator text NOT NULL CHECK(operator IN('exists','eq','gte','stage_at_least','days_gte','missing','overdue')),
  value jsonb NOT NULL DEFAULT '{}'::jsonb CHECK(jsonb_typeof(value) IN('object','number','string','boolean')),
  points integer NOT NULL CHECK(points BETWEEN -100 AND 100), exclusive_group text,
  active boolean NOT NULL DEFAULT true, position integer NOT NULL DEFAULT 0 CHECK(position>=0),
  created_at timestamptz NOT NULL DEFAULT now(), updated_at timestamptz NOT NULL DEFAULT now()
);

INSERT INTO public.scoring_rules(code,name,description,event_or_field,operator,value,points,exclusive_group,position) VALUES
('company_present','Empresa informada','Lead de origem possui empresa','lead.company_name','exists','{}',10,NULL,10),
('valid_phone','Telefone válido','Contato ou cliente possui telefone utilizável','contact.phone','exists','{}',5,NULL,20),
('email_present','E-mail informado','Contato ou cliente possui e-mail','contact.email','exists','{}',5,NULL,30),
('quantity_30','Quantidade de 30 a 49','Faixa exclusiva de quantidade','estimated_quantity','gte','30',5,'quantity',40),
('quantity_50','Quantidade de 50 a 99','Faixa exclusiva de quantidade','estimated_quantity','gte','50',10,'quantity',41),
('quantity_100','Quantidade de 100 a 299','Faixa exclusiva de quantidade','estimated_quantity','gte','100',15,'quantity',42),
('quantity_300','Quantidade a partir de 300','Faixa exclusiva de quantidade','estimated_quantity','gte','300',25,'quantity',43),
('desired_date','Prazo desejado informado','Existe data desejada de entrega','desired_delivery_date','exists','{}',10,NULL,50),
('stage_quote','Oportunidade chegou a orçamento','Etapa de orçamento ou posterior','stage','stage_at_least','"quote_preparation"',15,'stage_progress',60),
('existing_customer','Cliente antigo','Origem marcada como cliente antigo','source','eq','"existing_customer"',15,NULL,70),
('customer_has_orders','Cliente já possui pedidos','Histórico real de pedidos','customer.orders','exists','{}',10,NULL,80),
('recent_activity','Atividade comercial recente','Atividade nos últimos sete dias','last_activity_at','days_gte','7',5,NULL,90),
('stage_negotiation','Negociação','Etapa atual de negociação','stage','eq','"negotiation"',15,'stage_progress',100),
('stage_waiting_approval','Aguardando aprovação','Etapa atual aguardando aprovação','stage','eq','"waiting_approval"',20,'stage_progress',110),
('inactive_7','Sete dias sem atividade','Penalidade exclusiva de inatividade','last_activity_at','days_gte','7',-5,'inactivity',120),
('inactive_14','Quatorze dias sem atividade','Penalidade exclusiva de inatividade','last_activity_at','days_gte','14',-10,'inactivity',121),
('inactive_30','Trinta dias sem atividade','Penalidade exclusiva de inatividade','last_activity_at','days_gte','30',-20,'inactivity',122),
('without_next_action','Sem próxima ação','Não existe tarefa pendente futura ou presente','tasks','missing','{}',-10,NULL,130),
('overdue_task','Tarefa vencida','Existe tarefa pendente vencida','tasks','overdue','{}',-5,NULL,140)
ON CONFLICT(code) DO UPDATE SET name=EXCLUDED.name,description=EXCLUDED.description,event_or_field=EXCLUDED.event_or_field,
operator=EXCLUDED.operator,value=EXCLUDED.value,points=EXCLUDED.points,exclusive_group=EXCLUDED.exclusive_group,position=EXCLUDED.position;

CREATE TABLE IF NOT EXISTS public.automation_rules (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(), name text NOT NULL,
  event text NOT NULL CHECK(event IN('opportunity.created','opportunity.stage_changed','opportunity.activity_created','task.completed','daily_check')),
  conditions jsonb NOT NULL DEFAULT '{}'::jsonb CHECK(jsonb_typeof(conditions)='object'),
  action_type text NOT NULL CHECK(action_type IN('CREATE_TASK','CREATE_NOTIFICATION','UPDATE_SCORE')),
  action_config jsonb NOT NULL DEFAULT '{}'::jsonb CHECK(jsonb_typeof(action_config)='object'),
  active boolean NOT NULL DEFAULT true, created_at timestamptz NOT NULL DEFAULT now(), updated_at timestamptz NOT NULL DEFAULT now()
);
-- Compatibilidade com projetos que já possuíam uma fundação de automações.
-- CREATE TABLE IF NOT EXISTS não adiciona colunas em uma tabela preexistente.
ALTER TABLE public.automation_rules ADD COLUMN IF NOT EXISTS name text;
ALTER TABLE public.automation_rules ADD COLUMN IF NOT EXISTS event text;
ALTER TABLE public.automation_rules ADD COLUMN IF NOT EXISTS conditions jsonb DEFAULT '{}'::jsonb;
ALTER TABLE public.automation_rules ADD COLUMN IF NOT EXISTS action_type text;
ALTER TABLE public.automation_rules ADD COLUMN IF NOT EXISTS action_config jsonb DEFAULT '{}'::jsonb;
ALTER TABLE public.automation_rules ADD COLUMN IF NOT EXISTS active boolean DEFAULT true;
ALTER TABLE public.automation_rules ADD COLUMN IF NOT EXISTS created_at timestamptz DEFAULT now();
ALTER TABLE public.automation_rules ADD COLUMN IF NOT EXISTS updated_at timestamptz DEFAULT now();

CREATE TABLE IF NOT EXISTS public.automation_runs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(), rule_id uuid NOT NULL REFERENCES public.automation_rules(id) ON DELETE RESTRICT,
  entity_type text NOT NULL, entity_id uuid NOT NULL, status text NOT NULL CHECK(status IN('running','success','failed','skipped')),
  result jsonb NOT NULL DEFAULT '{}'::jsonb CHECK(jsonb_typeof(result)='object'),
  executed_at timestamptz NOT NULL DEFAULT now(), idempotency_key text NOT NULL UNIQUE
);
ALTER TABLE public.automation_runs ADD COLUMN IF NOT EXISTS rule_id uuid REFERENCES public.automation_rules(id) ON DELETE RESTRICT;
ALTER TABLE public.automation_runs ADD COLUMN IF NOT EXISTS entity_type text;
ALTER TABLE public.automation_runs ADD COLUMN IF NOT EXISTS entity_id uuid;
ALTER TABLE public.automation_runs ADD COLUMN IF NOT EXISTS status text DEFAULT 'skipped';
ALTER TABLE public.automation_runs ADD COLUMN IF NOT EXISTS result jsonb DEFAULT '{}'::jsonb;
ALTER TABLE public.automation_runs ADD COLUMN IF NOT EXISTS executed_at timestamptz DEFAULT now();
ALTER TABLE public.automation_runs ADD COLUMN IF NOT EXISTS idempotency_key text;

CREATE TABLE IF NOT EXISTS public.opportunity_stage_history (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(), opportunity_id uuid NOT NULL REFERENCES public.opportunities(id) ON DELETE RESTRICT,
  from_stage_id uuid REFERENCES public.pipeline_stages(id) ON DELETE RESTRICT,
  to_stage_id uuid NOT NULL REFERENCES public.pipeline_stages(id) ON DELETE RESTRICT,
  entered_at timestamptz NOT NULL, left_at timestamptz,
  changed_by uuid REFERENCES public.profiles(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(), CHECK(left_at IS NULL OR left_at>=entered_at)
);
CREATE UNIQUE INDEX IF NOT EXISTS opportunity_stage_history_open_idx ON public.opportunity_stage_history(opportunity_id) WHERE left_at IS NULL;

CREATE TABLE IF NOT EXISTS public.sales_targets (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(), user_id uuid REFERENCES public.profiles(id) ON DELETE RESTRICT,
  team_scope text NOT NULL DEFAULT 'individual' CHECK(team_scope IN('individual','company')),
  period_type text NOT NULL CHECK(period_type IN('monthly','quarterly','annual','custom')),
  period_start date NOT NULL, period_end date NOT NULL,
  target_type text NOT NULL CHECK(target_type IN('revenue_won','opportunities_won')),
  target_value numeric(14,2) NOT NULL CHECK(target_value>0),
  created_at timestamptz NOT NULL DEFAULT now(), updated_at timestamptz NOT NULL DEFAULT now(),
  created_by uuid NOT NULL REFERENCES public.profiles(id) ON DELETE RESTRICT DEFAULT auth.uid(),
  CHECK(period_end>=period_start), CHECK((team_scope='company' AND user_id IS NULL) OR (team_scope='individual' AND user_id IS NOT NULL)),
  UNIQUE(user_id,team_scope,period_start,period_end,target_type)
);

CREATE TABLE IF NOT EXISTS public.saved_views (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(), user_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE DEFAULT auth.uid(),
  module text NOT NULL CHECK(module IN('crm','crm_analytics','reactivation')), name text NOT NULL CHECK(length(trim(name)) BETWEEN 2 AND 80),
  filters jsonb NOT NULL DEFAULT '{}'::jsonb CHECK(jsonb_typeof(filters)='object'), is_default boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now(), UNIQUE(user_id,module,name)
);
ALTER TABLE public.saved_views ADD COLUMN IF NOT EXISTS user_id uuid REFERENCES public.profiles(id) ON DELETE CASCADE DEFAULT auth.uid();
ALTER TABLE public.saved_views ADD COLUMN IF NOT EXISTS module text;
ALTER TABLE public.saved_views ADD COLUMN IF NOT EXISTS name text;
ALTER TABLE public.saved_views ADD COLUMN IF NOT EXISTS filters jsonb DEFAULT '{}'::jsonb;
ALTER TABLE public.saved_views ADD COLUMN IF NOT EXISTS is_default boolean DEFAULT false;
ALTER TABLE public.saved_views ADD COLUMN IF NOT EXISTS created_at timestamptz DEFAULT now();
CREATE UNIQUE INDEX IF NOT EXISTS saved_views_one_default_idx ON public.saved_views(user_id,module) WHERE is_default;
CREATE UNIQUE INDEX IF NOT EXISTS saved_views_user_module_name_idx ON public.saved_views(user_id,module,name);

CREATE TABLE IF NOT EXISTS public.notifications (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(), user_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  type text NOT NULL CHECK(type IN('task_overdue','opportunity_stale','lead_assigned','opportunity_assigned','follow_up_alert','target_risk')),
  title text NOT NULL, body text, entity_type text, entity_id uuid, idempotency_key text NOT NULL UNIQUE,
  read_at timestamptz, created_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.notifications ADD COLUMN IF NOT EXISTS user_id uuid REFERENCES public.profiles(id) ON DELETE CASCADE;
ALTER TABLE public.notifications ADD COLUMN IF NOT EXISTS type text;
ALTER TABLE public.notifications ADD COLUMN IF NOT EXISTS title text;
ALTER TABLE public.notifications ADD COLUMN IF NOT EXISTS body text;
ALTER TABLE public.notifications ADD COLUMN IF NOT EXISTS entity_type text;
ALTER TABLE public.notifications ADD COLUMN IF NOT EXISTS entity_id uuid;
ALTER TABLE public.notifications ADD COLUMN IF NOT EXISTS idempotency_key text;
ALTER TABLE public.notifications ADD COLUMN IF NOT EXISTS read_at timestamptz;
ALTER TABLE public.notifications ADD COLUMN IF NOT EXISTS created_at timestamptz DEFAULT now();

ALTER TABLE public.opportunities ADD COLUMN IF NOT EXISTS calculated_temperature text NOT NULL DEFAULT 'warm' CHECK(calculated_temperature IN('cold','warm','hot'));
ALTER TABLE public.opportunities ADD COLUMN IF NOT EXISTS temperature_override text CHECK(temperature_override IN('cold','warm','hot'));
ALTER TABLE public.opportunities ADD COLUMN IF NOT EXISTS score_updated_at timestamptz;
ALTER TABLE public.opportunities ADD COLUMN IF NOT EXISTS score_breakdown jsonb NOT NULL DEFAULT '[]'::jsonb CHECK(jsonb_typeof(score_breakdown)='array');
ALTER TABLE public.opportunities DROP CONSTRAINT IF EXISTS opportunity_won_final_value_check;
ALTER TABLE public.opportunities ADD CONSTRAINT opportunity_won_final_value_check CHECK(status<>'won' OR final_value IS NOT NULL) NOT VALID;

CREATE INDEX IF NOT EXISTS opportunities_last_activity_at_idx ON public.opportunities(last_activity_at);
CREATE INDEX IF NOT EXISTS opportunities_won_at_idx ON public.opportunities(won_at);
CREATE INDEX IF NOT EXISTS opportunities_lost_at_idx ON public.opportunities(lost_at);
CREATE INDEX IF NOT EXISTS opportunities_source_id_idx ON public.opportunities(source_id);
CREATE INDEX IF NOT EXISTS stage_history_opportunity_entered_idx ON public.opportunity_stage_history(opportunity_id,entered_at DESC);
CREATE INDEX IF NOT EXISTS stage_history_to_stage_entered_idx ON public.opportunity_stage_history(to_stage_id,entered_at DESC);
CREATE INDEX IF NOT EXISTS automation_runs_entity_idx ON public.automation_runs(entity_type,entity_id,executed_at DESC);
CREATE UNIQUE INDEX IF NOT EXISTS automation_runs_idempotency_idx ON public.automation_runs(idempotency_key);
CREATE INDEX IF NOT EXISTS notifications_user_unread_idx ON public.notifications(user_id,created_at DESC) WHERE read_at IS NULL;
CREATE UNIQUE INDEX IF NOT EXISTS notifications_idempotency_idx ON public.notifications(idempotency_key);
CREATE INDEX IF NOT EXISTS sales_targets_user_period_idx ON public.sales_targets(user_id,period_start,period_end);
CREATE INDEX IF NOT EXISTS saved_views_user_module_idx ON public.saved_views(user_id,module);

DO $$ DECLARE table_name text; BEGIN
  FOREACH table_name IN ARRAY ARRAY['commercial_settings','scoring_rules','automation_rules','sales_targets'] LOOP
    EXECUTE format('DROP TRIGGER IF EXISTS %I_set_updated_at ON public.%I',table_name,table_name);
    EXECUTE format('CREATE TRIGGER %I_set_updated_at BEFORE UPDATE ON public.%I FOR EACH ROW EXECUTE FUNCTION public.set_updated_at()',table_name,table_name);
  END LOOP;
END $$;

CREATE OR REPLACE FUNCTION public.crm_can_view_commercial_user(p_user_id uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path=pg_catalog,public AS $$
  SELECT auth.uid() IS NOT NULL AND public.has_permission('crm.view') AND
    (p_user_id=auth.uid() OR EXISTS(SELECT 1 FROM public.user_roles ur JOIN public.roles r ON r.id=ur.role_id WHERE ur.user_id=auth.uid() AND r.code IN('administrator','manager')))
$$;
REVOKE ALL ON FUNCTION public.crm_can_view_commercial_user(uuid) FROM PUBLIC,anon,authenticated;

CREATE OR REPLACE FUNCTION public.get_sales_forecast(p_start date,p_end date,p_user_id uuid DEFAULT NULL)
RETURNS jsonb LANGUAGE sql STABLE SECURITY DEFINER SET search_path=pg_catalog,public AS $$
SELECT CASE WHEN public.crm_can_view_commercial_user(p_user_id) THEN jsonb_build_object(
  'pipeline_total',COALESCE(sum(o.estimated_value) FILTER(WHERE o.status='open'),0),
  'pipeline_weighted',COALESCE(sum(o.estimated_value*s.probability/100.0) FILTER(WHERE o.status='open'),0),
  'forecast_closing',COALESCE(sum(o.estimated_value) FILTER(WHERE o.status='open' AND o.expected_close_date BETWEEN p_start AND p_end),0),
  'company_target',COALESCE((SELECT sum(st.target_value) FROM public.sales_targets st WHERE st.team_scope='company' AND st.target_type='revenue_won' AND st.period_start<=p_end AND st.period_end>=p_start),0),
  'company_won',COALESCE((SELECT sum(ow.final_value) FROM public.opportunities ow WHERE ow.status='won' AND ow.won_at>=p_start::timestamptz AND ow.won_at<(p_end+1)::timestamptz),0),
  'by_seller',(SELECT COALESCE(jsonb_agg(to_jsonb(x) ORDER BY x.forecast DESC),'[]') FROM (
    SELECT p.id,p.full_name,COALESCE(sum(oo.estimated_value) FILTER(WHERE oo.status='open'),0) pipeline,
      COALESCE(sum(oo.estimated_value*ss.probability/100.0) FILTER(WHERE oo.status='open'),0) weighted,
      COALESCE(sum(oo.estimated_value) FILTER(WHERE oo.status='open' AND oo.expected_close_date BETWEEN p_start AND p_end),0) forecast,
      COALESCE((SELECT sum(st.target_value) FROM public.sales_targets st WHERE st.user_id=p.id AND st.target_type='revenue_won' AND st.period_start<=p_end AND st.period_end>=p_start),0) target,
      COALESCE(sum(oo.final_value) FILTER(WHERE oo.status='won' AND oo.won_at>=p_start::timestamptz AND oo.won_at<(p_end+1)::timestamptz),0) won
    FROM public.profiles p LEFT JOIN public.opportunities oo ON oo.assigned_user_id=p.id LEFT JOIN public.pipeline_stages ss ON ss.id=oo.stage_id
    WHERE p.active AND (p_user_id IS NULL OR p.id=p_user_id) GROUP BY p.id
  ) x)
) ELSE NULL END FROM public.opportunities o JOIN public.pipeline_stages s ON s.id=o.stage_id WHERE p_user_id IS NULL OR o.assigned_user_id=p_user_id;
$$;

CREATE OR REPLACE FUNCTION public.get_reactivation_customers(p_days integer DEFAULT 90,p_mode text DEFAULT 'inactive',p_min_ticket numeric DEFAULT 10000,p_limit integer DEFAULT 50,p_offset integer DEFAULT 0)
RETURNS jsonb LANGUAGE sql STABLE SECURITY DEFINER SET search_path=pg_catalog,public AS $$
WITH order_values AS (
  SELECT p.id,p.cliente_id,p.data_pedido,COALESCE(sum(i.qtde*i.valor_unitario),0) value
  FROM public.pedidos p LEFT JOIN public.itens_pedido i ON i.pedido_id=p.id WHERE p.status<>'cancelado' AND p.cliente_id IS NOT NULL GROUP BY p.id
), intervals AS (
  SELECT cliente_id,data_pedido,data_pedido-lag(data_pedido) OVER(PARTITION BY cliente_id ORDER BY data_pedido) gap FROM order_values
), stats AS (
  SELECT c.id,c.nome,c.contato,c.email,count(ov.id) order_count,max(ov.data_pedido) last_order_date,COALESCE(sum(ov.value),0) total_value,
    round(avg(ov.value),2) avg_ticket,round((SELECT avg(i.gap) FROM intervals i WHERE i.cliente_id=c.id),0) avg_interval_days
  FROM public.clientes c LEFT JOIN order_values ov ON ov.cliente_id=c.id GROUP BY c.id
), filtered AS (
  SELECT *,CASE WHEN avg_interval_days IS NOT NULL AND last_order_date IS NOT NULL THEN last_order_date+avg_interval_days::integer END predicted_repurchase_date
  FROM stats WHERE
    (p_mode='no_orders' AND order_count=0) OR
    (p_mode='inactive' AND order_count>0 AND last_order_date<=current_date-GREATEST(1,p_days)) OR
    (p_mode='recompra' AND order_count>=2 AND last_order_date+avg_interval_days::integer<=current_date+30) OR
    (p_mode='high_ticket' AND avg_ticket>=p_min_ticket)
)
SELECT CASE WHEN auth.uid() IS NOT NULL AND public.has_permission('crm.view') THEN jsonb_build_object(
  'items',COALESCE((SELECT jsonb_agg(to_jsonb(x) ORDER BY x.last_order_date NULLS FIRST,x.total_value DESC) FROM (SELECT * FROM filtered LIMIT LEAST(GREATEST(p_limit,1),100) OFFSET GREATEST(p_offset,0)) x),'[]'),
  'total',(SELECT count(*) FROM filtered),'mode',p_mode,'days',p_days
) ELSE NULL END;
$$;

CREATE OR REPLACE FUNCTION public.create_reactivation_tasks(p_customer_ids uuid[],p_assigned_user_id uuid,p_due_at timestamptz,p_title text)
RETURNS integer LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog,public AS $$
DECLARE inserted_count integer;
BEGIN
  IF auth.uid() IS NULL OR NOT public.has_permission('crm.create') THEN RAISE EXCEPTION 'permission denied' USING errcode='42501'; END IF;
  IF cardinality(COALESCE(p_customer_ids,'{}'::uuid[])) NOT BETWEEN 1 AND 100 OR length(trim(COALESCE(p_title,'')))<2 OR p_due_at IS NULL THEN RAISE EXCEPTION 'invalid task batch' USING errcode='22023'; END IF;
  IF NOT EXISTS(SELECT 1 FROM public.profiles WHERE id=p_assigned_user_id AND active) THEN RAISE EXCEPTION 'invalid assigned user' USING errcode='23503'; END IF;
  INSERT INTO public.tasks(customer_id,assigned_user_id,type,title,due_at,priority,created_by)
  SELECT c.id,p_assigned_user_id,'return_contact',trim(p_title),p_due_at,'normal',auth.uid()
  FROM public.clientes c JOIN (SELECT DISTINCT unnest(p_customer_ids) id) requested ON requested.id=c.id;
  GET DIAGNOSTICS inserted_count=ROW_COUNT;
  RETURN inserted_count;
END $$;

CREATE OR REPLACE FUNCTION public.save_commercial_settings(p_settings jsonb)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog,public AS $$
DECLARE saved public.commercial_settings%ROWTYPE;
BEGIN
  IF auth.uid() IS NULL OR NOT (public.has_permission('settings.manage') OR public.has_permission('crm.delete')) THEN RAISE EXCEPTION 'permission denied' USING errcode='42501'; END IF;
  UPDATE public.commercial_settings SET
    stale_opportunity_days=COALESCE((p_settings->>'stale_opportunity_days')::integer,stale_opportunity_days),
    follow_up_default_days=COALESCE((p_settings->>'follow_up_default_days')::integer,follow_up_default_days),
    second_follow_up_days=COALESCE((p_settings->>'second_follow_up_days')::integer,second_follow_up_days),
    third_alert_days=COALESCE((p_settings->>'third_alert_days')::integer,third_alert_days),
    warm_lead_threshold=COALESCE((p_settings->>'warm_lead_threshold')::integer,warm_lead_threshold),
    hot_lead_threshold=COALESCE((p_settings->>'hot_lead_threshold')::integer,hot_lead_threshold),
    use_business_days=COALESCE((p_settings->>'use_business_days')::boolean,use_business_days),updated_by=auth.uid()
  WHERE id RETURNING * INTO saved;
  PERFORM public.crm_recalculate_score_internal(o.id) FROM public.opportunities o WHERE o.status='open';
  RETURN to_jsonb(saved);
END $$;

CREATE OR REPLACE FUNCTION public.save_crm_view(p_module text,p_name text,p_filters jsonb,p_is_default boolean DEFAULT false)
RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog,public AS $$
DECLARE saved_id uuid;
BEGIN
  IF auth.uid() IS NULL OR NOT public.has_permission('crm.view') THEN RAISE EXCEPTION 'permission denied' USING errcode='42501'; END IF;
  IF p_module NOT IN('crm','crm_analytics','reactivation') OR length(trim(p_name)) NOT BETWEEN 2 AND 80 OR jsonb_typeof(p_filters)<>'object' THEN RAISE EXCEPTION 'invalid saved view' USING errcode='22023'; END IF;
  IF p_is_default THEN UPDATE public.saved_views SET is_default=false WHERE user_id=auth.uid() AND module=p_module; END IF;
  INSERT INTO public.saved_views(user_id,module,name,filters,is_default) VALUES(auth.uid(),p_module,trim(p_name),p_filters,p_is_default)
  ON CONFLICT(user_id,module,name) DO UPDATE SET filters=EXCLUDED.filters,is_default=EXCLUDED.is_default RETURNING id INTO saved_id;
  RETURN saved_id;
END $$;

CREATE OR REPLACE FUNCTION public.mark_notification_read(p_notification_id uuid)
RETURNS boolean LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog,public AS $$
BEGIN
  IF auth.uid() IS NULL THEN RAISE EXCEPTION 'permission denied' USING errcode='42501'; END IF;
  UPDATE public.notifications SET read_at=COALESCE(read_at,now()) WHERE id=p_notification_id AND user_id=auth.uid(); RETURN FOUND;
END $$;

CREATE OR REPLACE FUNCTION public.crm_opportunity_assignment_notification()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog,public AS $$
BEGIN
  IF TG_OP='INSERT' OR NEW.assigned_user_id IS DISTINCT FROM OLD.assigned_user_id THEN
    INSERT INTO public.notifications(user_id,type,title,body,entity_type,entity_id,idempotency_key)
    VALUES(NEW.assigned_user_id,'opportunity_assigned','Oportunidade atribuída',NEW.title,'opportunity',NEW.id,
      'opportunity-assigned:'||NEW.id::text||':'||NEW.assigned_user_id::text) ON CONFLICT(idempotency_key) DO NOTHING;
  END IF; RETURN NEW;
END $$;
REVOKE ALL ON FUNCTION public.crm_opportunity_assignment_notification() FROM PUBLIC,anon,authenticated;
DROP TRIGGER IF EXISTS opportunities_assignment_notification ON public.opportunities;
CREATE TRIGGER opportunities_assignment_notification AFTER INSERT OR UPDATE OF assigned_user_id ON public.opportunities FOR EACH ROW EXECUTE FUNCTION public.crm_opportunity_assignment_notification();

CREATE OR REPLACE FUNCTION public.commercial_intelligence_audit()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog,public AS $$
DECLARE action_name text; old_row jsonb:=CASE WHEN TG_OP='UPDATE' THEN to_jsonb(OLD) END; new_row jsonb:=to_jsonb(NEW);
BEGIN
  action_name:=CASE
    WHEN TG_TABLE_NAME='scoring_rules' AND TG_OP='INSERT' THEN 'scoring_rule.created'
    WHEN TG_TABLE_NAME='scoring_rules' THEN 'scoring_rule.updated'
    WHEN TG_TABLE_NAME='automation_rules' AND TG_OP='INSERT' THEN 'automation_rule.created'
    WHEN TG_TABLE_NAME='automation_rules' THEN 'automation_rule.updated'
    WHEN TG_TABLE_NAME='sales_targets' AND TG_OP='INSERT' THEN 'sales_target.created'
    WHEN TG_TABLE_NAME='sales_targets' THEN 'sales_target.updated'
    WHEN TG_TABLE_NAME='pipeline_stages' THEN 'pipeline_stage.updated'
    ELSE 'commercial_settings.updated' END;
  PERFORM public.write_audit_log(auth.uid(),action_name,TG_TABLE_NAME::text,new_row->>'id',old_row,new_row,jsonb_build_object('source','database_trigger'));
  RETURN NEW;
END $$;
REVOKE ALL ON FUNCTION public.commercial_intelligence_audit() FROM PUBLIC,anon,authenticated;
DO $$ DECLARE table_name text; BEGIN
  FOREACH table_name IN ARRAY ARRAY['scoring_rules','automation_rules','sales_targets','commercial_settings','pipeline_stages'] LOOP
    EXECUTE format('DROP TRIGGER IF EXISTS audit_%I_commercial_intelligence ON public.%I',table_name,table_name);
    EXECUTE format('CREATE TRIGGER audit_%I_commercial_intelligence AFTER INSERT OR UPDATE ON public.%I FOR EACH ROW EXECUTE FUNCTION public.commercial_intelligence_audit()',table_name,table_name);
  END LOOP;
END $$;

DO $$ DECLARE table_name text; BEGIN
  FOREACH table_name IN ARRAY ARRAY['commercial_settings','scoring_rules','automation_rules','automation_runs','opportunity_stage_history','sales_targets','saved_views','notifications'] LOOP
    EXECUTE format('ALTER TABLE public.%I ENABLE ROW LEVEL SECURITY',table_name);
    EXECUTE format('REVOKE ALL ON public.%I FROM PUBLIC,anon,authenticated',table_name);
  END LOOP;
END $$;

GRANT SELECT ON public.commercial_settings,public.scoring_rules,public.automation_rules,public.opportunity_stage_history,public.sales_targets TO authenticated;
GRANT SELECT ON public.automation_runs TO authenticated;
GRANT SELECT,INSERT,UPDATE,DELETE ON public.saved_views TO authenticated;
GRANT SELECT,UPDATE ON public.notifications TO authenticated;
GRANT INSERT,UPDATE ON public.commercial_settings,public.scoring_rules,public.automation_rules,public.sales_targets TO authenticated;

DROP POLICY IF EXISTS commercial_settings_select ON public.commercial_settings;
DROP POLICY IF EXISTS commercial_settings_update ON public.commercial_settings;
DROP POLICY IF EXISTS scoring_rules_select ON public.scoring_rules;
DROP POLICY IF EXISTS scoring_rules_insert ON public.scoring_rules;
DROP POLICY IF EXISTS scoring_rules_update ON public.scoring_rules;
DROP POLICY IF EXISTS automation_rules_select ON public.automation_rules;
DROP POLICY IF EXISTS automation_rules_insert ON public.automation_rules;
DROP POLICY IF EXISTS automation_rules_update ON public.automation_rules;
DROP POLICY IF EXISTS automation_runs_select ON public.automation_runs;
DROP POLICY IF EXISTS stage_history_select ON public.opportunity_stage_history;
DROP POLICY IF EXISTS sales_targets_select ON public.sales_targets;
DROP POLICY IF EXISTS sales_targets_insert ON public.sales_targets;
DROP POLICY IF EXISTS sales_targets_update ON public.sales_targets;
DROP POLICY IF EXISTS saved_views_select ON public.saved_views;
DROP POLICY IF EXISTS saved_views_insert ON public.saved_views;
DROP POLICY IF EXISTS saved_views_update ON public.saved_views;
DROP POLICY IF EXISTS saved_views_delete ON public.saved_views;
DROP POLICY IF EXISTS notifications_select ON public.notifications;
DROP POLICY IF EXISTS notifications_update ON public.notifications;
CREATE POLICY commercial_settings_select ON public.commercial_settings FOR SELECT TO authenticated USING(public.has_permission('crm.view'));
CREATE POLICY commercial_settings_update ON public.commercial_settings FOR UPDATE TO authenticated USING(public.has_permission('settings.manage') OR public.has_permission('crm.delete')) WITH CHECK(public.has_permission('settings.manage') OR public.has_permission('crm.delete'));
CREATE POLICY scoring_rules_select ON public.scoring_rules FOR SELECT TO authenticated USING(public.has_permission('settings.manage') OR public.has_permission('crm.delete'));
CREATE POLICY scoring_rules_insert ON public.scoring_rules FOR INSERT TO authenticated WITH CHECK(public.has_permission('settings.manage') OR public.has_permission('crm.delete'));
CREATE POLICY scoring_rules_update ON public.scoring_rules FOR UPDATE TO authenticated USING(public.has_permission('settings.manage') OR public.has_permission('crm.delete')) WITH CHECK(public.has_permission('settings.manage') OR public.has_permission('crm.delete'));
CREATE POLICY automation_rules_select ON public.automation_rules FOR SELECT TO authenticated USING(public.has_permission('settings.manage') OR public.has_permission('crm.delete'));
CREATE POLICY automation_rules_insert ON public.automation_rules FOR INSERT TO authenticated WITH CHECK(public.has_permission('settings.manage') OR public.has_permission('crm.delete'));
CREATE POLICY automation_rules_update ON public.automation_rules FOR UPDATE TO authenticated USING(public.has_permission('settings.manage') OR public.has_permission('crm.delete')) WITH CHECK(public.has_permission('settings.manage') OR public.has_permission('crm.delete'));
CREATE POLICY automation_runs_select ON public.automation_runs FOR SELECT TO authenticated USING(public.has_permission('settings.manage') OR public.has_permission('audit.view'));
CREATE POLICY stage_history_select ON public.opportunity_stage_history FOR SELECT TO authenticated USING(public.has_permission('crm.view'));
CREATE POLICY sales_targets_select ON public.sales_targets FOR SELECT TO authenticated USING(public.has_permission('crm.view') AND (user_id=auth.uid() OR public.has_permission('settings.manage') OR public.has_permission('crm.delete')));
CREATE POLICY sales_targets_insert ON public.sales_targets FOR INSERT TO authenticated WITH CHECK((public.has_permission('settings.manage') OR public.has_permission('crm.delete')) AND created_by=auth.uid());
CREATE POLICY sales_targets_update ON public.sales_targets FOR UPDATE TO authenticated USING(public.has_permission('settings.manage') OR public.has_permission('crm.delete')) WITH CHECK(public.has_permission('settings.manage') OR public.has_permission('crm.delete'));

DROP POLICY IF EXISTS lead_sources_insert_crm ON public.lead_sources;
DROP POLICY IF EXISTS lead_sources_update_crm ON public.lead_sources;
DROP POLICY IF EXISTS pipelines_insert_crm ON public.pipelines;
DROP POLICY IF EXISTS pipelines_update_crm ON public.pipelines;
DROP POLICY IF EXISTS pipeline_stages_insert_crm ON public.pipeline_stages;
DROP POLICY IF EXISTS pipeline_stages_update_crm ON public.pipeline_stages;
DROP POLICY IF EXISTS loss_reasons_insert_crm ON public.loss_reasons;
DROP POLICY IF EXISTS loss_reasons_update_crm ON public.loss_reasons;
CREATE POLICY lead_sources_insert_crm ON public.lead_sources FOR INSERT TO authenticated WITH CHECK(public.has_permission('settings.manage') OR public.has_permission('crm.delete'));
CREATE POLICY lead_sources_update_crm ON public.lead_sources FOR UPDATE TO authenticated USING(public.has_permission('settings.manage') OR public.has_permission('crm.delete')) WITH CHECK(public.has_permission('settings.manage') OR public.has_permission('crm.delete'));
CREATE POLICY pipelines_insert_crm ON public.pipelines FOR INSERT TO authenticated WITH CHECK(public.has_permission('settings.manage') OR public.has_permission('crm.delete'));
CREATE POLICY pipelines_update_crm ON public.pipelines FOR UPDATE TO authenticated USING(public.has_permission('settings.manage') OR public.has_permission('crm.delete')) WITH CHECK(public.has_permission('settings.manage') OR public.has_permission('crm.delete'));
CREATE POLICY pipeline_stages_insert_crm ON public.pipeline_stages FOR INSERT TO authenticated WITH CHECK(public.has_permission('settings.manage') OR public.has_permission('crm.delete'));
CREATE POLICY pipeline_stages_update_crm ON public.pipeline_stages FOR UPDATE TO authenticated USING(public.has_permission('settings.manage') OR public.has_permission('crm.delete')) WITH CHECK(public.has_permission('settings.manage') OR public.has_permission('crm.delete'));
CREATE POLICY loss_reasons_insert_crm ON public.loss_reasons FOR INSERT TO authenticated WITH CHECK(public.has_permission('settings.manage') OR public.has_permission('crm.delete'));
CREATE POLICY loss_reasons_update_crm ON public.loss_reasons FOR UPDATE TO authenticated USING(public.has_permission('settings.manage') OR public.has_permission('crm.delete')) WITH CHECK(public.has_permission('settings.manage') OR public.has_permission('crm.delete'));
CREATE POLICY saved_views_select ON public.saved_views FOR SELECT TO authenticated USING(public.has_permission('crm.view') AND user_id=auth.uid());
CREATE POLICY saved_views_insert ON public.saved_views FOR INSERT TO authenticated WITH CHECK(public.has_permission('crm.view') AND user_id=auth.uid());
CREATE POLICY saved_views_update ON public.saved_views FOR UPDATE TO authenticated USING(user_id=auth.uid()) WITH CHECK(user_id=auth.uid());
CREATE POLICY saved_views_delete ON public.saved_views FOR DELETE TO authenticated USING(user_id=auth.uid());
CREATE POLICY notifications_select ON public.notifications FOR SELECT TO authenticated USING(user_id=auth.uid());
CREATE POLICY notifications_update ON public.notifications FOR UPDATE TO authenticated USING(user_id=auth.uid()) WITH CHECK(user_id=auth.uid());

CREATE OR REPLACE FUNCTION public.crm_rule_points(p_code text)
RETURNS integer LANGUAGE sql STABLE SET search_path=pg_catalog,public AS $$
  SELECT COALESCE((SELECT points FROM public.scoring_rules WHERE code=p_code AND active),0)
$$;
REVOKE ALL ON FUNCTION public.crm_rule_points(text) FROM PUBLIC,anon,authenticated;

CREATE OR REPLACE FUNCTION public.crm_add_business_days(p_start timestamptz,p_days integer)
RETURNS timestamptz LANGUAGE plpgsql STABLE SET search_path=pg_catalog,public AS $$
DECLARE local_start timestamp:=p_start AT TIME ZONE 'America/Sao_Paulo'; target_date date:=local_start::date; remaining integer:=GREATEST(p_days,0);
BEGIN
  WHILE remaining>0 LOOP
    target_date:=target_date+1;
    IF extract(isodow FROM target_date)<6 AND NOT EXISTS(SELECT 1 FROM public.feriados f WHERE f.data=target_date) THEN remaining:=remaining-1; END IF;
  END LOOP;
  RETURN (target_date::text||' '||local_start::time::text||' America/Sao_Paulo')::timestamptz;
END $$;
REVOKE ALL ON FUNCTION public.crm_add_business_days(timestamptz,integer) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.crm_add_business_days(timestamptz,integer) TO authenticated;

CREATE OR REPLACE FUNCTION public.crm_recalculate_score_internal(p_opportunity_id uuid)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog,public AS $$
DECLARE o public.opportunities%ROWTYPE; stage_code text; stage_position integer; quote_position integer; source_code text;
  lead_company text; contact_phone text; contact_email text; customer_phone text; customer_email text;
  inactivity_days integer; total_score integer:=0; item_points integer; item_name text; breakdown jsonb:='[]'::jsonb;
  warm_threshold integer; hot_threshold integer; calculated text;
BEGIN
  SELECT * INTO o FROM public.opportunities WHERE id=p_opportunity_id;
  IF NOT FOUND THEN RETURN NULL; END IF;
  SELECT s.code,s.position INTO stage_code,stage_position FROM public.pipeline_stages s WHERE s.id=o.stage_id;
  SELECT position INTO quote_position FROM public.pipeline_stages WHERE pipeline_id=o.pipeline_id AND code='quote_preparation';
  SELECT code INTO source_code FROM public.lead_sources WHERE id=o.source_id;
  SELECT company_name INTO lead_company FROM public.leads WHERE id=o.lead_id;
  SELECT phone_normalized,email_normalized INTO contact_phone,contact_email FROM public.contacts WHERE id=o.contact_id;
  SELECT public.crm_normalize_phone(contato),NULLIF(lower(trim(email)),'') INTO customer_phone,customer_email FROM public.clientes WHERE id=o.customer_id;

  IF NULLIF(trim(lead_company),'') IS NOT NULL THEN SELECT public.crm_rule_points('company_present'),name INTO item_points,item_name FROM public.scoring_rules WHERE code='company_present'; IF item_points<>0 THEN total_score:=total_score+item_points; breakdown:=breakdown||jsonb_build_array(jsonb_build_object('code','company_present','label',item_name,'points',item_points)); END IF; END IF;
  IF COALESCE(contact_phone,customer_phone) IS NOT NULL THEN SELECT public.crm_rule_points('valid_phone'),name INTO item_points,item_name FROM public.scoring_rules WHERE code='valid_phone'; IF item_points<>0 THEN total_score:=total_score+item_points; breakdown:=breakdown||jsonb_build_array(jsonb_build_object('code','valid_phone','label',item_name,'points',item_points)); END IF; END IF;
  IF COALESCE(contact_email,customer_email) IS NOT NULL THEN SELECT public.crm_rule_points('email_present'),name INTO item_points,item_name FROM public.scoring_rules WHERE code='email_present'; IF item_points<>0 THEN total_score:=total_score+item_points; breakdown:=breakdown||jsonb_build_array(jsonb_build_object('code','email_present','label',item_name,'points',item_points)); END IF; END IF;

  SELECT points,name INTO item_points,item_name FROM public.scoring_rules WHERE active AND exclusive_group='quantity' AND (value#>>'{}')::integer<=o.estimated_quantity ORDER BY (value#>>'{}')::integer DESC LIMIT 1;
  IF item_points IS NOT NULL THEN total_score:=total_score+item_points; breakdown:=breakdown||jsonb_build_array(jsonb_build_object('code','quantity','label',item_name,'points',item_points)); END IF;
  IF o.desired_delivery_date IS NOT NULL THEN SELECT public.crm_rule_points('desired_date'),name INTO item_points,item_name FROM public.scoring_rules WHERE code='desired_date'; IF item_points<>0 THEN total_score:=total_score+item_points; breakdown:=breakdown||jsonb_build_array(jsonb_build_object('code','desired_date','label',item_name,'points',item_points)); END IF; END IF;

  item_points:=NULL;
  IF stage_code='waiting_approval' THEN SELECT public.crm_rule_points('stage_waiting_approval'),name INTO item_points,item_name FROM public.scoring_rules WHERE code='stage_waiting_approval';
  ELSIF stage_code='negotiation' THEN SELECT public.crm_rule_points('stage_negotiation'),name INTO item_points,item_name FROM public.scoring_rules WHERE code='stage_negotiation';
  ELSIF stage_position>=COALESCE(quote_position,2147483647) THEN SELECT public.crm_rule_points('stage_quote'),name INTO item_points,item_name FROM public.scoring_rules WHERE code='stage_quote'; END IF;
  IF item_points IS NOT NULL AND item_points<>0 THEN total_score:=total_score+item_points; breakdown:=breakdown||jsonb_build_array(jsonb_build_object('code','stage_progress','label',item_name,'points',item_points)); END IF;

  IF source_code='existing_customer' THEN SELECT public.crm_rule_points('existing_customer'),name INTO item_points,item_name FROM public.scoring_rules WHERE code='existing_customer'; total_score:=total_score+item_points; breakdown:=breakdown||jsonb_build_array(jsonb_build_object('code','existing_customer','label',item_name,'points',item_points)); END IF;
  IF EXISTS(SELECT 1 FROM public.pedidos p WHERE p.cliente_id=o.customer_id AND p.status<>'cancelado') THEN SELECT public.crm_rule_points('customer_has_orders'),name INTO item_points,item_name FROM public.scoring_rules WHERE code='customer_has_orders'; total_score:=total_score+item_points; breakdown:=breakdown||jsonb_build_array(jsonb_build_object('code','customer_has_orders','label',item_name,'points',item_points)); END IF;

  inactivity_days:=floor(extract(epoch FROM (now()-COALESCE(o.last_activity_at,o.created_at)))/86400);
  IF inactivity_days BETWEEN 0 AND 6 AND o.last_activity_at IS NOT NULL THEN SELECT public.crm_rule_points('recent_activity'),name INTO item_points,item_name FROM public.scoring_rules WHERE code='recent_activity'; total_score:=total_score+item_points; breakdown:=breakdown||jsonb_build_array(jsonb_build_object('code','recent_activity','label',item_name,'points',item_points)); END IF;
  SELECT points,name INTO item_points,item_name FROM public.scoring_rules WHERE active AND exclusive_group='inactivity' AND (substring(code FROM '[0-9]+'))::integer<=inactivity_days ORDER BY (substring(code FROM '[0-9]+'))::integer DESC LIMIT 1;
  IF item_points IS NOT NULL THEN total_score:=total_score+item_points; breakdown:=breakdown||jsonb_build_array(jsonb_build_object('code','inactivity','label',item_name,'points',item_points)); END IF;
  IF o.status='open' AND NOT EXISTS(SELECT 1 FROM public.tasks t WHERE t.opportunity_id=o.id AND t.status='pending' AND t.due_at>=now()) THEN SELECT public.crm_rule_points('without_next_action'),name INTO item_points,item_name FROM public.scoring_rules WHERE code='without_next_action'; total_score:=total_score+item_points; breakdown:=breakdown||jsonb_build_array(jsonb_build_object('code','without_next_action','label',item_name,'points',item_points)); END IF;
  IF EXISTS(SELECT 1 FROM public.tasks t WHERE t.opportunity_id=o.id AND t.status='pending' AND t.due_at<now()) THEN SELECT public.crm_rule_points('overdue_task'),name INTO item_points,item_name FROM public.scoring_rules WHERE code='overdue_task'; total_score:=total_score+item_points; breakdown:=breakdown||jsonb_build_array(jsonb_build_object('code','overdue_task','label',item_name,'points',item_points)); END IF;

  total_score:=LEAST(100,GREATEST(0,total_score));
  SELECT warm_lead_threshold,hot_lead_threshold INTO warm_threshold,hot_threshold FROM public.commercial_settings WHERE id;
  calculated:=CASE WHEN total_score>=hot_threshold THEN 'hot' WHEN total_score>=warm_threshold THEN 'warm' ELSE 'cold' END;
  UPDATE public.opportunities SET score=total_score,calculated_temperature=calculated,
    temperature=COALESCE(temperature_override,calculated),score_breakdown=breakdown,score_updated_at=now() WHERE id=o.id;
  RETURN jsonb_build_object('score',total_score,'calculated_temperature',calculated,'effective_temperature',COALESCE(o.temperature_override,calculated),'breakdown',breakdown);
END $$;
REVOKE ALL ON FUNCTION public.crm_recalculate_score_internal(uuid) FROM PUBLIC,anon,authenticated;

CREATE OR REPLACE FUNCTION public.recalculate_opportunity_score(p_opportunity_id uuid)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog,public AS $$
BEGIN
  IF auth.uid() IS NULL OR NOT (public.has_permission('settings.manage') OR public.has_permission('crm.delete')) THEN RAISE EXCEPTION 'permission denied' USING errcode='42501'; END IF;
  RETURN public.crm_recalculate_score_internal(p_opportunity_id);
END $$;

CREATE OR REPLACE FUNCTION public.set_opportunity_temperature_override(p_opportunity_id uuid,p_override text)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog,public AS $$
BEGIN
  IF auth.uid() IS NULL OR NOT public.has_permission('crm.update') THEN RAISE EXCEPTION 'permission denied' USING errcode='42501'; END IF;
  IF p_override IS NOT NULL AND p_override NOT IN('cold','warm','hot') THEN RAISE EXCEPTION 'invalid temperature' USING errcode='22023'; END IF;
  UPDATE public.opportunities SET temperature_override=p_override WHERE id=p_opportunity_id;
  IF NOT FOUND THEN RAISE EXCEPTION 'opportunity not found' USING errcode='P0002'; END IF;
  RETURN public.crm_recalculate_score_internal(p_opportunity_id);
END $$;

CREATE OR REPLACE FUNCTION public.crm_score_opportunity_trigger()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog,public AS $$
BEGIN PERFORM public.crm_recalculate_score_internal(NEW.id); RETURN NEW; END $$;
REVOKE ALL ON FUNCTION public.crm_score_opportunity_trigger() FROM PUBLIC,anon,authenticated;
DROP TRIGGER IF EXISTS opportunities_refresh_score ON public.opportunities;
CREATE TRIGGER opportunities_refresh_score AFTER INSERT OR UPDATE OF estimated_quantity,desired_delivery_date,stage_id,source_id,contact_id,customer_id,last_activity_at,next_activity_at,temperature_override ON public.opportunities FOR EACH ROW EXECUTE FUNCTION public.crm_score_opportunity_trigger();

CREATE OR REPLACE FUNCTION public.crm_stage_history_trigger()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog,public AS $$
BEGIN
  IF TG_OP='INSERT' OR NEW.stage_id IS DISTINCT FROM OLD.stage_id THEN
    IF TG_OP='UPDATE' THEN UPDATE public.opportunity_stage_history SET left_at=NEW.stage_entered_at WHERE opportunity_id=NEW.id AND left_at IS NULL; END IF;
    INSERT INTO public.opportunity_stage_history(opportunity_id,from_stage_id,to_stage_id,entered_at,changed_by)
    VALUES(NEW.id,CASE WHEN TG_OP='UPDATE' THEN OLD.stage_id END,NEW.stage_id,NEW.stage_entered_at,auth.uid());
  END IF;
  RETURN NEW;
END $$;
REVOKE ALL ON FUNCTION public.crm_stage_history_trigger() FROM PUBLIC,anon,authenticated;
DROP TRIGGER IF EXISTS opportunities_stage_history ON public.opportunities;
CREATE TRIGGER opportunities_stage_history AFTER INSERT OR UPDATE OF stage_id ON public.opportunities FOR EACH ROW EXECUTE FUNCTION public.crm_stage_history_trigger();

INSERT INTO public.opportunity_stage_history(opportunity_id,from_stage_id,to_stage_id,entered_at,left_at,changed_by)
SELECT o.id,NULL,o.stage_id,o.stage_entered_at,NULL,o.created_by FROM public.opportunities o
WHERE NOT EXISTS(SELECT 1 FROM public.opportunity_stage_history h WHERE h.opportunity_id=o.id);

CREATE UNIQUE INDEX IF NOT EXISTS automation_rules_seed_unique_idx ON public.automation_rules(name,event);

INSERT INTO public.automation_rules(name,event,conditions,action_type,action_config) VALUES
('Follow-up após orçamento enviado','opportunity.stage_changed','{"stage_code":"quote_sent"}','CREATE_TASK','{"title":"Follow-up do orçamento","type":"follow_up","priority":"high","use_follow_up_setting":true}'),
('Segundo follow-up do orçamento','daily_check','{"stage_code":"quote_sent","use_second_follow_up_setting":true}','CREATE_TASK','{"title":"Segundo follow-up do orçamento","type":"follow_up","priority":"high","business_days":0}'),
('Alerta sem retorno do orçamento','daily_check','{"stage_code":"quote_sent","use_third_alert_setting":true}','CREATE_NOTIFICATION','{"type":"follow_up_alert","title":"Orçamento aguardando retorno"}'),
('Oportunidade parada','daily_check','{"use_stale_setting":true}','CREATE_NOTIFICATION','{"type":"opportunity_stale","title":"Oportunidade parada"}'),
('Atualizar score diariamente','daily_check','{}','UPDATE_SCORE','{}')
ON CONFLICT(name,event) DO UPDATE SET conditions=EXCLUDED.conditions,action_type=EXCLUDED.action_type,action_config=EXCLUDED.action_config;

CREATE OR REPLACE FUNCTION public.crm_execute_automation(p_rule_id uuid,p_opportunity_id uuid,p_idempotency_key text)
RETURNS boolean LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog,public AS $$
DECLARE rule public.automation_rules%ROWTYPE; o public.opportunities%ROWTYPE; run_id uuid; days integer; due_date timestamptz; use_business boolean;
BEGIN
  SELECT * INTO rule FROM public.automation_rules WHERE id=p_rule_id AND active;
  SELECT * INTO o FROM public.opportunities WHERE id=p_opportunity_id;
  IF rule.id IS NULL OR o.id IS NULL THEN RETURN false; END IF;
  INSERT INTO public.automation_runs(rule_id,entity_type,entity_id,status,idempotency_key)
  VALUES(rule.id,'opportunity',o.id,'running',p_idempotency_key) ON CONFLICT(idempotency_key) DO NOTHING RETURNING id INTO run_id;
  IF run_id IS NULL THEN RETURN false; END IF;
  BEGIN
    IF rule.action_type='CREATE_TASK' THEN
      days:=CASE WHEN COALESCE((rule.action_config->>'use_follow_up_setting')::boolean,false) THEN (SELECT follow_up_default_days FROM public.commercial_settings WHERE id) ELSE COALESCE((rule.action_config->>'business_days')::integer,0) END;
      SELECT use_business_days INTO use_business FROM public.commercial_settings WHERE id;
      due_date:=CASE WHEN use_business THEN public.crm_add_business_days(now(),days) ELSE now()+make_interval(days=>days) END;
      INSERT INTO public.tasks(opportunity_id,customer_id,contact_id,assigned_user_id,type,title,description,due_at,priority,created_by)
      VALUES(o.id,o.customer_id,o.contact_id,o.assigned_user_id,COALESCE(rule.action_config->>'type','follow_up'),COALESCE(rule.action_config->>'title',rule.name),'Criada automaticamente pela regra '||rule.name,due_date,COALESCE(rule.action_config->>'priority','normal'),o.assigned_user_id);
    ELSIF rule.action_type='CREATE_NOTIFICATION' THEN
      INSERT INTO public.notifications(user_id,type,title,body,entity_type,entity_id,idempotency_key)
      VALUES(o.assigned_user_id,COALESCE(rule.action_config->>'type','opportunity_stale'),COALESCE(rule.action_config->>'title',rule.name),
        o.title||' requer atenção.','opportunity',o.id,'notification:'||p_idempotency_key) ON CONFLICT(idempotency_key) DO NOTHING;
    ELSIF rule.action_type='UPDATE_SCORE' THEN
      PERFORM public.crm_recalculate_score_internal(o.id);
    END IF;
    UPDATE public.automation_runs SET status='success',result=jsonb_build_object('action',rule.action_type) WHERE id=run_id;
    RETURN true;
  EXCEPTION WHEN OTHERS THEN
    UPDATE public.automation_runs SET status='failed',result=jsonb_build_object('sqlstate',SQLSTATE) WHERE id=run_id;
    RETURN false;
  END;
END $$;
REVOKE ALL ON FUNCTION public.crm_execute_automation(uuid,uuid,text) FROM PUBLIC,anon,authenticated;

CREATE OR REPLACE FUNCTION public.crm_opportunity_automation_trigger()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog,public AS $$
DECLARE r public.automation_rules%ROWTYPE; stage_code text; event_name text;
BEGIN
  event_name:=CASE WHEN TG_OP='INSERT' THEN 'opportunity.created' ELSE 'opportunity.stage_changed' END;
  IF TG_OP='UPDATE' AND NEW.stage_id IS NOT DISTINCT FROM OLD.stage_id THEN RETURN NEW; END IF;
  SELECT code INTO stage_code FROM public.pipeline_stages WHERE id=NEW.stage_id;
  FOR r IN SELECT * FROM public.automation_rules WHERE active AND event=event_name LOOP
    IF r.conditions->>'stage_code' IS NULL OR r.conditions->>'stage_code'=stage_code THEN
      PERFORM public.crm_execute_automation(r.id,NEW.id,r.id::text||':'||NEW.id::text||':'||event_name||':'||NEW.stage_entered_at::text);
    END IF;
  END LOOP;
  INSERT INTO public.notifications(user_id,type,title,body,entity_type,entity_id,idempotency_key)
  VALUES(NEW.assigned_user_id,'opportunity_assigned','Oportunidade atribuída',NEW.title,'opportunity',NEW.id,
    'opportunity-assigned:'||NEW.id::text||':'||NEW.assigned_user_id::text) ON CONFLICT(idempotency_key) DO NOTHING;
  RETURN NEW;
END $$;
REVOKE ALL ON FUNCTION public.crm_opportunity_automation_trigger() FROM PUBLIC,anon,authenticated;
DROP TRIGGER IF EXISTS opportunities_run_automation ON public.opportunities;
CREATE TRIGGER opportunities_run_automation AFTER INSERT OR UPDATE OF stage_id,assigned_user_id ON public.opportunities FOR EACH ROW EXECUTE FUNCTION public.crm_opportunity_automation_trigger();

CREATE OR REPLACE FUNCTION public.crm_lead_assignment_notification()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog,public AS $$
BEGIN
  IF TG_OP='INSERT' OR NEW.assigned_user_id IS DISTINCT FROM OLD.assigned_user_id THEN
    INSERT INTO public.notifications(user_id,type,title,body,entity_type,entity_id,idempotency_key)
    VALUES(NEW.assigned_user_id,'lead_assigned','Novo lead atribuído',NEW.name,'lead',NEW.id,
      'lead-assigned:'||NEW.id::text||':'||NEW.assigned_user_id::text) ON CONFLICT(idempotency_key) DO NOTHING;
  END IF; RETURN NEW;
END $$;
REVOKE ALL ON FUNCTION public.crm_lead_assignment_notification() FROM PUBLIC,anon,authenticated;
DROP TRIGGER IF EXISTS leads_assignment_notification ON public.leads;
CREATE TRIGGER leads_assignment_notification AFTER INSERT OR UPDATE OF assigned_user_id ON public.leads FOR EACH ROW EXECUTE FUNCTION public.crm_lead_assignment_notification();

CREATE OR REPLACE FUNCTION public.crm_related_event_automation_trigger()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog,public AS $$
DECLARE r public.automation_rules%ROWTYPE; opportunity_id uuid; event_name text; event_key text;
BEGIN
  IF TG_TABLE_NAME='activities' THEN opportunity_id:=NEW.opportunity_id; event_name:='opportunity.activity_created'; event_key:=NEW.id::text;
  ELSIF TG_TABLE_NAME='tasks' AND TG_OP='UPDATE' AND NEW.status='completed' AND OLD.status IS DISTINCT FROM NEW.status THEN opportunity_id:=NEW.opportunity_id; event_name:='task.completed'; event_key:=NEW.id::text;
  ELSE RETURN NEW; END IF;
  IF opportunity_id IS NULL THEN RETURN NEW; END IF;
  FOR r IN SELECT * FROM public.automation_rules WHERE active AND event=event_name LOOP
    PERFORM public.crm_execute_automation(r.id,opportunity_id,r.id::text||':'||opportunity_id::text||':'||event_name||':'||event_key);
  END LOOP;
  RETURN NEW;
END $$;
REVOKE ALL ON FUNCTION public.crm_related_event_automation_trigger() FROM PUBLIC,anon,authenticated;
DROP TRIGGER IF EXISTS activities_run_commercial_automation ON public.activities;
CREATE TRIGGER activities_run_commercial_automation AFTER INSERT ON public.activities FOR EACH ROW EXECUTE FUNCTION public.crm_related_event_automation_trigger();
DROP TRIGGER IF EXISTS tasks_run_commercial_automation ON public.tasks;
CREATE TRIGGER tasks_run_commercial_automation AFTER UPDATE OF status ON public.tasks FOR EACH ROW EXECUTE FUNCTION public.crm_related_event_automation_trigger();

CREATE OR REPLACE FUNCTION public.crm_order_score_trigger()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog,public AS $$
DECLARE opportunity_id uuid;
BEGIN
  FOR opportunity_id IN SELECT o.id FROM public.opportunities o WHERE o.customer_id=NEW.cliente_id AND o.status='open' LOOP PERFORM public.crm_recalculate_score_internal(opportunity_id); END LOOP;
  IF TG_OP='UPDATE' AND OLD.cliente_id IS DISTINCT FROM NEW.cliente_id THEN
    FOR opportunity_id IN SELECT o.id FROM public.opportunities o WHERE o.customer_id=OLD.cliente_id AND o.status='open' LOOP PERFORM public.crm_recalculate_score_internal(opportunity_id); END LOOP;
  END IF;
  RETURN NEW;
END $$;
REVOKE ALL ON FUNCTION public.crm_order_score_trigger() FROM PUBLIC,anon,authenticated;
DROP TRIGGER IF EXISTS pedidos_refresh_commercial_score ON public.pedidos;
CREATE TRIGGER pedidos_refresh_commercial_score AFTER INSERT OR UPDATE OF cliente_id,status ON public.pedidos FOR EACH ROW EXECUTE FUNCTION public.crm_order_score_trigger();

CREATE OR REPLACE FUNCTION public.run_commercial_daily_check()
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog,public AS $$
DECLARE o public.opportunities%ROWTYPE; r public.automation_rules%ROWTYPE; s public.commercial_settings%ROWTYPE; stage_code text;
  inactivity_days integer; stage_days integer; executed integer:=0; overdue_created integer:=0;
BEGIN
  SELECT * INTO s FROM public.commercial_settings WHERE id;
  FOR o IN SELECT * FROM public.opportunities WHERE status='open' LOOP
    stage_days:=floor(extract(epoch FROM (now()-o.stage_entered_at))/86400);
    inactivity_days:=floor(extract(epoch FROM (now()-COALESCE(o.last_activity_at,o.created_at)))/86400);
    SELECT code INTO stage_code FROM public.pipeline_stages WHERE id=o.stage_id;
    FOR r IN SELECT * FROM public.automation_rules WHERE active AND event='daily_check' LOOP
      IF (r.conditions->>'stage_code' IS NULL OR r.conditions->>'stage_code'=stage_code)
        AND (r.conditions->>'min_stage_days' IS NULL OR stage_days>=(r.conditions->>'min_stage_days')::integer)
        AND (r.conditions->>'min_inactive_days' IS NULL OR inactivity_days>=(r.conditions->>'min_inactive_days')::integer)
        AND (COALESCE((r.conditions->>'use_second_follow_up_setting')::boolean,false)=false OR stage_days>=s.second_follow_up_days)
        AND (COALESCE((r.conditions->>'use_third_alert_setting')::boolean,false)=false OR inactivity_days>=s.third_alert_days)
        AND (COALESCE((r.conditions->>'use_stale_setting')::boolean,false)=false OR inactivity_days>=s.stale_opportunity_days) THEN
        IF public.crm_execute_automation(r.id,o.id,r.id::text||':'||o.id::text||':daily:'||o.stage_entered_at::text) THEN executed:=executed+1; END IF;
      END IF;
    END LOOP;
  END LOOP;
  INSERT INTO public.notifications(user_id,type,title,body,entity_type,entity_id,idempotency_key)
  SELECT t.assigned_user_id,'task_overdue','Tarefa vencida',t.title,'task',t.id,'task-overdue:'||t.id::text
  FROM public.tasks t WHERE t.status='pending' AND t.due_at<now()
  ON CONFLICT(idempotency_key) DO NOTHING;
  GET DIAGNOSTICS overdue_created=ROW_COUNT;
  RETURN jsonb_build_object('automation_runs',executed,'overdue_notifications',overdue_created,'executed_at',now());
END $$;
REVOKE ALL ON FUNCTION public.run_commercial_daily_check() FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.run_commercial_daily_check() TO service_role;

CREATE OR REPLACE FUNCTION public.run_commercial_daily_check_now()
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog,public AS $$
BEGIN
  IF auth.uid() IS NULL OR NOT (public.has_permission('settings.manage') OR public.has_permission('crm.delete')) THEN RAISE EXCEPTION 'permission denied' USING errcode='42501'; END IF;
  RETURN public.run_commercial_daily_check();
END $$;

CREATE OR REPLACE FUNCTION public.win_opportunity(p_opportunity_id uuid,p_final_value numeric,p_closed_at timestamptz,p_notes text,p_expected_stage_entered_at timestamptz)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog,public AS $$
DECLARE o public.opportunities%ROWTYPE; won_stage public.pipeline_stages%ROWTYPE;
BEGIN
  IF auth.uid() IS NULL OR NOT public.has_permission('crm.update') THEN RAISE EXCEPTION 'permission denied' USING errcode='42501'; END IF;
  IF p_final_value IS NULL OR p_final_value<0 THEN RAISE EXCEPTION 'final value required' USING errcode='22023'; END IF;
  IF p_closed_at IS NULL OR p_closed_at>now()+interval '5 minutes' THEN RAISE EXCEPTION 'invalid closing date' USING errcode='22023'; END IF;
  SELECT * INTO o FROM public.opportunities WHERE id=p_opportunity_id FOR UPDATE;
  IF NOT FOUND OR o.status<>'open' THEN RAISE EXCEPTION 'opportunity is not open' USING errcode='22023'; END IF;
  IF p_expected_stage_entered_at IS NOT NULL AND o.stage_entered_at<>p_expected_stage_entered_at THEN RAISE EXCEPTION 'opportunity changed concurrently' USING errcode='40001'; END IF;
  SELECT * INTO won_stage FROM public.pipeline_stages WHERE pipeline_id=o.pipeline_id AND active AND is_won;
  IF NOT FOUND THEN RAISE EXCEPTION 'won stage unavailable' USING errcode='55000'; END IF;
  UPDATE public.opportunities SET stage_id=won_stage.id,stage_entered_at=now(),status='won',final_value=p_final_value,won_at=p_closed_at,lost_at=NULL,loss_reason_id=NULL,competitor_name=NULL WHERE id=o.id;
  INSERT INTO public.activities(opportunity_id,customer_id,contact_id,user_id,type,title,description,metadata,occurred_at)
  VALUES(o.id,o.customer_id,o.contact_id,auth.uid(),'stage_change','Oportunidade ganha',NULLIF(trim(p_notes),''),jsonb_build_object('from_stage_id',o.stage_id,'to_stage_id',won_stage.id,'final_value',p_final_value),p_closed_at);
  RETURN jsonb_build_object('id',o.id,'status','won','final_value',p_final_value,'won_at',p_closed_at);
END $$;

CREATE OR REPLACE FUNCTION public.crm_validate_pipeline_terminals()
RETURNS trigger LANGUAGE plpgsql SET search_path=pg_catalog,public AS $$
BEGIN
  IF NEW.active AND NEW.is_won AND EXISTS(SELECT 1 FROM public.pipeline_stages s WHERE s.pipeline_id=NEW.pipeline_id AND s.active AND s.is_won AND s.id<>NEW.id) THEN RAISE EXCEPTION 'pipeline already has won stage' USING errcode='23505'; END IF;
  IF NEW.active AND NEW.is_lost AND EXISTS(SELECT 1 FROM public.pipeline_stages s WHERE s.pipeline_id=NEW.pipeline_id AND s.active AND s.is_lost AND s.id<>NEW.id) THEN RAISE EXCEPTION 'pipeline already has lost stage' USING errcode='23505'; END IF;
  RETURN NEW;
END $$;
REVOKE ALL ON FUNCTION public.crm_validate_pipeline_terminals() FROM PUBLIC,anon,authenticated;
DROP TRIGGER IF EXISTS pipeline_stages_validate_terminals ON public.pipeline_stages;
CREATE TRIGGER pipeline_stages_validate_terminals BEFORE INSERT OR UPDATE OF pipeline_id,active,is_won,is_lost ON public.pipeline_stages FOR EACH ROW EXECUTE FUNCTION public.crm_validate_pipeline_terminals();

CREATE OR REPLACE FUNCTION public.get_commercial_central(p_user_id uuid DEFAULT NULL)
RETURNS jsonb LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path=pg_catalog,public AS $$
DECLARE target_user uuid:=COALESCE(p_user_id,auth.uid()); is_manager boolean; stale_days integer;
BEGIN
  IF auth.uid() IS NULL OR NOT public.has_permission('crm.view') THEN RAISE EXCEPTION 'permission denied' USING errcode='42501'; END IF;
  IF NOT public.crm_can_view_commercial_user(target_user) THEN RAISE EXCEPTION 'permission denied' USING errcode='42501'; END IF;
  SELECT EXISTS(SELECT 1 FROM public.user_roles ur JOIN public.roles r ON r.id=ur.role_id WHERE ur.user_id=auth.uid() AND r.code IN('administrator','manager')) INTO is_manager;
  IF target_user<>auth.uid() AND NOT is_manager THEN RAISE EXCEPTION 'permission denied' USING errcode='42501'; END IF;
  SELECT stale_opportunity_days INTO stale_days FROM public.commercial_settings WHERE id;
  RETURN jsonb_build_object(
    'attention',jsonb_build_object(
      'overdue_tasks',(SELECT count(*) FROM public.tasks WHERE assigned_user_id=target_user AND status='pending' AND due_at<now()),
      'today_tasks',(SELECT count(*) FROM public.tasks WHERE assigned_user_id=target_user AND status='pending' AND (due_at AT TIME ZONE 'America/Sao_Paulo')::date=(now() AT TIME ZONE 'America/Sao_Paulo')::date),
      'new_leads',(SELECT count(*) FROM public.leads WHERE assigned_user_id=target_user AND status='new'),
      'hot_opportunities',(SELECT count(*) FROM public.opportunities WHERE assigned_user_id=target_user AND status='open' AND temperature='hot'),
      'without_next_action',(SELECT count(*) FROM public.opportunities o WHERE o.assigned_user_id=target_user AND o.status='open' AND NOT EXISTS(SELECT 1 FROM public.tasks t WHERE t.opportunity_id=o.id AND t.status='pending' AND t.due_at>=now())),
      'stale',(SELECT count(*) FROM public.opportunities WHERE assigned_user_id=target_user AND status='open' AND COALESCE(last_activity_at,created_at)<now()-make_interval(days=>stale_days)),
      'waiting_approval_value',(SELECT COALESCE(sum(o.estimated_value),0) FROM public.opportunities o JOIN public.pipeline_stages s ON s.id=o.stage_id WHERE o.assigned_user_id=target_user AND o.status='open' AND s.code='waiting_approval')
    ),
    'priorities',(SELECT COALESCE(jsonb_agg(to_jsonb(p) ORDER BY p.priority_score DESC,p.estimated_value DESC),'[]'::jsonb) FROM (
      SELECT o.id,o.title,o.score,o.estimated_value,o.expected_close_date,o.temperature,c.nome customer_name,
        ((CASE WHEN EXISTS(SELECT 1 FROM public.tasks t WHERE t.opportunity_id=o.id AND t.status='pending' AND t.due_at<now()) THEN 50 ELSE 0 END)+
         (CASE WHEN NOT EXISTS(SELECT 1 FROM public.tasks t WHERE t.opportunity_id=o.id AND t.status='pending' AND t.due_at>=now()) THEN 30 ELSE 0 END)+
         o.score+(CASE WHEN o.expected_close_date<current_date THEN 25 ELSE 0 END)) priority_score,
        concat_ws(' + ',CASE WHEN EXISTS(SELECT 1 FROM public.tasks t WHERE t.opportunity_id=o.id AND t.status='pending' AND t.due_at<now()) THEN 'Follow-up atrasado' END,
          CASE WHEN o.temperature='hot' THEN 'Oportunidade quente' END,
          CASE WHEN NOT EXISTS(SELECT 1 FROM public.tasks t WHERE t.opportunity_id=o.id AND t.status='pending' AND t.due_at>=now()) THEN 'Sem próxima ação' END,
          CASE WHEN COALESCE(o.last_activity_at,o.created_at)<now()-make_interval(days=>stale_days) THEN 'Oportunidade parada' END,
          CASE WHEN o.expected_close_date<current_date THEN 'Fechamento vencido' END) reason
      FROM public.opportunities o JOIN public.clientes c ON c.id=o.customer_id WHERE o.assigned_user_id=target_user AND o.status='open'
      ORDER BY priority_score DESC,o.estimated_value DESC LIMIT 30
    ) p),
    'tasks',(SELECT COALESCE(jsonb_agg(to_jsonb(t) ORDER BY t.due_at),'[]'::jsonb) FROM (
      SELECT t.id,t.title,t.type,t.priority,t.due_at,t.opportunity_id,o.title opportunity_title,c.nome customer_name
      FROM public.tasks t LEFT JOIN public.opportunities o ON o.id=t.opportunity_id LEFT JOIN public.clientes c ON c.id=t.customer_id
      WHERE t.assigned_user_id=target_user AND t.status='pending' AND t.due_at<date_trunc('day',now() AT TIME ZONE 'America/Sao_Paulo')+interval '1 day' ORDER BY t.due_at LIMIT 30
    ) t),
    'closing_soon',(SELECT COALESCE(jsonb_agg(to_jsonb(x) ORDER BY x.expected_close_date),'[]'::jsonb) FROM (
      SELECT o.id,o.title,o.estimated_value,o.score,o.expected_close_date,c.nome customer_name FROM public.opportunities o JOIN public.clientes c ON c.id=o.customer_id
      WHERE o.assigned_user_id=target_user AND o.status='open' AND o.expected_close_date BETWEEN current_date AND current_date+14 ORDER BY o.expected_close_date LIMIT 20
    ) x)
  );
END $$;

CREATE OR REPLACE FUNCTION public.get_commercial_analytics(p_start date,p_end date,p_user_id uuid DEFAULT NULL,p_source_id uuid DEFAULT NULL,p_pipeline_id uuid DEFAULT NULL)
RETURNS jsonb LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path=pg_catalog,public AS $$
DECLARE result jsonb; period_days integer:=GREATEST(1,p_end-p_start+1); previous_start date:=p_start-GREATEST(1,p_end-p_start+1); previous_value numeric; current_value numeric;
BEGIN
  IF auth.uid() IS NULL OR NOT public.has_permission('crm.view') THEN RAISE EXCEPTION 'permission denied' USING errcode='42501'; END IF;
  IF NOT public.crm_can_view_commercial_user(p_user_id) THEN RAISE EXCEPTION 'permission denied' USING errcode='42501'; END IF;
  IF p_end<p_start OR p_end-p_start>730 THEN RAISE EXCEPTION 'invalid period' USING errcode='22023'; END IF;
  WITH cohort AS (
    SELECT o.* FROM public.opportunities o WHERE o.created_at>=p_start::timestamptz AND o.created_at<(p_end+1)::timestamptz
      AND (p_user_id IS NULL OR o.assigned_user_id=p_user_id) AND (p_source_id IS NULL OR o.source_id=p_source_id) AND (p_pipeline_id IS NULL OR o.pipeline_id=p_pipeline_id)
  ), closed AS (SELECT * FROM cohort WHERE status IN('won','lost')),
  item_totals AS (SELECT pedido_id,sum(qtde*valor_unitario) value FROM public.itens_pedido GROUP BY pedido_id),
  stage_metrics AS (
    SELECT s.id,s.name,s.position,s.probability,count(c.id) opportunity_count,COALESCE(sum(c.estimated_value),0) total_value,
      COALESCE(sum(c.estimated_value*s.probability/100.0),0) weighted_value,
      count(c.id) FILTER(WHERE c.status='open' AND COALESCE(c.last_activity_at,c.created_at)<now()-make_interval(days=>(SELECT stale_opportunity_days FROM public.commercial_settings WHERE id))) stale_count
    FROM public.pipeline_stages s LEFT JOIN cohort c ON c.stage_id=s.id WHERE s.active GROUP BY s.id ORDER BY s.position
  ), history_metrics AS (
    SELECT s.id stage_id,avg(extract(epoch FROM (COALESCE(h.left_at,now())-h.entered_at))/86400.0) avg_days,
      percentile_cont(0.5) WITHIN GROUP(ORDER BY extract(epoch FROM (COALESCE(h.left_at,now())-h.entered_at))/86400.0) median_days,
      count(DISTINCT h.opportunity_id) reached
    FROM public.opportunity_stage_history h JOIN public.pipeline_stages s ON s.id=h.to_stage_id JOIN cohort c ON c.id=h.opportunity_id GROUP BY s.id
  ), sellers AS (
    SELECT p.id,p.full_name,count(c.id) FILTER(WHERE c.status='open') open_count,COALESCE(sum(c.estimated_value) FILTER(WHERE c.status='open'),0) pipeline,
      COALESCE(sum(c.estimated_value*s.probability/100.0) FILTER(WHERE c.status='open'),0) weighted,count(c.id) FILTER(WHERE c.status='won') won_count,
      COALESCE(sum(c.final_value) FILTER(WHERE c.status='won'),0) won_value,count(c.id) FILTER(WHERE c.status='lost') lost_count,
      CASE WHEN count(c.id) FILTER(WHERE c.status IN('won','lost'))=0 THEN NULL ELSE round(100.0*count(c.id) FILTER(WHERE c.status='won')/count(c.id) FILTER(WHERE c.status IN('won','lost')),1) END conversion_rate,
      CASE WHEN count(c.id) FILTER(WHERE c.status='won')=0 THEN NULL ELSE round(avg(c.final_value) FILTER(WHERE c.status='won'),2) END avg_ticket,
      round(avg(extract(epoch FROM (c.won_at-c.created_at))/86400.0) FILTER(WHERE c.status='won'),1) avg_cycle_days,
      (SELECT count(*) FROM public.tasks t WHERE t.assigned_user_id=p.id AND t.status='pending' AND t.due_at<now()) overdue_tasks,
      count(c.id) FILTER(WHERE c.status='open' AND c.next_activity_at IS NULL) without_next_action,
      count(DISTINCT c.customer_id) FILTER(WHERE c.status='open') portfolio_customers,
      count(DISTINCT c.customer_id) FILTER(WHERE c.status='open' AND COALESCE(c.last_activity_at,c.created_at)<now()-make_interval(days=>(SELECT stale_opportunity_days FROM public.commercial_settings WHERE id))) customers_without_recent_contact
    FROM public.profiles p LEFT JOIN cohort c ON c.assigned_user_id=p.id LEFT JOIN public.pipeline_stages s ON s.id=c.stage_id WHERE p.active GROUP BY p.id
  ), sources AS (
    SELECT ls.id,ls.name,
      (SELECT count(*) FROM public.leads l WHERE l.source_id=ls.id AND l.created_at>=p_start::timestamptz AND l.created_at<(p_end+1)::timestamptz) leads,
      (SELECT count(*) FROM cohort c WHERE c.source_id=ls.id) opportunities,
      (SELECT count(*) FROM cohort c WHERE c.source_id=ls.id AND c.status='won') won,
      CASE WHEN (SELECT count(*) FROM cohort c WHERE c.source_id=ls.id)=0 THEN NULL ELSE round(100.0*(SELECT count(*) FROM cohort c WHERE c.source_id=ls.id AND c.status='won')/(SELECT count(*) FROM cohort c WHERE c.source_id=ls.id),1) END conversion_rate,
      (SELECT COALESCE(sum(c.final_value),0) FROM cohort c WHERE c.source_id=ls.id AND c.status='won') won_value,
      (SELECT round(avg(c.final_value),2) FROM cohort c WHERE c.source_id=ls.id AND c.status='won') avg_ticket,
      (SELECT round(avg(extract(epoch FROM (c.won_at-c.created_at))/86400.0),1) FROM cohort c WHERE c.source_id=ls.id AND c.status='won') avg_cycle_days,
      (SELECT COALESCE(sum(c.estimated_value),0) FROM cohort c WHERE c.source_id=ls.id AND c.status='open') pipeline
    FROM public.lead_sources ls ORDER BY won_value DESC
  )
  SELECT jsonb_build_object(
    'method','Coorte de oportunidades criadas no período; conversão usa negócios fechados dessa coorte.',
    'summary',jsonb_build_object('created',count(*),'open',count(*) FILTER(WHERE status='open'),'won',count(*) FILTER(WHERE status='won'),'lost',count(*) FILTER(WHERE status='lost'),
      'won_value',COALESCE(sum(final_value) FILTER(WHERE status='won'),0),'conversion_rate',CASE WHEN count(*) FILTER(WHERE status IN('won','lost'))=0 THEN NULL ELSE round(100.0*count(*) FILTER(WHERE status='won')/count(*) FILTER(WHERE status IN('won','lost')),1) END,
      'avg_ticket',round(avg(final_value) FILTER(WHERE status='won'),2),'avg_cycle_days',round(avg(extract(epoch FROM (won_at-created_at))/86400.0) FILTER(WHERE status='won'),1),
      'avg_first_contact_hours',(SELECT round(avg(extract(epoch FROM (first_activity-c.created_at))/3600.0),1) FROM cohort c JOIN LATERAL (SELECT min(a.occurred_at) first_activity FROM public.activities a WHERE a.opportunity_id=c.id) first_contact ON first_activity IS NOT NULL)),
    'funnel',(SELECT COALESCE(jsonb_agg(jsonb_build_object('id',sm.id,'name',sm.name,'position',sm.position,'probability',sm.probability,'count',sm.opportunity_count,'value',sm.total_value,'weighted',sm.weighted_value,'stale',sm.stale_count,'reached',COALESCE(hm.reached,0),'avg_days',round(hm.avg_days,1),'median_days',round(hm.median_days::numeric,1)) ORDER BY sm.position),'[]') FROM stage_metrics sm LEFT JOIN history_metrics hm ON hm.stage_id=sm.id),
    'sellers',(SELECT COALESCE(jsonb_agg(to_jsonb(s) ORDER BY s.won_value DESC),'[]') FROM sellers s),
    'sources',(SELECT COALESCE(jsonb_agg(to_jsonb(s)),'[]') FROM sources s),
    'losses',(SELECT COALESCE(jsonb_agg(to_jsonb(x) ORDER BY x.lost_value DESC),'[]') FROM (SELECT lr.name,count(c.id) count,COALESCE(sum(c.estimated_value),0) lost_value FROM public.loss_reasons lr LEFT JOIN cohort c ON c.loss_reason_id=lr.id AND c.status='lost' GROUP BY lr.id) x),
    'competitors',(SELECT COALESCE(jsonb_agg(to_jsonb(x) ORDER BY x.lost_value DESC),'[]') FROM (SELECT competitor_name name,count(*) count,sum(estimated_value) lost_value FROM cohort WHERE status='lost' AND competitor_name IS NOT NULL GROUP BY competitor_name LIMIT 20) x)
  ) INTO result FROM cohort;
  SELECT COALESCE(sum(final_value),0) INTO current_value FROM public.opportunities WHERE status='won' AND won_at>=p_start::timestamptz AND won_at<(p_end+1)::timestamptz AND (p_user_id IS NULL OR assigned_user_id=p_user_id);
  SELECT COALESCE(sum(final_value),0) INTO previous_value FROM public.opportunities WHERE status='won' AND won_at>=previous_start::timestamptz AND won_at<p_start::timestamptz AND (p_user_id IS NULL OR assigned_user_id=p_user_id);
  RETURN result||jsonb_build_object('comparison',jsonb_build_object('current_won_value',current_value,'previous_won_value',previous_value,'change_percent',CASE WHEN previous_value=0 THEN NULL ELSE round(100*(current_value-previous_value)/previous_value,1) END));
END $$;

REVOKE ALL ON FUNCTION public.recalculate_opportunity_score(uuid),public.set_opportunity_temperature_override(uuid,text),
  public.run_commercial_daily_check_now(),public.win_opportunity(uuid,numeric,timestamptz,text,timestamptz),
  public.get_commercial_central(uuid),public.get_commercial_analytics(date,date,uuid,uuid,uuid),public.get_sales_forecast(date,date,uuid),
  public.get_reactivation_customers(integer,text,numeric,integer,integer),public.create_reactivation_tasks(uuid[],uuid,timestamptz,text),
  public.save_commercial_settings(jsonb),public.save_crm_view(text,text,jsonb,boolean),public.mark_notification_read(uuid)
FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.recalculate_opportunity_score(uuid),public.set_opportunity_temperature_override(uuid,text),
  public.run_commercial_daily_check_now(),public.win_opportunity(uuid,numeric,timestamptz,text,timestamptz),
  public.get_commercial_central(uuid),public.get_commercial_analytics(date,date,uuid,uuid,uuid),public.get_sales_forecast(date,date,uuid),
  public.get_reactivation_customers(integer,text,numeric,integer,integer),public.create_reactivation_tasks(uuid[],uuid,timestamptz,text),
  public.save_commercial_settings(jsonb),public.save_crm_view(text,text,jsonb,boolean),public.mark_notification_read(uuid)
TO authenticated;

DO $$ DECLARE opportunity_id uuid; BEGIN
  FOR opportunity_id IN SELECT id FROM public.opportunities WHERE status='open' LOOP
    PERFORM public.crm_recalculate_score_internal(opportunity_id);
  END LOOP;
END $$;

COMMENT ON FUNCTION public.run_commercial_daily_check() IS 'Executar uma vez ao dia via Supabase Cron/pg_cron; idempotência garantida por automation_runs.';
COMMENT ON FUNCTION public.get_commercial_analytics(date,date,uuid,uuid,uuid) IS 'Coorte: oportunidades criadas no período informado.';
