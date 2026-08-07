import { isManaus, canonicalMunicipio } from "./municipio-order";
import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireBackendAuth } from "@/integrations/backend/auth-middleware";
import { dbFail } from "./server-errors";

/**
 * Agregação anual de todas as ocorrências (Incêndios, Atendimentos Diversos, Efetivo e Recursos)
 * por município, usada pelos relatórios consolidados "Ano a ano" e "Comparativo Anual".
 */

export type AnnualIncendioRow = {
  mun: string;
  urb: number;
  flor: number;
  focos: number;
  total: number;
};

export type AnnualOutrasRow = {
  mun: string;
  salvamento: number;
  acidentes: number;
  aph: number;
  prevencao: number;
  servicos: number;
  total: number;
};

export type AnnualEfetivoRow = {
  mun: string;
  ord: number;
  seg: number;
  brig: number;
  total: number;
};

export type AnnualRecursosRow = {
  mun: string;
  viaturas: number;
  aeronaves: number;
  embarcacoes: number;
  total: number;
};

export type AnnualYearSummary = {
  year: number;
  from: string | null;
  to: string | null;
  // Seções completas
  incendios: {
    rows: AnnualIncendioRow[];
    totals: { urb: number; flor: number; focos: number; total: number };
  };
  outras: {
    rows: AnnualOutrasRow[];
    totals: { salvamento: number; acidentes: number; aph: number; prevencao: number; servicos: number; total: number };
  };
  efetivo: {
    rows: AnnualEfetivoRow[];
    totals: { ord: number; seg: number; brig: number; total: number };
  };
  recursos: {
    rows: AnnualRecursosRow[];
    totals: { viaturas: number; aeronaves: number; embarcacoes: number; total: number };
  };
  // Retrocompatibilidade para Incêndios
  rows: AnnualIncendioRow[];
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

    const all: Array<{
      report_date: string;
      incendios: any;
      outras: any;
      efetivo: any;
      recursos: any;
    }> = [];

    for (let offset = 0; ; offset += PAGE) {
      const { data: rows, error } = await context.supabase
        .from("daily_reports")
        .select("report_date, incendios, outras, efetivo, recursos")
        .gte("report_date", from)
        .lte("report_date", to)
        .order("report_date", { ascending: true })
        .range(offset, offset + PAGE - 1);

      if (error) dbFail(error, "annual-reports");
      const list = (rows ?? []) as Array<any>;
      all.push(...list);
      if (list.length < PAGE) break;
    }

    const byYear = new Map<
      number,
      {
        min: string | null;
        max: string | null;
        incMap: Map<string, AnnualIncendioRow>;
        outMap: Map<string, AnnualOutrasRow>;
        efMap: Map<string, AnnualEfetivoRow>;
        recMap: Map<string, AnnualRecursosRow>;
      }
    >();

    for (const y of years) {
      byYear.set(y, {
        min: null,
        max: null,
        incMap: new Map(),
        outMap: new Map(),
        efMap: new Map(),
        recMap: new Map(),
      });
    }

    for (const r of all) {
      const y = Number(r.report_date.slice(0, 4));
      const bucket = byYear.get(y);
      if (!bucket) continue;

      const incItems: any[] = Array.isArray(r.incendios) ? r.incendios : [];
      const outItems: any[] = Array.isArray(r.outras) ? r.outras : [];
      const efItems: any[] = Array.isArray(r.efetivo) ? r.efetivo : [];
      const recItems: any[] = Array.isArray(r.recursos) ? r.recursos : [];

      const hasData =
        incItems.length > 0 || outItems.length > 0 || efItems.length > 0 || recItems.length > 0;

      if (hasData) {
        if (!bucket.min || r.report_date < bucket.min) bucket.min = r.report_date;
        if (!bucket.max || r.report_date > bucket.max) bucket.max = r.report_date;
      }

      // Incêndios
      for (const item of incItems) {
        const rawMun = item?.mun ?? item?.municipio;
        if (!rawMun) continue;
        const mun = canonicalMunicipio(rawMun);
        if (mun === "—") continue;
        const cur = bucket.incMap.get(mun) ?? { mun, urb: 0, flor: 0, focos: 0, total: 0 };
        cur.urb += Number(item?.urb) || 0;
        cur.flor += Number(item?.flor) || 0;
        cur.focos += Number(item?.focos) || 0;
        cur.total = cur.urb + cur.flor;
        bucket.incMap.set(mun, cur);
      }

      // Ocorrências / Atendimentos Diversos
      for (const item of outItems) {
        const rawMun = item?.mun ?? item?.municipio;
        if (!rawMun) continue;
        const mun = canonicalMunicipio(rawMun);
        if (mun === "—") continue;
        const cur = bucket.outMap.get(mun) ?? {
          mun,
          salvamento: 0,
          acidentes: 0,
          aph: 0,
          prevencao: 0,
          servicos: 0,
          total: 0,
        };
        cur.salvamento += Number(item?.salvamento) || 0;
        cur.acidentes += Number(item?.acidentes) || 0;
        cur.aph += Number(item?.aph) || 0;
        cur.prevencao += Number(item?.prevencao) || 0;
        cur.servicos += Number(item?.servicos) || 0;
        cur.total = cur.salvamento + cur.acidentes + cur.aph + cur.prevencao + cur.servicos;
        bucket.outMap.set(mun, cur);
      }

      // Efetivo (Snapshot mais recente do ano por município)
      for (const item of efItems) {
        const rawMun = item?.mun ?? item?.municipio;
        if (!rawMun) continue;
        const mun = canonicalMunicipio(rawMun);
        if (mun === "—") continue;
        const ord = Number(item?.ord) || 0;
        const seg = Number(item?.seg) || 0;
        const brig = Number(item?.brig) || 0;
        bucket.efMap.set(mun, { mun, ord, seg, brig, total: ord + seg + brig });
      }

      // Recursos (Snapshot mais recente do ano por município)
      for (const item of recItems) {
        const rawMun = item?.mun ?? item?.municipio;
        if (!rawMun) continue;
        const mun = canonicalMunicipio(rawMun);
        if (mun === "—") continue;
        const viaturas = Number(item?.viaturas ?? item?.abt ?? item?.at ?? item?.atp) || 0;
        const aeronaves = Number(item?.aeronaves ?? item?.helicoptero ?? item?.aviao) || 0;
        const embarcacoes = Number(item?.embarcacoes ?? item?.embarcacao ?? item?.jetski) || 0;
        bucket.recMap.set(mun, {
          mun,
          viaturas,
          aeronaves,
          embarcacoes,
          total: viaturas + aeronaves + embarcacoes,
        });
      }
    }

    return years.map((year) => {
      const bucket = byYear.get(year)!;

      const incRows = Array.from(bucket.incMap.values()).sort((a, b) =>
        isManaus(a.mun) !== isManaus(b.mun)
          ? isManaus(a.mun)
            ? -1
            : 1
          : b.total - a.total || a.mun.localeCompare(b.mun, "pt-BR"),
      );

      const outRows = Array.from(bucket.outMap.values()).sort((a, b) =>
        isManaus(a.mun) !== isManaus(b.mun)
          ? isManaus(a.mun)
            ? -1
            : 1
          : b.total - a.total || a.mun.localeCompare(b.mun, "pt-BR"),
      );

      const efRows = Array.from(bucket.efMap.values()).sort((a, b) =>
        isManaus(a.mun) !== isManaus(b.mun)
          ? isManaus(a.mun)
            ? -1
            : 1
          : b.total - a.total || a.mun.localeCompare(b.mun, "pt-BR"),
      );

      const recRows = Array.from(bucket.recMap.values()).sort((a, b) =>
        isManaus(a.mun) !== isManaus(b.mun)
          ? isManaus(a.mun)
            ? -1
            : 1
          : b.total - a.total || a.mun.localeCompare(b.mun, "pt-BR"),
      );

      const incTotals = incRows.reduce(
        (acc, r) => ({
          urb: acc.urb + r.urb,
          flor: acc.flor + r.flor,
          focos: acc.focos + r.focos,
          total: acc.total + r.total,
        }),
        { urb: 0, flor: 0, focos: 0, total: 0 },
      );

      const outTotals = outRows.reduce(
        (acc, r) => ({
          salvamento: acc.salvamento + r.salvamento,
          acidentes: acc.acidentes + r.acidentes,
          aph: acc.aph + r.aph,
          prevencao: acc.prevencao + r.prevencao,
          servicos: acc.servicos + r.servicos,
          total: acc.total + r.total,
        }),
        { salvamento: 0, acidentes: 0, aph: 0, prevencao: 0, servicos: 0, total: 0 },
      );

      const efTotals = efRows.reduce(
        (acc, r) => ({
          ord: acc.ord + r.ord,
          seg: acc.seg + r.seg,
          brig: acc.brig + r.brig,
          total: acc.total + r.total,
        }),
        { ord: 0, seg: 0, brig: 0, total: 0 },
      );

      const recTotals = recRows.reduce(
        (acc, r) => ({
          viaturas: acc.viaturas + r.viaturas,
          aeronaves: acc.aeronaves + r.aeronaves,
          embarcacoes: acc.embarcacoes + r.embarcacoes,
          total: acc.total + r.total,
        }),
        { viaturas: 0, aeronaves: 0, embarcacoes: 0, total: 0 },
      );

      return {
        year,
        from: bucket.min,
        to: bucket.max,
        incendios: { rows: incRows, totals: incTotals },
        outras: { rows: outRows, totals: outTotals },
        efetivo: { rows: efRows, totals: efTotals },
        recursos: { rows: recRows, totals: recTotals },
        rows: incRows,
        totals: incTotals,
      };
    });
  });
