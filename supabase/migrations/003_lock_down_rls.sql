-- ============================================================
-- MIGRACAO: Trava o RLS aberto (allow_all) em todas as tabelas
-- Execute no Supabase SQL Editor.
--
-- Contexto: o app agora acessa o Supabase pelo lado do servidor
-- (Server Components / Server Actions) usando a service_role key,
-- que ignora RLS. A anon key (NEXT_PUBLIC_SUPABASE_ANON_KEY) vai
-- para o browser de qualquer visitante do site — antes desta
-- migracao, as policies "allow_all" (USING true, WITH CHECK true)
-- permitiam ler/inserir/apagar QUALQUER linha de QUALQUER tabela
-- direto pela REST API do Supabase, sem passar pela validacao Zod
-- do Next.js. Confirmado explorável em teste de penetração local
-- (curl com a anon key conseguiu INSERT/DELETE arbitrários).
--
-- Esta migracao:
--   1. Remove todas as policies existentes de cada tabela do
--      schema public (inclusive "allow_all").
--   2. Garante RLS habilitado em TODAS as tabelas do schema public
--      — inclusive `vendedores`, que nao tinha RLS habilitado.
--   3. Nao cria nenhuma policy nova: com RLS habilitado e zero
--      policies, anon/authenticated ficam bloqueados por padrao.
--      Apenas a service_role (usada só no servidor) continua
--      lendo/escrevendo, pois service_role ignora RLS.
--   4. Restringe as policies do bucket de storage
--      "pedidos-layouts" para não aceitar mais INSERT/UPDATE/DELETE
--      pela anon key (o upload já é feito via service_role em
--      uploadLayoutPedido). Mantém SELECT público, pois os layouts
--      precisam ser exibidos/impressos publicamente.
-- ============================================================

DO $$
DECLARE
  tbl RECORD;
  pol RECORD;
BEGIN
  FOR tbl IN
    SELECT tablename FROM pg_tables WHERE schemaname = 'public'
  LOOP
    -- Remove todas as policies existentes na tabela (allow_all incluído)
    FOR pol IN
      SELECT policyname FROM pg_policies
      WHERE schemaname = 'public' AND tablename = tbl.tablename
    LOOP
      EXECUTE format('DROP POLICY IF EXISTS %I ON public.%I', pol.policyname, tbl.tablename);
    END LOOP;

    -- Garante RLS habilitado (cobre tabelas que nunca tiveram RLS, ex: vendedores)
    EXECUTE format('ALTER TABLE public.%I ENABLE ROW LEVEL SECURITY', tbl.tablename);
  END LOOP;
END $$;

-- Storage: bucket de layouts de pedidos.
-- SELECT segue público (layouts precisam ser exibidos/impressos).
-- INSERT/UPDATE/DELETE deixam de existir para anon — só service_role
-- (usada em uploadLayoutPedido, que já roda no servidor) continua
-- podendo escrever, pois service_role ignora RLS do storage também.
DROP POLICY IF EXISTS pedidos_layouts_insert ON storage.objects;
DROP POLICY IF EXISTS pedidos_layouts_update ON storage.objects;
DROP POLICY IF EXISTS pedidos_layouts_delete ON storage.objects;
