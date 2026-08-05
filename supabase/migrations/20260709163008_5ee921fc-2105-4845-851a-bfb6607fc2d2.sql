
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
