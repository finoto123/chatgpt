-- Lote 3: auditoria append-only e Storage privado.
-- Esta migration preserva os paths dos objetos existentes.

CREATE TABLE IF NOT EXISTS public.audit_logs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid,
  action text NOT NULL CHECK (length(action) BETWEEN 1 AND 120),
  entity_type text NOT NULL CHECK (length(entity_type) BETWEEN 1 AND 120),
  entity_id text,
  old_values jsonb,
  new_values jsonb,
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  ip_address text,
  user_agent text,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS audit_logs_user_id_idx ON public.audit_logs (user_id);
CREATE INDEX IF NOT EXISTS audit_logs_entity_type_idx ON public.audit_logs (entity_type);
CREATE INDEX IF NOT EXISTS audit_logs_entity_id_idx ON public.audit_logs (entity_id);
CREATE INDEX IF NOT EXISTS audit_logs_created_at_idx ON public.audit_logs (created_at DESC);
CREATE INDEX IF NOT EXISTS audit_logs_filters_idx
  ON public.audit_logs (entity_type, action, created_at DESC);

ALTER TABLE public.audit_logs ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS profiles_select_authorized ON public.profiles;
CREATE POLICY profiles_select_authorized ON public.profiles
FOR SELECT TO authenticated
USING (
  id = (SELECT auth.uid())
  OR public.has_permission('users.view')
  OR public.has_permission('audit.view')
);

REVOKE ALL ON TABLE public.audit_logs FROM PUBLIC, anon, authenticated;
GRANT SELECT ON TABLE public.audit_logs TO authenticated;

DROP POLICY IF EXISTS audit_logs_select_authorized ON public.audit_logs;
CREATE POLICY audit_logs_select_authorized ON public.audit_logs
FOR SELECT TO authenticated
USING (public.has_permission('audit.view'));

-- Intencionalmente não há policies de INSERT/UPDATE/DELETE. Escritas passam
-- exclusivamente pelas funções SECURITY DEFINER abaixo; logs são append-only.

CREATE OR REPLACE FUNCTION public.sanitize_audit_json(_value jsonb)
RETURNS jsonb
LANGUAGE sql
IMMUTABLE
SET search_path = pg_catalog, public
AS $$
  SELECT CASE
    WHEN _value IS NULL THEN NULL
    WHEN jsonb_typeof(_value) = 'object' THEN COALESCE((
      SELECT jsonb_object_agg(entry.key, public.sanitize_audit_json(entry.value))
      FROM jsonb_each(_value) AS entry
      WHERE entry.key !~* '(password|senha|token|secret|service.?role|cookie|authorization|api.?key)'
    ), '{}'::jsonb)
    WHEN jsonb_typeof(_value) = 'array' THEN COALESCE((
      SELECT jsonb_agg(public.sanitize_audit_json(item.value))
      FROM jsonb_array_elements(_value) AS item
    ), '[]'::jsonb)
    ELSE _value
  END;
$$;

REVOKE ALL ON FUNCTION public.sanitize_audit_json(jsonb) FROM PUBLIC, anon, authenticated;

CREATE OR REPLACE FUNCTION public.write_audit_log(
  _user_id uuid,
  _action text,
  _entity_type text,
  _entity_id text DEFAULT NULL,
  _old_values jsonb DEFAULT NULL,
  _new_values jsonb DEFAULT NULL,
  _metadata jsonb DEFAULT '{}'::jsonb,
  _ip_address text DEFAULT NULL,
  _user_agent text DEFAULT NULL
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog, public
AS $$
DECLARE
  created_id uuid;
BEGIN
  IF _action IS NULL OR length(_action) NOT BETWEEN 1 AND 120
     OR _entity_type IS NULL OR length(_entity_type) NOT BETWEEN 1 AND 120 THEN
    RAISE EXCEPTION 'Evento de auditoria inválido';
  END IF;

  INSERT INTO public.audit_logs (
    user_id, action, entity_type, entity_id, old_values, new_values,
    metadata, ip_address, user_agent
  ) VALUES (
    _user_id,
    _action,
    _entity_type,
    left(_entity_id, 255),
    public.sanitize_audit_json(_old_values),
    public.sanitize_audit_json(_new_values),
    public.sanitize_audit_json(COALESCE(_metadata, '{}'::jsonb)),
    left(_ip_address, 64),
    left(_user_agent, 512)
  )
  RETURNING id INTO created_id;

  RETURN created_id;
END;
$$;

REVOKE ALL ON FUNCTION public.write_audit_log(uuid, text, text, text, jsonb, jsonb, jsonb, text, text)
FROM PUBLIC, anon, authenticated;

CREATE OR REPLACE FUNCTION public.record_audit_event(
  _action text,
  _entity_type text,
  _entity_id text DEFAULT NULL,
  _old_values jsonb DEFAULT NULL,
  _new_values jsonb DEFAULT NULL,
  _metadata jsonb DEFAULT '{}'::jsonb,
  _ip_address text DEFAULT NULL,
  _user_agent text DEFAULT NULL
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog, public
AS $$
DECLARE
  caller_id uuid := (SELECT auth.uid());
BEGIN
  IF caller_id IS NULL OR NOT EXISTS (
    SELECT 1
    FROM public.profiles
    WHERE id = caller_id
      AND (active = true OR _action IN ('auth.login', 'auth.logout'))
  ) THEN
    RAISE EXCEPTION 'Usuário não autorizado' USING ERRCODE = '42501';
  END IF;

  -- A função é exposta ao papel authenticated para permitir registrar login/logout
  -- com a própria sessão. Restrinja os eventos e o alvo para impedir fabricação
  -- arbitrária de logs via chamada direta à API do Supabase.
  IF _action IN ('auth.login', 'auth.logout') THEN
    IF _entity_type <> 'user'
       OR _entity_id IS DISTINCT FROM caller_id::text
       OR _old_values IS NOT NULL
       OR _new_values IS NOT NULL THEN
      RAISE EXCEPTION 'Evento de autenticação inválido' USING ERRCODE = '42501';
    END IF;
  ELSIF _action = 'user.invite' THEN
    IF NOT public.has_permission('users.manage')
       OR _entity_type <> 'user'
       OR _entity_id IS NOT NULL
       OR _old_values IS NOT NULL
       OR _new_values IS NOT NULL THEN
      RAISE EXCEPTION 'Evento de convite inválido' USING ERRCODE = '42501';
    END IF;
  ELSE
    RAISE EXCEPTION 'Evento de aplicação não permitido' USING ERRCODE = '42501';
  END IF;

  RETURN public.write_audit_log(
    caller_id, _action, _entity_type, _entity_id, _old_values, _new_values,
    COALESCE(_metadata, '{}'::jsonb) || jsonb_build_object('source', 'application'),
    _ip_address, _user_agent
  );
END;
$$;

REVOKE ALL ON FUNCTION public.record_audit_event(text, text, text, jsonb, jsonb, jsonb, text, text)
FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.record_audit_event(text, text, text, jsonb, jsonb, jsonb, text, text)
TO authenticated;

CREATE OR REPLACE FUNCTION public.attach_order_layout(
  _order_id uuid,
  _storage_path text,
  _original_name text,
  _mime_type text,
  _size_bytes integer
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog, public
AS $$
DECLARE
  caller_id uuid := (SELECT auth.uid());
  previous_path text;
BEGIN
  IF caller_id IS NULL
     OR NOT EXISTS (SELECT 1 FROM public.profiles WHERE id = caller_id AND active = true)
     OR NOT (
       public.has_permission('orders.create')
       OR public.has_permission('orders.update')
     ) THEN
    RAISE EXCEPTION 'Permissão insuficiente' USING ERRCODE = '42501';
  END IF;

  IF _storage_path !~ ('^' || _order_id::text || '/[0-9a-f-]{36}\.(pdf|png|jpg|webp)$')
     OR _mime_type NOT IN ('application/pdf', 'image/png', 'image/jpeg', 'image/webp')
     OR _size_bytes NOT BETWEEN 1 AND 10485760 THEN
    RAISE EXCEPTION 'Metadados de layout inválidos';
  END IF;

  SELECT layout_pdf_url INTO previous_path
  FROM public.pedidos
  WHERE id = _order_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Pedido não encontrado';
  END IF;

  IF NOT EXISTS (
    SELECT 1
    FROM storage.objects
    WHERE bucket_id = 'pedidos-layouts'
      AND name = _storage_path
  ) THEN
    RAISE EXCEPTION 'Arquivo de layout não encontrado';
  END IF;

  UPDATE public.pedidos
  SET layout_pdf_url = _storage_path
  WHERE id = _order_id;

  PERFORM public.write_audit_log(
    caller_id,
    CASE WHEN previous_path IS NULL THEN 'file.upload' ELSE 'file.replace' END,
    'pedido_layout',
    _order_id::text,
    CASE WHEN previous_path IS NULL THEN NULL ELSE jsonb_build_object('storage_path', previous_path) END,
    jsonb_build_object(
      'storage_path', _storage_path,
      'original_name', left(_original_name, 180),
      'mime_type', _mime_type,
      'size_bytes', _size_bytes
    ),
    jsonb_build_object('source', 'attach_order_layout_rpc')
  );
END;
$$;

REVOKE ALL ON FUNCTION public.attach_order_layout(uuid, text, text, text, integer)
FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.attach_order_layout(uuid, text, text, text, integer)
TO authenticated;

CREATE OR REPLACE FUNCTION public.audit_row_change()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog, public
AS $$
DECLARE
  before_row jsonb := CASE WHEN TG_OP IN ('UPDATE', 'DELETE') THEN to_jsonb(OLD) ELSE NULL END;
  after_row jsonb := CASE WHEN TG_OP IN ('INSERT', 'UPDATE') THEN to_jsonb(NEW) ELSE NULL END;
  row_id text := COALESCE(after_row ->> 'id', before_row ->> 'id');
  event_action text;
  old_status text := before_row ->> 'status';
  new_status text := after_row ->> 'status';
BEGIN
  event_action := CASE
    WHEN TG_TABLE_NAME = 'clientes' THEN
      CASE TG_OP
        WHEN 'INSERT' THEN 'customer.create'
        WHEN 'UPDATE' THEN 'customer.update'
        ELSE 'customer.delete'
      END
    WHEN TG_TABLE_NAME = 'profiles' AND TG_OP = 'UPDATE'
      AND (after_row ->> 'active') IS DISTINCT FROM (before_row ->> 'active')
      THEN CASE WHEN (after_row ->> 'active')::boolean THEN 'user.activated' ELSE 'user.deactivated' END
    WHEN TG_TABLE_NAME = 'user_roles' THEN 'user.role_changed'
    WHEN TG_TABLE_NAME = 'role_permissions' THEN 'role.permission_changed'
    WHEN TG_TABLE_NAME = 'movimentacoes_estoque' AND TG_OP = 'INSERT'
      THEN CASE lower(COALESCE(after_row ->> 'tipo', ''))
        WHEN 'entrada' THEN 'inventory.entry'
        WHEN 'saída' THEN 'inventory.exit'
        WHEN 'saida' THEN 'inventory.exit'
        ELSE 'inventory.adjust'
      END
    WHEN TG_TABLE_NAME = 'tecidos' THEN 'inventory.catalog_' || lower(TG_OP)
    WHEN TG_TABLE_NAME = 'configuracoes_financeiro' THEN 'finance.' || lower(TG_OP)
    WHEN TG_TABLE_NAME = 'envios_dtf' THEN 'production.dtf_' || lower(TG_OP)
    WHEN TG_TABLE_NAME = 'envios_oficina' THEN 'production.workshop_' || lower(TG_OP)
    WHEN TG_TABLE_NAME = 'itens_pedido' THEN 'order.item_' || lower(TG_OP)
    WHEN TG_TABLE_NAME = 'pedidos' AND TG_OP = 'INSERT' THEN 'order.create'
    WHEN TG_TABLE_NAME = 'pedidos' AND TG_OP = 'DELETE' THEN 'order.delete'
    WHEN TG_TABLE_NAME = 'pedidos' AND old_status = 'rascunho' AND new_status <> 'rascunho' THEN 'order.publish'
    WHEN TG_TABLE_NAME = 'pedidos' AND old_status = 'cancelado' AND new_status <> 'cancelado' THEN 'order.restore'
    WHEN TG_TABLE_NAME = 'pedidos' AND new_status = 'cancelado' AND old_status <> 'cancelado' THEN 'order.cancel'
    WHEN TG_TABLE_NAME = 'pedidos' AND new_status = 'entregue' AND old_status <> 'entregue' THEN 'order.deliver'
    WHEN TG_TABLE_NAME = 'pedidos' AND old_status IS DISTINCT FROM new_status THEN 'production.stage_change'
    WHEN TG_TABLE_NAME = 'pedidos' AND after_row -> 'valor_pago_adicional'
      IS DISTINCT FROM before_row -> 'valor_pago_adicional' THEN 'finance.payment'
    WHEN TG_TABLE_NAME = 'pedidos' AND (
      after_row -> 'valor_entrada' IS DISTINCT FROM before_row -> 'valor_entrada'
      OR after_row -> 'status_pagamento' IS DISTINCT FROM before_row -> 'status_pagamento'
      OR after_row -> 'forma_pagamento' IS DISTINCT FROM before_row -> 'forma_pagamento'
    ) THEN 'finance.update'
    WHEN TG_TABLE_NAME = 'pedidos' AND (
      after_row -> 'corte_cortador' IS DISTINCT FROM before_row -> 'corte_cortador'
      OR after_row -> 'corte_inicio_previsto' IS DISTINCT FROM before_row -> 'corte_inicio_previsto'
      OR after_row -> 'corte_inicio_real' IS DISTINCT FROM before_row -> 'corte_inicio_real'
      OR after_row -> 'corte_fim_previsto' IS DISTINCT FROM before_row -> 'corte_fim_previsto'
      OR after_row -> 'corte_fim_real' IS DISTINCT FROM before_row -> 'corte_fim_real'
      OR after_row -> 'corte_consumo_tecido' IS DISTINCT FROM before_row -> 'corte_consumo_tecido'
      OR after_row -> 'corte_codigo_ribana' IS DISTINCT FROM before_row -> 'corte_codigo_ribana'
      OR after_row -> 'corte_consumo_ribana' IS DISTINCT FROM before_row -> 'corte_consumo_ribana'
      OR after_row -> 'corte_codigo_gola' IS DISTINCT FROM before_row -> 'corte_codigo_gola'
      OR after_row -> 'corte_consumo_gola' IS DISTINCT FROM before_row -> 'corte_consumo_gola'
      OR after_row -> 'corte_situacao' IS DISTINCT FROM before_row -> 'corte_situacao'
      OR after_row -> 'corte_observacoes' IS DISTINCT FROM before_row -> 'corte_observacoes'
    ) THEN 'production.cut'
    WHEN TG_TABLE_NAME = 'pedidos' AND (
      after_row -> 'sublimacao_status' IS DISTINCT FROM before_row -> 'sublimacao_status'
      OR after_row -> 'sublimacao_inicio' IS DISTINCT FROM before_row -> 'sublimacao_inicio'
      OR after_row -> 'sublimacao_fim' IS DISTINCT FROM before_row -> 'sublimacao_fim'
      OR after_row -> 'sublimacao_obs' IS DISTINCT FROM before_row -> 'sublimacao_obs'
    ) THEN 'production.sublimation'
    WHEN TG_TABLE_NAME = 'pedidos' AND (
      after_row -> 'bordado_status' IS DISTINCT FROM before_row -> 'bordado_status'
      OR after_row -> 'bordado_inicio' IS DISTINCT FROM before_row -> 'bordado_inicio'
      OR after_row -> 'bordado_fim' IS DISTINCT FROM before_row -> 'bordado_fim'
      OR after_row -> 'bordado_obs' IS DISTINCT FROM before_row -> 'bordado_obs'
    ) THEN 'production.embroidery'
    WHEN TG_TABLE_NAME = 'pedidos' AND (
      after_row -> 'embalagem_status' IS DISTINCT FROM before_row -> 'embalagem_status'
      OR after_row -> 'embalagem_inicio_real' IS DISTINCT FROM before_row -> 'embalagem_inicio_real'
      OR after_row -> 'embalagem_fim_real' IS DISTINCT FROM before_row -> 'embalagem_fim_real'
      OR after_row -> 'embalagem_data_nf' IS DISTINCT FROM before_row -> 'embalagem_data_nf'
      OR after_row -> 'embalagem_numero_nf' IS DISTINCT FROM before_row -> 'embalagem_numero_nf'
      OR after_row -> 'embalagem_defeitos' IS DISTINCT FROM before_row -> 'embalagem_defeitos'
      OR after_row -> 'embalagem_situacao' IS DISTINCT FROM before_row -> 'embalagem_situacao'
      OR after_row -> 'embalagem_observacoes' IS DISTINCT FROM before_row -> 'embalagem_observacoes'
    ) THEN 'production.finishing'
    WHEN TG_TABLE_NAME = 'pedidos' THEN 'order.update'
    ELSE TG_TABLE_NAME || '.' || lower(TG_OP)
  END;

  PERFORM public.write_audit_log(
    (SELECT auth.uid()), event_action, TG_TABLE_NAME, row_id,
    before_row, after_row,
    jsonb_build_object('source', 'database_trigger', 'operation', TG_OP)
  );

  RETURN COALESCE(NEW, OLD);
END;
$$;

REVOKE ALL ON FUNCTION public.audit_row_change() FROM PUBLIC, anon, authenticated;

DO $$
DECLARE
  audited_table text;
BEGIN
  FOREACH audited_table IN ARRAY ARRAY[
    'clientes', 'pedidos', 'itens_pedido', 'profiles', 'user_roles',
    'role_permissions', 'tecidos', 'movimentacoes_estoque',
    'configuracoes_financeiro', 'envios_oficina', 'envios_dtf'
  ]
  LOOP
    IF to_regclass('public.' || audited_table) IS NOT NULL THEN
      EXECUTE format('DROP TRIGGER IF EXISTS audit_%I_changes ON public.%I', audited_table, audited_table);
      EXECUTE format(
        'CREATE TRIGGER audit_%I_changes AFTER INSERT OR UPDATE OR DELETE ON public.%I FOR EACH ROW EXECUTE FUNCTION public.audit_row_change()',
        audited_table, audited_table
      );
    END IF;
  END LOOP;
END
$$;

-- Bucket privado: a atualização não altera nomes nem paths existentes.
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'pedidos-layouts', 'pedidos-layouts', false, 10485760,
  ARRAY['application/pdf', 'image/png', 'image/jpeg', 'image/webp']
)
ON CONFLICT (id) DO UPDATE SET
  public = false,
  file_size_limit = EXCLUDED.file_size_limit,
  allowed_mime_types = EXCLUDED.allowed_mime_types;

DROP POLICY IF EXISTS pedidos_layouts_select ON storage.objects;
DROP POLICY IF EXISTS pedidos_layouts_insert ON storage.objects;
DROP POLICY IF EXISTS pedidos_layouts_update ON storage.objects;
DROP POLICY IF EXISTS pedidos_layouts_delete ON storage.objects;
DROP POLICY IF EXISTS pedidos_layouts_select_authorized ON storage.objects;

CREATE POLICY pedidos_layouts_select_authorized ON storage.objects
FOR SELECT TO authenticated
USING (
  bucket_id = 'pedidos-layouts'
  AND public.has_permission('orders.view')
);

-- Escrita/remoção continuam sem policy para anon/authenticated. O fluxo
-- administrativo server-side usa service_role somente após autorização.

COMMENT ON TABLE public.audit_logs IS
  'Log append-only. Sem retenção automática; revisar retenção com DPO/LGPD antes de qualquer expurgo.';
