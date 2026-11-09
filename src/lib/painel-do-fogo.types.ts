/**
 * Tipos Oficiais para a API do Painel do Fogo — CENSIPAM / SIPAM
 * Swagger: https://panorama.sipam.gov.br/painel-do-fogo/api/swagger
 * Cobertura e foco operacional: Estado do Amazonas (AM)
 */

export interface PainelDoFogoEvento {
  id_evento: number;
  status_evento: "Ativo" | "Em observação" | string;
  dt_minima: string;
  dt_maxima: string;
  dt_ultima_visao: string;
  persistencia_dias: number;
  area_total_evento: number; // Em hectares / km²
  latitude: number;
  longitude: number;
  dominio: string | null;
  pais: string;
  municipio: string | null;
  terra_indigena: string | null;
  unidade_conservacao: string | null;
  quilombola: string | null;
  projeto_assentamento: string | null;
  retangulo_envolvente?: any;
  geom?: any;
}

export interface PainelDoFogoFoco {
  id: number;
  bright_ti4: number;
  bright_ti5: number;
  scan: number;
  track: number;
  acq_date: string;
  acq_time: string;
  satellite: string;
  confidence: string;
  version: string;
  frp: number; // Fire Radiative Power (MW)
  daynight: "D" | "N" | string;
  dt_aquisicao: string;
  satelite: string;
  geom: {
    type: "Point" | string;
    coordinates: [number, number]; // [longitude, latitude]
  };
  municipio_prox?: string;
}

export interface PainelDoFogoPrioridade {
  id_evento: number;
  indice: number;
  indice_referencia: number;
  dt_maxima: string;
  dt_referencia: string;
  variacao_absoluta: number;
  variacao_percentual: number;
  latitude: number;
  longitude: number;
  municipio?: string;
  status?: string;
}

export interface PainelDoFogoDeteccao {
  id_deteccoes: string;
  dt_aquisicao: string;
  satelite: string;
  npontos: number;
  geom?: any;
}

export interface PainelDoFogoCar {
  cod_imovel: string;
  municipio: string;
  estado: string;
  geom?: any;
}

export interface PainelDoFogoMunicipioIbge {
  nome: string;
  estado: string;
  geocodigo: number;
}

export interface RankingMunicipioFogo {
  nome: string;
  focos: number;
  eventos: number;
  area_ha: number;
  persistencia_max: number;
}

export interface AreaProtegidaFogo {
  nome: string;
  eventos_count: number;
  area_ha: number;
  tipo: "UC" | "TI";
}

export interface PainelDoFogoOverviewResponse {
  timestamp: string;
  data_referencia: string;
  horas_filtro: number;
  status_api: "online" | "degraded" | "offline";
  total_focos_am: number;
  total_eventos_am: number;
  eventos_ativos_am: number;
  eventos_observacao_am: number;
  area_total_afetada_ha: number;
  area_total_afetada_km2: number;
  municipio_mais_critico: {
    nome: string;
    focos: number;
    eventos: number;
    area_ha: number;
  };
  ranking_municipios: RankingMunicipioFogo[];
  distribuicao_satelites: Record<string, number>;
  distribuicao_periodo: {
    diurno: number;
    noturno: number;
  };
  distribuicao_dominio: Record<string, number>;
  ucs_afetadas: AreaProtegidaFogo[];
  tis_afetadas: AreaProtegidaFogo[];
  frp_media: number;
  frp_maxima: number;
  eventos: PainelDoFogoEvento[];
  focos: PainelDoFogoFoco[];
  prioridades_am: PainelDoFogoPrioridade[];
  municipios_am: PainelDoFogoMunicipioIbge[];
}
