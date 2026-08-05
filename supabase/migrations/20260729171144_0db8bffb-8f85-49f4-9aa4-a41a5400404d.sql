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