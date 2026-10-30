import { manausFirstSheets, canonicalMunicipio } from "./municipio-order";
import { resolveEfetivoColumns, calculateRowTotal } from "./dashboard-columns";
import { sanitizeSheetsData } from "./report-validation";
import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";
import type { SheetsData } from "./sheets.types";
import type { ComparisonResult } from "./comparison";
import { NF } from "./formatters";
import { fmtDateBR, fmtDateStamp, filterOccurrencesByDate } from "./report-date";
import { CBMAM_LOGO_BASE64 } from "./cbmam-logo";
import { isIncendio } from "./fire-classification";

export function reportFilename(
  reportDate: Date | null,
  generatedAt: Date = new Date(),
  periodoStr?: string,
) {
  if (periodoStr && periodoStr.includes(" a ")) {
    const slug = periodoStr.replace(/[^a-zA-Z0-9]+/g, "-").replace(/^-|-$/g, "");
    return `relatorio-operacional-cbmam-periodo-${slug}.pdf`;
  }
  const suffix = reportDate ? `-${fmtDateStamp(reportDate)}` : `-${fmtDateStamp(generatedAt)}`;
  return `relatorio-operacional-cbmam${suffix}.pdf`;
}

// Cores Institucionais Militares CBMAM 100% Verde
const BRAND_DARK = { r: 8, g: 46, b: 31 };     // #082e1f - Verde Floresta Amazônica Profundo
const BRAND_GREEN = { r: 16, g: 78, b: 46 };   // #104e2e - Verde Oficial CBMAM
const HEADER_NAVY = { r: 8, g: 46, b: 31 };    // #082e1f - Verde CBMAM Escuro Institucional
const HEADER_BLUE = { r: 16, g: 78, b: 46 };   // #104e2e - Verde CBMAM Operacional
const ACCENT_GOLD = { r: 180, g: 130, b: 20 }; // #b48214 - Ouro Militar
const BG_LIGHT_ROW = [248, 250, 248] as [number, number, number];
const BORDER_COLOR: [number, number, number] = [185, 200, 190];

export type PdfQuality = "standard" | "high";

export function exportSheetsToPdf(
  data: SheetsData,
  reportDate: Date | null = null,
  quality: PdfQuality = "standard",
  comparisonData?: ComparisonResult,
) {
  const doc = buildSheetsPdfDoc(data, reportDate, quality, comparisonData);
  doc.save(reportFilename(reportDate, new Date(), data.header?.periodo));
}

export function buildSheetsPdfDoc(
  rawData: SheetsData,
  reportDate: Date | null = null,
  _quality: PdfQuality = "standard",
  _comparisonData?: ComparisonResult,
): jsPDF {
  const data = manausFirstSheets(sanitizeSheetsData(rawData));
  const DocConstructor = (jsPDF as any).jsPDF || jsPDF;
  const doc = new DocConstructor({ orientation: "landscape", unit: "pt", format: "a4" });
  const pageW = doc.internal.pageSize.getWidth(); // ~841.89 pt
  const pageH = doc.internal.pageSize.getHeight(); // ~595.28 pt
  const header = data.header ?? {};
  const generatedAt = new Date();
  const opDate = reportDate ?? generatedAt;
  const opDateStr = fmtDateBR(opDate);

  const num = (v: any) => Math.max(0, Math.abs(typeof v === "number" && !isNaN(v) ? v : Number(v) || 0));

  // ---------------------------------------------------------------------------
  // CABEÇALHO INSTITUCIONAL OFICIAL (Topo de Todas as Páginas)
  // ---------------------------------------------------------------------------
  const drawPageHeader = (pageNumber: number, pageTitle: string, pageCategory: string) => {
    doc.setPage(pageNumber);

    // Barra Superior Principal
    doc.setFillColor(BRAND_DARK.r, BRAND_DARK.g, BRAND_DARK.b);
    doc.rect(0, 0, pageW, 54, "F");

    // Linha de Destaque Dourada Inferior
    doc.setFillColor(ACCENT_GOLD.r, ACCENT_GOLD.g, ACCENT_GOLD.b);
    doc.rect(0, 54, pageW, 2, "F");

    // Brasão CBMAM
    try {
      doc.addImage(CBMAM_LOGO_BASE64, "PNG", 16, 5, 42, 44);
    } catch {
      // Fallback
    }

    // Identificação Central
    doc.setTextColor(255, 255, 255);
    doc.setFont("helvetica", "bold");
    doc.setFontSize(10.5);
    doc.text("CORPO DE BOMBEIROS MILITAR DO AMAZONAS", pageW / 2, 16, { align: "center" });

    doc.setFontSize(11);
    doc.setTextColor(220, 240, 225);
    doc.text("COMANDO OPERACIONAL INTEGRADO · SALA DE SITUAÇÃO", pageW / 2, 29, { align: "center" });

    doc.setFontSize(9);
    doc.setFont("helvetica", "bold");
    doc.setTextColor(255, 220, 140);
    doc.text(`${pageCategory.toUpperCase()} — ${pageTitle.toUpperCase()}`, pageW / 2, 44, { align: "center" });

    // Oficiais Responsáveis (Esquerda)
    doc.setTextColor(230, 240, 235);
    doc.setFontSize(6.5);
    doc.setFont("helvetica", "bold");
    doc.text("Comandante do Incidente:", 68, 15);
    doc.text("Chefe Op. Capital:", 68, 25);
    doc.text("Chefe Op. Interior:", 68, 35);
    doc.text("Coord. Sala Situação:", 68, 45);

    doc.setFont("helvetica", "normal");
    doc.text(header.comandante || "CEL QOBM BORGES", 170, 15);
    doc.text(header.chefeCapital || "CEL QOBM MENEZES", 170, 25);
    doc.text(header.chefeInterior || "CEL QOBM MONTEIRO", 170, 35);
    doc.text((header.coordSituacao || "CEL QOBM FERREIRA").replace(/^TC\s+/i, "CEL "), 170, 45);

    // Cronograma & Período (Direita)
    const rightMarginX = pageW - 16;
    const labelStartX = pageW - 250;

    doc.setFont("helvetica", "bold");
    doc.text("Período Operacional:", labelStartX, 15);
    doc.text("Próximo Período:", labelStartX, 25);
    doc.text("Reunião de Planejamento:", labelStartX, 35);
    doc.text("Briefing Operacional:", labelStartX, 45);

    doc.setFont("helvetica", "normal");
    doc.text(header.periodo || `${opDateStr} — 24H`, rightMarginX, 15, { align: "right" });
    doc.text(header.proximoPeriodo || `D+1 — 08H00`, rightMarginX, 25, { align: "right" });
    doc.text(header.reuniaoPlanejamento || `Diária — 08H15`, rightMarginX, 35, { align: "right" });
    doc.text(header.reuniaoBriefing || `Diária — 08H30`, rightMarginX, 45, { align: "right" });
  };

  // ---------------------------------------------------------------------------
  // DESENHO DE KPI CARDS EXECUTIVOS
  // ---------------------------------------------------------------------------
  const drawKpiCards = (
    startY: number,
    cards: Array<{ label: string; value: string | number; subtext: string; highlight?: boolean }>,
  ) => {
    const cardHeight = 28;
    const totalW = pageW - 32;
    const gap = 8;
    const cardW = (totalW - gap * (cards.length - 1)) / cards.length;

    cards.forEach((c, i) => {
      const x = 16 + i * (cardW + gap);

      // Fundo do Card
      if (c.highlight) {
        doc.setFillColor(BRAND_DARK.r, BRAND_DARK.g, BRAND_DARK.b);
        doc.roundedRect(x, startY, cardW, cardHeight, 3, 3, "F");
        doc.setDrawColor(ACCENT_GOLD.r, ACCENT_GOLD.g, ACCENT_GOLD.b);
        doc.setLineWidth(0.8);
        doc.roundedRect(x, startY, cardW, cardHeight, 3, 3, "S");
      } else {
        doc.setFillColor(245, 248, 246);
        doc.roundedRect(x, startY, cardW, cardHeight, 3, 3, "F");
        doc.setDrawColor(BORDER_COLOR[0], BORDER_COLOR[1], BORDER_COLOR[2]);
        doc.setLineWidth(0.5);
        doc.roundedRect(x, startY, cardW, cardHeight, 3, 3, "S");
      }

      // Rótulo
      doc.setFont("helvetica", "bold");
      doc.setFontSize(6.2);
      if (c.highlight) {
        doc.setTextColor(220, 240, 230);
      } else {
        doc.setTextColor(HEADER_NAVY.r, HEADER_NAVY.g, HEADER_NAVY.b);
      }
      doc.text(c.label.toUpperCase(), x + 8, startY + 9);

      // Valor
      doc.setFont("helvetica", "bold");
      doc.setFontSize(11);
      if (c.highlight) {
        doc.setTextColor(255, 220, 140);
      } else {
        doc.setTextColor(BRAND_DARK.r, BRAND_DARK.g, BRAND_DARK.b);
      }
      doc.text(String(c.value), x + 8, startY + 22);

      // Subtexto à direita
      doc.setFont("helvetica", "normal");
      doc.setFontSize(6);
      if (c.highlight) {
        doc.setTextColor(200, 225, 215);
      } else {
        doc.setTextColor(110, 120, 115);
      }
      doc.text(c.subtext, x + cardW - 8, startY + 21, { align: "right" });
    });
  };

  // ===========================================================================
  // 📄 1ª PÁGINA: EFETIVO GERAL (CBMAM, FN, MARINHA, PREVFOGO e afins)
  // ===========================================================================
  drawPageHeader(1, "EFETIVO GERAL INTEGRADO (CBMAM, FN, MARINHA, PREVFOGO)", "1ª PÁGINA");

  const efetivoList = data.efetivo ?? [];
  const fullEfetivoCols = resolveEfetivoColumns(efetivoList, data.custom_columns?.efetivo);
  // Colunas numéricas de dados (exclui mun, total e tropas externas)
  const activeDataCols = fullEfetivoCols.filter(
    (c) => c.numeric && c.key !== "mun" && c.key !== "total" && c.key !== "cbmsp",
  );

  // Cálculo de Grandes Grupos de Efetivo para os Cards
  const totalCbmam = efetivoList.reduce(
    (s, r) =>
      s +
      num(r.ord) +
      num(r.cbmam) +
      num(r.servico) +
      num(r.opamv) +
      num(r.opam_ref) +
      num((r as any).inc1) +
      num((r as any).inc_1) +
      num((r as any).inc2) +
      num((r as any).inc_2) +
      num((r as any).inc3) +
      num((r as any).inc_3),
    0,
  );

  const totalFederais = efetivoList.reduce(
    (s, r) =>
      s +
      num(r.fn) +
      num(r.prevfogo) +
      num((r as any).marinha) +
      num((r as any).icmbio),
    0,
  );

  const totalBrigadistas = efetivoList.reduce(
    (s, r) =>
      s +
      num(r.brig_mun) +
      num(r.brig) +
      num((r as any).brig_semas) +
      num((r as any).brig_sema),
    0,
  );

  const grandTotalEfetivo = efetivoList.reduce(
    (s, r) => s + calculateRowTotal(r, fullEfetivoCols),
    0,
  );

  // Cards de Efetivo (Y: 62)
  drawKpiCards(62, [
    {
      label: "Efetivo Geral Total",
      value: NF.format(grandTotalEfetivo),
      subtext: "Força Operacional Ativa",
      highlight: true,
    },
    {
      label: "Militares CBMAM",
      value: NF.format(totalCbmam),
      subtext: "SV ORD, OPAM & Turmas",
    },
    {
      label: "Forças Federais & Parceiros",
      value: NF.format(totalFederais),
      subtext: "FN, Prevfogo, Marinha",
    },
    {
      label: "Brigadistas Florestais",
      value: NF.format(totalBrigadistas),
      subtext: "Defesas Civis & SEMA",
    },
  ]);

  // --- Tabela Esquerda: Matriz Detalhada de Efetivo por Município (tableWidth: 540) ---
  const efHeadColLabels = activeDataCols.map((c) => {
    const k = c.key.toLowerCase();
    if (k === "cbmam" || k === "ord") return "CBMAM";
    if (k === "opamv") return "OPAMV";
    if (k === "opam_ref") return "OPAM REF";
    if (k === "inc1" || k === "inc_1") return "INC 1";
    if (k === "inc2" || k === "inc_2") return "INC 2";
    if (k === "inc3" || k === "inc_3") return "INC 3";
    if (k === "prevfogo") return "PREVFOGO";
    if (k === "fn") return "FN";
    if (k === "marinha" || k === "icmbio") return "MARINHA";
    if (k === "seg") return "SEG";
    if (k === "brig_mun") return "BRIG.MUN";
    if (k === "brig_semas" || k === "brig_sema") return "BRIG.SEMA";
    if (k === "brig") return "BRIG.TOT";
    return c.label.toUpperCase().slice(0, 8);
  });

  const efHead = [
    [
      {
        content: `DISTRIBUIÇÃO DETALHADA POR LOCALIDADE E BASE OPERACIONAL`,
        colSpan: activeDataCols.length + 2,
        styles: {
          fillColor: [HEADER_NAVY.r, HEADER_NAVY.g, HEADER_NAVY.b] as [number, number, number],
          textColor: 255,
          fontStyle: "bold" as const,
          halign: "center" as const,
          fontSize: 6.8,
        },
      },
    ],
    ["MUNICÍPIO / LOCAL", ...efHeadColLabels, "TOTAL"],
  ];

  const efBody = efetivoList.map((r) => {
    const rowVals = activeDataCols.map((c) => {
      const v = num(r[c.key]);
      return v > 0 ? v : 0;
    });
    const rowTot = calculateRowTotal(r, fullEfetivoCols);
    return [r.mun, ...rowVals, rowTot > 0 ? rowTot : 0];
  });

  const efColTotals = activeDataCols.map((c) =>
    efetivoList.reduce((s, r) => s + num(r[c.key]), 0),
  );

  autoTable(doc, {
    startY: 96,
    margin: { left: 16 },
    tableWidth: 540,
    pageBreak: "avoid",
    head: efHead,
    body: [
      ...efBody,
      ["TOTAL GERAL", ...efColTotals.map((v) => v || "0"), grandTotalEfetivo || "0"],
    ],
    styles: {
      fontSize: 5.5,
      cellPadding: 1.15,
      lineColor: BORDER_COLOR,
      lineWidth: 0.25,
      valign: "middle",
    },
    alternateRowStyles: {
      fillColor: BG_LIGHT_ROW,
    },
    headStyles: {
      fillColor: [HEADER_BLUE.r, HEADER_BLUE.g, HEADER_BLUE.b],
      textColor: 255,
      fontStyle: "bold",
      fontSize: 5.8,
      halign: "center",
    },
    columnStyles: {
      0: { cellWidth: 80, fontStyle: "bold", halign: "left" },
      ...Object.fromEntries(activeDataCols.map((_, i) => [i + 1, { halign: "center" }])),
      [activeDataCols.length + 1]: {
        cellWidth: 26,
        halign: "center",
        fontStyle: "bold",
        fillColor: [235, 245, 238],
      },
    },
  });

  // --- Painel Direito: Síntese por Missão / Órgão & Território (tableWidth: 262, left: 564) ---
  const manausEf = efetivoList.find((r) => r.mun?.toLowerCase() === "manaus") ?? { mun: "Manaus" };
  const interiorEf = efetivoList.filter(
    (r) =>
      r.mun?.toLowerCase() !== "manaus" &&
      !r.mun?.toLowerCase().includes("posto") &&
      !r.mun?.toLowerCase().includes("base"),
  );
  const basesEf = efetivoList.filter(
    (r) =>
      r.mun?.toLowerCase().includes("posto") ||
      r.mun?.toLowerCase().includes("base") ||
      r.mun?.toLowerCase().includes("km 53"),
  );

  const getColSum = (list: any[], ...keys: string[]) => {
    return list.reduce((sum, r) => {
      let sub = 0;
      for (const k of keys) sub += num(r[k]);
      return sum + sub;
    }, 0);
  };

  const cbmamKeys = ["ord", "cbmam", "servico", "opamv", "opam_ref", "inc1", "inc_1", "inc2", "inc_2", "inc3", "inc_3"];
  const capCbmam = getColSum([manausEf], ...cbmamKeys);
  const intCbmam = getColSum(interiorEf, ...cbmamKeys);
  const basCbmam = getColSum(basesEf, ...cbmamKeys);
  const totCbmamRow = capCbmam + intCbmam + basCbmam;

  const capSeg = num(manausEf.seg);
  const intSeg = getColSum(interiorEf, "seg");
  const basSeg = getColSum(basesEf, "seg");
  const totSegRow = capSeg + intSeg + basSeg;

  const capFn = num(manausEf.fn);
  const intFn = getColSum(interiorEf, "fn");
  const basFn = getColSum(basesEf, "fn");
  const totFnRow = capFn + intFn + basFn;

  const capPrev = num(manausEf.prevfogo);
  const intPrev = getColSum(interiorEf, "prevfogo");
  const basPrev = getColSum(basesEf, "prevfogo");
  const totPrevRow = capPrev + intPrev + basPrev;

  const capMar = getColSum([manausEf], "marinha", "icmbio");
  const intMar = getColSum(interiorEf, "marinha", "icmbio");
  const basMar = getColSum(basesEf, "marinha", "icmbio");
  const totMarRow = capMar + intMar + basMar;

  const capBrigMun = num(manausEf.brig_mun);
  const intBrigMun = getColSum(interiorEf, "brig_mun");
  const basBrigMun = getColSum(basesEf, "brig_mun");
  const totBrigMunRow = capBrigMun + intBrigMun + basBrigMun;

  const capBrigSema = getColSum([manausEf], "brig_semas", "brig_sema");
  const intBrigSema = getColSum(interiorEf, "brig_semas", "brig_sema");
  const basBrigSema = getColSum(basesEf, "brig_semas", "brig_sema");
  const totBrigSemaRow = capBrigSema + intBrigSema + basBrigSema;

  const perc = (v: number) =>
    grandTotalEfetivo > 0 ? `${((v / grandTotalEfetivo) * 100).toFixed(1)}%` : "0%";

  const missoesBody = [
    ["Militares CBMAM", capCbmam, intCbmam, basCbmam, totCbmamRow, perc(totCbmamRow)],
    ["Militar SEG", capSeg, intSeg, basSeg, totSegRow, perc(totSegRow)],
    ["Força Nacional (FN)", capFn, intFn, basFn, totFnRow, perc(totFnRow)],
    ["Prevfogo / IBAMA", capPrev, intPrev, basPrev, totPrevRow, perc(totPrevRow)],
    ["Marinha / ICMBio", capMar, intMar, basMar, totMarRow, perc(totMarRow)],
    ["Brigadistas Municipais", capBrigMun, intBrigMun, basBrigMun, totBrigMunRow, perc(totBrigMunRow)],
    ["Brigadistas SEMA", capBrigSema, intBrigSema, basBrigSema, totBrigSemaRow, perc(totBrigSemaRow)],
    [
      "TOTAL GERAL",
      capCbmam + capSeg + capFn + capPrev + capMar + capBrigMun + capBrigSema,
      intCbmam + intSeg + intFn + intPrev + intMar + intBrigMun + intBrigSema,
      basCbmam + basSeg + basFn + basPrev + basMar + basBrigMun + basBrigSema,
      grandTotalEfetivo,
      "100%",
    ],
  ];

  autoTable(doc, {
    startY: 96,
    margin: { left: 564 },
    tableWidth: 262,
    pageBreak: "avoid",
    head: [
      [
        {
          content: "SÍNTESE POR FORÇA / ÓRGÃO INTEGRADO",
          colSpan: 6,
          styles: {
            fillColor: [HEADER_NAVY.r, HEADER_NAVY.g, HEADER_NAVY.b],
            textColor: 255,
            fontStyle: "bold",
            halign: "center",
            fontSize: 6.8,
          },
        },
      ],
      ["ÓRGÃO / FORÇA", "CAP", "INT", "BASE", "TOTAL", "%"],
    ],
    body: missoesBody,
    styles: { fontSize: 6.2, cellPadding: 2, lineColor: BORDER_COLOR, lineWidth: 0.25 },
    alternateRowStyles: { fillColor: BG_LIGHT_ROW },
    headStyles: {
      fillColor: [HEADER_BLUE.r, HEADER_BLUE.g, HEADER_BLUE.b],
      textColor: 255,
      fontStyle: "bold",
      fontSize: 6.2,
      halign: "center",
    },
    columnStyles: {
      0: { fontStyle: "bold", cellWidth: 92 },
      1: { halign: "center" },
      2: { halign: "center" },
      3: { halign: "center" },
      4: { halign: "center", fontStyle: "bold" },
      5: { halign: "center", fontStyle: "bold", textColor: [16, 78, 46] },
    },
  });

  // Tabela Territorial (Capital vs Interior vs Bases)
  const capTot = calculateRowTotal(manausEf, fullEfetivoCols);
  const basTot = basesEf.reduce((s, r) => s + calculateRowTotal(r, fullEfetivoCols), 0);
  const intTot = grandTotalEfetivo - capTot - basTot;

  autoTable(doc, {
    startY: 255,
    margin: { left: 564 },
    tableWidth: 262,
    pageBreak: "avoid",
    head: [
      [
        {
          content: "DISTRIBUIÇÃO TERRITORIAL DA OPERAÇÃO",
          colSpan: 3,
          styles: {
            fillColor: [HEADER_NAVY.r, HEADER_NAVY.g, HEADER_NAVY.b],
            textColor: 255,
            fontStyle: "bold",
            halign: "center",
            fontSize: 6.8,
          },
        },
      ],
      ["REGIÃO / DESTINAÇÃO", "EFETIVO", "PARTICIPAÇÃO"],
    ],
    body: [
      ["Capital (Manaus)", capTot, perc(capTot)],
      ["Interior (Municípios Polos)", intTot, perc(intTot)],
      ["Bases Temporárias / Postos", basTot, perc(basTot)],
      ["TOTAL DA FORÇA EMPREGADA", grandTotalEfetivo, "100%"],
    ],
    styles: { fontSize: 6.5, cellPadding: 2.2, lineColor: BORDER_COLOR, lineWidth: 0.25 },
    alternateRowStyles: { fillColor: BG_LIGHT_ROW },
    headStyles: {
      fillColor: [HEADER_BLUE.r, HEADER_BLUE.g, HEADER_BLUE.b],
      textColor: 255,
      fontStyle: "bold",
      fontSize: 6.2,
      halign: "center",
    },
    columnStyles: {
      0: { fontStyle: "bold" },
      1: { halign: "center", fontStyle: "bold" },
      2: { halign: "center", fontStyle: "bold", textColor: [16, 78, 46] },
    },
  });

  // Caixa de Observações Institucionais da Página 1
  autoTable(doc, {
    startY: 370,
    margin: { left: 564 },
    tableWidth: 262,
    pageBreak: "avoid",
    head: [
      [
        {
          content: "DIRETRIZES DO COMANDO INTEGRADO",
          styles: {
            fillColor: [BRAND_DARK.r, BRAND_DARK.g, BRAND_DARK.b],
            textColor: 255,
            fontStyle: "bold",
            halign: "center",
            fontSize: 6.8,
          },
        },
      ],
    ],
    body: [
      [
        "• EFETIVO REGULAR: Tropas empenhadas em regime de escala e prontidão operacional.\n" +
          "• FORÇA NACIONAL & BRIGADAS: Atuação integrada nas calhas prioritárias e unidades de conservação.\n" +
          "• MATRIZ OPERACIONAL: Alinhamento diário entre CIODS, Sala de Situação e Comandos de Área.\n" +
          "• DISPONIBILIDADE: Dados auditados pela coordenação em conformidade com as diretrizes do CBMAM.",
      ],
    ],
    styles: { fontSize: 5.8, cellPadding: 3.5, lineColor: BORDER_COLOR, lineWidth: 0.25 },
  });

  // ===========================================================================
  // 📄 2ª PÁGINA: RECURSOS, EQUIPAMENTOS E MATERIAIS
  // ===========================================================================
  doc.addPage();
  drawPageHeader(2, "RECURSOS, EQUIPAMENTOS E MATERIAIS EMPREGADOS", "2ª PÁGINA");

  const recursosList = data.recursos ?? [];
  const recKeys = [
    "abt", "at", "atp", "ata", "abf", "atf", "abs", "pipa", "dosa", "crs", "ar", "ur", "gse", "mt", "ta", "embarcacao", "picape_fn", "picape_muni", "autoarp", "picape_esfron", "helicoptero", "aviao", "jetski", "quadriciclo", "aem"
  ];
  const recLabels = [
    "ABT", "AT", "ATP", "ATA", "ABF", "ATF", "ABS", "PIPA", "DOSA", "CRS", "AR", "UR", "GSE", "MT", "TA", "EMBARC.", "PIC.FN", "PIC.MUNI", "AUTOARP", "PIC.ESFRON", "HELIC.", "AVIÃO", "JET SKI", "QUADRIC.", "AEM"
  ];

  const recTotaisCols = recKeys.map((k) => recursosList.reduce((s, r) => s + num(r[k]), 0));
  const recGrandTotal = recTotaisCols.reduce((a, b) => a + b, 0);

  // Totais por Categorias de Meios Materiais
  const totCombate =
    recTotaisCols[0] + // ABT
    recTotaisCols[1] + // AT
    recTotaisCols[2] + // ATP
    recTotaisCols[3] + // ATA
    recTotaisCols[4] + // ABF
    recTotaisCols[5] + // ATF
    recTotaisCols[7] + // PIPA
    recTotaisCols[24]; // AEM

  const totAereos = recTotaisCols[20] + recTotaisCols[21]; // Helicópteros + Aviões
  const totFluviais = recTotaisCols[15] + recTotaisCols[22]; // Embarcações + Jet Skis
  const totApoioResgate =
    recTotaisCols[6] + // ABS
    recTotaisCols[8] + // DOSA
    recTotaisCols[9] + // CRS
    recTotaisCols[10] + // AR
    recTotaisCols[11] + // UR
    recTotaisCols[12] + // GSE
    recTotaisCols[13] + // MT
    recTotaisCols[14] + // TA
    recTotaisCols[16] + // PIC FN
    recTotaisCols[17] + // PIC MUNI
    recTotaisCols[18] + // AUTOARP
    recTotaisCols[19] + // PIC ESFRON
    recTotaisCols[23]; // Quadriciclos

  // Cards de Recursos (Y: 62)
  drawKpiCards(62, [
    {
      label: "Total de Meios Materiais",
      value: NF.format(recGrandTotal),
      subtext: "Recursos Ativos em Campo",
      highlight: true,
    },
    {
      label: "Viaturas de Combate",
      value: NF.format(totCombate),
      subtext: "ABT, AT, ATP, ABF, Pipa",
    },
    {
      label: "Aeronaves Empregadas",
      value: NF.format(totAereos),
      subtext: "Air Tractors & Harpias",
    },
    {
      label: "Meios Fluviais & Apoio",
      value: NF.format(totFluviais + totApoioResgate),
      subtext: "Lanchas, Resgate & 4x4",
    },
  ]);

  // --- Tabela Esquerda: Matriz Completa de Recursos por Município (tableWidth: 540) ---
  const recBody = recursosList.map((r) => {
    const rowVals = recKeys.map((k) => (num(r[k]) > 0 ? num(r[k]) : 0));
    const rowTot = recKeys.reduce((s, k) => s + num(r[k]), 0);
    return [r.mun, ...rowVals, rowTot > 0 ? rowTot : 0];
  });

  autoTable(doc, {
    startY: 96,
    margin: { left: 16 },
    tableWidth: 540,
    pageBreak: "avoid",
    head: [
      [
        {
          content: "DISTRIBUIÇÃO GEOGRÁFICA DE RECURSOS MATERIAIS E EQUIPAMENTOS",
          colSpan: recKeys.length + 2,
          styles: {
            fillColor: [HEADER_NAVY.r, HEADER_NAVY.g, HEADER_NAVY.b],
            textColor: 255,
            fontStyle: "bold",
            halign: "center",
            fontSize: 6.8,
          },
        },
      ],
      ["MUNICÍPIO / POLO", ...recLabels, "TOTAL"],
    ],
    body: [
      ...recBody,
      ["TOTAL GERAL", ...recTotaisCols.map((v) => v || "0"), recGrandTotal],
    ],
    styles: {
      fontSize: 5.2,
      cellPadding: 1.15,
      lineColor: BORDER_COLOR,
      lineWidth: 0.25,
      valign: "middle",
    },
    alternateRowStyles: {
      fillColor: BG_LIGHT_ROW,
    },
    headStyles: {
      fillColor: [HEADER_BLUE.r, HEADER_BLUE.g, HEADER_BLUE.b],
      textColor: 255,
      fontStyle: "bold",
      fontSize: 5.2,
      halign: "center",
    },
    columnStyles: {
      0: { cellWidth: 70, fontStyle: "bold", halign: "left" },
      ...Object.fromEntries(recKeys.map((_, i) => [i + 1, { cellWidth: 17.5, halign: "center" }])),
      [recKeys.length + 1]: {
        cellWidth: 22,
        halign: "center",
        fontStyle: "bold",
        fillColor: [235, 245, 238],
      },
    },
  });

  // --- Painéis da Direita: Resumos Especializados por Tipo de Recurso (tableWidth: 262, left: 564) ---
  const resumoViaturasCombate = [
    ["ABT - Auto Bomba Tanque", recTotaisCols[0] || 0],
    ["AT - Auto Tanque", recTotaisCols[1] || 0],
    ["ATP - Auto Tanque Pesado", recTotaisCols[2] || 0],
    ["ATA - Auto Tanque Apoio", recTotaisCols[3] || 0],
    ["ABF - Auto Bomba Florestal", recTotaisCols[4] || 0],
    ["ATF - Auto Tanque Florestal", recTotaisCols[5] || 0],
    ["PIPA - Caminhão Tanque Pipa", recTotaisCols[7] || 0],
    ["AEM - Auto Escada Mecânica", recTotaisCols[24] || 0],
    ["SUBTOTAL COMBATE A INCÊNDIO", totCombate],
  ];

  autoTable(doc, {
    startY: 96,
    margin: { left: 564 },
    tableWidth: 262,
    pageBreak: "avoid",
    head: [
      [
        {
          content: "VIATURAS DE COMBATE A INCÊNDIO",
          colSpan: 2,
          styles: {
            fillColor: [HEADER_NAVY.r, HEADER_NAVY.g, HEADER_NAVY.b],
            textColor: 255,
            fontStyle: "bold",
            halign: "center",
            fontSize: 6.8,
          },
        },
      ],
      ["TIPO / CLASSIFICAÇÃO", "QTD"],
    ],
    body: resumoViaturasCombate,
    styles: { fontSize: 6.2, cellPadding: 1.8, lineColor: BORDER_COLOR, lineWidth: 0.25 },
    alternateRowStyles: { fillColor: BG_LIGHT_ROW },
    headStyles: {
      fillColor: [HEADER_BLUE.r, HEADER_BLUE.g, HEADER_BLUE.b],
      textColor: 255,
      fontStyle: "bold",
      fontSize: 6.2,
      halign: "center",
    },
    columnStyles: {
      0: { fontStyle: "bold" },
      1: { halign: "center", fontStyle: "bold", cellWidth: 40 },
    },
  });

  const resumoViaturasApoio = [
    ["ABS / CRS - Busca e Salvamento", (recTotaisCols[6] || 0) + (recTotaisCols[9] || 0)],
    ["AR / UR / GSE - Resgate e Emergência", (recTotaisCols[10] || 0) + (recTotaisCols[11] || 0) + (recTotaisCols[12] || 0)],
    ["MT / TA / DOSA / AutoARP - Apoio Logístico", (recTotaisCols[13] || 0) + (recTotaisCols[14] || 0) + (recTotaisCols[8] || 0) + (recTotaisCols[18] || 0)],
    ["Picapes 4x4 (Força Nacional, Muni, Esfron)", (recTotaisCols[16] || 0) + (recTotaisCols[17] || 0) + (recTotaisCols[19] || 0)],
    ["SUBTOTAL VIATURAS DE APOIO E TÁTICAS", totApoioResgate],
  ];

  autoTable(doc, {
    startY: 255,
    margin: { left: 564 },
    tableWidth: 262,
    pageBreak: "avoid",
    head: [
      [
        {
          content: "VIATURAS DE APOIO, SALVAMENTO & 4X4",
          colSpan: 2,
          styles: {
            fillColor: [HEADER_NAVY.r, HEADER_NAVY.g, HEADER_NAVY.b],
            textColor: 255,
            fontStyle: "bold",
            halign: "center",
            fontSize: 6.8,
          },
        },
      ],
      ["CLASSIFICAÇÃO / EMPREGO", "QTD"],
    ],
    body: resumoViaturasApoio,
    styles: { fontSize: 6.2, cellPadding: 1.8, lineColor: BORDER_COLOR, lineWidth: 0.25 },
    alternateRowStyles: { fillColor: BG_LIGHT_ROW },
    headStyles: {
      fillColor: [HEADER_BLUE.r, HEADER_BLUE.g, HEADER_BLUE.b],
      textColor: 255,
      fontStyle: "bold",
      fontSize: 6.2,
      halign: "center",
    },
    columnStyles: {
      0: { fontStyle: "bold" },
      1: { halign: "center", fontStyle: "bold", cellWidth: 40 },
    },
  });

  const resumoAereosFluviais = [
    ["Aviões Air Tractor (Flores / Bases)", recTotaisCols[21] || 0],
    ["Helicópteros Harpia (CIOPAER / CBMAM)", recTotaisCols[20] || 0],
    ["Embarcações / Lanchas Rápidas", recTotaisCols[15] || 0],
    ["Jet Skis & Quadriciclos Táticos", (recTotaisCols[22] || 0) + (recTotaisCols[23] || 0)],
    ["TOTAL DE RECURSOS MATERIAIS GERAL", recGrandTotal],
  ];

  autoTable(doc, {
    startY: 380,
    margin: { left: 564 },
    tableWidth: 262,
    pageBreak: "avoid",
    head: [
      [
        {
          content: "MEIOS AÉREOS, FLUVIAIS E ESPECIAIS",
          colSpan: 2,
          styles: {
            fillColor: [BRAND_DARK.r, BRAND_DARK.g, BRAND_DARK.b],
            textColor: 255,
            fontStyle: "bold",
            halign: "center",
            fontSize: 6.8,
          },
        },
      ],
      ["RECURSO ESPECIAL", "QTD"],
    ],
    body: resumoAereosFluviais,
    styles: { fontSize: 6.2, cellPadding: 2, lineColor: BORDER_COLOR, lineWidth: 0.25 },
    alternateRowStyles: { fillColor: BG_LIGHT_ROW },
    headStyles: {
      fillColor: [HEADER_BLUE.r, HEADER_BLUE.g, HEADER_BLUE.b],
      textColor: 255,
      fontStyle: "bold",
      fontSize: 6.2,
      halign: "center",
    },
    columnStyles: {
      0: { fontStyle: "bold" },
      1: { halign: "center", fontStyle: "bold", cellWidth: 40, textColor: [16, 78, 46] },
    },
  });

  // ===========================================================================
  // 📄 3ª PÁGINA: OCORRÊNCIAS
  // ===========================================================================
  doc.addPage();
  drawPageHeader(3, "OCORRÊNCIAS DE COMBATE A INCÊNDIOS (DIÁRIAS E ACUMULADAS)", "3ª PÁGINA");

  const incDiarios = data.incendios_diario ?? [];
  const incAcumulados = data.incendios_acumulado ?? [];

  // Totais Diários
  const totDiarioUrb = incDiarios.reduce((s, r) => s + num(r.urb), 0);
  const totDiarioFlor = incDiarios.reduce((s, r) => s + num(r.flor), 0);
  const totDiarioFocos = incDiarios.reduce((s, r) => s + num(r.focos), 0);
  const totDiarioOcorrencias = totDiarioUrb + totDiarioFlor;

  // Totais Acumulados
  const totAcumUrb = incAcumulados.reduce((s, r) => s + num(r.urb), 0);
  const totAcumFlor = incAcumulados.reduce((s, r) => s + num(r.flor), 0);
  const totAcumFocos = incAcumulados.reduce((s, r) => s + num(r.focos), 0);
  const totAcumSat = incAcumulados.reduce((s, r) => s + num(r.sat), 0);
  const totAcumArea = incAcumulados.reduce((s, r) => s + num(r.area), 0);
  const totAcumOcorrencias = totAcumUrb + totAcumFlor;

  const isPeriodRange = Boolean(data.isRange || (header.periodo && header.periodo.includes(" a ")));

  // Cards de Ocorrências (Y: 62)
  drawKpiCards(62, [
    {
      label: isPeriodRange ? "Incêndios no Período" : "Incêndios no Dia",
      value: NF.format(totDiarioOcorrencias),
      subtext: `${totDiarioUrb} Urb. / ${totDiarioFlor} Flor.`,
      highlight: true,
    },
    {
      label: isPeriodRange ? "Focos no Período" : "Focos Extintos no Dia",
      value: NF.format(totDiarioFocos),
      subtext: "Combates in loco",
    },
    {
      label: "Acumulado desde 01/06",
      value: NF.format(totAcumOcorrencias),
      subtext: `${totAcumFocos} focos combatidos`,
    },
    {
      label: "Área Queimada Total",
      value: `${NF.format(totAcumArea)} m²`,
      subtext: `${totAcumSat} focos satélite`,
    },
  ]);

  // --- Tabela 1: Incêndios do Dia por Município (Esquerda: 340 pt, X: 16 pt) ---
  const incDiariosBody = incDiarios.map((r) => {
    const u = num(r.urb);
    const f = num(r.flor);
    const foc = num(r.focos);
    const tot = u + f;
    return [
      r.mun,
      u > 0 ? u : 0,
      f > 0 ? f : 0,
      foc > 0 ? foc : 0,
      tot > 0 ? tot : 0,
    ];
  });

  autoTable(doc, {
    startY: 96,
    margin: { left: 16 },
    tableWidth: 340,
    pageBreak: "avoid",
    head: [
      [
        {
          content: `INCÊNDIOS — OCORRÊNCIAS DIÁRIAS EM ${opDateStr}`,
          colSpan: 5,
          styles: {
            fillColor: [HEADER_NAVY.r, HEADER_NAVY.g, HEADER_NAVY.b],
            textColor: 255,
            fontStyle: "bold",
            halign: "center",
            fontSize: 6.8,
          },
        },
      ],
      ["MUNICÍPIO / POLO", "URBANO", "FLORESTAL", "FOCOS", "TOTAL"],
    ],
    body: [
      ...incDiariosBody,
      ["TOTAL DO DIA", totDiarioUrb, totDiarioFlor, totDiarioFocos, totDiarioOcorrencias],
    ],
    styles: {
      fontSize: 5.5,
      cellPadding: 1.15,
      lineColor: BORDER_COLOR,
      lineWidth: 0.25,
      valign: "middle",
    },
    alternateRowStyles: { fillColor: BG_LIGHT_ROW },
    headStyles: {
      fillColor: [HEADER_BLUE.r, HEADER_BLUE.g, HEADER_BLUE.b],
      textColor: 255,
      fontStyle: "bold",
      fontSize: 5.8,
      halign: "center",
    },
    columnStyles: {
      0: { fontStyle: "bold", cellWidth: 95 },
      1: { halign: "center" },
      2: { halign: "center" },
      3: { halign: "center" },
      4: { halign: "center", fontStyle: "bold", fillColor: [235, 245, 238] },
    },
  });

  // --- Tabela 2: Incêndios Acumulados do Período (Direita: 466 pt, X: 360 pt) ---
  const incAcumBody = incAcumulados.map((r, idx) => {
    const u = num(r.urb);
    const f = num(r.flor);
    const foc = num(r.focos);
    const sat = num(r.sat);
    const area = num(r.area);
    const tot = u + f;
    return [
      idx + 1,
      r.mun,
      u > 0 ? u : 0,
      f > 0 ? f : 0,
      foc > 0 ? foc : 0,
      sat > 0 ? sat : 0,
      area > 0 ? NF.format(area) : 0,
      tot > 0 ? tot : 0,
    ];
  });

  autoTable(doc, {
    startY: 96,
    margin: { left: 360 },
    tableWidth: 466,
    pageBreak: "avoid",
    head: [
      [
        {
          content: `INCÊNDIOS — CONSOLIDADO ACUMULADO DESDE 01/06/2026 ATÉ ${opDateStr}`,
          colSpan: 8,
          styles: {
            fillColor: [HEADER_NAVY.r, HEADER_NAVY.g, HEADER_NAVY.b],
            textColor: 255,
            fontStyle: "bold",
            halign: "center",
            fontSize: 6.8,
          },
        },
      ],
      ["Nº", "MUNICÍPIO", "URBANO", "FLORESTAL", "FOCOS", "SATÉLITE", "ÁREA (M²)", "TOTAL"],
    ],
    body: [
      ...incAcumBody,
      ["TOTAL GERAL", "", totAcumUrb, totAcumFlor, totAcumFocos, totAcumSat, NF.format(totAcumArea), totAcumOcorrencias],
    ],
    styles: {
      fontSize: 5.4,
      cellPadding: 1.15,
      lineColor: BORDER_COLOR,
      lineWidth: 0.25,
      valign: "middle",
    },
    alternateRowStyles: { fillColor: BG_LIGHT_ROW },
    headStyles: {
      fillColor: [HEADER_BLUE.r, HEADER_BLUE.g, HEADER_BLUE.b],
      textColor: 255,
      fontStyle: "bold",
      fontSize: 5.6,
      halign: "center",
    },
    columnStyles: {
      0: { cellWidth: 18, halign: "center" },
      1: { cellWidth: 90, fontStyle: "bold" },
      2: { halign: "center" },
      3: { halign: "center" },
      4: { halign: "center" },
      5: { halign: "center" },
      6: { halign: "right" },
      7: { halign: "center", fontStyle: "bold", fillColor: [235, 245, 238] },
    },
  });

  // ===========================================================================
  // OCORRÊNCIAS DETALHADAS DE INCÊNDIO (CAD)
  // ===========================================================================
  const rawOccsToRender = isPeriodRange
    ? (data.occurrences ?? [])
    : (() => {
        const { rows: filteredOccs } = filterOccurrencesByDate(data.occurrences ?? [], reportDate);
        return filteredOccs.length > 0 ? filteredOccs : (data.occurrences ?? []);
      })();
  const occsToRender = rawOccsToRender.filter((occ) => isIncendio(occ.natureza));

  if (occsToRender.length > 0) {
    doc.addPage();
    const cadPageNum = (doc as any).internal.getNumberOfPages();
    drawPageHeader(cadPageNum, "REGISTRO OPERACIONAL DE ATENDIMENTOS DE INCÊNDIO (CAD)", "DETALHAMENTO");

    const occsBody = occsToRender.map((occ) => [
      occ.data || opDateStr,
      (occ.municipio || "Manaus").toUpperCase(),
      occ.horario || "—",
      occ.natureza || "Incêndio Florestal",
      occ.endereco || "Não Informado",
      occ.focos || 0,
      occ.area ? NF.format(occ.area) : "0",
      occ.agua ? NF.format(occ.agua) : "0",
      occ.unidade || occ.equipes || "—",
    ]);

    const cadTotFocos = occsToRender.reduce((s, r) => s + num(r.focos), 0);
    const cadTotArea = occsToRender.reduce((s, r) => s + num(r.area), 0);
    const cadTotAgua = occsToRender.reduce((s, r) => s + num(r.agua), 0);

    autoTable(doc, {
      startY: 65,
      margin: { left: 16 },
      tableWidth: 810,
      head: [
        [
          {
            content: `OCORRÊNCIAS DETALHADAS DE INCÊNDIO — REGISTRO OPERACIONAL CAD / CIODS (${opDateStr})`,
            colSpan: 9,
            styles: {
              fillColor: [HEADER_NAVY.r, HEADER_NAVY.g, HEADER_NAVY.b],
              textColor: 255,
              fontStyle: "bold",
              halign: "center",
              fontSize: 7.2,
            },
          },
        ],
        [
          "DATA",
          "MUNICÍPIO",
          "HORÁRIO",
          "NATUREZA",
          "LOCALIDADE / ENDEREÇO",
          "FOCOS",
          "ÁREA (M²)",
          "ÁGUA (L)",
          "RECURSOS EMPREGADOS",
        ],
      ],
      body: [
        ...occsBody,
        [
          "TOTAL",
          "",
          "",
          `${occsToRender.length} registro(s)`,
          "",
          cadTotFocos,
          NF.format(cadTotArea),
          NF.format(cadTotAgua),
          "",
        ],
      ],
      styles: { fontSize: 6.2, cellPadding: 2, lineColor: BORDER_COLOR, lineWidth: 0.25 },
      alternateRowStyles: { fillColor: BG_LIGHT_ROW },
      headStyles: {
        fillColor: [HEADER_BLUE.r, HEADER_BLUE.g, HEADER_BLUE.b],
        textColor: 255,
        fontStyle: "bold",
        fontSize: 6.4,
        halign: "center",
      },
      columnStyles: {
        0: { cellWidth: 55, halign: "center" },
        1: { cellWidth: 85, fontStyle: "bold" },
        2: { cellWidth: 45, halign: "center" },
        3: { cellWidth: 140 },
        4: { cellWidth: 200 },
        5: { cellWidth: 45, halign: "center", fontStyle: "bold" },
        6: { cellWidth: 65, halign: "right" },
        7: { cellWidth: 55, halign: "right" },
        8: { cellWidth: 120 },
      },
      didDrawPage: (hookData) => {
        if (hookData.pageNumber > cadPageNum) {
          drawPageHeader(hookData.pageNumber, "REGISTRO OPERACIONAL DE ATENDIMENTOS DE INCÊNDIO (CAD)", "DETALHAMENTO");
        }
      },
    });
  }

  // ---------------------------------------------------------------------------
  // ASSINATURAS OFICIAIS DO COMANDO (Inseridas na 3ª página operacional)
  // ---------------------------------------------------------------------------
  // Assinaturas sempre presentes na Página 3 (ou na última página)
  doc.setPage(3);
  const sigY = pageH - 42;
  doc.setFont("helvetica", "bold");
  doc.setFontSize(7.5);
  doc.setTextColor(BRAND_DARK.r, BRAND_DARK.g, BRAND_DARK.b);

  // Linhas das assinaturas
  doc.setDrawColor(BRAND_DARK.r, BRAND_DARK.g, BRAND_DARK.b);
  doc.setLineWidth(0.6);
  doc.line(pageW / 2 - 280, sigY - 14, pageW / 2 - 40, sigY - 14);
  doc.line(pageW / 2 + 40, sigY - 14, pageW / 2 + 280, sigY - 14);

  // Assinatura 1: Coordenador da Operação
  doc.text("CEL QOBM CRISTIANO BRAZ FERREIRA", pageW / 2 - 160, sigY, { align: "center" });
  doc.setFont("helvetica", "normal");
  doc.setFontSize(6.8);
  doc.setTextColor(80, 90, 85);
  doc.text("Coordenador da Operação Amazonas + Verde · CBMAM", pageW / 2 - 160, sigY + 9, { align: "center" });

  // Assinatura 2: Subcomandante-Geral
  doc.setFont("helvetica", "bold");
  doc.setFontSize(7.5);
  doc.setTextColor(BRAND_DARK.r, BRAND_DARK.g, BRAND_DARK.b);
  doc.text("CEL QOBM HELYANTHUS FRANK DA SILVA BORGES", pageW / 2 + 160, sigY, { align: "center" });
  doc.setFont("helvetica", "normal");
  doc.setFontSize(6.8);
  doc.setTextColor(80, 90, 85);
  doc.text("Subcomandante-Geral do CBMAM", pageW / 2 + 160, sigY + 9, { align: "center" });

  // ---------------------------------------------------------------------------
  // NUMERAÇÃO INSTITUCIONAL DE TODAS AS PÁGINAS (Página X de Y)
  // ---------------------------------------------------------------------------
  const totalPages = (doc as any).internal.getNumberOfPages();
  for (let p = 1; p <= totalPages; p++) {
    doc.setPage(p);
    doc.setFont("helvetica", "normal");
    doc.setFontSize(6.8);
    doc.setTextColor(110, 120, 115);
    doc.text(`Documento Oficial CBMAM · Sala de Situação Integrada · Emissão: ${new Date().toLocaleTimeString("pt-BR")}`, 16, pageH - 8);
    doc.text(`Página ${p} de ${totalPages}`, pageW - 16, pageH - 8, { align: "right" });
  }

  return doc;
}
