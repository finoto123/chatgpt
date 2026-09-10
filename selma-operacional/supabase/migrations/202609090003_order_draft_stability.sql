-- Rascunhos são incompletos e não devem recalcular o score comercial.
-- O recálculo ocorre quando o pedido é publicado, cancelado ou muda de cliente.

CREATE OR REPLACE FUNCTION public.crm_order_score_trigger()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog, public
AS $$
DECLARE
  opportunity_id uuid;
  old_counts boolean := false;
  new_counts boolean := NEW.status NOT IN ('rascunho', 'cancelado');
BEGIN
  IF TG_OP = 'INSERT' THEN
    IF NOT new_counts OR NEW.cliente_id IS NULL THEN
      RETURN NEW;
    END IF;

    FOR opportunity_id IN
      SELECT o.id
      FROM public.opportunities o
      WHERE o.customer_id = NEW.cliente_id AND o.status = 'open'
    LOOP
      PERFORM public.crm_recalculate_score_internal(opportunity_id);
    END LOOP;
    RETURN NEW;
  END IF;

  old_counts := OLD.status NOT IN ('rascunho', 'cancelado');

  -- Alterações internas no próprio rascunho não afetam o CRM.
  IF NOT old_counts AND NOT new_counts THEN
    RETURN NEW;
  END IF;

  IF old_counts AND OLD.cliente_id IS NOT NULL
     AND (NOT new_counts OR OLD.cliente_id IS DISTINCT FROM NEW.cliente_id) THEN
    FOR opportunity_id IN
      SELECT o.id
      FROM public.opportunities o
      WHERE o.customer_id = OLD.cliente_id AND o.status = 'open'
    LOOP
      PERFORM public.crm_recalculate_score_internal(opportunity_id);
    END LOOP;
  END IF;

  IF new_counts AND NEW.cliente_id IS NOT NULL
     AND (NOT old_counts OR OLD.cliente_id IS DISTINCT FROM NEW.cliente_id) THEN
    FOR opportunity_id IN
      SELECT o.id
      FROM public.opportunities o
      WHERE o.customer_id = NEW.cliente_id AND o.status = 'open'
    LOOP
      PERFORM public.crm_recalculate_score_internal(opportunity_id);
    END LOOP;
  END IF;

  RETURN NEW;
END;
$$;

REVOKE ALL ON FUNCTION public.crm_order_score_trigger()
FROM PUBLIC, anon, authenticated;
