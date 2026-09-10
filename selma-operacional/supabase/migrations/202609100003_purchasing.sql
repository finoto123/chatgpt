-- Lote 8 — fornecedores, pedidos de compra e recebimento parcial.
-- AGUARDANDO HOMOLOGAÇÃO.
BEGIN;

CREATE SEQUENCE public.purchase_order_number_seq;

CREATE TABLE public.suppliers(
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL UNIQUE CHECK(length(trim(name)) BETWEEN 2 AND 160),
  document text,
  phone text,
  email text,
  contact text,
  lead_time_days integer NOT NULL DEFAULT 7 CHECK(lead_time_days BETWEEN 0 AND 365),
  active boolean NOT NULL DEFAULT true,
  notes text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.tecidos ADD COLUMN IF NOT EXISTS preferred_supplier_id uuid REFERENCES public.suppliers(id) ON DELETE SET NULL;

CREATE TABLE public.purchase_orders(
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  number text NOT NULL UNIQUE,
  supplier_id uuid NOT NULL REFERENCES public.suppliers(id) ON DELETE RESTRICT,
  status text NOT NULL DEFAULT 'draft' CHECK(status IN('draft','sent','confirmed','partial','received','cancelled')),
  expected_date date,
  total numeric(14,2) NOT NULL DEFAULT 0 CHECK(total>=0),
  notes text,
  created_by uuid NOT NULL REFERENCES public.profiles(id) ON DELETE RESTRICT DEFAULT auth.uid(),
  created_at timestamptz NOT NULL DEFAULT now(),
  sent_at timestamptz,
  received_at timestamptz,
  cancelled_at timestamptz,
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE public.purchase_order_items(
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  purchase_order_id uuid NOT NULL REFERENCES public.purchase_orders(id) ON DELETE CASCADE,
  fabric_id uuid NOT NULL REFERENCES public.tecidos(id) ON DELETE RESTRICT,
  description text NOT NULL,
  quantity numeric(14,4) NOT NULL CHECK(quantity>0),
  received_quantity numeric(14,4) NOT NULL DEFAULT 0 CHECK(received_quantity>=0 AND received_quantity<=quantity),
  unit text NOT NULL CHECK(unit IN('kg','meter','unit','sheet','roll','other')),
  unit_cost numeric(14,4) NOT NULL DEFAULT 0 CHECK(unit_cost>=0),
  total numeric(14,2) NOT NULL CHECK(total>=0),
  required_for_order_id uuid REFERENCES public.pedidos(id) ON DELETE SET NULL,
  position integer NOT NULL DEFAULT 0 CHECK(position>=0)
);

CREATE TABLE public.purchase_receipts(
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  purchase_order_id uuid NOT NULL REFERENCES public.purchase_orders(id) ON DELETE RESTRICT,
  operation_id uuid NOT NULL UNIQUE,
  received_at timestamptz NOT NULL DEFAULT now(),
  invoice_number text,
  notes text,
  payload jsonb NOT NULL CHECK(jsonb_typeof(payload)='array'),
  created_by uuid NOT NULL REFERENCES public.profiles(id) ON DELETE RESTRICT DEFAULT auth.uid()
);

CREATE INDEX suppliers_active_idx ON public.suppliers(active,name);
CREATE INDEX purchase_orders_supplier_idx ON public.purchase_orders(supplier_id,status);
CREATE INDEX purchase_orders_expected_idx ON public.purchase_orders(expected_date) WHERE status IN('sent','confirmed','partial');
CREATE INDEX purchase_items_order_idx ON public.purchase_order_items(purchase_order_id);
CREATE INDEX purchase_items_material_idx ON public.purchase_order_items(fabric_id);
CREATE INDEX purchase_items_required_order_idx ON public.purchase_order_items(required_for_order_id) WHERE required_for_order_id IS NOT NULL;
CREATE INDEX purchase_receipts_order_idx ON public.purchase_receipts(purchase_order_id,received_at DESC);

ALTER TABLE public.suppliers ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.purchase_orders ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.purchase_order_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.purchase_receipts ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.suppliers,public.purchase_orders,public.purchase_order_items,public.purchase_receipts FROM PUBLIC,anon;
GRANT SELECT ON public.suppliers,public.purchase_orders,public.purchase_order_items,public.purchase_receipts TO authenticated;
GRANT INSERT,UPDATE ON public.suppliers,public.purchase_orders,public.purchase_order_items,public.purchase_receipts TO authenticated;
CREATE POLICY suppliers_view ON public.suppliers FOR SELECT TO authenticated USING(public.has_permission('purchases.view'));
CREATE POLICY suppliers_manage ON public.suppliers FOR ALL TO authenticated USING(public.has_permission('purchases.update')) WITH CHECK(public.has_permission('purchases.update'));
CREATE POLICY purchase_orders_view ON public.purchase_orders FOR SELECT TO authenticated USING(public.has_permission('purchases.view'));
CREATE POLICY purchase_orders_manage ON public.purchase_orders FOR ALL TO authenticated USING(public.has_permission('purchases.update') OR public.has_permission('purchases.create')) WITH CHECK(public.has_permission('purchases.update') OR public.has_permission('purchases.create'));
CREATE POLICY purchase_items_view ON public.purchase_order_items FOR SELECT TO authenticated USING(public.has_permission('purchases.view'));
CREATE POLICY purchase_items_manage ON public.purchase_order_items FOR ALL TO authenticated USING(public.has_permission('purchases.update') OR public.has_permission('purchases.create')) WITH CHECK(public.has_permission('purchases.update') OR public.has_permission('purchases.create'));
CREATE POLICY purchase_receipts_view ON public.purchase_receipts FOR SELECT TO authenticated USING(public.has_permission('purchases.view'));

INSERT INTO public.role_permissions(role_id,permission_id)
SELECT r.id,p.id FROM public.roles r JOIN public.permissions p ON p.code='inventory.adjust' WHERE r.code='purchasing'
ON CONFLICT DO NOTHING;

CREATE OR REPLACE VIEW public.material_requirements WITH(security_invoker=true) AS
WITH physical AS(
  SELECT t.id fabric_id,COALESCE(sum(CASE WHEN lower(m.tipo)='entrada' THEN m.quantidade WHEN lower(m.tipo) IN('saída','saida') THEN -m.quantidade ELSE m.quantidade END),0) physical_quantity
  FROM public.tecidos t LEFT JOIN public.movimentacoes_estoque m ON m.tecido_id=t.id GROUP BY t.id
), reserved AS(
  SELECT fabric_id,sum(quantity) reserved_quantity FROM public.inventory_reservations WHERE status='reserved' GROUP BY fabric_id
), per_order AS(
  SELECT order_id,bom_item_id,sum(quantity) reserved_for_order FROM public.inventory_reservations WHERE status='reserved' GROUP BY order_id,bom_item_id
), purchasing AS(
  SELECT i.fabric_id,sum(i.quantity-i.received_quantity) in_purchase_quantity FROM public.purchase_order_items i JOIN public.purchase_orders p ON p.id=i.purchase_order_id WHERE p.status IN('sent','confirmed','partial') GROUP BY i.fabric_id
)
SELECT b.order_id,b.order_item_id,bi.id bom_item_id,bi.fabric_id,bi.material_type,bi.description,bi.unit,
  bi.required_quantity,COALESCE(p.physical_quantity,0) physical_quantity,COALESCE(r.reserved_quantity,0) reserved_quantity,
  COALESCE(po.reserved_for_order,0) reserved_for_order,GREATEST(COALESCE(p.physical_quantity,0)-COALESCE(r.reserved_quantity,0),0) available_quantity,
  COALESCE(pc.in_purchase_quantity,0) in_purchase_quantity,
  GREATEST(bi.required_quantity-COALESCE(po.reserved_for_order,0),0) shortage_quantity
FROM public.bill_of_materials b JOIN public.bom_items bi ON bi.bom_id=b.id
LEFT JOIN physical p ON p.fabric_id=bi.fabric_id LEFT JOIN reserved r ON r.fabric_id=bi.fabric_id LEFT JOIN per_order po ON po.order_id=b.order_id AND po.bom_item_id=bi.id LEFT JOIN purchasing pc ON pc.fabric_id=bi.fabric_id
WHERE b.status='ready';

CREATE OR REPLACE VIEW public.purchase_suggestions WITH(security_invoker=true) AS
WITH requirement_shortages AS(
  SELECT mr.fabric_id,mr.description,mr.unit,sum(mr.required_quantity) required_quantity,max(mr.reserved_quantity) reserved_quantity,max(mr.available_quantity) available_quantity,sum(mr.shortage_quantity) required_shortage,array_agg(DISTINCT mr.order_id) FILTER(WHERE mr.shortage_quantity>0) impacted_orders
  FROM public.material_requirements mr WHERE mr.fabric_id IS NOT NULL GROUP BY mr.fabric_id,mr.description,mr.unit
), stock AS(
  SELECT t.id fabric_id,t.codigo,t.descricao,t.unidade,t.estoque_minimo,t.valor_unitario,t.preferred_supplier_id,COALESCE(e.estoque_atual,0) physical_quantity
  FROM public.tecidos t LEFT JOIN public.estoque_atual e ON e.id=t.id
), buying AS(
  SELECT i.fabric_id,sum(i.quantity-i.received_quantity) in_purchase FROM public.purchase_order_items i JOIN public.purchase_orders p ON p.id=i.purchase_order_id WHERE p.status IN('sent','confirmed','partial') GROUP BY i.fabric_id
)
SELECT s.fabric_id,s.codigo,s.descricao,COALESCE(rs.unit,CASE lower(s.unidade) WHEN 'metro' THEN 'meter' WHEN 'unidade' THEN 'unit' WHEN 'folha' THEN 'sheet' WHEN 'rolo' THEN 'roll' ELSE lower(s.unidade) END) unit,
  s.preferred_supplier_id,COALESCE(rs.impacted_orders,'{}'::uuid[]) impacted_orders,s.physical_quantity,COALESCE(b.in_purchase,0) in_purchase_quantity,
  COALESCE(rs.required_quantity,0) required_quantity,COALESCE(rs.reserved_quantity,0) reserved_quantity,COALESCE(rs.available_quantity,GREATEST(s.physical_quantity-COALESCE(rs.reserved_quantity,0),0)) available_quantity,
  GREATEST(COALESCE(rs.required_shortage,0)-COALESCE(b.in_purchase,0),0) shortage_quantity,
  GREATEST(GREATEST(COALESCE(rs.required_shortage,0)-COALESCE(b.in_purchase,0),0),GREATEST(s.estoque_minimo-s.physical_quantity-COALESCE(b.in_purchase,0),0)) suggested_quantity,s.valor_unitario
FROM stock s LEFT JOIN requirement_shortages rs ON rs.fabric_id=s.fabric_id LEFT JOIN buying b ON b.fabric_id=s.fabric_id
WHERE GREATEST(COALESCE(rs.required_shortage,0)-COALESCE(b.in_purchase,0),0)>0 OR s.physical_quantity+COALESCE(b.in_purchase,0)<s.estoque_minimo;
REVOKE ALL ON public.material_requirements,public.purchase_suggestions FROM PUBLIC,anon;
GRANT SELECT ON public.material_requirements,public.purchase_suggestions TO authenticated;

CREATE OR REPLACE FUNCTION public.create_purchase_order(p_supplier_id uuid,p_expected_date date,p_notes text,p_items jsonb)
RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog,public AS $$
DECLARE po_id uuid; po_number text; item jsonb; total_value numeric:=0; line_total numeric; expected_unit text;
BEGIN
  IF auth.uid() IS NULL OR NOT public.has_permission('purchases.create') THEN RAISE EXCEPTION 'permission denied' USING errcode='42501'; END IF;
  IF NOT EXISTS(SELECT 1 FROM public.suppliers WHERE id=p_supplier_id AND active) OR jsonb_typeof(p_items)<>'array' OR jsonb_array_length(p_items)=0 THEN RAISE EXCEPTION 'invalid purchase order' USING errcode='22023'; END IF;
  po_number:='PC-'||to_char(timezone('America/Sao_Paulo',now()),'YYYY')||'-'||lpad(nextval('public.purchase_order_number_seq')::text,6,'0');
  INSERT INTO public.purchase_orders(number,supplier_id,expected_date,notes) VALUES(po_number,p_supplier_id,p_expected_date,NULLIF(trim(p_notes),'')) RETURNING id INTO po_id;
  FOR item IN SELECT * FROM jsonb_array_elements(p_items) LOOP
    IF COALESCE((item->>'quantity')::numeric,0)<=0 OR COALESCE((item->>'unit_cost')::numeric,0)<0 OR item->>'unit' NOT IN('kg','meter','unit','sheet','roll','other') THEN RAISE EXCEPTION 'invalid purchase item' USING errcode='22023'; END IF;
    SELECT CASE lower(unidade) WHEN 'metro' THEN 'meter' WHEN 'unidade' THEN 'unit' WHEN 'folha' THEN 'sheet' WHEN 'rolo' THEN 'roll' ELSE lower(unidade) END INTO expected_unit FROM public.tecidos WHERE id=(item->>'fabric_id')::uuid;
    IF NOT FOUND OR expected_unit<>item->>'unit' THEN RAISE EXCEPTION 'material unit mismatch' USING errcode='23514'; END IF;
    line_total:=round((item->>'quantity')::numeric*(item->>'unit_cost')::numeric,2);total_value:=total_value+line_total;
    INSERT INTO public.purchase_order_items(purchase_order_id,fabric_id,description,quantity,unit,unit_cost,total,required_for_order_id,position)
    VALUES(po_id,(item->>'fabric_id')::uuid,COALESCE(NULLIF(trim(item->>'description'),''),(SELECT descricao FROM public.tecidos WHERE id=(item->>'fabric_id')::uuid)),(item->>'quantity')::numeric,item->>'unit',(item->>'unit_cost')::numeric,line_total,NULLIF(item->>'required_for_order_id','')::uuid,COALESCE((item->>'position')::integer,0));
  END LOOP;
  UPDATE public.purchase_orders SET total=total_value WHERE id=po_id;
  PERFORM public.write_audit_log(auth.uid(),'purchase_order.created','purchase_orders'::name,po_id::text,NULL,NULL,jsonb_build_object('number',po_number,'total',total_value));
  RETURN po_id;
END $$;

CREATE OR REPLACE FUNCTION public.set_purchase_order_status(p_purchase_order_id uuid,p_status text)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog,public AS $$
DECLARE old_order public.purchase_orders%ROWTYPE;
BEGIN
  IF auth.uid() IS NULL OR NOT public.has_permission('purchases.update') OR p_status NOT IN('sent','confirmed','cancelled') THEN RAISE EXCEPTION 'permission denied or invalid status' USING errcode='42501'; END IF;
  SELECT * INTO old_order FROM public.purchase_orders WHERE id=p_purchase_order_id FOR UPDATE; IF NOT FOUND OR old_order.status IN('received','cancelled') THEN RAISE EXCEPTION 'purchase order unavailable' USING errcode='55000'; END IF;
  UPDATE public.purchase_orders SET status=p_status,sent_at=CASE WHEN p_status='sent' THEN COALESCE(sent_at,now()) ELSE sent_at END,cancelled_at=CASE WHEN p_status='cancelled' THEN now() ELSE NULL END,updated_at=now() WHERE id=p_purchase_order_id;
  PERFORM public.write_audit_log(auth.uid(),CASE p_status WHEN 'sent' THEN 'purchase_order.sent' WHEN 'cancelled' THEN 'purchase_order.cancelled' ELSE 'purchase_order.confirmed' END,'purchase_orders'::name,p_purchase_order_id::text,to_jsonb(old_order),NULL,'{}');
END $$;

CREATE OR REPLACE FUNCTION public.receive_purchase_order(p_purchase_order_id uuid,p_operation_id uuid,p_invoice_number text,p_notes text,p_items jsonb)
RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog,public AS $$
DECLARE receipt_id uuid; po public.purchase_orders%ROWTYPE; item jsonb; purchase_item public.purchase_order_items%ROWTYPE; quantity_received numeric; all_received boolean;
BEGIN
  IF auth.uid() IS NULL OR NOT public.has_permission('purchases.update') OR NOT public.has_permission('inventory.adjust') THEN RAISE EXCEPTION 'permission denied' USING errcode='42501'; END IF;
  SELECT id INTO receipt_id FROM public.purchase_receipts WHERE operation_id=p_operation_id; IF receipt_id IS NOT NULL THEN RETURN receipt_id; END IF;
  SELECT * INTO po FROM public.purchase_orders WHERE id=p_purchase_order_id FOR UPDATE; IF NOT FOUND OR po.status NOT IN('sent','confirmed','partial') THEN RAISE EXCEPTION 'purchase order unavailable' USING errcode='55000'; END IF;
  IF jsonb_typeof(p_items)<>'array' OR jsonb_array_length(p_items)=0 THEN RAISE EXCEPTION 'receipt items required' USING errcode='22023'; END IF;
  INSERT INTO public.purchase_receipts(purchase_order_id,operation_id,invoice_number,notes,payload) VALUES(po.id,p_operation_id,NULLIF(trim(p_invoice_number),''),NULLIF(trim(p_notes),''),p_items) RETURNING id INTO receipt_id;
  FOR item IN SELECT * FROM jsonb_array_elements(p_items) LOOP
    SELECT * INTO purchase_item FROM public.purchase_order_items WHERE id=(item->>'item_id')::uuid AND purchase_order_id=po.id FOR UPDATE;
    quantity_received:=COALESCE((item->>'quantity')::numeric,0);
    IF NOT FOUND OR quantity_received<=0 OR purchase_item.received_quantity+quantity_received>purchase_item.quantity THEN RAISE EXCEPTION 'invalid receipt quantity' USING errcode='23514'; END IF;
    PERFORM public.record_inventory_movement(purchase_item.fabric_id,(timezone('America/Sao_Paulo',now()))::date,'Entrada',quantity_received,(SELECT name FROM public.suppliers WHERE id=po.supplier_id),p_invoice_number,purchase_item.unit_cost,'Recebimento '||po.number,'purchase_receipt',receipt_id);
    UPDATE public.purchase_order_items SET received_quantity=received_quantity+quantity_received WHERE id=purchase_item.id;
  END LOOP;
  SELECT bool_and(received_quantity=quantity) INTO all_received FROM public.purchase_order_items WHERE purchase_order_id=po.id;
  UPDATE public.purchase_orders SET status=CASE WHEN all_received THEN 'received' ELSE 'partial' END,received_at=CASE WHEN all_received THEN now() ELSE NULL END,updated_at=now() WHERE id=po.id;
  INSERT INTO public.notifications(user_id,type,title,body,entity_type,entity_id,idempotency_key)
  SELECT DISTINCT r.created_by,'material_received','Material recebido',po.number,'purchase_order',po.id,'purchase-receipt-'||receipt_id||'-'||r.created_by FROM public.inventory_reservations r JOIN public.purchase_order_items pi ON pi.fabric_id=r.fabric_id AND pi.purchase_order_id=po.id WHERE r.status='reserved' ON CONFLICT(idempotency_key) DO NOTHING;
  PERFORM public.write_audit_log(auth.uid(),'purchase_order.received','purchase_receipts'::name,receipt_id::text,NULL,NULL,jsonb_build_object('purchase_order_id',po.id,'partial',NOT all_received));
  RETURN receipt_id;
END $$;

REVOKE ALL ON FUNCTION public.create_purchase_order(uuid,date,text,jsonb),public.set_purchase_order_status(uuid,text),public.receive_purchase_order(uuid,uuid,text,text,jsonb) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.create_purchase_order(uuid,date,text,jsonb),public.set_purchase_order_status(uuid,text),public.receive_purchase_order(uuid,uuid,text,text,jsonb) TO authenticated;

COMMIT;
