import type { Column } from "@/components/dashboard/DataTable";

export type EditableSection =
  "efetivo" | "recursos" | "incendios_diario" | "incendios_acumulado" | "outras_diarias";

export const DASHBOARD_COLUMNS = {
  efetivo: [
    { key: "mun", label: "Município", editable: true },
    { key: "ord", label: "Serv. Ordinário", numeric: true, editable: true },
    { key: "seg", label: "SEG", numeric: true, editable: true },
    { key: "brig", label: "Brigadista", numeric: true, editable: true },
    { key: "total", label: "Total", numeric: true, editable: false },
  ],
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
  outras_diarias: [
    { key: "mun", label: "Município", editable: true },
    { key: "salvamento", label: "Salvamento", numeric: true, editable: true },
    { key: "acidentes", label: "Acidentes", numeric: true, editable: true },
    { key: "aph", label: "APH", numeric: true, editable: true },
    { key: "prevencao", label: "Ação Prevenção", numeric: true, editable: true },
    { key: "servicos", label: "Serviços", numeric: true, editable: true },
    { key: "total", label: "Total do dia", numeric: true, editable: false },
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
    { key: "area", label: "Área (m²)", numeric: true, editable: true },
    { key: "agua", label: "Água (L)", numeric: true, editable: true },
  ],
} as const satisfies Record<string, Column[]>;

export const OCCURRENCES_PREVIEW_LIMIT = 200;
