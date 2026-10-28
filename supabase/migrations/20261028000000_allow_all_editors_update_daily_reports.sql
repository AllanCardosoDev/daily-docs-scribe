-- Permite que qualquer usuário com papel de 'admin' ou 'editor' possa atualizar os relatórios diários
DROP POLICY IF EXISTS "daily_reports_update_scoped" ON public.daily_reports;

CREATE POLICY "daily_reports_update_editors"
ON public.daily_reports FOR UPDATE
TO authenticated
USING (
  public.has_role(auth.uid(), 'admin'::public.app_role)
  OR public.has_role(auth.uid(), 'editor'::public.app_role)
)
WITH CHECK (
  public.has_role(auth.uid(), 'admin'::public.app_role)
  OR public.has_role(auth.uid(), 'editor'::public.app_role)
);

