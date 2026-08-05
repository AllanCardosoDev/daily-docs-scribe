
CREATE TABLE public.report_data (
  id INTEGER PRIMARY KEY DEFAULT 1 CHECK (id = 1),
  data JSONB NOT NULL DEFAULT '{}'::jsonb,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_by UUID
);

GRANT SELECT ON public.report_data TO authenticated;
GRANT UPDATE ON public.report_data TO authenticated;
GRANT ALL ON public.report_data TO service_role;

ALTER TABLE public.report_data ENABLE ROW LEVEL SECURITY;

CREATE POLICY "report read authenticated"
  ON public.report_data FOR SELECT
  TO authenticated USING (true);

CREATE POLICY "report editors update"
  ON public.report_data FOR UPDATE
  TO authenticated
  USING (public.has_role(auth.uid(),'admin') OR public.has_role(auth.uid(),'editor'))
  WITH CHECK (public.has_role(auth.uid(),'admin') OR public.has_role(auth.uid(),'editor'));

CREATE TRIGGER report_data_touch
  BEFORE UPDATE ON public.report_data
  FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();

INSERT INTO public.report_data (id, data) VALUES (
  1,
  jsonb_build_object(
    'header', jsonb_build_object(
      'titulo','Operação Amazonas + Verde',
      'periodo','06/JUL/2026 08h00 → 07/JUL/2026 08h00',
      'coordenador','TC QOBM Ferreira',
      'subcomandante','CEL QOBM Borges'
    ),
    'efetivo', '[
      {"mun":"Manaus","ord":108,"seg":8,"brig":0},
      {"mun":"Apuí","ord":12,"seg":0,"brig":11},
      {"mun":"Atalaia do Norte","ord":7,"seg":0,"brig":15},
      {"mun":"Autazes","ord":14,"seg":0,"brig":13},
      {"mun":"Barcelos","ord":7,"seg":0,"brig":12},
      {"mun":"Boca do Acre","ord":8,"seg":0,"brig":0},
      {"mun":"Borba","ord":9,"seg":0,"brig":0},
      {"mun":"Canutama","ord":5,"seg":0,"brig":0},
      {"mun":"Careiro","ord":5,"seg":0,"brig":0},
      {"mun":"Coari","ord":12,"seg":0,"brig":0},
      {"mun":"Envira","ord":4,"seg":0,"brig":0},
      {"mun":"Humaitá","ord":18,"seg":0,"brig":1},
      {"mun":"Iranduba","ord":7,"seg":0,"brig":0},
      {"mun":"Itacoatiara","ord":6,"seg":0,"brig":0},
      {"mun":"Itapiranga","ord":6,"seg":0,"brig":12},
      {"mun":"Jutaí","ord":4,"seg":0,"brig":13},
      {"mun":"Lábrea","ord":13,"seg":0,"brig":13},
      {"mun":"Manacapuru","ord":6,"seg":0,"brig":0},
      {"mun":"Manaquiri","ord":14,"seg":0,"brig":7},
      {"mun":"Manicoré","ord":13,"seg":0,"brig":19},
      {"mun":"Maués","ord":11,"seg":0,"brig":13},
      {"mun":"Nhamundá","ord":5,"seg":0,"brig":0},
      {"mun":"Novo Airão","ord":3,"seg":0,"brig":3},
      {"mun":"Novo Aripuanã","ord":12,"seg":0,"brig":0},
      {"mun":"Parintins","ord":7,"seg":0,"brig":0},
      {"mun":"Presidente Figueiredo","ord":6,"seg":0,"brig":0},
      {"mun":"Rio Preto da Eva","ord":5,"seg":0,"brig":17},
      {"mun":"Tabatinga","ord":6,"seg":0,"brig":4},
      {"mun":"Tapauá","ord":13,"seg":0,"brig":17},
      {"mun":"Tefé","ord":4,"seg":0,"brig":4}
    ]'::jsonb,
    'recursos', '[
      {"mun":"Manaus","abt":5,"at":0,"atp":0,"ata":1,"abf":1,"pipa":0,"embarcacao":1,"helicoptero":1}
    ]'::jsonb,
    'incendios_diario', '[
      {"mun":"Total","urb":0,"flor":13,"focos":0}
    ]'::jsonb,
    'incendios_acumulado', '[
      {"mun":"Total","urb":0,"flor":234,"focos":0,"sat":0,"area":0}
    ]'::jsonb,
    'outras_diarias', '[
      {"mun":"Total","salvamento":10,"acidentes":0,"aph":5,"prevencao":1,"servicos":0}
    ]'::jsonb,
    'occurrences', '[]'::jsonb
  )
);
