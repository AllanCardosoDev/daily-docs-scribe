import { compareMunicipios } from "./municipio-order";
import { buildSheetsPdfDoc, type PdfQuality } from "./export-pdf";
import { exportSheetsToXlsx } from "./export-xlsx";
import type { SheetsData } from "./sheets.types";
import { SHIFT_LABEL, SHIFT_TAB, type ReportShift } from "./report-shift";

/** Linha bruta de `daily_reports` (as seções são JSONB). */
export type DailyRowLike = {
  efetivo?: any[] | null;
  recursos?: any[] | null;
  incendios?: any[] | null;
  outras?: any[] | null;
  notes?: string | null;
};

const num = (v: unknown) => Number(v) || 0;

/** Soma por município as listas de incêndios de vários relatórios. */
export function aggregateIncendios(rows: Array<{ incendios?: any[] | null }>) {
  const map = new Map<
    string,
    { mun: string; urb: number; flor: number; focos: number; sat: number; area: number }
  >();
  for (const r of rows) {
    for (const item of r?.incendios ?? []) {
      const mun = String(item?.mun ?? "").trim() || "—";
      const cur = map.get(mun) ?? { mun, urb: 0, flor: 0, focos: 0, sat: 0, area: 0 };
      cur.urb += num(item?.urb);
      cur.flor += num(item?.flor);
      cur.focos += num(item?.focos);
      map.set(mun, cur);
    }
  }
  return Array.from(map.values()).sort((a, b) => compareMunicipios(a.mun, b.mun));
}

/** Converte a data ISO (yyyy-mm-dd) em Date local, sem salto de fuso. */
export function isoToLocalDate(iso: string) {
  const [y, m, d] = iso.split("-").map(Number);
  return new Date(y, (m ?? 1) - 1, d ?? 1);
}

/**
 * Monta o `SheetsData` oficial a partir de UM registro diário.
 * Quando `accumulated` é informado, o relatório sai "completo": mantém as
 * seções do dia e acrescenta o consolidado de incêndios já registrado.
 */
export function buildDailySheetsData(
  date: string,
  shift: ReportShift,
  row: DailyRowLike | null | undefined,
  accumulated?: Array<{ incendios?: any[] | null }> | null,
): SheetsData {
  return {
    header: {
      titulo: `RELATÓRIO DIÁRIO — ${SHIFT_TAB[shift].toUpperCase()}`,
      periodo: SHIFT_LABEL[shift],
      coordSituacao: "Sala de Situação — CBMAM",
    },
    efetivo: (row?.efetivo ?? []) as SheetsData["efetivo"],
    recursos: (row?.recursos ?? []) as SheetsData["recursos"],
    incendios_diario: (row?.incendios ?? []) as SheetsData["incendios_diario"],
    incendios_acumulado: accumulated ? aggregateIncendios(accumulated) : [],
    outras_diarias: (row?.outras ?? []) as SheetsData["outras_diarias"],
    occurrences: [],
  };
}

function baseName(date: string, shift: ReportShift, complete: boolean) {
  const stamp = date.split("-").reverse().join(".");
  const kind = shift === "noturno" ? "24h" : "Parcial";
  return `${stamp} - Relatorio Diario${complete ? " Completo" : ""} - ${kind}`;
}

export function exportDailyPdf(opts: {
  date: string;
  shift: ReportShift;
  row: DailyRowLike | null | undefined;
  accumulated?: Array<{ incendios?: any[] | null }> | null;
  quality?: PdfQuality;
}) {
  const data = buildDailySheetsData(opts.date, opts.shift, opts.row, opts.accumulated);
  const doc = buildSheetsPdfDoc(data, isoToLocalDate(opts.date), opts.quality ?? "high");
  doc.save(`${baseName(opts.date, opts.shift, !!opts.accumulated)}.pdf`);
}

export function exportDailyXlsx(opts: {
  date: string;
  shift: ReportShift;
  row: DailyRowLike | null | undefined;
  accumulated?: Array<{ incendios?: any[] | null }> | null;
}) {
  const data = buildDailySheetsData(opts.date, opts.shift, opts.row, opts.accumulated);
  exportSheetsToXlsx(
    data,
    isoToLocalDate(opts.date),
    `${baseName(opts.date, opts.shift, !!opts.accumulated)}.xlsx`,
  );
}
