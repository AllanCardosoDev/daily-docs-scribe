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
  if (d.getUTCHours() === 0 && d.getUTCMinutes() === 0 && d.getUTCSeconds() === 0 && d.getTimezoneOffset() > 0) {
    return `${pad(d.getUTCDate())}/${pad(d.getUTCMonth() + 1)}/${d.getUTCFullYear()}`;
  }
  return `${pad(d.getDate())}/${pad(d.getMonth() + 1)}/${d.getFullYear()}`;
}

/** `06 de julho de 2026` — used in the PDF cover. */
export function fmtDateLong(d: Date): string {
  if (d.getUTCHours() === 0 && d.getUTCMinutes() === 0 && d.getUTCSeconds() === 0 && d.getTimezoneOffset() > 0) {
    return `${pad(d.getUTCDate())} de ${MONTHS_PT[d.getUTCMonth()]} de ${d.getUTCFullYear()}`;
  }
  return `${pad(d.getDate())} de ${MONTHS_PT[d.getMonth()]} de ${d.getFullYear()}`;
}

/** `20260706` — for filename suffixes. */
export function fmtDateStamp(d: Date): string {
  if (d.getUTCHours() === 0 && d.getUTCMinutes() === 0 && d.getUTCSeconds() === 0 && d.getTimezoneOffset() > 0) {
    return `${d.getUTCFullYear()}${pad(d.getUTCMonth() + 1)}${pad(d.getUTCDate())}`;
  }
  return `${d.getFullYear()}${pad(d.getMonth() + 1)}${pad(d.getDate())}`;
}

/**
 * Try to match a row's `.data` field against the target date.
 * Row dates come from a spreadsheet — they may be `dd/mm/yyyy`,
 * `yyyy-mm-dd`, `dd-mm-yyyy`, or contain a date substring.
 */
export function rowMatchesDate(rowDate: unknown, target: Date): boolean {
  if (rowDate == null || rowDate === "") return false;
  const s = String(rowDate).trim();

  const localDay = pad(target.getDate());
  const localMonth = pad(target.getMonth() + 1);
  const localYear = target.getFullYear();

  const utcDay = pad(target.getUTCDate());
  const utcMonth = pad(target.getUTCMonth() + 1);
  const utcYear = target.getUTCFullYear();

  const candidates = [
    `${localDay}/${localMonth}/${localYear}`,
    `${localYear}-${localMonth}-${localDay}`,
    `${localDay}-${localMonth}-${localYear}`,
    `${utcDay}/${utcMonth}/${utcYear}`,
    `${utcYear}-${utcMonth}-${utcDay}`,
    `${utcDay}-${utcMonth}-${utcYear}`,
  ];

  for (const c of candidates) {
    if (s.includes(c)) return true;
  }
  return false;
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
