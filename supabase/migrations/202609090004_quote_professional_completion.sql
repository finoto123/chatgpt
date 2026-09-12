-- Lote 7 — complementos de orçamento profissional.
-- Pré-requisitos: 202609080003_quotes_proposals.sql e 202609090001_payment_term_management.sql.
-- AGUARDANDO HOMOLOGAÇÃO no Supabase real.

BEGIN;

ALTER TABLE public.proposal_access_tokens
  ADD COLUMN IF NOT EXISTS first_viewed_at timestamptz;

ALTER TABLE public.pedidos
  ADD COLUMN IF NOT EXISTS commercial_subtotal numeric(14,2) CHECK(commercial_subtotal IS NULL OR commercial_subtotal>=0),
  ADD COLUMN IF NOT EXISTS commercial_discount_amount numeric(14,2) CHECK(commercial_discount_amount IS NULL OR commercial_discount_amount>=0),
  ADD COLUMN IF NOT EXISTS commercial_freight_amount numeric(14,2) CHECK(commercial_freight_amount IS NULL OR commercial_freight_amount>=0),
  ADD COLUMN IF NOT EXISTS commercial_additional_amount numeric(14,2) CHECK(commercial_additional_amount IS NULL OR commercial_additional_amount>=0),
  ADD COLUMN IF NOT EXISTS commercial_total_amount numeric(14,2) CHECK(commercial_total_amount IS NULL OR commercial_total_amount>=0);

UPDATE public.quote_items SET cost_source='calculated' WHERE cost_source='auto';
ALTER TABLE public.quote_items DROP CONSTRAINT IF EXISTS quote_items_cost_source_check;
ALTER TABLE public.quote_items
  ADD CONSTRAINT quote_items_cost_source_check
  CHECK(cost_source IN('manual','calculated','catalog','historical'));

ALTER TABLE public.quote_versions
  ADD CONSTRAINT quote_versions_id_quote_unique UNIQUE(id,quote_id);
ALTER TABLE public.quotes DROP CONSTRAINT IF EXISTS quotes_current_version_id_fkey;
ALTER TABLE public.quotes
  ADD CONSTRAINT quotes_current_version_matches_quote_fkey
  FOREIGN KEY(current_version_id,id) REFERENCES public.quote_versions(id,quote_id) ON DELETE RESTRICT;

ALTER TABLE public.discount_approvals
  DROP CONSTRAINT IF EXISTS discount_approvals_discount_percent_check;
ALTER TABLE public.discount_approvals
  ADD CONSTRAINT discount_approvals_discount_percent_check CHECK(discount_percent BETWEEN 0 AND 100),
  ADD CONSTRAINT discount_approvals_margin_percent_check CHECK(margin_percent BETWEEN -1000 AND 100),
  ADD CONSTRAINT discount_approvals_version_matches_quote_fkey
    FOREIGN KEY(quote_version_id,quote_id) REFERENCES public.quote_versions(id,quote_id) ON DELETE RESTRICT;

ALTER TABLE public.proposal_access_tokens
  ADD CONSTRAINT proposal_tokens_version_matches_quote_fkey
  FOREIGN KEY(quote_version_id,quote_id) REFERENCES public.quote_versions(id,quote_id) ON DELETE CASCADE;

CREATE OR REPLACE FUNCTION public.get_quote_dashboard_stats(p_start date DEFAULT NULL,p_end date DEFAULT NULL)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog,public AS $$
DECLARE start_date date:=COALESCE(p_start,date_trunc('month',(timezone('America/Sao_Paulo',now()))::date)::date);
  end_date date:=COALESCE(p_end,(timezone('America/Sao_Paulo',now()))::date);
  result jsonb;
BEGIN
  IF auth.uid() IS NULL OR NOT public.has_permission('quotes.view') THEN RAISE EXCEPTION 'permission denied' USING errcode='42501'; END IF;
  IF end_date<start_date OR end_date-start_date>730 THEN RAISE EXCEPTION 'invalid report period' USING errcode='22023'; END IF;
  WITH cohort AS (
    SELECT q.* FROM public.quotes q WHERE q.created_at>=start_date::timestamptz AND q.created_at<(end_date+1)::timestamptz
  ), sent AS (
    SELECT * FROM cohort WHERE status IN('sent','viewed','change_requested','approved','rejected','converted')
  ), approved AS (
    SELECT * FROM cohort WHERE status IN('approved','converted')
  ), pending AS (
    SELECT DISTINCT a.quote_id FROM public.discount_approvals a JOIN cohort q ON q.id=a.quote_id WHERE a.status='pending'
  )
  SELECT jsonb_build_object(
    'created',(SELECT count(*) FROM cohort),
    'draft',(SELECT count(*) FROM cohort WHERE status='draft'),
    'sent',(SELECT count(*) FROM sent),
    'sent_value',COALESCE((SELECT sum(total_amount) FROM sent),0),
    'waiting',(SELECT count(*) FROM cohort WHERE status IN('sent','viewed')),
    'waiting_value',COALESCE((SELECT sum(total_amount) FROM cohort WHERE status IN('sent','viewed')),0),
    'approved',(SELECT count(*) FROM approved),
    'approved_value',COALESCE((SELECT sum(total_amount) FROM approved),0),
    'expired',(SELECT count(*) FROM cohort WHERE status='expired'),
    'approval_rate',CASE WHEN (SELECT count(*) FROM sent)=0 THEN 0 ELSE round((SELECT count(*) FROM approved)::numeric/(SELECT count(*) FROM sent)*100,1) END,
    'average_margin',COALESCE((SELECT round(avg(margin_percent),2) FROM approved),0),
    'pending_approvals',(SELECT count(*) FROM pending),
    'pending_approval_value',COALESCE((SELECT sum(q.total_amount) FROM cohort q JOIN pending p ON p.quote_id=q.id),0)
  ) INTO result;
  RETURN result;
END $$;

CREATE OR REPLACE FUNCTION public.create_quote_version(p_quote_id uuid,p_valid_until date DEFAULT NULL)
RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog,public AS $$
DECLARE q public.quotes%ROWTYPE; old_v public.quote_versions%ROWTYPE; new_v public.quote_versions%ROWTYPE;
  next_version integer; new_valid_until date; old_item public.quote_items%ROWTYPE; new_item_id uuid;
BEGIN
  IF auth.uid() IS NULL OR NOT public.has_permission('quotes.update') THEN RAISE EXCEPTION 'permission denied' USING errcode='42501'; END IF;
  SELECT * INTO q FROM public.quotes WHERE id=p_quote_id FOR UPDATE;
  IF NOT FOUND OR q.status IN('converted','archived') THEN RAISE EXCEPTION 'quote unavailable' USING errcode='55000'; END IF;
  SELECT * INTO old_v FROM public.quote_versions WHERE id=q.current_version_id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'quote version missing' USING errcode='P0002'; END IF;
  IF old_v.sent_at IS NULL AND q.status='draft' THEN RETURN old_v.id; END IF;
  new_valid_until:=COALESCE(p_valid_until,GREATEST(old_v.valid_until,(timezone('America/Sao_Paulo',now()))::date+15));
  IF new_valid_until<(timezone('America/Sao_Paulo',now()))::date THEN RAISE EXCEPTION 'validity must not be in the past' USING errcode='22023'; END IF;
  SELECT COALESCE(max(version_number),0)+1 INTO next_version FROM public.quote_versions WHERE quote_id=q.id;
  INSERT INTO public.quote_versions(quote_id,version_number,status,subtotal,discount_amount,discount_percent,freight_amount,additional_amount,total_amount,estimated_cost,estimated_profit,margin_percent,markup,payment_terms_snapshot,customer_snapshot,commercial_snapshot,valid_until,desired_delivery_date,created_by)
  VALUES(q.id,next_version,'draft',old_v.subtotal,old_v.discount_amount,old_v.discount_percent,old_v.freight_amount,old_v.additional_amount,old_v.total_amount,old_v.estimated_cost,old_v.estimated_profit,old_v.margin_percent,old_v.markup,old_v.payment_terms_snapshot,old_v.customer_snapshot,old_v.commercial_snapshot,new_valid_until,old_v.desired_delivery_date,auth.uid()) RETURNING * INTO new_v;
  FOR old_item IN SELECT * FROM public.quote_items WHERE quote_version_id=old_v.id ORDER BY position LOOP
    INSERT INTO public.quote_items(quote_version_id,product_id,description,product_type,model,fabric_id,fabric_name_snapshot,color,customization_type,quantity,unit_price,unit_cost,cost_source,cost_set_by,cost_set_at,discount_amount,subtotal,estimated_cost,estimated_profit,notes,position)
    VALUES(new_v.id,old_item.product_id,old_item.description,old_item.product_type,old_item.model,old_item.fabric_id,old_item.fabric_name_snapshot,old_item.color,old_item.customization_type,old_item.quantity,old_item.unit_price,old_item.unit_cost,old_item.cost_source,old_item.cost_set_by,old_item.cost_set_at,old_item.discount_amount,old_item.subtotal,old_item.estimated_cost,old_item.estimated_profit,old_item.notes,old_item.position) RETURNING id INTO new_item_id;
    INSERT INTO public.quote_item_sizes(quote_item_id,size,quantity,position)
    SELECT new_item_id,size,quantity,position FROM public.quote_item_sizes WHERE quote_item_id=old_item.id;
  END LOOP;
  UPDATE public.proposal_access_tokens SET status='revoked',revoked_at=now() WHERE quote_id=q.id AND status='active';
  UPDATE public.quotes SET current_version_id=new_v.id,status='draft',valid_until=new_valid_until,sent_at=NULL,approved_at=NULL,rejected_at=NULL,updated_at=now() WHERE id=q.id;
  INSERT INTO public.activities(opportunity_id,customer_id,user_id,type,title,metadata)
  VALUES(q.opportunity_id,q.customer_id,auth.uid(),'system','Nova versão do orçamento',jsonb_build_object('event','quote.version_created','quote_id',q.id,'version',next_version,'source_version',old_v.version_number));
  PERFORM public.write_audit_log(auth.uid(),'quote.version_created','quotes'::name,q.id::text,to_jsonb(q),NULL,jsonb_build_object('version_id',new_v.id,'source_version_id',old_v.id));
  RETURN new_v.id;
END $$;

CREATE OR REPLACE FUNCTION public.duplicate_quote(p_quote_id uuid)
RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog,public AS $$
DECLARE q public.quotes%ROWTYPE; v public.quote_versions%ROWTYPE; payload jsonb; items jsonb; validity date; delivery date;
BEGIN
  IF auth.uid() IS NULL OR NOT public.has_permission('quotes.create') THEN RAISE EXCEPTION 'permission denied' USING errcode='42501'; END IF;
  SELECT * INTO q FROM public.quotes WHERE id=p_quote_id;
  IF NOT FOUND THEN RAISE EXCEPTION 'quote not found' USING errcode='P0002'; END IF;
  SELECT * INTO v FROM public.quote_versions WHERE id=q.current_version_id;
  validity:=GREATEST((timezone('America/Sao_Paulo',now()))::date+15,v.valid_until);
  delivery:=GREATEST((timezone('America/Sao_Paulo',now()))::date,v.desired_delivery_date);
  payload:=jsonb_build_object('opportunity_id',q.opportunity_id,'contact_id',q.contact_id,'valid_until',validity,'desired_delivery_date',delivery,'payment_term_id',q.payment_term_id,'commercial_notes',q.commercial_notes,'internal_notes',q.internal_notes,'discount_amount',v.discount_amount,'freight_amount',v.freight_amount,'additional_amount',v.additional_amount);
  SELECT jsonb_agg(jsonb_build_object('product_id',i.product_id,'description',i.description,'product_type',i.product_type,'model',i.model,'fabric_id',i.fabric_id,'fabric_name_snapshot',i.fabric_name_snapshot,'color',i.color,'customization_type',i.customization_type,'quantity',i.quantity,'unit_price',i.unit_price,'unit_cost',i.unit_cost,'cost_source',i.cost_source,'discount_amount',i.discount_amount,'notes',i.notes,'position',i.position,'sizes',(SELECT COALESCE(jsonb_agg(jsonb_build_object('size',s.size,'quantity',s.quantity,'position',s.position) ORDER BY s.position),'[]'::jsonb) FROM public.quote_item_sizes s WHERE s.quote_item_id=i.id)) ORDER BY i.position)
  INTO items FROM public.quote_items i WHERE i.quote_version_id=v.id;
  RETURN public.save_quote_draft(NULL,payload,items);
END $$;

CREATE OR REPLACE FUNCTION public.convert_quote_to_order(p_quote_id uuid)
RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog,public AS $$
DECLARE q public.quotes%ROWTYPE; v public.quote_versions%ROWTYPE; settings public.commercial_settings%ROWTYPE;
  order_id uuid; order_number text; item public.quote_items%ROWTYPE; size_row public.quote_item_sizes%ROWTYPE;
  installments jsonb; inst jsonb; idx integer:=0; count_inst integer; allocated numeric:=0; amount_value numeric; due_value date;
  stamp_types text; active_stages text[]; assigned_limit numeric:=0; needs_approval boolean;
BEGIN
  IF auth.uid() IS NULL OR NOT public.has_permission('orders.create') OR NOT public.has_permission('quotes.update') THEN RAISE EXCEPTION 'permission denied' USING errcode='42501'; END IF;
  SELECT * INTO q FROM public.quotes WHERE id=p_quote_id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'quote not found' USING errcode='P0002'; END IF;
  IF q.converted_order_id IS NOT NULL THEN RETURN q.converted_order_id; END IF;
  IF q.status<>'approved' OR NOT EXISTS(SELECT 1 FROM public.clientes c WHERE c.id=q.customer_id) THEN RAISE EXCEPTION 'quote must be approved with a valid customer' USING errcode='23514'; END IF;
  SELECT * INTO v FROM public.quote_versions WHERE id=q.current_version_id AND quote_id=q.id FOR UPDATE;
  IF NOT FOUND OR v.status<>'approved' THEN RAISE EXCEPTION 'current version must be approved' USING errcode='23514'; END IF;
  IF EXISTS(SELECT 1 FROM public.discount_approvals a WHERE a.quote_version_id=v.id AND a.status='pending') THEN RAISE EXCEPTION 'commercial approval incomplete' USING errcode='23514'; END IF;
  SELECT * INTO settings FROM public.commercial_settings WHERE id;
  SELECT COALESCE(max(CASE r.code WHEN 'administrator' THEN (settings.discount_limits->>'administrator')::numeric WHEN 'manager' THEN (settings.discount_limits->>'manager')::numeric WHEN 'commercial' THEN (settings.discount_limits->>'commercial')::numeric WHEN 'salesperson' THEN (settings.discount_limits->>'salesperson')::numeric ELSE 0 END),0)
  INTO assigned_limit FROM public.user_roles ur JOIN public.roles r ON r.id=ur.role_id WHERE ur.user_id=q.assigned_user_id;
  needs_approval:=v.discount_percent>assigned_limit OR (settings.require_margin_approval AND v.margin_percent<settings.minimum_margin_percent);
  IF needs_approval AND NOT EXISTS(SELECT 1 FROM public.discount_approvals a WHERE a.quote_version_id=v.id AND a.status='approved') THEN RAISE EXCEPTION 'required commercial approval missing' USING errcode='23514'; END IF;
  IF NOT EXISTS(SELECT 1 FROM public.quote_items i WHERE i.quote_version_id=v.id) OR EXISTS(SELECT 1 FROM public.quote_items i WHERE i.quote_version_id=v.id AND (i.quantity<=0 OR i.subtotal<0 OR (EXISTS(SELECT 1 FROM public.quote_item_sizes z WHERE z.quote_item_id=i.id) AND i.quantity<>(SELECT sum(z.quantity) FROM public.quote_item_sizes z WHERE z.quote_item_id=i.id)))) THEN RAISE EXCEPTION 'invalid quote items or size grade' USING errcode='23514'; END IF;
  IF v.payment_terms_snapshot->'rules' IS NULL OR NOT public.payment_term_rules_valid(v.payment_terms_snapshot->'rules') THEN RAISE EXCEPTION 'invalid payment terms' USING errcode='23514'; END IF;
  installments:=v.payment_terms_snapshot->'rules'->'installments';
  SELECT string_agg(DISTINCT CASE i.customization_type WHEN 'embroidery' THEN 'BORDADO' WHEN 'silk' THEN 'SILK' WHEN 'dtf' THEN 'DTF' WHEN 'sublimation' THEN 'SUBLIMAÇÃO' WHEN 'other' THEN 'OUTRO' END,', ') FILTER(WHERE i.customization_type<>'none') INTO stamp_types FROM public.quote_items i WHERE i.quote_version_id=v.id;
  active_stages:=CASE WHEN stamp_types IS NULL THEN ARRAY['corte','costura'] ELSE ARRAY['corte','estampa','costura'] END;
  order_number:=lpad(nextval('public.pedido_number_seq')::text,4,'0')||'-'||to_char(timezone('America/Sao_Paulo',now()),'YY');
  INSERT INTO public.pedidos(numero,cliente,cliente_id,data_pedido,tipo_estampa,forma_pagamento,valor_entrada,entrega_programado,etapas_ativas,observacoes,status,client_operation_id,source_quote_id,source_quote_version_id,commercial_assigned_user_id,estimated_sale_cost,commercial_subtotal,commercial_discount_amount,commercial_freight_amount,commercial_additional_amount,commercial_total_amount)
  VALUES(order_number,v.customer_snapshot->>'name',q.customer_id,(timezone('America/Sao_Paulo',now()))::date,stamp_types,v.payment_terms_snapshot->>'name',0,v.desired_delivery_date,active_stages,NULLIF(v.commercial_snapshot->>'notes',''),'aguardando_corte',q.id,q.id,v.id,q.assigned_user_id,v.estimated_cost,v.subtotal,v.discount_amount,v.freight_amount,v.additional_amount,v.total_amount) RETURNING id INTO order_id;
  FOR item IN SELECT * FROM public.quote_items WHERE quote_version_id=v.id ORDER BY position LOOP
    IF EXISTS(SELECT 1 FROM public.quote_item_sizes WHERE quote_item_id=item.id) THEN
      FOR size_row IN SELECT * FROM public.quote_item_sizes WHERE quote_item_id=item.id ORDER BY position LOOP
        INSERT INTO public.itens_pedido(pedido_id,qtde,tamanho,modelo,tecido_cor,observacao,valor_unitario) VALUES(order_id,size_row.quantity,size_row.size,COALESCE(item.model,item.description),concat_ws(' / ',item.fabric_name_snapshot,item.color),item.notes,round(item.subtotal/item.quantity,2));
      END LOOP;
    ELSE
      INSERT INTO public.itens_pedido(pedido_id,qtde,tamanho,modelo,tecido_cor,observacao,valor_unitario) VALUES(order_id,item.quantity,'Único',COALESCE(item.model,item.description),concat_ws(' / ',item.fabric_name_snapshot,item.color),item.notes,round(item.subtotal/item.quantity,2));
    END IF;
  END LOOP;
  count_inst:=jsonb_array_length(installments);
  FOR inst IN SELECT * FROM jsonb_array_elements(installments) LOOP
    idx:=idx+1;amount_value:=CASE WHEN idx=count_inst THEN v.total_amount-allocated ELSE round(v.total_amount*(inst->>'percent')::numeric/100,2) END;allocated:=allocated+amount_value;
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

-- Uma proposta respondida continua disponível para leitura, mas nunca aceita replay.
CREATE OR REPLACE FUNCTION public.get_public_proposal(p_token text)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog,public,extensions AS $$
DECLARE t public.proposal_access_tokens%ROWTYPE; q public.quotes%ROWTYPE; v public.quote_versions%ROWTYPE;
BEGIN
  SELECT * INTO t FROM public.proposal_access_tokens WHERE token_hash=encode(extensions.digest(p_token,'sha256'),'hex') AND status IN('active','used');
  IF NOT FOUND THEN RETURN NULL; END IF;
  SELECT * INTO q FROM public.quotes WHERE id=t.quote_id;
  SELECT * INTO v FROM public.quote_versions WHERE id=t.quote_version_id;
  IF t.expires_at<=now() OR v.valid_until<(timezone('America/Sao_Paulo',now()))::date OR q.current_version_id<>v.id OR q.status IN('converted','archived') THEN
    RETURN jsonb_build_object('unavailable',true,'reason',CASE WHEN q.current_version_id<>v.id THEN 'newer_version' ELSE 'expired' END);
  END IF;
  RETURN jsonb_build_object(
    'quote_number',q.quote_number,'version_number',v.version_number,'status',v.status,'currency',q.currency,
    'valid_until',v.valid_until,'desired_delivery_date',v.desired_delivery_date,
    'customer',jsonb_build_object('name',v.customer_snapshot->>'name','contact_name',v.customer_snapshot->>'contact_name','email',v.customer_snapshot->>'email','phone',v.customer_snapshot->>'phone'),
    'commercial',jsonb_build_object('assigned_name',v.commercial_snapshot->>'assigned_name','notes',v.commercial_snapshot->>'notes','payment_term',v.payment_terms_snapshot->>'name'),
    'items',(SELECT COALESCE(jsonb_agg(jsonb_build_object('description',i.description,'product_type',i.product_type,'model',i.model,'fabric',i.fabric_name_snapshot,'color',i.color,'customization_type',i.customization_type,'quantity',i.quantity,'unit_price',i.unit_price,'discount_amount',i.discount_amount,'subtotal',i.subtotal,'notes',i.notes,'sizes',(SELECT COALESCE(jsonb_agg(jsonb_build_object('size',z.size,'quantity',z.quantity) ORDER BY z.position),'[]'::jsonb) FROM public.quote_item_sizes z WHERE z.quote_item_id=i.id)) ORDER BY i.position),'[]'::jsonb) FROM public.quote_items i WHERE i.quote_version_id=v.id),
    'subtotal',v.subtotal,'discount_amount',v.discount_amount,'freight_amount',v.freight_amount,'additional_amount',v.additional_amount,'total_amount',v.total_amount,
    'sent_at',v.sent_at,'first_viewed_at',v.first_viewed_at,'last_viewed_at',v.last_viewed_at,'view_count',v.view_count,
    'can_respond',t.status='active' AND q.status IN('sent','viewed')
  );
END $$;

CREATE OR REPLACE FUNCTION public.record_proposal_view(p_token text)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog,public,extensions AS $$
DECLARE t public.proposal_access_tokens%ROWTYPE; q public.quotes%ROWTYPE; v public.quote_versions%ROWTYPE; first_view boolean; meaningful_view boolean;
BEGIN
  SELECT * INTO t FROM public.proposal_access_tokens WHERE token_hash=encode(extensions.digest(p_token,'sha256'),'hex') AND status='active' AND expires_at>now() FOR UPDATE;
  IF NOT FOUND THEN RETURN; END IF;
  SELECT * INTO q FROM public.quotes WHERE id=t.quote_id;
  SELECT * INTO v FROM public.quote_versions WHERE id=t.quote_version_id FOR UPDATE;
  IF q.current_version_id<>t.quote_version_id OR q.status NOT IN('sent','viewed') THEN RETURN; END IF;
  first_view:=v.first_viewed_at IS NULL;
  meaningful_view:=t.last_viewed_at IS NULL OR t.last_viewed_at<now()-interval '5 minutes';
  UPDATE public.proposal_access_tokens SET view_count=view_count+CASE WHEN meaningful_view THEN 1 ELSE 0 END,first_viewed_at=COALESCE(first_viewed_at,now()),last_viewed_at=now() WHERE id=t.id;
  UPDATE public.quote_versions SET view_count=view_count+CASE WHEN meaningful_view THEN 1 ELSE 0 END,first_viewed_at=COALESCE(first_viewed_at,now()),last_viewed_at=now(),status=CASE WHEN status='sent' THEN 'viewed' ELSE status END WHERE id=t.quote_version_id;
  UPDATE public.quotes SET status=CASE WHEN status='sent' THEN 'viewed' ELSE status END,updated_at=now() WHERE id=q.id;
  IF first_view THEN
    INSERT INTO public.activities(opportunity_id,customer_id,user_id,type,title,metadata) VALUES(q.opportunity_id,q.customer_id,q.assigned_user_id,'system','Cliente visualizou a proposta',jsonb_build_object('event','quote.viewed','quote_id',q.id,'version_id',t.quote_version_id));
    INSERT INTO public.notifications(user_id,type,title,body,entity_type,entity_id,idempotency_key) VALUES(q.assigned_user_id,'proposal_viewed','Proposta visualizada',q.quote_number,'quote',q.id,'proposal-first-view-version-'||t.quote_version_id) ON CONFLICT(idempotency_key) DO NOTHING;
    PERFORM public.write_audit_log(NULL,'quote.viewed','quotes'::name,q.id::text,NULL,NULL,jsonb_build_object('token_id',t.id,'version_id',t.quote_version_id));
  END IF;
END $$;

CREATE OR REPLACE FUNCTION public.approve_quote_version(p_token text,p_name text,p_job_title text DEFAULT NULL,p_notes text DEFAULT NULL)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog,public AS $$
BEGIN
  PERFORM public.respond_to_proposal(p_token,'approve',p_name,p_job_title,p_notes);
END $$;

REVOKE ALL ON FUNCTION public.get_quote_dashboard_stats(date,date),public.create_quote_version(uuid,date),public.duplicate_quote(uuid) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.get_quote_dashboard_stats(date,date),public.create_quote_version(uuid,date),public.duplicate_quote(uuid) TO authenticated;
REVOKE ALL ON FUNCTION public.get_public_proposal(text),public.record_proposal_view(text),public.approve_quote_version(text,text,text,text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.get_public_proposal(text),public.record_proposal_view(text),public.approve_quote_version(text,text,text,text) TO anon,authenticated;

COMMENT ON FUNCTION public.get_quote_dashboard_stats(date,date) IS 'Agregações de orçamento no banco, sem carregar a base no frontend.';
COMMENT ON FUNCTION public.create_quote_version(uuid,date) IS 'Clona o snapshot atual em nova versão editável e revoga links anteriores.';

COMMIT;
