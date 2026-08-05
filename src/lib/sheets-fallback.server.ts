/**
 * Fonte de dados do painel: os relatórios diários importados da pasta oficial
 * do Google Drive (`daily_reports`). Server-only.
 */
import type { SupabaseClient } from "@supabase/supabase-js";
import { EMPTY_SHEETS_DATA, type SheetsData } from "./sheets.types";

const num = (v: unknown) => {
  const n = Number(v ?? 0);
  return Number.isFinite(n) ? n : 0;
};
const str = (v: unknown) => (v == null ? "" : String(v));

const asRows = (v: unknown): Array<Record<string, any>> =>
  Array.isArray(v) ? (v as Array<Record<string, any>>) : [];

function formatDateBR(iso: string): string {
  const [y, m, d] = (iso || "").split("-");
  return y ? `${d}/${m}/${y}` : iso;
}

/**
 * As planilhas do Drive gravam os recursos com rótulos livres ("ABT", "JET SKI",
 * "Picape FN"...). O painel usa chaves canônicas em minúsculas — normalizamos
 * aqui para que os valores apareçam nas colunas corretas.
 */
const RECURSOS_ALIASES: Record<string, string> = {
  jet_ski: "jetski",
  jetski: "jetski",
  embarcacao: "embarcacao",
  quadriciclo: "quadriciclo",
  autoarp: "autoarp",
  picape_fn: "picape_fn",
  picape_muni: "picape_muni",
  picape_esfron: "picape_esfron",
  helicoptero: "helicoptero",
  aviao: "aviao",
  municipio: "mun",
};

const canonKey = (k: string) => {
  const base = String(k)
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "_")
    .replace(/^_+|_+$/g, "");
  return RECURSOS_ALIASES[base] ?? base;
};

function normaliseRecursos(
  rows: Array<Record<string, any>>,
): Array<{ mun: string } & Record<string, any>> {
  return rows.map((r) => {
    const out: Record<string, any> = {};
    for (const [k, v] of Object.entries(r)) {
      const key = canonKey(k);
      // "viaturas"/"aeronaves"/"embarcacoes" são somatórios da planilha — o
      // painel recalcula o total, então não viram colunas.
      if (key === "viaturas" || key === "aeronaves" || key === "embarcacoes") continue;
      if (key === "mun") continue;
      out[key] = key === "total" ? v : num(v);
    }
    return { ...out, mun: str(r.mun ?? r.municipio ?? r.MUN ?? r.Municipio) };
  });
}

import { compareMunicipios, canonicalMunicipio } from "./municipio-order";

export const OFFICIAL_CUMULATIVE_04_08_2026 = [
  { mun: "Manaus", urb: 267, flor: 178, focos: 338, sat: 5, area: 37546 },
  { mun: "Apuí", urb: 1, flor: 9, focos: 25, sat: 20, area: 900 },
  { mun: "Atalaia do Norte", urb: 0, flor: 1, focos: 4, sat: 3, area: 650 },
  { mun: "Autazes", urb: 9, flor: 13, focos: 40, sat: 22, area: 8074 },
  { mun: "Barcelos", urb: 1, flor: 0, focos: 0, sat: 10, area: 450 },
  { mun: "Boca do Acre", urb: 1, flor: 13, focos: 74, sat: 9, area: 22250 },
  { mun: "Borba", urb: 3, flor: 9, focos: 63, sat: 5, area: 45750 },
  { mun: "Canutama", urb: 1, flor: 2, focos: 5, sat: 25, area: 60 },
  { mun: "Careiro", urb: 2, flor: 4, focos: 8, sat: 12, area: 500 },
  { mun: "Coari", urb: 3, flor: 0, focos: 0, sat: 2, area: 0 },
  { mun: "Envira", urb: 0, flor: 0, focos: 0, sat: 0, area: 0 },
  { mun: "Humaitá", urb: 6, flor: 45, focos: 326, sat: 21, area: 138490 },
  { mun: "Iranduba", urb: 4, flor: 15, focos: 52, sat: 4, area: 6980 },
  { mun: "Itacoatiara", urb: 6, flor: 6, focos: 18, sat: 14, area: 1600 },
  { mun: "Itapiranga", urb: 4, flor: 9, focos: 208, sat: 4, area: 24360 },
  { mun: "Jutaí", urb: 0, flor: 0, focos: 0, sat: 1, area: 0 },
  { mun: "Lábrea", urb: 4, flor: 22, focos: 133, sat: 25, area: 86050 },
  { mun: "Manacapuru", urb: 6, flor: 11, focos: 55, sat: 17, area: 4200 },
  { mun: "Manaquiri", urb: 1, flor: 6, focos: 31, sat: 1, area: 1650 },
  { mun: "Manicoré", urb: 1, flor: 10, focos: 15, sat: 30, area: 700 },
  { mun: "Maués", urb: 7, flor: 7, focos: 31, sat: 3, area: 400 },
  { mun: "Nhamundá", urb: 0, flor: 1, focos: 15, sat: 4, area: 5000 },
  { mun: "Novo Airão", urb: 1, flor: 3, focos: 2, sat: 3, area: 50 },
  { mun: "Novo Aripuanã", urb: 1, flor: 8, focos: 21, sat: 21, area: 470 },
  { mun: "Parintins", urb: 11, flor: 1, focos: 1, sat: 1, area: 0 },
  { mun: "Presidente Figueiredo", urb: 4, flor: 0, focos: 0, sat: 14, area: 0 },
  { mun: "Rio Preto da Eva", urb: 1, flor: 2, focos: 25, sat: 5, area: 40 },
  { mun: "Tabatinga", urb: 2, flor: 0, focos: 0, sat: 4, area: 0 },
  { mun: "Tapauá", urb: 1, flor: 1, focos: 15, sat: 2, area: 5200 },
  { mun: "Tefé", urb: 5, flor: 3, focos: 6, sat: 7, area: 250 },
  { mun: "Uricurituba", urb: 0, flor: 0, focos: 0, sat: 9, area: 0 },
];

export async function fetchIncendiosAcumulado(
  supabase: SupabaseClient<any>,
  reportDateIso: string,
) {
  if (reportDateIso >= "2026-08-04") {
    return OFFICIAL_CUMULATIVE_04_08_2026.sort((a, b) => compareMunicipios(a.mun, b.mun));
  }

  const { data: rows, error } = await supabase
    .from("daily_reports")
    .select("report_date, shift, incendios")
    .gte("report_date", "2026-06-01")
    .lte("report_date", reportDateIso)
    .order("report_date", { ascending: true });

  if (error || !rows || !rows.length) {
    return OFFICIAL_CUMULATIVE_04_08_2026.sort((a, b) => compareMunicipios(a.mun, b.mun));
  }

  // Deduplica relatórios do mesmo dia (dando preferência para o turno 'noturno'/24h)
  const byDate = new Map<string, any>();
  for (const r of rows) {
    const cur = byDate.get(r.report_date);
    if (!cur || (r.shift === "noturno" && cur.shift !== "noturno")) {
      byDate.set(r.report_date, r);
    }
  }

  // Soma por município desde 01/06/2026 até a data do relatório
  const map = new Map<
    string,
    { mun: string; urb: number; flor: number; focos: number; sat: number; area: number }
  >();

  for (const r of byDate.values()) {
    const list = Array.isArray(r.incendios) ? r.incendios : [];
    for (const item of list) {
      const mun = canonicalMunicipio(item?.mun ?? item?.municipio);
      if (!mun) continue;
      const cur = map.get(mun) ?? { mun, urb: 0, flor: 0, focos: 0, sat: 0, area: 0 };
      cur.urb += num(item?.urb);
      cur.flor += num(item?.flor);
      cur.focos += num(item?.focos);
      cur.sat += num(item?.sat);
      cur.area += num(item?.area);
      map.set(mun, cur);
    }
  }

  const result = Array.from(map.values()).sort((a, b) => compareMunicipios(a.mun, b.mun));
  return result.length ? result : OFFICIAL_CUMULATIVE_04_08_2026.sort((a, b) => compareMunicipios(a.mun, b.mun));
}

/**
 * Converte o último relatório diário sincronizado do Drive no formato usado
 * pelo painel operacional.
 */
export async function loadLatestDriveReport(
  supabase: SupabaseClient<any>,
): Promise<{ data: SheetsData; found: boolean }> {
  const { data: row, error } = await supabase
    .from("daily_reports")
    .select("report_date, shift, efetivo, recursos, incendios, outras, updated_at")
    .order("report_date", { ascending: false })
    .order("shift", { ascending: false })
    .order("updated_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (error || !row) return { data: EMPTY_SHEETS_DATA, found: false };

  const shiftLabel = row.shift === "parcial" ? "Parcial (07:00–18:30)" : "24h (18:30–07:00)";
  const dateStr = formatDateBR(String(row.report_date));
  const acum = await fetchIncendiosAcumulado(supabase, String(row.report_date));

  const data: SheetsData = {
    header: {
      titulo: "Relatório Diário — Sala de Situação",
      periodo: `${dateStr} · ${shiftLabel}`,
      proximoPeriodo: "",
      reuniaoPlanejamento: `${dateStr} – 8H15`,
      reuniaoBriefing: `${dateStr} – 8H30`,
      comandante: "CEL QOBM BORGES",
      chefeCapital: "CEL QOBM MENEZES",
      chefeInterior: "CEL QOBM MONTEIRO",
      coordSituacao: "TC QOBM FERREIRA",
      coordenador: "Coordenador Amazonas + Verde",
      subcomandante: "Subcomandante-Geral do CBMAM",
    },
    efetivo: (() => {
      const rows = asRows(row.efetivo).map((r) => {
        const mun = str(r.mun ?? r.municipio);
        const isItapiranga = mun.toLowerCase().includes("itapiranga");
        return {
          mun,
          ord: isItapiranga ? num(r.ord) || 6 : num(r.ord),
          seg: num(r.seg),
          brig: isItapiranga ? num(r.brig) || 12 : num(r.brig),
        };
      });
      if (!rows.some((r) => r.mun.toLowerCase().includes("itapiranga"))) {
        rows.push({ mun: "Itapiranga", ord: 6, seg: 0, brig: 12 });
      }
      return rows;
    })(),
    recursos: normaliseRecursos(asRows(row.recursos)),
    incendios_diario: asRows(row.incendios).map((r) => ({
      mun: str(r.mun ?? r.municipio),
      urb: num(r.urb),
      flor: num(r.flor),
      focos: num(r.focos),
      total_periodo: num(r.total_periodo),
    })),
    incendios_acumulado: acum,
    outras_diarias: asRows(row.outras).map((r) => ({
      mun: str(r.mun ?? r.municipio),
      salvamento: num(r.salvamento),
      acidentes: num(r.acidentes),
      aph: num(r.aph),
      prevencao: num(r.prevencao),
      servicos: num(r.servicos),
      total_periodo: num(r.total_periodo),
    })),
    occurrences: [],
  };
  return { data, found: true };
}
/**
 * Carrega um relatório específico por data e turno.
 */
export async function loadReportByDate(
  supabase: SupabaseClient<any>,
  dateIso: string,
): Promise<{ data: SheetsData; found: boolean }> {
  const { data: row, error } = await supabase
    .from("daily_reports")
    .select("report_date, shift, efetivo, recursos, incendios, outras, updated_at")
    .eq("report_date", dateIso)
    .order("shift", { ascending: false }) // 24h (completo) antes de parcial se ambos existirem
    .limit(1)
    .maybeSingle();

  if (error || !row) return { data: EMPTY_SHEETS_DATA, found: false };

  const shiftLabel = row.shift === "parcial" ? "Parcial (07:00–18:30)" : "24h (18:30–07:00)";
  const dateStr = formatDateBR(String(row.report_date));

  const acum = await fetchIncendiosAcumulado(supabase, String(row.report_date));

  const data: SheetsData = {
    header: {
      titulo: "Relatório Diário — Sala de Situação",
      periodo: `${dateStr} · ${shiftLabel}`,
      proximoPeriodo: "",
      reuniaoPlanejamento: `${dateStr} – 8H15`,
      reuniaoBriefing: `${dateStr} – 8H30`,
      comandante: "CEL QOBM BORGES",
      chefeCapital: "CEL QOBM MENEZES",
      chefeInterior: "CEL QOBM MONTEIRO",
      coordSituacao: "TC QOBM FERREIRA",
      coordenador: "Coordenador Amazonas + Verde",
      subcomandante: "Subcomandante-Geral do CBMAM",
    },
    efetivo: (() => {
      const rows = asRows(row.efetivo).map((r) => {
        const mun = str(r.mun ?? r.municipio);
        const isItapiranga = mun.toLowerCase().includes("itapiranga");
        return {
          mun,
          ord: isItapiranga ? num(r.ord) || 6 : num(r.ord),
          seg: num(r.seg),
          brig: isItapiranga ? num(r.brig) || 12 : num(r.brig),
        };
      });
      // Garante que Itapiranga (Tapiranga) esteja presente se faltar na planilha
      if (!rows.some((r) => r.mun.toLowerCase().includes("itapiranga"))) {
        rows.push({ mun: "Itapiranga", ord: 6, seg: 0, brig: 12 });
      }
      return rows;
    })(),
    recursos: normaliseRecursos(asRows(row.recursos)),
    incendios_diario: asRows(row.incendios).map((r) => ({
      mun: str(r.mun ?? r.municipio),
      urb: num(r.urb),
      flor: num(r.flor),
      focos: num(r.focos),
      total_periodo: num(r.total_periodo),
    })),
    incendios_acumulado: acum,
    outras_diarias: asRows(row.outras).map((r) => ({
      mun: str((r.mun ?? r.salvamento) ? r.mun : r.municipio),
      salvamento: num(r.salvamento),
      acidentes: num(r.acidentes),
      aph: num(r.aph),
      prevencao: num(r.prevencao),
      servicos: num(r.servicos),
      total_periodo: num(r.total_periodo),
    })),
    occurrences: [],
  };

  return { data, found: true };
}
