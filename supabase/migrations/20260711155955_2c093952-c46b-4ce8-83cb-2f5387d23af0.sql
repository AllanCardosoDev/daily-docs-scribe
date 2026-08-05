
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
