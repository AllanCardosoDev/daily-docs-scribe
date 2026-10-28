import { manausFirstSheets, canonicalMunicipio } from "./municipio-order";
import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";
import type { SheetsData } from "./sheets.types";
import type { ComparisonResult } from "./comparison";
import { NF } from "./formatters";
import { fmtDateBR, fmtDateStamp, filterOccurrencesByDate } from "./report-date";
import { CBMAM_LOGO_BASE64 } from "./cbmam-logo";


export function reportFilename(reportDate: Date | null, generatedAt: Date = new Date()) {
  const suffix = reportDate ? `-${fmtDateStamp(reportDate)}` : `-${fmtDateStamp(generatedAt)}`;
  return `relatorio-operacional-cbmam${suffix}.pdf`;
}

// Colors
const BRAND_DARK = { r: 8, g: 46, b: 31 }; // #082e1f
const BRAND_GREEN = { r: 16, g: 78, b: 46 }; // #104e2e
const HEADER_BLUE = { r: 28, g: 78, b: 128 }; // #1c4e80
const HEADER_GREEN = { r: 16, g: 78, b: 46 };
const TABLE_ALT = { r: 245, g: 248, b: 246 };
const BORDER_COLOR: [number, number, number] = [180, 195, 185];

export type PdfQuality = "standard" | "high";

export function exportSheetsToPdf(
  data: SheetsData,
  reportDate: Date | null = null,
  quality: PdfQuality = "standard",
  comparisonData?: ComparisonResult,
) {
  const doc = buildSheetsPdfDoc(data, reportDate, quality, comparisonData);
  doc.save(reportFilename(reportDate));
}


export function buildSheetsPdfDoc(
  rawData: SheetsData,
  reportDate: Date | null = null,
  _quality: PdfQuality = "standard",
  comparisonData?: ComparisonResult,
): jsPDF {

  const data = manausFirstSheets(rawData);
  const DocConstructor = (jsPDF as any).jsPDF || jsPDF;
  const doc = new DocConstructor({ orientation: "landscape", unit: "pt", format: "a4" });
  const pageW = doc.internal.pageSize.getWidth(); // ~841.89 pt
  const pageH = doc.internal.pageSize.getHeight(); // ~595.28 pt
  const header = data.header ?? {};
  const generatedAt = new Date();
  const opDate = reportDate ?? generatedAt;
  const opDateStr = fmtDateBR(opDate);

  // Auxiliares de numeração e busca
  const num = (v: any) => (typeof v === "number" && !isNaN(v) ? v : Number(v) || 0);

  // ----------------------------------------------------
  // CABEÇALHO INSTITUCIONAL DAS PÁGINAS
  // ----------------------------------------------------
  const drawPageHeader = (pageNumber: number) => {
    doc.setPage(pageNumber);

    // Faixa Superior Escura
    doc.setFillColor(BRAND_DARK.r, BRAND_DARK.g, BRAND_DARK.b);
    doc.rect(0, 0, pageW, 56, "F");

    // Logo CBMAM
    try {
      doc.addImage(CBMAM_LOGO_BASE64, "PNG", 16, 6, 42, 44);
    } catch {
      // Fallback
    }

    // Título Principal
    doc.setTextColor(255, 255, 255);
    doc.setFont("helvetica", "bold");
    doc.setFontSize(11);
    doc.text("CORPO DE BOMBEIROS MILITAR DO AMAZONAS", pageW / 2, 20, { align: "center" });
    doc.setFontSize(12);
    doc.text("RELATÓRIO DE OCORRÊNCIAS DO AMAZONAS 2026", pageW / 2, 36, { align: "center" });

    // Oficiais Responsáveis (Esquerda)
    doc.setFontSize(6.5);
    doc.setFont("helvetica", "bold");
    doc.text("Comandante do Incidente:", 70, 16);
    doc.text("Chefe de Operações Capital:", 70, 26);
    doc.text("Chefe de Operações Interior:", 70, 36);
    doc.text("Coordenador da Sala de Situação:", 70, 46);

    doc.setFont("helvetica", "normal");
    doc.text(header.comandante || "CEL QOBM BORGES", 185, 16);
    doc.text(header.chefeCapital || "CEL QOBM MENEZES", 185, 26);
    doc.text(header.chefeInterior || "CEL QOBM MONTEIRO", 185, 36);
    doc.text((header.coordSituacao || "CEL QOBM FERREIRA").replace(/^TC\s+/i, "CEL "), 185, 46);

    // Cronograma & Período (Direita) - Alinhado à margem direita (pageW - 16)
    const rightMarginX = pageW - 16;
    const labelStartX = pageW - 250;

    doc.setFont("helvetica", "bold");
    doc.text("Período Operacional:", labelStartX, 16);
    doc.text("Próximo Período Operacional:", labelStartX, 26);
    doc.text("Reunião de Planejamento:", labelStartX, 36);
    doc.text("Reunião de Briefing:", labelStartX, 46);

    doc.setFont("helvetica", "normal");
    doc.text(header.periodo || `${opDateStr} - 8H00`, rightMarginX, 16, { align: "right" });
    doc.text(header.proximoPeriodo || `05 / AGO / 2026 - 8H00`, rightMarginX, 26, { align: "right" });
    doc.text(header.reuniaoPlanejamento || `04 / AGO / 2026 - 8H15`, rightMarginX, 36, { align: "right" });
    doc.text(header.reuniaoBriefing || `04 / AGO / 2026 - 8H30`, rightMarginX, 46, { align: "right" });
  };

  // Rodapé das páginas: numerado dinamicamente ao final (Página X de Y)
  const drawPageFooter = (_pageNumber: number) => {
    // Delegado ao fechamento para refletir a contagem total de páginas geradas.
  };

  // ====================================================
  // PÁGINA 1: EFETIVO & RECURSOS
  // ====================================================
  drawPageHeader(1);

  // EFETIVO - Separar em 3 colunas de municípios + 1 resumo
  const efetivoList = data.efetivo ?? [];
  const col1Muns = [
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
    "Jutaí",
    "Lábrea",
  ];
  const col2Muns = [
    "Manaquiri",
    "Manacapuru",
    "Manicoré",
    "Maués",
    "Novo Airão",
    "Novo Aripuanã",
    "Parintins",
    "Presidente Figueiredo",
    "Rio Preto da Eva",
    "Tabatinga",
    "Tapauá",
    "Tefé",
  ];
  const col3Muns = [
    "Boca do Acre",
    "Borba",
    "Canutama",
    "Careiro",
    "Nhamundá",
    "Urucurituba",
  ];

  const getEfetivoRow = (munName: string) => {
    const canonicalTarget = canonicalMunicipio(munName).toLowerCase();
    const matches = efetivoList.filter(
      (r) => canonicalMunicipio(r.mun).toLowerCase() === canonicalTarget,
    );
    return {
      mun: munName,
      ord: matches.reduce((s, r) => s + num(r.ord), 0),
      seg: matches.reduce((s, r) => s + num(r.seg), 0),
      brig: matches.reduce((s, r) => s + num(r.brig) + num((r as any).brig_semas), 0),
    };
  };

  const efetivoCol1 = col1Muns.map(getEfetivoRow);
  const efetivoCol2 = col2Muns.map(getEfetivoRow);
  const efetivoCol3 = col3Muns.map(getEfetivoRow);

  // Totais do Efetivo
  const totOrdCol2 = efetivoCol2.reduce((s, r) => s + r.ord, 0);
  const totSegCol2 = efetivoCol2.reduce((s, r) => s + r.seg, 0);
  const totBrigCol2 = efetivoCol2.reduce((s, r) => s + r.brig, 0);

  const totOrdCol3 = efetivoCol3.reduce((s, r) => s + r.ord, 0);
  const totSegCol3 = efetivoCol3.reduce((s, r) => s + r.seg, 0);
  const totBrigCol3 = efetivoCol3.reduce((s, r) => s + r.brig, 0);

  // Resumo Efetivo (Missão, Capital, Interior, Total)
  const manausEf = getEfetivoRow("Manaus");
  const capitalOrd = manausEf.ord;
  const capitalSeg = manausEf.seg;
  const capitalBrig = manausEf.brig;

  const allInteriorEf = efetivoList.filter((r) => r.mun?.toLowerCase() !== "manaus");
  const interiorOrd = allInteriorEf.reduce((s, r) => s + num(r.ord), 0);
  const interiorSeg = allInteriorEf.reduce((s, r) => s + num(r.seg), 0);
  const interiorBrig = allInteriorEf.reduce((s, r) => s + num(r.brig) + num((r as any).brig_semas), 0);

  // Tabela Efetivo Coluna 1
  autoTable(doc, {
    startY: 65,
    margin: { left: 16 },
    tableWidth: 175,
    head: [["MUNICÍPIO", "CBMAM", "SEG", "BRIGADISTA"]],
    body: efetivoCol1.map((r) => [r.mun, (r as any).cbmam || r.ord || "", r.seg || "", r.brig || ""]),
    styles: { fontSize: 6.5, cellPadding: 1.5, lineColor: BORDER_COLOR, lineWidth: 0.3 },
    headStyles: { fillColor: [HEADER_BLUE.r, HEADER_BLUE.g, HEADER_BLUE.b], textColor: 255, fontStyle: "bold", fontSize: 6.5, halign: "center" },
    columnStyles: { 0: { halign: "left" }, 1: { halign: "center" }, 2: { halign: "center" }, 3: { halign: "center" } },
  });

  // Tabela Efetivo Coluna 2
  autoTable(doc, {
    startY: 65,
    margin: { left: 198 },
    tableWidth: 175,
    head: [["MUNICÍPIO", "CBMAM", "SEG", "BRIGADISTA"]],
    body: [
      ...efetivoCol2.map((r) => [r.mun, (r as any).cbmam || r.ord || "", r.seg || "", r.brig || ""]),
      ["Total", totOrdCol2 || "0", totSegCol2 || "0", totBrigCol2 || "0"],
    ],
    styles: { fontSize: 6.5, cellPadding: 1.5, lineColor: BORDER_COLOR, lineWidth: 0.3 },
    headStyles: { fillColor: [HEADER_BLUE.r, HEADER_BLUE.g, HEADER_BLUE.b], textColor: 255, fontStyle: "bold", fontSize: 6.5, halign: "center" },
    columnStyles: { 0: { halign: "left" }, 1: { halign: "center" }, 2: { halign: "center" }, 3: { halign: "center" } },
  });

  // Tabela Efetivo Coluna 3 (Bases Temporárias)
  autoTable(doc, {
    startY: 65,
    margin: { left: 380 },
    tableWidth: 175,
    head: [["BASES TEMPORÁRIAS", "CBMAM", "SEG", "BRIGADISTA"]],
    body: [
      ...efetivoCol3.map((r) => [r.mun, (r as any).cbmam || r.ord || "", r.seg || "", r.brig || ""]),
      ["TOTAL", totOrdCol3 || "0", totSegCol3 || "0", totBrigCol3 || "0"],
    ],
    styles: { fontSize: 6.5, cellPadding: 1.5, lineColor: BORDER_COLOR, lineWidth: 0.3 },
    headStyles: { fillColor: [HEADER_BLUE.r, HEADER_BLUE.g, HEADER_BLUE.b], textColor: 255, fontStyle: "bold", fontSize: 6.5, halign: "center" },
    columnStyles: { 0: { halign: "left" }, 1: { halign: "center" }, 2: { halign: "center" }, 3: { halign: "center" } },
  });

  // Tabela Resumo Efetivo
  autoTable(doc, {
    startY: 65,
    margin: { left: 562 },
    tableWidth: 260,
    head: [["MISSÃO", "CAPITAL", "INTERIOR", "TOTAL"]],
    body: [
      ["SV ORD", capitalOrd, interiorOrd, capitalOrd + interiorOrd],
      ["SEG", capitalSeg, interiorSeg, capitalSeg + interiorSeg],
      ["BRIGADISTA", capitalBrig, interiorBrig, capitalBrig + interiorBrig],
      ["TOTAL", capitalOrd + capitalSeg + capitalBrig, interiorOrd + interiorSeg + interiorBrig, capitalOrd + capitalSeg + capitalBrig + interiorOrd + interiorSeg + interiorBrig],
    ],
    styles: { fontSize: 7, cellPadding: 2.5, lineColor: BORDER_COLOR, lineWidth: 0.3 },
    headStyles: { fillColor: [HEADER_BLUE.r, HEADER_BLUE.g, HEADER_BLUE.b], textColor: 255, fontStyle: "bold", fontSize: 7, halign: "center" },
    columnStyles: { 0: { fontStyle: "bold" }, 1: { halign: "center" }, 2: { halign: "center" }, 3: { halign: "center", fontStyle: "bold" } },
  });

  // ----------------------------------------------------
  // RECURSOS EMPREGADOS (Tabela Principal + Resumo)
  // ----------------------------------------------------
  const recursosList = data.recursos ?? [];
  const recKeys = [
    "abt", "at", "atp", "ata", "abf", "atf", "abs", "pipa", "dosa", "crs", "ar", "ur", "gse", "mt", "ta", "embarcacao", "picape_fn", "picape_muni", "autoarp", "picape_esfron", "helicoptero", "aviao", "jetski", "quadriciclo", "aem"
  ];
  const recLabels = [
    "ABT", "AT", "ATP", "ATA", "ABF", "ATF", "ABS", "PIPA", "DOSA", "CRS", "AR", "UR", "GSE", "MT", "TA", "EMBARC.", "PIC.FN", "PIC.MUNI", "AUTOARP", "PIC.ESFRON", "HELIC.", "AVIÃO", "JET SKI", "QUADRIC.", "AEM"
  ];

  const recBody = recursosList.map((r) => {
    const rowVals = recKeys.map((k) => (num(r[k]) ? num(r[k]) : ""));
    const rowTot = recKeys.reduce((s, k) => s + num(r[k]), 0);
    return [r.mun, ...rowVals, rowTot || ""];
  });

  const recTotaisCols = recKeys.map((k) => recursosList.reduce((s, r) => s + num(r[k]), 0));
  const recGrandTotal = recTotaisCols.reduce((a, b) => a + b, 0);

  autoTable(doc, {
    startY: 235,
    margin: { left: 16 },
    tableWidth: 517,
    head: [["MUNICÍPIO", ...recLabels, "TOTAL"]],
    body: [
      ...recBody,
      ["TOTAL GERAL", ...recTotaisCols.map((v) => v || "0"), recGrandTotal],
    ],
    styles: { fontSize: 5.5, cellPadding: 1, lineColor: BORDER_COLOR, lineWidth: 0.25 },
    headStyles: { fillColor: [HEADER_BLUE.r, HEADER_BLUE.g, HEADER_BLUE.b], textColor: 255, fontStyle: "bold", fontSize: 5.5, halign: "center" },
    columnStyles: Object.fromEntries([
      [0, { cellWidth: 70, fontStyle: "bold" }],
      ...recKeys.map((_, i) => [i + 1, { cellWidth: 17, halign: "center" }]),
      [recKeys.length + 1, { cellWidth: 22, halign: "center", fontStyle: "bold" }],
    ]),
  });

  // Resumo Recursos (Direita)
  const resumoRec1 = [
    ["ABT", recTotaisCols[0] || 0],
    ["AT", recTotaisCols[1] || 0],
    ["AEM", recTotaisCols[24] || 0],
    ["ATP", recTotaisCols[2] || 0],
    ["ATA", recTotaisCols[3] || 0],
    ["ABF", recTotaisCols[4] || 0],
    ["ATF", recTotaisCols[5] || 0],
    ["ABS", recTotaisCols[6] || 0],
    ["PIPA", recTotaisCols[7] || 0],
    ["DOSA", recTotaisCols[8] || 0],
    ["CRS", recTotaisCols[9] || 0],
    ["AR", recTotaisCols[10] || 0],
    ["UR", recTotaisCols[11] || 0],
    ["GSE", recTotaisCols[12] || 0],
  ];

  const resumoRec2 = [
    ["MT", recTotaisCols[13] || 0],
    ["TA", recTotaisCols[14] || 0],
    ["QUADRICICLO", recTotaisCols[23] || 0],
    ["EMBARCAÇÃO", recTotaisCols[15] || 0],
    ["PICAPE FN", recTotaisCols[16] || 0],
    ["PICAPE MUNI", recTotaisCols[17] || 0],
    ["AUTOARP", recTotaisCols[18] || 0],
    ["PICAPE ESFRON", recTotaisCols[19] || 0],
    ["HELICÓPTERO", recTotaisCols[20] || 0],
    ["AVIÃO", recTotaisCols[21] || 0],
    ["JET SKI", recTotaisCols[22] || 0],
  ];

  autoTable(doc, {
    startY: 235,
    margin: { left: 562 },
    tableWidth: 125,
    head: [["RECURSOS", "QTD"]],
    body: resumoRec1,
    styles: { fontSize: 6.5, cellPadding: 1.5, lineColor: BORDER_COLOR, lineWidth: 0.3 },
    headStyles: { fillColor: [HEADER_BLUE.r, HEADER_BLUE.g, HEADER_BLUE.b], textColor: 255, fontStyle: "bold", fontSize: 6.5, halign: "center" },
    columnStyles: { 0: { fontStyle: "bold" }, 1: { halign: "center", fontStyle: "bold" } },
  });

  autoTable(doc, {
    startY: 235,
    margin: { left: 693 },
    tableWidth: 129,
    head: [["RECURSOS", "QTD"]],
    body: [
      ...resumoRec2,
      [{ content: "TOTAL RECURSOS", colSpan: 1, styles: { fontStyle: "bold" } }, { content: recGrandTotal, styles: { fontStyle: "bold", halign: "center" } }],
    ],
    styles: { fontSize: 6.5, cellPadding: 1.5, lineColor: BORDER_COLOR, lineWidth: 0.3 },
    headStyles: { fillColor: [HEADER_BLUE.r, HEADER_BLUE.g, HEADER_BLUE.b], textColor: 255, fontStyle: "bold", fontSize: 6.5, halign: "center" },
    columnStyles: { 0: { fontStyle: "bold" }, 1: { halign: "center", fontStyle: "bold" } },
  });

  drawPageFooter(1);

  // ====================================================
  // PÁGINA 2: INCÊNDIOS DIÁRIOS & ACUMULADOS
  // ====================================================
  doc.addPage();
  drawPageHeader(2);

  const incDiarios = data.incendios_diario ?? [];
  const incAcumulados = data.incendios_acumulado ?? [];

  // Tabela Esquerda: INCÊNDIOS DIÁRIOS
  const incDiariosBody = incDiarios.map((r) => {
    const u = num(r.urb);
    const f = num(r.flor);
    const foc = num(r.focos);
    const tot = u + f; // Focos NÃO entra no total
    return [r.mun, u || "", f || "", foc || "", tot || ""];
  });

  const totDiarioUrb = incDiarios.reduce((s, r) => s + num(r.urb), 0);
  const totDiarioFlor = incDiarios.reduce((s, r) => s + num(r.flor), 0);
  const totDiarioFocos = incDiarios.reduce((s, r) => s + num(r.focos), 0);
  const totDiarioOcorrencias = totDiarioUrb + totDiarioFlor;

  autoTable(doc, {
    startY: 65,
    margin: { left: 16 },
    tableWidth: 320,
    head: [
      [{ content: `INCÊNDIOS - OCORRÊNCIAS DIÁRIAS EM ${opDateStr}`, colSpan: 5, styles: { fillColor: [HEADER_BLUE.r, HEADER_BLUE.g, HEADER_BLUE.b], textColor: 255, fontStyle: "bold", halign: "center" } }],
      ["MUNICÍPIO", "INCÊNDIO URBANO", "INCÊNDIO FLORESTAL", "FOCOS COMBATIDOS", "TOTAL DE OCORRÊNCIAS"],
    ],
    body: [
      ...incDiariosBody,
      ["TOTAL", totDiarioUrb, totDiarioFlor, totDiarioFocos, totDiarioOcorrencias],
    ],
    styles: { fontSize: 6.5, cellPadding: 1.5, lineColor: BORDER_COLOR, lineWidth: 0.3 },
    headStyles: { fillColor: [HEADER_BLUE.r, HEADER_BLUE.g, HEADER_BLUE.b], textColor: 255, fontStyle: "bold", fontSize: 6, halign: "center" },
    columnStyles: { 0: { fontStyle: "bold", cellWidth: 100 }, 1: { halign: "center" }, 2: { halign: "center" }, 3: { halign: "center" }, 4: { halign: "center", fontStyle: "bold" } },
  });

  // Tabela Direita: INCÊNDIOS ACUMULADOS
  const incAcumBody = incAcumulados.map((r, idx) => {
    const u = num(r.urb);
    const f = num(r.flor);
    const foc = num(r.focos);
    const sat = num(r.sat);
    const area = num(r.area);
    const tot = u + f;
    return [idx + 1, r.mun, u || "", f || "", foc || "", sat || "", area ? NF.format(area) : "", tot || ""];
  });

  const totAcumUrb = incAcumulados.reduce((s, r) => s + num(r.urb), 0);
  const totAcumFlor = incAcumulados.reduce((s, r) => s + num(r.flor), 0);
  const totAcumFocos = incAcumulados.reduce((s, r) => s + num(r.focos), 0);
  const totAcumSat = incAcumulados.reduce((s, r) => s + num(r.sat), 0);
  const totAcumArea = incAcumulados.reduce((s, r) => s + num(r.area), 0);
  const totAcumOcorrencias = totAcumUrb + totAcumFlor;

  autoTable(doc, {
    startY: 65,
    margin: { left: 345 },
    tableWidth: 480,
    head: [
      [{ content: `INCÊNDIOS - OCORRÊNCIAS DE 01/06/2026 À ${opDateStr}`, colSpan: 8, styles: { fillColor: [HEADER_BLUE.r, HEADER_BLUE.g, HEADER_BLUE.b], textColor: 255, fontStyle: "bold", halign: "center" } }],
      ["Nº", "MUNICÍPIO", "INCÊNDIO URBANO", "INCÊNDIO FLORESTAL", "FOCOS COMBATIDOS", "FOCOS DETECTADOS SATÉLITE", "TOTAL DE ÁREA POR METROS²", "TOTAL DE OCORRÊNCIAS"],
    ],
    body: [
      ...incAcumBody,
      ["TOTAL", "", totAcumUrb, totAcumFlor, totAcumFocos, totAcumSat, NF.format(totAcumArea), totAcumOcorrencias],
    ],
    styles: { fontSize: 6.5, cellPadding: 1.5, lineColor: BORDER_COLOR, lineWidth: 0.3 },
    headStyles: { fillColor: [HEADER_BLUE.r, HEADER_BLUE.g, HEADER_BLUE.b], textColor: 255, fontStyle: "bold", fontSize: 5.8, halign: "center" },
    columnStyles: { 0: { cellWidth: 20, halign: "center" }, 1: { fontStyle: "bold", cellWidth: 100 }, 2: { halign: "center" }, 3: { halign: "center" }, 4: { halign: "center" }, 5: { halign: "center" }, 6: { halign: "center" }, 7: { halign: "center", fontStyle: "bold" } },
  });

  drawPageFooter(2);

  // ====================================================
  // PÁGINA 3: RESUMOS, OUTRAS OCORRÊNCIAS & ASSINATURAS
  // ====================================================
  doc.addPage();
  drawPageHeader(3);

  // 1. INCÊNDIOS - RESUMO DO DIA (Topo Esquerda)
  const manausIncDiario = incDiarios.find((r) => r.mun?.toLowerCase() === "manaus");
  const interiorIncDiario = incDiarios.filter((r) => r.mun?.toLowerCase() !== "manaus");

  const capUrbD = num(manausIncDiario?.urb);
  const capFlorD = num(manausIncDiario?.flor);
  const capFocosD = num(manausIncDiario?.focos);

  const intUrbD = interiorIncDiario.reduce((s, r) => s + num(r.urb), 0);
  const intFlorD = interiorIncDiario.reduce((s, r) => s + num(r.flor), 0);
  const intFocosD = interiorIncDiario.reduce((s, r) => s + num(r.focos), 0);

  autoTable(doc, {
    startY: 65,
    margin: { left: 16 },
    tableWidth: 260,
    head: [
      [{ content: `INCÊNDIOS - RESUMO DE ${opDateStr}`, colSpan: 5, styles: { fillColor: [HEADER_BLUE.r, HEADER_BLUE.g, HEADER_BLUE.b], textColor: 255, fontStyle: "bold", halign: "center" } }],
      ["REGIÃO", "INCÊNDIO URBANO", "INCÊNDIO FLORESTAL", "FOCOS DOS INC. FLORESTAIS", "TOTAL DE OCORRÊNCIAS"],
    ],
    body: [
      ["CAPITAL", capUrbD, capFlorD, capFocosD, capUrbD + capFlorD],
      ["INTERIOR", intUrbD, intFlorD, intFocosD, intUrbD + intFlorD],
      ["TOTAL", capUrbD + intUrbD, capFlorD + intFlorD, capFocosD + intFocosD, capUrbD + capFlorD + intUrbD + intFlorD],
    ],
    styles: { fontSize: 6.5, cellPadding: 2, lineColor: BORDER_COLOR, lineWidth: 0.3 },
    headStyles: { fillColor: [HEADER_BLUE.r, HEADER_BLUE.g, HEADER_BLUE.b], textColor: 255, fontStyle: "bold", fontSize: 6, halign: "center" },
    columnStyles: { 0: { fontStyle: "bold" }, 1: { halign: "center" }, 2: { halign: "center" }, 3: { halign: "center" }, 4: { halign: "center", fontStyle: "bold" } },
  });

  // 2. INCÊNDIOS - RESUMO ACUMULADO (Topo Centro)
  const manausIncAcum = incAcumulados.find((r) => r.mun?.toLowerCase() === "manaus");
  const interiorIncAcum = incAcumulados.filter((r) => r.mun?.toLowerCase() !== "manaus");

  const capUrbA = num(manausIncAcum?.urb);
  const capFlorA = num(manausIncAcum?.flor);
  const capFocosA = num(manausIncAcum?.focos);

  const intUrbA = interiorIncAcum.reduce((s, r) => s + num(r.urb), 0);
  const intFlorA = interiorIncAcum.reduce((s, r) => s + num(r.flor), 0);
  const intFocosA = interiorIncAcum.reduce((s, r) => s + num(r.focos), 0);

  autoTable(doc, {
    startY: 65,
    margin: { left: 286 },
    tableWidth: 320,
    head: [
      [{ content: `INCÊNDIOS - OCORRÊNCIAS DE 01/06/2026 ATÉ ${opDateStr}`, colSpan: 5, styles: { fillColor: [HEADER_BLUE.r, HEADER_BLUE.g, HEADER_BLUE.b], textColor: 255, fontStyle: "bold", halign: "center" } }],
      ["REGIÃO", "INCÊNDIO URBANO", "INCÊNDIO FLORESTAL", "FOCOS DOS INC. FLORESTAIS", "TOTAL DE OCORRÊNCIAS"],
    ],
    body: [
      ["CAPITAL", capUrbA, capFlorA, capFocosA, capUrbA + capFlorA],
      ["INTERIOR", intUrbA, intFlorA, intFocosA, intUrbA + intFlorA],
      ["TOTAL", capUrbA + intUrbA, capFlorA + intFlorA, capFocosA + intFocosA, capUrbA + capFlorA + intUrbA + intFlorA],
    ],
    styles: { fontSize: 6.5, cellPadding: 2, lineColor: BORDER_COLOR, lineWidth: 0.3 },
    headStyles: { fillColor: [HEADER_BLUE.r, HEADER_BLUE.g, HEADER_BLUE.b], textColor: 255, fontStyle: "bold", fontSize: 6, halign: "center" },
    columnStyles: { 0: { fontStyle: "bold" }, 1: { halign: "center" }, 2: { halign: "center" }, 3: { halign: "center" }, 4: { halign: "center", fontStyle: "bold" } },
  });

  // 3. CONCEITOS / OBSERVAÇÕES (Topo Direita)
  autoTable(doc, {
    startY: 65,
    margin: { left: 616 },
    tableWidth: 209,
    head: [
      [{ content: "CONCEITOS / OBSERVAÇÕES", styles: { fillColor: [HEADER_BLUE.r, HEADER_BLUE.g, HEADER_BLUE.b], textColor: 255, fontStyle: "bold", halign: "center" } }],
    ],
    body: [
      [
        "FOCOS: São contabilizados das Ocorrências de Incêndios Florestais confirmados, in loco, ainda que não ocorra o combate mas com mensuração de área queimada.\n\nDESCONSIDERADAS as OCORRÊNCIAS DE TROTE, se in loco não houver confirmação de populares ou identificação da área queimada.\n\nINCÊNDIO FLORESTAL: deve ser igual ao número.",
      ],
    ],
    styles: { fontSize: 5.5, cellPadding: 3, lineColor: BORDER_COLOR, lineWidth: 0.3 },
    headStyles: { fillColor: [HEADER_BLUE.r, HEADER_BLUE.g, HEADER_BLUE.b], textColor: 255, fontStyle: "bold", fontSize: 6, halign: "center" },
  });

  // ----------------------------------------------------
  // OUTRAS OCORRÊNCIAS DIÁRIAS (Página 3 - Centro / Base)
  // ----------------------------------------------------
  const outrasList = data.outras_diarias ?? [];
  const outrasBody = outrasList.map((r) => {
    const salv = num(r.salvamento);
    const acid = num(r.acidentes);
    const aph = num(r.aph);
    const prev = num(r.prevencao);
    const serv = num(r.servicos);
    const tot = salv + acid + aph + prev + serv;
    return [r.mun, salv || "", acid || "", aph || "", prev || "", serv || "", tot || ""];
  });

  const totSalv = outrasList.reduce((s, r) => s + num(r.salvamento), 0);
  const totAcid = outrasList.reduce((s, r) => s + num(r.acidentes), 0);
  const totAph = outrasList.reduce((s, r) => s + num(r.aph), 0);
  const totPrev = outrasList.reduce((s, r) => s + num(r.prevencao), 0);
  const totServ = outrasList.reduce((s, r) => s + num(r.servicos), 0);
  const grandOutras = totSalv + totAcid + totAph + totPrev + totServ;

  // Tabela Outras Ocorrências Diárias
  autoTable(doc, {
    startY: 135,
    margin: { left: 16 },
    tableWidth: 460,
    head: [
      [
        {
          content: `OUTRAS OCORRÊNCIAS DIÁRIAS EM ${opDateStr}`,
          colSpan: 7,
          styles: {
            fillColor: [HEADER_BLUE.r, HEADER_BLUE.g, HEADER_BLUE.b],
            textColor: 255,
            fontStyle: "bold",
            halign: "center",
          },
        },
      ],
      ["MUNICÍPIO", "SALVAMENTO", "ACIDENTES", "APH", "AÇÃO DE PREVENÇÃO", "SERVIÇOS TÉCNICOS", "TOTAL"],
    ],
    body: [
      ...outrasBody,
      ["TOTAL", totSalv, totAcid, totAph, totPrev, totServ, grandOutras],
    ],
    styles: { fontSize: 5.5, cellPadding: 1, lineColor: BORDER_COLOR, lineWidth: 0.25 },
    headStyles: {
      fillColor: [HEADER_BLUE.r, HEADER_BLUE.g, HEADER_BLUE.b],
      textColor: 255,
      fontStyle: "bold",
      fontSize: 5.5,
      halign: "center",
    },
    columnStyles: {
      0: { fontStyle: "bold", cellWidth: 100 },
      1: { halign: "center" },
      2: { halign: "center" },
      3: { halign: "center" },
      4: { halign: "center" },
      5: { halign: "center" },
      6: { halign: "center", fontStyle: "bold" },
    },
  });

  // Resumo Regional de Outras Ocorrências (Direita)
  const manausOutras = outrasList.find((r) => r.mun?.toLowerCase() === "manaus");
  const interiorOutras = outrasList.filter((r) => r.mun?.toLowerCase() !== "manaus");

  const capSalv = num(manausOutras?.salvamento);
  const capAcid = num(manausOutras?.acidentes);
  const capAph = num(manausOutras?.aph);
  const capPrev = num(manausOutras?.prevencao);
  const capServ = num(manausOutras?.servicos);
  const capTot = capSalv + capAcid + capAph + capPrev + capServ;

  const intSalv = interiorOutras.reduce((s, r) => s + num(r.salvamento), 0);
  const intAcid = interiorOutras.reduce((s, r) => s + num(r.acidentes), 0);
  const intAph = interiorOutras.reduce((s, r) => s + num(r.aph), 0);
  const intPrev = interiorOutras.reduce((s, r) => s + num(r.prevencao), 0);
  const intServ = interiorOutras.reduce((s, r) => s + num(r.servicos), 0);
  const intTot = intSalv + intAcid + intAph + intPrev + intServ;

  autoTable(doc, {
    startY: 135,
    margin: { left: 486 },
    tableWidth: 339,
    head: [
      [
        {
          content: `RESUMO DE OUTRAS OCORRÊNCIAS EM ${opDateStr}`,
          colSpan: 7,
          styles: {
            fillColor: [HEADER_BLUE.r, HEADER_BLUE.g, HEADER_BLUE.b],
            textColor: 255,
            fontStyle: "bold",
            halign: "center",
          },
        },
      ],
      ["REGIÃO / TIPO", "SALV.", "ACID.", "APH", "PREV.", "SERV.", "TOTAL"],
    ],
    body: [
      ["CAPITAL", capSalv, capAcid, capAph, capPrev, capServ, capTot],
      ["INTERIOR", intSalv, intAcid, intAph, intPrev, intServ, intTot],
      ["TOTAL", totSalv, totAcid, totAph, totPrev, totServ, grandOutras],
    ],
    styles: { fontSize: 6.5, cellPadding: 2, lineColor: BORDER_COLOR, lineWidth: 0.3 },
    headStyles: {
      fillColor: [HEADER_BLUE.r, HEADER_BLUE.g, HEADER_BLUE.b],
      textColor: 255,
      fontStyle: "bold",
      fontSize: 6,
      halign: "center",
    },
    columnStyles: {
      0: { fontStyle: "bold" },
      1: { halign: "center" },
      2: { halign: "center" },
      3: { halign: "center" },
      4: { halign: "center" },
      5: { halign: "center" },
      6: { halign: "center", fontStyle: "bold" },
    },
  });

  // Card Total Geral de Atendimentos Diários
  const totalGeralDia = totDiarioOcorrencias + grandOutras;
  autoTable(doc, {
    startY: 235,
    margin: { left: 486 },
    tableWidth: 339,
    head: [
      [
        {
          content: "CONSOLIDADO GERAL DE ATENDIMENTOS DO DIA",
          colSpan: 3,
          styles: {
            fillColor: [BRAND_DARK.r, BRAND_DARK.g, BRAND_DARK.b],
            textColor: 255,
            fontStyle: "bold",
            halign: "center",
          },
        },
      ],
      ["INCÊNDIOS COMBATIDOS", "ATENDIMENTOS DIVERSOS", "TOTAL GERAL NO ESTADO"],
    ],
    body: [
      [
        `${totDiarioOcorrencias} ocorrências`,
        `${grandOutras} atendimentos`,
        `${totalGeralDia} atendimentos CBMAM`,
      ],
    ],
    styles: { fontSize: 7, cellPadding: 3, lineColor: BORDER_COLOR, lineWidth: 0.3 },
    headStyles: {
      fillColor: [BRAND_DARK.r, BRAND_DARK.g, BRAND_DARK.b],
      textColor: 255,
      fontStyle: "bold",
      fontSize: 6.5,
      halign: "center",
    },
    columnStyles: {
      0: { halign: "center" },
      1: { halign: "center" },
      2: { halign: "center", fontStyle: "bold" },
    },
  });

  // BLOCO DE ASSINATURAS (Página 3 - Base)
  const sigY = 500;
  doc.setFont("helvetica", "bold");
  doc.setFontSize(8);
  doc.setTextColor(0, 0, 0);

  // Linhas das assinaturas
  doc.setDrawColor(0, 0, 0);
  doc.setLineWidth(0.6);
  doc.line(pageW / 2 - 280, sigY - 14, pageW / 2 - 40, sigY - 14);
  doc.line(pageW / 2 + 40, sigY - 14, pageW / 2 + 280, sigY - 14);

  // Assinatura 1: Coordenador da Operação
  doc.text("CEL QOBM CRISTIANO BRAZ FERREIRA", pageW / 2 - 160, sigY, { align: "center" });
  doc.setFont("helvetica", "normal");
  doc.setFontSize(7.5);
  doc.text("Coordenador da Operação Amazonas + Verde", pageW / 2 - 160, sigY + 10, { align: "center" });

  // Assinatura 2: Subcomandante-Geral
  doc.setFont("helvetica", "bold");
  doc.setFontSize(8);
  doc.text("CEL QOBM HELYANTHUS FRANK DA SILVA BORGES", pageW / 2 + 160, sigY, { align: "center" });
  doc.setFont("helvetica", "normal");
  doc.setFontSize(7.5);
  doc.text("Subcomandante-Geral do CBMAM", pageW / 2 + 160, sigY + 10, { align: "center" });

  // ====================================================
  // PÁGINA 4+: OCORRÊNCIAS DETALHADAS DE INCÊNDIO (CAD)
  // ====================================================
  const { rows: filteredOccs } = filterOccurrencesByDate(data.occurrences ?? [], reportDate);
  const occsToRender = filteredOccs.length > 0 ? filteredOccs : (data.occurrences ?? []);

  if (occsToRender.length > 0) {
    doc.addPage();
    const cadPageNum = (doc as any).internal.getNumberOfPages();
    drawPageHeader(cadPageNum);

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
      tableWidth: 809,
      head: [
        [
          {
            content: `OCORRÊNCIAS DETALHADAS DE INCÊNDIO (CAD) — REGISTRO OPERACIONAL ${opDateStr}`,
            colSpan: 9,
            styles: {
              fillColor: [HEADER_BLUE.r, HEADER_BLUE.g, HEADER_BLUE.b],
              textColor: 255,
              fontStyle: "bold",
              halign: "center",
            },
          },
        ],
        [
          "DATA",
          "MUNICÍPIO",
          "HORÁRIO",
          "NATUREZA",
          "ENDEREÇO",
          "FOCOS",
          "ÁREA (M²)",
          "ÁGUA (L)",
          "UNIDADE / VIATURA",
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
      styles: { fontSize: 6.5, cellPadding: 2, lineColor: BORDER_COLOR, lineWidth: 0.25 },
      headStyles: {
        fillColor: [HEADER_BLUE.r, HEADER_BLUE.g, HEADER_BLUE.b],
        textColor: 255,
        fontStyle: "bold",
        fontSize: 6.5,
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
        8: { cellWidth: 119 },
      },
      didDrawPage: (hookData) => {
        if (hookData.pageNumber > 3) {
          drawPageHeader(hookData.pageNumber);
        }
      },
    });
  }

  // ----------------------------------------------------
  // NUMERAÇÃO DINÂMICA DE TODAS AS PÁGINAS (Página X de Y)
  // ----------------------------------------------------
  const totalPages = (doc as any).internal.getNumberOfPages();
  for (let p = 1; p <= totalPages; p++) {
    doc.setPage(p);
    doc.setFont("helvetica", "normal");
    doc.setFontSize(7.5);
    doc.setTextColor(100, 100, 100);
    doc.text(`Documento oficial — uso restrito`, 20, pageH - 12);
    doc.text(`Página ${p} de ${totalPages}`, pageW - 20, pageH - 12, { align: "right" });
  }

  return doc;
}
