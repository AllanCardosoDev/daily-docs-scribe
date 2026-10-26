-- Migration: Banco de Dados de Ocorrências (Incêndios) CBMAM
-- Criado a partir da exportação oficial CAD-Ocorrências

CREATE TABLE IF NOT EXISTS public.occurrences (
  id UUID PRIMARY KEY,
  protocolo TEXT,
  data_fato DATE NOT NULL,
  data_str TEXT NOT NULL,
  data_br TEXT NOT NULL,
  horario TEXT NOT NULL,
  municipio TEXT NOT NULL,
  bairro TEXT,
  endereco TEXT NOT NULL,
  natureza TEXT NOT NULL,
  natureza_grupo TEXT,
  focos INTEGER NOT NULL DEFAULT 0,
  area NUMERIC NOT NULL DEFAULT 0,
  agua NUMERIC NOT NULL DEFAULT 0,
  coordenadas TEXT,
  unidade TEXT,
  equipes TEXT,
  narrativa TEXT,
  relato TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Índices de consulta rápida
CREATE INDEX IF NOT EXISTS occurrences_data_idx ON public.occurrences (data_fato DESC);
CREATE INDEX IF NOT EXISTS occurrences_municipio_idx ON public.occurrences (municipio);
CREATE INDEX IF NOT EXISTS occurrences_natureza_idx ON public.occurrences (natureza);

-- Permissões e RLS
GRANT SELECT ON public.occurrences TO authenticated;
GRANT ALL ON public.occurrences TO service_role;

ALTER TABLE public.occurrences ENABLE ROW LEVEL SECURITY;

CREATE POLICY "occurrences_read_authenticated"
  ON public.occurrences FOR SELECT
  TO authenticated USING (true);
