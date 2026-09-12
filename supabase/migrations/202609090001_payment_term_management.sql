BEGIN;

CREATE TABLE IF NOT EXISTS public.payment_term_templates(
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL UNIQUE,
  description text,
  rules jsonb NOT NULL CHECK(jsonb_typeof(rules)='object' AND jsonb_typeof(rules->'installments')='array'),
  active boolean NOT NULL DEFAULT true,
  created_by uuid REFERENCES public.profiles(id) ON DELETE SET NULL DEFAULT auth.uid(),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.payment_term_templates ENABLE ROW LEVEL SECURITY;

GRANT SELECT, INSERT, UPDATE ON public.payment_term_templates TO authenticated;

DROP POLICY IF EXISTS payment_terms_insert ON public.payment_term_templates;
DROP POLICY IF EXISTS payment_terms_update ON public.payment_term_templates;
DROP POLICY IF EXISTS payment_terms_settings_select ON public.payment_term_templates;

CREATE POLICY payment_terms_settings_select
ON public.payment_term_templates
FOR SELECT
TO authenticated
USING (
  public.has_permission('settings.manage')
  OR public.has_permission('crm.delete')
  OR public.has_permission('quotes.view')
);

CREATE POLICY payment_terms_insert
ON public.payment_term_templates
FOR INSERT
TO authenticated
WITH CHECK (
  public.has_permission('settings.manage')
  OR public.has_permission('crm.delete')
);

CREATE POLICY payment_terms_update
ON public.payment_term_templates
FOR UPDATE
TO authenticated
USING (
  public.has_permission('settings.manage')
  OR public.has_permission('crm.delete')
)
WITH CHECK (
  public.has_permission('settings.manage')
  OR public.has_permission('crm.delete')
);

COMMIT;
