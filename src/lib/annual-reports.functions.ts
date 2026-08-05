import { isManaus } from "./municipio-order";
import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireBackendAuth } from "@/integrations/backend/auth-middleware";
import { dbFail } from "./server-errors";

/**
 * Agregação anual de incêndios (urbano / florestal / focos) por município,
 * usada pelos relatórios consolidados "Ano a ano" e "Comparativo 2024-2026".
 */

export type AnnualMunicipioRow = {
  mun: string;
  urb: number;
  flor: number;
  focos: number;
  total: number;
};

export type AnnualYearSummary = {
  year: number;
  from: string | null;
  to: string | null;
  rows: AnnualMunicipioRow[];
  totals: { urb: number; flor: number; focos: number; total: number };
};

const PAGE = 1000;

export const getAnnualIncendios = createServerFn({ method: "GET" })
  .middleware([requireBackendAuth])
  .inputValidator((raw: unknown) =>
    z
      .object({
        years: z.array(z.coerce.number().int().min(2000).max(2100)).min(1).max(10),
      })
      .parse(raw ?? {}),
  )
  .handler(async ({ data, context }): Promise<AnnualYearSummary[]> => {
    const years = Array.from(new Set(data.years)).sort((a, b) => a - b);
    const from = `${years[0]}-01-01`;
    const to = `${years[years.length - 1]}-12-31`;

    // Leitura paginada: um ano completo com dois turnos pode passar de 700
    // linhas, e o intervalo pode cobrir vários anos.
    const all: Array<{ report_date: string; incendios: any }> = [];
    for (let offset = 0; ; offset += PAGE) {
      const { data: rows, error } = await context.supabase
        .from("daily_reports")
        .select("report_date, incendios")
        .gte("report_date", from)
        .lte("report_date", to)
        .order("report_date", { ascending: true })
        .range(offset, offset + PAGE - 1);
      if (error) dbFail(error, "annual-reports");
      const list = (rows ?? []) as Array<{ report_date: string; incendios: any }>;
      all.push(...list);
      if (list.length < PAGE) break;
    }

    const byYear = new Map<
      number,
      { min: string | null; max: string | null; map: Map<string, AnnualMunicipioRow> }
    >();
    for (const y of years) byYear.set(y, { min: null, max: null, map: new Map() });

    for (const r of all) {
      const y = Number(r.report_date.slice(0, 4));
      const bucket = byYear.get(y);
      if (!bucket) continue;
      const items: any[] = Array.isArray(r.incendios) ? r.incendios : [];
      const hasData = items.some(
        (i) => (Number(i?.urb) || 0) + (Number(i?.flor) || 0) + (Number(i?.focos) || 0) > 0,
      );
      if (hasData) {
        if (!bucket.min || r.report_date < bucket.min) bucket.min = r.report_date;
        if (!bucket.max || r.report_date > bucket.max) bucket.max = r.report_date;
      }
      for (const item of items) {
        const mun = String(item?.mun ?? "").trim();
        if (!mun) continue;
        const cur = bucket.map.get(mun) ?? { mun, urb: 0, flor: 0, focos: 0, total: 0 };
        cur.urb += Number(item?.urb) || 0;
        cur.flor += Number(item?.flor) || 0;
        cur.focos += Number(item?.focos) || 0;
        cur.total = cur.urb + cur.flor;
        bucket.map.set(mun, cur);
      }
    }

    return years.map((year) => {
      const bucket = byYear.get(year)!;
      const rows = Array.from(bucket.map.values()).sort((a, b) =>
        isManaus(a.mun) !== isManaus(b.mun)
          ? isManaus(a.mun)
            ? -1
            : 1
          : b.total - a.total || a.mun.localeCompare(b.mun, "pt-BR"),
      );
      const totals = rows.reduce(
        (acc, r) => ({
          urb: acc.urb + r.urb,
          flor: acc.flor + r.flor,
          focos: acc.focos + r.focos,
          total: acc.total + r.total,
        }),
        { urb: 0, flor: 0, focos: 0, total: 0 },
      );
      return { year, from: bucket.min, to: bucket.max, rows, totals };
    });
  });
