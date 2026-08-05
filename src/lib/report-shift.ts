import { z } from "zod";

/**
 * Cada dia possui dois relatórios oficiais:
 * - `noturno`: consolidado das 24h — ocorrências das 18:30 do dia anterior
 *   até as 07:00 do dia atual, fechando o dia anterior.
 * - `parcial`: parcial do dia corrente — das 07:00 às 18:30.
 */
export const ShiftEnum = z.enum(["noturno", "parcial"]);
export type ReportShift = z.infer<typeof ShiftEnum>;

export const SHIFTS: ReportShift[] = ["noturno", "parcial"];

export const SHIFT_LABEL: Record<ReportShift, string> = {
  noturno: "Consolidado 24h (18:30 do dia anterior → 07:00)",
  parcial: "Parcial do dia (07:00 → 18:30)",
};

export const SHIFT_SHORT: Record<ReportShift, string> = {
  noturno: "24h · 18:30–07:00",
  parcial: "Parcial · 07:00–18:30",
};

export const SHIFT_TAB: Record<ReportShift, string> = {
  noturno: "Consolidado 24h",
  parcial: "Parcial do dia",
};
