import * as XLSX from "xlsx";
import type { SheetsData } from "./sheets.types";
import type { ComparisonResult } from "./comparison";
import { fmtDateStamp as fmtDateStampGeneric } from "./formatters";

import { fmtDateBR, fmtDateStamp, filterOccurrencesByDate } from "./report-date";
import { DASHBOARD_COLUMNS, resolveEfetivoColumns, calculateRowTotal } from "./dashboard-columns";
import { manausFirstSheets } from "./municipio-order";
import { isIncendio } from "./fire-classification";

export function exportSheetsToXlsx(
  rawData: SheetsData,
  reportDate: Date | null = null,
  filename?: string,
  comparisonData?: ComparisonResult,
) {
  // Manaus (capital) sempre na primeira linha de todas as planilhas.
  const data = manausFirstSheets(rawData);
  const wb = XLSX.utils.book_new();

  const header = data.header ?? {};
  const opDateLabel = reportDate ? fmtDateBR(reportDate) : "—";
  const headerRows = [
    ["CBMAM · Comando Integrado · Operação Amazonas + Verde"],
    ["Relatório Operacional Diário"],
    [],
    ["Data operacional", opDateLabel],
    ["Título", header.titulo ?? ""],
    ["Período Operacional", header.periodo ?? ""],
    ["Próximo Período", header.proximoPeriodo ?? ""],
    ["Reunião de Planejamento", header.reuniaoPlanejamento ?? ""],
    ["Reunião de Briefing", header.reuniaoBriefing ?? ""],
    ["Comandante do Incidente", header.comandante ?? ""],
    ["Chefe de Operações — Capital", header.chefeCapital ?? ""],
    ["Chefe de Operações — Interior", header.chefeInterior ?? ""],
    ["Coordenador — Sala de Situação", header.coordSituacao ?? ""],
    ["Coordenador", header.coordenador ?? ""],
    ["Subcomandante", header.subcomandante ?? ""],
    [],
    ["Emitido em", new Date().toLocaleString("pt-BR")],
  ];
  const wsHeader = XLSX.utils.aoa_to_sheet(headerRows);
  wsHeader["!cols"] = [{ wch: 34 }, { wch: 60 }];
  XLSX.utils.book_append_sheet(wb, wsHeader, "Cabeçalho");

  const addSheet = (
    name: string,
    columns: { key: string; label: string }[],
    rows: any[],
    type?: "incendios" | "efetivo" | "area",
  ) => {
    let finalCols = [...columns];
    let finalRows = rows.map((r) => ({ ...r }));

    if (comparisonData && type) {
      finalCols.push(
        { key: "_delta_abs", label: "Var. Absoluta" },
        { key: "_delta_perc", label: "Var. %" },
      );

      const normalize = (s: string) =>
        s?.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase() || "";

      finalRows = finalRows.map((r) => {
        const target = normalize(r.mun);
        let prevVal = 0;
        let curVal = 0;

        if (type === "incendios") {
          const prev = comparisonData.dataA.incendios_diario.find((p) => normalize(p.mun) === target);
          prevVal = (Number(prev?.urb) || 0) + (Number(prev?.flor) || 0);
          curVal = (Number(r.urb) || 0) + (Number(r.flor) || 0);
        } else if (type === "efetivo") {
          const prev = comparisonData.dataA.efetivo.find((p) => normalize(p.mun) === target);
          prevVal = (Number(prev?.ord) || 0) + (Number(prev?.seg) || 0) + (Number(prev?.brig) || 0);
          curVal = (Number(r.ord) || 0) + (Number(r.seg) || 0) + (Number(r.brig) || 0);
        } else if (type === "area") {
          const prev = (comparisonData.dataA.incendios_acumulado || []).find((p) => normalize(p.mun) === target);
          prevVal = Number(prev?.area) || 0;
          curVal = Number(r.area) || 0;
        }

        const abs = curVal - prevVal;
        const perc = prevVal === 0 ? (curVal > 0 ? 100 : 0) : (abs / prevVal) * 100;

        return {
          ...r,
          _delta_abs: abs,
          _delta_perc: perc.toFixed(1) + "%",
        };
      });
    }

    const isOccurrences = name.toLowerCase().includes("detalhad");
    const totalRow = isOccurrences
      ? null
      : finalCols.map((c, i) => {
          if (i === 0) return "TOTAL GERAL";
          if (c.key.startsWith("_delta")) return "";
          return finalRows.reduce((sum, r) => sum + (Number(r[c.key]) || 0), 0);
        });

    const aoa = [
      finalCols.map((c) => c.label),
      ...finalRows.map((r) => finalCols.map((c) => r[c.key] ?? "")),
      ...(totalRow ? [totalRow] : []),
    ];
    const ws = XLSX.utils.aoa_to_sheet(aoa);
    ws["!cols"] = finalCols.map((c) => ({ wch: Math.max(c.label.length + 2, 14) }));
    XLSX.utils.book_append_sheet(wb, ws, name);
  };

  // Resolve colunas dinâmicas do Efetivo (inclui CBMAM, operações, postos e customizadas)
  const efetivoCols = resolveEfetivoColumns(data.efetivo, data.custom_columns?.efetivo);
  const calculatedEfetivo = data.efetivo.map((r) => ({
    ...r,
    total: calculateRowTotal(r, efetivoCols),
  }));

  addSheet(
    "Efetivo",
    efetivoCols.map((c) => ({ key: c.key, label: c.label })),
    calculatedEfetivo,
    "efetivo",
  );

  // Deriva as colunas da mesma fonte usada no painel/PDF — evita perder
  // colunas (AEM, ATF, ABS, DOSA, CRS, AR, UR, GSE, MT, TA, etc.) no Excel.
  addSheet(
    "Recursos",
    DASHBOARD_COLUMNS.recursos.map((c) => ({ key: c.key, label: c.label })),
    data.recursos,
  );

  addSheet(
    "Incêndios (dia)",
    [
      { key: "mun", label: "Município" },
      { key: "urb", label: "Urbanos" },
      { key: "flor", label: "Florestais" },
      { key: "focos", label: "Focos" },
    ],
    data.incendios_diario,
    "incendios",
  );

  addSheet(
    "Incêndios (acumulado)",
    [
      { key: "mun", label: "Município" },
      { key: "urb", label: "Urbanos" },
      { key: "flor", label: "Florestais" },
      { key: "focos", label: "Focos" },
      { key: "sat", label: "Satélite" },
      { key: "area", label: "Área (m²)" },
    ],
    data.incendios_acumulado,
    "area",
  );

  const { rows: rawOccurrences } = filterOccurrencesByDate(data.occurrences, reportDate);
  const occurrences = (rawOccurrences || []).filter((occ) => isIncendio(occ.natureza));
  addSheet(
    "Ocorrências detalhadas",
    [
      { key: "data", label: "Data" },
      { key: "municipio", label: "Município" },
      { key: "horario", label: "Horário" },
      { key: "natureza", label: "Natureza" },
      { key: "focos", label: "Focos" },
      { key: "coordenadas", label: "Coordenadas" },
      { key: "endereco", label: "Endereço" },
      { key: "area", label: "Área (m²)" },
      { key: "agua", label: "Água (L)" },
    ],
    occurrences,
  );

  const suffix = reportDate ? fmtDateStamp(reportDate) : fmtDateStampGeneric();
  XLSX.writeFile(wb, filename ?? `relatorio-operacional-cbmam-${suffix}.xlsx`);
}

export function exportTotaisToXlsx(
  incendios: Array<Record<string, any>>,
  efetivo: Array<Record<string, any>>,
  recursos: Array<Record<string, any>>,
  periodoLabel: string,
  outras?: Array<Record<string, any>>,
) {
  const wb = XLSX.utils.book_new();

  // 1. Painel Oficial SINESP Benchmark (Comparativo COBOM 2025 x 2026)
  const sinespRows = [
    ["COBOM · Comparativo Oficial de Incêndios Ambientais · SINESP"],
    ["Filtro Oficial: jan 1, 2025 a 2026 (Consolidado Estadual)"],
    [],
    ["Indicador", "2025", "2026", "Variação Absoluta", "Variação %"],
    ["01 · Ocorrências Ambientais", 508, 3969, "+3.461", "+681,3%"],
    ["02 · Focos Combatidos", 81, 42004, "+41.923", "+51.756,8%"],
    ["03 · Área Combatida (m²)", 566903, 108634269, "+108.067.366 m²", "+19.062,7%"],
    ["Área Combatida em Hectares (ha)", "56,69 ha", "10.863,43 ha", "+10.806,74 ha", "+19.062,7%"],
    [],
    ["Fonte: SINESP / COBOM — Painel Oficial de Monitoramento Ambiental CBMAM"],
  ];
  const wsSinesp = XLSX.utils.aoa_to_sheet(sinespRows);
  wsSinesp["!cols"] = [{ wch: 34 }, { wch: 16 }, { wch: 18 }, { wch: 22 }, { wch: 16 }];
  XLSX.utils.book_append_sheet(wb, wsSinesp, "Comparativo SINESP");

  const addSheet = (name: string, headers: string[], keys: string[], rows: any[]) => {
    const dataRows = rows.map((r) => {
      const rowData = [r.mun];
      for (const k of keys) {
        rowData.push(r[k] ?? 0);
      }
      return rowData;
    });

    const totalRow = [
      "TOTAL GERAL",
      ...keys.map((k) => rows.reduce((s, r) => s + (Number(r[k]) || 0), 0)),
    ];

    const aoa = [headers, ...dataRows, totalRow];
    const ws = XLSX.utils.aoa_to_sheet(aoa);
    ws["!cols"] = headers.map((h) => ({ wch: Math.max(h.length + 2, 14) }));
    XLSX.utils.book_append_sheet(wb, ws, name);
  };

  addSheet(
    "Incêndios",
    ["Município", "Urbano", "Florestal", "Focos"],
    ["urb", "flor", "focos"],
    incendios,
  );

  const dynamicEfetivoCols = resolveEfetivoColumns(efetivo);
  const calculatedEfetivo = efetivo.map((r) => ({
    ...r,
    total: calculateRowTotal(r, dynamicEfetivoCols),
  }));

  addSheet(
    "Efetivo",
    dynamicEfetivoCols.map((c) => c.label),
    dynamicEfetivoCols.filter((c) => c.key !== "mun").map((c) => c.key),
    calculatedEfetivo,
  );

  addSheet(
    "Recursos",
    [
      "Município",
      "ABT",
      "AT",
      "AEM",
      "ATP",
      "ATA",
      "ABF",
      "ATF",
      "ABS",
      "Pipa",
      "DOSA",
      "CRS",
      "AR",
      "UR",
      "GSE",
      "MT",
      "TA",
      "Quadriciclo",
      "Embarcação",
      "Helicóptero",
      "Avião",
      "Jet Ski",
    ],
    [
      "abt",
      "at",
      "aem",
      "atp",
      "ata",
      "abf",
      "atf",
      "abs",
      "pipa",
      "dosa",
      "crs",
      "ar",
      "ur",
      "gse",
      "mt",
      "ta",
      "quadriciclo",
      "embarcacao",
      "helicoptero",
      "aviao",
      "jetski",
    ],
    recursos,
  );

  const cleanPeriodo = periodoLabel.replace(/[^a-z0-9]/gi, "-").toLowerCase();
  XLSX.writeFile(wb, `totais-acumulados-cbmam-${cleanPeriodo}.xlsx`);
}

export { exportEfetivoMapasXlsx, exportEfetivoMapasJson } from "./efetivo-mapas";

