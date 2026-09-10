-- TESTE DE INTEGRAÇÃO DESTRUTIVO/REVERSÍVEL PARA STAGING
--
-- 1. Crie cinco usuários exclusivos de teste no Supabase Auth.
-- 2. Substitua os UUIDs abaixo pelos profiles.id correspondentes.
-- 3. Garanta ao menos uma linha em clientes, pedidos, tecidos e
--    configuracoes_financeiro.
-- 4. Execute como proprietário do banco. Tudo roda em uma transação e termina
--    com ROLLBACK. Não execute em produção.

BEGIN;

SELECT set_config('test.no_role_user', '00000000-0000-0000-0000-000000000001', true);
SELECT set_config('test.production_user', '00000000-0000-0000-0000-000000000002', true);
SELECT set_config('test.finance_user', '00000000-0000-0000-0000-000000000003', true);
SELECT set_config('test.inventory_user', '00000000-0000-0000-0000-000000000004', true);
SELECT set_config('test.admin_user', '00000000-0000-0000-0000-000000000005', true);

DO $$
DECLARE
  test_user_id uuid;
BEGIN
  FOREACH test_user_id IN ARRAY ARRAY[
    current_setting('test.no_role_user')::uuid,
    current_setting('test.production_user')::uuid,
    current_setting('test.finance_user')::uuid,
    current_setting('test.inventory_user')::uuid,
    current_setting('test.admin_user')::uuid
  ] LOOP
    IF NOT EXISTS (SELECT 1 FROM public.profiles WHERE id = test_user_id) THEN
      RAISE EXCEPTION 'Crie os usuários de teste e substitua os UUIDs: profile % não existe', test_user_id;
    END IF;
  END LOOP;

  IF NOT EXISTS (SELECT 1 FROM public.clientes)
     OR NOT EXISTS (SELECT 1 FROM public.pedidos)
     OR NOT EXISTS (SELECT 1 FROM public.tecidos)
     OR NOT EXISTS (SELECT 1 FROM public.configuracoes_financeiro) THEN
    RAISE EXCEPTION 'Staging precisa de ao menos uma linha nas quatro tabelas de prova';
  END IF;
END
$$;

UPDATE public.profiles
SET active = true
WHERE id IN (
  current_setting('test.no_role_user')::uuid,
  current_setting('test.production_user')::uuid,
  current_setting('test.finance_user')::uuid,
  current_setting('test.inventory_user')::uuid,
  current_setting('test.admin_user')::uuid
);

DELETE FROM public.user_roles
WHERE user_id IN (
  current_setting('test.no_role_user')::uuid,
  current_setting('test.production_user')::uuid,
  current_setting('test.finance_user')::uuid,
  current_setting('test.inventory_user')::uuid,
  current_setting('test.admin_user')::uuid
);

INSERT INTO public.user_roles(user_id, role_id)
SELECT current_setting('test.production_user')::uuid, id FROM public.roles WHERE code = 'production'
UNION ALL
SELECT current_setting('test.finance_user')::uuid, id FROM public.roles WHERE code = 'finance'
UNION ALL
SELECT current_setting('test.inventory_user')::uuid, id FROM public.roles WHERE code = 'inventory'
UNION ALL
SELECT current_setting('test.admin_user')::uuid, id FROM public.roles WHERE code = 'administrator';

-- Usuário authenticated sem papel: nenhuma leitura financeira ou escrita.
SELECT set_config('request.jwt.claim.sub', current_setting('test.no_role_user'), true);
SELECT set_config('request.jwt.claim.role', 'authenticated', true);
SET LOCAL ROLE authenticated;

DO $$
DECLARE affected integer;
BEGIN
  BEGIN
    PERFORM public.set_user_roles(
      (SELECT auth.uid()),
      ARRAY[(SELECT id FROM public.roles WHERE code = 'administrator')]
    );
    RAISE EXCEPTION 'User assigned Administrator to itself';
  EXCEPTION WHEN insufficient_privilege THEN NULL;
  END;

  BEGIN
    PERFORM public.set_role_permission(
      (SELECT id FROM public.roles WHERE code = 'administrator'),
      (SELECT id FROM public.permissions WHERE code = 'roles.manage'),
      true
    );
    RAISE EXCEPTION 'User changed permission using administrative function';
  EXCEPTION WHEN insufficient_privilege THEN NULL;
  END;

  IF public.has_permission('finance.view') THEN
    RAISE EXCEPTION 'Usuário sem papel recebeu finance.view';
  END IF;
  IF EXISTS (SELECT 1 FROM public.configuracoes_financeiro) THEN
    RAISE EXCEPTION 'Usuário sem papel leu configurações financeiras';
  END IF;

  UPDATE public.tecidos SET descricao = descricao;
  GET DIAGNOSTICS affected = ROW_COUNT;
  IF affected <> 0 THEN RAISE EXCEPTION 'Usuário sem papel editou estoque'; END IF;

  UPDATE public.pedidos SET status = status;
  GET DIAGNOSTICS affected = ROW_COUNT;
  IF affected <> 0 THEN RAISE EXCEPTION 'Usuário sem papel editou pedido'; END IF;

  UPDATE public.clientes SET nome = nome;
  GET DIAGNOSTICS affected = ROW_COUNT;
  IF affected <> 0 THEN RAISE EXCEPTION 'Usuário sem papel editou cliente'; END IF;

  BEGIN
    INSERT INTO public.user_roles(user_id, role_id)
    VALUES ((SELECT auth.uid()), '00000000-0000-0000-0000-000000000000');
    RAISE EXCEPTION 'Usuário alterou user_roles diretamente';
  EXCEPTION WHEN insufficient_privilege THEN NULL;
  END;

  BEGIN
    INSERT INTO public.role_permissions(role_id, permission_id)
    VALUES ('00000000-0000-0000-0000-000000000000', '00000000-0000-0000-0000-000000000000');
    RAISE EXCEPTION 'Usuário alterou role_permissions diretamente';
  EXCEPTION WHEN insufficient_privilege THEN NULL;
  END;

  BEGIN
    PERFORM public.set_user_roles((SELECT auth.uid()), ARRAY[]::uuid[]);
    RAISE EXCEPTION 'Usuário sem permissão chamou função administrativa';
  EXCEPTION WHEN insufficient_privilege THEN NULL;
  END;
END
$$;
RESET ROLE;

-- Produção não vê financeiro nem altera colunas financeiras do pedido.
SELECT set_config('request.jwt.claim.sub', current_setting('test.production_user'), true);
SET LOCAL ROLE authenticated;
DO $$
BEGIN
  IF NOT public.has_permission('production.update') OR public.has_permission('finance.view') THEN
    RAISE EXCEPTION 'Matriz do usuário Produção está incorreta';
  END IF;
  IF EXISTS (SELECT 1 FROM public.configuracoes_financeiro) THEN
    RAISE EXCEPTION 'Produção leu configurações financeiras';
  END IF;
  BEGIN
    UPDATE public.pedidos
    SET valor_entrada = COALESCE(valor_entrada, 0) + 1
    WHERE id = (SELECT id FROM public.pedidos LIMIT 1);
    RAISE EXCEPTION 'Produção alterou valor_entrada';
  EXCEPTION WHEN insufficient_privilege THEN NULL;
  END;
END
$$;
RESET ROLE;

-- Financeiro lê financeiro, mas o trigger impede alteração de produção.
SELECT set_config('request.jwt.claim.sub', current_setting('test.finance_user'), true);
SET LOCAL ROLE authenticated;
DO $$
BEGIN
  IF NOT public.has_permission('finance.view') OR public.has_permission('production.update') THEN
    RAISE EXCEPTION 'Matriz do usuário Financeiro está incorreta';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM public.configuracoes_financeiro) THEN
    RAISE EXCEPTION 'Financeiro não leu configurações financeiras';
  END IF;
  BEGIN
    UPDATE public.pedidos
    SET corte_observacoes = COALESCE(corte_observacoes, '') || ' teste-rbac'
    WHERE id = (SELECT id FROM public.pedidos LIMIT 1);
    RAISE EXCEPTION 'Financeiro alterou campo de produção';
  EXCEPTION WHEN insufficient_privilege THEN NULL;
  END;
END
$$;
RESET ROLE;

-- Estoque possui ajuste/edição e consegue atingir uma linha de tecido.
SELECT set_config('request.jwt.claim.sub', current_setting('test.inventory_user'), true);
SET LOCAL ROLE authenticated;
DO $$
DECLARE affected integer;
BEGIN
  IF NOT public.has_permission('inventory.adjust') THEN
    RAISE EXCEPTION 'Estoque não recebeu inventory.adjust';
  END IF;
  UPDATE public.tecidos
  SET descricao = descricao
  WHERE id = (SELECT id FROM public.tecidos LIMIT 1);
  GET DIAGNOSTICS affected = ROW_COUNT;
  IF affected <> 1 THEN RAISE EXCEPTION 'Estoque não conseguiu editar tecido'; END IF;
END
$$;
RESET ROLE;

-- Torna o usuário admin de teste o único administrador ativo dentro da
-- transação e prova que não pode remover o próprio último acesso.
DELETE FROM public.user_roles ur
USING public.roles r
WHERE ur.role_id = r.id
  AND r.code = 'administrator'
  AND ur.user_id <> current_setting('test.admin_user')::uuid;

SELECT set_config('request.jwt.claim.sub', current_setting('test.admin_user'), true);
SET LOCAL ROLE authenticated;
DO $$
BEGIN
  BEGIN
    PERFORM public.set_profile_active((SELECT auth.uid()), false);
    RAISE EXCEPTION 'Último administrador foi desativado';
  EXCEPTION WHEN raise_exception THEN
    IF SQLERRM = 'Último administrador foi desativado' THEN RAISE; END IF;
  END;

  BEGIN
    PERFORM public.set_user_roles((SELECT auth.uid()), ARRAY[]::uuid[]);
    RAISE EXCEPTION 'Papel do último administrador foi removido';
  EXCEPTION WHEN raise_exception THEN
    IF SQLERRM = 'Papel do último administrador foi removido' THEN RAISE; END IF;
  END;
END
$$;
RESET ROLE;

ROLLBACK;

SELECT 'RBAC integration assertions passed (transaction rolled back)' AS result;
