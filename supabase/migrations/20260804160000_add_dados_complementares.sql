-- Adiciona a coluna dados_complementares na tabela daily_reports
-- para armazenar os atributos da API de Incêndio Florestal e Vegetação
ALTER TABLE public.daily_reports 
ADD COLUMN IF NOT EXISTS dados_complementares JSONB DEFAULT '{}'::jsonb;

COMMENT ON COLUMN public.daily_reports.dados_complementares IS 'Armazena atributos dinâmicos e complementares de incêndio florestal e vegetação oriundos da API';
