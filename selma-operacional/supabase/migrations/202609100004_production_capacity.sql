-- Lote 8 — capacidade, rotas, planejamento, prazo seguro e gate de produção.
-- AGUARDANDO HOMOLOGAÇÃO.
BEGIN;

CREATE TABLE public.production_settings(
  id boolean PRIMARY KEY DEFAULT true CHECK(id),
  safety_buffer_days integer NOT NULL DEFAULT 1 CHECK(safety_buffer_days BETWEEN 0 AND 30),
  require_high_risk_approval boolean NOT NULL DEFAULT false,
  updated_by uuid REFERENCES public.profiles(id) ON DELETE SET NULL,
  updated_at timestamptz NOT NULL DEFAULT now()
);
INSERT INTO public.production_settings(id) VALUES(true) ON CONFLICT DO NOTHING;

CREATE TABLE public.production_workcenters(
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  code text NOT NULL UNIQUE CHECK(code~'^[a-z][a-z0-9_]*$'),
  name text NOT NULL,
  capacity_unit text NOT NULL CHECK(capacity_unit IN('piece','minute','point','meter','hour')),
  daily_capacity numeric(14,2) NOT NULL CHECK(daily_capacity>0),
  working_days smallint[] NOT NULL DEFAULT ARRAY[1,2,3,4,5],
  active boolean NOT NULL DEFAULT true,
  calendar_id uuid,
  notes text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CHECK(cardinality(working_days)>0 AND working_days<@ARRAY[0,1,2,3,4,5,6]::smallint[])
);

INSERT INTO public.production_workcenters(code,name,capacity_unit,daily_capacity) VALUES
('cut','Corte','piece',800),('embroidery','Bordado','piece',450),('dtf','DTF','piece',500),('sublimation','Sublimação','piece',400),('sewing','Costura','piece',300),('workshop','Oficinas','piece',250),('finishing','Acabamento','piece',600),('dispatch','Expedição','piece',800)
ON CONFLICT(code) DO NOTHING;

CREATE TABLE public.production_plans(
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  order_id uuid NOT NULL REFERENCES public.pedidos(id) ON DELETE RESTRICT,
  version integer NOT NULL CHECK(version>0),
  status text NOT NULL DEFAULT 'draft' CHECK(status IN('draft','blocked','ready','released','in_progress','completed','cancelled')),
  requested_delivery_date date NOT NULL,
  safe_delivery_date date,
  committed_delivery_date date,
  risk_level text NOT NULL DEFAULT 'attention' CHECK(risk_level IN('safe','attention','high_risk','impossible')),
  explanation jsonb NOT NULL DEFAULT '[]'::jsonb CHECK(jsonb_typeof(explanation)='array'),
  blocking_reasons jsonb NOT NULL DEFAULT '[]'::jsonb CHECK(jsonb_typeof(blocking_reasons)='array'),
  calculation_mode text NOT NULL DEFAULT 'confirmed' CHECK(calculation_mode IN('estimate','confirmed')),
  order_revision integer NOT NULL,
  calculated_at timestamptz NOT NULL DEFAULT now(),
  approved_by uuid REFERENCES public.profiles(id) ON DELETE SET NULL,
  approved_at timestamptz,
  override_reason text,
  notes text,
  created_by uuid NOT NULL REFERENCES public.profiles(id) ON DELETE RESTRICT DEFAULT auth.uid(),
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(order_id,version)
);
CREATE UNIQUE INDEX production_plans_active_order_idx ON public.production_plans(order_id) WHERE status IN('draft','blocked','ready','released','in_progress');

CREATE TABLE public.production_routes(
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  order_id uuid NOT NULL REFERENCES public.pedidos(id) ON DELETE RESTRICT,
  production_plan_id uuid REFERENCES public.production_plans(id) ON DELETE CASCADE,
  source text NOT NULL CHECK(source IN('product','customization','template','manual','calculated')),
  status text NOT NULL DEFAULT 'draft' CHECK(status IN('draft','planned','released','in_progress','completed','cancelled')),
  created_by uuid NOT NULL REFERENCES public.profiles(id) ON DELETE RESTRICT DEFAULT auth.uid(),
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE public.production_route_steps(
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  production_route_id uuid NOT NULL REFERENCES public.production_routes(id) ON DELETE CASCADE,
  workcenter_id uuid NOT NULL REFERENCES public.production_workcenters(id) ON DELETE RESTRICT,
  position integer NOT NULL CHECK(position>0),
  estimated_quantity numeric(14,2) NOT NULL CHECK(estimated_quantity>0),
  estimated_duration numeric(14,2) CHECK(estimated_duration IS NULL OR estimated_duration>0),
  status text NOT NULL DEFAULT 'pending' CHECK(status IN('pending','planned','in_progress','completed','skipped','cancelled')),
  planned_start date,
  planned_end date,
  actual_start timestamptz,
  actual_end timestamptz,
  notes text,
  UNIQUE(production_route_id,position)
);

CREATE INDEX production_plans_order_idx ON public.production_plans(order_id,version DESC);
CREATE INDEX production_plans_risk_idx ON public.production_plans(risk_level,status);
CREATE INDEX production_routes_order_idx ON public.production_routes(order_id,status);
CREATE INDEX production_steps_workcenter_start_idx ON public.production_route_steps(workcenter_id,planned_start);
CREATE INDEX production_steps_workcenter_end_idx ON public.production_route_steps(workcenter_id,planned_end);
CREATE INDEX production_steps_route_idx ON public.production_route_steps(production_route_id,position);

ALTER TABLE public.production_settings ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.production_workcenters ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.production_plans ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.production_routes ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.production_route_steps ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.production_settings,public.production_workcenters,public.production_plans,public.production_routes,public.production_route_steps FROM PUBLIC,anon;
GRANT SELECT ON public.production_settings,public.production_workcenters,public.production_plans,public.production_routes,public.production_route_steps TO authenticated;
GRANT INSERT,UPDATE ON public.production_settings,public.production_workcenters,public.production_plans,public.production_routes,public.production_route_steps TO authenticated;
CREATE POLICY production_settings_view ON public.production_settings FOR SELECT TO authenticated USING(public.has_permission('production.view'));
CREATE POLICY production_settings_manage ON public.production_settings FOR ALL TO authenticated USING(public.has_permission('settings.manage')) WITH CHECK(public.has_permission('settings.manage'));
CREATE POLICY workcenters_view ON public.production_workcenters FOR SELECT TO authenticated USING(public.has_permission('production.view') OR public.has_permission('quotes.view'));
CREATE POLICY workcenters_manage ON public.production_workcenters FOR ALL TO authenticated USING(public.has_permission('production.update')) WITH CHECK(public.has_permission('production.update'));
CREATE POLICY plans_view ON public.production_plans FOR SELECT TO authenticated USING(public.has_permission('production.view') OR public.has_permission('orders.view'));
CREATE POLICY plans_manage ON public.production_plans FOR ALL TO authenticated USING(public.has_permission('production.update')) WITH CHECK(public.has_permission('production.update'));
CREATE POLICY routes_view ON public.production_routes FOR SELECT TO authenticated USING(public.has_permission('production.view') OR public.has_permission('orders.view'));
CREATE POLICY routes_manage ON public.production_routes FOR ALL TO authenticated USING(public.has_permission('production.update')) WITH CHECK(public.has_permission('production.update'));
CREATE POLICY steps_view ON public.production_route_steps FOR SELECT TO authenticated USING(public.has_permission('production.view') OR public.has_permission('orders.view'));
CREATE POLICY steps_manage ON public.production_route_steps FOR ALL TO authenticated USING(public.has_permission('production.update')) WITH CHECK(public.has_permission('production.update'));

CREATE OR REPLACE FUNCTION public.operational_add_business_days(p_start date,p_days integer,p_workcenter_id uuid DEFAULT NULL)
RETURNS date LANGUAGE plpgsql STABLE SET search_path=pg_catalog,public AS $$
DECLARE result date:=p_start; added integer:=0; allowed smallint[]:=ARRAY[1,2,3,4,5];
BEGIN
  IF p_days<0 THEN RAISE EXCEPTION 'days must be nonnegative' USING errcode='22023'; END IF;
  IF p_workcenter_id IS NOT NULL THEN SELECT working_days INTO allowed FROM public.production_workcenters WHERE id=p_workcenter_id; END IF;
  WHILE added<p_days LOOP result:=result+1; IF extract(dow FROM result)::smallint=ANY(allowed) AND NOT EXISTS(SELECT 1 FROM public.feriados f WHERE f.data=result) THEN added:=added+1; END IF; END LOOP;
  RETURN result;
END $$;

CREATE OR REPLACE FUNCTION public.insert_production_step(p_route_id uuid,p_workcenter_code text,p_position integer,p_quantity numeric)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog,public AS $$
DECLARE center public.production_workcenters%ROWTYPE;
BEGIN
  SELECT * INTO center FROM public.production_workcenters WHERE code=p_workcenter_code AND active;
  IF NOT FOUND THEN RAISE EXCEPTION 'workcenter unavailable: %',p_workcenter_code USING errcode='P0002'; END IF;
  INSERT INTO public.production_route_steps(production_route_id,workcenter_id,position,estimated_quantity,estimated_duration)
  VALUES(p_route_id,center.id,p_position,p_quantity,ceil(p_quantity/center.daily_capacity));
END $$;
REVOKE ALL ON FUNCTION public.insert_production_step(uuid,text,integer,numeric) FROM PUBLIC,anon,authenticated;

CREATE OR REPLACE FUNCTION public.generate_order_routing(p_order_id uuid)
RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog,public AS $$
DECLARE route_id uuid; quantity numeric; order_row public.pedidos%ROWTYPE; position_no integer:=0; customization text; center_code text;
BEGIN
  IF auth.uid() IS NULL OR NOT public.has_permission('production.update') THEN RAISE EXCEPTION 'permission denied' USING errcode='42501'; END IF;
  SELECT * INTO order_row FROM public.pedidos WHERE id=p_order_id FOR UPDATE; IF NOT FOUND OR order_row.status='cancelado' THEN RAISE EXCEPTION 'order unavailable' USING errcode='P0002'; END IF;
  SELECT COALESCE(sum(qtde),0) INTO quantity FROM public.itens_pedido WHERE pedido_id=p_order_id; IF quantity<=0 THEN RAISE EXCEPTION 'order items required' USING errcode='23514'; END IF;
  UPDATE public.production_routes SET status='cancelled' WHERE order_id=p_order_id AND status IN('draft','planned','released');
  INSERT INTO public.production_routes(order_id,source,status) VALUES(p_order_id,'calculated','draft') RETURNING id INTO route_id;
  customization:=lower(COALESCE(order_row.tipo_estampa,''));
  IF customization LIKE '%sublim%' THEN center_code:='sublimation';position_no:=position_no+1;PERFORM public.insert_production_step(route_id,center_code,position_no,quantity); END IF;
  center_code:='cut';position_no:=position_no+1;PERFORM public.insert_production_step(route_id,center_code,position_no,quantity);
  IF customization LIKE '%bord%' THEN center_code:='embroidery';position_no:=position_no+1;PERFORM public.insert_production_step(route_id,center_code,position_no,quantity);
  ELSIF customization LIKE '%dtf%' THEN center_code:='dtf';position_no:=position_no+1;PERFORM public.insert_production_step(route_id,center_code,position_no,quantity);
  ELSIF customization<>'' AND customization NOT LIKE '%sublim%' THEN center_code:='workshop';position_no:=position_no+1;PERFORM public.insert_production_step(route_id,center_code,position_no,quantity); END IF;
  IF order_row.etapas_ativas IS NULL OR 'costura'=ANY(order_row.etapas_ativas) THEN center_code:='sewing';position_no:=position_no+1;PERFORM public.insert_production_step(route_id,center_code,position_no,quantity); END IF;
  center_code:='finishing';position_no:=position_no+1;PERFORM public.insert_production_step(route_id,center_code,position_no,quantity);
  center_code:='dispatch';position_no:=position_no+1;PERFORM public.insert_production_step(route_id,center_code,position_no,quantity);
  PERFORM public.write_audit_log(auth.uid(),'production_route.created','production_routes'::name,route_id::text,NULL,NULL,jsonb_build_object('order_id',p_order_id,'steps',position_no));
  RETURN route_id;
END $$;

CREATE OR REPLACE FUNCTION public.calculate_safe_delivery_date(p_order_id uuid,p_requested date DEFAULT NULL)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog,public AS $$
DECLARE order_row public.pedidos%ROWTYPE; route_row public.production_routes%ROWTYPE; step_row record; cursor_date date; material_date date; safe_date date; requested date; buffer_days integer; queue_days integer; duration_days integer; purchase_date date; blockers jsonb:='[]'; explanation jsonb:='[]'; risk text;
BEGIN
  IF auth.uid() IS NULL OR NOT(public.has_permission('production.view') OR public.has_permission('orders.view')) THEN RAISE EXCEPTION 'permission denied' USING errcode='42501'; END IF;
  SELECT * INTO order_row FROM public.pedidos WHERE id=p_order_id; IF NOT FOUND THEN RAISE EXCEPTION 'order not found' USING errcode='P0002'; END IF;
  requested:=COALESCE(p_requested,order_row.entrega_programado);cursor_date:=(timezone('America/Sao_Paulo',now()))::date;material_date:=cursor_date;
  SELECT safety_buffer_days INTO buffer_days FROM public.production_settings WHERE id;
  IF order_row.art_required AND NOT EXISTS(SELECT 1 FROM public.art_approvals WHERE order_id=p_order_id AND status='approved' AND superseded_at IS NULL) THEN blockers:=blockers||jsonb_build_array(jsonb_build_object('code','art_pending','label','Arte pendente','severity','critical')); explanation:=explanation||jsonb_build_array(jsonb_build_object('area','Arte','status','blocked','detail','Aprovação do cliente pendente')); ELSE explanation:=explanation||jsonb_build_array(jsonb_build_object('area','Arte','status','ok','detail','Aprovação não exigida ou concluída')); END IF;
  IF EXISTS(SELECT 1 FROM public.material_requirements WHERE order_id=p_order_id AND shortage_quantity>0) THEN
    SELECT max(po.expected_date) INTO purchase_date FROM public.material_requirements mr JOIN public.purchase_order_items pi ON pi.fabric_id=mr.fabric_id AND pi.required_for_order_id=p_order_id JOIN public.purchase_orders po ON po.id=pi.purchase_order_id AND po.status IN('sent','confirmed','partial') WHERE mr.order_id=p_order_id AND mr.shortage_quantity>0;
    IF purchase_date IS NULL THEN blockers:=blockers||jsonb_build_array(jsonb_build_object('code','material_shortage','label','Material sem cobertura de compra','severity','critical'));explanation:=explanation||jsonb_build_array(jsonb_build_object('area','Materiais','status','blocked','detail','Existe falta sem pedido de compra confirmado'));
    ELSE material_date:=GREATEST(material_date,purchase_date);explanation:=explanation||jsonb_build_array(jsonb_build_object('area','Materiais','status','attention','detail','Compra prevista para '||to_char(purchase_date,'DD/MM/YYYY'))); END IF;
  ELSE explanation:=explanation||jsonb_build_array(jsonb_build_object('area','Materiais','status','ok','detail','Necessidade coberta por reservas')); END IF;
  SELECT * INTO route_row FROM public.production_routes WHERE order_id=p_order_id AND status IN('draft','planned','released','in_progress') ORDER BY created_at DESC LIMIT 1;
  IF NOT FOUND THEN blockers:=blockers||jsonb_build_array(jsonb_build_object('code','route_missing','label','Rota produtiva não definida','severity','critical')); RETURN jsonb_build_object('earliest_safe_date',NULL,'risk_level','impossible','explanation',explanation,'blocking_reasons',blockers); END IF;
  cursor_date:=GREATEST(cursor_date,material_date);
  FOR step_row IN SELECT s.*,w.name,w.daily_capacity FROM public.production_route_steps s JOIN public.production_workcenters w ON w.id=s.workcenter_id WHERE s.production_route_id=route_row.id ORDER BY s.position LOOP
    SELECT ceil(COALESCE(sum(other.estimated_quantity),0)/step_row.daily_capacity)::integer INTO queue_days FROM public.production_route_steps other JOIN public.production_routes other_route ON other_route.id=other.production_route_id WHERE other.workcenter_id=step_row.workcenter_id AND other_route.id<>route_row.id AND other.status IN('pending','planned','in_progress') AND COALESCE(other.planned_end,cursor_date)>=cursor_date;
    duration_days:=GREATEST(1,ceil(step_row.estimated_quantity/step_row.daily_capacity)::integer);
    cursor_date:=public.operational_add_business_days(cursor_date,queue_days,step_row.workcenter_id);step_row.planned_start:=cursor_date;cursor_date:=public.operational_add_business_days(cursor_date,duration_days,step_row.workcenter_id);
    UPDATE public.production_route_steps SET planned_start=step_row.planned_start,planned_end=cursor_date,status=CASE WHEN status='pending' THEN 'planned' ELSE status END WHERE id=step_row.id;
    explanation:=explanation||jsonb_build_array(jsonb_build_object('area',step_row.name,'status',CASE WHEN queue_days>0 THEN 'attention' ELSE 'ok' END,'detail',CASE WHEN queue_days>0 THEN 'Fila adiciona '||queue_days||' dia(s)' ELSE duration_days||' dia(s) planejado(s)' END,'planned_start',step_row.planned_start,'planned_end',cursor_date));
  END LOOP;
  safe_date:=public.operational_add_business_days(cursor_date,COALESCE(buffer_days,1),NULL);
  risk:=CASE WHEN jsonb_array_length(blockers)>0 THEN 'impossible' WHEN requested IS NULL OR safe_date<=requested THEN 'safe' WHEN safe_date<=public.operational_add_business_days(requested,2,NULL) THEN 'attention' ELSE 'high_risk' END;
  PERFORM public.write_audit_log(auth.uid(),'safe_date.calculated','pedidos'::name,p_order_id::text,NULL,NULL,jsonb_build_object('requested',requested,'safe_date',safe_date,'risk',risk));
  RETURN jsonb_build_object('earliest_safe_date',safe_date,'risk_level',risk,'explanation',explanation,'blocking_reasons',blockers,'calculation_mode','confirmed');
END $$;

CREATE OR REPLACE FUNCTION public.calculate_preliminary_safe_delivery_date(p_quantity numeric,p_customization text,p_requested date DEFAULT NULL)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog,public AS $$
DECLARE cursor_date date:=(timezone('America/Sao_Paulo',now()))::date; code text; center record; days integer; explanation jsonb:='[]'; safe_date date; risk text; sequence_codes text[];
BEGIN
  IF auth.uid() IS NULL OR NOT public.has_permission('quotes.view') OR p_quantity<=0 THEN RAISE EXCEPTION 'permission denied or invalid quantity' USING errcode='42501'; END IF;
  sequence_codes:=CASE WHEN lower(COALESCE(p_customization,'')) LIKE '%sublim%' THEN ARRAY['sublimation','cut','sewing','finishing','dispatch'] WHEN lower(COALESCE(p_customization,'')) LIKE '%bord%' THEN ARRAY['cut','embroidery','sewing','finishing','dispatch'] WHEN lower(COALESCE(p_customization,'')) LIKE '%dtf%' THEN ARRAY['cut','dtf','sewing','finishing','dispatch'] ELSE ARRAY['cut','sewing','finishing','dispatch'] END;
  FOREACH code IN ARRAY sequence_codes LOOP SELECT * INTO center FROM public.production_workcenters WHERE production_workcenters.code=code AND active; IF FOUND THEN days:=GREATEST(1,ceil(p_quantity/center.daily_capacity)::integer);cursor_date:=public.operational_add_business_days(cursor_date,days,center.id);explanation:=explanation||jsonb_build_array(jsonb_build_object('area',center.name,'days',days)); END IF; END LOOP;
  safe_date:=public.operational_add_business_days(cursor_date,(SELECT safety_buffer_days FROM public.production_settings WHERE id),NULL);risk:=CASE WHEN p_requested IS NULL OR safe_date<=p_requested THEN 'safe' WHEN safe_date<=public.operational_add_business_days(p_requested,2,NULL) THEN 'attention' ELSE 'high_risk' END;
  RETURN jsonb_build_object('earliest_safe_date',safe_date,'risk_level',risk,'explanation',explanation,'blocking_reasons',jsonb_build_array(jsonb_build_object('code','estimate','label','Estimativa anterior ao BOM e às reservas','severity','info')),'calculation_mode','estimate');
END $$;

CREATE OR REPLACE FUNCTION public.recalculate_production_plan(p_order_id uuid,p_committed_date date DEFAULT NULL,p_notes text DEFAULT NULL)
RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog,public AS $$
DECLARE order_row public.pedidos%ROWTYPE; route_id uuid; result jsonb; plan_id uuid; next_version integer; plan_status text; overloaded record;
BEGIN
  IF auth.uid() IS NULL OR NOT public.has_permission('production.update') THEN RAISE EXCEPTION 'permission denied' USING errcode='42501'; END IF;
  SELECT * INTO order_row FROM public.pedidos WHERE id=p_order_id FOR UPDATE; IF NOT FOUND OR order_row.status='cancelado' THEN RAISE EXCEPTION 'order unavailable' USING errcode='P0002'; END IF;
  UPDATE public.production_plans SET status='cancelled' WHERE order_id=p_order_id AND status IN('draft','blocked','ready','released');
  route_id:=public.generate_order_routing(p_order_id);result:=public.calculate_safe_delivery_date(p_order_id,order_row.entrega_programado);
  plan_status:=CASE WHEN result->>'risk_level'='impossible' THEN 'blocked' ELSE 'ready' END;
  SELECT COALESCE(max(version),0)+1 INTO next_version FROM public.production_plans WHERE order_id=p_order_id;
  INSERT INTO public.production_plans(order_id,version,status,requested_delivery_date,safe_delivery_date,committed_delivery_date,risk_level,explanation,blocking_reasons,order_revision,notes)
  VALUES(p_order_id,next_version,plan_status,order_row.entrega_programado,NULLIF(result->>'earliest_safe_date','')::date,COALESCE(p_committed_date,order_row.entrega_programado),result->>'risk_level',result->'explanation',result->'blocking_reasons',order_row.planning_revision,NULLIF(trim(p_notes),'')) RETURNING id INTO plan_id;
  UPDATE public.production_routes SET production_plan_id=plan_id,status='planned' WHERE id=route_id;
  IF plan_status='blocked' THEN INSERT INTO public.notifications(user_id,type,title,body,entity_type,entity_id,idempotency_key) VALUES(COALESCE(order_row.commercial_assigned_user_id,auth.uid()),'order_blocked','Pedido bloqueado para produção',order_row.numero,'order',order_row.id,'order-blocked-'||plan_id) ON CONFLICT(idempotency_key) DO NOTHING; END IF;
  IF result->>'risk_level' IN('attention','high_risk','impossible') THEN INSERT INTO public.notifications(user_id,type,title,body,entity_type,entity_id,idempotency_key) VALUES(COALESCE(order_row.commercial_assigned_user_id,auth.uid()),'delivery_risk','Prazo de entrega em risco',order_row.numero||' · data segura '||COALESCE(result->>'earliest_safe_date','indisponível'),'order',order_row.id,'delivery-risk-'||plan_id) ON CONFLICT(idempotency_key) DO NOTHING; END IF;
  SELECT c.* INTO overloaded FROM public.production_capacity_daily c WHERE c.utilization_percent>100 ORDER BY c.utilization_percent DESC LIMIT 1;
  IF FOUND THEN INSERT INTO public.notifications(user_id,type,title,body,entity_type,entity_id,idempotency_key) VALUES(auth.uid(),'workcenter_overload','Setor sobrecarregado',overloaded.name||' · '||overloaded.utilization_percent||'%','production_plan',plan_id,'workcenter-overload-'||plan_id) ON CONFLICT(idempotency_key) DO NOTHING; END IF;
  PERFORM public.write_audit_log(auth.uid(),CASE WHEN next_version=1 THEN 'production_plan.created' ELSE 'production_plan.recalculated' END,'production_plans'::name,plan_id::text,NULL,NULL,jsonb_build_object('order_id',p_order_id,'risk',result->>'risk_level'));
  RETURN plan_id;
END $$;

CREATE OR REPLACE FUNCTION public.get_order_release_blockers(p_order_id uuid)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog,public AS $$
DECLARE order_row public.pedidos%ROWTYPE; blockers jsonb:='[]'; latest_plan public.production_plans%ROWTYPE;
BEGIN
  IF auth.uid() IS NULL OR NOT(public.has_permission('production.view') OR public.has_permission('orders.view')) THEN RAISE EXCEPTION 'permission denied' USING errcode='42501'; END IF;
  SELECT * INTO order_row FROM public.pedidos WHERE id=p_order_id; IF NOT FOUND THEN RAISE EXCEPTION 'order not found' USING errcode='P0002'; END IF;
  IF order_row.status IN('rascunho','cancelado') THEN blockers:=blockers||jsonb_build_array(jsonb_build_object('code','order_unconfirmed','label','Pedido não confirmado','severity','critical')); END IF;
  IF order_row.art_required AND NOT EXISTS(SELECT 1 FROM public.art_approvals WHERE order_id=p_order_id AND status='approved' AND superseded_at IS NULL) THEN blockers:=blockers||jsonb_build_array(jsonb_build_object('code','art_pending','label','Arte pendente','severity','critical')); END IF;
  IF EXISTS(SELECT 1 FROM public.itens_pedido i WHERE i.pedido_id=p_order_id AND NOT EXISTS(SELECT 1 FROM public.technical_sheets ts WHERE ts.order_item_id=i.id AND ts.status IN('ready','approved'))) THEN blockers:=blockers||jsonb_build_array(jsonb_build_object('code','technical_sheet_missing','label','Ficha técnica pendente em um ou mais itens','severity','critical')); END IF;
  IF NOT EXISTS(SELECT 1 FROM public.bill_of_materials WHERE order_id=p_order_id AND status='ready') THEN blockers:=blockers||jsonb_build_array(jsonb_build_object('code','bom_missing','label','BOM não definida','severity','critical')); END IF;
  IF EXISTS(SELECT 1 FROM public.material_requirements WHERE order_id=p_order_id AND shortage_quantity>0) THEN blockers:=blockers||jsonb_build_array(jsonb_build_object('code','materials_unreserved','label','Materiais ainda não reservados','severity','critical')); END IF;
  IF NOT EXISTS(SELECT 1 FROM public.production_routes WHERE order_id=p_order_id AND status IN('planned','released','in_progress')) THEN blockers:=blockers||jsonb_build_array(jsonb_build_object('code','route_missing','label','Rota produtiva pendente','severity','critical')); END IF;
  SELECT * INTO latest_plan FROM public.production_plans WHERE order_id=p_order_id AND status IN('ready','released','in_progress') ORDER BY version DESC LIMIT 1;
  IF NOT FOUND OR latest_plan.order_revision<>order_row.planning_revision THEN blockers:=blockers||jsonb_build_array(jsonb_build_object('code','plan_missing','label','Planejamento pendente ou desatualizado','severity','critical')); END IF;
  RETURN blockers;
END $$;

CREATE OR REPLACE FUNCTION public.release_order_to_production(p_order_id uuid,p_committed_date date,p_override_reason text DEFAULT NULL,p_operation_id uuid DEFAULT NULL)
RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog,public AS $$
DECLARE order_row public.pedidos%ROWTYPE; plan public.production_plans%ROWTYPE; blockers jsonb; require_approval boolean; released_plan_id uuid;
BEGIN
  IF auth.uid() IS NULL OR NOT public.has_permission('production.update') THEN RAISE EXCEPTION 'permission denied' USING errcode='42501'; END IF;
  SELECT * INTO order_row FROM public.pedidos WHERE id=p_order_id FOR UPDATE; IF NOT FOUND THEN RAISE EXCEPTION 'order not found' USING errcode='P0002'; END IF;
  IF order_row.production_released_at IS NOT NULL THEN SELECT id INTO released_plan_id FROM public.production_plans WHERE order_id=p_order_id AND status IN('released','in_progress') ORDER BY version DESC LIMIT 1; RETURN released_plan_id; END IF;
  blockers:=public.get_order_release_blockers(p_order_id);IF jsonb_array_length(blockers)>0 THEN RAISE EXCEPTION 'order has release blockers: %',blockers USING errcode='23514'; END IF;
  SELECT * INTO plan FROM public.production_plans WHERE order_id=p_order_id AND status='ready' ORDER BY version DESC LIMIT 1 FOR UPDATE;
  SELECT require_high_risk_approval INTO require_approval FROM public.production_settings WHERE id;
  IF p_committed_date<plan.safe_delivery_date AND length(trim(COALESCE(p_override_reason,'')))<5 THEN RAISE EXCEPTION 'high risk justification required' USING errcode='22023'; END IF;
  IF require_approval AND p_committed_date<plan.safe_delivery_date AND NOT EXISTS(SELECT 1 FROM public.user_roles ur JOIN public.roles r ON r.id=ur.role_id WHERE ur.user_id=auth.uid() AND r.code IN('administrator','manager')) THEN RAISE EXCEPTION 'manager approval required' USING errcode='42501'; END IF;
  UPDATE public.production_plans SET status='released',committed_delivery_date=p_committed_date,approved_by=auth.uid(),approved_at=now(),override_reason=NULLIF(trim(p_override_reason),'') WHERE id=plan.id;
  UPDATE public.production_routes SET status='released' WHERE production_plan_id=plan.id;
  UPDATE public.pedidos SET production_released_at=now(),production_released_by=auth.uid(),status=CASE WHEN status='rascunho' THEN status ELSE 'aguardando_corte' END WHERE id=p_order_id;
  INSERT INTO public.notifications(user_id,type,title,body,entity_type,entity_id,idempotency_key) SELECT COALESCE(order_row.commercial_assigned_user_id,auth.uid()),'order_released','Pedido liberado para produção',order_row.numero,'order',order_row.id,'order-released-'||order_row.id||'-'||order_row.planning_revision ON CONFLICT(idempotency_key) DO NOTHING;
  PERFORM public.write_audit_log(auth.uid(),CASE WHEN p_committed_date<plan.safe_delivery_date THEN 'safe_date.overridden' ELSE 'production_plan.released' END,'production_plans'::name,plan.id::text,NULL,NULL,jsonb_build_object('order_id',p_order_id,'committed_date',p_committed_date,'operation_id',p_operation_id,'override_reason',p_override_reason));
  RETURN plan.id;
END $$;

CREATE OR REPLACE VIEW public.production_capacity_daily WITH(security_invoker=true) AS
SELECT d.day,w.id workcenter_id,w.code,w.name,w.capacity_unit,w.daily_capacity,COALESCE(sum(LEAST(s.estimated_quantity,w.daily_capacity)),0) planned_quantity,
  round(COALESCE(sum(LEAST(s.estimated_quantity,w.daily_capacity)),0)/w.daily_capacity*100,1) utilization_percent
FROM public.production_workcenters w CROSS JOIN LATERAL generate_series((timezone('America/Sao_Paulo',now()))::date,(timezone('America/Sao_Paulo',now()))::date+30,interval '1 day') d(day)
LEFT JOIN public.production_route_steps s ON s.workcenter_id=w.id AND d.day::date>s.planned_start AND d.day::date<=s.planned_end AND s.status IN('planned','in_progress')
WHERE w.active AND extract(dow FROM d.day)::smallint=ANY(w.working_days) AND NOT EXISTS(SELECT 1 FROM public.feriados f WHERE f.data=d.day::date) GROUP BY d.day,w.id,w.code,w.name,w.capacity_unit,w.daily_capacity;
REVOKE ALL ON public.production_capacity_daily FROM PUBLIC,anon;GRANT SELECT ON public.production_capacity_daily TO authenticated;

CREATE OR REPLACE FUNCTION public.get_pcp_dashboard(p_start date DEFAULT NULL,p_end date DEFAULT NULL)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog,public AS $$
DECLARE start_date date:=COALESCE(p_start,(timezone('America/Sao_Paulo',now()))::date);end_date date:=COALESCE(p_end,(timezone('America/Sao_Paulo',now()))::date+14);result jsonb;
BEGIN
  IF auth.uid() IS NULL OR NOT public.has_permission('production.view') OR end_date<start_date OR end_date-start_date>90 THEN RAISE EXCEPTION 'permission denied or invalid period' USING errcode='42501'; END IF;
  SELECT jsonb_build_object('to_release',(SELECT count(*) FROM public.pedidos p WHERE p.status NOT IN('rascunho','cancelado','entregue') AND p.production_released_at IS NULL),'blocked',(SELECT count(*) FROM public.production_plans WHERE status='blocked'),'late',(SELECT count(*) FROM public.pedidos WHERE status NOT IN('cancelado','entregue') AND entrega_programado<(timezone('America/Sao_Paulo',now()))::date),'at_risk',(SELECT count(*) FROM public.production_plans WHERE status IN('ready','released','in_progress') AND risk_level IN('attention','high_risk','impossible')),'capacity',(SELECT COALESCE(jsonb_agg(to_jsonb(c) ORDER BY c.day,c.utilization_percent DESC),'[]') FROM public.production_capacity_daily c WHERE c.day::date BETWEEN start_date AND end_date),'bottleneck',(SELECT to_jsonb(c) FROM public.production_capacity_daily c WHERE c.day::date BETWEEN start_date AND end_date ORDER BY c.utilization_percent DESC LIMIT 1)) INTO result;
  RETURN result;
END $$;

CREATE OR REPLACE FUNCTION public.invalidate_order_plan()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog,public AS $$
DECLARE target_order_id uuid;
BEGIN
  target_order_id:=CASE WHEN TG_OP='DELETE' THEN OLD.pedido_id ELSE NEW.pedido_id END;
  UPDATE public.pedidos SET planning_revision=planning_revision+1,production_released_at=NULL,production_released_by=NULL WHERE id=target_order_id;
  UPDATE public.production_plans SET status='blocked',blocking_reasons=blocking_reasons||jsonb_build_array(jsonb_build_object('code','order_changed','label','Quantidade ou item alterado','severity','critical')) WHERE order_id=target_order_id AND status IN('ready','released');
  UPDATE public.inventory_reservations SET status='released',released_at=now(),released_by=auth.uid(),release_reason='Pedido alterado' WHERE order_id=target_order_id AND status='reserved';
  IF FOUND THEN PERFORM public.write_audit_log(auth.uid(),'inventory.reservation_released','pedidos'::name,target_order_id::text,NULL,NULL,jsonb_build_object('reason','order_changed')); END IF;
  IF TG_OP='DELETE' THEN RETURN OLD; END IF; RETURN NEW;
END $$;
REVOKE ALL ON FUNCTION public.invalidate_order_plan() FROM PUBLIC,anon,authenticated;
CREATE TRIGGER invalidate_plan_on_order_item_change AFTER INSERT OR UPDATE OR DELETE ON public.itens_pedido FOR EACH ROW EXECUTE FUNCTION public.invalidate_order_plan();

CREATE OR REPLACE FUNCTION public.invalidate_plan_on_art_change()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog,public AS $$
BEGIN
  IF NEW.status IN('change_requested','superseded') AND OLD.status IS DISTINCT FROM NEW.status THEN UPDATE public.pedidos SET production_released_at=NULL,production_released_by=NULL,planning_revision=planning_revision+1 WHERE id=NEW.order_id;UPDATE public.production_plans SET status='blocked',blocking_reasons=blocking_reasons||jsonb_build_array(jsonb_build_object('code','art_changed','label','Arte alterada','severity','critical')) WHERE order_id=NEW.order_id AND status IN('ready','released'); END IF;RETURN NEW;
END $$;
REVOKE ALL ON FUNCTION public.invalidate_plan_on_art_change() FROM PUBLIC,anon,authenticated;
CREATE TRIGGER invalidate_plan_after_art_change AFTER UPDATE OF status ON public.art_approvals FOR EACH ROW EXECUTE FUNCTION public.invalidate_plan_on_art_change();

REVOKE ALL ON FUNCTION public.operational_add_business_days(date,integer,uuid),public.generate_order_routing(uuid),public.calculate_safe_delivery_date(uuid,date),public.calculate_preliminary_safe_delivery_date(numeric,text,date),public.recalculate_production_plan(uuid,date,text),public.get_order_release_blockers(uuid),public.release_order_to_production(uuid,date,text,uuid),public.get_pcp_dashboard(date,date) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.operational_add_business_days(date,integer,uuid),public.generate_order_routing(uuid),public.calculate_safe_delivery_date(uuid,date),public.calculate_preliminary_safe_delivery_date(numeric,text,date),public.recalculate_production_plan(uuid,date,text),public.get_order_release_blockers(uuid),public.release_order_to_production(uuid,date,text,uuid),public.get_pcp_dashboard(date,date) TO authenticated;

COMMIT;
