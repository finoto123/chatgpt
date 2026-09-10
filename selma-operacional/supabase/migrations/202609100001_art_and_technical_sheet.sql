-- Lote 8 — aprovação de arte e ficha técnica.
-- AGUARDANDO HOMOLOGAÇÃO. Aplicar somente após os gates dos Lotes 6.5 e 7.
BEGIN;

INSERT INTO public.permissions(code,name,module) VALUES
  ('art.view','Visualizar artes','art'),
  ('art.manage','Gerenciar e enviar artes','art')
ON CONFLICT(code) DO UPDATE SET name=EXCLUDED.name,module=EXCLUDED.module;

INSERT INTO public.role_permissions(role_id,permission_id)
SELECT r.id,p.id FROM public.roles r CROSS JOIN public.permissions p
WHERE (r.code IN('administrator','manager','production','commercial','salesperson') AND p.code IN('art.view','art.manage'))
ON CONFLICT DO NOTHING;

ALTER TABLE public.pedidos
  ADD COLUMN IF NOT EXISTS art_required boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS production_released_at timestamptz,
  ADD COLUMN IF NOT EXISTS production_released_by uuid REFERENCES public.profiles(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS planning_revision integer NOT NULL DEFAULT 1 CHECK(planning_revision>0);

CREATE TABLE public.art_approvals(
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  order_id uuid NOT NULL REFERENCES public.pedidos(id) ON DELETE RESTRICT,
  order_item_id uuid REFERENCES public.itens_pedido(id) ON DELETE RESTRICT,
  version_number integer NOT NULL CHECK(version_number>0),
  status text NOT NULL DEFAULT 'draft' CHECK(status IN('draft','ready','sent','viewed','change_requested','approved','superseded','cancelled')),
  file_path text NOT NULL,
  preview_path text,
  description text NOT NULL CHECK(length(trim(description)) BETWEEN 2 AND 500),
  width numeric(10,2) CHECK(width IS NULL OR width>0),
  height numeric(10,2) CHECK(height IS NULL OR height>0),
  placement text,
  colors text[] NOT NULL DEFAULT '{}',
  internal_notes text,
  customer_notes text,
  created_by uuid NOT NULL REFERENCES public.profiles(id) ON DELETE RESTRICT DEFAULT auth.uid(),
  created_at timestamptz NOT NULL DEFAULT now(),
  sent_at timestamptz,
  viewed_at timestamptz,
  approved_at timestamptz,
  approved_by_name text,
  change_requested_at timestamptz,
  change_request_text text,
  superseded_at timestamptz,
  UNIQUE(order_id,version_number)
);

CREATE TABLE public.art_access_tokens(
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  art_approval_id uuid NOT NULL REFERENCES public.art_approvals(id) ON DELETE CASCADE,
  token_hash text NOT NULL UNIQUE CHECK(length(token_hash)=64),
  status text NOT NULL DEFAULT 'active' CHECK(status IN('active','used','revoked')),
  expires_at timestamptz NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  revoked_at timestamptz,
  first_viewed_at timestamptz,
  last_viewed_at timestamptz,
  view_count integer NOT NULL DEFAULT 0 CHECK(view_count>=0)
);

CREATE TABLE public.technical_sheets(
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  order_id uuid NOT NULL REFERENCES public.pedidos(id) ON DELETE RESTRICT,
  order_item_id uuid NOT NULL REFERENCES public.itens_pedido(id) ON DELETE RESTRICT,
  version integer NOT NULL CHECK(version>0),
  status text NOT NULL DEFAULT 'draft' CHECK(status IN('draft','ready','approved','superseded','cancelled')),
  product_name text NOT NULL CHECK(length(trim(product_name)) BETWEEN 2 AND 200),
  model text,
  fabric text,
  color text,
  customization_type text CHECK(customization_type IS NULL OR customization_type IN('embroidery','silk','dtf','sublimation','none','other')),
  grade_snapshot jsonb NOT NULL DEFAULT '[]'::jsonb CHECK(jsonb_typeof(grade_snapshot)='array'),
  art_approval_id uuid REFERENCES public.art_approvals(id) ON DELETE SET NULL,
  construction_notes text,
  measurement_notes text,
  production_notes text,
  created_by uuid NOT NULL REFERENCES public.profiles(id) ON DELETE RESTRICT DEFAULT auth.uid(),
  created_at timestamptz NOT NULL DEFAULT now(),
  approved_at timestamptz,
  approved_by uuid REFERENCES public.profiles(id) ON DELETE SET NULL,
  UNIQUE(order_item_id,version)
);

CREATE INDEX art_approvals_order_idx ON public.art_approvals(order_id,version_number DESC);
CREATE INDEX art_approvals_item_idx ON public.art_approvals(order_item_id) WHERE order_item_id IS NOT NULL;
CREATE INDEX art_approvals_status_idx ON public.art_approvals(status);
CREATE INDEX art_access_tokens_art_idx ON public.art_access_tokens(art_approval_id,status);
CREATE INDEX technical_sheets_order_idx ON public.technical_sheets(order_id,status);
CREATE INDEX technical_sheets_item_idx ON public.technical_sheets(order_item_id,version DESC);

ALTER TABLE public.art_approvals ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.art_access_tokens ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.technical_sheets ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.art_approvals,public.art_access_tokens,public.technical_sheets FROM PUBLIC,anon;
GRANT SELECT ON public.art_approvals,public.technical_sheets TO authenticated;
GRANT INSERT,UPDATE ON public.art_approvals,public.technical_sheets TO authenticated;

CREATE POLICY art_select_authorized ON public.art_approvals FOR SELECT TO authenticated USING(public.has_permission('art.view'));
CREATE POLICY art_manage_authorized ON public.art_approvals FOR ALL TO authenticated USING(public.has_permission('art.manage')) WITH CHECK(public.has_permission('art.manage'));
CREATE POLICY sheets_select_authorized ON public.technical_sheets FOR SELECT TO authenticated USING(public.has_permission('production.view'));
CREATE POLICY sheets_manage_authorized ON public.technical_sheets FOR ALL TO authenticated USING(public.has_permission('production.update')) WITH CHECK(public.has_permission('production.update'));

CREATE OR REPLACE FUNCTION public.art_version_immutable()
RETURNS trigger LANGUAGE plpgsql SET search_path=pg_catalog,public AS $$
BEGIN
  IF OLD.sent_at IS NOT NULL AND (NEW.file_path,NEW.description,NEW.width,NEW.height,NEW.placement,NEW.colors,NEW.customer_notes)
    IS DISTINCT FROM (OLD.file_path,OLD.description,OLD.width,OLD.height,OLD.placement,OLD.colors,OLD.customer_notes) THEN
    RAISE EXCEPTION 'sent art version is immutable' USING errcode='55000';
  END IF;
  RETURN NEW;
END $$;
REVOKE ALL ON FUNCTION public.art_version_immutable() FROM PUBLIC,anon,authenticated;
CREATE TRIGGER art_version_immutable_before_update BEFORE UPDATE ON public.art_approvals FOR EACH ROW EXECUTE FUNCTION public.art_version_immutable();

CREATE OR REPLACE FUNCTION public.create_art_version(p_order_id uuid,p_order_item_id uuid,p_file_path text,p_description text,p_width numeric DEFAULT NULL,p_height numeric DEFAULT NULL,p_placement text DEFAULT NULL,p_colors text[] DEFAULT '{}',p_internal_notes text DEFAULT NULL,p_customer_notes text DEFAULT NULL)
RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog,public AS $$
DECLARE new_id uuid; next_version integer; old_art public.art_approvals%ROWTYPE;
BEGIN
  IF auth.uid() IS NULL OR NOT public.has_permission('art.manage') THEN RAISE EXCEPTION 'permission denied' USING errcode='42501'; END IF;
  PERFORM 1 FROM public.pedidos WHERE id=p_order_id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'order not found' USING errcode='P0002'; END IF;
  IF p_order_item_id IS NOT NULL AND NOT EXISTS(SELECT 1 FROM public.itens_pedido WHERE id=p_order_item_id AND pedido_id=p_order_id) THEN RAISE EXCEPTION 'order item mismatch' USING errcode='23514'; END IF;
  IF p_file_path !~ ('^'||p_order_id::text||'/art/[0-9a-f-]{36}\.(pdf|png|jpg|webp)$') OR NOT EXISTS(SELECT 1 FROM storage.objects WHERE bucket_id='pedidos-layouts' AND name=p_file_path) THEN RAISE EXCEPTION 'invalid art storage object' USING errcode='23514'; END IF;
  IF length(trim(COALESCE(p_description,'')))<2 THEN RAISE EXCEPTION 'description required' USING errcode='22023'; END IF;
  SELECT * INTO old_art FROM public.art_approvals WHERE order_id=p_order_id ORDER BY version_number DESC LIMIT 1 FOR UPDATE;
  next_version:=COALESCE(old_art.version_number,0)+1;
  IF old_art.id IS NOT NULL THEN
    UPDATE public.art_approvals SET status='superseded',superseded_at=now() WHERE id=old_art.id AND status<>'cancelled';
    UPDATE public.art_access_tokens SET status='revoked',revoked_at=now() WHERE art_approval_id=old_art.id AND status='active';
  END IF;
  INSERT INTO public.art_approvals(order_id,order_item_id,version_number,status,file_path,description,width,height,placement,colors,internal_notes,customer_notes)
  VALUES(p_order_id,p_order_item_id,next_version,'ready',p_file_path,trim(p_description),p_width,p_height,NULLIF(trim(p_placement),''),COALESCE(p_colors,'{}'),NULLIF(trim(p_internal_notes),''),NULLIF(trim(p_customer_notes),'')) RETURNING id INTO new_id;
  UPDATE public.pedidos SET art_required=true,production_released_at=NULL,production_released_by=NULL,planning_revision=planning_revision+1 WHERE id=p_order_id;
  PERFORM public.write_audit_log(auth.uid(),'art.created','art_approvals'::name,new_id::text,NULL,NULL,jsonb_build_object('order_id',p_order_id,'version',next_version));
  RETURN new_id;
END $$;

CREATE OR REPLACE FUNCTION public.set_order_art_requirement(p_order_id uuid,p_required boolean)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog,public AS $$
DECLARE old_required boolean;
BEGIN
  IF auth.uid() IS NULL OR NOT(public.has_permission('art.manage') OR public.has_permission('orders.update')) THEN RAISE EXCEPTION 'permission denied' USING errcode='42501'; END IF;
  SELECT art_required INTO old_required FROM public.pedidos WHERE id=p_order_id FOR UPDATE; IF NOT FOUND THEN RAISE EXCEPTION 'order not found' USING errcode='P0002'; END IF;
  IF old_required IS DISTINCT FROM p_required THEN UPDATE public.pedidos SET art_required=p_required,production_released_at=NULL,production_released_by=NULL,planning_revision=planning_revision+1 WHERE id=p_order_id; PERFORM public.write_audit_log(auth.uid(),'art.requirement_changed','pedidos'::name,p_order_id::text,jsonb_build_object('art_required',old_required),jsonb_build_object('art_required',p_required),'{}'); END IF;
END $$;

CREATE OR REPLACE FUNCTION public.send_art_version(p_art_id uuid,p_valid_days integer DEFAULT 15)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog,public,extensions AS $$
DECLARE art public.art_approvals%ROWTYPE; raw_token text; expires timestamptz;
BEGIN
  IF auth.uid() IS NULL OR NOT public.has_permission('art.manage') THEN RAISE EXCEPTION 'permission denied' USING errcode='42501'; END IF;
  SELECT * INTO art FROM public.art_approvals WHERE id=p_art_id FOR UPDATE;
  IF NOT FOUND OR art.status NOT IN('ready','change_requested') THEN RAISE EXCEPTION 'art is not ready' USING errcode='55000'; END IF;
  IF EXISTS(SELECT 1 FROM public.art_approvals newer WHERE newer.order_id=art.order_id AND newer.version_number>art.version_number) THEN RAISE EXCEPTION 'newer art version exists' USING errcode='55000'; END IF;
  UPDATE public.art_access_tokens SET status='revoked',revoked_at=now() WHERE art_approval_id=art.id AND status='active';
  raw_token:=encode(extensions.gen_random_bytes(32),'hex');expires:=now()+make_interval(days=>LEAST(GREATEST(p_valid_days,1),60));
  INSERT INTO public.art_access_tokens(art_approval_id,token_hash,expires_at) VALUES(art.id,encode(extensions.digest(raw_token,'sha256'),'hex'),expires);
  UPDATE public.art_approvals SET status='sent',sent_at=now(),viewed_at=NULL,approved_at=NULL,approved_by_name=NULL,change_requested_at=NULL,change_request_text=NULL WHERE id=art.id;
  PERFORM public.write_audit_log(auth.uid(),'art.sent','art_approvals'::name,art.id::text,NULL,NULL,jsonb_build_object('order_id',art.order_id));
  RETURN jsonb_build_object('token',raw_token,'expires_at',expires);
END $$;

CREATE OR REPLACE FUNCTION public.get_public_art(p_token text)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog,public,extensions AS $$
DECLARE token_row public.art_access_tokens%ROWTYPE; art public.art_approvals%ROWTYPE; ord record; item public.itens_pedido%ROWTYPE;
BEGIN
  IF p_token IS NULL OR p_token!~'^[0-9a-f]{64}$' THEN RETURN NULL; END IF;
  SELECT * INTO token_row FROM public.art_access_tokens WHERE token_hash=encode(extensions.digest(p_token,'sha256'),'hex') AND status IN('active','used');
  IF NOT FOUND THEN RETURN NULL; END IF;
  SELECT * INTO art FROM public.art_approvals WHERE id=token_row.art_approval_id;
  IF token_row.expires_at<=now() OR art.status IN('superseded','cancelled') OR EXISTS(SELECT 1 FROM public.art_approvals n WHERE n.order_id=art.order_id AND n.version_number>art.version_number) THEN RETURN jsonb_build_object('unavailable',true,'reason',CASE WHEN art.status='superseded' OR EXISTS(SELECT 1 FROM public.art_approvals n WHERE n.order_id=art.order_id AND n.version_number>art.version_number) THEN 'newer_version' ELSE 'expired' END); END IF;
  SELECT id,numero,cliente,status INTO ord FROM public.pedidos WHERE id=art.order_id;
  SELECT id,modelo,tecido_cor,tamanho,qtde INTO item FROM public.itens_pedido WHERE id=art.order_item_id;
  RETURN jsonb_build_object('art_id',art.id,'order_number',ord.numero,'customer_name',ord.cliente,'order_status',ord.status,'version_number',art.version_number,'status',art.status,'file_path',art.file_path,'description',art.description,'width',art.width,'height',art.height,'placement',art.placement,'colors',art.colors,'customer_notes',art.customer_notes,'item',CASE WHEN item.id IS NULL THEN NULL ELSE jsonb_build_object('model',item.modelo,'fabric_color',item.tecido_cor,'size',item.tamanho,'quantity',item.qtde) END,'can_respond',token_row.status='active' AND art.status IN('sent','viewed'));
END $$;

CREATE OR REPLACE FUNCTION public.record_art_view(p_token text)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog,public,extensions AS $$
DECLARE token_row public.art_access_tokens%ROWTYPE; art public.art_approvals%ROWTYPE; first_view boolean; owner_id uuid;
BEGIN
  IF p_token IS NULL OR p_token!~'^[0-9a-f]{64}$' THEN RETURN; END IF;
  SELECT * INTO token_row FROM public.art_access_tokens WHERE token_hash=encode(extensions.digest(p_token,'sha256'),'hex') AND status='active' AND expires_at>now() FOR UPDATE;
  IF NOT FOUND THEN RETURN; END IF;
  SELECT * INTO art FROM public.art_approvals WHERE id=token_row.art_approval_id FOR UPDATE;
  IF art.status NOT IN('sent','viewed') OR EXISTS(SELECT 1 FROM public.art_approvals n WHERE n.order_id=art.order_id AND n.version_number>art.version_number) THEN RETURN; END IF;
  first_view:=token_row.first_viewed_at IS NULL;
  UPDATE public.art_access_tokens SET first_viewed_at=COALESCE(first_viewed_at,now()),last_viewed_at=now(),view_count=view_count+CASE WHEN last_viewed_at IS NULL OR last_viewed_at<now()-interval '5 minutes' THEN 1 ELSE 0 END WHERE id=token_row.id;
  UPDATE public.art_approvals SET status='viewed',viewed_at=COALESCE(viewed_at,now()) WHERE id=art.id;
  IF first_view THEN PERFORM public.write_audit_log(NULL,'art.viewed','art_approvals'::name,art.id::text,NULL,NULL,jsonb_build_object('order_id',art.order_id,'token_id',token_row.id)); END IF;
END $$;

CREATE OR REPLACE FUNCTION public.respond_to_art(p_token text,p_action text,p_name text,p_change_text text DEFAULT NULL)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog,public,extensions AS $$
DECLARE token_row public.art_access_tokens%ROWTYPE; art public.art_approvals%ROWTYPE; recipient uuid; customer uuid;
BEGIN
  IF p_token IS NULL OR p_token!~'^[0-9a-f]{64}$' OR p_action NOT IN('approve','request_change') OR length(trim(COALESCE(p_name,'')))<2 OR (p_action='request_change' AND length(trim(COALESCE(p_change_text,'')))<3) THEN RAISE EXCEPTION 'invalid response' USING errcode='22023'; END IF;
  SELECT * INTO token_row FROM public.art_access_tokens WHERE token_hash=encode(extensions.digest(p_token,'sha256'),'hex') AND status='active' AND expires_at>now() FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'invalid or expired token' USING errcode='22023'; END IF;
  SELECT * INTO art FROM public.art_approvals WHERE id=token_row.art_approval_id FOR UPDATE;
  IF art.status NOT IN('sent','viewed') OR EXISTS(SELECT 1 FROM public.art_approvals n WHERE n.order_id=art.order_id AND n.version_number>art.version_number) THEN RAISE EXCEPTION 'art version unavailable' USING errcode='55000'; END IF;
  UPDATE public.art_approvals SET status=CASE WHEN p_action='approve' THEN 'approved' ELSE 'change_requested' END,approved_at=CASE WHEN p_action='approve' THEN now() END,approved_by_name=CASE WHEN p_action='approve' THEN left(trim(p_name),120) END,change_requested_at=CASE WHEN p_action='request_change' THEN now() END,change_request_text=CASE WHEN p_action='request_change' THEN left(trim(p_change_text),1000) END WHERE id=art.id;
  UPDATE public.art_access_tokens SET status='used' WHERE id=token_row.id;
  SELECT COALESCE(p.commercial_assigned_user_id,art.created_by),p.cliente_id INTO recipient,customer FROM public.pedidos p WHERE p.id=art.order_id;
  INSERT INTO public.notifications(user_id,type,title,body,entity_type,entity_id,idempotency_key) VALUES(recipient,CASE WHEN p_action='approve' THEN 'art_approved' ELSE 'art_change_requested' END,CASE WHEN p_action='approve' THEN 'Arte aprovada' ELSE 'Alteração de arte solicitada' END,'Pedido '||(SELECT numero FROM public.pedidos WHERE id=art.order_id),'art',art.id,'art-response-'||token_row.id) ON CONFLICT(idempotency_key) DO NOTHING;
  IF customer IS NOT NULL THEN INSERT INTO public.activities(customer_id,user_id,type,title,description,metadata) VALUES(customer,art.created_by,'system',CASE WHEN p_action='approve' THEN 'Arte aprovada pelo cliente' ELSE 'Alteração de arte solicitada' END,CASE WHEN p_action='approve' THEN 'Versão '||art.version_number||' aprovada por '||left(trim(p_name),120) ELSE left(trim(p_change_text),1000) END,jsonb_build_object('order_id',art.order_id,'art_id',art.id,'version',art.version_number,'action',p_action)); END IF;
  PERFORM public.write_audit_log(NULL,CASE WHEN p_action='approve' THEN 'art.approved' ELSE 'art.change_requested' END,'art_approvals'::name,art.id::text,NULL,NULL,jsonb_build_object('order_id',art.order_id,'approver_name',left(trim(p_name),120)));
END $$;

CREATE OR REPLACE FUNCTION public.approve_art_version(p_token text,p_name text)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog,public AS $$ BEGIN PERFORM public.respond_to_art(p_token,'approve',p_name,NULL); END $$;

CREATE OR REPLACE FUNCTION public.save_technical_sheet(p_order_id uuid,p_order_item_id uuid,p_payload jsonb)
RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog,public AS $$
DECLARE sheet_id uuid;next_version integer;item public.itens_pedido%ROWTYPE;linked_art uuid;
BEGIN
  IF auth.uid() IS NULL OR NOT public.has_permission('production.update') THEN RAISE EXCEPTION 'permission denied' USING errcode='42501'; END IF;
  SELECT * INTO item FROM public.itens_pedido WHERE id=p_order_item_id AND pedido_id=p_order_id FOR UPDATE;IF NOT FOUND THEN RAISE EXCEPTION 'order item not found' USING errcode='P0002';END IF;
  IF length(trim(COALESCE(p_payload->>'product_name','')))<2 OR COALESCE(p_payload->>'customization_type','none') NOT IN('embroidery','silk','dtf','sublimation','none','other') THEN RAISE EXCEPTION 'invalid technical sheet' USING errcode='22023';END IF;
  SELECT id INTO linked_art FROM public.art_approvals WHERE id=NULLIF(p_payload->>'art_approval_id','')::uuid AND order_id=p_order_id;
  SELECT COALESCE(max(version),0)+1 INTO next_version FROM public.technical_sheets WHERE order_item_id=p_order_item_id;
  UPDATE public.technical_sheets SET status='superseded' WHERE order_item_id=p_order_item_id AND status IN('draft','ready','approved');
  INSERT INTO public.technical_sheets(order_id,order_item_id,version,status,product_name,model,fabric,color,customization_type,grade_snapshot,art_approval_id,construction_notes,measurement_notes,production_notes)
  VALUES(p_order_id,p_order_item_id,next_version,'ready',trim(p_payload->>'product_name'),NULLIF(trim(p_payload->>'model'),''),NULLIF(trim(p_payload->>'fabric'),''),NULLIF(trim(p_payload->>'color'),''),COALESCE(p_payload->>'customization_type','none'),COALESCE(p_payload->'grade_snapshot','[]'),linked_art,NULLIF(trim(p_payload->>'construction_notes'),''),NULLIF(trim(p_payload->>'measurement_notes'),''),NULLIF(trim(p_payload->>'production_notes'),'')) RETURNING id INTO sheet_id;
  UPDATE public.pedidos SET production_released_at=NULL,production_released_by=NULL,planning_revision=planning_revision+1 WHERE id=p_order_id;
  PERFORM public.write_audit_log(auth.uid(),CASE WHEN next_version=1 THEN 'technical_sheet.created' ELSE 'technical_sheet.updated' END,'technical_sheets'::name,sheet_id::text,NULL,NULL,jsonb_build_object('order_id',p_order_id,'version',next_version));RETURN sheet_id;
END $$;

ALTER TABLE public.notifications DROP CONSTRAINT IF EXISTS notifications_type_check;
ALTER TABLE public.notifications ADD CONSTRAINT notifications_type_check CHECK(type IN('task_overdue','opportunity_stale','lead_assigned','opportunity_assigned','follow_up_alert','target_risk','proposal_viewed','proposal_change_requested','proposal_approved','proposal_rejected','quote_approval_required','quote_approval_decided','quote_expiring','art_approved','art_change_requested','material_shortage','material_received','order_blocked','order_released','delivery_risk','workcenter_overload')) NOT VALID;

REVOKE ALL ON FUNCTION public.create_art_version(uuid,uuid,text,text,numeric,numeric,text,text[],text,text),public.set_order_art_requirement(uuid,boolean),public.send_art_version(uuid,integer),public.save_technical_sheet(uuid,uuid,jsonb) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.create_art_version(uuid,uuid,text,text,numeric,numeric,text,text[],text,text),public.set_order_art_requirement(uuid,boolean),public.send_art_version(uuid,integer),public.save_technical_sheet(uuid,uuid,jsonb) TO authenticated;
REVOKE ALL ON FUNCTION public.get_public_art(text),public.record_art_view(text),public.respond_to_art(text,text,text,text),public.approve_art_version(text,text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.get_public_art(text),public.record_art_view(text),public.respond_to_art(text,text,text,text),public.approve_art_version(text,text) TO anon,authenticated;

COMMIT;
