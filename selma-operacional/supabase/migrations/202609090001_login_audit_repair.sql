-- Repara a auditoria de login após instalações parciais das migrations dos Lotes 3 e 6.
-- Aplicar no SQL Editor do Supabase. Não remove registros existentes.

BEGIN;

-- Remove um possível wrapper de sete argumentos criado durante reparos manuais.
-- As chamadas text passam a usar a função canônica abaixo com parâmetros padrão.
DROP FUNCTION IF EXISTS public.write_audit_log(uuid,text,text,text,jsonb,jsonb,jsonb);

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
DECLARE created_id uuid;
BEGIN
  IF _action IS NULL OR length(_action) NOT BETWEEN 1 AND 120
     OR _entity_type IS NULL OR length(_entity_type) NOT BETWEEN 1 AND 120 THEN
    RAISE EXCEPTION 'Evento de auditoria inválido';
  END IF;

  INSERT INTO public.audit_logs(
    user_id, action, entity_type, entity_id, old_values, new_values,
    metadata, ip_address, user_agent
  ) VALUES (
    _user_id, _action, _entity_type, left(_entity_id, 255),
    public.sanitize_audit_json(_old_values),
    public.sanitize_audit_json(_new_values),
    public.sanitize_audit_json(COALESCE(_metadata, '{}'::jsonb)),
    left(_ip_address, 64), left(_user_agent, 512)
  ) RETURNING id INTO created_id;

  RETURN created_id;
END;
$$;

REVOKE ALL ON FUNCTION public.write_audit_log(uuid,text,text,text,jsonb,jsonb,jsonb,text,text)
FROM PUBLIC, anon, authenticated;

CREATE OR REPLACE FUNCTION public.write_audit_log(
  _user_id uuid,
  _action text,
  _entity_type name,
  _entity_id text,
  _old_values jsonb,
  _new_values jsonb,
  _metadata jsonb
)
RETURNS uuid
LANGUAGE sql
SECURITY DEFINER
SET search_path = pg_catalog, public
AS $$
  SELECT public.write_audit_log(
    _user_id, _action, _entity_type::text, _entity_id,
    _old_values, _new_values, _metadata, NULL::text, NULL::text
  );
$$;

REVOKE ALL ON FUNCTION public.write_audit_log(uuid,text,name,text,jsonb,jsonb,jsonb)
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
DECLARE caller_id uuid := auth.uid();
BEGIN
  IF caller_id IS NULL OR NOT EXISTS(
    SELECT 1 FROM public.profiles
    WHERE id = caller_id AND (active OR _action IN ('auth.login', 'auth.logout'))
  ) THEN
    RAISE EXCEPTION 'Usuário não autorizado' USING ERRCODE = '42501';
  END IF;

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
    caller_id, _action, _entity_type::text, _entity_id,
    _old_values, _new_values,
    COALESCE(_metadata, '{}'::jsonb) || jsonb_build_object('source', 'application'),
    _ip_address::text, _user_agent::text
  );
END;
$$;

REVOKE ALL ON FUNCTION public.record_audit_event(text,text,text,jsonb,jsonb,jsonb,text,text)
FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.record_audit_event(text,text,text,jsonb,jsonb,jsonb,text,text)
TO authenticated;

COMMIT;
