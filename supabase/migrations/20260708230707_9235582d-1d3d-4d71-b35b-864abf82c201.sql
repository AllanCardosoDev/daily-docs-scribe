-- 1) profiles: restringir SELECT — usuário lê apenas o próprio perfil; admin lê todos.
DROP POLICY IF EXISTS "profiles read all authenticated" ON public.profiles;

CREATE POLICY "profiles read own"
  ON public.profiles
  FOR SELECT
  TO authenticated
  USING (auth.uid() = id);

CREATE POLICY "profiles read admin"
  ON public.profiles
  FOR SELECT
  TO authenticated
  USING (public.has_role(auth.uid(), 'admin'));

-- 2) has_role: impedir enumeração — só responde para o próprio usuário.
-- As policies de RLS sempre chamam com auth.uid(), então continua funcionando.
CREATE OR REPLACE FUNCTION public.has_role(_user_id uuid, _role public.app_role)
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

-- 3) Índice explícito para lookups por user_id em user_roles
-- (o UNIQUE(user_id, role) já cobre, mas deixamos um índice dedicado para clareza e planner).
CREATE INDEX IF NOT EXISTS user_roles_user_id_idx ON public.user_roles(user_id);