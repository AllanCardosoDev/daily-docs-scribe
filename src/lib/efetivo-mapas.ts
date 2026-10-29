import * as XLSX from "xlsx";
import type { SheetsData, EfetivoRow } from "./sheets.types";
import { fmtDateBR, fmtDateStamp } from "./report-date";
import { canonicalMunicipio, isManaus } from "./municipio-order";

// =============================================================================
// ESTRUTURA INSTITUCIONAL DE EFETIVO · PADRÃO OFICIAL CBMAM / MAPAS
// =============================================================================

export const EFETIVO_MUNICIPIOS_PADRAO = [
  "Manaus",
  "Apuí",
  "Atalaia do Norte",
  "Autazes",
  "Barcelos",
  "Coari",
  "Envira",
  "Humaitá",
  "Iranduba",
  "Itacoatiara",
  "Itapiranga",
  "Jutaí",
  "Lábrea",
  "Manaquiri",
  "Manacapuru",
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
];

export const EFETIVO_BASES_PADRAO = [
  "Autazes Posto Km 53",
  "Boa Vista do Ramos",
  "Boca do Acre",
  "Borba",
  "Caapiranga",
  "Canutama",
  "Careiro Castanho",
  "Careiro da Várzea",
  "Urucurituba",
];

// Dados consolidados oficiais atualizados da planilha EFETIVO.xlsx (1.533 operacionais)
export const BENCHMARK_MUNICIPIOS_1533: Record<string, Partial<EfetivoMapasItem>> = {
  "Manaus": { serv_ord: 406, fn: 14 },
  "Apuí": { serv_ord: 5, inc1: 3, inc3: 2, fn: 4, brig_semas: 15 },
  "Atalaia do Norte": { serv_ord: 8, brig_mun: 15 },
  "Autazes": { serv_ord: 5, opam_ref: 2, inc1: 6, inc2: 3, prevfogo: 26, brig_mun: 13, brig_semas: 6 },
  "Barcelos": { serv_ord: 7, brig_mun: 12 },
  "Coari": { serv_ord: 7, opam_ref: 1, inc1: 1, inc2: 2, inc3: 1, brig_mun: 23, brig_semas: 12 },
  "Envira": { serv_ord: 5, brig_mun: 11 },
  "Humaitá": { serv_ord: 29, opamv: 4, opam_ref: 2, inc3: 3, brig_semas: 15 },
  "Iranduba": { serv_ord: 28, opamv: 3, opam_ref: 12, inc1: 2, inc2: 4, inc3: 3 },
  "Itacoatiara": { serv_ord: 24, opam_ref: 14, inc1: 9, inc2: 6, inc3: 6, prevfogo: 70 },
  "Itapiranga": { serv_ord: 6, opam_ref: 4, inc1: 3, inc3: 1, brig_mun: 11 },
  "Jutaí": { serv_ord: 4, brig_mun: 11 },
  "Lábrea": { serv_ord: 5, inc1: 3, fn: 4, brig_mun: 10, brig_semas: 15 },
  "Manaquiri": { serv_ord: 7, opamv: 2, inc2: 4, inc3: 2, brig_mun: 7, brig_semas: 9 },
  "Manacapuru": { serv_ord: 30, opam_ref: 1, fn: 6 },
  "Manicoré": { serv_ord: 8, opamv: 2, inc2: 3, brig_mun: 20, brig_semas: 7 },
  "Maués": { serv_ord: 5, inc3: 4, brig_mun: 13 },
  "Nhamundá": { serv_ord: 1, opamv: 2, brig_mun: 15 },
  "Novo Airão": { serv_ord: 15, inc2: 3, inc3: 2, brig_mun: 2 },
  "Novo Aripuanã": { serv_ord: 4, opamv: 1, inc1: 2, brig_semas: 12 },
  "Parintins": { serv_ord: 35, opam_ref: 10 },
  "Presidente Figueiredo": { serv_ord: 26, inc3: 3, brig_mun: 3 },
  "Rio Preto da Eva": { serv_ord: 22, inc1: 5, inc2: 5, inc3: 3, brig_mun: 2 },
  "Tabatinga": { serv_ord: 26, brig_mun: 3 },
  "Tapauá": { serv_ord: 3, opamv: 2, inc1: 2, brig_mun: 5, brig_semas: 12 },
  "Tefé": { serv_ord: 26, brig_mun: 5 },
};

export const BENCHMARK_BASES_1533: Record<string, Partial<EfetivoMapasItem>> = {
  "Autazes Posto Km 53": { opam_ref: 15, inc3: 2, brig_semas: 6 },
  "Boa Vista do Ramos": { opam_ref: 4, inc2: 4, marinha: 6, brig_mun: 11 },
  "Boca do Acre": { opamv: 2, inc1: 3, inc2: 2, brig_semas: 15 },
  "Borba": { opamv: 3, brig_semas: 10 },
  "Caapiranga": { opam_ref: 2, inc3: 3, brig_mun: 9 },
  "Canutama": { opamv: 2, brig_semas: 11 },
  "Careiro Castanho": { opamv: 2, opam_ref: 10, inc2: 4, inc3: 2, brig_semas: 8 },
  "Careiro da Várzea": { opam_ref: 17, prevfogo: 40, fn: 6 },
  "Urucurituba": { opamv: 2, opam_ref: 1, fn: 6, brig_mun: 18 },
};

export interface EfetivoMapasItem {
  id: string;
  nome: string;
  tipo: "capital" | "interior" | "base";
  serv_ord: number;
  opamv: number;
  opam_ref: number;
  inc1: number;
  inc2: number;
  inc3: number;
  cbmsp: number;
  prevfogo: number;
  fn: number;
  marinha: number;
  brig_mun: number;
  brig_semas: number;
  total: number;
}

export interface ResumoMissaoItem {
  missao: string;
  label: string;
  capital: number;
  interior: number;
  total: number;
  perc: string;
}

export interface EfetivoMapasCalculado {
  municipios: EfetivoMapasItem[];
  bases: EfetivoMapasItem[];
  resumo: ResumoMissaoItem[];
  totals: {
    capital: number;
    interior: number;
    bases: number;
    totalGeral: number;
  };
}

export const norm = (s: unknown) =>
  String(s ?? "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .trim();

function getRowValue(r: any, ...keys: string[]): number {
  if (!r) return 0;
  for (const k of keys) {
    if (r[k] !== undefined && r[k] !== null && r[k] !== "") {
      const v = Number(r[k]);
      if (!isNaN(v)) return v;
    }
  }
  return 0;
}

function extractEfetivoValues(
  r: any,
  nome: string,
  tipo: "capital" | "interior" | "base",
  fallbackBenchmark?: Partial<EfetivoMapasItem>,
  mode: "diario" | "consolidado" = "diario",
): EfetivoMapasItem {
  const isExplicitCustom = !!r?._custom;
  const hasData = r && Object.keys(r).some((k) => k !== "mun" && k !== "municipio" && Number(r[k]) > 0);
  const fb = fallbackBenchmark || {};

  // Se foi explicitamente salvo/editado pelo usuário com _custom: true, respeita fielmente os valores gravados
  if (isExplicitCustom) {
    const serv_ord = Number(r.serv_ord ?? r.cbmam ?? r.servico ?? r.ord ?? 0);
    const opamv = Number(r.opamv ?? 0);
    const opam_ref = Number(r.opam_ref ?? 0);
    const inc1 = Number(r.inc1 ?? 0);
    const inc2 = Number(r.inc2 ?? 0);
    const inc3 = Number(r.inc3 ?? 0);
    const cbmsp = Number(r.cbmsp ?? 0);
    const prevfogo = Number(r.prevfogo ?? 0);
    const fn = Number(r.fn ?? 0);
    const marinha = Number(r.marinha ?? 0);
    const brig_mun = Number(r.brig_mun ?? 0);
    const brig_semas = Number(r.brig_semas ?? 0);
    const total =
      serv_ord +
      opamv +
      opam_ref +
      inc1 +
      inc2 +
      inc3 +
      cbmsp +
      prevfogo +
      fn +
      marinha +
      brig_mun +
      brig_semas;

    return {
      id: `muni_${norm(nome).replace(/\s+/g, "_")}`,
      nome,
      tipo,
      serv_ord,
      opamv,
      opam_ref,
      inc1,
      inc2,
      inc3,
      cbmsp,
      prevfogo,
      fn,
      marinha,
      brig_mun,
      brig_semas,
      total,
    };
  }

  // Se estiver em modo consolidado e não houver customização explícita, usa o benchmark oficial 1.533
  if (mode === "consolidado") {
    const serv_ord = fb.serv_ord ?? 0;
    const opamv = fb.opamv ?? 0;
    const opam_ref = fb.opam_ref ?? 0;
    const inc1 = fb.inc1 ?? 0;
    const inc2 = fb.inc2 ?? 0;
    const inc3 = fb.inc3 ?? 0;
    const cbmsp = fb.cbmsp ?? 0;
    const prevfogo = fb.prevfogo ?? 0;
    const fn = fb.fn ?? 0;
    const marinha = fb.marinha ?? 0;
    const brig_mun = fb.brig_mun ?? 0;
    const brig_semas = fb.brig_semas ?? 0;
    const total =
      serv_ord +
      opamv +
      opam_ref +
      inc1 +
      inc2 +
      inc3 +
      cbmsp +
      prevfogo +
      fn +
      marinha +
      brig_mun +
      brig_semas;

    return {
      id: `muni_${norm(nome).replace(/\s+/g, "_")}`,
      nome,
      tipo,
      serv_ord,
      opamv,
      opam_ref,
      inc1,
      inc2,
      inc3,
      cbmsp,
      prevfogo,
      fn,
      marinha,
      brig_mun,
      brig_semas,
      total,
    };
  }

  const serv_ord = hasData ? getRowValue(r, "cbmam", "servico", "ord", "serv_ord") : (fb.serv_ord ?? 0);
  const opamv = hasData ? getRowValue(r, "opamv") : (fb.opamv ?? 0);
  const opam_ref = hasData ? getRowValue(r, "opam_ref") : (fb.opam_ref ?? 0);
  const inc1 = hasData ? getRowValue(r, "inc1", "inc_1") : (fb.inc1 ?? 0);
  const inc2 = hasData ? getRowValue(r, "inc2", "inc_2") : (fb.inc2 ?? 0);
  const inc3 = hasData ? getRowValue(r, "inc3", "inc_3") : (fb.inc3 ?? 0);
  const cbmsp = hasData ? getRowValue(r, "cbmsp") : (fb.cbmsp ?? 0);
  const prevfogo = hasData ? getRowValue(r, "prevfogo") : (fb.prevfogo ?? 0);
  const fn = hasData ? getRowValue(r, "fn") : (fb.fn ?? 0);
  const marinha = hasData ? getRowValue(r, "marinha", "icmbio") : (fb.marinha ?? 0);
  const brig_mun = hasData ? getRowValue(r, "brig_mun") : (fb.brig_mun ?? 0);
  const brig_semas = hasData ? getRowValue(r, "brig_semas", "brig_sema") : (fb.brig_semas ?? 0);

  const total =
    serv_ord +
    opamv +
    opam_ref +
    inc1 +
    inc2 +
    inc3 +
    cbmsp +
    prevfogo +
    fn +
    marinha +
    brig_mun +
    brig_semas;

  return {
    id: `muni_${norm(nome).replace(/\s+/g, "_")}`,
    nome,
    tipo,
    serv_ord,
    opamv,
    opam_ref,
    inc1,
    inc2,
    inc3,
    cbmsp,
    prevfogo,
    fn,
    marinha,
    brig_mun,
    brig_semas,
    total,
  };
}

/**
 * Processa as matrizes de Efetivo do sistema gerando:
 * 1. Municípios (completos, priorizando os 26 oficiais e incluindo outros se existirem)
 * 2. Bases Temporárias (as 9 bases oficiais)
 * 3. Resumo por Missão (Capital x Interior x Total)
 * 
 * Se mode === "consolidado", utiliza a matriz oficial consolidada (1.533 operacionais).
 * Se mode === "diario", prioriza os dados inseridos na tabela do dia pelo operador.
 */
export function buildEfetivoMapasData(
  data: SheetsData,
  mode: "diario" | "consolidado" = "diario",
): EfetivoMapasCalculado {
  const existingRows = data?.efetivo || [];
  const rowMap = new Map<string, any>();

  for (const r of existingRows) {
    if (!r?.mun) continue;
    const can = canonicalMunicipio(r.mun);
    rowMap.set(norm(can), r);
    rowMap.set(norm(r.mun), r);
  }

  // 1. Monta as 9 Bases Temporárias
  const baseNormalizedSet = new Set(EFETIVO_BASES_PADRAO.map((b) => norm(b)));
  const bases: EfetivoMapasItem[] = EFETIVO_BASES_PADRAO.map((baseName) => {
    const raw = rowMap.get(norm(baseName));
    const fb = BENCHMARK_BASES_1533[baseName] || {};
    return extractEfetivoValues(raw, baseName, "base", fb, mode);
  });

  // 2. Monta os Municípios
  const muniNames = [...EFETIVO_MUNICIPIOS_PADRAO];
  // Adiciona municípios adicionais da tabela do dia que não estão na lista fixa nem nas bases
  for (const r of existingRows) {
    if (!r?.mun) continue;
    const can = canonicalMunicipio(r.mun);
    const n = norm(can);
    if (!baseNormalizedSet.has(n) && !muniNames.some((m) => norm(m) === n)) {
      muniNames.push(can);
    }
  }

  const municipios: EfetivoMapasItem[] = muniNames.map((muniName) => {
    const raw = rowMap.get(norm(muniName));
    const tipo = isManaus(muniName) ? "capital" : "interior";
    const fb = BENCHMARK_MUNICIPIOS_1533[muniName] || {};
    return extractEfetivoValues(raw, muniName, tipo, fb, mode);
  });

  // 3. Resumo por Missão (Capital x Interior x Total)
  const missoesDefs = [
    { key: "serv_ord", label: "SV ORD (CBMAM)", short: "SV ORD" },
    { key: "opamv", label: "OPAM Verão (26/10)", short: "OPAM" },
    { key: "opam_ref", label: "OPAM Reforço (07/11)", short: "OPAM REF" },
    { key: "inc1", label: "INC 1 - 29/10", short: "INC 1 - 29/10" },
    { key: "inc2", label: "INC 2 - 17/11", short: "INC 2- 17/11" },
    { key: "inc3", label: "INC 3 - 30/10", short: "INC3 - 30/10" },
    { key: "cbmsp", label: "CBMSP (São Paulo)", short: "CBMSP" },
    { key: "prevfogo", label: "PREVFOGO / IBAMA", short: "PREVFOGO" },
    { key: "fn", label: "Força Nacional", short: "FN" },
    { key: "brig_mun", label: "Brigadista Municipal", short: "BRIG MUN" },
    { key: "brig_semas", label: "Brigadista SEMA", short: "BRIG SEM" },
  ];

  let totalCapital = 0;
  let totalInterior = 0;
  let totalBases = 0;

  for (const m of municipios) {
    if (m.tipo === "capital") {
      totalCapital += m.total;
    } else {
      totalInterior += m.total;
    }
  }
  for (const b of bases) {
    totalBases += b.total;
    totalInterior += b.total; // Bases contam como Interior no quadro institucional
  }

  const totalGeral = totalCapital + totalInterior;

  const resumo: ResumoMissaoItem[] = missoesDefs.map((def) => {
    let cap = 0;
    let inte = 0;

    for (const m of municipios) {
      const val = (m as any)[def.key] || 0;
      if (m.tipo === "capital") {
        cap += val;
      } else {
        inte += val;
      }
    }

    for (const b of bases) {
      const val = (b as any)[def.key] || 0;
      inte += val;
    }

    const tot = cap + inte;
    const perc = totalGeral > 0 ? ((tot / totalGeral) * 100).toFixed(1) + "%" : "0.0%";

    return {
      missao: def.short,
      label: def.label,
      capital: cap,
      interior: inte,
      total: tot,
      perc,
    };
  });

  return {
    municipios,
    bases,
    resumo,
    totals: {
      capital: totalCapital,
      interior: totalInterior,
      bases: totalBases,
      totalGeral,
    },
  };
}

// =============================================================================
// CONSTRUÇÃO E EXPORTAÇÃO EXCEL FIEL AO MODELO EFETIVO.XLSX (MAPAS)
// =============================================================================

export function buildEfetivoMapasWorkbook(
  data: SheetsData,
  reportDate: Date | null = null,
): XLSX.WorkBook {
  const calcConsolidado = buildEfetivoMapasData(data, "consolidado");
  const calcDiario = buildEfetivoMapasData(data, "diario");
  const wb = XLSX.utils.book_new();

  // ---------------------------------------------------------------------------
  // ABA 1: EFETIVO (Layout 3-em-1 lado a lado fiel a EFETIVO.xlsx com merges)
  // ---------------------------------------------------------------------------
  const aoa: any[][] = [];
  const merges: XLSX.Range[] = [];

  // Linha 0 (vazia)
  aoa.push([]);

  // Linha 1 (Títulos dos blocos)
  const row1: any[] = [];
  row1[0] = "EFETIVO";
  row1[13] = "EFETIVO";
  row1[29] = "RESUMO EFETIVO";
  aoa.push(row1);

  // Linha 2 (Cabeçalhos das colunas)
  const row2: any[] = [];
  // Bloco 1: Municípios (Cols 0-11)
  row2[0] = "MUNICÍPIO";
  row2[1] = "SERVIÇO OP";
  row2[2] = "OPAMV 26/10";
  row2[3] = "OPAM REF 07/11";
  row2[4] = "INC 1- 29/10";
  row2[5] = "INC 2 - 17/11";
  row2[6] = "INC3 - 30/10";
  row2[7] = "CBMSP";
  row2[8] = "PREVFOGO";
  row2[9] = "FN";
  row2[10] = "BRIGADISTA MUN";
  row2[11] = "BRIGADISTA SEMAS";

  // Bloco 2: Bases Temporárias (Cols 13-27)
  row2[13] = "BASES TEMPORÁRIAS";
  row2[17] = "OPAMV 26/10";
  row2[18] = "OPAM REF 07/11";
  row2[19] = "INC 1- 29/10";
  row2[20] = "INC 2 - 17/11";
  row2[21] = "INC3 - 30/10";
  row2[22] = "CBMSP";
  row2[23] = "PREVFOGO";
  row2[24] = "MARINHA";
  row2[25] = "FN";
  row2[26] = "BRIGADISTA MUNC.";
  row2[27] = "BRIGADISTA SEMAS";

  // Bloco 3: Resumo Efetivo (Cols 29-35)
  row2[29] = "MISSÃO";
  row2[32] = "CAPITAL";
  row2[33] = "INTERIOR";
  row2[35] = "TOTAL";

  aoa.push(row2);

  // Merges do cabeçalho
  merges.push({ s: { r: 1, c: 13 }, e: { r: 1, c: 27 } }); // EFETIVO (BASES)
  merges.push({ s: { r: 1, c: 29 }, e: { r: 1, c: 35 } }); // RESUMO EFETIVO
  merges.push({ s: { r: 2, c: 13 }, e: { r: 2, c: 16 } }); // BASES TEMPORÁRIAS
  merges.push({ s: { r: 2, c: 29 }, e: { r: 2, c: 31 } }); // MISSÃO
  merges.push({ s: { r: 2, c: 33 }, e: { r: 2, c: 34 } }); // INTERIOR
  merges.push({ s: { r: 2, c: 35 }, e: { r: 2, c: 36 } }); // TOTAL

  // Preenche as linhas de dados (Linha 3 em diante)
  const maxRows = Math.max(
    calcConsolidado.municipios.length + 1,
    calcConsolidado.bases.length + 1,
    calcConsolidado.resumo.length + 1
  );

  for (let i = 0; i < maxRows; i++) {
    const row: any[] = [];
    const rIdx = i + 3;

    // 1. Dados do Bloco da Esquerda (Municípios)
    if (i < calcConsolidado.municipios.length) {
      const m = calcConsolidado.municipios[i];
      row[0] = m.nome;
      row[1] = m.serv_ord || "";
      row[2] = m.opamv || "";
      row[3] = m.opam_ref || "";
      row[4] = m.inc1 || "";
      row[5] = m.inc2 || "";
      row[6] = m.inc3 || "";
      row[7] = m.cbmsp || "";
      row[8] = m.prevfogo || "";
      row[9] = m.fn || "";
      row[10] = m.brig_mun || "";
      row[11] = m.brig_semas || "";
    } else if (i === calcConsolidado.municipios.length) {
      // Linha TOTAL de Municípios
      row[0] = "TOTAL";
      row[1] = calcConsolidado.municipios.reduce((s, m) => s + m.serv_ord, 0);
      row[2] = calcConsolidado.municipios.reduce((s, m) => s + m.opamv, 0);
      row[3] = calcConsolidado.municipios.reduce((s, m) => s + m.opam_ref, 0);
      row[4] = calcConsolidado.municipios.reduce((s, m) => s + m.inc1, 0);
      row[5] = calcConsolidado.municipios.reduce((s, m) => s + m.inc2, 0);
      row[6] = calcConsolidado.municipios.reduce((s, m) => s + m.inc3, 0);
      row[7] = calcConsolidado.municipios.reduce((s, m) => s + m.cbmsp, 0);
      row[8] = calcConsolidado.municipios.reduce((s, m) => s + m.prevfogo, 0);
      row[9] = calcConsolidado.municipios.reduce((s, m) => s + m.fn, 0);
      row[10] = calcConsolidado.municipios.reduce((s, m) => s + m.brig_mun, 0);
      row[11] = calcConsolidado.municipios.reduce((s, m) => s + m.brig_semas, 0);
    }

    // 2. Dados do Bloco do Meio (Bases Temporárias)
    if (i < calcConsolidado.bases.length) {
      const b = calcConsolidado.bases[i];
      row[13] = b.nome;
      row[17] = b.opamv || "";
      row[18] = b.opam_ref || "";
      row[19] = b.inc1 || "";
      row[20] = b.inc2 || "";
      row[21] = b.inc3 || "";
      row[22] = b.cbmsp || "";
      row[23] = b.prevfogo || "";
      row[24] = b.marinha || "";
      row[25] = b.fn || "";
      row[26] = b.brig_mun || "";
      row[27] = b.brig_semas || "";
      merges.push({ s: { r: rIdx, c: 13 }, e: { r: rIdx, c: 16 } });
    } else if (i === calcConsolidado.bases.length) {
      // Linha TOTAL de Bases
      row[13] = "TOTAL";
      row[17] = calcConsolidado.bases.reduce((s, b) => s + b.opamv, 0);
      row[18] = calcConsolidado.bases.reduce((s, b) => s + b.opam_ref, 0);
      row[19] = calcConsolidado.bases.reduce((s, b) => s + b.inc1, 0);
      row[20] = calcConsolidado.bases.reduce((s, b) => s + b.inc2, 0);
      row[21] = calcConsolidado.bases.reduce((s, b) => s + b.inc3, 0);
      row[22] = calcConsolidado.bases.reduce((s, b) => s + b.cbmsp, 0);
      row[23] = calcConsolidado.bases.reduce((s, b) => s + b.prevfogo, 0);
      row[24] = calcConsolidado.bases.reduce((s, b) => s + b.marinha, 0);
      row[25] = calcConsolidado.bases.reduce((s, b) => s + b.fn, 0);
      row[26] = calcConsolidado.bases.reduce((s, b) => s + b.brig_mun, 0);
      row[27] = calcConsolidado.bases.reduce((s, b) => s + b.brig_semas, 0);
      merges.push({ s: { r: rIdx, c: 13 }, e: { r: rIdx, c: 16 } });
    }

    // 3. Dados do Bloco da Direita (Resumo Efetivo)
    if (i < calcConsolidado.resumo.length) {
      const res = calcConsolidado.resumo[i];
      row[29] = res.missao;
      row[32] = res.capital;
      row[33] = res.interior;
      row[35] = res.total;
      merges.push({ s: { r: rIdx, c: 29 }, e: { r: rIdx, c: 31 } });
      merges.push({ s: { r: rIdx, c: 33 }, e: { r: rIdx, c: 34 } });
      merges.push({ s: { r: rIdx, c: 35 }, e: { r: rIdx, c: 36 } });
    } else if (i === calcConsolidado.resumo.length) {
      // Linha TOTAL Geral do Resumo
      row[29] = "TOTAL";
      row[32] = calcConsolidado.totals.capital;
      row[33] = calcConsolidado.totals.interior;
      row[35] = calcConsolidado.totals.totalGeral;
      merges.push({ s: { r: rIdx, c: 29 }, e: { r: rIdx, c: 31 } });
      merges.push({ s: { r: rIdx, c: 33 }, e: { r: rIdx, c: 34 } });
      merges.push({ s: { r: rIdx, c: 35 }, e: { r: rIdx, c: 36 } });
    }

    aoa.push(row);
  }

  const wsEfetivo = XLSX.utils.aoa_to_sheet(aoa);
  wsEfetivo["!merges"] = merges;
  XLSX.utils.book_append_sheet(wb, wsEfetivo, "EFETIVO");

  // ---------------------------------------------------------------------------
  // ABA 2: EFETIVO_DIARIO (Dados do Dia preenchidos na Inserção)
  // ---------------------------------------------------------------------------
  const dateStr = reportDate ? fmtDateBR(reportDate) : fmtDateBR(new Date());
  const flatDiario = [
    ...calcDiario.municipios.map((m) => ({
      Data: dateStr,
      Tipo: m.tipo === "capital" ? "Capital" : "Interior",
      Localidade: m.nome,
      "Serviço Ordinário (CBMAM)": m.serv_ord,
      "OPAM Verão": m.opamv,
      "OPAM Reforço": m.opam_ref,
      "INC 1": m.inc1,
      "INC 2": m.inc2,
      "INC 3": m.inc3,
      CBMSP: m.cbmsp,
      PREVFOGO: m.prevfogo,
      "Força Nacional": m.fn,
      "Marinha/ICMBio": m.marinha,
      "Brigadista Municipal": m.brig_mun,
      "Brigadista SEMA": m.brig_semas,
      Total: m.total,
    })),
    ...calcDiario.bases.map((b) => ({
      Data: dateStr,
      Tipo: "Base Temporária",
      Localidade: b.nome,
      "Serviço Ordinário (CBMAM)": b.serv_ord,
      "OPAM Verão": b.opamv,
      "OPAM Reforço": b.opam_ref,
      "INC 1": b.inc1,
      "INC 2": b.inc2,
      "INC 3": b.inc3,
      CBMSP: b.cbmsp,
      PREVFOGO: b.prevfogo,
      "Força Nacional": b.fn,
      "Marinha/ICMBio": b.marinha,
      "Brigadista Municipal": b.brig_mun,
      "Brigadista SEMA": b.brig_semas,
      Total: b.total,
    })),
  ];
  const wsDiario = XLSX.utils.json_to_sheet(flatDiario);
  XLSX.utils.book_append_sheet(wb, wsDiario, "EFETIVO_DIARIO");

  // ---------------------------------------------------------------------------
  // ABA 3: EFETIVO_CONSOLIDADO (Matriz Geral Consolidada 1.533)
  // ---------------------------------------------------------------------------
  const flatConsolidado = [
    ...calcConsolidado.municipios.map((m) => ({
      Escopo: "Operação Amazonas + Verde",
      Tipo: m.tipo === "capital" ? "Capital" : "Interior",
      Localidade: m.nome,
      "Serviço Ordinário (CBMAM)": m.serv_ord,
      "OPAM Verão": m.opamv,
      "OPAM Reforço": m.opam_ref,
      "INC 1": m.inc1,
      "INC 2": m.inc2,
      "INC 3": m.inc3,
      CBMSP: m.cbmsp,
      PREVFOGO: m.prevfogo,
      "Força Nacional": m.fn,
      "Marinha/ICMBio": m.marinha,
      "Brigadista Municipal": m.brig_mun,
      "Brigadista SEMA": m.brig_semas,
      Total: m.total,
    })),
    ...calcConsolidado.bases.map((b) => ({
      Escopo: "Operação Amazonas + Verde",
      Tipo: "Base Temporária",
      Localidade: b.nome,
      "Serviço Ordinário (CBMAM)": b.serv_ord,
      "OPAM Verão": b.opamv,
      "OPAM Reforço": b.opam_ref,
      "INC 1": b.inc1,
      "INC 2": b.inc2,
      "INC 3": b.inc3,
      CBMSP: b.cbmsp,
      PREVFOGO: b.prevfogo,
      "Força Nacional": b.fn,
      "Marinha/ICMBio": b.marinha,
      "Brigadista Municipal": b.brig_mun,
      "Brigadista SEMA": b.brig_semas,
      Total: b.total,
    })),
  ];
  const wsConsolidado = XLSX.utils.json_to_sheet(flatConsolidado);
  XLSX.utils.book_append_sheet(wb, wsConsolidado, "EFETIVO_CONSOLIDADO");

  // ---------------------------------------------------------------------------
  // ABA 4: RESUMO_MISSOES (Resumo comparativo e percentual de forças)
  // ---------------------------------------------------------------------------
  const resumoFlat = [
    ...calcConsolidado.resumo.map((r) => ({
      Missão: r.missao,
      Denominação: r.label,
      Capital: r.capital,
      Interior: r.interior,
      "Total Geral": r.total,
      "Participação (%)": r.perc,
    })),
    {
      Missão: "TOTAL",
      Denominação: "TOTAL GERAL INTEGRADO",
      Capital: calcConsolidado.totals.capital,
      Interior: calcConsolidado.totals.interior,
      "Total Geral": calcConsolidado.totals.totalGeral,
      "Participação (%)": "100.0%",
    },
  ];
  const wsResumo = XLSX.utils.json_to_sheet(resumoFlat);
  XLSX.utils.book_append_sheet(wb, wsResumo, "RESUMO_MISSOES");

  return wb;
}

export function exportEfetivoMapasXlsx(
  data: SheetsData,
  reportDate: Date | null = null,
  filename?: string,
) {
  const wb = buildEfetivoMapasWorkbook(data, reportDate);
  const finalName =
    filename ||
    `EFETIVO-CBMAM-MAPAS-${reportDate ? fmtDateStamp(reportDate) : fmtDateStamp(new Date())}.xlsx`;

  XLSX.writeFile(wb, finalName);
}

// =============================================================================
// EXPORTAÇÃO JSON PRONTA PARA O BANCO EFETIVODB DO PROJETO MAPAS
// =============================================================================

export function getEfetivoMapasPayload(data: SheetsData, reportDate: Date | null = null) {
  const calc = buildEfetivoMapasData(data, "consolidado");
  const dateStr = reportDate ? reportDate.toISOString().slice(0, 10) : new Date().toISOString().slice(0, 10);

  const categorias = [
    { key: "serv_ord", label: "Serviço Ordinário", short: "SV ORD", color: "#dc2626", icon: "cbmam_shield", desc: "Militares CBMAM" },
    { key: "opamv", label: "OPAM Verão (26/10)", short: "OPAMV", color: "#f59e0b", icon: "flame_amber", desc: "Reforço Operação Amazonas" },
    { key: "opam_ref", label: "OPAM Reforço (21/10)", short: "OPAM REF", color: "#0284c7", icon: "shield_blue", desc: "Reforço Operação Amazonas" },
    { key: "inc_1", label: "Incêndio Florestal 1 (29/10)", short: "INC 1", color: "#ef4444", icon: "fire_red", desc: "Turma de Combate a Incêndio" },
    { key: "inc_2", label: "Incêndio Florestal 2 (17/11)", short: "INC 2", color: "#f97316", icon: "fire_orange", desc: "Turma de Combate a Incêndio" },
    { key: "inc_3", label: "Incêndio Florestal 3 (30/10)", short: "INC 3", color: "#eab308", icon: "fire_yellow", desc: "Turma de Combate a Incêndio" },
    { key: "cbmsp", label: "Bombeiros SP (CBMSP)", short: "CBM SP", color: "#8b5cf6", icon: "cbmsp_shield", desc: "Apoio Interestadual de São Paulo" },
    { key: "prevfogo", label: "Prevfogo / IBAMA", short: "PREVFOGO", color: "#10b981", icon: "prevfogo_badge", desc: "Brigadistas Federais IBAMA" },
    { key: "fn", label: "Força Nacional", short: "FN", color: "#06b6d4", icon: "fn_badge", desc: "Força Nacional de Segurança Pública" },
    { key: "icmbio", label: "ICMBio / Marinha", short: "ICMBio", color: "#14b8a6", icon: "icmbio_badge", desc: "Forças Federais de Conservação" },
    { key: "brig_mun", label: "Brigadista Municipal", short: "BRIG MUN", color: "#ea580c", icon: "brigadista_mun", desc: "Defesa Civil Municipal" },
    { key: "brig_sema", label: "Brigadista SEMA", short: "BRIG SEMA S", color: "#16a34a", icon: "brigadista_sema", desc: "SEMA / Governo do Amazonas" },
  ];

  const municipiosJson = calc.municipios.map((m) => ({
    id: m.id,
    muni: m.nome,
    tipo: m.tipo,
    serv_ord: m.serv_ord,
    opamv: m.opamv,
    opam_ref: m.opam_ref,
    inc_1: m.inc1,
    inc_2: m.inc2,
    inc_3: m.inc3,
    cbmsp: m.cbmsp,
    prevfogo: m.prevfogo,
    fn: m.fn,
    icmbio: m.marinha,
    brig_mun: m.brig_mun,
    brig_sema: m.brig_semas,
    total: m.total,
    notes: m.tipo === "capital" ? "Comando Geral & Capital" : "Interior do Estado",
  }));

  const basesJson = calc.bases.map((b) => ({
    id: b.id,
    base: b.nome,
    muni_ref: b.nome.split(" ")[0] || b.nome,
    serv_ord: b.serv_ord,
    opamv: b.opamv,
    opam_ref: b.opam_ref,
    inc_1: b.inc1,
    inc_2: b.inc2,
    inc_3: b.inc3,
    cbmsp: b.cbmsp,
    prevfogo: b.prevfogo,
    fn: b.fn,
    icmbio: b.marinha,
    brig_mun: b.brig_mun,
    brig_sema: b.brig_semas,
    total: b.total,
    icon: "base_camp",
    notes: "Base Operacional Temporária",
  }));

  return {
    version: "1.0",
    source: "CBMAM - Relatório Diário Sala de Situação",
    reportDate: dateStr,
    exportedAt: new Date().toISOString(),
    totals: calc.totals,
    categories: categorias,
    municipios: municipiosJson,
    bases: basesJson,
    resumo: calc.resumo,
  };
}

export function exportEfetivoMapasJson(data: SheetsData, reportDate: Date | null = null) {
  const payload = getEfetivoMapasPayload(data, reportDate);
  const dateStr = reportDate ? fmtDateStamp(reportDate) : fmtDateStamp(new Date());
  const blob = new Blob([JSON.stringify(payload, null, 2)], { type: "application/json" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `cbmam_efetivo_matriz_${dateStr}.json`;
  a.click();
  URL.revokeObjectURL(url);
}
