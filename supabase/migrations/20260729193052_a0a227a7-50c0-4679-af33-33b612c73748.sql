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