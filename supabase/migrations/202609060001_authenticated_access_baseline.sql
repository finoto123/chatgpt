-- Baseline transitório do Lote 1: Auth sem RBAC.
--
-- Pré-condições obrigatórias:
--   1. gerar e validar os backups descritos em docs/backup-restore-supabase.md;
--   2. comparar esta lista com o schema real;
--   3. aplicar e testar primeiro em staging.
--
-- Esta migração não foi executada pelo Codex. Ela mantém anon bloqueado e
-- libera as tabelas já confirmadas no código apenas para usuários do Supabase
-- Auth. O Lote 2 deve substituir esta policy ampla por policies por papel.

DO $$
DECLARE
  target_table text;
BEGIN
  FOREACH target_table IN ARRAY ARRAY[
    'clientes',
    'configuracoes_financeiro',
    'envios_dtf',
    'envios_oficina',
    'feriados',
    'itens_pedido',
    'movimentacoes_estoque',
    'oficinas',
    'pedidos',
    'tecidos',
    'vendedores'
  ]
  LOOP
    IF EXISTS (
      SELECT 1
      FROM pg_class c
      JOIN pg_namespace n ON n.oid = c.relnamespace
      WHERE n.nspname = 'public'
        AND c.relname = target_table
        AND c.relkind IN ('r', 'p')
    ) THEN
      EXECUTE format(
        'ALTER TABLE public.%I ENABLE ROW LEVEL SECURITY',
        target_table
      );
      EXECUTE format(
        'REVOKE ALL ON TABLE public.%I FROM PUBLIC, anon',
        target_table
      );
      EXECUTE format(
        'GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE public.%I TO authenticated',
        target_table
      );

      IF NOT EXISTS (
        SELECT 1
        FROM pg_policies
        WHERE schemaname = 'public'
          AND tablename = target_table
          AND policyname = 'authenticated_access_baseline'
      ) THEN
        EXECUTE format(
          'CREATE POLICY authenticated_access_baseline ON public.%I FOR ALL TO authenticated USING ((SELECT auth.uid()) IS NOT NULL) WITH CHECK ((SELECT auth.uid()) IS NOT NULL)',
          target_table
        );
      END IF;
    END IF;
  END LOOP;
END
$$;

-- A aplicação consulta estoque_atual como view. security_invoker faz a view
-- respeitar o RLS das tabelas subjacentes no Postgres 15+.
DO $$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM pg_views
    WHERE schemaname = 'public' AND viewname = 'estoque_atual'
  ) THEN
    ALTER VIEW public.estoque_atual SET (security_invoker = true);
    REVOKE ALL ON TABLE public.estoque_atual FROM PUBLIC, anon;
    GRANT SELECT ON TABLE public.estoque_atual TO authenticated;
  END IF;
END
$$;

-- RPC confirmada no código. Impede chamada anônima direta e mantém o fluxo
-- disponível para Server Actions autenticadas, independentemente da assinatura.
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

-- Storage permanece no fluxo administrativo já existente: o upload usa
-- service_role somente depois de requireUser(). A privacidade do bucket e a
-- migração dos objetos pertencem ao Lote 3.
