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