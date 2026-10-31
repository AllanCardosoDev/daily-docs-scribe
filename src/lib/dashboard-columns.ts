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
  { key: "seg", label: "SEG", numeric: true, editable: true },
  { key: "brig_mun", label: "Brig. Mun", numeric: true, editable: true },
  { key: "brig_semas", label: "Brig. SEMA", numeric: true, editable: true },
  { key: "total", label: "Total", numeric: true, editable: false },
];

const CANONICAL_LABELS: Record<string, string> = {
  mun: "Município",
  cbmam: "CBMAM",
  ord: "CBMAM (Ordinário)",
  servico: "Serviço",
  opamv: "OPAMV 28/10",
  opam_ref: "OPAM REF 21/10",
  inc1: "INC 1 29/10",
  inc2: "INC 2 17/11",
  inc3: "INC 3 30/10",
  cbmsp: "CBMSP",
  prevfogo: "PREVFOGO",
  fn: "FN",
  marinha: "Marinha",
  sec: "SEC",
  seg: "SEG",
  brig_mun: "Brig. Mun",
  brig_semas: "Brig. SEMA",
  brig: "Brig. Total",
  total: "Total",
};

export function formatColumnLabel(key: string): string {
  if (CANONICAL_LABELS[key]) return CANONICAL_LABELS[key];
  return key
    .replace(/_/g, " ")
    .replace(/\b\w/g, (c) => c.toUpperCase())
    .trim();
}

/**
 * Sanitiza e remove colunas repetidas ou redundantes do Efetivo:
 * - Remove 'sec' (duplicata de 'seg')
 * - Remove 'brig' (duplicata de 'brig_mun' e 'brig_semas')
 * - Remove 'ord', 'servico', 'serv_ord' (duplicatas de 'cbmam')
 * - Remove metadados internos ('tipo', '_custom', etc.)
 * - Elimina chaves duplicadas e rótulos duplicados
 */
export function sanitizeEfetivoColumns(cols: Column[]): Column[] {
  if (!Array.isArray(cols) || cols.length === 0) {
    return DEFAULT_EFETIVO_COLUMNS.map((c) => ({ ...c }));
  }

  const redundantOrInternalKeys = new Set([
    "sec",
    "brig",
    "ord",
    "servico",
    "serv_ord",
    "cbmam_ord",
    "tipo",
    "_custom",
    "id",
    "created_at",
    "updated_at",
    "shift",
    "report_date",
    "notes",
    "municipio",
  ]);

  const seenKeys = new Set<string>();
  const seenLabels = new Set<string>();
  const sanitized: Column[] = [];

  for (const c of cols) {
    if (!c || !c.key) continue;
    const k = c.key.toLowerCase().trim();
    if (redundantOrInternalKeys.has(k)) continue;

    const normLabel = (c.label || k).toLowerCase().trim();
    if (seenKeys.has(k) || (k !== "mun" && k !== "total" && seenLabels.has(normLabel))) {
      continue;
    }

    seenKeys.add(k);
    if (k !== "mun" && k !== "total") {
      seenLabels.add(normLabel);
    }

    sanitized.push({
      ...c,
      key: k,
      numeric: k === "mun" ? false : c.numeric ?? true,
      editable: k === "total" ? false : c.editable ?? true,
    });
  }

  if (!sanitized.some((c) => c.key === "mun")) {
    sanitized.unshift({ key: "mun", label: "Município", editable: true });
  }

  const totalIdx = sanitized.findIndex((c) => c.key === "total");
  if (totalIdx >= 0) {
    const [tot] = sanitized.splice(totalIdx, 1);
    sanitized.push(tot);
  } else {
    sanitized.push({ key: "total", label: "Total", numeric: true, editable: false });
  }

  return sanitized;
}

/**
 * Deriva dinamicamente as colunas ativas do Efetivo considerando:
 * 1. Colunas salvas (custom_columns persistidas)
 * 2. DEFAULT_EFETIVO_COLUMNS oficial do CBMAM (sem repetições)
 * 3. Chaves adicionais presentes nos objetos das linhas (exceto chaves sinônimas/internas)
 */
export function resolveEfetivoColumns(
  rows: any[] = [],
  savedCustomColumns?: Column[],
): Column[] {
  let baseCols: Column[] = [];

  if (savedCustomColumns && savedCustomColumns.length > 0) {
    baseCols = sanitizeEfetivoColumns(savedCustomColumns);
  } else {
    baseCols = DEFAULT_EFETIVO_COLUMNS.map((c) => ({ ...c }));
  }

  // Chaves internas e sinônimos que NÃO devem gerar colunas duplicadas
  const ignoredKeys = new Set([
    "mun",
    "municipio",
    "total",
    "id",
    "created_at",
    "updated_at",
    "shift",
    "report_date",
    "notes",
    "tipo",
    "_custom",
    "ord",
    "servico",
    "serv_ord",
    "cbmam_ord",
    "sec",
    "brig",
  ]);

  const knownKeys = new Set(baseCols.map((c) => c.key.toLowerCase()));
  const extraKeys: string[] = [];

  for (const r of rows) {
    if (!r || typeof r !== "object") continue;
    for (const rawK of Object.keys(r)) {
      const k = rawK.toLowerCase().trim();
      if (!knownKeys.has(k) && !ignoredKeys.has(k) && !extraKeys.includes(k)) {
        extraKeys.push(k);
      }
    }
  }

  if (extraKeys.length > 0) {
    const extraCols: Column[] = extraKeys.map((k) => ({
      key: k,
      label: formatColumnLabel(k),
      numeric: true,
      editable: true,
    }));

    const totalIdx = baseCols.findIndex((c) => c.key === "total");
    if (totalIdx >= 0) {
      baseCols.splice(totalIdx, 0, ...extraCols);
    } else {
      baseCols.push(...extraCols);
    }
  }

  return sanitizeEfetivoColumns(baseCols);
}

/**
 * Calcula o total de uma linha de forma segura e sem duplicidade,
 * somando todas as colunas operacionais ativas (inclusive colunas criadas pelo usuário).
 */
export function calculateRowTotal(row: Record<string, any>, columns: Column[]): number {
  if (!row) return 0;

  const numericCols = columns.filter(
    (c) => c.numeric && c.key !== "total" && c.key !== "total_periodo" && c.key !== "focos",
  );
  const keys = new Set(numericCols.map((c) => c.key));
  const isEfetivo =
    keys.has("cbmam") || keys.has("servico") || keys.has("opamv") || keys.has("ord");

  if (isEfetivo) {
    let sum = 0;
    // CBMAM (ou ord ou servico)
    sum += Number(row.cbmam) || Number(row.servico) || Number(row.ord) || 0;

    // Brigadistas: se existirem brig_mun ou brig_semas com dados, soma-os; senão usa brig
    const hasSubBrig = keys.has("brig_mun") || keys.has("brig_semas");
    if (hasSubBrig) {
      sum += (Number(row.brig_mun) || 0) + (Number(row.brig_semas) || 0);
    } else if (keys.has("brig")) {
      sum += Number(row.brig) || 0;
    }

    // Soma todas as demais colunas operacionais/customizadas
    for (const c of numericCols) {
      if (
        c.key === "cbmam" ||
        c.key === "servico" ||
        c.key === "ord" ||
        c.key === "brig_mun" ||
        c.key === "brig_semas" ||
        c.key === "brig"
      ) {
        continue;
      }
      sum += Number(row[c.key]) || 0;
    }
    return sum;
  }

  // Tabela numérica genérica (recursos, incendios, etc.)
  return numericCols.reduce((acc, c) => acc + (Number(row[c.key]) || 0), 0);
}

const EFETIVO_STORAGE_KEY = "cbmam_efetivo_custom_columns";

export function getStoredEfetivoColumns(): Column[] {
  if (typeof window === "undefined") return DEFAULT_EFETIVO_COLUMNS.map((c) => ({ ...c }));
  try {
    const raw = localStorage.getItem(EFETIVO_STORAGE_KEY);
    if (!raw) return DEFAULT_EFETIVO_COLUMNS.map((c) => ({ ...c }));
    const parsed = JSON.parse(raw);
    if (Array.isArray(parsed) && parsed.length > 0) {
      const clean = sanitizeEfetivoColumns(parsed);
      // Se continha colunas repetidas, limpa imediatamente no localStorage
      if (clean.length !== parsed.length) {
        localStorage.setItem(EFETIVO_STORAGE_KEY, JSON.stringify(clean));
      }
      return clean;
    }
  } catch {
    // fallback
  }
  return DEFAULT_EFETIVO_COLUMNS.map((c) => ({ ...c }));
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
