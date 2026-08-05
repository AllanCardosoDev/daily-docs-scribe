-- 1) app_config: restringir SELECT a admin apenas
DROP POLICY IF EXISTS "config read authenticated" ON public.app_config;
CREATE POLICY "config read admin"
ON public.app_config FOR SELECT
TO authenticated
USING (public.has_role(auth.uid(), 'admin'::public.app_role));

-- 2) report_data + report_data_history: só usuários com papel atribuído
DROP POLICY IF EXISTS "report read authenticated" ON public.report_data;
CREATE POLICY "report read roled"
ON public.report_data FOR SELECT
TO authenticated
USING (
  public.has_role(auth.uid(), 'admin'::public.app_role)
  OR public.has_role(auth.uid(), 'editor'::public.app_role)
  OR public.has_role(auth.uid(), 'viewer'::public.app_role)
);

DROP POLICY IF EXISTS "history read authenticated" ON public.report_data_history;
CREATE POLICY "history read roled"
ON public.report_data_history FOR SELECT
TO authenticated
USING (
  public.has_role(auth.uid(), 'admin'::public.app_role)
  OR public.has_role(auth.uid(), 'editor'::public.app_role)
  OR public.has_role(auth.uid(), 'viewer'::public.app_role)
);

-- 3) profiles: política explícita de INSERT restrita ao próprio usuário
DROP POLICY IF EXISTS "profiles insert own" ON public.profiles;
CREATE POLICY "profiles insert own"
ON public.profiles FOR INSERT
TO authenticated
WITH CHECK (auth.uid() = id);

-- 4) Mover funções SECURITY DEFINER para esquema privado, com invólucros SECURITY INVOKER no público
CREATE SCHEMA IF NOT EXISTS private;
GRANT USAGE ON SCHEMA private TO authenticated, service_role;

CREATE OR REPLACE FUNCTION private.has_role(_user_id uuid, _role public.app_role)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT CASE
    WHEN _user_id IS DISTINCT FROM auth.uid() THEN false
    ELSE EXISTS (
      SELECT 1 FROM public.user_roles
      WHERE user_id = _user_id AND role = _role
    )
  END;
$$;

CREATE OR REPLACE FUNCTION private.is_user_scheduled_on(_user_id uuid, _date date)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.escala_shifts s
    JOIN public.escala_operators o ON o.id = s.operator_id
    WHERE o.profile_id = _user_id
      AND s.shift_date = _date
  );
$$;

REVOKE ALL ON FUNCTION private.has_role(uuid, public.app_role) FROM PUBLIC;
REVOKE ALL ON FUNCTION private.is_user_scheduled_on(uuid, date) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION private.has_role(uuid, public.app_role) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION private.is_user_scheduled_on(uuid, date) TO authenticated, service_role;

-- Invólucros públicos (SECURITY INVOKER), preservando a assinatura para políticas e código
CREATE OR REPLACE FUNCTION public.has_role(_user_id uuid, _role public.app_role)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY INVOKER
SET search_path = public
AS $$
  SELECT private.has_role(_user_id, _role);
$$;

CREATE OR REPLACE FUNCTION public.is_user_scheduled_on(_user_id uuid, _date date)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY INVOKER
SET search_path = public
AS $$
  SELECT private.is_user_scheduled_on(_user_id, _date);
$$;

REVOKE ALL ON FUNCTION public.is_user_scheduled_on(uuid, date) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.is_user_scheduled_on(uuid, date) TO service_role;
-- has_role wrapper: mantém acesso para políticas RLS e para chamadas RPC do servidor
GRANT EXECUTE ON FUNCTION public.has_role(uuid, public.app_role) TO authenticated, service_role;
