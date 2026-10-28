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

const norm = (s: unknown) =>
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

function extractEfetivoValues(r: any, nome: string, tipo: "capital" | "interior" | "base"): EfetivoMapasItem {
  const serv_ord = getRowValue(r, "cbmam", "servico", "ord", "serv_ord");
  const opamv = getRowValue(r, "opamv");
  const opam_ref = getRowValue(r, "opam_ref");
  const inc1 = getRowValue(r, "inc1", "inc_1");
  const inc2 = getRowValue(r, "inc2", "inc_2");
  const inc3 = getRowValue(r, "inc3", "inc_3");
  const cbmsp = getRowValue(r, "cbmsp");
  const prevfogo = getRowValue(r, "prevfogo");
  const fn = getRowValue(r, "fn");
  const marinha = getRowValue(r, "marinha", "icmbio");
  const brig_mun = getRowValue(r, "brig_mun");
  const brig_semas = getRowValue(r, "brig_semas", "brig_sema");

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
 */
export function buildEfetivoMapasData(data: SheetsData): EfetivoMapasCalculado {
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
    return extractEfetivoValues(raw, baseName, "base");
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
    return extractEfetivoValues(raw, muniName, tipo);
  });

  // 3. Resumo por Missão (Capital x Interior x Total)
  const missoesDefs = [
    { key: "serv_ord", label: "SV ORD (CBMAM)", short: "SV ORD" },
    { key: "opamv", label: "OPAM Verão", short: "OPAM" },
    { key: "opam_ref", label: "OPAM Reforço", short: "OPAM REF" },
    { key: "inc1", label: "INC 1 29/10", short: "INC 1 - 29/10" },
    { key: "inc2", label: "INC 2 17/11", short: "INC 2- 17/11" },
    { key: "inc3", label: "INC 3 30/10", short: "INC3 - 30/10" },
    { key: "cbmsp", label: "CBMSP (São Paulo)", short: "CBMSP" },
    { key: "prevfogo", label: "PREVFOGO / IBAMA", short: "PREVFOGO" },
    { key: "fn", label: "Força Nacional", short: "FN" },
    { key: "marinha", label: "Marinha / ICMBio", short: "MARINHA" },
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
  const calc = buildEfetivoMapasData(data);
  const wb = XLSX.utils.book_new();

  // ---------------------------------------------------------------------------
  // ABA 1: EFETIVO (Layout 3-em-1 lado a lado fiel a EFETIVO.xlsx)
  // ---------------------------------------------------------------------------
  const aoa: any[][] = [];

  // Linha 0 (vazia)
  aoa.push([]);

  // Linha 1 (Títulos dos blocos)
  const row1: any[] = [];
  row1[0] = "EFETIVO";
  row1[13] = "EFETIVO";
  row1[30] = "RESUMO EFETIVO";
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

  // Bloco 2: Bases Temporárias (Cols 13-25)
  row2[13] = "BASES TEMPORÁRIAS";
  row2[14] = "OPAMV 26/10";
  row2[15] = "OPAM REF 07/11";
  row2[16] = "INC 1- 29/10";
  row2[17] = "INC 2 - 17/11";
  row2[18] = "INC3 - 30/10";
  row2[19] = "CBMSP";
  row2[20] = "PREVFOGO";
  row2[21] = "MARINHA";
  row2[22] = "FN";
  row2[23] = "BRIGADISTA MUNC.";
  row2[24] = "BRIGADISTA SEMAS";
  row2[25] = "TOTAL GERAL";

  // Bloco 3: Resumo Efetivo (Cols 30-33)
  row2[30] = "MISSÃO";
  row2[31] = "CAPITAL";
  row2[32] = "INTERIOR";
  row2[33] = "TOTAL";

  aoa.push(row2);

  // Preenche as linhas de dados (Linha 3 em diante)
  const maxRows = Math.max(
    calc.municipios.length + 1, // +1 para total de municípios
    calc.bases.length + 1,       // +1 para total de bases
    calc.resumo.length + 1       // +1 para total de resumo
  );

  for (let i = 0; i < maxRows; i++) {
    const row: any[] = [];

    // 1. Dados do Bloco da Esquerda (Municípios)
    if (i < calc.municipios.length) {
      const m = calc.municipios[i];
      row[0] = m.nome;
      row[1] = m.serv_ord;
      row[2] = m.opamv;
      row[3] = m.opam_ref;
      row[4] = m.inc1;
      row[5] = m.inc2;
      row[6] = m.inc3;
      row[7] = m.cbmsp;
      row[8] = m.prevfogo;
      row[9] = m.fn;
      row[10] = m.brig_mun;
      row[11] = m.brig_semas;
    } else if (i === calc.municipios.length) {
      // Linha TOTAL de Municípios
      row[0] = "TOTAL";
      row[1] = calc.municipios.reduce((s, m) => s + m.serv_ord, 0);
      row[2] = calc.municipios.reduce((s, m) => s + m.opamv, 0);
      row[3] = calc.municipios.reduce((s, m) => s + m.opam_ref, 0);
      row[4] = calc.municipios.reduce((s, m) => s + m.inc1, 0);
      row[5] = calc.municipios.reduce((s, m) => s + m.inc2, 0);
      row[6] = calc.municipios.reduce((s, m) => s + m.inc3, 0);
      row[7] = calc.municipios.reduce((s, m) => s + m.cbmsp, 0);
      row[8] = calc.municipios.reduce((s, m) => s + m.prevfogo, 0);
      row[9] = calc.municipios.reduce((s, m) => s + m.fn, 0);
      row[10] = calc.municipios.reduce((s, m) => s + m.brig_mun, 0);
      row[11] = calc.municipios.reduce((s, m) => s + m.brig_semas, 0);
    }

    // 2. Dados do Bloco do Meio (Bases Temporárias)
    if (i < calc.bases.length) {
      const b = calc.bases[i];
      row[13] = b.nome;
      row[14] = b.opamv;
      row[15] = b.opam_ref;
      row[16] = b.inc1;
      row[17] = b.inc2;
      row[18] = b.inc3;
      row[19] = b.cbmsp;
      row[20] = b.prevfogo;
      row[21] = b.marinha;
      row[22] = b.fn;
      row[23] = b.brig_mun;
      row[24] = b.brig_semas;
      row[25] = b.total;
    } else if (i === calc.bases.length) {
      // Linha TOTAL de Bases
      row[13] = "TOTAL";
      row[14] = calc.bases.reduce((s, b) => s + b.opamv, 0);
      row[15] = calc.bases.reduce((s, b) => s + b.opam_ref, 0);
      row[16] = calc.bases.reduce((s, b) => s + b.inc1, 0);
      row[17] = calc.bases.reduce((s, b) => s + b.inc2, 0);
      row[18] = calc.bases.reduce((s, b) => s + b.inc3, 0);
      row[19] = calc.bases.reduce((s, b) => s + b.cbmsp, 0);
      row[20] = calc.bases.reduce((s, b) => s + b.prevfogo, 0);
      row[21] = calc.bases.reduce((s, b) => s + b.marinha, 0);
      row[22] = calc.bases.reduce((s, b) => s + b.fn, 0);
      row[23] = calc.bases.reduce((s, b) => s + b.brig_mun, 0);
      row[24] = calc.bases.reduce((s, b) => s + b.brig_semas, 0);
      row[25] = calc.bases.reduce((s, b) => s + b.total, 0);
    }

    // 3. Dados do Bloco da Direita (Resumo Efetivo)
    if (i < calc.resumo.length) {
      const res = calc.resumo[i];
      row[30] = res.missao;
      row[31] = res.capital;
      row[32] = res.interior;
      row[33] = res.total;
    } else if (i === calc.resumo.length) {
      // Linha TOTAL Geral do Resumo
      row[30] = "TOTAL";
      row[31] = calc.totals.capital;
      row[32] = calc.totals.interior;
      row[33] = calc.totals.totalGeral;
    }

    aoa.push(row);
  }

  const wsEfetivo = XLSX.utils.aoa_to_sheet(aoa);
  XLSX.utils.book_append_sheet(wb, wsEfetivo, "EFETIVO");

  // ---------------------------------------------------------------------------
  // ABA 2: EFETIVO_DIARIO (Formato tabular simples normalizado para GIS/Mapas)
  // ---------------------------------------------------------------------------
  const dateStr = reportDate ? fmtDateBR(reportDate) : fmtDateBR(new Date());
  const flatRows = [
    ...calc.municipios.map((m) => ({
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
    ...calc.bases.map((b) => ({
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

  const wsDiario = XLSX.utils.json_to_sheet(flatRows);
  XLSX.utils.book_append_sheet(wb, wsDiario, "EFETIVO_DIARIO");

  // ---------------------------------------------------------------------------
  // ABA 3: RESUMO_MISSOES (Resumo comparativo e percentual de forças)
  // ---------------------------------------------------------------------------
  const resumoFlat = [
    ...calc.resumo.map((r) => ({
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
      Capital: calc.totals.capital,
      Interior: calc.totals.interior,
      "Total Geral": calc.totals.totalGeral,
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
  const calc = buildEfetivoMapasData(data);
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
