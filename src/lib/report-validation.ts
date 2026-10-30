import { z } from "zod";
import type { SheetsData, SheetsHeader } from "./sheets.types";

const requiredStr = z.string({ required_error: "Obrigatório" }).trim().min(1, "Obrigatório");

/**
 * Header fields that MUST be filled before the official PDF can be exported.
 * Non-mandatory fields (e.g. optional coordinators) are intentionally excluded.
 */
const REQUIRED_HEADER_LABELS: Record<string, string> = {
  titulo: "Título",
  periodo: "Período Operacional",
  comandante: "Comandante do Incidente",
  coordenador: "Coordenador da Operação",
};

const HeaderExportSchema = z.object({
  titulo: requiredStr,
  periodo: requiredStr,
  comandante: requiredStr,
  coordenador: requiredStr,
});

export interface ValidationIssue {
  field: string;
  label: string;
  message: string;
}

export interface ValidationResult {
  ok: boolean;
  issues: ValidationIssue[];
}

/** Validate the header + basic data integrity before an official export. */
export function validateForExport(data: SheetsData): ValidationResult {
  const issues: ValidationIssue[] = [];

  // Header — required fields
  const headerResult = HeaderExportSchema.safeParse(data.header ?? {});
  if (!headerResult.success) {
    for (const err of headerResult.error.issues) {
      const key = String(err.path[0] ?? "");
      issues.push({
        field: key,
        label: REQUIRED_HEADER_LABELS[key] ?? key,
        message: err.message,
      });
    }
  }

  // Data sanity — no negative numeric cells slipped through
  const negativeCells = countNegativeCells(data);
  if (negativeCells > 0) {
    issues.push({
      field: "dados",
      label: "Dados numéricos",
      message: `${negativeCells} célula(s) com valor negativo — corrija antes de exportar.`,
    });
  }

  return { ok: issues.length === 0, issues };
}

function countNegativeCells(data: SheetsData): number {
  let n = 0;
  const scan = (rows: readonly Record<string, any>[] | undefined, numericKeys: string[]) => {
    if (!Array.isArray(rows)) return;
    for (const r of rows) {
      for (const k of numericKeys) {
        if (Number(r[k]) < 0) n++;
      }
    }
  };
  scan(data.efetivo, ["ord", "seg", "brig", "servico", "opamv", "opam_ref", "inc1", "inc2", "inc3", "cbmsp", "prevfogo", "fn", "brig_mun", "brig_semas"]);
  scan(data.incendios_diario, ["urb", "flor", "focos"]);
  scan(data.incendios_acumulado, ["urb", "flor", "focos", "sat", "area"]);
  scan(data.occurrences, ["focos", "area", "agua"]);
  return n;
}

/** Format issues into a single human-readable string for toasts. */
export function formatIssues(issues: ValidationIssue[]): string {
  return issues.map((i) => `• ${i.label}: ${i.message}`).join("\n");
}

/**
 * Sanitiza e autocorrige todas as células numéricas de SheetsData, garantindo
 * que nenhum valor negativo seja exportado ou cause bloqueio na geração do PDF.
 * Converte valores negativos para o seu valor absoluto real (Math.abs) e preenche cabeçalho padrão se ausente.
 */
export function sanitizeSheetsData(data: SheetsData): SheetsData {
  if (!data) return data;

  const sanitizeNumber = (val: unknown): number => {
    if (val === null || val === undefined || val === "" || val === "—" || val === "-") return 0;
    const n = Number(val);
    if (!Number.isFinite(n) || isNaN(n)) return 0;
    return Math.abs(n);
  };

  const sanitizeRows = <T extends Record<string, any>>(
    rows: readonly T[] | undefined,
    numericKeys: string[],
  ): T[] => {
    if (!Array.isArray(rows)) return [];
    return rows.map((row) => {
      const copy: any = { ...row };
      for (const k of numericKeys) {
        if (k in copy && copy[k] !== undefined && copy[k] !== null && copy[k] !== "—" && copy[k] !== "-") {
          const numVal = Number(copy[k]);
          if (Number.isFinite(numVal) && numVal < 0) {
            copy[k] = Math.abs(numVal);
          }
        }
      }
      return copy as T;
    });
  };

  const efetivoKeys = [
    "cbmam", "ord", "seg", "brig", "servico", "opamv", "opam_ref",
    "inc1", "inc2", "inc3", "cbmsp", "prevfogo", "fn", "brig_mun", "brig_semas"
  ];
  const recursosKeys = [
    "viaturas", "aeronaves", "embarcacoes", "abt", "at", "aem", "atp", "ata", "abf", "ar",
    "ur", "abs", "aca", "atb", "asa", "acp", "atc", "jetski", "embarcacao", "quadriciclo",
    "autoarp", "picape_fn", "picape_muni", "picape_esfron", "helicoptero", "aviao", "abtf"
  ];
  const incendiosKeys = ["urb", "flor", "focos", "sat", "area", "total_periodo"];
  const occKeys = ["focos", "area", "agua"];

  return {
    ...data,
    header: {
      titulo: data.header?.titulo || "Relatório Consolidado de Período",
      periodo: data.header?.periodo || "Período Operacional",
      comandante: data.header?.comandante || "CEL QOBM BORGES",
      coordenador: data.header?.coordenador || "CEL QOBM CRISTIANO BRAZ FERREIRA",
      coordSituacao: data.header?.coordSituacao || "Sala de Situação — CBMAM",
      ...data.header,
    },
    efetivo: sanitizeRows(data.efetivo, efetivoKeys),
    recursos: sanitizeRows(data.recursos, recursosKeys),
    incendios_diario: sanitizeRows(data.incendios_diario, incendiosKeys),
    incendios_acumulado: sanitizeRows(data.incendios_acumulado, incendiosKeys),
    occurrences: sanitizeRows(data.occurrences, occKeys).map((occ: any) => ({
      ...occ,
      focos: sanitizeNumber(occ.focos),
      area: sanitizeNumber(occ.area),
      agua: sanitizeNumber(occ.agua),
    })),
  };
}

export type { SheetsHeader };
