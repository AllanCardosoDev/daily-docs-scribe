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