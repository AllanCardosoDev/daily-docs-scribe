-- ============================================================
-- SCHEMA COMPLETO — Painel Sala de Situação (CBMAM)
-- Gerado a partir do histórico de migrações do projeto.
-- Execute este arquivo inteiro no SQL Editor do SEU projeto Supabase.
-- ============================================================


-- ---------- 20260708164732_32ddd7f2-acde-4a9d-aaa1-8b895d95ecc8.sql ----------

-- Enum de papéis
CREATE TYPE public.app_role AS ENUM ('admin', 'editor', 'viewer');

-- ─── profiles ────────────────────────────────────────────────
CREATE TABLE public.profiles (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  email TEXT,
  display_name TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE ON public.profiles TO authenticated;
GRANT ALL ON public.profiles TO service_role;
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
CREATE POLICY "profiles read all authenticated" ON public.profiles FOR SELECT TO authenticated USING (true);
CREATE POLICY "profiles update own" ON public.profiles FOR UPDATE TO authenticated USING (auth.uid() = id) WITH CHECK (auth.uid() = id);

-- ─── user_roles ──────────────────────────────────────────────
CREATE TABLE public.user_roles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  role public.app_role NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(user_id, role)
);
GRANT SELECT ON public.user_roles TO authenticated;
GRANT ALL ON public.user_roles TO service_role;
ALTER TABLE public.user_roles ENABLE ROW LEVEL SECURITY;

-- has_role (security definer, evita recursão em policies)
CREATE OR REPLACE FUNCTION public.has_role(_user_id UUID, _role public.app_role)
RETURNS BOOLEAN LANGUAGE SQL STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (SELECT 1 FROM public.user_roles WHERE user_id = _user_id AND role = _role);
$$;

CREATE POLICY "roles read own" ON public.user_roles FOR SELECT TO authenticated USING (auth.uid() = user_id OR public.has_role(auth.uid(), 'admin'));
CREATE POLICY "roles admin manage" ON public.user_roles FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'admin'))
  WITH CHECK (public.has_role(auth.uid(), 'admin'));

-- ─── app_config ──────────────────────────────────────────────
CREATE TABLE public.app_config (
  id INT PRIMARY KEY DEFAULT 1 CHECK (id = 1),
  apps_script_url TEXT,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_by UUID REFERENCES auth.users(id)
);
INSERT INTO public.app_config (id, apps_script_url) VALUES (1, NULL);
GRANT SELECT ON public.app_config TO authenticated;
GRANT ALL ON public.app_config TO service_role;
ALTER TABLE public.app_config ENABLE ROW LEVEL SECURITY;
CREATE POLICY "config read authenticated" ON public.app_config FOR SELECT TO authenticated USING (true);
CREATE POLICY "config admin update" ON public.app_config FOR UPDATE TO authenticated
  USING (public.has_role(auth.uid(), 'admin'))
  WITH CHECK (public.has_role(auth.uid(), 'admin'));

-- ─── Trigger de novo usuário: cria profile + papel ──────────
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  is_first BOOLEAN;
BEGIN
  INSERT INTO public.profiles (id, email, display_name)
  VALUES (NEW.id, NEW.email, COALESCE(NEW.raw_user_meta_data->>'display_name', NEW.raw_user_meta_data->>'full_name', split_part(NEW.email, '@', 1)))
  ON CONFLICT (id) DO NOTHING;

  SELECT NOT EXISTS (SELECT 1 FROM public.user_roles) INTO is_first;
  INSERT INTO public.user_roles (user_id, role)
  VALUES (NEW.id, CASE WHEN is_first THEN 'admin'::public.app_role ELSE 'viewer'::public.app_role end)
  ON CONFLICT (user_id, role) DO NOTHING;

  RETURN NEW;
END;
$$;

CREATE TRIGGER on_auth_user_created
AFTER INSERT ON auth.users
FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- updated_at trigger
CREATE OR REPLACE FUNCTION public.touch_updated_at()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN NEW.updated_at = now(); RETURN NEW; END;
$$;
CREATE TRIGGER profiles_touch BEFORE UPDATE ON public.profiles FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();
CREATE TRIGGER app_config_touch BEFORE UPDATE ON public.app_config FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();


-- ---------- 20260708164753_11ffd77b-bd15-497e-b8c2-8dfffa31f66b.sql ----------

CREATE OR REPLACE FUNCTION public.touch_updated_at()
RETURNS TRIGGER LANGUAGE plpgsql SET search_path = public AS $$
BEGIN NEW.updated_at = now(); RETURN NEW; END;
$$;

REVOKE EXECUTE ON FUNCTION public.has_role(UUID, public.app_role) FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.handle_new_user() FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.touch_updated_at() FROM PUBLIC, anon, authenticated;


-- ---------- 20260708164804_920fffc9-1c96-441f-88a3-2b8abc5231ab.sql ----------
GRANT EXECUTE ON FUNCTION public.has_role(UUID, public.app_role) TO authenticated;

-- ---------- 20260708230707_9235582d-1d3d-4d71-b35b-864abf82c201.sql ----------
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

-- ---------- 20260709001756_ff05dd61-4d86-47f4-84c7-a037483ab9f1.sql ----------

CREATE TABLE public.report_data (
  id INTEGER PRIMARY KEY DEFAULT 1 CHECK (id = 1),
  data JSONB NOT NULL DEFAULT '{}'::jsonb,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_by UUID
);

GRANT SELECT ON public.report_data TO authenticated;
GRANT UPDATE ON public.report_data TO authenticated;
GRANT ALL ON public.report_data TO service_role;

ALTER TABLE public.report_data ENABLE ROW LEVEL SECURITY;

CREATE POLICY "report read authenticated"
  ON public.report_data FOR SELECT
  TO authenticated USING (true);

CREATE POLICY "report editors update"
  ON public.report_data FOR UPDATE
  TO authenticated
  USING (public.has_role(auth.uid(),'admin') OR public.has_role(auth.uid(),'editor'))
  WITH CHECK (public.has_role(auth.uid(),'admin') OR public.has_role(auth.uid(),'editor'));

CREATE TRIGGER report_data_touch
  BEFORE UPDATE ON public.report_data
  FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();

INSERT INTO public.report_data (id, data) VALUES (
  1,
  jsonb_build_object(
    'header', jsonb_build_object(
      'titulo','Operação Amazonas + Verde',
      'periodo','06/JUL/2026 08h00 → 07/JUL/2026 08h00',
      'coordenador','TC QOBM Ferreira',
      'subcomandante','CEL QOBM Borges'
    ),
    'efetivo', '[
      {"mun":"Manaus","ord":108,"seg":8,"brig":0},
      {"mun":"Apuí","ord":12,"seg":0,"brig":11},
      {"mun":"Atalaia do Norte","ord":7,"seg":0,"brig":15},
      {"mun":"Autazes","ord":14,"seg":0,"brig":13},
      {"mun":"Barcelos","ord":7,"seg":0,"brig":12},
      {"mun":"Boca do Acre","ord":8,"seg":0,"brig":0},
      {"mun":"Borba","ord":9,"seg":0,"brig":0},
      {"mun":"Canutama","ord":5,"seg":0,"brig":0},
      {"mun":"Careiro","ord":5,"seg":0,"brig":0},
      {"mun":"Coari","ord":12,"seg":0,"brig":0},
      {"mun":"Envira","ord":4,"seg":0,"brig":0},
      {"mun":"Humaitá","ord":18,"seg":0,"brig":1},
      {"mun":"Iranduba","ord":7,"seg":0,"brig":0},
      {"mun":"Itacoatiara","ord":6,"seg":0,"brig":0},
      {"mun":"Itapiranga","ord":6,"seg":0,"brig":12},
      {"mun":"Jutaí","ord":4,"seg":0,"brig":13},
      {"mun":"Lábrea","ord":13,"seg":0,"brig":13},
      {"mun":"Manacapuru","ord":6,"seg":0,"brig":0},
      {"mun":"Manaquiri","ord":14,"seg":0,"brig":7},
      {"mun":"Manicoré","ord":13,"seg":0,"brig":19},
      {"mun":"Maués","ord":11,"seg":0,"brig":13},
      {"mun":"Nhamundá","ord":5,"seg":0,"brig":0},
      {"mun":"Novo Airão","ord":3,"seg":0,"brig":3},
      {"mun":"Novo Aripuanã","ord":12,"seg":0,"brig":0},
      {"mun":"Parintins","ord":7,"seg":0,"brig":0},
      {"mun":"Presidente Figueiredo","ord":6,"seg":0,"brig":0},
      {"mun":"Rio Preto da Eva","ord":5,"seg":0,"brig":17},
      {"mun":"Tabatinga","ord":6,"seg":0,"brig":4},
      {"mun":"Tapauá","ord":13,"seg":0,"brig":17},
      {"mun":"Tefé","ord":4,"seg":0,"brig":4}
    ]'::jsonb,
    'recursos', '[
      {"mun":"Manaus","abt":5,"at":0,"atp":0,"ata":1,"abf":1,"pipa":0,"embarcacao":1,"helicoptero":1}
    ]'::jsonb,
    'incendios_diario', '[
      {"mun":"Total","urb":0,"flor":13,"focos":0}
    ]'::jsonb,
    'incendios_acumulado', '[
      {"mun":"Total","urb":0,"flor":234,"focos":0,"sat":0,"area":0}
    ]'::jsonb,
    'outras_diarias', '[
      {"mun":"Total","salvamento":10,"acidentes":0,"aph":5,"prevencao":1,"servicos":0}
    ]'::jsonb,
    'occurrences', '[]'::jsonb
  )
);


-- ---------- 20260709163008_5ee921fc-2105-4845-851a-bfb6607fc2d2.sql ----------

-- 1) Add optimistic locking version column
ALTER TABLE public.report_data
  ADD COLUMN IF NOT EXISTS version bigint NOT NULL DEFAULT 1;

-- 2) History / audit table
CREATE TABLE IF NOT EXISTS public.report_data_history (
  id bigserial PRIMARY KEY,
  report_id integer NOT NULL,
  version bigint NOT NULL,
  data jsonb NOT NULL,
  updated_by uuid,
  updated_at timestamptz NOT NULL DEFAULT now(),
  change_summary text,
  created_at timestamptz NOT NULL DEFAULT now()
);

-- 3) Grants BEFORE RLS
GRANT SELECT, INSERT ON public.report_data_history TO authenticated;
GRANT USAGE, SELECT ON SEQUENCE public.report_data_history_id_seq TO authenticated;
GRANT ALL ON public.report_data_history TO service_role;
GRANT ALL ON SEQUENCE public.report_data_history_id_seq TO service_role;

-- 4) RLS
ALTER TABLE public.report_data_history ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "history read authenticated" ON public.report_data_history;
CREATE POLICY "history read authenticated"
  ON public.report_data_history
  FOR SELECT
  TO authenticated
  USING (true);

DROP POLICY IF EXISTS "history insert editors" ON public.report_data_history;
CREATE POLICY "history insert editors"
  ON public.report_data_history
  FOR INSERT
  TO authenticated
  WITH CHECK (
    has_role(auth.uid(), 'admin'::app_role)
    OR has_role(auth.uid(), 'editor'::app_role)
  );

-- 5) Snapshot + version bump trigger
CREATE OR REPLACE FUNCTION public.snapshot_report_data()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- Save the OLD (pre-update) row as an audit snapshot
  INSERT INTO public.report_data_history (report_id, version, data, updated_by, updated_at)
  VALUES (OLD.id, OLD.version, OLD.data, OLD.updated_by, OLD.updated_at);

  -- Bump version + refresh timestamp
  NEW.version := OLD.version + 1;
  NEW.updated_at := now();
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS report_data_snapshot ON public.report_data;
CREATE TRIGGER report_data_snapshot
  BEFORE UPDATE ON public.report_data
  FOR EACH ROW
  EXECUTE FUNCTION public.snapshot_report_data();

-- 6) Helpful index for history listings
CREATE INDEX IF NOT EXISTS report_data_history_report_version_idx
  ON public.report_data_history (report_id, version DESC);


-- ---------- 20260709163023_107549b9-8626-45b9-8ac2-8f0e06107706.sql ----------

REVOKE EXECUTE ON FUNCTION public.snapshot_report_data() FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.snapshot_report_data() FROM anon;
REVOKE EXECUTE ON FUNCTION public.snapshot_report_data() FROM authenticated;


-- ---------- 20260711155955_2c093952-c46b-4ce8-83cb-2f5387d23af0.sql ----------

-- Operators
CREATE TABLE public.escala_operators (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  profile_id uuid REFERENCES public.profiles(id) ON DELETE SET NULL,
  rank text NOT NULL DEFAULT '',
  name text NOT NULL,
  phone text NOT NULL DEFAULT '',
  active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (profile_id)
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.escala_operators TO authenticated;
GRANT ALL ON public.escala_operators TO service_role;

ALTER TABLE public.escala_operators ENABLE ROW LEVEL SECURITY;

CREATE POLICY "operators read authenticated"
  ON public.escala_operators FOR SELECT
  TO authenticated USING (true);

CREATE POLICY "operators admin insert"
  ON public.escala_operators FOR INSERT
  TO authenticated WITH CHECK (public.has_role(auth.uid(), 'admin'::public.app_role));

CREATE POLICY "operators admin update"
  ON public.escala_operators FOR UPDATE
  TO authenticated
  USING (public.has_role(auth.uid(), 'admin'::public.app_role))
  WITH CHECK (public.has_role(auth.uid(), 'admin'::public.app_role));

CREATE POLICY "operators admin delete"
  ON public.escala_operators FOR DELETE
  TO authenticated USING (public.has_role(auth.uid(), 'admin'::public.app_role));

CREATE TRIGGER escala_operators_touch
  BEFORE UPDATE ON public.escala_operators
  FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();

-- Shifts
CREATE TABLE public.escala_shifts (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  shift_date date NOT NULL,
  start_time time NOT NULL DEFAULT '14:00',
  end_time time NOT NULL DEFAULT '19:00',
  operator_id uuid NOT NULL REFERENCES public.escala_operators(id) ON DELETE RESTRICT,
  notes text,
  created_by uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX escala_shifts_date_idx ON public.escala_shifts (shift_date);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.escala_shifts TO authenticated;
GRANT ALL ON public.escala_shifts TO service_role;

ALTER TABLE public.escala_shifts ENABLE ROW LEVEL SECURITY;

CREATE POLICY "shifts read authenticated"
  ON public.escala_shifts FOR SELECT
  TO authenticated USING (true);

CREATE POLICY "shifts admin insert"
  ON public.escala_shifts FOR INSERT
  TO authenticated WITH CHECK (public.has_role(auth.uid(), 'admin'::public.app_role));

CREATE POLICY "shifts admin update"
  ON public.escala_shifts FOR UPDATE
  TO authenticated
  USING (public.has_role(auth.uid(), 'admin'::public.app_role))
  WITH CHECK (public.has_role(auth.uid(), 'admin'::public.app_role));

CREATE POLICY "shifts admin delete"
  ON public.escala_shifts FOR DELETE
  TO authenticated USING (public.has_role(auth.uid(), 'admin'::public.app_role));

CREATE TRIGGER escala_shifts_touch
  BEFORE UPDATE ON public.escala_shifts
  FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();


-- ---------- 20260711161408_465e106e-2ba3-4b59-aa2f-51adf5e7577d.sql ----------
CREATE TABLE public.daily_reports (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  report_date date NOT NULL UNIQUE,
  efetivo jsonb NOT NULL DEFAULT '[]'::jsonb,
  recursos jsonb NOT NULL DEFAULT '[]'::jsonb,
  incendios jsonb NOT NULL DEFAULT '[]'::jsonb,
  outras jsonb NOT NULL DEFAULT '[]'::jsonb,
  dados_complementares jsonb NOT NULL DEFAULT '{}'::jsonb,
  notes text,
  version integer NOT NULL DEFAULT 1,
  created_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  updated_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.daily_reports TO authenticated;
GRANT ALL ON public.daily_reports TO service_role;

ALTER TABLE public.daily_reports ENABLE ROW LEVEL SECURITY;

CREATE OR REPLACE FUNCTION public.is_user_scheduled_on(_user_id uuid, _date date)
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

CREATE POLICY "daily_reports_select_authenticated"
ON public.daily_reports FOR SELECT
TO authenticated
USING (true);

CREATE POLICY "daily_reports_insert_editors"
ON public.daily_reports FOR INSERT
TO authenticated
WITH CHECK (
  public.has_role(auth.uid(), 'admin')
  OR public.has_role(auth.uid(), 'editor')
);

CREATE POLICY "daily_reports_update_scoped"
ON public.daily_reports FOR UPDATE
TO authenticated
USING (
  public.has_role(auth.uid(), 'admin')
  OR (
    public.has_role(auth.uid(), 'editor')
    AND (
      created_by = auth.uid()
      OR public.is_user_scheduled_on(auth.uid(), report_date)
    )
  )
)
WITH CHECK (
  public.has_role(auth.uid(), 'admin')
  OR (
    public.has_role(auth.uid(), 'editor')
    AND (
      created_by = auth.uid()
      OR public.is_user_scheduled_on(auth.uid(), report_date)
    )
  )
);

CREATE POLICY "daily_reports_delete_admin"
ON public.daily_reports FOR DELETE
TO authenticated
USING (public.has_role(auth.uid(), 'admin'));

CREATE OR REPLACE FUNCTION public.bump_daily_report_version()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  NEW.version := COALESCE(OLD.version, 0) + 1;
  NEW.updated_at := now();
  RETURN NEW;
END;
$$;

CREATE TRIGGER daily_reports_bump
BEFORE UPDATE ON public.daily_reports
FOR EACH ROW
EXECUTE FUNCTION public.bump_daily_report_version();

CREATE INDEX daily_reports_date_idx ON public.daily_reports (report_date DESC);


-- ---------- 20260711161425_d73a2e18-7da7-4313-aa62-3bce10726c01.sql ----------
REVOKE EXECUTE ON FUNCTION public.is_user_scheduled_on(uuid, date) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.is_user_scheduled_on(uuid, date) TO service_role;

-- ---------- 20260711162029_e5fb55da-8938-4577-93dc-4a291e9e1fd4.sql ----------
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


-- ---------- 20260713155723_26b3fc51-feae-4f85-8f9e-9dc55a0e700e.sql ----------
GRANT EXECUTE ON FUNCTION public.is_user_scheduled_on(uuid, date) TO authenticated;

-- ---------- 20260713174311_0b313121-d1f1-4d36-9b64-75ed33b60900.sql ----------

DROP POLICY IF EXISTS daily_reports_select_authenticated ON public.daily_reports;
CREATE POLICY daily_reports_select_scoped ON public.daily_reports
  FOR SELECT TO authenticated
  USING (
    public.has_role(auth.uid(), 'admin'::public.app_role)
    OR public.has_role(auth.uid(), 'editor'::public.app_role)
    OR public.has_role(auth.uid(), 'viewer'::public.app_role)
  );

DROP POLICY IF EXISTS "operators read authenticated" ON public.escala_operators;
CREATE POLICY "operators read scoped" ON public.escala_operators
  FOR SELECT TO authenticated
  USING (
    public.has_role(auth.uid(), 'admin'::public.app_role)
    OR public.has_role(auth.uid(), 'editor'::public.app_role)
    OR public.has_role(auth.uid(), 'viewer'::public.app_role)
  );

DROP POLICY IF EXISTS "shifts read authenticated" ON public.escala_shifts;
CREATE POLICY "shifts read scoped" ON public.escala_shifts
  FOR SELECT TO authenticated
  USING (
    public.has_role(auth.uid(), 'admin'::public.app_role)
    OR public.has_role(auth.uid(), 'editor'::public.app_role)
    OR public.has_role(auth.uid(), 'viewer'::public.app_role)
  );


-- ---------- 20260729164447_687e6222-ad18-4873-82b3-c46f02ec9ada.sql ----------
CREATE TABLE public.daily_reports_history (
  id bigserial PRIMARY KEY,
  report_id uuid NOT NULL,
  report_date date NOT NULL,
  version integer NOT NULL,
  data jsonb NOT NULL,
  changed_by uuid,
  changed_at timestamptz NOT NULL DEFAULT now(),
  operation text NOT NULL DEFAULT 'update'
);

CREATE INDEX daily_reports_history_date_idx ON public.daily_reports_history (report_date, version DESC);

GRANT SELECT ON public.daily_reports_history TO authenticated;
GRANT ALL ON public.daily_reports_history TO service_role;

ALTER TABLE public.daily_reports_history ENABLE ROW LEVEL SECURITY;

CREATE POLICY "daily history read admin"
  ON public.daily_reports_history FOR SELECT TO authenticated
  USING (public.has_role(auth.uid(), 'admin'::public.app_role));

CREATE OR REPLACE FUNCTION public.snapshot_daily_report()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
BEGIN
  IF TG_OP = 'INSERT' THEN
    INSERT INTO public.daily_reports_history (report_id, report_date, version, data, changed_by, changed_at, operation)
    VALUES (
      NEW.id, NEW.report_date, NEW.version,
      jsonb_build_object('efetivo', NEW.efetivo, 'recursos', NEW.recursos, 'incendios', NEW.incendios, 'outras', NEW.outras, 'notes', NEW.notes),
      COALESCE(NEW.updated_by, NEW.created_by), now(), 'insert'
    );
    RETURN NEW;
  END IF;

  INSERT INTO public.daily_reports_history (report_id, report_date, version, data, changed_by, changed_at, operation)
  VALUES (
    NEW.id, NEW.report_date, NEW.version,
    jsonb_build_object('efetivo', NEW.efetivo, 'recursos', NEW.recursos, 'incendios', NEW.incendios, 'outras', NEW.outras, 'notes', NEW.notes),
    NEW.updated_by, now(), 'update'
  );
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS daily_reports_bump_version ON public.daily_reports;
CREATE TRIGGER daily_reports_bump_version
  BEFORE UPDATE ON public.daily_reports
  FOR EACH ROW EXECUTE FUNCTION public.bump_daily_report_version();

DROP TRIGGER IF EXISTS daily_reports_snapshot ON public.daily_reports;
CREATE TRIGGER daily_reports_snapshot
  AFTER INSERT OR UPDATE ON public.daily_reports
  FOR EACH ROW EXECUTE FUNCTION public.snapshot_daily_report();

-- ---------- 20260729164507_864bbaa7-7695-4323-b40c-e5bf844cc36f.sql ----------
REVOKE ALL ON FUNCTION public.snapshot_daily_report() FROM PUBLIC, anon, authenticated;

-- ---------- 20260729170629_675d5cbd-c4ff-4672-8299-5b5808b4f52b.sql ----------
DO $$ BEGIN
  CREATE TYPE public.report_shift AS ENUM ('noturno','parcial');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

ALTER TABLE public.daily_reports
  ADD COLUMN IF NOT EXISTS shift public.report_shift NOT NULL DEFAULT 'noturno';

ALTER TABLE public.daily_reports DROP CONSTRAINT IF EXISTS daily_reports_report_date_key;
DROP INDEX IF EXISTS public.daily_reports_report_date_key;
CREATE UNIQUE INDEX IF NOT EXISTS daily_reports_date_shift_key
  ON public.daily_reports (report_date, shift);

ALTER TABLE public.daily_reports_history
  ADD COLUMN IF NOT EXISTS shift public.report_shift NOT NULL DEFAULT 'noturno';

CREATE OR REPLACE FUNCTION public.snapshot_daily_report()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
BEGIN
  IF TG_OP = 'INSERT' THEN
    INSERT INTO public.daily_reports_history (report_id, report_date, shift, version, data, changed_by, changed_at, operation)
    VALUES (
      NEW.id, NEW.report_date, NEW.shift, NEW.version,
      jsonb_build_object('efetivo', NEW.efetivo, 'recursos', NEW.recursos, 'incendios', NEW.incendios, 'outras', NEW.outras, 'notes', NEW.notes),
      COALESCE(NEW.updated_by, NEW.created_by), now(), 'insert'
    );
    RETURN NEW;
  END IF;

  INSERT INTO public.daily_reports_history (report_id, report_date, shift, version, data, changed_by, changed_at, operation)
  VALUES (
    NEW.id, NEW.report_date, NEW.shift, NEW.version,
    jsonb_build_object('efetivo', NEW.efetivo, 'recursos', NEW.recursos, 'incendios', NEW.incendios, 'outras', NEW.outras, 'notes', NEW.notes),
    NEW.updated_by, now(), 'update'
  );
  RETURN NEW;
END;
$function$;

-- ---------- 20260729171144_0db8bffb-8f85-49f4-9aa4-a41a5400404d.sql ----------
CREATE TABLE public.municipios (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  active boolean NOT NULL DEFAULT true,
  created_by uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX municipios_name_unique ON public.municipios (lower(btrim(name)));

GRANT SELECT, INSERT, UPDATE, DELETE ON public.municipios TO authenticated;
GRANT ALL ON public.municipios TO service_role;

ALTER TABLE public.municipios ENABLE ROW LEVEL SECURITY;

CREATE POLICY "municipios read scoped" ON public.municipios
  FOR SELECT TO authenticated
  USING (
    has_role(auth.uid(), 'admin'::app_role)
    OR has_role(auth.uid(), 'editor'::app_role)
    OR has_role(auth.uid(), 'viewer'::app_role)
  );

CREATE POLICY "municipios admin insert" ON public.municipios
  FOR INSERT TO authenticated
  WITH CHECK (has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "municipios admin update" ON public.municipios
  FOR UPDATE TO authenticated
  USING (has_role(auth.uid(), 'admin'::app_role))
  WITH CHECK (has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "municipios admin delete" ON public.municipios
  FOR DELETE TO authenticated
  USING (has_role(auth.uid(), 'admin'::app_role));

CREATE TRIGGER municipios_touch_updated_at
  BEFORE UPDATE ON public.municipios
  FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();

INSERT INTO public.municipios (name)
SELECT DISTINCT btrim(m.mun)
FROM public.daily_reports r
CROSS JOIN LATERAL (
  SELECT jsonb_array_elements(r.efetivo || r.recursos || r.incendios || r.outras) AS item
) x
CROSS JOIN LATERAL (SELECT x.item->>'mun' AS mun) m
WHERE m.mun IS NOT NULL AND btrim(m.mun) <> ''
ON CONFLICT DO NOTHING;

-- ---------- 20260729193052_a0a227a7-50c0-4679-af33-33b612c73748.sql ----------
-- 1. Least privilege: anonymous visitors get nothing
REVOKE ALL ON ALL TABLES IN SCHEMA public FROM anon;
REVOKE ALL ON ALL SEQUENCES IN SCHEMA public FROM anon;

-- 2. Least privilege for authenticated role (RLS still applies on top)
REVOKE ALL ON public.app_config FROM authenticated;
GRANT SELECT, UPDATE ON public.app_config TO authenticated;

REVOKE ALL ON public.report_data FROM authenticated;
GRANT SELECT, UPDATE ON public.report_data TO authenticated;

REVOKE ALL ON public.report_data_history FROM authenticated;
GRANT SELECT, INSERT ON public.report_data_history TO authenticated;

REVOKE ALL ON public.daily_reports_history FROM authenticated;
GRANT SELECT ON public.daily_reports_history TO authenticated;

REVOKE ALL ON public.profiles FROM authenticated;
GRANT SELECT, INSERT, UPDATE ON public.profiles TO authenticated;

REVOKE ALL ON public.user_roles FROM authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.user_roles TO authenticated;

-- service_role keeps full access for server-side maintenance
GRANT ALL ON ALL TABLES IN SCHEMA public TO service_role;
GRANT ALL ON ALL SEQUENCES IN SCHEMA public TO service_role;

-- 3. Remove redundant duplicate trigger
DROP TRIGGER IF EXISTS daily_reports_bump ON public.daily_reports;

-- 4. Indexes for foreign keys / hot lookups
CREATE INDEX IF NOT EXISTS escala_shifts_operator_idx ON public.escala_shifts (operator_id);
CREATE INDEX IF NOT EXISTS daily_reports_history_report_idx ON public.daily_reports_history (report_id, version DESC);
CREATE INDEX IF NOT EXISTS daily_reports_created_by_idx ON public.daily_reports (created_by);
CREATE INDEX IF NOT EXISTS report_data_history_updated_by_idx ON public.report_data_history (updated_by);
CREATE INDEX IF NOT EXISTS escala_operators_profile_active_idx ON public.escala_operators (active, name);

-- ---------- 20260730001824_74e9c035-bce7-494f-bff7-a989d0e27643.sql ----------
-- Data API grants (RLS policies already restrict per role)
GRANT SELECT, INSERT, UPDATE, DELETE ON public.daily_reports TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.municipios TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.escala_operators TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.escala_shifts TO authenticated;
GRANT SELECT, UPDATE ON public.app_config TO authenticated;
GRANT SELECT, UPDATE ON public.report_data TO authenticated;
GRANT SELECT, INSERT, UPDATE ON public.profiles TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.user_roles TO authenticated;
GRANT SELECT ON public.daily_reports_history TO authenticated;
GRANT SELECT, INSERT ON public.report_data_history TO authenticated;

GRANT ALL ON public.daily_reports TO service_role;
GRANT ALL ON public.daily_reports_history TO service_role;
GRANT ALL ON public.municipios TO service_role;
GRANT ALL ON public.escala_operators TO service_role;
GRANT ALL ON public.escala_shifts TO service_role;
GRANT ALL ON public.app_config TO service_role;
GRANT ALL ON public.report_data TO service_role;
GRANT ALL ON public.report_data_history TO service_role;
GRANT ALL ON public.profiles TO service_role;
GRANT ALL ON public.user_roles TO service_role;

GRANT USAGE, SELECT ON SEQUENCE public.daily_reports_history_id_seq TO authenticated;
GRANT USAGE, SELECT ON SEQUENCE public.report_data_history_id_seq TO authenticated;
GRANT ALL ON SEQUENCE public.daily_reports_history_id_seq TO service_role;
GRANT ALL ON SEQUENCE public.report_data_history_id_seq TO service_role;

GRANT EXECUTE ON FUNCTION public.has_role(uuid, public.app_role) TO authenticated;
GRANT EXECUTE ON FUNCTION public.is_user_scheduled_on(uuid, date) TO authenticated;
