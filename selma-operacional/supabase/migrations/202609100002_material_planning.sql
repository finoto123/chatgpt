-- Lote 8 — BOM, necessidades e reservas de estoque.
-- AGUARDANDO HOMOLOGAÇÃO.
BEGIN;

CREATE TABLE public.bill_of_materials(
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  order_id uuid NOT NULL REFERENCES public.pedidos(id) ON DELETE RESTRICT,
  order_item_id uuid REFERENCES public.itens_pedido(id) ON DELETE RESTRICT,
  technical_sheet_id uuid REFERENCES public.technical_sheets(id) ON DELETE SET NULL,
  version integer NOT NULL CHECK(version>0),
  status text NOT NULL DEFAULT 'draft' CHECK(status IN('draft','ready','superseded','cancelled')),
  source text NOT NULL DEFAULT 'manual' CHECK(source IN('manual','template','calculated')),
  created_by uuid NOT NULL REFERENCES public.profiles(id) ON DELETE RESTRICT DEFAULT auth.uid(),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(order_id,order_item_id,version)
);

CREATE TABLE public.bom_items(
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  bom_id uuid NOT NULL REFERENCES public.bill_of_materials(id) ON DELETE CASCADE,
  fabric_id uuid REFERENCES public.tecidos(id) ON DELETE RESTRICT,
  material_type text NOT NULL CHECK(material_type IN('fabric','thread','ink','paper','trim','packaging','service','other')),
  description text NOT NULL CHECK(length(trim(description)) BETWEEN 2 AND 200),
  quantity_per_unit numeric(14,4) NOT NULL CHECK(quantity_per_unit>0),
  waste_percent numeric(7,4) NOT NULL DEFAULT 0 CHECK(waste_percent BETWEEN 0 AND 100),
  required_quantity numeric(14,4) NOT NULL CHECK(required_quantity>0),
  unit text NOT NULL CHECK(unit IN('kg','meter','unit','sheet','roll','minute','hour','other')),
  source text NOT NULL DEFAULT 'manual' CHECK(source IN('manual','template','calculated')),
  notes text,
  position integer NOT NULL DEFAULT 0 CHECK(position>=0)
);

CREATE TABLE public.inventory_reservations(
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  order_id uuid NOT NULL REFERENCES public.pedidos(id) ON DELETE RESTRICT,
  order_item_id uuid REFERENCES public.itens_pedido(id) ON DELETE RESTRICT,
  bom_item_id uuid NOT NULL REFERENCES public.bom_items(id) ON DELETE RESTRICT,
  fabric_id uuid NOT NULL REFERENCES public.tecidos(id) ON DELETE RESTRICT,
  quantity numeric(14,4) NOT NULL CHECK(quantity>0),
  unit text NOT NULL CHECK(unit IN('kg','meter','unit','sheet','roll','minute','hour','other')),
  status text NOT NULL DEFAULT 'reserved' CHECK(status IN('reserved','consumed','released','cancelled')),
  created_by uuid NOT NULL REFERENCES public.profiles(id) ON DELETE RESTRICT DEFAULT auth.uid(),
  created_at timestamptz NOT NULL DEFAULT now(),
  released_at timestamptz,
  released_by uuid REFERENCES public.profiles(id) ON DELETE SET NULL,
  consumed_at timestamptz,
  consumed_by uuid REFERENCES public.profiles(id) ON DELETE SET NULL,
  release_reason text
);

CREATE UNIQUE INDEX inventory_reservation_active_bom_idx ON public.inventory_reservations(bom_item_id) WHERE status='reserved';
CREATE INDEX bill_of_materials_order_idx ON public.bill_of_materials(order_id,status);
CREATE INDEX bom_items_bom_idx ON public.bom_items(bom_id,position);
CREATE INDEX bom_items_material_idx ON public.bom_items(fabric_id) WHERE fabric_id IS NOT NULL;
CREATE INDEX reservations_order_idx ON public.inventory_reservations(order_id,status);
CREATE INDEX reservations_material_idx ON public.inventory_reservations(fabric_id,status);

ALTER TABLE public.bill_of_materials ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.bom_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.inventory_reservations ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.bill_of_materials,public.bom_items,public.inventory_reservations FROM PUBLIC,anon;
GRANT SELECT ON public.bill_of_materials,public.bom_items,public.inventory_reservations TO authenticated;
GRANT INSERT,UPDATE ON public.bill_of_materials,public.bom_items,public.inventory_reservations TO authenticated;
CREATE POLICY bom_select_authorized ON public.bill_of_materials FOR SELECT TO authenticated USING(public.has_permission('production.view') OR public.has_permission('inventory.view'));
CREATE POLICY bom_manage_authorized ON public.bill_of_materials FOR ALL TO authenticated USING(public.has_permission('production.update')) WITH CHECK(public.has_permission('production.update'));
CREATE POLICY bom_items_select_authorized ON public.bom_items FOR SELECT TO authenticated USING(public.has_permission('production.view') OR public.has_permission('inventory.view'));
CREATE POLICY bom_items_manage_authorized ON public.bom_items FOR ALL TO authenticated USING(public.has_permission('production.update')) WITH CHECK(public.has_permission('production.update'));
CREATE POLICY reservations_select_authorized ON public.inventory_reservations FOR SELECT TO authenticated USING(public.has_permission('inventory.view') OR public.has_permission('production.view'));

CREATE OR REPLACE VIEW public.material_requirements WITH(security_invoker=true) AS
WITH physical AS(
  SELECT t.id fabric_id,COALESCE(sum(CASE WHEN lower(m.tipo)='entrada' THEN m.quantidade WHEN lower(m.tipo) IN('saída','saida') THEN -m.quantidade ELSE m.quantidade END),0) physical_quantity
  FROM public.tecidos t LEFT JOIN public.movimentacoes_estoque m ON m.tecido_id=t.id GROUP BY t.id
), reserved AS(
  SELECT fabric_id,sum(quantity) reserved_quantity FROM public.inventory_reservations WHERE status='reserved' GROUP BY fabric_id
), per_order AS(
  SELECT order_id,bom_item_id,sum(quantity) reserved_for_order FROM public.inventory_reservations WHERE status='reserved' GROUP BY order_id,bom_item_id
)
SELECT b.order_id,b.order_item_id,bi.id bom_item_id,bi.fabric_id,bi.material_type,bi.description,bi.unit,
  bi.required_quantity,COALESCE(p.physical_quantity,0) physical_quantity,
  COALESCE(r.reserved_quantity,0) reserved_quantity,
  COALESCE(po.reserved_for_order,0) reserved_for_order,
  GREATEST(COALESCE(p.physical_quantity,0)-COALESCE(r.reserved_quantity,0),0) available_quantity,
  0::numeric in_purchase_quantity,
  GREATEST(bi.required_quantity-COALESCE(po.reserved_for_order,0),0) shortage_quantity
FROM public.bill_of_materials b JOIN public.bom_items bi ON bi.bom_id=b.id
LEFT JOIN physical p ON p.fabric_id=bi.fabric_id LEFT JOIN reserved r ON r.fabric_id=bi.fabric_id LEFT JOIN per_order po ON po.order_id=b.order_id AND po.bom_item_id=bi.id
WHERE b.status='ready';
REVOKE ALL ON public.material_requirements FROM PUBLIC,anon;
GRANT SELECT ON public.material_requirements TO authenticated;

CREATE OR REPLACE FUNCTION public.save_bill_of_materials(p_order_id uuid,p_order_item_id uuid,p_source text,p_items jsonb)
RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog,public AS $$
DECLARE bom_id uuid; next_version integer; order_quantity numeric; item jsonb; required numeric; fabric_unit text;
BEGIN
  IF auth.uid() IS NULL OR NOT public.has_permission('production.update') THEN RAISE EXCEPTION 'permission denied' USING errcode='42501'; END IF;
  SELECT COALESCE(sum(qtde),0) INTO order_quantity FROM public.itens_pedido WHERE pedido_id=p_order_id AND (p_order_item_id IS NULL OR id=p_order_item_id);
  IF order_quantity<=0 OR jsonb_typeof(p_items)<>'array' OR jsonb_array_length(p_items)=0 OR p_source NOT IN('manual','template','calculated') THEN RAISE EXCEPTION 'invalid BOM input' USING errcode='22023'; END IF;
  PERFORM 1 FROM public.pedidos WHERE id=p_order_id FOR UPDATE; IF NOT FOUND THEN RAISE EXCEPTION 'order not found' USING errcode='P0002'; END IF;
  IF p_order_item_id IS NOT NULL AND NOT EXISTS(SELECT 1 FROM public.itens_pedido WHERE id=p_order_item_id AND pedido_id=p_order_id) THEN RAISE EXCEPTION 'order item mismatch' USING errcode='23514'; END IF;
  SELECT COALESCE(max(version),0)+1 INTO next_version FROM public.bill_of_materials WHERE order_id=p_order_id AND order_item_id IS NOT DISTINCT FROM p_order_item_id;
  UPDATE public.inventory_reservations SET status='released',released_at=now(),released_by=auth.uid(),release_reason='BOM substituída' WHERE order_id=p_order_id AND status='reserved' AND bom_item_id IN(SELECT bi.id FROM public.bom_items bi JOIN public.bill_of_materials old_b ON old_b.id=bi.bom_id WHERE old_b.order_item_id IS NOT DISTINCT FROM p_order_item_id);
  UPDATE public.bill_of_materials SET status='superseded',updated_at=now() WHERE order_id=p_order_id AND order_item_id IS NOT DISTINCT FROM p_order_item_id AND status IN('draft','ready');
  INSERT INTO public.bill_of_materials(order_id,order_item_id,version,status,source) VALUES(p_order_id,p_order_item_id,next_version,'ready',p_source) RETURNING id INTO bom_id;
  FOR item IN SELECT * FROM jsonb_array_elements(p_items) LOOP
    IF COALESCE((item->>'quantity_per_unit')::numeric,0)<=0 OR COALESCE((item->>'waste_percent')::numeric,0) NOT BETWEEN 0 AND 100 OR item->>'unit' NOT IN('kg','meter','unit','sheet','roll','minute','hour','other') OR item->>'material_type' NOT IN('fabric','thread','ink','paper','trim','packaging','service','other') THEN RAISE EXCEPTION 'invalid BOM item' USING errcode='22023'; END IF;
    IF NULLIF(item->>'fabric_id','') IS NOT NULL THEN SELECT unidade INTO fabric_unit FROM public.tecidos WHERE id=(item->>'fabric_id')::uuid; IF NOT FOUND THEN RAISE EXCEPTION 'material not found' USING errcode='P0002'; END IF; IF fabric_unit IS NOT NULL AND lower(fabric_unit) NOT IN(lower(item->>'unit'),CASE item->>'unit' WHEN 'meter' THEN 'metro' WHEN 'unit' THEN 'unidade' WHEN 'sheet' THEN 'folha' WHEN 'roll' THEN 'rolo' ELSE lower(item->>'unit') END) THEN RAISE EXCEPTION 'material unit mismatch' USING errcode='23514'; END IF; END IF;
    required:=round(order_quantity*(item->>'quantity_per_unit')::numeric*(1+(item->>'waste_percent')::numeric/100),4);
    INSERT INTO public.bom_items(bom_id,fabric_id,material_type,description,quantity_per_unit,waste_percent,required_quantity,unit,source,notes,position)
    VALUES(bom_id,NULLIF(item->>'fabric_id','')::uuid,item->>'material_type',trim(item->>'description'),(item->>'quantity_per_unit')::numeric,(item->>'waste_percent')::numeric,required,item->>'unit',COALESCE(NULLIF(item->>'source',''),p_source),NULLIF(trim(item->>'notes'),''),COALESCE((item->>'position')::integer,0));
  END LOOP;
  UPDATE public.pedidos SET production_released_at=NULL,production_released_by=NULL,planning_revision=planning_revision+1 WHERE id=p_order_id;
  PERFORM public.write_audit_log(auth.uid(),CASE WHEN next_version=1 THEN 'bom.created' ELSE 'bom.updated' END,'bill_of_materials'::name,bom_id::text,NULL,NULL,jsonb_build_object('order_id',p_order_id,'version',next_version));
  RETURN bom_id;
END $$;

CREATE OR REPLACE FUNCTION public.reserve_order_materials(p_order_id uuid)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog,public AS $$
DECLARE req record; physical numeric; reserved_total numeric; already numeric; free numeric; add_quantity numeric; reservation_id uuid; reserved_now numeric:=0; shortage numeric:=0;
BEGIN
  IF auth.uid() IS NULL OR NOT(public.has_permission('inventory.adjust') OR public.has_permission('production.update')) THEN RAISE EXCEPTION 'permission denied' USING errcode='42501'; END IF;
  PERFORM 1 FROM public.pedidos WHERE id=p_order_id AND status<>'cancelado' FOR UPDATE; IF NOT FOUND THEN RAISE EXCEPTION 'order unavailable' USING errcode='P0002'; END IF;
  IF NOT EXISTS(SELECT 1 FROM public.bill_of_materials WHERE order_id=p_order_id AND status='ready') THEN RAISE EXCEPTION 'ready BOM required' USING errcode='23514'; END IF;
  FOR req IN SELECT b.order_item_id,bi.* FROM public.bill_of_materials b JOIN public.bom_items bi ON bi.bom_id=b.id WHERE b.order_id=p_order_id AND b.status='ready' AND bi.fabric_id IS NOT NULL ORDER BY bi.fabric_id,bi.id LOOP
    PERFORM 1 FROM public.tecidos WHERE id=req.fabric_id FOR UPDATE;
    SELECT COALESCE(sum(CASE WHEN lower(tipo)='entrada' THEN quantidade WHEN lower(tipo) IN('saída','saida') THEN -quantidade ELSE quantidade END),0) INTO physical FROM public.movimentacoes_estoque WHERE tecido_id=req.fabric_id;
    SELECT COALESCE(sum(quantity),0) INTO reserved_total FROM public.inventory_reservations WHERE fabric_id=req.fabric_id AND status='reserved';
    SELECT id,quantity INTO reservation_id,already FROM public.inventory_reservations WHERE bom_item_id=req.id AND status='reserved' FOR UPDATE;
    already:=COALESCE(already,0);free:=GREATEST(physical-reserved_total,0);add_quantity:=LEAST(GREATEST(req.required_quantity-already,0),free);
    IF add_quantity>0 THEN
      IF reservation_id IS NULL THEN INSERT INTO public.inventory_reservations(order_id,order_item_id,bom_item_id,fabric_id,quantity,unit) VALUES(p_order_id,req.order_item_id,req.id,req.fabric_id,add_quantity,req.unit) RETURNING id INTO reservation_id;
      ELSE UPDATE public.inventory_reservations SET quantity=quantity+add_quantity WHERE id=reservation_id; END IF;
      reserved_now:=reserved_now+add_quantity;
    END IF;
    shortage:=shortage+GREATEST(req.required_quantity-already-add_quantity,0);
  END LOOP;
  PERFORM public.write_audit_log(auth.uid(),'inventory.reserved','inventory_reservations'::name,p_order_id::text,NULL,NULL,jsonb_build_object('reserved_now',reserved_now,'shortage',shortage));
  IF shortage>0 THEN INSERT INTO public.notifications(user_id,type,title,body,entity_type,entity_id,idempotency_key) SELECT COALESCE(p.commercial_assigned_user_id,auth.uid()),'material_shortage','Material insuficiente','Pedido '||p.numero||': falta '||shortage,'order',p.id,'material-shortage-'||p.id||'-'||p.planning_revision FROM public.pedidos p WHERE p.id=p_order_id ON CONFLICT(idempotency_key) DO NOTHING; END IF;
  RETURN jsonb_build_object('reserved',reserved_now,'shortage',shortage,'complete',shortage=0);
END $$;

CREATE OR REPLACE FUNCTION public.consume_inventory_reservation(p_reservation_id uuid,p_operation_id uuid)
RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog,public AS $$
DECLARE reservation public.inventory_reservations%ROWTYPE; movement_id uuid;
BEGIN
  IF auth.uid() IS NULL OR NOT public.has_permission('inventory.adjust') THEN RAISE EXCEPTION 'permission denied' USING errcode='42501'; END IF;
  SELECT * INTO reservation FROM public.inventory_reservations WHERE id=p_reservation_id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'reservation not found' USING errcode='P0002'; END IF;
  IF reservation.status='consumed' THEN SELECT id INTO movement_id FROM public.movimentacoes_estoque WHERE reference_type='reservation_consumption' AND reference_id=reservation.id LIMIT 1; RETURN movement_id; END IF;
  IF reservation.status<>'reserved' THEN RAISE EXCEPTION 'reservation unavailable' USING errcode='55000'; END IF;
  SELECT id INTO movement_id FROM public.movimentacoes_estoque WHERE reference_type='reservation_consumption' AND reference_id=reservation.id LIMIT 1;
  IF movement_id IS NULL THEN
    movement_id:=public.record_inventory_movement(reservation.fabric_id,(timezone('America/Sao_Paulo',now()))::date,'Saída',reservation.quantity,NULL,NULL,NULL,'Consumo reservado do pedido '||reservation.order_id,'reservation_consumption',reservation.id);
  END IF;
  UPDATE public.inventory_reservations SET status='consumed',consumed_at=now(),consumed_by=auth.uid() WHERE id=reservation.id;
  PERFORM public.write_audit_log(auth.uid(),'inventory.consumed','inventory_reservations'::name,reservation.id::text,NULL,NULL,jsonb_build_object('movement_id',movement_id,'operation_id',p_operation_id));
  RETURN movement_id;
END $$;

CREATE OR REPLACE FUNCTION public.release_cancelled_order_reservations()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog,public AS $$
BEGIN
  IF NEW.status='cancelado' AND OLD.status IS DISTINCT FROM NEW.status THEN UPDATE public.inventory_reservations SET status='released',released_at=now(),released_by=auth.uid(),release_reason='Pedido cancelado' WHERE order_id=NEW.id AND status='reserved'; IF FOUND THEN PERFORM public.write_audit_log(auth.uid(),'inventory.reservation_released','pedidos'::name,NEW.id::text,NULL,NULL,jsonb_build_object('reason','order_cancelled')); END IF; END IF;
  RETURN NEW;
END $$;
REVOKE ALL ON FUNCTION public.release_cancelled_order_reservations() FROM PUBLIC,anon,authenticated;
CREATE TRIGGER release_reservations_on_order_cancel AFTER UPDATE OF status ON public.pedidos FOR EACH ROW EXECUTE FUNCTION public.release_cancelled_order_reservations();

REVOKE ALL ON FUNCTION public.save_bill_of_materials(uuid,uuid,text,jsonb),public.reserve_order_materials(uuid),public.consume_inventory_reservation(uuid,uuid) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.save_bill_of_materials(uuid,uuid,text,jsonb),public.reserve_order_materials(uuid),public.consume_inventory_reservation(uuid,uuid) TO authenticated;

COMMIT;
