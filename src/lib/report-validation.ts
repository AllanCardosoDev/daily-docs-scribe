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
  scan(data.efetivo, ["ord", "seg", "brig"]);
  scan(data.incendios_diario, ["urb", "flor", "focos"]);
  scan(data.incendios_acumulado, ["urb", "flor", "focos", "sat", "area"]);
  scan(data.outras_diarias, ["salvamento", "acidentes", "aph", "prevencao", "servicos"]);
  scan(data.occurrences, ["focos", "area", "agua"]);
  return n;
}

/** Format issues into a single human-readable string for toasts. */
export function formatIssues(issues: ValidationIssue[]): string {
  return issues.map((i) => `• ${i.label}: ${i.message}`).join("\n");
}

export type { SheetsHeader };
