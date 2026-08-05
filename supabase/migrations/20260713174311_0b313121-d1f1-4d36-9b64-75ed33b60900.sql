
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
