CREATE TABLE public.daily_reports (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  report_date date NOT NULL UNIQUE,
  efetivo jsonb NOT NULL DEFAULT '[]'::jsonb,
  recursos jsonb NOT NULL DEFAULT '[]'::jsonb,
  incendios jsonb NOT NULL DEFAULT '[]'::jsonb,
  outras jsonb NOT NULL DEFAULT '[]'::jsonb,
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
