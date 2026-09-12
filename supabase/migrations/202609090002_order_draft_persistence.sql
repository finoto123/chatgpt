-- Corrige a persistência de rascunhos de pedidos.
-- A função é independente do lançamento financeiro e mantém os IDs dos itens
-- existentes, evitando apagar todos os itens antes de recriá-los.

CREATE SEQUENCE IF NOT EXISTS public.pedido_number_seq;

CREATE OR REPLACE FUNCTION public.save_order_draft(
  p_order_id uuid,
  p_order jsonb,
  p_items jsonb
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog, public
AS $$
DECLARE
  v_order_id uuid := p_order_id;
  v_item jsonb;
  v_item_id uuid;
  v_kept_item_ids uuid[] := ARRAY[]::uuid[];
  v_number text;
BEGIN
  IF p_order IS NULL OR jsonb_typeof(p_order) <> 'object' THEN
    RAISE EXCEPTION 'invalid order payload' USING ERRCODE = '22023';
  END IF;
  IF p_items IS NULL OR jsonb_typeof(p_items) <> 'array'
     OR jsonb_array_length(p_items) > 500 THEN
    RAISE EXCEPTION 'invalid order items payload' USING ERRCODE = '22023';
  END IF;

  IF v_order_id IS NULL THEN
    IF NOT public.has_permission('orders.create') THEN
      RAISE EXCEPTION 'permission denied' USING ERRCODE = '42501';
    END IF;

    v_number := NULLIF(trim(p_order->>'numero'), '');
    IF v_number IS NULL THEN
      v_number := lpad(nextval('public.pedido_number_seq')::text, 4, '0')
        || '-' || to_char(timezone('America/Sao_Paulo', now()), 'YY');
    END IF;

    INSERT INTO public.pedidos (
      numero, cliente, cliente_id, vendedor_id, data_pedido, tipo_estampa,
      costureira_id, estampa_oficina_id, forma_pagamento, fornecedor_tecido,
      valor_entrada, corte_programado, corte_retorno,
      estamparia_programado, estamparia_retorno,
      sublimacao_programado, sublimacao_retorno,
      costura_programado, costura_retorno, entrega_programado,
      etapas_ativas, observacoes, status
    ) VALUES (
      v_number,
      COALESCE(p_order->>'cliente', ''),
      NULLIF(p_order->>'cliente_id', '')::uuid,
      NULLIF(p_order->>'vendedor_id', '')::uuid,
      COALESCE(NULLIF(p_order->>'data_pedido', '')::date,
        (timezone('America/Sao_Paulo', now()))::date),
      NULLIF(p_order->>'tipo_estampa', ''),
      NULLIF(p_order->>'costureira_id', '')::uuid,
      NULLIF(p_order->>'estampa_oficina_id', '')::uuid,
      NULLIF(p_order->>'forma_pagamento', ''),
      NULLIF(p_order->>'fornecedor_tecido', ''),
      COALESCE((p_order->>'valor_entrada')::numeric, 0),
      NULLIF(p_order->>'corte_programado', '')::date,
      NULLIF(p_order->>'corte_retorno', '')::date,
      NULLIF(p_order->>'estamparia_programado', '')::date,
      NULLIF(p_order->>'estamparia_retorno', '')::date,
      NULLIF(p_order->>'sublimacao_programado', '')::date,
      NULLIF(p_order->>'sublimacao_retorno', '')::date,
      NULLIF(p_order->>'costura_programado', '')::date,
      NULLIF(p_order->>'costura_retorno', '')::date,
      COALESCE(NULLIF(p_order->>'entrega_programado', '')::date, DATE '2099-12-31'),
      COALESCE(ARRAY(SELECT jsonb_array_elements_text(p_order->'etapas_ativas')),
        ARRAY['corte', 'costura']::text[]),
      NULLIF(p_order->>'observacoes', ''),
      'rascunho'
    )
    RETURNING id INTO v_order_id;
  ELSE
    IF NOT public.has_permission('orders.update') THEN
      RAISE EXCEPTION 'permission denied' USING ERRCODE = '42501';
    END IF;

    PERFORM 1
    FROM public.pedidos
    WHERE id = v_order_id AND status = 'rascunho'
    FOR UPDATE;
    IF NOT FOUND THEN
      RAISE EXCEPTION 'draft not found' USING ERRCODE = 'P0002';
    END IF;

    UPDATE public.pedidos
    SET cliente = COALESCE(p_order->>'cliente', cliente),
        cliente_id = NULLIF(p_order->>'cliente_id', '')::uuid,
        vendedor_id = NULLIF(p_order->>'vendedor_id', '')::uuid,
        data_pedido = COALESCE(NULLIF(p_order->>'data_pedido', '')::date, data_pedido),
        tipo_estampa = NULLIF(p_order->>'tipo_estampa', ''),
        costureira_id = NULLIF(p_order->>'costureira_id', '')::uuid,
        estampa_oficina_id = NULLIF(p_order->>'estampa_oficina_id', '')::uuid,
        forma_pagamento = NULLIF(p_order->>'forma_pagamento', ''),
        fornecedor_tecido = NULLIF(p_order->>'fornecedor_tecido', ''),
        valor_entrada = COALESCE((p_order->>'valor_entrada')::numeric, valor_entrada),
        corte_programado = NULLIF(p_order->>'corte_programado', '')::date,
        corte_retorno = NULLIF(p_order->>'corte_retorno', '')::date,
        estamparia_programado = NULLIF(p_order->>'estamparia_programado', '')::date,
        estamparia_retorno = NULLIF(p_order->>'estamparia_retorno', '')::date,
        sublimacao_programado = NULLIF(p_order->>'sublimacao_programado', '')::date,
        sublimacao_retorno = NULLIF(p_order->>'sublimacao_retorno', '')::date,
        costura_programado = NULLIF(p_order->>'costura_programado', '')::date,
        costura_retorno = NULLIF(p_order->>'costura_retorno', '')::date,
        entrega_programado = COALESCE(
          NULLIF(p_order->>'entrega_programado', '')::date,
          DATE '2099-12-31'
        ),
        etapas_ativas = COALESCE(
          ARRAY(SELECT jsonb_array_elements_text(p_order->'etapas_ativas')),
          etapas_ativas
        ),
        observacoes = NULLIF(p_order->>'observacoes', ''),
        updated_at = now()
    WHERE id = v_order_id;
  END IF;

  FOR v_item IN SELECT value FROM jsonb_array_elements(p_items)
  LOOP
    v_item_id := NULLIF(v_item->>'id', '')::uuid;

    IF p_order_id IS NOT NULL AND v_item_id IS NOT NULL THEN
      UPDATE public.itens_pedido
      SET qtde = COALESCE((v_item->>'qtde')::numeric, 0),
          tamanho = COALESCE(v_item->>'tamanho', ''),
          modelo = COALESCE(v_item->>'modelo', ''),
          tecido_cor = NULLIF(v_item->>'tecido_cor', ''),
          manga = NULLIF(v_item->>'manga', ''),
          gola = NULLIF(v_item->>'gola', ''),
          acabamento = NULLIF(v_item->>'acabamento', ''),
          observacao = NULLIF(v_item->>'observacao', ''),
          valor_unitario = COALESCE((v_item->>'valor_unitario')::numeric, 0)
      WHERE id = v_item_id AND pedido_id = v_order_id;

      IF NOT FOUND THEN
        RAISE EXCEPTION 'order item does not belong to draft' USING ERRCODE = '22023';
      END IF;
    ELSE
      INSERT INTO public.itens_pedido (
        pedido_id, qtde, tamanho, modelo, tecido_cor, manga, gola,
        acabamento, observacao, valor_unitario
      ) VALUES (
        v_order_id,
        COALESCE((v_item->>'qtde')::numeric, 0),
        COALESCE(v_item->>'tamanho', ''),
        COALESCE(v_item->>'modelo', ''),
        NULLIF(v_item->>'tecido_cor', ''),
        NULLIF(v_item->>'manga', ''),
        NULLIF(v_item->>'gola', ''),
        NULLIF(v_item->>'acabamento', ''),
        NULLIF(v_item->>'observacao', ''),
        COALESCE((v_item->>'valor_unitario')::numeric, 0)
      )
      RETURNING id INTO v_item_id;
    END IF;

    v_kept_item_ids := array_append(v_kept_item_ids, v_item_id);
  END LOOP;

  IF p_order_id IS NOT NULL THEN
    DELETE FROM public.itens_pedido
    WHERE pedido_id = v_order_id
      AND NOT (id = ANY(v_kept_item_ids));
  END IF;

  RETURN v_order_id;
END;
$$;

REVOKE ALL ON FUNCTION public.save_order_draft(uuid, jsonb, jsonb)
FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.save_order_draft(uuid, jsonb, jsonb)
TO authenticated;
