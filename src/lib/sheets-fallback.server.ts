/**
 * Fonte de dados do painel: os relatórios diários importados da pasta oficial
 * do Google Drive (`daily_reports`). Server-only.
 */
import type { SupabaseClient } from "@supabase/supabase-js";
import { EMPTY_SHEETS_DATA, type SheetsData, type OccurrenceRow } from "./sheets.types";
import { getOccurrencesForDate, getOccurrencesForRange } from "./occurrences-store.server";

export const num = (v: unknown) => {
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
  abtf: "abtf",
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

import { compareMunicipios, canonicalMunicipio, harmonizeMunicipalitySections } from "./municipio-order";
import { isFlorestalAmbiental, isIncendio } from "./fire-classification";

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
  { mun: "Urucurituba", urb: 0, flor: 0, focos: 0, sat: 9, area: 0 },
];

export const STANDARD_OPERATIONAL_MUNICIPIOS = [
  "Manaus",
  "Apuí",
  "Atalaia do Norte",
  "Autazes",
  "Barcelos",
  "Boa Vista do Ramos",
  "Boca do Acre",
  "Borba",
  "Caapiranga",
  "Canutama",
  "Careiro",
  "Careiro da Várzea",
  "Coari",
  "Envira",
  "Humaitá",
  "Iranduba",
  "Itacoatiara",
  "Itapiranga",
  "Jutaí",
  "Lábrea",
  "Manacapuru",
  "Manaquiri",
  "Manicoré",
  "Maués",
  "Nhamundá",
  "Novo Airão",
  "Novo Aripuanã",
  "Parintins",
  "Presidente Figueiredo",
  "Rio Preto da Eva",
  "Tabatinga",
  "Tapauá",
  "Tefé",
  "Urucurituba",
  "Benjamin Constant",
  "São Gabriel da Cachoeira",
  "São Paulo de Olivença",
  "Santo Antônio do Içá",
  "Santa Isabel do Rio Negro",
];

export function ensureAllMunicipios<T extends { mun: string }>(
  existingRows: T[],
  defaultFactory: (mun: string) => T,
): T[] {
  const map = new Map<string, T>();
  for (const m of STANDARD_OPERATIONAL_MUNICIPIOS) {
    const canonical = canonicalMunicipio(m);
    map.set(canonical.toLowerCase(), defaultFactory(canonical));
  }
  for (const row of existingRows) {
    const rawMun = row?.mun ?? (row as any)?.municipio;
    if (!rawMun) continue;
    const canonical = canonicalMunicipio(rawMun);
    if (!canonical || canonical === "—") continue;
    const existing = map.get(canonical.toLowerCase()) ?? defaultFactory(canonical);
    map.set(canonical.toLowerCase(), { ...existing, ...row, mun: canonical });
  }
  return Array.from(map.values()).sort((a, b) => compareMunicipios(a.mun, b.mun));
}

export async function fetchIncendiosAcumulado(
  supabase: SupabaseClient<any>,
  reportDateIso: string,
) {
  const { data: rows, error } = await supabase
    .from("daily_reports")
    .select("report_date, shift, incendios")
    .gte("report_date", "2026-06-01")
    .lte("report_date", reportDateIso)
    .order("report_date", { ascending: true });

  if (error || !rows || !rows.length) {
    return OFFICIAL_CUMULATIVE_04_08_2026.sort((a, b) => compareMunicipios(a.mun, b.mun));
  }

  // Deduplica relatórios do mesmo dia (dando preferência para o turno 'noturno'/24h consolidado)
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

function consolidateAndCanonicalizeRows<T extends Record<string, any>>(
  rows: T[],
  numericKeys: string[],
): T[] {
  const map = new Map<string, T>();
  for (const r of rows) {
    const rawMun = r.mun ?? r.municipio;
    if (!rawMun) continue;
    const mun = canonicalMunicipio(rawMun);
    const existing = map.get(mun);
    if (!existing) {
      const copy: any = { ...r, mun };
      for (const [k, v] of Object.entries(r)) {
        if (k !== "mun" && k !== "municipio" && typeof v !== "object") {
          copy[k] = num(v);
        }
      }
      for (const k of numericKeys) {
        if (copy[k] === undefined) copy[k] = 0;
      }
      map.set(mun, copy);
    } else {
      for (const [k, v] of Object.entries(r)) {
        if (k === "mun" || k === "municipio" || typeof v === "object") continue;
        (existing as any)[k] = num((existing as any)[k]) + num(v);
      }
    }
  }
  return Array.from(map.values()).sort((a, b) => compareMunicipios(a.mun, b.mun));
}

/**
 * Converte o último relatório diário sincronizado do Drive no formato usado
 * pelo painel operacional.
 */
export async function loadLatestDriveReport(
  supabase: SupabaseClient<any>,
): Promise<{ data: SheetsData; found: boolean }> {
  const { data: row } = await supabase
    .from("daily_reports")
    .select("report_date")
    .order("report_date", { ascending: false })
    .order("shift", { ascending: false })
    .order("updated_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  const reportDateIso = row?.report_date
    ? String(row.report_date)
    : new Date().toISOString().split("T")[0];
  return loadReportByDate(supabase, reportDateIso);
}

/**
 * Carrega um relatório específico por data e turno.
 * Se não houver dados gravados para a data, gera a estrutura padrão
 * completa com todos os municípios e campos zerados para inserção imediata.
 */
function parseNotesEnvelope(notes: unknown): Record<string, any> {
  if (!notes || typeof notes !== "string") return {};
  const s = notes.trim();
  if (!s.startsWith("{")) return {};
  try { return JSON.parse(s); } catch { return {}; }
}

export async function fetchOperationalDonor(
  supabase: SupabaseClient<any>,
  dateIso: string,
): Promise<{ efetivo: any[]; recursos: any[]; outras: any[]; header?: Record<string, any> } | null> {
  // Modelo oficial de referência: 25 de outubro de 2026 (2026-10-25) em diante
  const { data: day25Row } = await supabase
    .from("daily_reports")
    .select("report_date, shift, efetivo, recursos, outras, notes")
    .eq("report_date", "2026-10-25")
    .order("shift", { ascending: false })
    .limit(1)
    .maybeSingle();

  const isDay25Valid =
    day25Row &&
    Array.isArray(day25Row.efetivo) &&
    day25Row.efetivo.length > 5 &&
    Array.isArray(day25Row.recursos) &&
    day25Row.recursos.length > 5;

  if (dateIso >= "2026-10-25" && isDay25Valid) {
    const notesEnv = parseNotesEnvelope(day25Row.notes);
    return {
      efetivo: day25Row.efetivo,
      recursos: day25Row.recursos,
      outras: day25Row.outras,
      header: notesEnv.header,
    };
  }

  // 1. Tentar encontrar o dia anterior mais recente que possua dados operacionais
  const { data: prevRows } = await supabase
    .from("daily_reports")
    .select("report_date, shift, efetivo, recursos, outras, notes")
    .lte("report_date", dateIso)
    .not("efetivo", "is", null)
    .order("report_date", { ascending: false })
    .order("shift", { ascending: false })
    .limit(10);

  const validPrev = prevRows?.find(
    (r: any) =>
      Array.isArray(r.efetivo) &&
      r.efetivo.length > 5 &&
      Array.isArray(r.recursos) &&
      r.recursos.length > 5,
  );
  if (validPrev) {
    const notesEnv = parseNotesEnvelope(validPrev.notes);
    return {
      efetivo: validPrev.efetivo,
      recursos: validPrev.recursos,
      outras: validPrev.outras,
      header: notesEnv.header,
    };
  }

  // 2. Se não houver dia anterior (ex.: data muito antiga), buscar o dia posterior mais próximo
  const { data: nextRows } = await supabase
    .from("daily_reports")
    .select("report_date, shift, efetivo, recursos, outras, notes")
    .gte("report_date", dateIso)
    .not("efetivo", "is", null)
    .order("report_date", { ascending: true })
    .order("shift", { ascending: false })
    .limit(10);

  const validNext = nextRows?.find(
    (r: any) =>
      Array.isArray(r.efetivo) &&
      r.efetivo.length > 5 &&
      Array.isArray(r.recursos) &&
      r.recursos.length > 5,
  );
  if (validNext) {
    const notesEnv = parseNotesEnvelope(validNext.notes);
    return {
      efetivo: validNext.efetivo,
      recursos: validNext.recursos,
      outras: validNext.outras,
      header: notesEnv.header,
    };
  }

  // 3. Fallback no report_data (ID 1)
  const { data: rd } = await supabase
    .from("report_data")
    .select("data")
    .eq("id", 1)
    .maybeSingle();

  if (rd?.data && Array.isArray(rd.data.efetivo) && Array.isArray(rd.data.recursos)) {
    return {
      efetivo: rd.data.efetivo,
      recursos: rd.data.recursos,
      outras: rd.data.outras_diarias,
      header: rd.data.header,
    };
  }

  return null;
}

export async function loadReportByDate(
  supabase: SupabaseClient<any>,
  dateIso: string,
): Promise<{ data: SheetsData; found: boolean }> {
  const { data: rows, error } = await supabase
    .from("daily_reports")
    .select("report_date, shift, efetivo, recursos, incendios, outras, notes, updated_at")
    .eq("report_date", dateIso);

  const row = (rows || []).find((r: any) => r.shift === "noturno") || (rows || [])[0] || null;

  const isFound = !error && !!row;
  const shiftLabel = row?.shift === "parcial" ? "Parcial (07:00–18:30)" : "24h (18:30–07:00)";
  const dateStr = formatDateBR(dateIso);
  const acum = await fetchIncendiosAcumulado(supabase, dateIso);

  let rawEfetivoRows = asRows(row?.efetivo);
  let rawRecursosRows = asRows(row?.recursos);
  let rawOutrasRows = asRows(row?.outras);

  // Se o dia não possui efetivo ou recursos próprios gravados, herdamos da prontidão operacional mais próxima
  let donor: Awaited<ReturnType<typeof fetchOperationalDonor>> = null;
  if (rawEfetivoRows.length <= 1 || rawRecursosRows.length === 0) {
    donor = await fetchOperationalDonor(supabase, dateIso);
    if (donor) {
      if (rawEfetivoRows.length <= 1 && donor.efetivo?.length) {
        rawEfetivoRows = donor.efetivo;
      }
      if (rawRecursosRows.length === 0 && donor.recursos?.length) {
        rawRecursosRows = donor.recursos;
      }
      if (rawOutrasRows.length === 0 && donor.outras?.length) {
        rawOutrasRows = donor.outras;
      }
    }
  }

  const rawEfetivo: Array<{ mun: string } & Record<string, any>> = rawEfetivoRows.map((r: any) => {
    const mun = canonicalMunicipio(r.mun ?? r.municipio);
    const isItapiranga = mun.toLowerCase().includes("itapiranga");
    const valCbmam = num(r.cbmam ?? r.ord ?? r.servico);
    const copy: { mun: string } & Record<string, any> = { ...r, mun };
    for (const [k, v] of Object.entries(r)) {
      if (k !== "mun" && k !== "municipio" && typeof v !== "object") {
        copy[k] = num(v);
      }
    }
    copy.cbmam = isItapiranga ? valCbmam || 6 : valCbmam;
    copy.ord = isItapiranga ? num(r.ord) || valCbmam || 6 : valCbmam;
    copy.servico = isItapiranga ? num(r.servico) || valCbmam || 6 : valCbmam;
    copy.seg = num(r.seg);
    copy.brig = isItapiranga ? num(r.brig) || 12 : num(r.brig);
    return copy;
  });
  if (!rawEfetivo.some((r) => r.mun.toLowerCase().includes("itapiranga"))) {
    rawEfetivo.push({ mun: "Itapiranga", cbmam: 6, ord: 6, seg: 0, brig: 12, servico: 6, opamv: 0, opam_ref: 0, inc1: 0, inc2: 0, inc3: 0, cbmsp: 0, prevfogo: 0, fn: 0, brig_mun: 12, brig_semas: 0 });
  }

  const rawInc = asRows(row?.incendios).map((r: any) => ({
    mun: canonicalMunicipio(r.mun ?? r.municipio),
    urb: num(r.urb),
    flor: num(r.flor),
    focos: num(r.focos),
    total_periodo: num(r.total_periodo),
  }));

  const rawOutras = rawOutrasRows.map((r: any) => ({
    mun: canonicalMunicipio(r.mun ?? r.municipio),
    salvamento: num(r.salvamento),
    acidentes: num(r.acidentes),
    aph: num(r.aph),
    prevencao: num(r.prevencao),
    servicos: num(r.servicos),
    total_periodo: num(r.total_periodo),
  }));

  const efetivoConsolidado = ensureAllMunicipios(
    consolidateAndCanonicalizeRows(rawEfetivo, ["cbmam", "ord", "seg", "brig", "servico", "opamv", "opam_ref", "inc1", "inc2", "inc3", "cbmsp", "prevfogo", "fn", "marinha", "sec", "brig_mun", "brig_semas"]),
    (mun) => ({
      mun,
      cbmam: mun.toLowerCase().includes("itapiranga") ? 6 : 0,
      ord: mun.toLowerCase().includes("itapiranga") ? 6 : 0,
      seg: 0,
      brig: mun.toLowerCase().includes("itapiranga") ? 12 : 0,
      servico: mun.toLowerCase().includes("itapiranga") ? 6 : 0,
      opamv: 0,
      opam_ref: 0,
      inc1: 0,
      inc2: 0,
      inc3: 0,
      cbmsp: 0,
      prevfogo: 0,
      fn: 0,
      marinha: 0,
      sec: 0,
      brig_mun: mun.toLowerCase().includes("itapiranga") ? 12 : 0,
      brig_semas: 0,
    }),
  );

  const recursosConsolidados = ensureAllMunicipios(
    normaliseRecursos(rawRecursosRows),
    (mun) => ({
      mun,
      viaturas: 0,
      aeronaves: 0,
      embarcacoes: 0,
    }),
  );

  const incendiosConsolidados = ensureAllMunicipios(
    consolidateAndCanonicalizeRows(rawInc, ["urb", "flor", "focos", "total_periodo"]),
    (mun) => ({
      mun,
      urb: 0,
      flor: 0,
      focos: 0,
      total_periodo: 0,
    }),
  );

  const outrasConsolidadas = ensureAllMunicipios(
    consolidateAndCanonicalizeRows(rawOutras, [
      "salvamento",
      "acidentes",
      "aph",
      "prevencao",
      "servicos",
      "total_periodo",
    ]),
    (mun) => ({
      mun,
      salvamento: 0,
      acidentes: 0,
      aph: 0,
      prevencao: 0,
      servicos: 0,
      total_periodo: 0,
    }),
  );

  const notesEnv = parseNotesEnvelope((row as any)?.notes);
  const headerObj = (
    (notesEnv.header && typeof notesEnv.header === "object" ? notesEnv.header : null) ??
    ((row as any)?.dados_complementares?.header && typeof (row as any).dados_complementares.header === "object" ? (row as any).dados_complementares.header : null) ??
    ((row as any)?.header && typeof (row as any).header === "object" ? (row as any).header : null) ??
    (donor?.header && typeof donor.header === "object" ? donor.header : null) ??
    {}
  ) as Record<string, string>;

  const officialOccurrences = getOccurrencesForDate(dateIso);
  let dayOccurrences = officialOccurrences;
  if (Array.isArray(notesEnv.occurrences) && notesEnv.occurrences.length > 0) {
    const officialMap = new Map<string, OccurrenceRow>();
    for (const o of officialOccurrences) {
      const k = (o.protocolo && o.protocolo !== "-" ? o.protocolo : "") || `${o.horario}|${o.municipio}|${o.endereco}`;
      officialMap.set(k, o);
    }
    dayOccurrences = notesEnv.occurrences.map((saved: any) => {
      const k = (saved.protocolo && saved.protocolo !== "-" ? saved.protocolo : "") || `${saved.horario}|${saved.municipio}|${saved.endereco}`;
      const match = officialMap.get(k);
      return match ? { ...match, ...saved } : saved;
    });
    const savedKeys = new Set(
      notesEnv.occurrences.map((s: any) =>
        (s.protocolo && s.protocolo !== "-" ? s.protocolo : "") || `${s.horario}|${s.municipio}|${s.endereco}`
      )
    );
    for (const o of officialOccurrences) {
      const k = (o.protocolo && o.protocolo !== "-" ? o.protocolo : "") || `${o.horario}|${o.municipio}|${o.endereco}`;
      if (!savedKeys.has(k)) {
        dayOccurrences.push(o);
      }
    }
  }

  // Sempre que há ocorrências do CAD para a data, sintetizamos e harmonizamos
  // as contagens municipais de incêndio a partir das ocorrências oficiais:
  // - Naturezas ambientais (vegetação, florestal, lixo/entulho, lavoura/pastagem/mata) -> Incêndio Florestal (flor)
  // - Demais incêndios (residência, comércio, rede elétrica, veículo) -> Incêndio Urbano (urb)
  // - Não-incêndios (salvamento, acidentes, APH, etc.) -> Outras Ocorrências
  const incTotal = incendiosConsolidados.reduce(
    (sum, r) => sum + (r.urb || 0) + (r.flor || 0) + (r.total_periodo || 0),
    0,
  );
  let finalIncendiosDiario = incendiosConsolidados;
  let finalOutrasDiarias = outrasConsolidadas;

  if (dayOccurrences.length > 0) {
    const munMap = new Map<string, { urb: number; flor: number; focos: number; total_periodo: number }>();
    const outrasMap = new Map<string, { salvamento: number; acidentes: number; aph: number; prevencao: number; servicos: number; total_periodo: number }>();

    for (const occ of dayOccurrences) {
      const mun = canonicalMunicipio(occ.municipio);
      if (!mun || mun === "—") continue;

      const isFlor = isFlorestalAmbiental(occ.natureza);
      const isInc = isIncendio(occ.natureza);

      if (isFlor) {
        const cur = munMap.get(mun) ?? { urb: 0, flor: 0, focos: 0, total_periodo: 0 };
        cur.flor += 1;
        cur.focos += Math.max(1, Number(occ.focos) || 1);
        cur.total_periodo += 1;
        munMap.set(mun, cur);
      } else if (isInc) {
        const cur = munMap.get(mun) ?? { urb: 0, flor: 0, focos: 0, total_periodo: 0 };
        cur.urb += 1;
        cur.focos += Math.max(1, Number(occ.focos) || 1);
        cur.total_periodo += 1;
        munMap.set(mun, cur);
      } else {
        const curO = outrasMap.get(mun) ?? { salvamento: 0, acidentes: 0, aph: 0, prevencao: 0, servicos: 0, total_periodo: 0 };
        const natNorm = String(occ.natureza || "").toLowerCase();
        if (natNorm.includes("samu") || natNorm.includes("aph") || natNorm.includes("hospitalar") || natNorm.includes("socorro")) {
          curO.aph += 1;
        } else if (natNorm.includes("salvamento") || natNorm.includes("busca") || natNorm.includes("resgate") || natNorm.includes("animal")) {
          curO.salvamento += 1;
        } else if (natNorm.includes("acidente") || natNorm.includes("colis") || natNorm.includes("transito")) {
          curO.acidentes += 1;
        } else if (natNorm.includes("prevenc") || natNorm.includes("palestra") || natNorm.includes("vistoria")) {
          curO.prevencao += 1;
        } else {
          curO.servicos += 1;
        }
        curO.total_periodo += 1;
        outrasMap.set(mun, curO);
      }
    }

    finalIncendiosDiario = ensureAllMunicipios(
      Array.from(munMap.entries()).map(([mun, vals]) => ({ mun, ...vals })),
      (mun) => ({ mun, urb: 0, flor: 0, focos: 0, total_periodo: 0 }),
    );

    const outrasTotal = outrasConsolidadas.reduce((sum, r) => sum + (r.total_periodo || 0), 0);
    if (outrasTotal === 0 && outrasMap.size > 0) {
      finalOutrasDiarias = ensureAllMunicipios(
        Array.from(outrasMap.entries()).map(([mun, vals]) => ({ mun, ...vals })),
        (mun) => ({ mun, salvamento: 0, acidentes: 0, aph: 0, prevencao: 0, servicos: 0, total_periodo: 0 }),
      );
    }
  }

  const rawCoord = headerObj.coordSituacao ?? "CEL QOBM FERREIRA";
  const safeCoordSituacao = rawCoord.replace(/^TC\s+/i, "CEL ");
  const rawCoordenador = headerObj.coordenador ?? "CEL QOBM CRISTIANO BRAZ FERREIRA";
  const safeCoordenador = rawCoordenador.replace(/^TC\s+/i, "CEL ");

  const harmonizedSections = harmonizeMunicipalitySections(
    efetivoConsolidado,
    recursosConsolidados,
    finalIncendiosDiario,
    (mun) => ({
      mun,
      cbmam: mun.toLowerCase().includes("itapiranga") ? 6 : 0,
      ord: mun.toLowerCase().includes("itapiranga") ? 6 : 0,
      seg: 0,
      brig: mun.toLowerCase().includes("itapiranga") ? 12 : 0,
      servico: mun.toLowerCase().includes("itapiranga") ? 6 : 0,
      opamv: 0,
      opam_ref: 0,
      inc1: 0,
      inc2: 0,
      inc3: 0,
      cbmsp: 0,
      prevfogo: 0,
      fn: 0,
      brig_mun: mun.toLowerCase().includes("itapiranga") ? 12 : 0,
      brig_semas: 0,
    }),
    (mun) => ({
      mun,
      viaturas: 0,
      aeronaves: 0,
      embarcacoes: 0,
    }),
    (mun) => ({
      mun,
      urb: 0,
      flor: 0,
      focos: 0,
      total_periodo: 0,
    }),
  );

  const data: SheetsData = {
    header: {
      titulo: headerObj.titulo ?? "Relatório Diário — Sala de Situação",
      periodo: headerObj.periodo ?? `${dateStr} · ${shiftLabel}`,
      proximoPeriodo: headerObj.proximoPeriodo ?? "",
      reuniaoPlanejamento: headerObj.reuniaoPlanejamento ?? `${dateStr} – 8H15`,
      reuniaoBriefing: headerObj.reuniaoBriefing ?? `${dateStr} – 8H30`,
      comandante: headerObj.comandante ?? "CEL QOBM BORGES",
      chefeCapital: headerObj.chefeCapital ?? "CEL QOBM MENEZES",
      chefeInterior: headerObj.chefeInterior ?? "CEL QOBM MONTEIRO",
      coordSituacao: safeCoordSituacao,
      coordenador: safeCoordenador,
      subcomandante: headerObj.subcomandante ?? "Subcomandante-Geral do CBMAM",
    },
    efetivo: harmonizedSections.efetivo as any,
    recursos: harmonizedSections.recursos as any,
    incendios_diario: harmonizedSections.incendios as any,
    incendios_acumulado: Array.isArray(notesEnv.incendios_acumulado) && notesEnv.incendios_acumulado.length > 0
      ? notesEnv.incendios_acumulado
      : acum,
    outras_diarias: finalOutrasDiarias,
    occurrences: dayOccurrences,
  };

  return { data, found: isFound || dayOccurrences.length > 0 || !!donor };
}

/**
 * Carrega e agrega dados de um período de tempo.
 */
export async function loadReportRange(
  supabase: SupabaseClient<any>,
  startIso: string,
  endIso: string,
): Promise<SheetsData> {
  const rangeOccurrences = getOccurrencesForRange(startIso, endIso);

  const { data: rows, error } = await supabase
    .from("daily_reports")
    .select("report_date, shift, efetivo, recursos, incendios, outras")
    .gte("report_date", startIso)
    .lte("report_date", endIso)
    .order("report_date", { ascending: true });

  const validRows = (() => {
    if (error || !rows || !rows.length) return [];
    const byDate = new Map<string, any>();
    for (const r of rows) {
      const cur = byDate.get(r.report_date);
      if (!cur || (r.shift === "noturno" && cur.shift !== "noturno")) {
        byDate.set(r.report_date, r);
      }
    }
    return Array.from(byDate.values());
  })();

  let aggregatedInc = validRows.length > 0
    ? consolidateAndCanonicalizeRows(
        validRows.flatMap((r) => asRows(r.incendios)),
        ["urb", "flor", "focos", "total_periodo"],
      )
    : [];

  const incRangeTotal = (aggregatedInc as any[]).reduce(
    (sum, r) => sum + (Number(r.urb) || 0) + (Number(r.flor) || 0) + (Number(r.total_periodo) || 0),
    0,
  );

  // Se não há dados agregados do daily_reports mas há ocorrências catalogadas, agregamos das ocorrências:
  if (incRangeTotal === 0 && rangeOccurrences.length > 0) {
    const munMap = new Map<string, { urb: number; flor: number; focos: number; total_periodo: number }>();
    for (const occ of rangeOccurrences) {
      const mun = canonicalMunicipio(occ.municipio);
      if (!mun || mun === "—") continue;
      const cur = munMap.get(mun) ?? { urb: 0, flor: 0, focos: 0, total_periodo: 0 };
      const isFlor = isFlorestalAmbiental(occ.natureza);
      const isInc = isIncendio(occ.natureza);
      if (isFlor) {
        cur.flor += 1;
        cur.focos += Math.max(1, Number(occ.focos) || 1);
        cur.total_periodo += 1;
      } else if (isInc) {
        cur.urb += 1;
        cur.focos += Math.max(1, Number(occ.focos) || 1);
        cur.total_periodo += 1;
      }
      munMap.set(mun, cur);
    }
    aggregatedInc = ensureAllMunicipios(
      Array.from(munMap.entries()).map(([mun, vals]) => ({ mun, ...vals })),
      (mun) => ({ mun, urb: 0, flor: 0, focos: 0, total_periodo: 0 }),
    );
  }

  const aggregatedOutras = consolidateAndCanonicalizeRows(
    validRows.flatMap((r) => asRows(r.outras)),
    ["salvamento", "acidentes", "aph", "prevencao", "servicos", "total_periodo"],
  );

  // Efetivo e Recursos pegamos o snapshot do último dia do range
  const lastRow = validRows.length > 0 ? validRows[validRows.length - 1] : null;
  let lastEfetivo = lastRow
    ? (consolidateAndCanonicalizeRows(asRows(lastRow.efetivo), ["cbmam", "ord", "seg", "brig"]) as any)
    : [];
  let lastRecursos = lastRow ? normaliseRecursos(asRows(lastRow.recursos)) : [];

  if (lastEfetivo.length === 0 || lastRecursos.length === 0) {
    const donor = await fetchOperationalDonor(supabase, endIso);
    if (donor) {
      if (lastEfetivo.length === 0 && donor.efetivo?.length) {
        lastEfetivo = consolidateAndCanonicalizeRows(asRows(donor.efetivo), ["cbmam", "ord", "seg", "brig"]);
      }
      if (lastRecursos.length === 0 && donor.recursos?.length) {
        lastRecursos = normaliseRecursos(asRows(donor.recursos));
      }
    }
  }

  const efetivoConsolidado = ensureAllMunicipios(
    lastEfetivo.map((r: any) => ({
      ...r,
      cbmam: num(r.cbmam ?? r.ord ?? r.servico),
    })),
    (mun) => ({
      mun,
      cbmam: 0,
      ord: 0,
      seg: 0,
      brig: 0,
    }),
  );

  const recursosConsolidados = ensureAllMunicipios(
    lastRecursos,
    (mun) => ({
      mun,
      viaturas: 0,
      aeronaves: 0,
      embarcacoes: 0,
    }),
  );

  return {
    header: {
      titulo: "Relatório Consolidado de Período",
      periodo: `${formatDateBR(startIso)} a ${formatDateBR(endIso)}`,
      comandante: "CEL QOBM BORGES",
      coordSituacao: "CEL QOBM FERREIRA",
      coordenador: "CEL QOBM CRISTIANO BRAZ FERREIRA",
    },
    efetivo: efetivoConsolidado,
    recursos: recursosConsolidados,
    incendios_diario: aggregatedInc as any,
    incendios_acumulado: await fetchIncendiosAcumulado(supabase, endIso),
    outras_diarias: aggregatedOutras as any,
    occurrences: rangeOccurrences,
    isRange: true,
    startDate: startIso,
    endDate: endIso,
  };
}
