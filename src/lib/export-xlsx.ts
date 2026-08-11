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

export function exportTotaisToXlsx(
  incendios: Array<Record<string, any>>,
  outras: Array<Record<string, any>>,
  efetivo: Array<Record<string, any>>,
  recursos: Array<Record<string, any>>,
  periodoLabel: string,
) {
  const wb = XLSX.utils.book_new();

  const addSheet = (name: string, headers: string[], keys: string[], rows: any[]) => {
    const aoa = [
      headers,
      ...rows.map((r) => {
        const rowData = [r.mun];
        for (const k of keys) {
          rowData.push(r[k] ?? 0);
        }
        return rowData;
      }),
    ];
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

  addSheet(
    "Ocorrências",
    ["Município", "Salvamento", "Acidentes", "APH", "Prevenção", "Serviços"],
    ["salvamento", "acidentes", "aph", "prevencao", "servicos"],
    outras,
  );

  addSheet(
    "Efetivo",
    ["Município", "Ordinário", "SEG", "Brigada"],
    ["ord", "seg", "brig"],
    efetivo,
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

