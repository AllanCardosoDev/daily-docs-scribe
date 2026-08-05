/**
 * Shared formatting helpers.
 * Centralised so number and date output stay consistent across UI + exports.
 */
export const NF = new Intl.NumberFormat("pt-BR");

/** Compact date stamp `YYYYMMDD` used to suffix exported filenames. */
export function fmtDateStamp(d: Date = new Date()): string {
  const p = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}${p(d.getMonth() + 1)}${p(d.getDate())}`;
}
