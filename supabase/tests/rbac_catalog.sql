-- Execute depois de 202609060002_rbac_and_granular_rls.sql em staging.
-- O script é somente leitura e falha se a superfície RBAC estiver incompleta
-- ou permissiva demais.

DO $$
DECLARE
  expected_table text;
  missing_permissions integer;
BEGIN
  FOREACH expected_table IN ARRAY ARRAY[
    'profiles', 'roles', 'permissions', 'user_roles', 'role_permissions'
  ] LOOP
    IF to_regclass(format('public.%I', expected_table)) IS NULL THEN
      RAISE EXCEPTION 'Tabela RBAC ausente: %', expected_table;
    END IF;
  END LOOP;

  SELECT count(*) INTO missing_permissions
  FROM (VALUES
    ('dashboard.view'),
    ('customers.view'), ('customers.create'), ('customers.update'), ('customers.delete'),
    ('orders.view'), ('orders.create'), ('orders.update'), ('orders.cancel'),
    ('production.view'), ('production.update'),
    ('inventory.view'), ('inventory.create'), ('inventory.update'), ('inventory.adjust'),
    ('purchases.view'), ('purchases.create'), ('purchases.update'),
    ('finance.view'), ('finance.create'), ('finance.update'),
    ('workshops.view'), ('workshops.update'),
    ('settings.view'), ('settings.manage'),
    ('users.view'), ('users.manage'), ('roles.view'), ('roles.manage'),
    ('audit.view'),
    ('crm.view'), ('crm.create'), ('crm.update'), ('crm.delete'),
    ('quotes.view'), ('quotes.create'), ('quotes.update'), ('quotes.approve')
  ) AS expected(code)
  WHERE NOT EXISTS (SELECT 1 FROM public.permissions p WHERE p.code = expected.code);

  IF missing_permissions <> 0 THEN
    RAISE EXCEPTION '% permissões obrigatórias estão ausentes', missing_permissions;
  END IF;

  IF EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public'
      AND policyname = 'authenticated_access_baseline'
  ) THEN
    RAISE EXCEPTION 'Policy temporária authenticated_access_baseline ainda existe';
  END IF;

  IF EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public'
      AND cmd = 'ALL'
      AND ('authenticated' = ANY(roles) OR 'public' = ANY(roles))
      AND COALESCE(qual, 'true') = 'true'
      AND COALESCE(with_check, 'true') = 'true'
  ) THEN
    RAISE EXCEPTION 'Foi encontrada policy ampla FOR ALL';
  END IF;

  IF has_table_privilege('authenticated', 'public.user_roles', 'INSERT')
     OR has_table_privilege('authenticated', 'public.user_roles', 'UPDATE')
     OR has_table_privilege('authenticated', 'public.user_roles', 'DELETE')
     OR has_table_privilege('authenticated', 'public.role_permissions', 'INSERT')
     OR has_table_privilege('authenticated', 'public.role_permissions', 'UPDATE')
     OR has_table_privilege('authenticated', 'public.role_permissions', 'DELETE') THEN
    RAISE EXCEPTION 'authenticated possui escrita direta em tabelas de autorização';
  END IF;

  IF has_function_privilege('authenticated', 'public.bootstrap_first_administrator(uuid)', 'EXECUTE') THEN
    RAISE EXCEPTION 'bootstrap_first_administrator está exposta a authenticated';
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_proc p
    JOIN pg_namespace n ON n.oid = p.pronamespace
    WHERE n.nspname = 'public'
      AND p.proname IN (
        'has_permission', 'get_my_authorization_context', 'set_profile_active',
        'set_user_roles', 'set_role_permission'
      )
      AND p.prosecdef
      AND p.proconfig @> ARRAY['search_path=pg_catalog, public']
    GROUP BY n.nspname
    HAVING count(*) = 5
  ) THEN
    RAISE EXCEPTION 'Funções SECURITY DEFINER ou search_path não estão endurecidas';
  END IF;
END
$$;

SELECT 'RBAC catalog assertions passed' AS result;
