-- ============================================================
-- MIGRACAO: Bucket para layouts anexados aos pedidos
-- Execute no Supabase SQL Editor se o upload de layout falhar.
-- ============================================================

INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'pedidos-layouts',
  'pedidos-layouts',
  true,
  10485760,
  ARRAY['application/pdf', 'image/png', 'image/jpeg', 'image/webp']
)
ON CONFLICT (id) DO UPDATE
SET
  public = EXCLUDED.public,
  file_size_limit = EXCLUDED.file_size_limit,
  allowed_mime_types = EXCLUDED.allowed_mime_types;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'storage'
      AND tablename = 'objects'
      AND policyname = 'pedidos_layouts_select'
  ) THEN
    CREATE POLICY pedidos_layouts_select
      ON storage.objects FOR SELECT
      USING (bucket_id = 'pedidos-layouts');
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'storage'
      AND tablename = 'objects'
      AND policyname = 'pedidos_layouts_insert'
  ) THEN
    CREATE POLICY pedidos_layouts_insert
      ON storage.objects FOR INSERT
      WITH CHECK (bucket_id = 'pedidos-layouts');
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'storage'
      AND tablename = 'objects'
      AND policyname = 'pedidos_layouts_update'
  ) THEN
    CREATE POLICY pedidos_layouts_update
      ON storage.objects FOR UPDATE
      USING (bucket_id = 'pedidos-layouts')
      WITH CHECK (bucket_id = 'pedidos-layouts');
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'storage'
      AND tablename = 'objects'
      AND policyname = 'pedidos_layouts_delete'
  ) THEN
    CREATE POLICY pedidos_layouts_delete
      ON storage.objects FOR DELETE
      USING (bucket_id = 'pedidos-layouts');
  END IF;
END $$;
