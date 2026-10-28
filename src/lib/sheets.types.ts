export interface SheetsHeader {
  titulo?: string;
  periodo?: string;
  proximoPeriodo?: string;
  reuniaoPlanejamento?: string;
  reuniaoBriefing?: string;
  comandante?: string;
  chefeCapital?: string;
  chefeInterior?: string;
  coordSituacao?: string;
  coordenador?: string;
  subcomandante?: string;
}

export interface EfetivoRow {
  mun: string;
  ord?: number;
  seg?: number;
  brig?: number;
  // Campos expandidos do XLSX oficial (operação Amazonas + Verde)
  cbmam?: number;
  servico?: number;
  opamv?: number;
  opam_ref?: number;
  inc1?: number;
  inc2?: number;
  inc3?: number;
  cbmsp?: number;
  prevfogo?: number;
  fn?: number;
  marinha?: number;
  sec?: number;
  brig_mun?: number;
  brig_semas?: number;
  total?: number;
  [k: string]: any;
}
export interface RecursosRow {
  mun: string;
  [k: string]: string | number;
}
export interface IncendiosDiarioRow {
  mun: string;
  urb: number;
  flor: number;
  focos: number;
  total_periodo?: number;
}
export interface IncendiosAcumuladoRow {
  mun: string;
  urb: number;
  flor: number;
  focos: number;
  sat: number;
  area: number;
}
export interface OutrasDiariasRow {
  mun: string;
  salvamento: number;
  acidentes: number;
  aph: number;
  prevencao: number;
  servicos: number;
  total_periodo?: number;
}
export interface OccurrenceRow {
  id?: string;
  protocolo?: string;
  data: string;
  municipio: string;
  horario: string;
  natureza: string;
  focos: number;
  coordenadas: string;
  endereco: string;
  area: number;
  agua: number;
  bairro?: string;
  grupoNatureza?: string;
  situacao?: string;
  motivoFinalizacao?: string;
  unidade?: string;
  equipes?: string;
  narrativa?: string;
  relato?: string;
}

export interface SheetsData {
  header: SheetsHeader;
  efetivo: EfetivoRow[];
  recursos: RecursosRow[];
  incendios_diario: IncendiosDiarioRow[];
  incendios_acumulado: IncendiosAcumuladoRow[];
  outras_diarias: OutrasDiariasRow[];
  occurrences: OccurrenceRow[];
  isRange?: boolean;
  startDate?: string;
  endDate?: string;
  custom_columns?: {
    efetivo?: Array<{ key: string; label: string; numeric?: boolean; editable?: boolean }>;
    recursos?: Array<{ key: string; label: string; numeric?: boolean; editable?: boolean }>;
    [key: string]: any;
  };
}

export const EMPTY_SHEETS_DATA: SheetsData = {
  header: {},
  efetivo: [],
  recursos: [],
  incendios_diario: [],
  incendios_acumulado: [],
  outras_diarias: [],
  occurrences: [],
};
