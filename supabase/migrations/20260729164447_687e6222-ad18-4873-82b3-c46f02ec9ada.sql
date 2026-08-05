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