-- Lote 7 — Orçamento profissional, proposta digital e conversão em pedido.
-- AGUARDANDO HOMOLOGAÇÃO no Supabase real.

BEGIN;

CREATE SEQUENCE IF NOT EXISTS public.quote_number_seq;
ALTER TABLE public.commercial_settings
  ADD COLUMN IF NOT EXISTS minimum_margin_percent numeric(5,2) NOT NULL DEFAULT 25 CHECK(minimum_margin_percent BETWEEN 0 AND 100),
  ADD COLUMN IF NOT EXISTS default_quote_validity_days integer NOT NULL DEFAULT 15 CHECK(default_quote_validity_days BETWEEN 1 AND 180),
  ADD COLUMN IF NOT EXISTS discount_limits jsonb NOT NULL DEFAULT '{"salesperson":5,"commercial":5,"manager":10,"administrator":100}'::jsonb CHECK(jsonb_typeof(discount_limits)='object'),
  ADD COLUMN IF NOT EXISTS require_margin_approval boolean NOT NULL DEFAULT true;

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
    use_business_days=COALESCE((p_settings->>'use_business_days')::boolean,use_business_days),
    minimum_margin_percent=COALESCE((p_settings->>'minimum_margin_percent')::numeric,minimum_margin_percent),
    default_quote_validity_days=COALESCE((p_settings->>'default_quote_validity_days')::integer,default_quote_validity_days),
    discount_limits=COALESCE(p_settings->'discount_limits',discount_limits),
    require_margin_approval=COALESCE((p_settings->>'require_margin_approval')::boolean,require_margin_approval),
    updated_by=auth.uid(),updated_at=now()
  WHERE id RETURNING * INTO saved;
  PERFORM public.crm_recalculate_score_internal(o.id) FROM public.opportunities o WHERE o.status='open';
  RETURN to_jsonb(saved);
END $$;

INSERT INTO public.permissions(code,name,module) VALUES
('quotes.view','Visualizar orçamentos','quotes'),
('quotes.create','Criar orçamentos','quotes'),
('quotes.update','Editar orçamentos','quotes'),
('quotes.approve','Aprovar condições comerciais','quotes')
ON CONFLICT(code) DO UPDATE SET name=EXCLUDED.name,module=EXCLUDED.module;
INSERT INTO public.role_permissions(role_id,permission_id)
SELECT r.id,p.id FROM public.roles r CROSS JOIN public.permissions p
WHERE (r.code IN('administrator','manager') AND p.code IN('quotes.view','quotes.create','quotes.update','quotes.approve'))
   OR (r.code IN('commercial','salesperson') AND p.code IN('quotes.view','quotes.create','quotes.update'))
ON CONFLICT(role_id,permission_id) DO NOTHING;

CREATE TABLE IF NOT EXISTS public.payment_term_templates(
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(), name text NOT NULL UNIQUE, description text,
  rules jsonb NOT NULL CHECK(jsonb_typeof(rules)='object' AND jsonb_typeof(rules->'installments')='array'),
  active boolean NOT NULL DEFAULT true, created_by uuid REFERENCES public.profiles(id) ON DELETE SET NULL DEFAULT auth.uid(),
  created_at timestamptz NOT NULL DEFAULT now(), updated_at timestamptz NOT NULL DEFAULT now()
);
INSERT INTO public.payment_term_templates(name,description,rules) VALUES
('À vista','Pagamento integral na conversão','{"installments":[{"label":"À vista","percent":100,"due_type":"order_date"}]}'),
('50% entrada + 50% entrega','Duas parcelas vinculadas à venda e à entrega','{"installments":[{"label":"Entrada","percent":50,"due_type":"order_date"},{"label":"Entrega","percent":50,"due_type":"delivery_date"}]}'),
('30/60','Duas parcelas após a conversão','{"installments":[{"label":"30 dias","percent":50,"due_type":"days_after_order","days":30},{"label":"60 dias","percent":50,"due_type":"days_after_order","days":60}]}'),
('30/60/90','Três parcelas após a conversão','{"installments":[{"label":"30 dias","percent":33.34,"due_type":"days_after_order","days":30},{"label":"60 dias","percent":33.33,"due_type":"days_after_order","days":60},{"label":"90 dias","percent":33.33,"due_type":"days_after_order","days":90}]}')
ON CONFLICT(name) DO UPDATE SET description=EXCLUDED.description,rules=EXCLUDED.rules;

CREATE OR REPLACE FUNCTION public.payment_term_rules_valid(p_rules jsonb) RETURNS boolean
LANGUAGE plpgsql IMMUTABLE SET search_path=pg_catalog AS $$
DECLARE total_percent numeric;
BEGIN
  IF jsonb_typeof(p_rules)<>'object' OR jsonb_typeof(p_rules->'installments')<>'array' OR jsonb_array_length(p_rules->'installments')=0 THEN RETURN false; END IF;
  IF EXISTS(SELECT 1 FROM jsonb_array_elements(p_rules->'installments') i WHERE COALESCE((i->>'percent')::numeric,0)<=0 OR COALESCE(i->>'due_type','') NOT IN('order_date','days_after_order','delivery_date') OR (i->>'due_type'='days_after_order' AND COALESCE((i->>'days')::integer,-1)<0)) THEN RETURN false; END IF;
  SELECT sum((i->>'percent')::numeric) INTO total_percent FROM jsonb_array_elements(p_rules->'installments') i;
  RETURN abs(total_percent-100)<0.01;
EXCEPTION WHEN invalid_text_representation OR numeric_value_out_of_range THEN RETURN false;
END $$;
ALTER TABLE public.payment_term_templates DROP CONSTRAINT IF EXISTS payment_term_rules_valid_check;
ALTER TABLE public.payment_term_templates ADD CONSTRAINT payment_term_rules_valid_check CHECK(public.payment_term_rules_valid(rules));

CREATE TABLE IF NOT EXISTS public.quotes(
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(), quote_number text NOT NULL UNIQUE,
  opportunity_id uuid NOT NULL REFERENCES public.opportunities(id) ON DELETE RESTRICT,
  customer_id uuid NOT NULL REFERENCES public.clientes(id) ON DELETE RESTRICT,
  contact_id uuid REFERENCES public.contacts(id) ON DELETE SET NULL,
  assigned_user_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE RESTRICT,
  status text NOT NULL DEFAULT 'draft' CHECK(status IN('draft','ready','sent','viewed','change_requested','approved','rejected','expired','converted','archived')),
  currency text NOT NULL DEFAULT 'BRL' CHECK(currency='BRL'), current_version_id uuid,
  valid_until date NOT NULL, desired_delivery_date date NOT NULL,
  payment_term_id uuid REFERENCES public.payment_term_templates(id) ON DELETE RESTRICT,
  commercial_notes text, internal_notes text,
  subtotal numeric(14,2) NOT NULL DEFAULT 0 CHECK(subtotal>=0), discount_amount numeric(14,2) NOT NULL DEFAULT 0 CHECK(discount_amount>=0),
  discount_percent numeric(7,4) NOT NULL DEFAULT 0 CHECK(discount_percent BETWEEN 0 AND 100), freight_amount numeric(14,2) NOT NULL DEFAULT 0 CHECK(freight_amount>=0),
  additional_amount numeric(14,2) NOT NULL DEFAULT 0 CHECK(additional_amount>=0), total_amount numeric(14,2) NOT NULL DEFAULT 0 CHECK(total_amount>=0),
  estimated_cost numeric(14,2) NOT NULL DEFAULT 0 CHECK(estimated_cost>=0), estimated_profit numeric(14,2) NOT NULL DEFAULT 0,
  margin_percent numeric(7,4) NOT NULL DEFAULT 0, markup numeric(12,4),
  created_by uuid NOT NULL REFERENCES public.profiles(id) ON DELETE RESTRICT DEFAULT auth.uid(), created_at timestamptz NOT NULL DEFAULT now(), updated_at timestamptz NOT NULL DEFAULT now(),
  sent_at timestamptz, approved_at timestamptz, rejected_at timestamptz, converted_at timestamptz, archived_at timestamptz,
  converted_order_id uuid REFERENCES public.pedidos(id) ON DELETE RESTRICT UNIQUE
);
CREATE TABLE IF NOT EXISTS public.quote_versions(
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(), quote_id uuid NOT NULL REFERENCES public.quotes(id) ON DELETE RESTRICT,
  version_number integer NOT NULL CHECK(version_number>0), status text NOT NULL DEFAULT 'draft' CHECK(status IN('draft','ready','sent','viewed','change_requested','approved','rejected','expired','converted')),
  subtotal numeric(14,2) NOT NULL CHECK(subtotal>=0), discount_amount numeric(14,2) NOT NULL CHECK(discount_amount>=0), discount_percent numeric(7,4) NOT NULL CHECK(discount_percent BETWEEN 0 AND 100),
  freight_amount numeric(14,2) NOT NULL CHECK(freight_amount>=0), additional_amount numeric(14,2) NOT NULL CHECK(additional_amount>=0), total_amount numeric(14,2) NOT NULL CHECK(total_amount>=0),
  estimated_cost numeric(14,2) NOT NULL CHECK(estimated_cost>=0), estimated_profit numeric(14,2) NOT NULL, margin_percent numeric(7,4) NOT NULL, markup numeric(12,4),
  payment_terms_snapshot jsonb NOT NULL CHECK(jsonb_typeof(payment_terms_snapshot)='object'), valid_until date NOT NULL, desired_delivery_date date NOT NULL,
  customer_snapshot jsonb NOT NULL CHECK(jsonb_typeof(customer_snapshot)='object'), commercial_snapshot jsonb NOT NULL CHECK(jsonb_typeof(commercial_snapshot)='object'),
  created_by uuid NOT NULL REFERENCES public.profiles(id) ON DELETE RESTRICT DEFAULT auth.uid(), created_at timestamptz NOT NULL DEFAULT now(),
  sent_at timestamptz, approved_at timestamptz, rejected_at timestamptz, first_viewed_at timestamptz, last_viewed_at timestamptz, view_count integer NOT NULL DEFAULT 0 CHECK(view_count>=0),
  UNIQUE(quote_id,version_number)
);
ALTER TABLE public.quotes DROP CONSTRAINT IF EXISTS quotes_current_version_id_fkey;
ALTER TABLE public.quotes ADD CONSTRAINT quotes_current_version_id_fkey FOREIGN KEY(current_version_id) REFERENCES public.quote_versions(id) ON DELETE RESTRICT;

CREATE TABLE IF NOT EXISTS public.quote_items(
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(), quote_version_id uuid NOT NULL REFERENCES public.quote_versions(id) ON DELETE CASCADE,
  product_id uuid, description text NOT NULL CHECK(length(trim(description)) BETWEEN 2 AND 300), product_type text, model text,
  fabric_id uuid REFERENCES public.tecidos(id) ON DELETE SET NULL, fabric_name_snapshot text, color text,
  customization_type text NOT NULL CHECK(customization_type IN('embroidery','silk','dtf','sublimation','none','other')),
  quantity integer NOT NULL CHECK(quantity>0), unit_price numeric(14,2) NOT NULL CHECK(unit_price>=0), unit_cost numeric(14,2) NOT NULL CHECK(unit_cost>=0),
  cost_source text NOT NULL CHECK(cost_source IN('auto','manual','catalog','calculated')), cost_set_by uuid REFERENCES public.profiles(id) ON DELETE SET NULL, cost_set_at timestamptz,
  discount_amount numeric(14,2) NOT NULL DEFAULT 0 CHECK(discount_amount>=0), subtotal numeric(14,2) NOT NULL CHECK(subtotal>=0), estimated_cost numeric(14,2) NOT NULL CHECK(estimated_cost>=0), estimated_profit numeric(14,2) NOT NULL,
  notes text, position integer NOT NULL DEFAULT 0 CHECK(position>=0)
);
CREATE TABLE IF NOT EXISTS public.quote_item_sizes(
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(), quote_item_id uuid NOT NULL REFERENCES public.quote_items(id) ON DELETE CASCADE,
  size text NOT NULL CHECK(length(trim(size)) BETWEEN 1 AND 20), quantity integer NOT NULL CHECK(quantity>0), position integer NOT NULL DEFAULT 0 CHECK(position>=0), UNIQUE(quote_item_id,size)
);
CREATE TABLE IF NOT EXISTS public.discount_approvals(
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(), quote_id uuid NOT NULL REFERENCES public.quotes(id) ON DELETE RESTRICT,
  quote_version_id uuid NOT NULL REFERENCES public.quote_versions(id) ON DELETE RESTRICT,
  requested_by uuid NOT NULL REFERENCES public.profiles(id) ON DELETE RESTRICT, requested_at timestamptz NOT NULL DEFAULT now(),
  discount_percent numeric(7,4) NOT NULL, margin_percent numeric(7,4) NOT NULL, reason text NOT NULL CHECK(length(trim(reason)) BETWEEN 5 AND 1000),
  status text NOT NULL DEFAULT 'pending' CHECK(status IN('pending','approved','rejected','cancelled')),
  approved_by uuid REFERENCES public.profiles(id) ON DELETE RESTRICT, approved_at timestamptz, rejected_by uuid REFERENCES public.profiles(id) ON DELETE RESTRICT, rejected_at timestamptz, decision_notes text
);
CREATE UNIQUE INDEX IF NOT EXISTS discount_approvals_one_pending_idx ON public.discount_approvals(quote_version_id) WHERE status='pending';
CREATE TABLE IF NOT EXISTS public.proposal_access_tokens(
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(), quote_id uuid NOT NULL REFERENCES public.quotes(id) ON DELETE CASCADE,
  quote_version_id uuid NOT NULL REFERENCES public.quote_versions(id) ON DELETE CASCADE, token_hash text NOT NULL UNIQUE CHECK(length(token_hash)=64),
  status text NOT NULL DEFAULT 'active' CHECK(status IN('active','revoked','expired','used')), expires_at timestamptz NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(), revoked_at timestamptz, last_viewed_at timestamptz, view_count integer NOT NULL DEFAULT 0 CHECK(view_count>=0)
);

ALTER TABLE public.pedidos ADD COLUMN IF NOT EXISTS source_quote_id uuid REFERENCES public.quotes(id) ON DELETE RESTRICT;
ALTER TABLE public.pedidos ADD COLUMN IF NOT EXISTS source_quote_version_id uuid REFERENCES public.quote_versions(id) ON DELETE RESTRICT;
ALTER TABLE public.pedidos ADD COLUMN IF NOT EXISTS commercial_assigned_user_id uuid REFERENCES public.profiles(id) ON DELETE SET NULL;
ALTER TABLE public.pedidos ADD COLUMN IF NOT EXISTS estimated_sale_cost numeric(14,2) CHECK(estimated_sale_cost>=0);
CREATE UNIQUE INDEX IF NOT EXISTS pedidos_source_quote_unique_idx ON public.pedidos(source_quote_id) WHERE source_quote_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS quotes_opportunity_idx ON public.quotes(opportunity_id); CREATE INDEX IF NOT EXISTS quotes_customer_idx ON public.quotes(customer_id);
CREATE INDEX IF NOT EXISTS quotes_assigned_idx ON public.quotes(assigned_user_id); CREATE INDEX IF NOT EXISTS quotes_status_idx ON public.quotes(status);
CREATE INDEX IF NOT EXISTS quotes_valid_until_idx ON public.quotes(valid_until); CREATE INDEX IF NOT EXISTS quotes_created_at_idx ON public.quotes(created_at DESC);
CREATE INDEX IF NOT EXISTS quote_versions_quote_idx ON public.quote_versions(quote_id,version_number DESC); CREATE INDEX IF NOT EXISTS quote_items_version_idx ON public.quote_items(quote_version_id,position);
CREATE INDEX IF NOT EXISTS quote_sizes_item_idx ON public.quote_item_sizes(quote_item_id,position); CREATE INDEX IF NOT EXISTS discount_approvals_status_idx ON public.discount_approvals(status,requested_at);
CREATE INDEX IF NOT EXISTS proposal_tokens_version_idx ON public.proposal_access_tokens(quote_version_id,status);

CREATE OR REPLACE FUNCTION public.quote_version_immutable() RETURNS trigger LANGUAGE plpgsql SET search_path=pg_catalog,public AS $$
BEGIN
  IF OLD.sent_at IS NOT NULL AND (to_jsonb(NEW)-ARRAY['status','approved_at','rejected_at','first_viewed_at','last_viewed_at','view_count']) IS DISTINCT FROM (to_jsonb(OLD)-ARRAY['status','approved_at','rejected_at','first_viewed_at','last_viewed_at','view_count']) THEN RAISE EXCEPTION 'sent quote version is immutable' USING errcode='55000'; END IF;
  RETURN NEW;
END $$;
DROP TRIGGER IF EXISTS quote_versions_immutable ON public.quote_versions;
CREATE TRIGGER quote_versions_immutable BEFORE UPDATE ON public.quote_versions FOR EACH ROW EXECUTE FUNCTION public.quote_version_immutable();

CREATE OR REPLACE FUNCTION public.quote_item_immutable() RETURNS trigger LANGUAGE plpgsql SET search_path=pg_catalog,public AS $$
DECLARE sent timestamptz; BEGIN SELECT v.sent_at INTO sent FROM public.quote_versions v WHERE v.id=COALESCE(NEW.quote_version_id,OLD.quote_version_id); IF sent IS NOT NULL THEN RAISE EXCEPTION 'sent quote version is immutable' USING errcode='55000'; END IF; RETURN COALESCE(NEW,OLD); END $$;
DROP TRIGGER IF EXISTS quote_items_immutable ON public.quote_items; CREATE TRIGGER quote_items_immutable BEFORE INSERT OR UPDATE OR DELETE ON public.quote_items FOR EACH ROW EXECUTE FUNCTION public.quote_item_immutable();
CREATE OR REPLACE FUNCTION public.quote_size_immutable() RETURNS trigger LANGUAGE plpgsql SET search_path=pg_catalog,public AS $$
DECLARE sent timestamptz; BEGIN SELECT v.sent_at INTO sent FROM public.quote_versions v JOIN public.quote_items i ON i.quote_version_id=v.id WHERE i.id=COALESCE(NEW.quote_item_id,OLD.quote_item_id); IF sent IS NOT NULL THEN RAISE EXCEPTION 'sent quote version is immutable' USING errcode='55000'; END IF; RETURN COALESCE(NEW,OLD); END $$;
DROP TRIGGER IF EXISTS quote_sizes_immutable ON public.quote_item_sizes; CREATE TRIGGER quote_sizes_immutable BEFORE INSERT OR UPDATE OR DELETE ON public.quote_item_sizes FOR EACH ROW EXECUTE FUNCTION public.quote_size_immutable();

CREATE OR REPLACE FUNCTION public.quote_move_stage(p_opportunity_id uuid,p_code text) RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog,public AS $$
DECLARE target_stage_id uuid; BEGIN SELECT s.id INTO target_stage_id FROM public.opportunities o JOIN public.pipeline_stages s ON s.pipeline_id=o.pipeline_id AND s.code=p_code AND s.active WHERE o.id=p_opportunity_id; IF target_stage_id IS NOT NULL THEN UPDATE public.opportunities SET stage_id=target_stage_id,stage_entered_at=now() WHERE id=p_opportunity_id AND status='open' AND opportunities.stage_id<>target_stage_id; END IF; END $$;

CREATE OR REPLACE FUNCTION public.save_quote_draft(p_quote_id uuid,p_payload jsonb,p_items jsonb) RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog,public AS $$
<<quote_save>>
DECLARE q public.quotes%ROWTYPE; o public.opportunities%ROWTYPE; v public.quote_versions%ROWTYPE; c public.clientes%ROWTYPE; ct public.contacts%ROWTYPE; pt public.payment_term_templates%ROWTYPE; assigned_profile public.profiles%ROWTYPE; item jsonb; size_item jsonb; item_id uuid; version_no integer; subtotal numeric:=0; cost numeric:=0; line_total numeric; line_cost numeric; discount numeric; freight numeric; additional numeric; total numeric; profit numeric; margin numeric; markup_value numeric; grade_total integer;
BEGIN
  IF auth.uid() IS NULL OR NOT public.has_permission(CASE WHEN p_quote_id IS NULL THEN 'quotes.create' ELSE 'quotes.update' END) THEN RAISE EXCEPTION 'permission denied' USING errcode='42501'; END IF;
  IF jsonb_typeof(p_items)<>'array' OR jsonb_array_length(p_items)=0 THEN RAISE EXCEPTION 'quote requires items' USING errcode='22023'; END IF;
  IF p_quote_id IS NULL THEN
    SELECT * INTO o FROM public.opportunities WHERE id=(p_payload->>'opportunity_id')::uuid AND status='open' FOR UPDATE; IF NOT FOUND THEN RAISE EXCEPTION 'opportunity not found' USING errcode='P0002'; END IF;
    INSERT INTO public.quotes(quote_number,opportunity_id,customer_id,contact_id,assigned_user_id,valid_until,desired_delivery_date,payment_term_id,commercial_notes,internal_notes)
    VALUES('ORC-'||to_char(timezone('America/Sao_Paulo',now()),'YYYY')||'-'||lpad(nextval('public.quote_number_seq')::text,6,'0'),o.id,o.customer_id,NULLIF(p_payload->>'contact_id','')::uuid,o.assigned_user_id,(p_payload->>'valid_until')::date,(p_payload->>'desired_delivery_date')::date,(p_payload->>'payment_term_id')::uuid,NULLIF(p_payload->>'commercial_notes',''),NULLIF(p_payload->>'internal_notes','')) RETURNING * INTO q;
    version_no:=1; PERFORM public.quote_move_stage(o.id,'quote_preparation');
  ELSE
    SELECT * INTO q FROM public.quotes WHERE id=p_quote_id FOR UPDATE; IF NOT FOUND OR q.status IN('converted','archived') THEN RAISE EXCEPTION 'quote unavailable' USING errcode='P0002'; END IF;
    SELECT * INTO o FROM public.opportunities WHERE id=q.opportunity_id; SELECT * INTO v FROM public.quote_versions WHERE id=q.current_version_id;
    version_no:=CASE WHEN v.id IS NULL THEN 1 WHEN v.sent_at IS NOT NULL THEN v.version_number+1 ELSE v.version_number END;
    UPDATE public.quotes SET contact_id=NULLIF(p_payload->>'contact_id','')::uuid,valid_until=(p_payload->>'valid_until')::date,desired_delivery_date=(p_payload->>'desired_delivery_date')::date,payment_term_id=(p_payload->>'payment_term_id')::uuid,commercial_notes=NULLIF(p_payload->>'commercial_notes',''),internal_notes=NULLIF(p_payload->>'internal_notes',''),status='draft',updated_at=now() WHERE id=q.id RETURNING * INTO q;
  END IF;
  SELECT * INTO c FROM public.clientes WHERE id=q.customer_id; SELECT * INTO ct FROM public.contacts WHERE id=q.contact_id; SELECT * INTO pt FROM public.payment_term_templates WHERE id=q.payment_term_id AND active; SELECT * INTO assigned_profile FROM public.profiles WHERE id=q.assigned_user_id; IF c.id IS NULL OR ct.id IS NULL OR ct.customer_id<>q.customer_id THEN RAISE EXCEPTION 'a valid customer contact is required' USING errcode='22023'; END IF; IF pt.id IS NULL OR NOT public.payment_term_rules_valid(pt.rules) THEN RAISE EXCEPTION 'payment term required' USING errcode='22023'; END IF; IF q.valid_until<(timezone('America/Sao_Paulo',now()))::date OR q.desired_delivery_date<(timezone('America/Sao_Paulo',now()))::date THEN RAISE EXCEPTION 'validity and delivery dates must not be in the past' USING errcode='22023'; END IF;
  FOR item IN SELECT * FROM jsonb_array_elements(p_items) LOOP
    IF (item->>'quantity')::integer<=0 OR (item->>'unit_price')::numeric<0 OR (item->>'unit_cost')::numeric<0 THEN RAISE EXCEPTION 'invalid item values' USING errcode='22023'; END IF;
    grade_total:=0; FOR size_item IN SELECT * FROM jsonb_array_elements(COALESCE(item->'sizes','[]')) LOOP grade_total:=grade_total+(size_item->>'quantity')::integer; END LOOP;
    IF jsonb_array_length(COALESCE(item->'sizes','[]'))>0 AND grade_total<>(item->>'quantity')::integer THEN RAISE EXCEPTION 'size grade must match quantity' USING errcode='23514'; END IF;
    line_total:=round((item->>'quantity')::numeric*(item->>'unit_price')::numeric-COALESCE((item->>'discount_amount')::numeric,0),2); line_cost:=round((item->>'quantity')::numeric*(item->>'unit_cost')::numeric,2);
    IF line_total<0 THEN RAISE EXCEPTION 'item discount exceeds subtotal' USING errcode='23514'; END IF; subtotal:=subtotal+line_total; cost:=cost+line_cost;
  END LOOP;
  discount:=COALESCE((p_payload->>'discount_amount')::numeric,0); freight:=COALESCE((p_payload->>'freight_amount')::numeric,0); additional:=COALESCE((p_payload->>'additional_amount')::numeric,0); IF discount<0 OR discount>subtotal OR freight<0 OR additional<0 THEN RAISE EXCEPTION 'invalid quote totals' USING errcode='23514'; END IF;
  total:=round(subtotal-discount+freight+additional,2); profit:=round(total-cost,2); margin:=CASE WHEN total=0 THEN 0 ELSE round(profit/total*100,4) END; markup_value:=CASE WHEN cost=0 THEN NULL ELSE round(total/cost,4) END;
  IF v.id IS NULL OR v.sent_at IS NOT NULL THEN
    INSERT INTO public.quote_versions(quote_id,version_number,status,subtotal,discount_amount,discount_percent,freight_amount,additional_amount,total_amount,estimated_cost,estimated_profit,margin_percent,markup,payment_terms_snapshot,valid_until,desired_delivery_date,customer_snapshot,commercial_snapshot)
    VALUES(q.id,version_no,'draft',subtotal,discount,CASE WHEN subtotal=0 THEN 0 ELSE round(discount/subtotal*100,4) END,freight,additional,total,cost,profit,margin,markup_value,jsonb_build_object('id',pt.id,'name',pt.name,'description',pt.description,'rules',pt.rules),q.valid_until,q.desired_delivery_date,jsonb_build_object('id',c.id,'name',c.nome,'contact_name',COALESCE(ct.name,c.contato),'email',COALESCE(ct.email,c.email),'phone',COALESCE(ct.whatsapp,ct.phone,c.contato)),jsonb_build_object('assigned_user_id',q.assigned_user_id,'assigned_name',assigned_profile.full_name,'notes',q.commercial_notes)) RETURNING * INTO v;
  ELSE
    DELETE FROM public.quote_items WHERE quote_version_id=v.id;
    UPDATE public.quote_versions SET status='draft',subtotal=quote_save.subtotal,discount_amount=quote_save.discount,discount_percent=CASE WHEN quote_save.subtotal=0 THEN 0 ELSE round(quote_save.discount/quote_save.subtotal*100,4) END,freight_amount=quote_save.freight,additional_amount=quote_save.additional,total_amount=quote_save.total,estimated_cost=quote_save.cost,estimated_profit=quote_save.profit,margin_percent=quote_save.margin,markup=quote_save.markup_value,payment_terms_snapshot=jsonb_build_object('id',pt.id,'name',pt.name,'description',pt.description,'rules',pt.rules),valid_until=q.valid_until,desired_delivery_date=q.desired_delivery_date,customer_snapshot=jsonb_build_object('id',c.id,'name',c.nome,'contact_name',COALESCE(ct.name,c.contato),'email',COALESCE(ct.email,c.email),'phone',COALESCE(ct.whatsapp,ct.phone,c.contato)),commercial_snapshot=jsonb_build_object('assigned_user_id',q.assigned_user_id,'assigned_name',assigned_profile.full_name,'notes',q.commercial_notes) WHERE id=v.id RETURNING * INTO v;
  END IF;
  UPDATE public.discount_approvals SET status='cancelled',decision_notes=COALESCE(decision_notes,'Orçamento alterado após a solicitação ou decisão.') WHERE quote_version_id=v.id AND status IN('pending','approved');
  FOR item IN SELECT * FROM jsonb_array_elements(p_items) LOOP
    line_total:=round((item->>'quantity')::numeric*(item->>'unit_price')::numeric-COALESCE((item->>'discount_amount')::numeric,0),2); line_cost:=round((item->>'quantity')::numeric*(item->>'unit_cost')::numeric,2);
    INSERT INTO public.quote_items(quote_version_id,product_id,description,product_type,model,fabric_id,fabric_name_snapshot,color,customization_type,quantity,unit_price,unit_cost,cost_source,cost_set_by,cost_set_at,discount_amount,subtotal,estimated_cost,estimated_profit,notes,position)
    VALUES(v.id,NULLIF(item->>'product_id','')::uuid,item->>'description',NULLIF(item->>'product_type',''),NULLIF(item->>'model',''),NULLIF(item->>'fabric_id','')::uuid,NULLIF(item->>'fabric_name_snapshot',''),NULLIF(item->>'color',''),item->>'customization_type',(item->>'quantity')::integer,(item->>'unit_price')::numeric,(item->>'unit_cost')::numeric,item->>'cost_source',CASE WHEN item->>'cost_source'='manual' THEN auth.uid() END,CASE WHEN item->>'cost_source'='manual' THEN now() END,COALESCE((item->>'discount_amount')::numeric,0),line_total,line_cost,line_total-line_cost,NULLIF(item->>'notes',''),COALESCE((item->>'position')::integer,0)) RETURNING id INTO item_id;
    FOR size_item IN SELECT * FROM jsonb_array_elements(COALESCE(item->'sizes','[]')) LOOP INSERT INTO public.quote_item_sizes(quote_item_id,size,quantity,position) VALUES(item_id,size_item->>'size',(size_item->>'quantity')::integer,COALESCE((size_item->>'position')::integer,0)); END LOOP;
  END LOOP;
  UPDATE public.quotes SET current_version_id=v.id,subtotal=quote_save.subtotal,discount_amount=quote_save.discount,discount_percent=CASE WHEN quote_save.subtotal=0 THEN 0 ELSE round(quote_save.discount/quote_save.subtotal*100,4) END,freight_amount=quote_save.freight,additional_amount=quote_save.additional,total_amount=quote_save.total,estimated_cost=quote_save.cost,estimated_profit=quote_save.profit,margin_percent=quote_save.margin,markup=quote_save.markup_value,updated_at=now() WHERE id=q.id;
  INSERT INTO public.activities(opportunity_id,customer_id,user_id,type,title,metadata) VALUES(q.opportunity_id,q.customer_id,auth.uid(),'system',CASE WHEN p_quote_id IS NULL THEN 'Orçamento criado' WHEN version_no>1 THEN 'Nova versão do orçamento' ELSE 'Orçamento atualizado' END,jsonb_build_object('event',CASE WHEN p_quote_id IS NULL THEN 'quote.created' WHEN version_no>1 THEN 'quote.version_created' ELSE 'quote.updated' END,'quote_id',q.id,'version',version_no));
  PERFORM public.write_audit_log(auth.uid(),CASE WHEN p_quote_id IS NULL THEN 'quote.created' WHEN version_no>1 THEN 'quote.version_created' ELSE 'quote.updated' END,'quotes'::name,q.id::text,NULL,to_jsonb(q),jsonb_build_object('version_id',v.id)); RETURN q.id;
END $$;

CREATE OR REPLACE FUNCTION public.request_quote_approval(p_quote_id uuid,p_reason text) RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog,public AS $$
DECLARE q public.quotes%ROWTYPE; approval_id uuid; BEGIN IF NOT public.has_permission('quotes.update') OR length(trim(p_reason))<5 THEN RAISE EXCEPTION 'permission denied or invalid reason' USING errcode='42501'; END IF; SELECT * INTO q FROM public.quotes WHERE id=p_quote_id FOR UPDATE; IF q.id IS NULL OR q.status NOT IN('draft','ready') THEN RAISE EXCEPTION 'quote is not awaiting commercial approval' USING errcode='55000'; END IF; IF q.current_version_id IS NULL THEN RAISE EXCEPTION 'quote version missing'; END IF; UPDATE public.discount_approvals SET status='cancelled' WHERE quote_id=q.id AND status='pending'; INSERT INTO public.discount_approvals(quote_id,quote_version_id,requested_by,discount_percent,margin_percent,reason) VALUES(q.id,q.current_version_id,auth.uid(),q.discount_percent,q.margin_percent,p_reason) RETURNING id INTO approval_id; INSERT INTO public.notifications(user_id,type,title,body,entity_type,entity_id,idempotency_key) SELECT p.id,'quote_approval_required','Aprovação comercial necessária',q.quote_number,'quote',q.id,'quote-approval-'||approval_id FROM public.profiles p JOIN public.user_roles ur ON ur.user_id=p.id JOIN public.role_permissions rp ON rp.role_id=ur.role_id JOIN public.permissions pe ON pe.id=rp.permission_id AND pe.code='quotes.approve' WHERE p.active ON CONFLICT(idempotency_key) DO NOTHING; PERFORM public.write_audit_log(auth.uid(),'discount_approval.requested','discount_approvals'::name,approval_id::text,NULL,NULL,jsonb_build_object('quote_id',q.id)); RETURN approval_id; END $$;

CREATE OR REPLACE FUNCTION public.decide_quote_approval(p_approval_id uuid,p_approve boolean,p_notes text) RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog,public AS $$
DECLARE a public.discount_approvals%ROWTYPE; q public.quotes%ROWTYPE; BEGIN IF NOT public.has_permission('quotes.approve') THEN RAISE EXCEPTION 'permission denied' USING errcode='42501'; END IF; SELECT * INTO a FROM public.discount_approvals WHERE id=p_approval_id FOR UPDATE; IF a.status<>'pending' THEN RAISE EXCEPTION 'approval already decided' USING errcode='55000'; END IF; UPDATE public.discount_approvals SET status=CASE WHEN p_approve THEN 'approved' ELSE 'rejected' END,approved_by=CASE WHEN p_approve THEN auth.uid() END,approved_at=CASE WHEN p_approve THEN now() END,rejected_by=CASE WHEN NOT p_approve THEN auth.uid() END,rejected_at=CASE WHEN NOT p_approve THEN now() END,decision_notes=p_notes WHERE id=a.id; SELECT * INTO q FROM public.quotes WHERE id=a.quote_id; INSERT INTO public.notifications(user_id,type,title,body,entity_type,entity_id,idempotency_key) VALUES(a.requested_by,'quote_approval_decided',CASE WHEN p_approve THEN 'Condição comercial aprovada' ELSE 'Condição comercial rejeitada' END,q.quote_number,'quote',q.id,'quote-approval-decision-'||a.id) ON CONFLICT(idempotency_key) DO NOTHING; PERFORM public.write_audit_log(auth.uid(),CASE WHEN p_approve THEN 'discount_approval.approved' ELSE 'discount_approval.rejected' END,'discount_approvals'::name,a.id::text,NULL,NULL,jsonb_build_object('quote_id',q.id)); END $$;

CREATE OR REPLACE FUNCTION public.send_quote_version(p_quote_id uuid) RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog,public,extensions AS $$
DECLARE q public.quotes%ROWTYPE; v public.quote_versions%ROWTYPE; s public.commercial_settings%ROWTYPE; raw_token text; token_id uuid; user_limit numeric:=0; needs boolean; first_send boolean;
BEGIN
  IF NOT public.has_permission('quotes.update') THEN RAISE EXCEPTION 'permission denied' USING errcode='42501'; END IF;
  SELECT * INTO q FROM public.quotes WHERE id=p_quote_id FOR UPDATE;
  IF q.id IS NULL OR q.status NOT IN('draft','ready','sent','viewed') THEN RAISE EXCEPTION 'save a new draft version before sending' USING errcode='55000'; END IF;
  SELECT * INTO v FROM public.quote_versions WHERE id=q.current_version_id FOR UPDATE;
  SELECT * INTO s FROM public.commercial_settings WHERE id;
  IF v.id IS NULL OR v.total_amount<=0 OR v.valid_until<(timezone('America/Sao_Paulo',now()))::date THEN RAISE EXCEPTION 'quote is incomplete or expired' USING errcode='23514'; END IF;
  SELECT COALESCE(max(CASE r.code WHEN 'administrator' THEN (s.discount_limits->>'administrator')::numeric WHEN 'manager' THEN (s.discount_limits->>'manager')::numeric WHEN 'commercial' THEN (s.discount_limits->>'commercial')::numeric WHEN 'salesperson' THEN (s.discount_limits->>'salesperson')::numeric ELSE 0 END),0) INTO user_limit FROM public.user_roles ur JOIN public.roles r ON r.id=ur.role_id WHERE ur.user_id=auth.uid();
  needs:=v.discount_percent>user_limit OR (s.require_margin_approval AND v.margin_percent<s.minimum_margin_percent);
  IF needs AND NOT EXISTS(SELECT 1 FROM public.discount_approvals a WHERE a.quote_version_id=v.id AND a.status='approved') THEN UPDATE public.quotes SET status='ready' WHERE id=q.id; UPDATE public.quote_versions SET status='ready' WHERE id=v.id; RETURN jsonb_build_object('requires_approval',true); END IF;
  first_send:=v.sent_at IS NULL;
  UPDATE public.proposal_access_tokens SET status='revoked',revoked_at=now() WHERE quote_id=q.id AND status='active';
  raw_token:=encode(extensions.gen_random_bytes(32),'hex');
  INSERT INTO public.proposal_access_tokens(quote_id,quote_version_id,token_hash,expires_at) VALUES(q.id,v.id,encode(extensions.digest(raw_token,'sha256'),'hex'),(v.valid_until+1)::timestamptz) RETURNING id INTO token_id;
  IF first_send THEN
    UPDATE public.quote_versions SET status='sent',sent_at=now() WHERE id=v.id;
    UPDATE public.quotes SET status='sent',sent_at=now(),updated_at=now() WHERE id=q.id;
    PERFORM public.quote_move_stage(q.opportunity_id,'quote_sent');
  ELSE
    UPDATE public.quotes SET updated_at=now() WHERE id=q.id;
  END IF;
  INSERT INTO public.activities(opportunity_id,customer_id,user_id,type,title,metadata) VALUES(q.opportunity_id,q.customer_id,auth.uid(),'system',CASE WHEN first_send THEN 'Proposta enviada' ELSE 'Link da proposta renovado' END,jsonb_build_object('event','quote.sent','quote_id',q.id,'version',v.version_number,'link_rotated',NOT first_send));
  PERFORM public.write_audit_log(auth.uid(),'quote.sent','quotes'::name,q.id::text,NULL,NULL,jsonb_build_object('version_id',v.id,'token_id',token_id,'link_rotated',NOT first_send));
  RETURN jsonb_build_object('requires_approval',false,'token',raw_token,'version',v.version_number);
END $$;

CREATE OR REPLACE FUNCTION public.get_public_proposal(p_token text) RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog,public,extensions AS $$
DECLARE t public.proposal_access_tokens%ROWTYPE; q public.quotes%ROWTYPE; v public.quote_versions%ROWTYPE; BEGIN SELECT * INTO t FROM public.proposal_access_tokens WHERE token_hash=encode(extensions.digest(p_token,'sha256'),'hex') AND status='active'; IF NOT FOUND THEN RETURN NULL; END IF; SELECT * INTO q FROM public.quotes WHERE id=t.quote_id; SELECT * INTO v FROM public.quote_versions WHERE id=t.quote_version_id; IF t.expires_at<=now() OR v.valid_until<(timezone('America/Sao_Paulo',now()))::date OR q.current_version_id<>v.id OR q.status IN('converted','archived') THEN RETURN jsonb_build_object('unavailable',true,'reason',CASE WHEN q.current_version_id<>v.id THEN 'newer_version' ELSE 'expired' END); END IF; RETURN jsonb_build_object('quote_number',q.quote_number,'version_number',v.version_number,'status',v.status,'currency',q.currency,'valid_until',v.valid_until,'desired_delivery_date',v.desired_delivery_date,'customer',jsonb_build_object('name',v.customer_snapshot->>'name','contact_name',v.customer_snapshot->>'contact_name','email',v.customer_snapshot->>'email','phone',v.customer_snapshot->>'phone'),'commercial',jsonb_build_object('assigned_name',v.commercial_snapshot->>'assigned_name','notes',v.commercial_snapshot->>'notes','payment_term',v.payment_terms_snapshot->>'name'),'items',(SELECT COALESCE(jsonb_agg(jsonb_build_object('description',i.description,'product_type',i.product_type,'model',i.model,'fabric',i.fabric_name_snapshot,'color',i.color,'customization_type',i.customization_type,'quantity',i.quantity,'unit_price',i.unit_price,'discount_amount',i.discount_amount,'subtotal',i.subtotal,'notes',i.notes,'sizes',(SELECT COALESCE(jsonb_agg(jsonb_build_object('size',z.size,'quantity',z.quantity) ORDER BY z.position),'[]') FROM public.quote_item_sizes z WHERE z.quote_item_id=i.id)) ORDER BY i.position),'[]') FROM public.quote_items i WHERE i.quote_version_id=v.id),'subtotal',v.subtotal,'discount_amount',v.discount_amount,'freight_amount',v.freight_amount,'additional_amount',v.additional_amount,'total_amount',v.total_amount,'sent_at',v.sent_at,'first_viewed_at',v.first_viewed_at,'last_viewed_at',v.last_viewed_at,'view_count',v.view_count,'can_respond',q.status IN('sent','viewed')); END $$;

-- Definição final legível da conversão: o lock da quote serializa cliques concorrentes.
CREATE OR REPLACE FUNCTION public.convert_quote_to_order(p_quote_id uuid)
RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog,public AS $$
DECLARE q public.quotes%ROWTYPE; v public.quote_versions%ROWTYPE; order_id uuid; order_number text; item public.quote_items%ROWTYPE; size_row public.quote_item_sizes%ROWTYPE; installments jsonb; inst jsonb; idx integer:=0; count_inst integer; allocated numeric:=0; amount_value numeric; due_value date; stamp_types text; active_stages text[];
BEGIN
  IF NOT public.has_permission('orders.create') OR NOT public.has_permission('quotes.update') THEN RAISE EXCEPTION 'permission denied' USING errcode='42501'; END IF;
  SELECT * INTO q FROM public.quotes WHERE id=p_quote_id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'quote not found' USING errcode='P0002'; END IF;
  IF q.converted_order_id IS NOT NULL THEN RETURN q.converted_order_id; END IF;
  IF q.status<>'approved' OR NOT EXISTS(SELECT 1 FROM public.clientes c WHERE c.id=q.customer_id) THEN RAISE EXCEPTION 'quote must be approved with a valid customer' USING errcode='23514'; END IF;
  SELECT * INTO v FROM public.quote_versions WHERE id=q.current_version_id FOR UPDATE;
  IF v.id IS NULL OR v.status<>'approved' OR EXISTS(SELECT 1 FROM public.discount_approvals a WHERE a.quote_version_id=v.id AND a.status='pending') THEN RAISE EXCEPTION 'commercial approval incomplete' USING errcode='23514'; END IF;
  IF NOT EXISTS(SELECT 1 FROM public.quote_items i WHERE i.quote_version_id=v.id) OR EXISTS(SELECT 1 FROM public.quote_items i WHERE i.quote_version_id=v.id AND EXISTS(SELECT 1 FROM public.quote_item_sizes z WHERE z.quote_item_id=i.id) AND i.quantity<>(SELECT sum(z.quantity) FROM public.quote_item_sizes z WHERE z.quote_item_id=i.id)) THEN RAISE EXCEPTION 'invalid quote items or size grade' USING errcode='23514'; END IF;
  installments:=v.payment_terms_snapshot->'rules'->'installments';
  IF jsonb_typeof(installments)<>'array' OR jsonb_array_length(installments)=0 THEN RAISE EXCEPTION 'invalid payment terms' USING errcode='23514'; END IF;
  SELECT string_agg(DISTINCT CASE i.customization_type WHEN 'embroidery' THEN 'BORDADO' WHEN 'silk' THEN 'SILK' WHEN 'dtf' THEN 'DTF' WHEN 'sublimation' THEN 'SUBLIMAÇÃO' WHEN 'other' THEN 'OUTRO' END,', ') FILTER(WHERE i.customization_type<>'none') INTO stamp_types FROM public.quote_items i WHERE i.quote_version_id=v.id;
  active_stages:=CASE WHEN stamp_types IS NULL THEN ARRAY['corte','costura'] ELSE ARRAY['corte','estampa','costura'] END;
  order_number:=lpad(nextval('public.pedido_number_seq')::text,4,'0')||'-'||to_char(timezone('America/Sao_Paulo',now()),'YY');
  INSERT INTO public.pedidos(numero,cliente,cliente_id,data_pedido,tipo_estampa,forma_pagamento,valor_entrada,entrega_programado,etapas_ativas,observacoes,status,client_operation_id,source_quote_id,source_quote_version_id,commercial_assigned_user_id,estimated_sale_cost)
  VALUES(order_number,v.customer_snapshot->>'name',q.customer_id,(timezone('America/Sao_Paulo',now()))::date,stamp_types,v.payment_terms_snapshot->>'name',0,v.desired_delivery_date,active_stages,NULLIF(v.commercial_snapshot->>'notes',''),'aguardando_corte',q.id,q.id,v.id,q.assigned_user_id,v.estimated_cost) RETURNING id INTO order_id;
  FOR item IN SELECT * FROM public.quote_items WHERE quote_version_id=v.id ORDER BY position LOOP
    IF EXISTS(SELECT 1 FROM public.quote_item_sizes WHERE quote_item_id=item.id) THEN
      FOR size_row IN SELECT * FROM public.quote_item_sizes WHERE quote_item_id=item.id ORDER BY position LOOP
        INSERT INTO public.itens_pedido(pedido_id,qtde,tamanho,modelo,tecido_cor,observacao,valor_unitario) VALUES(order_id,size_row.quantity,size_row.size,COALESCE(item.model,item.description),concat_ws(' / ',item.fabric_name_snapshot,item.color),item.notes,item.unit_price);
      END LOOP;
    ELSE
      INSERT INTO public.itens_pedido(pedido_id,qtde,tamanho,modelo,tecido_cor,observacao,valor_unitario) VALUES(order_id,item.quantity,'Único',COALESCE(item.model,item.description),concat_ws(' / ',item.fabric_name_snapshot,item.color),item.notes,item.unit_price);
    END IF;
  END LOOP;
  count_inst:=jsonb_array_length(installments);
  FOR inst IN SELECT * FROM jsonb_array_elements(installments) LOOP
    idx:=idx+1;
    amount_value:=CASE WHEN idx=count_inst THEN v.total_amount-allocated ELSE round(v.total_amount*(inst->>'percent')::numeric/100,2) END;
    allocated:=allocated+amount_value;
    due_value:=CASE inst->>'due_type' WHEN 'delivery_date' THEN v.desired_delivery_date WHEN 'days_after_order' THEN (timezone('America/Sao_Paulo',now()))::date+COALESCE((inst->>'days')::integer,0) ELSE (timezone('America/Sao_Paulo',now()))::date END;
    IF amount_value>0 THEN INSERT INTO public.accounts_receivable(order_id,customer_id,description,amount,due_date,installment_number,created_by) VALUES(order_id,q.customer_id,COALESCE(inst->>'label','Parcela '||idx),amount_value,due_value,idx,auth.uid()); END IF;
  END LOOP;
  IF abs(allocated-v.total_amount)>0.01 THEN RAISE EXCEPTION 'receivable allocation mismatch' USING errcode='23514'; END IF;
  UPDATE public.quotes SET status='converted',converted_at=now(),converted_order_id=order_id,updated_at=now() WHERE id=q.id;
  UPDATE public.quote_versions SET status='converted' WHERE id=v.id;
  UPDATE public.proposal_access_tokens SET status='revoked',revoked_at=now() WHERE quote_id=q.id AND status='active';
  PERFORM public.quote_move_stage(q.opportunity_id,'won');
  UPDATE public.opportunities SET status='won',final_value=v.total_amount,won_at=now(),lost_at=NULL,loss_reason_id=NULL WHERE id=q.opportunity_id AND status='open';
  INSERT INTO public.activities(opportunity_id,customer_id,user_id,type,title,metadata) VALUES(q.opportunity_id,q.customer_id,auth.uid(),'system','Pedido criado',jsonb_build_object('event','quote.converted','quote_id',q.id,'version_id',v.id,'order_id',order_id));
  INSERT INTO public.activities(opportunity_id,customer_id,user_id,type,title,metadata) VALUES(q.opportunity_id,q.customer_id,auth.uid(),'system','Venda ganha',jsonb_build_object('event','opportunity.won','quote_id',q.id,'order_id',order_id,'final_value',v.total_amount));
  PERFORM public.write_audit_log(auth.uid(),'quote.converted','quotes'::name,q.id::text,to_jsonb(q),NULL,jsonb_build_object('order_id',order_id,'version_id',v.id,'estimated_cost',v.estimated_cost));
  RETURN order_id;
END $$;

ALTER TABLE public.notifications DROP CONSTRAINT IF EXISTS notifications_type_check;
ALTER TABLE public.notifications ADD CONSTRAINT notifications_type_check CHECK(type IN('task_overdue','opportunity_stale','lead_assigned','opportunity_assigned','follow_up_alert','target_risk','proposal_viewed','proposal_change_requested','proposal_approved','proposal_rejected','quote_approval_required','quote_approval_decided','quote_expiring')) NOT VALID;

-- Acesso público transacional: valida replay, expiração, versão atual e motivo de recusa.
CREATE OR REPLACE FUNCTION public.respond_to_proposal(p_token text,p_action text,p_name text,p_job_title text,p_notes text)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog,public,extensions AS $$
DECLARE t public.proposal_access_tokens%ROWTYPE; q public.quotes%ROWTYPE; v public.quote_versions%ROWTYPE;
BEGIN
  IF p_action NOT IN('approve','request_change','reject') OR length(trim(COALESCE(p_name,'')))<2 OR (p_action IN('request_change','reject') AND length(trim(COALESCE(p_notes,'')))<3) THEN RAISE EXCEPTION 'invalid response' USING errcode='22023'; END IF;
  SELECT * INTO t FROM public.proposal_access_tokens WHERE token_hash=encode(extensions.digest(p_token,'sha256'),'hex') AND status='active' AND expires_at>now() FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'invalid or expired token' USING errcode='P0002'; END IF;
  SELECT * INTO q FROM public.quotes WHERE id=t.quote_id FOR UPDATE;
  SELECT * INTO v FROM public.quote_versions WHERE id=t.quote_version_id FOR UPDATE;
  IF q.current_version_id<>v.id THEN RAISE EXCEPTION 'Existe uma versão mais recente desta proposta.' USING errcode='55000'; END IF;
  IF v.valid_until<(timezone('America/Sao_Paulo',now()))::date THEN RAISE EXCEPTION 'proposal expired' USING errcode='55000'; END IF;
  IF q.status NOT IN('sent','viewed') OR v.status NOT IN('sent','viewed') THEN RAISE EXCEPTION 'proposal already processed' USING errcode='55000'; END IF;
  IF EXISTS(SELECT 1 FROM public.discount_approvals a WHERE a.quote_version_id=v.id AND a.status='pending') THEN RAISE EXCEPTION 'commercial approval incomplete' USING errcode='55000'; END IF;
  IF p_action='approve' THEN
    UPDATE public.quote_versions SET status='approved',approved_at=now() WHERE id=v.id;
    UPDATE public.quotes SET status='approved',approved_at=now(),updated_at=now() WHERE id=q.id;
    PERFORM public.quote_move_stage(q.opportunity_id,'waiting_deposit');
  ELSE
    UPDATE public.quote_versions SET status=CASE WHEN p_action='reject' THEN 'rejected' ELSE 'change_requested' END,rejected_at=CASE WHEN p_action='reject' THEN now() END WHERE id=v.id;
    UPDATE public.quotes SET status=CASE WHEN p_action='reject' THEN 'rejected' ELSE 'change_requested' END,rejected_at=CASE WHEN p_action='reject' THEN now() END,updated_at=now() WHERE id=q.id;
  END IF;
  UPDATE public.proposal_access_tokens SET status='used' WHERE id=t.id;
  INSERT INTO public.activities(opportunity_id,customer_id,user_id,type,title,description,metadata) VALUES(q.opportunity_id,q.customer_id,q.assigned_user_id,'system',CASE p_action WHEN 'approve' THEN 'Proposta aprovada pelo cliente' WHEN 'reject' THEN 'Proposta recusada pelo cliente' ELSE 'Cliente solicitou alteração' END,NULLIF(trim(p_notes),''),jsonb_build_object('event','quote.'||CASE p_action WHEN 'approve' THEN 'approved' WHEN 'reject' THEN 'rejected' ELSE 'change_requested' END,'approver_name',trim(p_name),'job_title',NULLIF(trim(p_job_title),''),'quote_id',q.id,'version_id',v.id));
  INSERT INTO public.notifications(user_id,type,title,body,entity_type,entity_id,idempotency_key) VALUES(q.assigned_user_id,CASE p_action WHEN 'approve' THEN 'proposal_approved' WHEN 'reject' THEN 'proposal_rejected' ELSE 'proposal_change_requested' END,CASE p_action WHEN 'approve' THEN 'Proposta aprovada' WHEN 'reject' THEN 'Proposta recusada' ELSE 'Alteração solicitada' END,q.quote_number,'quote',q.id,'proposal-response-'||t.id) ON CONFLICT(idempotency_key) DO NOTHING;
  PERFORM public.write_audit_log(NULL,'quote.'||CASE p_action WHEN 'approve' THEN 'approved' WHEN 'reject' THEN 'rejected' ELSE 'change_requested' END,'quotes'::name,q.id::text,NULL,NULL,jsonb_build_object('token_id',t.id,'version_id',v.id,'name',trim(p_name)));
END $$;

-- Uma sequência de recargas em poucos minutos conta como uma única abertura.
CREATE OR REPLACE FUNCTION public.record_proposal_view(p_token text)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog,public,extensions AS $$
DECLARE t public.proposal_access_tokens%ROWTYPE; q public.quotes%ROWTYPE; first_view boolean; meaningful_view boolean;
BEGIN
  SELECT * INTO t FROM public.proposal_access_tokens WHERE token_hash=encode(extensions.digest(p_token,'sha256'),'hex') AND status='active' AND expires_at>now() FOR UPDATE;
  IF NOT FOUND THEN RETURN; END IF;
  SELECT * INTO q FROM public.quotes WHERE id=t.quote_id;
  IF q.current_version_id<>t.quote_version_id OR q.status NOT IN('sent','viewed') THEN RETURN; END IF;
  first_view:=t.view_count=0;
  meaningful_view:=t.last_viewed_at IS NULL OR t.last_viewed_at<now()-interval '5 minutes';
  UPDATE public.proposal_access_tokens SET view_count=view_count+CASE WHEN meaningful_view THEN 1 ELSE 0 END,last_viewed_at=now() WHERE id=t.id;
  UPDATE public.quote_versions SET view_count=view_count+CASE WHEN meaningful_view THEN 1 ELSE 0 END,first_viewed_at=COALESCE(first_viewed_at,now()),last_viewed_at=now(),status=CASE WHEN status='sent' THEN 'viewed' ELSE status END WHERE id=t.quote_version_id;
  UPDATE public.quotes SET status=CASE WHEN status='sent' THEN 'viewed' ELSE status END,updated_at=now() WHERE id=q.id;
  IF first_view THEN
    INSERT INTO public.activities(opportunity_id,customer_id,user_id,type,title,metadata) VALUES(q.opportunity_id,q.customer_id,q.assigned_user_id,'system','Cliente visualizou a proposta',jsonb_build_object('event','quote.viewed','quote_id',q.id,'version_id',t.quote_version_id));
    INSERT INTO public.notifications(user_id,type,title,body,entity_type,entity_id,idempotency_key) VALUES(q.assigned_user_id,'proposal_viewed','Proposta visualizada',q.quote_number,'quote',q.id,'proposal-first-view-'||t.id) ON CONFLICT(idempotency_key) DO NOTHING;
    PERFORM public.write_audit_log(NULL,'quote.viewed','quotes'::name,q.id::text,NULL,NULL,jsonb_build_object('token_id',t.id,'version_id',t.quote_version_id));
  END IF;
END $$;

-- Extende o processamento diário do Lote 6 sem criar um segundo agendador.
CREATE OR REPLACE FUNCTION public.run_commercial_daily_check()
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog,public AS $$
DECLARE o public.opportunities%ROWTYPE; q public.quotes%ROWTYPE; r public.automation_rules%ROWTYPE; s public.commercial_settings%ROWTYPE; stage_code text;
  inactivity_days integer; stage_days integer; executed integer:=0; overdue_created integer:=0; expiring_created integer:=0; expired_count integer:=0; business_date date:=(timezone('America/Sao_Paulo',now()))::date;
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
  SELECT t.assigned_user_id,'task_overdue','Tarefa vencida',t.title,'task',t.id,'task-overdue:'||t.id::text FROM public.tasks t WHERE t.status='pending' AND t.due_at<now() ON CONFLICT(idempotency_key) DO NOTHING;
  GET DIAGNOSTICS overdue_created=ROW_COUNT;
  INSERT INTO public.notifications(user_id,type,title,body,entity_type,entity_id,idempotency_key)
  SELECT x.assigned_user_id,'quote_expiring',CASE WHEN x.valid_until=business_date THEN 'Proposta vence hoje' ELSE 'Proposta perto de vencer' END,x.quote_number,'quote',x.id,'quote-expiring:'||x.id::text||':'||x.current_version_id::text||':'||x.valid_until::text FROM public.quotes x WHERE x.status IN('sent','viewed') AND x.valid_until BETWEEN business_date AND business_date+3 ON CONFLICT(idempotency_key) DO NOTHING;
  GET DIAGNOSTICS expiring_created=ROW_COUNT;
  FOR q IN SELECT * FROM public.quotes WHERE status IN('draft','ready','sent','viewed') AND valid_until<business_date FOR UPDATE SKIP LOCKED LOOP
    UPDATE public.quotes SET status='expired',updated_at=now() WHERE id=q.id;
    UPDATE public.quote_versions SET status='expired' WHERE id=q.current_version_id;
    UPDATE public.proposal_access_tokens SET status='expired' WHERE quote_id=q.id AND status='active';
    INSERT INTO public.activities(opportunity_id,customer_id,user_id,type,title,metadata) VALUES(q.opportunity_id,q.customer_id,q.assigned_user_id,'system','Proposta expirada',jsonb_build_object('event','quote.expired','quote_id',q.id,'version_id',q.current_version_id));
    PERFORM public.write_audit_log(NULL,'quote.expired','quotes'::name,q.id::text,to_jsonb(q),NULL,jsonb_build_object('version_id',q.current_version_id));
    expired_count:=expired_count+1;
  END LOOP;
  RETURN jsonb_build_object('automation_runs',executed,'overdue_notifications',overdue_created,'quote_expiring_notifications',expiring_created,'quotes_expired',expired_count,'executed_at',now());
END $$;

DO $$ DECLARE n text; BEGIN FOREACH n IN ARRAY ARRAY['quotes','quote_versions','quote_items','quote_item_sizes','payment_term_templates','discount_approvals','proposal_access_tokens'] LOOP EXECUTE format('ALTER TABLE public.%I ENABLE ROW LEVEL SECURITY',n); EXECUTE format('REVOKE ALL ON public.%I FROM PUBLIC,anon,authenticated',n); END LOOP; END $$;
GRANT SELECT ON public.quotes,public.quote_versions,public.quote_items,public.quote_item_sizes,public.payment_term_templates,public.discount_approvals TO authenticated;
DROP POLICY IF EXISTS quotes_select ON public.quotes; DROP POLICY IF EXISTS quote_versions_select ON public.quote_versions; DROP POLICY IF EXISTS quote_items_select ON public.quote_items; DROP POLICY IF EXISTS quote_sizes_select ON public.quote_item_sizes; DROP POLICY IF EXISTS payment_terms_select ON public.payment_term_templates; DROP POLICY IF EXISTS discount_approvals_select ON public.discount_approvals;
CREATE POLICY quotes_select ON public.quotes FOR SELECT TO authenticated USING(public.has_permission('quotes.view'));
CREATE POLICY quote_versions_select ON public.quote_versions FOR SELECT TO authenticated USING(public.has_permission('quotes.view'));
CREATE POLICY quote_items_select ON public.quote_items FOR SELECT TO authenticated USING(public.has_permission('quotes.view'));
CREATE POLICY quote_sizes_select ON public.quote_item_sizes FOR SELECT TO authenticated USING(public.has_permission('quotes.view'));
CREATE POLICY payment_terms_select ON public.payment_term_templates FOR SELECT TO authenticated USING(public.has_permission('quotes.view'));
CREATE POLICY discount_approvals_select ON public.discount_approvals FOR SELECT TO authenticated USING(public.has_permission('quotes.view'));

REVOKE ALL ON FUNCTION public.save_quote_draft(uuid,jsonb,jsonb),public.request_quote_approval(uuid,text),public.decide_quote_approval(uuid,boolean,text),public.send_quote_version(uuid),public.convert_quote_to_order(uuid) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.save_quote_draft(uuid,jsonb,jsonb),public.request_quote_approval(uuid,text),public.decide_quote_approval(uuid,boolean,text),public.send_quote_version(uuid),public.convert_quote_to_order(uuid) TO authenticated;
REVOKE ALL ON FUNCTION public.get_public_proposal(text),public.record_proposal_view(text),public.respond_to_proposal(text,text,text,text,text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.get_public_proposal(text),public.record_proposal_view(text),public.respond_to_proposal(text,text,text,text,text) TO anon,authenticated;
REVOKE ALL ON FUNCTION public.quote_move_stage(uuid,text),public.quote_version_immutable(),public.quote_item_immutable(),public.quote_size_immutable(),public.payment_term_rules_valid(jsonb),public.run_commercial_daily_check() FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.run_commercial_daily_check() TO service_role;
REVOKE ALL ON FUNCTION public.save_commercial_settings(jsonb) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.save_commercial_settings(jsonb) TO authenticated;

COMMENT ON TABLE public.quote_versions IS 'Snapshots comerciais imutáveis após envio.';
COMMENT ON TABLE public.proposal_access_tokens IS 'Tokens públicos armazenados somente como SHA-256; nunca expostos por SELECT.';

COMMIT;
