-- Lote 5 — Fundação do CRM comercial.
-- Aplicar somente após Lotes 1–4 e validação em staging.

CREATE OR REPLACE FUNCTION public.crm_normalize_phone(value text)
RETURNS text LANGUAGE plpgsql IMMUTABLE SET search_path = pg_catalog, public AS $$
DECLARE digits text := regexp_replace(COALESCE(value, ''), '[^0-9]', '', 'g');
BEGIN
  IF digits = '' THEN RETURN NULL; END IF;
  IF length(digits) IN (10, 11) THEN RETURN '55' || digits; END IF;
  IF left(digits, 1) = '0' AND length(digits) IN (11, 12) THEN RETURN '55' || substring(digits FROM 2); END IF;
  RETURN digits;
END $$;
REVOKE ALL ON FUNCTION public.crm_normalize_phone(text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.crm_normalize_phone(text) TO authenticated;

CREATE TABLE IF NOT EXISTS public.contacts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  customer_id uuid NOT NULL REFERENCES public.clientes(id) ON DELETE RESTRICT,
  name text NOT NULL CHECK (length(trim(name)) BETWEEN 2 AND 160),
  job_title text,
  department text,
  phone text,
  phone_normalized text,
  whatsapp text,
  whatsapp_normalized text,
  email text,
  email_normalized text,
  is_primary boolean NOT NULL DEFAULT false,
  active boolean NOT NULL DEFAULT true,
  notes text,
  created_by uuid NOT NULL REFERENCES public.profiles(id) ON DELETE RESTRICT DEFAULT auth.uid(),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE UNIQUE INDEX IF NOT EXISTS contacts_one_primary_active_idx ON public.contacts(customer_id) WHERE is_primary AND active;
CREATE INDEX IF NOT EXISTS contacts_customer_id_idx ON public.contacts(customer_id);
CREATE INDEX IF NOT EXISTS contacts_phone_normalized_idx ON public.contacts(phone_normalized) WHERE phone_normalized IS NOT NULL;
CREATE INDEX IF NOT EXISTS contacts_whatsapp_normalized_idx ON public.contacts(whatsapp_normalized) WHERE whatsapp_normalized IS NOT NULL;
CREATE INDEX IF NOT EXISTS contacts_email_normalized_idx ON public.contacts(email_normalized) WHERE email_normalized IS NOT NULL;

CREATE TABLE IF NOT EXISTS public.lead_sources (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(), code text NOT NULL UNIQUE,
  name text NOT NULL, active boolean NOT NULL DEFAULT true,
  position integer NOT NULL DEFAULT 0 CHECK (position >= 0)
);

INSERT INTO public.lead_sources(code,name,position) VALUES
('whatsapp','WhatsApp',10),('instagram','Instagram',20),('facebook','Facebook',30),
('google','Google',40),('website','Site',50),('referral','Indicação',60),
('existing_customer','Cliente antigo',70),('prospecting','Prospecção',80),
('phone','Telefone',90),('event','Evento',100),('other','Outro',110)
ON CONFLICT(code) DO UPDATE SET name=EXCLUDED.name, position=EXCLUDED.position;

CREATE TABLE IF NOT EXISTS public.leads (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL CHECK (length(trim(name)) BETWEEN 2 AND 160), company_name text,
  phone text, phone_normalized text, whatsapp text, whatsapp_normalized text,
  email text, email_normalized text,
  source_id uuid REFERENCES public.lead_sources(id) ON DELETE SET NULL,
  assigned_user_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE RESTRICT DEFAULT auth.uid(),
  status text NOT NULL DEFAULT 'new' CHECK (status IN ('new','working','qualified','converted','disqualified')),
  notes text, utm_source text, utm_medium text, utm_campaign text, utm_content text, utm_term text,
  created_by uuid NOT NULL REFERENCES public.profiles(id) ON DELETE RESTRICT DEFAULT auth.uid(),
  created_at timestamptz NOT NULL DEFAULT now(), updated_at timestamptz NOT NULL DEFAULT now(),
  converted_at timestamptz,
  converted_customer_id uuid REFERENCES public.clientes(id) ON DELETE RESTRICT,
  converted_contact_id uuid REFERENCES public.contacts(id) ON DELETE RESTRICT,
  converted_opportunity_id uuid
);

CREATE TABLE IF NOT EXISTS public.pipelines (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(), code text NOT NULL UNIQUE,
  name text NOT NULL, description text, active boolean NOT NULL DEFAULT true,
  is_default boolean NOT NULL DEFAULT false, created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE UNIQUE INDEX IF NOT EXISTS pipelines_one_default_idx ON public.pipelines(is_default) WHERE is_default AND active;
INSERT INTO public.pipelines(code,name,description,active,is_default)
VALUES('commercial','Comercial','Pipeline comercial principal',true,true)
ON CONFLICT(code) DO UPDATE SET name=EXCLUDED.name, description=EXCLUDED.description;

CREATE TABLE IF NOT EXISTS public.pipeline_stages (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  pipeline_id uuid NOT NULL REFERENCES public.pipelines(id) ON DELETE RESTRICT,
  code text NOT NULL, name text NOT NULL, position integer NOT NULL CHECK(position >= 0),
  probability integer NOT NULL CHECK(probability BETWEEN 0 AND 100),
  active boolean NOT NULL DEFAULT true, is_won boolean NOT NULL DEFAULT false,
  is_lost boolean NOT NULL DEFAULT false, created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(pipeline_id,code), UNIQUE(pipeline_id,id),
  CONSTRAINT pipeline_stage_terminal_check CHECK (NOT (is_won AND is_lost))
);

INSERT INTO public.pipeline_stages(pipeline_id,code,name,position,probability,is_won,is_lost)
SELECT p.id,s.code,s.name,s.position,s.probability,s.is_won,s.is_lost
FROM public.pipelines p CROSS JOIN (VALUES
('new_lead','Novo Lead',10,5,false,false),('attempted_contact','Tentativa de contato',20,10,false,false),
('contacted','Contato realizado',30,15,false,false),('qualification','Qualificação',40,25,false,false),
('briefing','Briefing',50,35,false,false),('quote_preparation','Orçamento em elaboração',60,45,false,false),
('quote_sent','Orçamento enviado',70,55,false,false),('follow_up','Follow-up',80,60,false,false),
('negotiation','Negociação',90,75,false,false),('waiting_approval','Aguardando aprovação',100,85,false,false),
('waiting_deposit','Aguardando entrada',110,95,false,false),('won','Ganho',120,100,true,false),
('lost','Perdido',130,0,false,true)
) AS s(code,name,position,probability,is_won,is_lost)
WHERE p.code='commercial'
ON CONFLICT(pipeline_id,code) DO UPDATE SET name=EXCLUDED.name,position=EXCLUDED.position,
probability=EXCLUDED.probability,is_won=EXCLUDED.is_won,is_lost=EXCLUDED.is_lost;

CREATE TABLE IF NOT EXISTS public.loss_reasons (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(), code text NOT NULL UNIQUE,
  name text NOT NULL, active boolean NOT NULL DEFAULT true, position integer NOT NULL DEFAULT 0
);
INSERT INTO public.loss_reasons(code,name,position) VALUES
('price','Preço',10),('deadline','Prazo',20),('competitor','Concorrente',30),
('no_response','Sem retorno',40),('withdrawal','Desistência',50),
('minimum_quantity','Quantidade mínima',60),('payment_terms','Condição de pagamento',70),
('product','Produto',80),('quality','Qualidade',90),('other','Outro',100)
ON CONFLICT(code) DO UPDATE SET name=EXCLUDED.name,position=EXCLUDED.position;

CREATE TABLE IF NOT EXISTS public.opportunities (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(), title text NOT NULL CHECK(length(trim(title)) BETWEEN 2 AND 200),
  customer_id uuid NOT NULL REFERENCES public.clientes(id) ON DELETE RESTRICT,
  contact_id uuid REFERENCES public.contacts(id) ON DELETE SET NULL,
  lead_id uuid REFERENCES public.leads(id) ON DELETE SET NULL,
  pipeline_id uuid NOT NULL REFERENCES public.pipelines(id) ON DELETE RESTRICT,
  stage_id uuid NOT NULL, assigned_user_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE RESTRICT DEFAULT auth.uid(),
  source_id uuid REFERENCES public.lead_sources(id) ON DELETE SET NULL,
  estimated_value numeric(14,2) NOT NULL DEFAULT 0 CHECK(estimated_value >= 0),
  final_value numeric(14,2) CHECK(final_value IS NULL OR final_value >= 0),
  estimated_quantity integer NOT NULL DEFAULT 0 CHECK(estimated_quantity >= 0),
  temperature text NOT NULL DEFAULT 'warm' CHECK(temperature IN ('cold','warm','hot')),
  score integer NOT NULL DEFAULT 0 CHECK(score BETWEEN 0 AND 100),
  expected_close_date date, desired_delivery_date date,
  stage_entered_at timestamptz NOT NULL DEFAULT now(), last_activity_at timestamptz,
  next_activity_at timestamptz,
  status text NOT NULL DEFAULT 'open' CHECK(status IN ('open','won','lost','archived')),
  loss_reason_id uuid REFERENCES public.loss_reasons(id) ON DELETE RESTRICT, competitor_name text,
  notes text, utm_source text, utm_medium text, utm_campaign text, utm_content text, utm_term text,
  created_by uuid NOT NULL REFERENCES public.profiles(id) ON DELETE RESTRICT DEFAULT auth.uid(),
  created_at timestamptz NOT NULL DEFAULT now(), updated_at timestamptz NOT NULL DEFAULT now(),
  won_at timestamptz, lost_at timestamptz, archived_at timestamptz,
  CONSTRAINT opportunity_pipeline_stage_fk FOREIGN KEY(pipeline_id,stage_id)
    REFERENCES public.pipeline_stages(pipeline_id,id) ON DELETE RESTRICT,
  CONSTRAINT opportunity_state_dates_check CHECK(
    (status='won' AND won_at IS NOT NULL AND lost_at IS NULL) OR
    (status='lost' AND lost_at IS NOT NULL AND won_at IS NULL AND loss_reason_id IS NOT NULL) OR
    (status='archived' AND archived_at IS NOT NULL) OR
    (status='open' AND won_at IS NULL AND lost_at IS NULL AND archived_at IS NULL)
  )
);
ALTER TABLE public.leads DROP CONSTRAINT IF EXISTS leads_converted_opportunity_id_fkey;
ALTER TABLE public.leads ADD CONSTRAINT leads_converted_opportunity_id_fkey
  FOREIGN KEY(converted_opportunity_id) REFERENCES public.opportunities(id) ON DELETE RESTRICT;

CREATE TABLE IF NOT EXISTS public.tags (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(), name text NOT NULL, color text NOT NULL DEFAULT '#64748B',
  active boolean NOT NULL DEFAULT true, created_at timestamptz NOT NULL DEFAULT now(),
  created_by uuid NOT NULL REFERENCES public.profiles(id) ON DELETE RESTRICT DEFAULT auth.uid(),
  UNIQUE(name), CONSTRAINT tags_color_check CHECK(color ~ '^#[0-9A-Fa-f]{6}$')
);
CREATE TABLE IF NOT EXISTS public.opportunity_tags (
  opportunity_id uuid NOT NULL REFERENCES public.opportunities(id) ON DELETE CASCADE,
  tag_id uuid NOT NULL REFERENCES public.tags(id) ON DELETE RESTRICT,
  created_at timestamptz NOT NULL DEFAULT now(), created_by uuid NOT NULL REFERENCES public.profiles(id) ON DELETE RESTRICT DEFAULT auth.uid(),
  PRIMARY KEY(opportunity_id,tag_id)
);

CREATE TABLE IF NOT EXISTS public.activities (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(), opportunity_id uuid REFERENCES public.opportunities(id) ON DELETE RESTRICT,
  customer_id uuid REFERENCES public.clientes(id) ON DELETE RESTRICT,
  contact_id uuid REFERENCES public.contacts(id) ON DELETE SET NULL,
  user_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE RESTRICT DEFAULT auth.uid(),
  type text NOT NULL CHECK(type IN ('call','whatsapp','email','meeting','note','stage_change','lead_conversion','task_completed','system')),
  title text NOT NULL CHECK(length(trim(title)) BETWEEN 2 AND 200), description text,
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb CHECK(jsonb_typeof(metadata)='object'),
  occurred_at timestamptz NOT NULL DEFAULT now(), created_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT activity_parent_check CHECK(opportunity_id IS NOT NULL OR customer_id IS NOT NULL)
);

CREATE TABLE IF NOT EXISTS public.tasks (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(), opportunity_id uuid REFERENCES public.opportunities(id) ON DELETE RESTRICT,
  customer_id uuid REFERENCES public.clientes(id) ON DELETE RESTRICT,
  contact_id uuid REFERENCES public.contacts(id) ON DELETE SET NULL,
  assigned_user_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE RESTRICT DEFAULT auth.uid(),
  type text NOT NULL CHECK(type IN ('call','whatsapp','email','meeting','send_quote','follow_up','request_information','collect_deposit','return_contact','other')),
  title text NOT NULL CHECK(length(trim(title)) BETWEEN 2 AND 200), description text,
  due_at timestamptz NOT NULL, priority text NOT NULL DEFAULT 'normal' CHECK(priority IN ('low','normal','high','urgent')),
  status text NOT NULL DEFAULT 'pending' CHECK(status IN ('pending','completed','cancelled')),
  completed_at timestamptz, completed_by uuid REFERENCES public.profiles(id) ON DELETE RESTRICT,
  created_by uuid NOT NULL REFERENCES public.profiles(id) ON DELETE RESTRICT DEFAULT auth.uid(),
  created_at timestamptz NOT NULL DEFAULT now(), updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT task_completion_check CHECK((status='completed' AND completed_at IS NOT NULL AND completed_by IS NOT NULL) OR status<>'completed'),
  CONSTRAINT task_parent_check CHECK(opportunity_id IS NOT NULL OR customer_id IS NOT NULL)
);

CREATE INDEX IF NOT EXISTS leads_assigned_user_id_idx ON public.leads(assigned_user_id);
CREATE INDEX IF NOT EXISTS leads_status_idx ON public.leads(status);
CREATE INDEX IF NOT EXISTS leads_source_id_idx ON public.leads(source_id);
CREATE INDEX IF NOT EXISTS leads_created_at_idx ON public.leads(created_at DESC);
CREATE INDEX IF NOT EXISTS opportunities_pipeline_id_idx ON public.opportunities(pipeline_id);
CREATE INDEX IF NOT EXISTS opportunities_stage_id_idx ON public.opportunities(stage_id);
CREATE INDEX IF NOT EXISTS opportunities_customer_id_idx ON public.opportunities(customer_id);
CREATE INDEX IF NOT EXISTS opportunities_assigned_user_id_idx ON public.opportunities(assigned_user_id);
CREATE INDEX IF NOT EXISTS opportunities_status_idx ON public.opportunities(status);
CREATE INDEX IF NOT EXISTS opportunities_stage_entered_at_idx ON public.opportunities(stage_entered_at);
CREATE INDEX IF NOT EXISTS opportunities_next_activity_at_idx ON public.opportunities(next_activity_at);
CREATE INDEX IF NOT EXISTS opportunities_expected_close_date_idx ON public.opportunities(expected_close_date);
CREATE INDEX IF NOT EXISTS activities_opportunity_id_idx ON public.activities(opportunity_id);
CREATE INDEX IF NOT EXISTS activities_occurred_at_idx ON public.activities(occurred_at DESC);
CREATE INDEX IF NOT EXISTS tasks_assigned_user_id_idx ON public.tasks(assigned_user_id);
CREATE INDEX IF NOT EXISTS tasks_status_idx ON public.tasks(status);
CREATE INDEX IF NOT EXISTS tasks_due_at_idx ON public.tasks(due_at);
CREATE INDEX IF NOT EXISTS tasks_opportunity_id_idx ON public.tasks(opportunity_id);

CREATE OR REPLACE FUNCTION public.crm_normalize_contact_fields()
RETURNS trigger LANGUAGE plpgsql SET search_path=pg_catalog,public AS $$
BEGIN
  NEW.phone_normalized=public.crm_normalize_phone(NEW.phone);
  NEW.whatsapp_normalized=public.crm_normalize_phone(NEW.whatsapp);
  NEW.email_normalized=NULLIF(lower(trim(NEW.email)),'');
  NEW.updated_at=now(); RETURN NEW;
END $$;
REVOKE ALL ON FUNCTION public.crm_normalize_contact_fields() FROM PUBLIC,anon,authenticated;
DROP TRIGGER IF EXISTS contacts_normalize_fields ON public.contacts;
CREATE TRIGGER contacts_normalize_fields BEFORE INSERT OR UPDATE ON public.contacts FOR EACH ROW EXECUTE FUNCTION public.crm_normalize_contact_fields();
DROP TRIGGER IF EXISTS leads_normalize_fields ON public.leads;
CREATE TRIGGER leads_normalize_fields BEFORE INSERT OR UPDATE ON public.leads FOR EACH ROW EXECUTE FUNCTION public.crm_normalize_contact_fields();

CREATE OR REPLACE FUNCTION public.crm_validate_relationships()
RETURNS trigger LANGUAGE plpgsql SET search_path=pg_catalog,public AS $$
DECLARE expected_customer uuid;
BEGIN
  IF TG_TABLE_NAME IN ('leads','opportunities','tasks') AND NOT EXISTS(
    SELECT 1 FROM public.profiles p WHERE p.id=NEW.assigned_user_id AND p.active
  ) THEN RAISE EXCEPTION 'assigned user must be active' USING errcode='23503'; END IF;
  IF TG_TABLE_NAME IN ('opportunities','tasks') AND NEW.contact_id IS NOT NULL THEN
    SELECT c.customer_id INTO expected_customer FROM public.contacts c WHERE c.id=NEW.contact_id AND c.active;
    IF expected_customer IS NULL OR expected_customer<>NEW.customer_id THEN
      RAISE EXCEPTION 'contact does not belong to customer' USING errcode='23503';
    END IF;
  END IF;
  RETURN NEW;
END $$;
REVOKE ALL ON FUNCTION public.crm_validate_relationships() FROM PUBLIC,anon,authenticated;
DROP TRIGGER IF EXISTS leads_validate_relationships ON public.leads;
CREATE TRIGGER leads_validate_relationships BEFORE INSERT OR UPDATE OF assigned_user_id ON public.leads FOR EACH ROW EXECUTE FUNCTION public.crm_validate_relationships();
DROP TRIGGER IF EXISTS opportunities_validate_relationships ON public.opportunities;
CREATE TRIGGER opportunities_validate_relationships BEFORE INSERT OR UPDATE OF customer_id,contact_id,assigned_user_id ON public.opportunities FOR EACH ROW EXECUTE FUNCTION public.crm_validate_relationships();
DROP TRIGGER IF EXISTS tasks_validate_relationships ON public.tasks;
CREATE TRIGGER tasks_validate_relationships BEFORE INSERT OR UPDATE OF customer_id,contact_id,assigned_user_id ON public.tasks FOR EACH ROW EXECUTE FUNCTION public.crm_validate_relationships();

DO $$ DECLARE table_name text; BEGIN
  FOREACH table_name IN ARRAY ARRAY['pipelines','pipeline_stages','opportunities','tasks'] LOOP
    EXECUTE format('DROP TRIGGER IF EXISTS %I_set_updated_at ON public.%I',table_name,table_name);
    EXECUTE format('CREATE TRIGGER %I_set_updated_at BEFORE UPDATE ON public.%I FOR EACH ROW EXECUTE FUNCTION public.set_updated_at()',table_name,table_name);
  END LOOP;
END $$;

CREATE OR REPLACE FUNCTION public.crm_sync_opportunity_activity()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog,public AS $$
BEGIN
  IF NEW.opportunity_id IS NOT NULL THEN
    UPDATE public.opportunities SET last_activity_at=GREATEST(COALESCE(last_activity_at,'-infinity'),NEW.occurred_at)
    WHERE id=NEW.opportunity_id;
  END IF; RETURN NEW;
END $$;
REVOKE ALL ON FUNCTION public.crm_sync_opportunity_activity() FROM PUBLIC,anon,authenticated;
DROP TRIGGER IF EXISTS activities_sync_opportunity ON public.activities;
CREATE TRIGGER activities_sync_opportunity AFTER INSERT ON public.activities FOR EACH ROW EXECUTE FUNCTION public.crm_sync_opportunity_activity();

CREATE OR REPLACE FUNCTION public.crm_sync_next_activity()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog,public AS $$
DECLARE target_id uuid:=COALESCE(NEW.opportunity_id,OLD.opportunity_id);
BEGIN
  IF target_id IS NOT NULL THEN UPDATE public.opportunities o SET next_activity_at=(
    SELECT min(t.due_at) FROM public.tasks t WHERE t.opportunity_id=target_id AND t.status='pending'
  ) WHERE o.id=target_id; END IF; RETURN COALESCE(NEW,OLD);
END $$;
REVOKE ALL ON FUNCTION public.crm_sync_next_activity() FROM PUBLIC,anon,authenticated;
DROP TRIGGER IF EXISTS tasks_sync_next_activity ON public.tasks;
CREATE TRIGGER tasks_sync_next_activity AFTER INSERT OR UPDATE OR DELETE ON public.tasks FOR EACH ROW EXECUTE FUNCTION public.crm_sync_next_activity();

CREATE OR REPLACE FUNCTION public.convert_lead(
  p_lead_id uuid, p_customer_id uuid DEFAULT NULL, p_create_new_customer boolean DEFAULT false,
  p_create_contact boolean DEFAULT true, p_create_opportunity boolean DEFAULT true,
  p_opportunity_title text DEFAULT NULL
) RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog,public AS $$
DECLARE l public.leads%ROWTYPE; customer_id uuid:=p_customer_id; contact_id uuid; opportunity_id uuid;
  v_pipeline_id uuid; v_stage_id uuid; duplicate_id uuid;
BEGIN
  IF auth.uid() IS NULL OR NOT public.has_permission('crm.update') THEN RAISE EXCEPTION 'permission denied' USING errcode='42501'; END IF;
  SELECT * INTO l FROM public.leads WHERE id=p_lead_id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'lead not found' USING errcode='P0002'; END IF;
  IF l.status='converted' THEN RETURN jsonb_build_object('customer_id',l.converted_customer_id,'contact_id',l.converted_contact_id,'opportunity_id',l.converted_opportunity_id); END IF;
  IF customer_id IS NULL AND NOT p_create_new_customer THEN RAISE EXCEPTION 'customer selection required' USING errcode='22023'; END IF;
  IF customer_id IS NOT NULL AND NOT EXISTS(SELECT 1 FROM public.clientes WHERE id=customer_id) THEN RAISE EXCEPTION 'customer not found' USING errcode='P0002'; END IF;
  IF customer_id IS NULL THEN
    IF NOT public.has_permission('customers.create') THEN RAISE EXCEPTION 'permission denied' USING errcode='42501'; END IF;
    SELECT c.id INTO duplicate_id FROM public.clientes c WHERE
      (l.email_normalized IS NOT NULL AND lower(trim(c.email))=l.email_normalized) OR
      (l.phone_normalized IS NOT NULL AND public.crm_normalize_phone(c.contato)=l.phone_normalized) LIMIT 1;
    IF duplicate_id IS NOT NULL THEN RAISE EXCEPTION 'possible_duplicate_customer:%',duplicate_id USING errcode='23505'; END IF;
    INSERT INTO public.clientes(nome,contato,email,observacoes)
    VALUES(upper(COALESCE(NULLIF(l.company_name,''),l.name)),COALESCE(l.whatsapp,l.phone),l.email,l.notes)
    RETURNING id INTO customer_id;
  END IF;
  IF (p_create_contact OR p_create_opportunity) AND NOT public.has_permission('crm.create') THEN RAISE EXCEPTION 'permission denied' USING errcode='42501'; END IF;
  IF p_create_contact THEN
    INSERT INTO public.contacts(customer_id,name,phone,whatsapp,email,is_primary,notes,created_by)
    VALUES(customer_id,l.name,l.phone,l.whatsapp,l.email,
      NOT EXISTS(SELECT 1 FROM public.contacts WHERE customer_id=customer_id AND active AND is_primary),l.notes,auth.uid())
    RETURNING id INTO contact_id;
  END IF;
  IF p_create_opportunity THEN
    SELECT p.id INTO v_pipeline_id FROM public.pipelines p WHERE p.active AND p.is_default ORDER BY p.created_at LIMIT 1;
    SELECT s.id INTO v_stage_id FROM public.pipeline_stages s WHERE s.pipeline_id=v_pipeline_id AND s.active AND NOT s.is_won AND NOT s.is_lost ORDER BY s.position LIMIT 1;
    IF v_pipeline_id IS NULL OR v_stage_id IS NULL THEN RAISE EXCEPTION 'default pipeline unavailable' USING errcode='55000'; END IF;
    INSERT INTO public.opportunities(title,customer_id,contact_id,lead_id,pipeline_id,stage_id,assigned_user_id,source_id,temperature,notes,utm_source,utm_medium,utm_campaign,utm_content,utm_term,created_by)
    VALUES(COALESCE(NULLIF(trim(p_opportunity_title),''),COALESCE(NULLIF(l.company_name,''),l.name)),customer_id,contact_id,l.id,v_pipeline_id,v_stage_id,l.assigned_user_id,l.source_id,'warm',l.notes,l.utm_source,l.utm_medium,l.utm_campaign,l.utm_content,l.utm_term,auth.uid())
    RETURNING id INTO opportunity_id;
  END IF;
  UPDATE public.leads SET status='converted',converted_at=now(),converted_customer_id=customer_id,
    converted_contact_id=contact_id,converted_opportunity_id=opportunity_id,updated_at=now() WHERE id=l.id;
  INSERT INTO public.activities(opportunity_id,customer_id,contact_id,user_id,type,title,metadata)
  VALUES(opportunity_id,customer_id,contact_id,auth.uid(),'lead_conversion','Lead convertido',jsonb_build_object('lead_id',l.id));
  RETURN jsonb_build_object('customer_id',customer_id,'contact_id',contact_id,'opportunity_id',opportunity_id);
END $$;

CREATE OR REPLACE FUNCTION public.move_opportunity_stage(
  p_opportunity_id uuid,p_stage_id uuid,p_loss_reason_id uuid DEFAULT NULL,
  p_competitor_name text DEFAULT NULL,p_notes text DEFAULT NULL,
  p_expected_stage_entered_at timestamptz DEFAULT NULL
) RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog,public AS $$
DECLARE o public.opportunities%ROWTYPE; old_stage public.pipeline_stages%ROWTYPE; new_stage public.pipeline_stages%ROWTYPE; new_status text;
BEGIN
  IF auth.uid() IS NULL OR NOT public.has_permission('crm.update') THEN RAISE EXCEPTION 'permission denied' USING errcode='42501'; END IF;
  SELECT * INTO o FROM public.opportunities WHERE id=p_opportunity_id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'opportunity not found' USING errcode='P0002'; END IF;
  IF o.status<>'open' THEN RAISE EXCEPTION 'closed opportunity must be reopened' USING errcode='22023'; END IF;
  IF p_expected_stage_entered_at IS NOT NULL AND o.stage_entered_at<>p_expected_stage_entered_at THEN RAISE EXCEPTION 'opportunity changed concurrently' USING errcode='40001'; END IF;
  SELECT * INTO old_stage FROM public.pipeline_stages WHERE id=o.stage_id;
  SELECT * INTO new_stage FROM public.pipeline_stages WHERE id=p_stage_id AND pipeline_id=o.pipeline_id AND active;
  IF NOT FOUND THEN RAISE EXCEPTION 'stage does not belong to pipeline' USING errcode='23503'; END IF;
  IF new_stage.is_lost AND p_loss_reason_id IS NULL THEN RAISE EXCEPTION 'loss reason required' USING errcode='22023'; END IF;
  IF p_loss_reason_id IS NOT NULL AND NOT EXISTS(SELECT 1 FROM public.loss_reasons WHERE id=p_loss_reason_id AND active) THEN RAISE EXCEPTION 'invalid loss reason' USING errcode='23503'; END IF;
  new_status:=CASE WHEN new_stage.is_won THEN 'won' WHEN new_stage.is_lost THEN 'lost' ELSE 'open' END;
  UPDATE public.opportunities SET stage_id=new_stage.id,stage_entered_at=now(),status=new_status,
    won_at=CASE WHEN new_status='won' THEN now() END,lost_at=CASE WHEN new_status='lost' THEN now() END,
    loss_reason_id=CASE WHEN new_status='lost' THEN p_loss_reason_id END,
    competitor_name=CASE WHEN new_status='lost' THEN NULLIF(trim(p_competitor_name),'') END,
    archived_at=NULL,updated_at=now() WHERE id=o.id;
  INSERT INTO public.activities(opportunity_id,customer_id,contact_id,user_id,type,title,description,metadata)
  VALUES(o.id,o.customer_id,o.contact_id,auth.uid(),'stage_change','Etapa alterada',NULLIF(trim(p_notes),''),
    jsonb_build_object('from_stage_id',o.stage_id,'from_stage',old_stage.name,'to_stage_id',new_stage.id,'to_stage',new_stage.name,'status',new_status));
  RETURN jsonb_build_object('id',o.id,'status',new_status,'stage_id',new_stage.id);
END $$;

CREATE OR REPLACE FUNCTION public.reopen_opportunity(p_opportunity_id uuid,p_stage_id uuid,p_reason text)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog,public AS $$
DECLARE o public.opportunities%ROWTYPE; s public.pipeline_stages%ROWTYPE;
BEGIN
  IF auth.uid() IS NULL OR NOT public.has_permission('crm.update') OR NOT EXISTS(
    SELECT 1 FROM public.user_roles ur JOIN public.roles r ON r.id=ur.role_id WHERE ur.user_id=auth.uid() AND r.code IN('administrator','manager'))
  THEN RAISE EXCEPTION 'permission denied' USING errcode='42501'; END IF;
  IF length(trim(COALESCE(p_reason,'')))<3 THEN RAISE EXCEPTION 'reopen reason required' USING errcode='22023'; END IF;
  SELECT * INTO o FROM public.opportunities WHERE id=p_opportunity_id FOR UPDATE;
  IF NOT FOUND OR o.status NOT IN('won','lost') THEN RAISE EXCEPTION 'opportunity is not closed' USING errcode='22023'; END IF;
  SELECT * INTO s FROM public.pipeline_stages WHERE id=p_stage_id AND pipeline_id=o.pipeline_id AND active AND NOT is_won AND NOT is_lost;
  IF NOT FOUND THEN RAISE EXCEPTION 'invalid reopen stage' USING errcode='23503'; END IF;
  UPDATE public.opportunities SET stage_id=s.id,stage_entered_at=now(),status='open',won_at=NULL,lost_at=NULL,loss_reason_id=NULL,competitor_name=NULL,updated_at=now() WHERE id=o.id;
  INSERT INTO public.activities(opportunity_id,customer_id,contact_id,user_id,type,title,description,metadata)
  VALUES(o.id,o.customer_id,o.contact_id,auth.uid(),'stage_change','Oportunidade reaberta',trim(p_reason),jsonb_build_object('to_stage_id',s.id,'to_stage',s.name));
  RETURN jsonb_build_object('id',o.id,'status','open','stage_id',s.id);
END $$;

CREATE OR REPLACE FUNCTION public.archive_opportunity(p_opportunity_id uuid)
RETURNS boolean LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog,public AS $$
BEGIN
  IF auth.uid() IS NULL OR NOT public.has_permission('crm.delete') THEN RAISE EXCEPTION 'permission denied' USING errcode='42501'; END IF;
  UPDATE public.opportunities SET status='archived',archived_at=now(),updated_at=now() WHERE id=p_opportunity_id AND status<>'archived';
  RETURN FOUND;
END $$;

CREATE OR REPLACE FUNCTION public.create_crm_task(p_opportunity_id uuid,p_customer_id uuid,p_contact_id uuid,p_type text,p_title text,p_description text,p_due_at timestamptz,p_priority text)
RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog,public AS $$
DECLARE result_id uuid; resolved_customer uuid:=p_customer_id;
BEGIN
  IF auth.uid() IS NULL OR NOT public.has_permission('crm.create') THEN RAISE EXCEPTION 'permission denied' USING errcode='42501'; END IF;
  IF p_opportunity_id IS NOT NULL THEN SELECT customer_id INTO resolved_customer FROM public.opportunities WHERE id=p_opportunity_id; END IF;
  INSERT INTO public.tasks(opportunity_id,customer_id,contact_id,assigned_user_id,type,title,description,due_at,priority,created_by)
  VALUES(p_opportunity_id,resolved_customer,p_contact_id,auth.uid(),p_type,trim(p_title),NULLIF(trim(p_description),''),p_due_at,p_priority,auth.uid()) RETURNING id INTO result_id;
  RETURN result_id;
END $$;

CREATE OR REPLACE FUNCTION public.complete_crm_task(p_task_id uuid,p_cancel boolean DEFAULT false)
RETURNS boolean LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog,public AS $$
DECLARE t public.tasks%ROWTYPE;
BEGIN
  IF auth.uid() IS NULL OR NOT public.has_permission('crm.update') THEN RAISE EXCEPTION 'permission denied' USING errcode='42501'; END IF;
  SELECT * INTO t FROM public.tasks WHERE id=p_task_id FOR UPDATE;
  IF NOT FOUND OR t.status<>'pending' THEN RETURN false; END IF;
  UPDATE public.tasks SET status=CASE WHEN p_cancel THEN 'cancelled' ELSE 'completed' END,
    completed_at=CASE WHEN NOT p_cancel THEN now() END,completed_by=CASE WHEN NOT p_cancel THEN auth.uid() END,updated_at=now() WHERE id=t.id;
  IF NOT p_cancel THEN INSERT INTO public.activities(opportunity_id,customer_id,contact_id,user_id,type,title,metadata)
    VALUES(t.opportunity_id,t.customer_id,t.contact_id,auth.uid(),'task_completed','Tarefa concluída',jsonb_build_object('task_id',t.id,'task_title',t.title)); END IF;
  RETURN true;
END $$;

CREATE OR REPLACE FUNCTION public.record_crm_activity(p_opportunity_id uuid,p_contact_id uuid,p_type text,p_title text,p_description text,p_occurred_at timestamptz DEFAULT NULL)
RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog,public AS $$
DECLARE result_id uuid; customer_id uuid;
BEGIN
  IF auth.uid() IS NULL OR NOT public.has_permission('crm.create') THEN RAISE EXCEPTION 'permission denied' USING errcode='42501'; END IF;
  SELECT o.customer_id INTO customer_id FROM public.opportunities o WHERE o.id=p_opportunity_id;
  IF customer_id IS NULL THEN RAISE EXCEPTION 'opportunity not found' USING errcode='P0002'; END IF;
  INSERT INTO public.activities(opportunity_id,customer_id,contact_id,user_id,type,title,description,occurred_at)
  VALUES(p_opportunity_id,customer_id,p_contact_id,auth.uid(),p_type,trim(p_title),NULLIF(trim(p_description),''),COALESCE(p_occurred_at,now())) RETURNING id INTO result_id;
  RETURN result_id;
END $$;

CREATE OR REPLACE FUNCTION public.set_opportunity_tags(p_opportunity_id uuid,p_tag_ids uuid[])
RETURNS boolean LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog,public AS $$
BEGIN
  IF auth.uid() IS NULL OR NOT public.has_permission('crm.update') THEN RAISE EXCEPTION 'permission denied' USING errcode='42501'; END IF;
  IF NOT EXISTS(SELECT 1 FROM public.opportunities WHERE id=p_opportunity_id) THEN RAISE EXCEPTION 'opportunity not found' USING errcode='P0002'; END IF;
  IF cardinality(COALESCE(p_tag_ids,'{}'::uuid[]))>20 THEN RAISE EXCEPTION 'too many tags' USING errcode='22023'; END IF;
  IF EXISTS(SELECT 1 FROM unnest(COALESCE(p_tag_ids,'{}'::uuid[])) AS u(tag_id) WHERE NOT EXISTS(SELECT 1 FROM public.tags t WHERE t.id=u.tag_id AND t.active)) THEN RAISE EXCEPTION 'invalid tag' USING errcode='23503'; END IF;
  DELETE FROM public.opportunity_tags WHERE opportunity_id=p_opportunity_id;
  INSERT INTO public.opportunity_tags(opportunity_id,tag_id,created_by)
  SELECT p_opportunity_id,u.tag_id,auth.uid() FROM unnest(COALESCE(p_tag_ids,'{}'::uuid[])) AS u(tag_id) ON CONFLICT DO NOTHING;
  RETURN true;
END $$;

CREATE OR REPLACE FUNCTION public.get_crm_dashboard()
RETURNS jsonb LANGUAGE sql STABLE SECURITY DEFINER SET search_path=pg_catalog,public AS $$
SELECT CASE WHEN public.has_permission('crm.view') THEN jsonb_build_object(
  'open_opportunities',count(*) FILTER(WHERE o.status='open'),
  'pipeline_value',COALESCE(sum(o.estimated_value) FILTER(WHERE o.status='open'),0),
  'weighted_pipeline',COALESCE(sum(o.estimated_value*s.probability/100.0) FILTER(WHERE o.status='open'),0),
  'overdue_tasks',(SELECT count(*) FROM public.tasks WHERE status='pending' AND due_at<now()),
  'without_next_action',count(*) FILTER(WHERE o.status='open' AND o.next_activity_at IS NULL),
  'won_month',count(*) FILTER(WHERE o.status='won' AND o.won_at>=date_trunc('month',now())),
  'lost_month',count(*) FILTER(WHERE o.status='lost' AND o.lost_at>=date_trunc('month',now()))
) ELSE NULL END FROM public.opportunities o JOIN public.pipeline_stages s ON s.id=o.stage_id;
$$;

CREATE OR REPLACE FUNCTION public.crm_audit_change()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog,public AS $$
DECLARE before_row jsonb:=CASE WHEN TG_OP='UPDATE' THEN to_jsonb(OLD) END; after_row jsonb:=to_jsonb(NEW); action_name text; stage_changed boolean:=false;
BEGIN
  IF TG_TABLE_NAME='opportunities' AND TG_OP='UPDATE' AND NEW.stage_id IS DISTINCT FROM OLD.stage_id THEN
    stage_changed:=true;
    PERFORM public.write_audit_log(auth.uid(),'opportunity.stage_changed',TG_TABLE_NAME::text,after_row->>'id',before_row,after_row,jsonb_build_object('source','database_trigger'));
  END IF;
  action_name:=CASE
    WHEN TG_TABLE_NAME='leads' AND TG_OP='INSERT' THEN 'lead.created'
    WHEN TG_TABLE_NAME='leads' AND NEW.status='converted' AND OLD.status IS DISTINCT FROM NEW.status THEN 'lead.converted'
    WHEN TG_TABLE_NAME='leads' AND NEW.status='disqualified' AND OLD.status IS DISTINCT FROM NEW.status THEN 'lead.disqualified'
    WHEN TG_TABLE_NAME='leads' THEN 'lead.updated'
    WHEN TG_TABLE_NAME='contacts' AND TG_OP='INSERT' THEN 'contact.created'
    WHEN TG_TABLE_NAME='contacts' THEN 'contact.updated'
    WHEN TG_TABLE_NAME='opportunities' AND TG_OP='INSERT' THEN 'opportunity.created'
    WHEN TG_TABLE_NAME='opportunities' AND NEW.status='won' AND OLD.status IS DISTINCT FROM NEW.status THEN 'opportunity.won'
    WHEN TG_TABLE_NAME='opportunities' AND NEW.status='lost' AND OLD.status IS DISTINCT FROM NEW.status THEN 'opportunity.lost'
    WHEN TG_TABLE_NAME='opportunities' AND NEW.status='archived' AND OLD.status IS DISTINCT FROM NEW.status THEN 'opportunity.archived'
    WHEN TG_TABLE_NAME='opportunities' THEN 'opportunity.updated'
    WHEN TG_TABLE_NAME='tasks' AND TG_OP='INSERT' THEN 'task.created'
    WHEN TG_TABLE_NAME='tasks' AND NEW.status='completed' AND OLD.status IS DISTINCT FROM NEW.status THEN 'task.completed'
    WHEN TG_TABLE_NAME='tasks' AND NEW.status='cancelled' AND OLD.status IS DISTINCT FROM NEW.status THEN 'task.cancelled'
    ELSE 'task.updated' END;
  IF NOT (stage_changed AND action_name='opportunity.updated') THEN
    PERFORM public.write_audit_log(auth.uid(),action_name,TG_TABLE_NAME::text,after_row->>'id',before_row,after_row,jsonb_build_object('source','database_trigger'));
  END IF;
  RETURN NEW;
END $$;
REVOKE ALL ON FUNCTION public.crm_audit_change() FROM PUBLIC,anon,authenticated;
DO $$ DECLARE table_name text; BEGIN
  FOREACH table_name IN ARRAY ARRAY['contacts','leads','opportunities','tasks'] LOOP
    EXECUTE format('DROP TRIGGER IF EXISTS audit_%I_crm_changes ON public.%I',table_name,table_name);
    EXECUTE format('CREATE TRIGGER audit_%I_crm_changes AFTER INSERT OR UPDATE ON public.%I FOR EACH ROW EXECUTE FUNCTION public.crm_audit_change()',table_name,table_name);
  END LOOP;
END $$;

DO $$ DECLARE table_name text; BEGIN
  FOREACH table_name IN ARRAY ARRAY['contacts','lead_sources','leads','pipelines','pipeline_stages','opportunities','loss_reasons','tags','opportunity_tags','activities','tasks'] LOOP
    EXECUTE format('ALTER TABLE public.%I ENABLE ROW LEVEL SECURITY',table_name);
    EXECUTE format('REVOKE ALL ON public.%I FROM PUBLIC,anon,authenticated',table_name);
    EXECUTE format('GRANT SELECT ON public.%I TO authenticated',table_name);
  END LOOP;
END $$;
GRANT INSERT,UPDATE ON public.contacts,public.leads,public.opportunities,public.tasks TO authenticated;
GRANT INSERT ON public.activities TO authenticated;
GRANT INSERT,DELETE ON public.opportunity_tags TO authenticated;
GRANT INSERT,UPDATE ON public.tags,public.lead_sources,public.pipelines,public.pipeline_stages,public.loss_reasons TO authenticated;

DO $$ DECLARE table_name text; BEGIN
  FOREACH table_name IN ARRAY ARRAY['contacts','lead_sources','leads','pipelines','pipeline_stages','opportunities','loss_reasons','tags','opportunity_tags','activities','tasks'] LOOP
    EXECUTE format('DROP POLICY IF EXISTS %I_select_crm ON public.%I',table_name,table_name);
    EXECUTE format('CREATE POLICY %I_select_crm ON public.%I FOR SELECT TO authenticated USING (public.has_permission(''crm.view''))',table_name,table_name);
  END LOOP;
END $$;
CREATE POLICY contacts_insert_crm ON public.contacts FOR INSERT TO authenticated WITH CHECK(public.has_permission('crm.create') AND created_by=auth.uid());
CREATE POLICY contacts_update_crm ON public.contacts FOR UPDATE TO authenticated USING(public.has_permission('crm.update')) WITH CHECK(public.has_permission('crm.update'));
CREATE POLICY leads_insert_crm ON public.leads FOR INSERT TO authenticated WITH CHECK(public.has_permission('crm.create') AND created_by=auth.uid());
CREATE POLICY leads_update_crm ON public.leads FOR UPDATE TO authenticated USING(public.has_permission('crm.update')) WITH CHECK(public.has_permission('crm.update'));
CREATE POLICY opportunities_insert_crm ON public.opportunities FOR INSERT TO authenticated WITH CHECK(public.has_permission('crm.create') AND created_by=auth.uid() AND status='open' AND score=0);
CREATE POLICY opportunities_update_crm ON public.opportunities FOR UPDATE TO authenticated USING(public.has_permission('crm.update')) WITH CHECK(public.has_permission('crm.update'));
CREATE POLICY activities_insert_crm ON public.activities FOR INSERT TO authenticated WITH CHECK(public.has_permission('crm.create') AND user_id=auth.uid());
CREATE POLICY tasks_insert_crm ON public.tasks FOR INSERT TO authenticated WITH CHECK(public.has_permission('crm.create') AND created_by=auth.uid());
CREATE POLICY tasks_update_crm ON public.tasks FOR UPDATE TO authenticated USING(public.has_permission('crm.update')) WITH CHECK(public.has_permission('crm.update'));
CREATE POLICY opportunity_tags_insert_crm ON public.opportunity_tags FOR INSERT TO authenticated WITH CHECK(public.has_permission('crm.update') AND created_by=auth.uid());
CREATE POLICY opportunity_tags_delete_crm ON public.opportunity_tags FOR DELETE TO authenticated USING(public.has_permission('crm.update'));
CREATE POLICY tags_insert_crm ON public.tags FOR INSERT TO authenticated WITH CHECK(public.has_permission('crm.create') AND created_by=auth.uid());
CREATE POLICY tags_update_crm ON public.tags FOR UPDATE TO authenticated USING(public.has_permission('crm.update')) WITH CHECK(public.has_permission('crm.update'));
CREATE POLICY lead_sources_insert_crm ON public.lead_sources FOR INSERT TO authenticated WITH CHECK(public.has_permission('crm.update'));
CREATE POLICY lead_sources_update_crm ON public.lead_sources FOR UPDATE TO authenticated USING(public.has_permission('crm.update')) WITH CHECK(public.has_permission('crm.update'));
CREATE POLICY pipelines_insert_crm ON public.pipelines FOR INSERT TO authenticated WITH CHECK(public.has_permission('crm.update'));
CREATE POLICY pipelines_update_crm ON public.pipelines FOR UPDATE TO authenticated USING(public.has_permission('crm.update')) WITH CHECK(public.has_permission('crm.update'));
CREATE POLICY pipeline_stages_insert_crm ON public.pipeline_stages FOR INSERT TO authenticated WITH CHECK(public.has_permission('crm.update'));
CREATE POLICY pipeline_stages_update_crm ON public.pipeline_stages FOR UPDATE TO authenticated USING(public.has_permission('crm.update')) WITH CHECK(public.has_permission('crm.update'));
CREATE POLICY loss_reasons_insert_crm ON public.loss_reasons FOR INSERT TO authenticated WITH CHECK(public.has_permission('crm.update'));
CREATE POLICY loss_reasons_update_crm ON public.loss_reasons FOR UPDATE TO authenticated USING(public.has_permission('crm.update')) WITH CHECK(public.has_permission('crm.update'));

REVOKE ALL ON FUNCTION public.convert_lead(uuid,uuid,boolean,boolean,boolean,text),public.move_opportunity_stage(uuid,uuid,uuid,text,text,timestamptz),public.reopen_opportunity(uuid,uuid,text),public.archive_opportunity(uuid),public.create_crm_task(uuid,uuid,uuid,text,text,text,timestamptz,text),public.complete_crm_task(uuid,boolean),public.record_crm_activity(uuid,uuid,text,text,text,timestamptz),public.set_opportunity_tags(uuid,uuid[]),public.get_crm_dashboard() FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.convert_lead(uuid,uuid,boolean,boolean,boolean,text),public.move_opportunity_stage(uuid,uuid,uuid,text,text,timestamptz),public.reopen_opportunity(uuid,uuid,text),public.archive_opportunity(uuid),public.create_crm_task(uuid,uuid,uuid,text,text,text,timestamptz,text),public.complete_crm_task(uuid,boolean),public.record_crm_activity(uuid,uuid,text,text,text,timestamptz),public.set_opportunity_tags(uuid,uuid[]),public.get_crm_dashboard() TO authenticated;

COMMENT ON TABLE public.activities IS 'Timeline comercial; separada do audit log de governança.';
COMMENT ON COLUMN public.opportunities.next_activity_at IS 'Cache transacional da tarefa pendente mais próxima.';
