/**
 * Helpers for the "report date" selector — the date the report reflects.
 * Handles formatting and filtering occurrences by date string.
 */

const MONTHS_PT = [
  "janeiro",
  "fevereiro",
  "março",
  "abril",
  "maio",
  "junho",
  "julho",
  "agosto",
  "setembro",
  "outubro",
  "novembro",
  "dezembro",
];

const pad = (n: number) => String(n).padStart(2, "0");

/** `06/07/2026` */
export function fmtDateBR(d: Date): string {
  return `${pad(d.getDate())}/${pad(d.getMonth() + 1)}/${d.getFullYear()}`;
}

/** `06 de julho de 2026` — used in the PDF cover. */
export function fmtDateLong(d: Date): string {
  return `${pad(d.getDate())} de ${MONTHS_PT[d.getMonth()]} de ${d.getFullYear()}`;
}

/** `20260706` — for filename suffixes. */
export function fmtDateStamp(d: Date): string {
  return `${d.getFullYear()}${pad(d.getMonth() + 1)}${pad(d.getDate())}`;
}

/**
 * Try to match a row's `.data` field against the target date.
 * Row dates come from a spreadsheet — they may be `dd/mm/yyyy`,
 * `yyyy-mm-dd`, `dd-mm-yyyy`, or contain a date substring.
 */
export function rowMatchesDate(rowDate: unknown, target: Date): boolean {
  if (rowDate == null || rowDate === "") return false;
  const s = String(rowDate);
  const br = fmtDateBR(target); // 06/07/2026
  const iso = `${target.getFullYear()}-${pad(target.getMonth() + 1)}-${pad(target.getDate())}`;
  const brDash = br.replace(/\//g, "-");
  return s.includes(br) || s.includes(iso) || s.includes(brDash);
}

/**
 * Filter occurrences by date. Falls back to the original list when
 * no row matches (so users don't accidentally export an empty report).
 */
export function filterOccurrencesByDate<T extends { data?: unknown }>(
  rows: readonly T[],
  target: Date | null,
): { rows: T[]; filtered: boolean } {
  if (!target) return { rows: [...rows], filtered: false };
  const matched = rows.filter((r) => rowMatchesDate(r.data, target));
  if (matched.length === 0) return { rows: [...rows], filtered: false };
  return { rows: matched, filtered: true };
}
