import type { Column } from "@/components/dashboard/DataTable";
export type { Column };

export type EditableSection =
  | "efetivo"
  | "recursos"
  | "incendios_diario"
  | "incendios_acumulado"
  | "outras_diarias";

export const DEFAULT_EFETIVO_COLUMNS: Column[] = [
  { key: "mun", label: "Município", editable: true },
  { key: "cbmam", label: "CBMAM", numeric: true, editable: true },
  { key: "opamv", label: "OPAMV 28/10", numeric: true, editable: true },
  { key: "opam_ref", label: "OPAM REF 21/10", numeric: true, editable: true },
  { key: "inc1", label: "INC 1 29/10", numeric: true, editable: true },
  { key: "inc2", label: "INC 2 17/11", numeric: true, editable: true },
  { key: "inc3", label: "INC 3 30/10", numeric: true, editable: true },
  { key: "cbmsp", label: "CBMSP", numeric: true, editable: true },
  { key: "prevfogo", label: "PREVFOGO", numeric: true, editable: true },
  { key: "fn", label: "FN", numeric: true, editable: true },
  { key: "marinha", label: "Marinha", numeric: true, editable: true },
  { key: "sec", label: "SEC", numeric: true, editable: true },
  { key: "seg", label: "SEG", numeric: true, editable: true },
  { key: "brig_mun", label: "Brig. Mun", numeric: true, editable: true },
  { key: "brig_semas", label: "Brig. SEMA", numeric: true, editable: true },
  { key: "brig", label: "Brig. Total", numeric: true, editable: true },
  { key: "total", label: "Total", numeric: true, editable: false },
];

const EFETIVO_STORAGE_KEY = "cbmam_efetivo_custom_columns";

export function getStoredEfetivoColumns(): Column[] {
  if (typeof window === "undefined") return [...DEFAULT_EFETIVO_COLUMNS];
  try {
    const raw = localStorage.getItem(EFETIVO_STORAGE_KEY);
    if (!raw) return [...DEFAULT_EFETIVO_COLUMNS];
    const parsed = JSON.parse(raw);
    if (Array.isArray(parsed) && parsed.length > 0) return parsed;
  } catch {
    // fallback
  }
  return [...DEFAULT_EFETIVO_COLUMNS];
}

export function saveStoredEfetivoColumns(columns: Column[]): void {
  if (typeof window === "undefined") return;
  try {
    localStorage.setItem(EFETIVO_STORAGE_KEY, JSON.stringify(columns));
  } catch {
    // fallback
  }
}

export const DASHBOARD_COLUMNS = {
  efetivo: DEFAULT_EFETIVO_COLUMNS,
  incendios_diario: [
    { key: "mun", label: "Município", editable: true },
    { key: "urb", label: "Inc. Urbano", numeric: true, editable: true },
    { key: "flor", label: "Inc. Florestal", numeric: true, editable: true },
    { key: "focos", label: "Focos combatidos", numeric: true, editable: true },
    { key: "total", label: "Total do dia", numeric: true, editable: false },
  ],
  incendios_acumulado: [
    { key: "mun", label: "Município", editable: true },
    { key: "urb", label: "Inc. Urbano", numeric: true, editable: true },
    { key: "flor", label: "Inc. Florestal", numeric: true, editable: true },
    { key: "focos", label: "Focos combatidos", numeric: true, editable: true },
    { key: "sat", label: "Focos satélite", numeric: true, editable: true },
    { key: "area", label: "Área (m²)", numeric: true, editable: true },
  ],
  recursos: [
    { key: "mun", label: "Município", editable: true },
    { key: "abt", label: "ABT", numeric: true, editable: true },
    { key: "at", label: "AT", numeric: true, editable: true },
    { key: "aem", label: "AEM", numeric: true, editable: true },
    { key: "atp", label: "ATP", numeric: true, editable: true },
    { key: "ata", label: "ATA", numeric: true, editable: true },
    { key: "abf", label: "ABF", numeric: true, editable: true },
    { key: "atf", label: "ATF", numeric: true, editable: true },
    { key: "abs", label: "ABS", numeric: true, editable: true },
    { key: "abtf", label: "ABTF", numeric: true, editable: true },
    { key: "pipa", label: "Pipa", numeric: true, editable: true },
    { key: "dosa", label: "DOSA", numeric: true, editable: true },
    { key: "crs", label: "CRS", numeric: true, editable: true },
    { key: "ar", label: "AR", numeric: true, editable: true },
    { key: "ur", label: "UR", numeric: true, editable: true },
    { key: "gse", label: "GSE", numeric: true, editable: true },
    { key: "mt", label: "MT", numeric: true, editable: true },
    { key: "ta", label: "TA", numeric: true, editable: true },
    { key: "quadriciclo", label: "Quadriciclo", numeric: true, editable: true },
    { key: "embarcacao", label: "Embarcação", numeric: true, editable: true },
    { key: "picape_fn", label: "Picape FN", numeric: true, editable: true },
    { key: "picape_muni", label: "Picape MUNI", numeric: true, editable: true },
    { key: "autoarp", label: "Autoarp", numeric: true, editable: true },
    { key: "picape_esfron", label: "Picape ESFRON", numeric: true, editable: true },
    { key: "helicoptero", label: "Helicóptero", numeric: true, editable: true },
    { key: "aviao", label: "Avião", numeric: true, editable: true },
    { key: "jetski", label: "Jet Ski", numeric: true, editable: true },
    { key: "total", label: "Total", numeric: true, editable: false },
  ],
  occurrences: [
    { key: "data", label: "Data", editable: true },
    { key: "municipio", label: "Município", editable: true },
    { key: "horario", label: "Horário", editable: true },
    { key: "natureza", label: "Natureza", editable: true },
    { key: "endereco", label: "Endereço", editable: true },
    { key: "focos", label: "Focos", numeric: true, editable: true },
    { key: "area", label: "Área (m²)", numeric: true, editable: true },
    { key: "agua", label: "Água (L)", numeric: true, editable: true },
  ],
  outras_diarias: [
    { key: "mun", label: "Município", editable: true },
    { key: "salvamento", label: "Salvamento", numeric: true, editable: true },
    { key: "acidentes", label: "Acidentes", numeric: true, editable: true },
    { key: "aph", label: "APH", numeric: true, editable: true },
    { key: "prevencao", label: "Prevenção", numeric: true, editable: true },
    { key: "servicos", label: "Serviços Técnicos", numeric: true, editable: true },
    { key: "total", label: "Total", numeric: true, editable: false },
  ],
} as const satisfies Record<string, Column[]>;

export const OCCURRENCES_PREVIEW_LIMIT = 200;
