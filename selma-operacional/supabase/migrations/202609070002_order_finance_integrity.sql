-- Lote 4: integridade transacional do núcleo operacional.
-- Esta migration é reproduzível e deve ser aplicada primeiro em staging.

CREATE SEQUENCE IF NOT EXISTS public.pedido_number_seq;

DO $$
DECLARE v_max bigint;
BEGIN
  SELECT COALESCE(MAX(NULLIF(regexp_replace(split_part(numero, '-', 1), '[^0-9]', '', 'g'), '')::bigint), 0)
    INTO v_max FROM public.pedidos;
  IF v_max > 0 THEN
    PERFORM setval('public.pedido_number_seq', v_max, true);
  END IF;
EXCEPTION WHEN undefined_table THEN NULL;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM public.pedidos GROUP BY numero HAVING count(*) > 1) THEN
    EXECUTE 'CREATE UNIQUE INDEX IF NOT EXISTS pedidos_numero_unique_idx ON public.pedidos(numero)';
  ELSE
    RAISE WARNING 'pedidos.numero possui duplicidades; índice único aguardando relatório de exceções';
    EXECUTE 'CREATE INDEX IF NOT EXISTS pedidos_numero_idx ON public.pedidos(numero)';
  END IF;
END $$;
CREATE INDEX IF NOT EXISTS pedidos_cliente_id_idx ON public.pedidos(cliente_id);
CREATE INDEX IF NOT EXISTS pedidos_status_idx ON public.pedidos(status);
CREATE INDEX IF NOT EXISTS pedidos_entrega_programado_idx ON public.pedidos(entrega_programado);
CREATE INDEX IF NOT EXISTS itens_pedido_pedido_id_idx ON public.itens_pedido(pedido_id);

ALTER TABLE public.movimentacoes_estoque
  ADD COLUMN IF NOT EXISTS reference_type text,
  ADD COLUMN IF NOT EXISTS reference_id uuid;
CREATE INDEX IF NOT EXISTS movimentacoes_estoque_tecido_id_idx ON public.movimentacoes_estoque(tecido_id);
CREATE INDEX IF NOT EXISTS movimentacoes_estoque_created_at_idx ON public.movimentacoes_estoque(created_at);
ALTER TABLE public.pedidos ADD COLUMN IF NOT EXISTS client_operation_id uuid;
CREATE UNIQUE INDEX IF NOT EXISTS pedidos_client_operation_id_idx ON public.pedidos(client_operation_id) WHERE client_operation_id IS NOT NULL;

ALTER TABLE public.itens_pedido
  DROP CONSTRAINT IF EXISTS itens_pedido_qtde_nonnegative,
  DROP CONSTRAINT IF EXISTS itens_pedido_valor_unitario_nonnegative;
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM public.itens_pedido WHERE qtde < 0 OR valor_unitario < 0) THEN
    ALTER TABLE public.itens_pedido
      ADD CONSTRAINT itens_pedido_qtde_nonnegative CHECK (qtde >= 0),
      ADD CONSTRAINT itens_pedido_valor_unitario_nonnegative CHECK (valor_unitario >= 0);
  ELSE
    RAISE WARNING 'itens_pedido possui valores negativos; constraints aguardando saneamento manual';
  END IF;
END $$;

CREATE TABLE IF NOT EXISTS public.payments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  order_id uuid NOT NULL REFERENCES public.pedidos(id) ON DELETE RESTRICT,
  amount numeric(14,2) NOT NULL CHECK (amount > 0),
  payment_method text NOT NULL DEFAULT 'other',
  payment_date date NOT NULL DEFAULT (timezone('America/Sao_Paulo', now()))::date,
  reference text,
  notes text,
  status text NOT NULL DEFAULT 'confirmed' CHECK (status IN ('confirmed','reversed')),
  created_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  reversed_at timestamptz,
  reversed_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  reversal_reason text,
  client_operation_id uuid,
  CONSTRAINT payments_method_check CHECK (payment_method IN ('pix','cash','credit_card','debit_card','bank_transfer','boleto','check','legacy','other')),
  CONSTRAINT payments_reversal_fields_check CHECK ((status = 'confirmed' AND reversed_at IS NULL) OR (status = 'reversed' AND reversed_at IS NOT NULL))
);
CREATE UNIQUE INDEX IF NOT EXISTS payments_idempotency_idx ON public.payments(created_by, client_operation_id) WHERE client_operation_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS payments_order_id_idx ON public.payments(order_id);
CREATE INDEX IF NOT EXISTS payments_payment_date_idx ON public.payments(payment_date);

CREATE TABLE IF NOT EXISTS public.accounts_receivable (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  order_id uuid NOT NULL REFERENCES public.pedidos(id) ON DELETE RESTRICT,
  customer_id uuid REFERENCES public.clientes(id) ON DELETE SET NULL,
  description text NOT NULL DEFAULT 'Saldo do pedido',
  amount numeric(14,2) NOT NULL CHECK (amount > 0),
  due_date date NOT NULL,
  status text NOT NULL DEFAULT 'open' CHECK (status IN ('open','partial','paid','overdue','cancelled')),
  installment_number integer NOT NULL DEFAULT 1 CHECK (installment_number > 0),
  created_at timestamptz NOT NULL DEFAULT now(),
  created_by uuid REFERENCES auth.users(id) ON DELETE SET NULL
);
CREATE INDEX IF NOT EXISTS accounts_receivable_order_id_idx ON public.accounts_receivable(order_id);
CREATE INDEX IF NOT EXISTS accounts_receivable_due_date_idx ON public.accounts_receivable(due_date);
CREATE INDEX IF NOT EXISTS accounts_receivable_status_idx ON public.accounts_receivable(status);

CREATE TABLE IF NOT EXISTS public.payment_allocations (
  payment_id uuid NOT NULL REFERENCES public.payments(id) ON DELETE RESTRICT,
  receivable_id uuid NOT NULL REFERENCES public.accounts_receivable(id) ON DELETE RESTRICT,
  amount numeric(14,2) NOT NULL CHECK (amount > 0),
  PRIMARY KEY (payment_id, receivable_id)
);

CREATE OR REPLACE FUNCTION public.audit_finance_ledger_change()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = pg_catalog, public
AS $$
BEGIN
  PERFORM public.write_audit_log((SELECT auth.uid()),
    CASE WHEN TG_TABLE_NAME = 'payments' AND TG_OP = 'INSERT' THEN 'payment.created'
         WHEN TG_TABLE_NAME = 'payments' AND TG_OP = 'UPDATE' AND NEW.status = 'reversed' THEN 'payment.reversed'
         ELSE 'receivable.' || lower(TG_OP) END,
    TG_TABLE_NAME, COALESCE((to_jsonb(NEW)->>'id'), (to_jsonb(OLD)->>'id')),
    CASE WHEN TG_OP IN ('UPDATE','DELETE') THEN to_jsonb(OLD) END,
    CASE WHEN TG_OP IN ('INSERT','UPDATE') THEN to_jsonb(NEW) END,
    jsonb_build_object('source','database_trigger'));
  RETURN COALESCE(NEW, OLD);
END; $$;
REVOKE ALL ON FUNCTION public.audit_finance_ledger_change() FROM PUBLIC, anon, authenticated;
DO $$
BEGIN
  IF to_regclass('public.payments') IS NOT NULL THEN
    DROP TRIGGER IF EXISTS audit_payments_changes ON public.payments;
    CREATE TRIGGER audit_payments_changes AFTER INSERT OR UPDATE ON public.payments FOR EACH ROW EXECUTE FUNCTION public.audit_finance_ledger_change();
  END IF;
  IF to_regclass('public.accounts_receivable') IS NOT NULL THEN
    DROP TRIGGER IF EXISTS audit_receivables_changes ON public.accounts_receivable;
    CREATE TRIGGER audit_receivables_changes AFTER INSERT OR UPDATE ON public.accounts_receivable FOR EACH ROW EXECUTE FUNCTION public.audit_finance_ledger_change();
  END IF;
END $$;

-- Migração conservadora dos valores históricos: somente cria um lançamento
-- claramente marcado quando o valor é positivo e ainda não há payment legado.
INSERT INTO public.payments (order_id, amount, payment_method, payment_date, reference, notes, status)
SELECT p.id, x.amount, 'legacy', COALESCE(p.data_pedido, current_date), 'migrated_balance',
       'Migração Lote 4; origem: campos legados do pedido', 'confirmed'
FROM public.pedidos p
CROSS JOIN LATERAL (VALUES (COALESCE(p.valor_entrada, 0) + COALESCE(p.valor_pago_adicional, 0))) x(amount)
WHERE x.amount > 0
  AND NOT EXISTS (SELECT 1 FROM public.payments py WHERE py.order_id = p.id AND py.payment_method = 'legacy');

ALTER TABLE public.payments ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.accounts_receivable ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.payment_allocations ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.payments, public.accounts_receivable, public.payment_allocations FROM PUBLIC, anon;
GRANT SELECT ON public.payments, public.accounts_receivable, public.payment_allocations TO authenticated;
DROP POLICY IF EXISTS payments_select_authorized ON public.payments;
CREATE POLICY payments_select_authorized ON public.payments FOR SELECT TO authenticated USING (public.has_permission('finance.view'));
DROP POLICY IF EXISTS receivables_select_authorized ON public.accounts_receivable;
CREATE POLICY receivables_select_authorized ON public.accounts_receivable FOR SELECT TO authenticated USING (public.has_permission('finance.view'));
DROP POLICY IF EXISTS allocations_select_authorized ON public.payment_allocations;
CREATE POLICY allocations_select_authorized ON public.payment_allocations FOR SELECT TO authenticated USING (public.has_permission('finance.view'));

CREATE OR REPLACE FUNCTION public.create_order_with_items(
  p_order jsonb, p_items jsonb, p_client_operation_id uuid DEFAULT NULL
) RETURNS uuid
LANGUAGE plpgsql SECURITY DEFINER SET search_path = pg_catalog, public
AS $$
DECLARE v_id uuid; v_number text; v_year text := to_char(timezone('America/Sao_Paulo', now()), 'YY'); v_item jsonb; v_status text := COALESCE(p_order->>'status','aguardando_corte');
BEGIN
  IF NOT public.has_permission('orders.create') THEN RAISE EXCEPTION 'permission denied' USING errcode = '42501'; END IF;
  IF COALESCE((p_order->>'valor_entrada')::numeric, 0) > 0 AND NOT (public.has_permission('finance.create') OR public.has_permission('finance.update')) THEN RAISE EXCEPTION 'finance permission required' USING errcode = '42501'; END IF;
  IF p_client_operation_id IS NOT NULL THEN SELECT id INTO v_id FROM public.pedidos WHERE client_operation_id = p_client_operation_id; IF v_id IS NOT NULL THEN RETURN v_id; END IF; END IF;
  IF jsonb_array_length(COALESCE(p_items, '[]'::jsonb)) = 0 AND v_status <> 'rascunho' THEN RAISE EXCEPTION 'order must contain at least one item' USING errcode = '22023'; END IF;
  v_number := lpad(nextval('public.pedido_number_seq')::text, 4, '0') || '-' || v_year;
  INSERT INTO public.pedidos (numero, cliente, cliente_id, vendedor_id, data_pedido, tipo_estampa, costureira_id, estampa_oficina_id, forma_pagamento, fornecedor_tecido, valor_entrada, corte_programado, corte_retorno, estamparia_programado, estamparia_retorno, sublimacao_programado, sublimacao_retorno, costura_programado, costura_retorno, entrega_programado, etapas_ativas, observacoes, status, client_operation_id)
  SELECT v_number, COALESCE(p_order->>'cliente',''), NULLIF(p_order->>'cliente_id','')::uuid, NULLIF(p_order->>'vendedor_id','')::uuid, COALESCE(NULLIF(p_order->>'data_pedido','')::date, (timezone('America/Sao_Paulo', now()))::date), NULLIF(p_order->>'tipo_estampa',''), NULLIF(p_order->>'costureira_id','')::uuid, NULLIF(p_order->>'estampa_oficina_id','')::uuid, NULLIF(p_order->>'forma_pagamento',''), NULLIF(p_order->>'fornecedor_tecido',''), COALESCE((p_order->>'valor_entrada')::numeric,0), NULLIF(p_order->>'corte_programado','')::date, NULLIF(p_order->>'corte_retorno','')::date, NULLIF(p_order->>'estamparia_programado','')::date, NULLIF(p_order->>'estamparia_retorno','')::date, NULLIF(p_order->>'sublimacao_programado','')::date, NULLIF(p_order->>'sublimacao_retorno','')::date, NULLIF(p_order->>'costura_programado','')::date, NULLIF(p_order->>'costura_retorno','')::date, (p_order->>'entrega_programado')::date, COALESCE(ARRAY(SELECT jsonb_array_elements_text(p_order->'etapas_ativas')),'{corte,costura}'), NULLIF(p_order->>'observacoes',''), v_status, p_client_operation_id
  RETURNING id INTO v_id;
  FOR v_item IN SELECT * FROM jsonb_array_elements(p_items) LOOP
    INSERT INTO public.itens_pedido (pedido_id, qtde, tamanho, modelo, tecido_cor, manga, gola, acabamento, observacao, valor_unitario)
    VALUES (v_id, (v_item->>'qtde')::numeric, COALESCE(v_item->>'tamanho',''), COALESCE(v_item->>'modelo',''), NULLIF(v_item->>'tecido_cor',''), NULLIF(v_item->>'manga',''), NULLIF(v_item->>'gola',''), NULLIF(v_item->>'acabamento',''), NULLIF(v_item->>'observacao',''), (v_item->>'valor_unitario')::numeric);
  END LOOP;
  IF COALESCE((p_order->>'valor_entrada')::numeric, 0) > 0 THEN
    INSERT INTO public.payments(order_id, amount, payment_method, payment_date, reference, created_by)
    VALUES (v_id, (p_order->>'valor_entrada')::numeric,
      CASE lower(COALESCE(p_order->>'forma_pagamento','other'))
        WHEN 'pix' THEN 'pix' WHEN 'dinheiro' THEN 'cash' WHEN 'cash' THEN 'cash'
        WHEN 'cartão' THEN 'credit_card' WHEN 'cartao' THEN 'credit_card'
        WHEN 'credit_card' THEN 'credit_card' WHEN 'debit_card' THEN 'debit_card'
        WHEN 'transferência' THEN 'bank_transfer' WHEN 'transferencia' THEN 'bank_transfer'
        WHEN 'bank_transfer' THEN 'bank_transfer' ELSE 'other' END,
      COALESCE(NULLIF(p_order->>'data_pedido','')::date, (timezone('America/Sao_Paulo', now()))::date),
      'order_initial_payment', auth.uid());
  END IF;
  RETURN v_id;
END; $$;

CREATE OR REPLACE FUNCTION public.update_order_with_items(
  p_order_id uuid, p_order jsonb, p_items jsonb
) RETURNS uuid
LANGUAGE plpgsql SECURITY DEFINER SET search_path = pg_catalog, public
AS $$
DECLARE v_item jsonb; v_old_entry numeric;
BEGIN
  IF NOT public.has_permission('orders.update') THEN RAISE EXCEPTION 'permission denied' USING errcode = '42501'; END IF;
  SELECT valor_entrada INTO v_old_entry FROM public.pedidos WHERE id = p_order_id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'order not found' USING errcode = 'P0002'; END IF;
  IF p_order ? 'valor_entrada' AND COALESCE((p_order->>'valor_entrada')::numeric, v_old_entry) IS DISTINCT FROM v_old_entry AND NOT (public.has_permission('finance.create') OR public.has_permission('finance.update')) THEN RAISE EXCEPTION 'finance permission required' USING errcode = '42501'; END IF;
  IF jsonb_array_length(COALESCE(p_items, '[]'::jsonb)) = 0 AND COALESCE(p_order->>'status','') <> 'rascunho' THEN RAISE EXCEPTION 'order must contain at least one item' USING errcode = '22023'; END IF;
  UPDATE public.pedidos SET cliente=COALESCE(p_order->>'cliente',cliente), cliente_id=CASE WHEN p_order ? 'cliente_id' THEN NULLIF(p_order->>'cliente_id','')::uuid ELSE cliente_id END, vendedor_id=CASE WHEN p_order ? 'vendedor_id' THEN NULLIF(p_order->>'vendedor_id','')::uuid ELSE vendedor_id END, data_pedido=COALESCE(NULLIF(p_order->>'data_pedido','')::date,data_pedido), tipo_estampa=CASE WHEN p_order ? 'tipo_estampa' THEN NULLIF(p_order->>'tipo_estampa','') ELSE tipo_estampa END, forma_pagamento=CASE WHEN p_order ? 'forma_pagamento' THEN NULLIF(p_order->>'forma_pagamento','') ELSE forma_pagamento END, valor_entrada=COALESCE((p_order->>'valor_entrada')::numeric,valor_entrada), entrega_programado=COALESCE(NULLIF(p_order->>'entrega_programado','')::date,entrega_programado), etapas_ativas=COALESCE(ARRAY(SELECT jsonb_array_elements_text(p_order->'etapas_ativas')),etapas_ativas), observacoes=CASE WHEN p_order ? 'observacoes' THEN NULLIF(p_order->>'observacoes','') ELSE observacoes END, status=CASE WHEN p_order ? 'status' AND p_order->>'status' = 'rascunho' THEN 'rascunho' ELSE status END, updated_at=now() WHERE id=p_order_id;
  DELETE FROM public.itens_pedido WHERE pedido_id = p_order_id;
  FOR v_item IN SELECT * FROM jsonb_array_elements(p_items) LOOP
    INSERT INTO public.itens_pedido (pedido_id, qtde, tamanho, modelo, tecido_cor, manga, gola, acabamento, observacao, valor_unitario)
    VALUES (p_order_id, (v_item->>'qtde')::numeric, COALESCE(v_item->>'tamanho',''), COALESCE(v_item->>'modelo',''), NULLIF(v_item->>'tecido_cor',''), NULLIF(v_item->>'manga',''), NULLIF(v_item->>'gola',''), NULLIF(v_item->>'acabamento',''), NULLIF(v_item->>'observacao',''), (v_item->>'valor_unitario')::numeric);
  END LOOP;
  RETURN p_order_id;
END; $$;

CREATE OR REPLACE FUNCTION public.record_payment(
  p_order_id uuid, p_amount numeric, p_payment_method text DEFAULT 'other', p_payment_date date DEFAULT NULL,
  p_reference text DEFAULT NULL, p_notes text DEFAULT NULL, p_client_operation_id uuid DEFAULT NULL
) RETURNS uuid
LANGUAGE plpgsql SECURITY DEFINER SET search_path = pg_catalog, public
AS $$
DECLARE v_id uuid; v_total numeric; v_received numeric;
BEGIN
  IF NOT public.has_permission('finance.update') THEN RAISE EXCEPTION 'permission denied' USING errcode = '42501'; END IF;
  IF p_amount IS NULL OR p_amount <= 0 THEN RAISE EXCEPTION 'payment amount must be positive' USING errcode = '22023'; END IF;
  SELECT id INTO v_id FROM public.payments WHERE created_by = auth.uid() AND client_operation_id = p_client_operation_id;
  IF v_id IS NOT NULL THEN RETURN v_id; END IF;
  PERFORM 1 FROM public.pedidos WHERE id = p_order_id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'order not found' USING errcode = 'P0002'; END IF;
  INSERT INTO public.payments(order_id,amount,payment_method,payment_date,reference,notes,created_by,client_operation_id)
  VALUES(p_order_id,p_amount,COALESCE(p_payment_method,'other'),COALESCE(p_payment_date,(timezone('America/Sao_Paulo',now()))::date),p_reference,p_notes,auth.uid(),p_client_operation_id)
  RETURNING id INTO v_id;
  SELECT COALESCE(sum(i.qtde*i.valor_unitario),0), COALESCE((SELECT sum(amount) FROM public.payments WHERE order_id=p_order_id AND status='confirmed'),0) INTO v_total,v_received FROM public.itens_pedido i WHERE i.pedido_id=p_order_id;
  UPDATE public.pedidos SET status_pagamento=CASE WHEN v_received >= v_total AND v_total > 0 THEN 'pago' WHEN v_received > 0 THEN 'parcial' ELSE 'pendente' END, valor_pago_adicional=GREATEST(0,v_received-COALESCE(valor_entrada,0)) WHERE id=p_order_id;
  RETURN v_id;
END; $$;

CREATE OR REPLACE FUNCTION public.next_order_number()
RETURNS text LANGUAGE plpgsql SECURITY DEFINER SET search_path = pg_catalog, public
AS $$
BEGIN
  IF NOT public.has_permission('orders.create') THEN RAISE EXCEPTION 'permission denied' USING errcode = '42501'; END IF;
  RETURN lpad(nextval('public.pedido_number_seq')::text, 4, '0') || '-' || to_char(timezone('America/Sao_Paulo', now()), 'YY');
END; $$;

CREATE OR REPLACE FUNCTION public.record_inventory_movement(
  p_tecido_id uuid, p_data date, p_tipo text, p_quantidade numeric,
  p_fornecedor text DEFAULT NULL, p_numero_nf text DEFAULT NULL,
  p_valor_unitario numeric DEFAULT NULL, p_observacao text DEFAULT NULL,
  p_reference_type text DEFAULT NULL, p_reference_id uuid DEFAULT NULL
) RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path = pg_catalog, public
AS $$
DECLARE v_id uuid; v_balance numeric;
BEGIN
  IF NOT public.has_permission('inventory.adjust') THEN RAISE EXCEPTION 'permission denied' USING errcode = '42501'; END IF;
  IF p_quantidade IS NULL OR p_quantidade <= 0 THEN RAISE EXCEPTION 'quantity must be positive' USING errcode = '22023'; END IF;
  IF p_tipo NOT IN ('Entrada','Saída','ajuste') THEN RAISE EXCEPTION 'invalid movement type' USING errcode = '22023'; END IF;
  PERFORM 1 FROM public.tecidos WHERE id=p_tecido_id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'material not found' USING errcode = 'P0002'; END IF;
  IF p_tipo = 'Saída' THEN
    SELECT COALESCE(sum(CASE WHEN tipo='Entrada' THEN quantidade WHEN tipo='Saída' THEN -quantidade ELSE quantidade END),0) INTO v_balance FROM public.movimentacoes_estoque WHERE tecido_id=p_tecido_id;
    IF v_balance < p_quantidade THEN RAISE EXCEPTION 'insufficient stock' USING errcode = '23514'; END IF;
  END IF;
  INSERT INTO public.movimentacoes_estoque(tecido_id,data_movimentacao,tipo,quantidade,fornecedor,numero_nf,valor_unitario,valor_total_nf,observacao,reference_type,reference_id)
  VALUES(p_tecido_id,COALESCE(p_data,(timezone('America/Sao_Paulo',now()))::date),p_tipo,p_quantidade,p_fornecedor,p_numero_nf,p_valor_unitario,p_quantidade*COALESCE(p_valor_unitario,0),p_observacao,p_reference_type,p_reference_id)
  RETURNING id INTO v_id;
  RETURN v_id;
END; $$;

CREATE OR REPLACE FUNCTION public.reverse_payment(p_payment_id uuid, p_reason text)
RETURNS boolean LANGUAGE plpgsql SECURITY DEFINER SET search_path = pg_catalog, public
AS $$
BEGIN
  IF NOT public.has_permission('finance.update') THEN RAISE EXCEPTION 'permission denied' USING errcode = '42501'; END IF;
  IF p_reason IS NULL OR length(trim(p_reason)) = 0 THEN RAISE EXCEPTION 'reversal reason is required' USING errcode = '22023'; END IF;
  UPDATE public.payments SET status='reversed', reversed_at=now(), reversed_by=auth.uid(), reversal_reason=left(p_reason,500) WHERE id=p_payment_id AND status='confirmed';
  IF NOT FOUND THEN RETURN false; END IF;
  RETURN true;
END; $$;

REVOKE ALL ON FUNCTION public.create_order_with_items(jsonb,jsonb,uuid), public.update_order_with_items(uuid,jsonb,jsonb), public.record_payment(uuid,numeric,text,date,text,text,uuid), public.reverse_payment(uuid,text), public.next_order_number(), public.record_inventory_movement(uuid,date,text,numeric,text,text,numeric,text,text,uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.create_order_with_items(jsonb,jsonb,uuid), public.update_order_with_items(uuid,jsonb,jsonb), public.record_payment(uuid,numeric,text,date,text,text,uuid), public.reverse_payment(uuid,text), public.next_order_number(), public.record_inventory_movement(uuid,date,text,numeric,text,text,numeric,text,text,uuid) TO authenticated;

COMMENT ON TABLE public.payments IS 'Ledger append-only de pagamentos; estorno altera status e preserva o registro.';
COMMENT ON TABLE public.accounts_receivable IS 'Parcelas e saldos derivados; não substitui o ledger de pagamentos.';
