-- Execute em staging depois de aplicar 202609070001_audit_storage_security.sql.
-- O script é transacional e não preserva dados de teste.
BEGIN;

DO $$
DECLARE
  log_id uuid;
  payload jsonb;
BEGIN
  SELECT public.write_audit_log(
    NULL, 'test.create', 'security_test', 'fixture',
    NULL,
    '{"safe":"ok","password":"must-not-persist","nested":{"token":"no"}}'::jsonb,
    '{"authorization":"no","suite":"lot3"}'::jsonb
  ) INTO log_id;

  IF log_id IS NULL THEN RAISE EXCEPTION 'audit_log não criou registro'; END IF;
  SELECT new_values INTO payload FROM public.audit_logs WHERE id = log_id;
  IF payload ? 'password' OR (payload -> 'nested') ? 'token' THEN
    RAISE EXCEPTION 'audit_log persistiu segredo';
  END IF;
END
$$;

-- Não existem policies cotidianas de escrita/alteração para usuários.
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public' AND tablename = 'audit_logs'
      AND cmd IN ('INSERT', 'UPDATE', 'DELETE')
  ) THEN
    RAISE EXCEPTION 'audit_logs não está append-only';
  END IF;

  IF EXISTS (
    SELECT 1 FROM storage.buckets
    WHERE id = 'pedidos-layouts' AND public = true
  ) THEN
    RAISE EXCEPTION 'bucket pedidos-layouts continua público';
  END IF;

  IF EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'storage' AND tablename = 'objects'
      AND policyname LIKE 'pedidos_layouts%'
      AND roles @> ARRAY['anon']::name[]
  ) THEN
    RAISE EXCEPTION 'policy do bucket concede acesso anon';
  END IF;
END
$$;

ROLLBACK;
