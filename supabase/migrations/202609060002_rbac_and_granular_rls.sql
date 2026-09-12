-- Lote 2: RBAC, autorização server-side e RLS granular.
-- Aplicar somente depois do backup e da validação em staging.

CREATE TABLE IF NOT EXISTS public.profiles (
  id uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  full_name text NOT NULL DEFAULT '',
  email text,
  phone text,
  avatar_url text,
  active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.roles (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  code text NOT NULL UNIQUE,
  name text NOT NULL,
  description text,
  is_system boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT roles_code_format CHECK (code ~ '^[a-z][a-z0-9_]*$')
);

CREATE TABLE IF NOT EXISTS public.permissions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  code text NOT NULL UNIQUE,
  name text NOT NULL,
  description text,
  module text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT permissions_code_format CHECK (code ~ '^[a-z][a-z0-9_]*\.[a-z][a-z0-9_]*$')
);

CREATE TABLE IF NOT EXISTS public.user_roles (
  user_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  role_id uuid NOT NULL REFERENCES public.roles(id) ON DELETE CASCADE,
  created_at timestamptz NOT NULL DEFAULT now(),
  created_by uuid REFERENCES public.profiles(id) ON DELETE SET NULL,
  PRIMARY KEY (user_id, role_id)
);

CREATE TABLE IF NOT EXISTS public.role_permissions (
  role_id uuid NOT NULL REFERENCES public.roles(id) ON DELETE CASCADE,
  permission_id uuid NOT NULL REFERENCES public.permissions(id) ON DELETE CASCADE,
  created_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (role_id, permission_id)
);

CREATE INDEX IF NOT EXISTS profiles_active_idx ON public.profiles(active);
CREATE INDEX IF NOT EXISTS user_roles_user_id_idx ON public.user_roles(user_id);
CREATE INDEX IF NOT EXISTS user_roles_role_id_idx ON public.user_roles(role_id);
CREATE INDEX IF NOT EXISTS role_permissions_role_id_idx ON public.role_permissions(role_id);
CREATE INDEX IF NOT EXISTS role_permissions_permission_id_idx ON public.role_permissions(permission_id);

CREATE OR REPLACE FUNCTION public.set_updated_at()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = pg_catalog, public
AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;

REVOKE ALL ON FUNCTION public.set_updated_at() FROM PUBLIC, anon, authenticated;

ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.roles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.permissions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.user_roles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.role_permissions ENABLE ROW LEVEL SECURITY;

REVOKE ALL ON public.profiles, public.roles, public.permissions,
  public.user_roles, public.role_permissions FROM PUBLIC, anon, authenticated;
GRANT SELECT ON public.profiles, public.roles, public.permissions,
  public.user_roles, public.role_permissions TO authenticated;

-- Remove apenas a policy transitória conhecida do Lote 1. Nenhuma outra
-- policy é descartada de forma genérica.
DROP POLICY IF EXISTS authenticated_access_baseline ON public.clientes;
DROP POLICY IF EXISTS authenticated_access_baseline ON public.configuracoes_financeiro;
DROP POLICY IF EXISTS authenticated_access_baseline ON public.envios_dtf;
DROP POLICY IF EXISTS authenticated_access_baseline ON public.envios_oficina;
DROP POLICY IF EXISTS authenticated_access_baseline ON public.feriados;
DROP POLICY IF EXISTS authenticated_access_baseline ON public.itens_pedido;
DROP POLICY IF EXISTS authenticated_access_baseline ON public.movimentacoes_estoque;
DROP POLICY IF EXISTS authenticated_access_baseline ON public.oficinas;
DROP POLICY IF EXISTS authenticated_access_baseline ON public.pedidos;
DROP POLICY IF EXISTS authenticated_access_baseline ON public.tecidos;
DROP POLICY IF EXISTS authenticated_access_baseline ON public.vendedores;

DROP TRIGGER IF EXISTS profiles_set_updated_at ON public.profiles;
CREATE TRIGGER profiles_set_updated_at
BEFORE UPDATE ON public.profiles
FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

CREATE OR REPLACE FUNCTION public.sync_auth_user_profile()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog, public
AS $$
BEGIN
  INSERT INTO public.profiles (id, full_name, email)
  VALUES (
    NEW.id,
    COALESCE(NULLIF(NEW.raw_user_meta_data ->> 'full_name', ''), split_part(COALESCE(NEW.email, ''), '@', 1)),
    NEW.email
  )
  ON CONFLICT (id) DO UPDATE
  SET
    email = EXCLUDED.email,
    full_name = CASE
      WHEN public.profiles.full_name = '' THEN EXCLUDED.full_name
      ELSE public.profiles.full_name
    END;
  RETURN NEW;
END;
$$;

REVOKE ALL ON FUNCTION public.sync_auth_user_profile() FROM PUBLIC, anon, authenticated;

DROP TRIGGER IF EXISTS auth_user_sync_rbac_profile ON auth.users;
CREATE TRIGGER auth_user_sync_rbac_profile
AFTER INSERT OR UPDATE OF email, raw_user_meta_data ON auth.users
FOR EACH ROW EXECUTE FUNCTION public.sync_auth_user_profile();

INSERT INTO public.profiles (id, full_name, email)
SELECT
  u.id,
  COALESCE(NULLIF(u.raw_user_meta_data ->> 'full_name', ''), split_part(COALESCE(u.email, ''), '@', 1)),
  u.email
FROM auth.users u
ON CONFLICT (id) DO NOTHING;

INSERT INTO public.roles (code, name, description, is_system)
VALUES
  ('administrator', 'Administrador', 'Acesso total e administração do sistema.', true),
  ('manager', 'Gerente', 'Visão ampla comercial e operacional.', true),
  ('commercial', 'Comercial', 'Clientes, pipeline comercial e orçamentos.', true),
  ('salesperson', 'Vendedor', 'Carteira comercial, pedidos e orçamentos.', true),
  ('production', 'Produção', 'Pedidos, produção e oficinas sem dados financeiros.', true),
  ('inventory', 'Estoque', 'Materiais, movimentações e separação.', true),
  ('purchasing', 'Compras', 'Necessidades de compra e materiais.', true),
  ('finance', 'Financeiro', 'Recebimentos e configurações financeiras.', true)
ON CONFLICT (code) DO UPDATE
SET name = EXCLUDED.name, description = EXCLUDED.description, is_system = true;

INSERT INTO public.permissions (code, name, module)
VALUES
  ('dashboard.view', 'Visualizar dashboard', 'dashboard'),
  ('customers.view', 'Visualizar clientes', 'customers'),
  ('customers.create', 'Criar clientes', 'customers'),
  ('customers.update', 'Editar clientes', 'customers'),
  ('customers.delete', 'Excluir clientes', 'customers'),
  ('orders.view', 'Visualizar pedidos', 'orders'),
  ('orders.create', 'Criar pedidos', 'orders'),
  ('orders.update', 'Editar pedidos', 'orders'),
  ('orders.cancel', 'Cancelar pedidos', 'orders'),
  ('production.view', 'Visualizar produção', 'production'),
  ('production.update', 'Atualizar produção', 'production'),
  ('inventory.view', 'Visualizar estoque', 'inventory'),
  ('inventory.create', 'Cadastrar itens de estoque', 'inventory'),
  ('inventory.update', 'Editar cadastro de estoque', 'inventory'),
  ('inventory.adjust', 'Movimentar estoque', 'inventory'),
  ('purchases.view', 'Visualizar compras', 'purchases'),
  ('purchases.create', 'Criar compras', 'purchases'),
  ('purchases.update', 'Editar compras', 'purchases'),
  ('finance.view', 'Visualizar financeiro', 'finance'),
  ('finance.create', 'Criar lançamentos financeiros', 'finance'),
  ('finance.update', 'Editar financeiro', 'finance'),
  ('workshops.view', 'Visualizar oficinas', 'workshops'),
  ('workshops.update', 'Atualizar oficinas', 'workshops'),
  ('settings.view', 'Visualizar configurações', 'settings'),
  ('settings.manage', 'Gerenciar configurações', 'settings'),
  ('users.view', 'Visualizar usuários', 'users'),
  ('users.manage', 'Gerenciar usuários', 'users'),
  ('roles.view', 'Visualizar papéis', 'roles'),
  ('roles.manage', 'Gerenciar papéis', 'roles'),
  ('audit.view', 'Visualizar auditoria', 'audit'),
  ('crm.view', 'Visualizar CRM', 'crm'),
  ('crm.create', 'Criar registros no CRM', 'crm'),
  ('crm.update', 'Editar registros no CRM', 'crm'),
  ('crm.delete', 'Excluir registros no CRM', 'crm'),
  ('quotes.view', 'Visualizar orçamentos', 'quotes'),
  ('quotes.create', 'Criar orçamentos', 'quotes'),
  ('quotes.update', 'Editar orçamentos', 'quotes'),
  ('quotes.approve', 'Aprovar orçamentos', 'quotes')
ON CONFLICT (code) DO UPDATE
SET name = EXCLUDED.name, module = EXCLUDED.module;

INSERT INTO public.role_permissions (role_id, permission_id)
SELECT r.id, p.id
FROM public.roles r
CROSS JOIN public.permissions p
WHERE r.code = 'administrator'
ON CONFLICT (role_id, permission_id) DO NOTHING;

CREATE OR REPLACE FUNCTION public.has_permission(_permission_code text)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = pg_catalog, public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.profiles pr
    JOIN public.user_roles ur ON ur.user_id = pr.id
    JOIN public.role_permissions rp ON rp.role_id = ur.role_id
    JOIN public.permissions pe ON pe.id = rp.permission_id
    WHERE pr.id = (SELECT auth.uid())
      AND pr.active = true
      AND pe.code = _permission_code
  );
$$;

REVOKE ALL ON FUNCTION public.has_permission(text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.has_permission(text) TO authenticated;

-- As tabelas de autorização são somente leitura pelo cliente autenticado.
-- Toda mutação passa pelas RPCs validadas abaixo.
DROP POLICY IF EXISTS profiles_select_authorized ON public.profiles;
CREATE POLICY profiles_select_authorized ON public.profiles
FOR SELECT TO authenticated
USING (id = (SELECT auth.uid()) OR public.has_permission('users.view'));

DROP POLICY IF EXISTS roles_select_authorized ON public.roles;
CREATE POLICY roles_select_authorized ON public.roles
FOR SELECT TO authenticated
USING (
  public.has_permission('roles.view')
  OR public.has_permission('users.view')
);

DROP POLICY IF EXISTS permissions_select_authorized ON public.permissions;
CREATE POLICY permissions_select_authorized ON public.permissions
FOR SELECT TO authenticated
USING (public.has_permission('roles.view'));

DROP POLICY IF EXISTS user_roles_select_authorized ON public.user_roles;
CREATE POLICY user_roles_select_authorized ON public.user_roles
FOR SELECT TO authenticated
USING (
  user_id = (SELECT auth.uid())
  OR public.has_permission('users.view')
  OR public.has_permission('roles.view')
);

DROP POLICY IF EXISTS role_permissions_select_authorized ON public.role_permissions;
CREATE POLICY role_permissions_select_authorized ON public.role_permissions
FOR SELECT TO authenticated
USING (public.has_permission('roles.view'));

-- RLS granular das onze tabelas confirmadas no Lote 1.
ALTER TABLE public.clientes ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.pedidos ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.itens_pedido ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.vendedores ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.oficinas ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.envios_oficina ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.envios_dtf ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.tecidos ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.movimentacoes_estoque ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.configuracoes_financeiro ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.feriados ENABLE ROW LEVEL SECURITY;

REVOKE ALL ON public.clientes, public.pedidos, public.itens_pedido,
  public.vendedores, public.oficinas, public.envios_oficina,
  public.envios_dtf, public.tecidos, public.movimentacoes_estoque,
  public.configuracoes_financeiro, public.feriados
FROM PUBLIC, anon, authenticated;

GRANT SELECT, INSERT, UPDATE, DELETE ON public.clientes TO authenticated;
GRANT SELECT, INSERT, UPDATE ON public.pedidos TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.itens_pedido TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.vendedores TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.oficinas TO authenticated;
GRANT SELECT, INSERT, UPDATE ON public.envios_oficina TO authenticated;
GRANT SELECT, INSERT, UPDATE ON public.envios_dtf TO authenticated;
GRANT SELECT, INSERT, UPDATE ON public.tecidos TO authenticated;
GRANT SELECT, INSERT ON public.movimentacoes_estoque TO authenticated;
GRANT SELECT, INSERT, UPDATE ON public.configuracoes_financeiro TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.feriados TO authenticated;

DROP POLICY IF EXISTS clientes_select_authorized ON public.clientes;
CREATE POLICY clientes_select_authorized ON public.clientes
FOR SELECT TO authenticated USING (public.has_permission('customers.view'));
DROP POLICY IF EXISTS clientes_insert_authorized ON public.clientes;
CREATE POLICY clientes_insert_authorized ON public.clientes
FOR INSERT TO authenticated WITH CHECK (public.has_permission('customers.create'));
DROP POLICY IF EXISTS clientes_update_authorized ON public.clientes;
CREATE POLICY clientes_update_authorized ON public.clientes
FOR UPDATE TO authenticated
USING (public.has_permission('customers.update'))
WITH CHECK (public.has_permission('customers.update'));
DROP POLICY IF EXISTS clientes_delete_authorized ON public.clientes;
CREATE POLICY clientes_delete_authorized ON public.clientes
FOR DELETE TO authenticated USING (public.has_permission('customers.delete'));

DROP POLICY IF EXISTS pedidos_select_authorized ON public.pedidos;
CREATE POLICY pedidos_select_authorized ON public.pedidos
FOR SELECT TO authenticated USING (public.has_permission('orders.view'));
DROP POLICY IF EXISTS pedidos_insert_authorized ON public.pedidos;
CREATE POLICY pedidos_insert_authorized ON public.pedidos
FOR INSERT TO authenticated WITH CHECK (public.has_permission('orders.create'));
DROP POLICY IF EXISTS pedidos_update_authorized ON public.pedidos;
CREATE POLICY pedidos_update_authorized ON public.pedidos
FOR UPDATE TO authenticated
USING (
  public.has_permission('orders.update')
  OR public.has_permission('orders.cancel')
  OR public.has_permission('production.update')
  OR public.has_permission('workshops.update')
  OR public.has_permission('finance.update')
)
WITH CHECK (
  public.has_permission('orders.update')
  OR public.has_permission('orders.cancel')
  OR public.has_permission('production.update')
  OR public.has_permission('workshops.update')
  OR public.has_permission('finance.update')
);

DROP POLICY IF EXISTS itens_pedido_select_authorized ON public.itens_pedido;
CREATE POLICY itens_pedido_select_authorized ON public.itens_pedido
FOR SELECT TO authenticated
USING (
  public.has_permission('orders.view')
  AND EXISTS (
    SELECT 1 FROM public.pedidos parent_order
    WHERE parent_order.id = itens_pedido.pedido_id
  )
);
DROP POLICY IF EXISTS itens_pedido_insert_authorized ON public.itens_pedido;
CREATE POLICY itens_pedido_insert_authorized ON public.itens_pedido
FOR INSERT TO authenticated
WITH CHECK (
  (public.has_permission('orders.create') OR public.has_permission('orders.update'))
  AND EXISTS (
    SELECT 1 FROM public.pedidos parent_order
    WHERE parent_order.id = itens_pedido.pedido_id
  )
);
DROP POLICY IF EXISTS itens_pedido_update_authorized ON public.itens_pedido;
CREATE POLICY itens_pedido_update_authorized ON public.itens_pedido
FOR UPDATE TO authenticated
USING (
  public.has_permission('orders.update')
  AND EXISTS (
    SELECT 1 FROM public.pedidos parent_order
    WHERE parent_order.id = itens_pedido.pedido_id
  )
)
WITH CHECK (
  public.has_permission('orders.update')
  AND EXISTS (
    SELECT 1 FROM public.pedidos parent_order
    WHERE parent_order.id = itens_pedido.pedido_id
  )
);
DROP POLICY IF EXISTS itens_pedido_delete_authorized ON public.itens_pedido;
CREATE POLICY itens_pedido_delete_authorized ON public.itens_pedido
FOR DELETE TO authenticated
USING (
  public.has_permission('orders.update')
  AND EXISTS (
    SELECT 1 FROM public.pedidos parent_order
    WHERE parent_order.id = itens_pedido.pedido_id
  )
);

DROP POLICY IF EXISTS vendedores_select_authorized ON public.vendedores;
CREATE POLICY vendedores_select_authorized ON public.vendedores
FOR SELECT TO authenticated
USING (
  public.has_permission('orders.view') OR public.has_permission('settings.view')
);
DROP POLICY IF EXISTS vendedores_insert_authorized ON public.vendedores;
CREATE POLICY vendedores_insert_authorized ON public.vendedores
FOR INSERT TO authenticated WITH CHECK (public.has_permission('settings.manage'));
DROP POLICY IF EXISTS vendedores_update_authorized ON public.vendedores;
CREATE POLICY vendedores_update_authorized ON public.vendedores
FOR UPDATE TO authenticated
USING (public.has_permission('settings.manage'))
WITH CHECK (public.has_permission('settings.manage'));
DROP POLICY IF EXISTS vendedores_delete_authorized ON public.vendedores;
CREATE POLICY vendedores_delete_authorized ON public.vendedores
FOR DELETE TO authenticated USING (public.has_permission('settings.manage'));

DROP POLICY IF EXISTS oficinas_select_authorized ON public.oficinas;
CREATE POLICY oficinas_select_authorized ON public.oficinas
FOR SELECT TO authenticated
USING (
  public.has_permission('workshops.view')
  OR public.has_permission('orders.view')
  OR public.has_permission('settings.view')
);
DROP POLICY IF EXISTS oficinas_insert_authorized ON public.oficinas;
CREATE POLICY oficinas_insert_authorized ON public.oficinas
FOR INSERT TO authenticated WITH CHECK (public.has_permission('settings.manage'));
DROP POLICY IF EXISTS oficinas_update_authorized ON public.oficinas;
CREATE POLICY oficinas_update_authorized ON public.oficinas
FOR UPDATE TO authenticated
USING (public.has_permission('settings.manage'))
WITH CHECK (public.has_permission('settings.manage'));
DROP POLICY IF EXISTS oficinas_delete_authorized ON public.oficinas;
CREATE POLICY oficinas_delete_authorized ON public.oficinas
FOR DELETE TO authenticated USING (public.has_permission('settings.manage'));

DROP POLICY IF EXISTS envios_oficina_select_authorized ON public.envios_oficina;
CREATE POLICY envios_oficina_select_authorized ON public.envios_oficina
FOR SELECT TO authenticated
USING (
  public.has_permission('workshops.view') OR public.has_permission('production.view')
);
DROP POLICY IF EXISTS envios_oficina_insert_authorized ON public.envios_oficina;
CREATE POLICY envios_oficina_insert_authorized ON public.envios_oficina
FOR INSERT TO authenticated
WITH CHECK (
  public.has_permission('workshops.update') OR public.has_permission('production.update')
);
DROP POLICY IF EXISTS envios_oficina_update_authorized ON public.envios_oficina;
CREATE POLICY envios_oficina_update_authorized ON public.envios_oficina
FOR UPDATE TO authenticated
USING (
  public.has_permission('workshops.update') OR public.has_permission('production.update')
)
WITH CHECK (
  public.has_permission('workshops.update') OR public.has_permission('production.update')
);

DROP POLICY IF EXISTS envios_dtf_select_authorized ON public.envios_dtf;
CREATE POLICY envios_dtf_select_authorized ON public.envios_dtf
FOR SELECT TO authenticated USING (public.has_permission('production.view'));
DROP POLICY IF EXISTS envios_dtf_insert_authorized ON public.envios_dtf;
CREATE POLICY envios_dtf_insert_authorized ON public.envios_dtf
FOR INSERT TO authenticated WITH CHECK (public.has_permission('production.update'));
DROP POLICY IF EXISTS envios_dtf_update_authorized ON public.envios_dtf;
CREATE POLICY envios_dtf_update_authorized ON public.envios_dtf
FOR UPDATE TO authenticated
USING (public.has_permission('production.update'))
WITH CHECK (public.has_permission('production.update'));

DROP POLICY IF EXISTS tecidos_select_authorized ON public.tecidos;
CREATE POLICY tecidos_select_authorized ON public.tecidos
FOR SELECT TO authenticated USING (public.has_permission('inventory.view'));
DROP POLICY IF EXISTS tecidos_insert_authorized ON public.tecidos;
CREATE POLICY tecidos_insert_authorized ON public.tecidos
FOR INSERT TO authenticated WITH CHECK (public.has_permission('inventory.create'));
DROP POLICY IF EXISTS tecidos_update_authorized ON public.tecidos;
CREATE POLICY tecidos_update_authorized ON public.tecidos
FOR UPDATE TO authenticated
USING (public.has_permission('inventory.update'))
WITH CHECK (public.has_permission('inventory.update'));

DROP POLICY IF EXISTS movimentacoes_estoque_select_authorized ON public.movimentacoes_estoque;
CREATE POLICY movimentacoes_estoque_select_authorized ON public.movimentacoes_estoque
FOR SELECT TO authenticated USING (public.has_permission('inventory.view'));
DROP POLICY IF EXISTS movimentacoes_estoque_insert_authorized ON public.movimentacoes_estoque;
CREATE POLICY movimentacoes_estoque_insert_authorized ON public.movimentacoes_estoque
FOR INSERT TO authenticated WITH CHECK (public.has_permission('inventory.adjust'));

DROP POLICY IF EXISTS configuracoes_financeiro_select_authorized ON public.configuracoes_financeiro;
CREATE POLICY configuracoes_financeiro_select_authorized ON public.configuracoes_financeiro
FOR SELECT TO authenticated USING (public.has_permission('finance.view'));
DROP POLICY IF EXISTS configuracoes_financeiro_insert_authorized ON public.configuracoes_financeiro;
CREATE POLICY configuracoes_financeiro_insert_authorized ON public.configuracoes_financeiro
FOR INSERT TO authenticated WITH CHECK (public.has_permission('finance.create'));
DROP POLICY IF EXISTS configuracoes_financeiro_update_authorized ON public.configuracoes_financeiro;
CREATE POLICY configuracoes_financeiro_update_authorized ON public.configuracoes_financeiro
FOR UPDATE TO authenticated
USING (public.has_permission('finance.update'))
WITH CHECK (public.has_permission('finance.update'));

DROP POLICY IF EXISTS feriados_select_authorized ON public.feriados;
CREATE POLICY feriados_select_authorized ON public.feriados
FOR SELECT TO authenticated USING (public.has_permission('settings.view'));
DROP POLICY IF EXISTS feriados_insert_authorized ON public.feriados;
CREATE POLICY feriados_insert_authorized ON public.feriados
FOR INSERT TO authenticated WITH CHECK (public.has_permission('settings.manage'));
DROP POLICY IF EXISTS feriados_update_authorized ON public.feriados;
CREATE POLICY feriados_update_authorized ON public.feriados
FOR UPDATE TO authenticated
USING (public.has_permission('settings.manage'))
WITH CHECK (public.has_permission('settings.manage'));
DROP POLICY IF EXISTS feriados_delete_authorized ON public.feriados;
CREATE POLICY feriados_delete_authorized ON public.feriados
FOR DELETE TO authenticated USING (public.has_permission('settings.manage'));

DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM pg_views
    WHERE schemaname = 'public' AND viewname = 'estoque_atual'
  ) THEN
    ALTER VIEW public.estoque_atual SET (security_invoker = true);
    REVOKE ALL ON TABLE public.estoque_atual FROM PUBLIC, anon, authenticated;
    GRANT SELECT ON TABLE public.estoque_atual TO authenticated;
  END IF;
END
$$;

CREATE OR REPLACE FUNCTION public.get_my_authorization_context()
RETURNS jsonb
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = pg_catalog, public
AS $$
  SELECT jsonb_build_object(
    'profile', jsonb_build_object(
      'id', pr.id,
      'full_name', pr.full_name,
      'email', pr.email,
      'phone', pr.phone,
      'avatar_url', pr.avatar_url,
      'active', pr.active,
      'updated_at', pr.updated_at
    ),
    'roles', COALESCE((
      SELECT jsonb_agg(role_row.payload ORDER BY role_row.priority, role_row.code)
      FROM (
        SELECT DISTINCT
          r.code,
          CASE r.code
            WHEN 'administrator' THEN 1
            WHEN 'manager' THEN 2
            WHEN 'commercial' THEN 3
            WHEN 'salesperson' THEN 4
            WHEN 'production' THEN 5
            WHEN 'inventory' THEN 6
            WHEN 'purchasing' THEN 7
            WHEN 'finance' THEN 8
            ELSE 99
          END AS priority,
          jsonb_build_object('id', r.id, 'code', r.code, 'name', r.name) AS payload
        FROM public.user_roles ur
        JOIN public.roles r ON r.id = ur.role_id
        WHERE ur.user_id = pr.id
      ) role_row
    ), '[]'::jsonb),
    'permissions', CASE WHEN pr.active THEN COALESCE((
      SELECT jsonb_agg(permission_row.code ORDER BY permission_row.code)
      FROM (
        SELECT DISTINCT pe.code
        FROM public.user_roles ur
        JOIN public.role_permissions rp ON rp.role_id = ur.role_id
        JOIN public.permissions pe ON pe.id = rp.permission_id
        WHERE ur.user_id = pr.id
      ) permission_row
    ), '[]'::jsonb) ELSE '[]'::jsonb END
  )
  FROM public.profiles pr
  WHERE pr.id = (SELECT auth.uid());
$$;

REVOKE ALL ON FUNCTION public.get_my_authorization_context() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.get_my_authorization_context() TO authenticated;

CREATE OR REPLACE FUNCTION public.is_last_active_administrator(_user_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = pg_catalog, public
AS $$
  SELECT
    EXISTS (
      SELECT 1
      FROM public.user_roles ur
      JOIN public.roles r ON r.id = ur.role_id
      JOIN public.profiles pr ON pr.id = ur.user_id
      WHERE ur.user_id = _user_id
        AND r.code = 'administrator'
        AND pr.active = true
    )
    AND NOT EXISTS (
      SELECT 1
      FROM public.user_roles ur
      JOIN public.roles r ON r.id = ur.role_id
      JOIN public.profiles pr ON pr.id = ur.user_id
      WHERE ur.user_id <> _user_id
        AND r.code = 'administrator'
        AND pr.active = true
    );
$$;

REVOKE ALL ON FUNCTION public.is_last_active_administrator(uuid) FROM PUBLIC, anon;

CREATE OR REPLACE FUNCTION public.bootstrap_first_administrator(_user_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog, public
AS $$
DECLARE
  administrator_role_id uuid;
BEGIN
  PERFORM pg_advisory_xact_lock(202609060002::bigint);

  IF NOT EXISTS (SELECT 1 FROM auth.users WHERE id = _user_id) THEN
    RAISE EXCEPTION 'Usuário não encontrado em auth.users';
  END IF;

  IF EXISTS (
    SELECT 1
    FROM public.user_roles ur
    JOIN public.roles r ON r.id = ur.role_id
    JOIN public.profiles pr ON pr.id = ur.user_id
    WHERE r.code = 'administrator' AND pr.active = true
  ) THEN
    RAISE EXCEPTION 'O primeiro administrador já foi configurado';
  END IF;

  INSERT INTO public.profiles (id, full_name, email, active)
  SELECT
    u.id,
    COALESCE(NULLIF(u.raw_user_meta_data ->> 'full_name', ''), split_part(COALESCE(u.email, ''), '@', 1)),
    u.email,
    true
  FROM auth.users u
  WHERE u.id = _user_id
  ON CONFLICT (id) DO UPDATE SET active = true;

  SELECT id INTO administrator_role_id
  FROM public.roles
  WHERE code = 'administrator';

  INSERT INTO public.user_roles (user_id, role_id, created_by)
  VALUES (_user_id, administrator_role_id, NULL)
  ON CONFLICT (user_id, role_id) DO NOTHING;
END;
$$;

REVOKE ALL ON FUNCTION public.bootstrap_first_administrator(uuid)
FROM PUBLIC, anon, authenticated, service_role;

CREATE OR REPLACE FUNCTION public.set_profile_active(
  _target_user_id uuid,
  _active boolean
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog, public
AS $$
BEGIN
  IF NOT public.has_permission('users.manage') THEN
    RAISE EXCEPTION 'Permissão insuficiente' USING ERRCODE = '42501';
  END IF;

  PERFORM pg_advisory_xact_lock(202609060002::bigint);

  IF NOT EXISTS (SELECT 1 FROM public.profiles WHERE id = _target_user_id) THEN
    RAISE EXCEPTION 'Perfil não encontrado';
  END IF;

  IF _active = false AND public.is_last_active_administrator(_target_user_id) THEN
    RAISE EXCEPTION 'Não é possível desativar o último administrador ativo';
  END IF;

  UPDATE public.profiles
  SET active = _active
  WHERE id = _target_user_id;
END;
$$;

REVOKE ALL ON FUNCTION public.set_profile_active(uuid, boolean) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.set_profile_active(uuid, boolean) TO authenticated;

CREATE OR REPLACE FUNCTION public.set_user_roles(
  _target_user_id uuid,
  _role_ids uuid[]
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog, public
AS $$
DECLARE
  administrator_role_id uuid;
  target_is_administrator boolean;
  will_be_administrator boolean;
BEGIN
  IF NOT public.has_permission('users.manage') THEN
    RAISE EXCEPTION 'Permissão insuficiente' USING ERRCODE = '42501';
  END IF;

  IF _role_ids IS NULL OR array_position(_role_ids, NULL) IS NOT NULL THEN
    RAISE EXCEPTION 'Lista de papéis inválida';
  END IF;

  IF NOT EXISTS (SELECT 1 FROM public.profiles WHERE id = _target_user_id) THEN
    RAISE EXCEPTION 'Perfil não encontrado';
  END IF;

  IF (SELECT count(DISTINCT selected.role_id) FROM unnest(_role_ids) AS selected(role_id))
     <> cardinality(_role_ids) THEN
    RAISE EXCEPTION 'Papéis duplicados não são permitidos';
  END IF;

  IF EXISTS (
    SELECT 1 FROM unnest(_role_ids) AS selected(role_id)
    WHERE NOT EXISTS (SELECT 1 FROM public.roles r WHERE r.id = selected.role_id)
  ) THEN
    RAISE EXCEPTION 'Um ou mais papéis não existem';
  END IF;

  PERFORM pg_advisory_xact_lock(202609060002::bigint);

  SELECT id INTO administrator_role_id
  FROM public.roles
  WHERE code = 'administrator';

  SELECT EXISTS (
    SELECT 1 FROM public.user_roles
    WHERE user_id = _target_user_id AND role_id = administrator_role_id
  ) INTO target_is_administrator;

  will_be_administrator := administrator_role_id = ANY(_role_ids);

  IF target_is_administrator <> will_be_administrator
     AND NOT public.has_permission('roles.manage') THEN
    RAISE EXCEPTION 'Somente quem gerencia papéis pode alterar o papel Administrador'
      USING ERRCODE = '42501';
  END IF;

  IF target_is_administrator
     AND NOT will_be_administrator
     AND public.is_last_active_administrator(_target_user_id) THEN
    RAISE EXCEPTION 'Não é possível remover o papel do último administrador ativo';
  END IF;

  DELETE FROM public.user_roles
  WHERE user_id = _target_user_id
    AND NOT (role_id = ANY(_role_ids));

  INSERT INTO public.user_roles (user_id, role_id, created_by)
  SELECT _target_user_id, selected.role_id, (SELECT auth.uid())
  FROM unnest(_role_ids) AS selected(role_id)
  ON CONFLICT (user_id, role_id) DO NOTHING;
END;
$$;

REVOKE ALL ON FUNCTION public.set_user_roles(uuid, uuid[]) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.set_user_roles(uuid, uuid[]) TO authenticated;

CREATE OR REPLACE FUNCTION public.set_role_permission(
  _role_id uuid,
  _permission_id uuid,
  _enabled boolean
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog, public
AS $$
DECLARE
  target_role_code text;
BEGIN
  IF NOT public.has_permission('roles.manage') THEN
    RAISE EXCEPTION 'Permissão insuficiente' USING ERRCODE = '42501';
  END IF;

  SELECT code INTO target_role_code FROM public.roles WHERE id = _role_id;
  IF target_role_code IS NULL
     OR NOT EXISTS (SELECT 1 FROM public.permissions WHERE id = _permission_id) THEN
    RAISE EXCEPTION 'Papel ou permissão não encontrado';
  END IF;

  IF target_role_code = 'administrator' AND _enabled = false THEN
    RAISE EXCEPTION 'As permissões explícitas do Administrador não podem ser removidas';
  END IF;

  IF _enabled THEN
    INSERT INTO public.role_permissions (role_id, permission_id)
    VALUES (_role_id, _permission_id)
    ON CONFLICT (role_id, permission_id) DO NOTHING;
  ELSE
    DELETE FROM public.role_permissions
    WHERE role_id = _role_id AND permission_id = _permission_id;
  END IF;
END;
$$;

REVOKE ALL ON FUNCTION public.set_role_permission(uuid, uuid, boolean) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.set_role_permission(uuid, uuid, boolean) TO authenticated;

CREATE OR REPLACE FUNCTION public.enforce_pedidos_update_scope()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = pg_catalog, public
AS $$
DECLARE
  allowed_columns text[] := ARRAY['updated_at'];
  can_update_orders boolean := public.has_permission('orders.update');
  can_cancel_orders boolean := public.has_permission('orders.cancel');
  can_update_production boolean := public.has_permission('production.update');
  can_update_workshops boolean := public.has_permission('workshops.update');
  can_update_finance boolean := public.has_permission('finance.update');
BEGIN
  IF (SELECT auth.uid()) IS NULL
     AND current_user IN ('postgres', 'supabase_admin', 'service_role') THEN
    RETURN NEW;
  END IF;

  IF NEW.status IS DISTINCT FROM OLD.status
     AND (NEW.status = 'cancelado' OR OLD.status = 'cancelado')
     AND NOT can_cancel_orders THEN
    RAISE EXCEPTION 'Permissão orders.cancel obrigatória' USING ERRCODE = '42501';
  END IF;

  IF can_update_orders THEN
    IF NOT can_update_finance AND (
      (to_jsonb(NEW) -> 'valor_entrada') IS DISTINCT FROM (to_jsonb(OLD) -> 'valor_entrada')
      OR (to_jsonb(NEW) -> 'valor_pago_adicional') IS DISTINCT FROM (to_jsonb(OLD) -> 'valor_pago_adicional')
      OR (to_jsonb(NEW) -> 'status_pagamento') IS DISTINCT FROM (to_jsonb(OLD) -> 'status_pagamento')
      OR (to_jsonb(NEW) -> 'forma_pagamento') IS DISTINCT FROM (to_jsonb(OLD) -> 'forma_pagamento')
    ) THEN
      RAISE EXCEPTION 'Permissão finance.update obrigatória' USING ERRCODE = '42501';
    END IF;
    RETURN NEW;
  END IF;

  IF can_update_production THEN
    allowed_columns := allowed_columns || ARRAY[
      'status',
      'corte_cortador', 'corte_inicio_previsto', 'corte_inicio_real',
      'corte_fim_previsto', 'corte_fim_real', 'corte_consumo_tecido',
      'corte_codigo_ribana', 'corte_consumo_ribana', 'corte_codigo_gola',
      'corte_consumo_gola', 'corte_situacao', 'corte_observacoes',
      'sublimacao_status', 'sublimacao_inicio', 'sublimacao_fim', 'sublimacao_obs',
      'bordado_status', 'bordado_inicio', 'bordado_fim', 'bordado_obs',
      'embalagem_status', 'embalagem_inicio_real', 'embalagem_fim_real',
      'embalagem_data_nf', 'embalagem_numero_nf', 'embalagem_defeitos',
      'embalagem_situacao', 'embalagem_observacoes'
    ];
  END IF;

  IF can_update_workshops THEN
    IF NEW.status IS DISTINCT FROM OLD.status
       AND NEW.status NOT IN ('costura', 'acabamento') THEN
      RAISE EXCEPTION 'Oficinas só podem mover pedidos entre costura e acabamento'
        USING ERRCODE = '42501';
    END IF;
    allowed_columns := allowed_columns || ARRAY['status'];
  END IF;

  IF can_update_finance THEN
    allowed_columns := allowed_columns || ARRAY[
      'valor_entrada', 'valor_pago_adicional', 'status_pagamento', 'forma_pagamento'
    ];
  END IF;

  IF can_cancel_orders THEN
    allowed_columns := allowed_columns || ARRAY['status', 'observacoes'];
  END IF;

  IF (to_jsonb(NEW) - allowed_columns) IS DISTINCT FROM (to_jsonb(OLD) - allowed_columns) THEN
    RAISE EXCEPTION 'Alteração fora do escopo das permissões do usuário'
      USING ERRCODE = '42501';
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS pedidos_enforce_update_scope ON public.pedidos;
CREATE TRIGGER pedidos_enforce_update_scope
BEFORE UPDATE ON public.pedidos
FOR EACH ROW EXECUTE FUNCTION public.enforce_pedidos_update_scope();

REVOKE ALL ON FUNCTION public.enforce_pedidos_update_scope()
FROM PUBLIC, anon, authenticated;

CREATE OR REPLACE FUNCTION public.enforce_envios_oficina_write_scope()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = pg_catalog, public
AS $$
BEGIN
  IF (SELECT auth.uid()) IS NULL
     AND current_user IN ('postgres', 'supabase_admin', 'service_role') THEN
    RETURN COALESCE(NEW, OLD);
  END IF;

  IF NOT (
    public.has_permission('production.update')
    OR public.has_permission('workshops.update')
  ) THEN
    RAISE EXCEPTION 'Permissão de produção ou oficinas obrigatória'
      USING ERRCODE = '42501';
  END IF;

  RETURN COALESCE(NEW, OLD);
END;
$$;

DROP TRIGGER IF EXISTS envios_oficina_enforce_write_scope ON public.envios_oficina;
CREATE TRIGGER envios_oficina_enforce_write_scope
BEFORE INSERT OR UPDATE OR DELETE ON public.envios_oficina
FOR EACH ROW EXECUTE FUNCTION public.enforce_envios_oficina_write_scope();

REVOKE ALL ON FUNCTION public.enforce_envios_oficina_write_scope()
FROM PUBLIC, anon, authenticated;

DO $$
DECLARE
  target_function record;
BEGIN
  FOR target_function IN
    SELECT
      n.nspname,
      p.proname,
      pg_get_function_identity_arguments(p.oid) AS arguments
    FROM pg_proc p
    JOIN pg_namespace n ON n.oid = p.pronamespace
    WHERE n.nspname = 'public'
      AND p.proname = 'criar_envio_oficina_seguro'
  LOOP
    EXECUTE format(
      'ALTER FUNCTION %I.%I(%s) SET search_path TO pg_catalog, public',
      target_function.nspname,
      target_function.proname,
      target_function.arguments
    );
    EXECUTE format(
      'REVOKE ALL ON FUNCTION %I.%I(%s) FROM PUBLIC, anon',
      target_function.nspname,
      target_function.proname,
      target_function.arguments
    );
    EXECUTE format(
      'GRANT EXECUTE ON FUNCTION %I.%I(%s) TO authenticated',
      target_function.nspname,
      target_function.proname,
      target_function.arguments
    );
  END LOOP;
END
$$;

WITH initial_matrix(role_code, permission_codes) AS (
  VALUES
    ('manager', ARRAY[
      'dashboard.view',
      'customers.view', 'customers.create', 'customers.update', 'customers.delete',
      'orders.view', 'orders.create', 'orders.update', 'orders.cancel',
      'production.view', 'production.update',
      'inventory.view', 'purchases.view', 'finance.view',
      'workshops.view', 'workshops.update',
      'crm.view', 'crm.create', 'crm.update', 'crm.delete',
      'quotes.view', 'quotes.create', 'quotes.update', 'quotes.approve',
      'audit.view'
    ]::text[]),
    ('commercial', ARRAY[
      'dashboard.view',
      'customers.view', 'customers.create', 'customers.update',
      'orders.view',
      'crm.view', 'crm.create', 'crm.update',
      'quotes.view', 'quotes.create', 'quotes.update'
    ]::text[]),
    ('salesperson', ARRAY[
      'customers.view', 'customers.create', 'customers.update',
      'orders.view', 'orders.create',
      'crm.view', 'crm.create', 'crm.update',
      'quotes.view', 'quotes.create', 'quotes.update'
    ]::text[]),
    ('production', ARRAY[
      'orders.view', 'production.view', 'production.update',
      'workshops.view', 'workshops.update', 'inventory.view'
    ]::text[]),
    ('inventory', ARRAY[
      'inventory.view', 'inventory.create', 'inventory.update', 'inventory.adjust',
      'purchases.view', 'orders.view'
    ]::text[]),
    ('purchasing', ARRAY[
      'inventory.view', 'purchases.view', 'purchases.create', 'purchases.update',
      'orders.view'
    ]::text[]),
    ('finance', ARRAY[
      'finance.view', 'finance.create', 'finance.update',
      'orders.view', 'customers.view'
    ]::text[])
)
INSERT INTO public.role_permissions (role_id, permission_id)
SELECT r.id, p.id
FROM initial_matrix m
JOIN public.roles r ON r.code = m.role_code
CROSS JOIN LATERAL unnest(m.permission_codes) permission_code
JOIN public.permissions p ON p.code = permission_code
ON CONFLICT (role_id, permission_id) DO NOTHING;
