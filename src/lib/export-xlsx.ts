import * as XLSX from "xlsx";
import type { SheetsData } from "./sheets.types";
import { fmtDateStamp as fmtDateStampGeneric } from "./formatters";
import { fmtDateBR, fmtDateStamp, filterOccurrencesByDate } from "./report-date";
import { DASHBOARD_COLUMNS } from "./dashboard-columns";
import { manausFirstSheets } from "./municipio-order";

export function exportSheetsToXlsx(
  rawData: SheetsData,
  reportDate: Date | null = null,
  /** Nome do arquivo final (opcional) — usado pelos relatórios diários. */
  filename?: string,
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

  const addSheet = (name: string, columns: { key: string; label: string }[], rows: any[]) => {
    const aoa = [
      columns.map((c) => c.label),
      ...rows.map((r) => columns.map((c) => r[c.key] ?? "")),
    ];
    const ws = XLSX.utils.aoa_to_sheet(aoa);
    ws["!cols"] = columns.map((c) => ({ wch: Math.max(c.label.length + 2, 14) }));
    XLSX.utils.book_append_sheet(wb, ws, name);
  };

  addSheet(
    "Efetivo",
    [
      { key: "mun", label: "Município" },
      { key: "ord", label: "Ordinário" },
      { key: "seg", label: "SEG" },
      { key: "brig", label: "Brigadistas" },
    ],
    data.efetivo,
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
  );

  addSheet(
    "Ocorrências (dia)",
    [
      { key: "mun", label: "Município" },
      { key: "salvamento", label: "Salvamento" },
      { key: "acidentes", label: "Acidentes" },
      { key: "aph", label: "APH" },
      { key: "prevencao", label: "Prevenção" },
      { key: "servicos", label: "Serviços" },
    ],
    data.outras_diarias,
  );

  const { rows: occurrences } = filterOccurrencesByDate(data.occurrences, reportDate);
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
