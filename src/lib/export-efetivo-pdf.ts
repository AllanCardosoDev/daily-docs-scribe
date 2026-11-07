import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";
import { CBMAM_LOGO_BASE64 } from "./cbmam-logo";
import { canonicalMunicipio, isNonMunicipioTroop, deduplicateAndOrderMunicipios } from "./municipio-order";
import { resolveEfetivoColumns, calculateRowTotal } from "./dashboard-columns";
import { fmtDateBR, fmtDateStamp } from "./report-date";
import { NF } from "./formatters";
import { EFETIVO_BASES_PADRAO, norm } from "./efetivo-mapas";

// Cores Institucionais CBMAM 100% Verde
const BRAND_DARK = { r: 8, g: 46, b: 31 };     // #082e1f - Verde Floresta Amazônica Profundo
const BRAND_GREEN = { r: 16, g: 78, b: 46 };   // #104e2e - Verde CBMAM Oficial
const ACCENT_GOLD = { r: 180, g: 130, b: 20 }; // #b48214 - Ouro Militar
const BG_LIGHT_ROW: [number, number, number] = [248, 250, 248];
const BORDER_COLOR: [number, number, number] = [185, 200, 190];

export interface ExportEfetivoPdfOptions {
  efetivo: Array<Record<string, any>>;
  periodoLabel?: string;
  reportDate?: Date | null;
  comandanteGeral?: string;
  subcomandante?: string;
  comandante?: string;
  coordenador?: string;
  chefeCapital?: string;
  chefeInterior?: string;
  coordSituacao?: string;
}

export function exportEfetivoPdf(options: ExportEfetivoPdfOptions) {
  const doc = buildEfetivoPdfDoc(options);
  const stamp = options.reportDate ? fmtDateStamp(options.reportDate) : fmtDateStamp(new Date());
  const slug = (options.periodoLabel || "")
    .replace(/[^a-zA-Z0-9]+/g, "-")
    .replace(/^-|-$/g, "");
  const filename = slug
    ? `relatorio-efetivo-cbmam-${slug}.pdf`
    : `relatorio-efetivo-cbmam-${stamp}.pdf`;
  doc.save(filename);
}

export function buildEfetivoPdfDoc(options: ExportEfetivoPdfOptions): jsPDF {
  const sanitizeCel = (v?: string, fallback = "") => (v || fallback).replace(/^TC\s+/i, "CEL ");
  const {
    efetivo: rawEfetivo,
    periodoLabel,
    reportDate,
    comandanteGeral = sanitizeCel(options.comandanteGeral, "CEL QOBM MUNIZ"),
    subcomandante = sanitizeCel(options.subcomandante || options.comandante, "CEL QOBM BORGES"),
    coordSituacao = sanitizeCel(options.coordSituacao || options.coordenador, "CEL QOBM FERREIRA"),
    coordenador = sanitizeCel(options.coordenador || options.coordSituacao, "CEL QOBM FERREIRA"),
  } = options;

  const DocConstructor = (jsPDF as any).jsPDF || jsPDF;
  const doc = new DocConstructor({ orientation: "landscape", unit: "pt", format: "a4" });
  const pageW = doc.internal.pageSize.getWidth(); // ~841.89 pt
  const pageH = doc.internal.pageSize.getHeight(); // ~595.28 pt

  const num = (v: any) => Math.max(0, Math.abs(typeof v === "number" && !isNaN(v) ? v : Number(v) || 0));

  // Ordenação institucional: Manaus primeiro, depois municípios alfabéticos (sem duplicidades)
  const efetivoList = deduplicateAndOrderMunicipios(rawEfetivo || []);

  const fullCols = resolveEfetivoColumns(efetivoList);
  const activeDataCols = fullCols.filter(
    (c) => c.numeric && c.key !== "mun" && c.key !== "total" && c.key !== "cbmsp",
  );

  const opDate = reportDate ?? new Date();
  const opDateStr = periodoLabel || `${fmtDateBR(opDate)} — 24H`;

  // Helpers para cálculo seguro de efetivo por linha sem duplicidade de sinônimos (cbmam, ord, servico)
  const getRowCbmam = (r: any): number => {
    const regular = Number(r.cbmam) || Number(r.servico) || Number(r.ord) || Number(r.serv_ord) || 0;
    const opamv = Number(r.opamv) || 0;
    const opam_ref = Number(r.opam_ref) || 0;
    const inc1 = Number(r.inc1 || r.inc_1) || 0;
    const inc2 = Number(r.inc2 || r.inc_2) || 0;
    const inc3 = Number(r.inc3 || r.inc_3) || 0;
    const cbmsp = Number(r.cbmsp) || 0;
    return regular + opamv + opam_ref + inc1 + inc2 + inc3 + cbmsp;
  };

  const getRowSeg = (r: any): number => Number(r.seg) || 0;
  const getRowFn = (r: any): number => Number(r.fn) || 0;
  const getRowPrev = (r: any): number => Number(r.prevfogo) || 0;
  const getRowMar = (r: any): number => Number(r.marinha || 0) + Number(r.icmbio || 0);
  const getRowBrigMun = (r: any): number => Number(r.brig_mun) || 0;
  const getRowBrigSema = (r: any): number => Number(r.brig_semas || r.brig_sema || 0);

  // Cálculos de Grupos (sem duplicações)
  const totalCbmam = efetivoList.reduce((s, r) => s + getRowCbmam(r) + getRowSeg(r), 0);
  const totalFn = efetivoList.reduce((s, r) => s + getRowFn(r), 0);
  const totalPrevfogo = efetivoList.reduce((s, r) => s + getRowPrev(r), 0);
  const totalMarinha = efetivoList.reduce((s, r) => s + getRowMar(r), 0);
  const totalFederais = totalFn + totalPrevfogo + totalMarinha;
  const totalBrigadistas = efetivoList.reduce((s, r) => s + getRowBrigMun(r) + getRowBrigSema(r), 0);

  const grandTotalEfetivo = efetivoList.reduce(
    (s, r) => s + calculateRowTotal(r, fullCols),
    0,
  );

  // ---------------------------------------------------------------------------
  // CABEÇALHO INSTITUCIONAL OFICIAL
  // ---------------------------------------------------------------------------
  doc.setFillColor(BRAND_DARK.r, BRAND_DARK.g, BRAND_DARK.b);
  doc.rect(0, 0, pageW, 54, "F");

  doc.setFillColor(ACCENT_GOLD.r, ACCENT_GOLD.g, ACCENT_GOLD.b);
  doc.rect(0, 54, pageW, 2, "F");

  try {
    doc.addImage(CBMAM_LOGO_BASE64, "PNG", 16, 5, 42, 44);
  } catch {
    // Fallback se logo falhar
  }

  // Identificação Central Oficial CBMAM / Amazonas + Verde
  doc.setFont("helvetica", "bold");
  doc.setFontSize(12);
  doc.setTextColor(255, 255, 255);
  doc.text("CBMAM", pageW / 2, 16, { align: "center" });

  doc.setFont("helvetica", "bold");
  doc.setFontSize(10.5);
  doc.setTextColor(110, 231, 183);
  doc.text("Amazonas + Verde", pageW / 2, 28, { align: "center" });

  doc.setFont("helvetica", "bold");
  doc.setFontSize(9);
  doc.setTextColor(255, 220, 140);
  doc.text("Relatório Diário — Sala de Situação", pageW / 2, 42, { align: "center" });

  // Metadados Oficiais (Esquerda — Somente os 3 Oficiais)
  doc.setTextColor(230, 240, 235);
  doc.setFontSize(7.2);
  doc.setFont("helvetica", "bold");
  doc.text("Comandante Geral:", 68, 16);
  doc.text("Sub-Comandante Geral:", 68, 28);
  doc.text("Coord. Sala Situação:", 68, 40);

  doc.setFont("helvetica", "normal");
  doc.text(comandanteGeral, 175, 16);
  doc.text(subcomandante, 175, 28);
  doc.text(coordSituacao, 175, 40);

  // Metadados (Direita)
  const rightMarginX = pageW - 16;
  const labelStartX = pageW - 225;

  doc.setFont("helvetica", "bold");
  doc.text("Período Operacional:", labelStartX, 16);
  doc.text("Data de Emissão:", labelStartX, 28);
  doc.text("Status Mobilização:", labelStartX, 40);

  doc.setFont("helvetica", "normal");
  doc.text(opDateStr, rightMarginX, 16, { align: "right" });
  doc.text(`${new Date().toLocaleDateString("pt-BR")} às ${new Date().toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" })}`, rightMarginX, 28, { align: "right" });
  doc.text("Mobilização Ativa (100%)", rightMarginX, 40, { align: "right" });

  // ---------------------------------------------------------------------------
  // KPI CARDS EXECUTIVOS
  // ---------------------------------------------------------------------------
  const drawCards = (
    startY: number,
    cards: Array<{ label: string; value: string | number; subtext: string; highlight?: boolean }>,
  ) => {
    const cardH = 28;
    const totalW = pageW - 32;
    const gap = 8;
    const cardW = (totalW - gap * (cards.length - 1)) / cards.length;

    cards.forEach((c, i) => {
      const x = 16 + i * (cardW + gap);
      if (c.highlight) {
        doc.setFillColor(BRAND_DARK.r, BRAND_DARK.g, BRAND_DARK.b);
        doc.roundedRect(x, startY, cardW, cardH, 3, 3, "F");
        doc.setDrawColor(ACCENT_GOLD.r, ACCENT_GOLD.g, ACCENT_GOLD.b);
        doc.setLineWidth(0.8);
        doc.roundedRect(x, startY, cardW, cardH, 3, 3, "S");
      } else {
        doc.setFillColor(245, 248, 246);
        doc.roundedRect(x, startY, cardW, cardH, 3, 3, "F");
        doc.setDrawColor(BORDER_COLOR[0], BORDER_COLOR[1], BORDER_COLOR[2]);
        doc.setLineWidth(0.5);
        doc.roundedRect(x, startY, cardW, cardH, 3, 3, "S");
      }

      doc.setFont("helvetica", "bold");
      doc.setFontSize(6.2);
      doc.setTextColor(c.highlight ? 220 : BRAND_DARK.r, c.highlight ? 240 : BRAND_DARK.g, c.highlight ? 230 : BRAND_DARK.b);
      doc.text(c.label.toUpperCase(), x + 8, startY + 9);

      doc.setFont("helvetica", "bold");
      doc.setFontSize(11);
      doc.setTextColor(c.highlight ? 255 : BRAND_DARK.r, c.highlight ? 220 : BRAND_DARK.g, c.highlight ? 140 : BRAND_DARK.b);
      doc.text(String(c.value), x + 8, startY + 22);

      doc.setFont("helvetica", "normal");
      doc.setFontSize(6);
      doc.setTextColor(c.highlight ? 200 : 110, c.highlight ? 225 : 120, c.highlight ? 215 : 115);
      doc.text(c.subtext, x + cardW - 8, startY + 21, { align: "right" });
    });
  };

  drawCards(62, [
    {
      label: "Efetivo Geral Total",
      value: NF.format(grandTotalEfetivo),
      subtext: "Força Operacional Ativa",
      highlight: true,
    },
    {
      label: "Militares CBMAM",
      value: NF.format(totalCbmam),
      subtext: "SV ORD, Reforço & Turmas",
    },
    {
      label: "Forças Federais & Parceiros",
      value: NF.format(totalFederais),
      subtext: "Força Nacional, Marinha, Prevfogo",
    },
    {
      label: "Brigadistas Florestais",
      value: NF.format(totalBrigadistas),
      subtext: "Brigadas Municipais & SEMA",
    },
  ]);

  // ---------------------------------------------------------------------------
  // TABELA PRINCIPAL (Esquerda, tableWidth: 540)
  // ---------------------------------------------------------------------------
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
        content: "DISTRIBUIÇÃO DETALHADA POR LOCALIDADE E BASE OPERACIONAL",
        colSpan: activeDataCols.length + 2,
        styles: {
          fillColor: [BRAND_DARK.r, BRAND_DARK.g, BRAND_DARK.b] as [number, number, number],
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
    const rowTot = calculateRowTotal(r, fullCols);
    return [canonicalMunicipio(r.mun || r.municipio), ...rowVals, rowTot > 0 ? rowTot : 0];
  });

  const efColTotals = activeDataCols.map((c) =>
    efetivoList.reduce((s, r) => s + num(r[c.key]), 0),
  );

  autoTable(doc, {
    startY: 96,
    margin: { left: 16 },
    tableWidth: 540,
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
      fillColor: [BRAND_GREEN.r, BRAND_GREEN.g, BRAND_GREEN.b],
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

  // ---------------------------------------------------------------------------
  // PAINEL LATERAL DIREITO (left: 564, tableWidth: 262)
  // ---------------------------------------------------------------------------
  const baseNormSet = new Set(EFETIVO_BASES_PADRAO.map((b) => norm(b)));
  const isBaseRow = (r: any) =>
    baseNormSet.has(norm(r?.mun)) || /posto|base\b|km\s*53/i.test(r?.mun || "");
  const isCapitalRow = (r: any) => norm(r?.mun) === "manaus";

  const manausEf = efetivoList.find(isCapitalRow) ?? { mun: "Manaus" };
  const basesEf = efetivoList.filter(isBaseRow);
  const interiorEf = efetivoList.filter((r) => !isCapitalRow(r) && !isBaseRow(r));

  const sumList = (list: any[], fn: (r: any) => number) => list.reduce((s, r) => s + fn(r), 0);
  const getRowRegularCbmam = (r: any) =>
    (Number(r.cbmam) || Number(r.servico) || Number(r.ord) || Number(r.serv_ord) || 0) + Number(r.seg || 0);
  const getRowOpam = (r: any) => Number(r.opamv || 0) + Number(r.opam_ref || 0);
  const getRowTurmas = (r: any) =>
    Number(r.inc1 || r.inc_1 || 0) + Number(r.inc2 || r.inc_2 || 0) + Number(r.inc3 || r.inc_3 || 0);
  const getRowParceiros = (r: any) =>
    Number(r.fn || 0) + Number(r.prevfogo || 0) + Number(r.marinha || 0) + Number(r.icmbio || 0);
  const getRowBrig = (r: any) =>
    Number(r.brig_mun || 0) + Number(r.brig_semas || r.brig_sema || 0);

  const getListTotal = (list: any[]) => {
    return list.reduce((s, r) => s + calculateRowTotal(r, fullCols), 0);
  };

  const cbmamCapital = sumList([manausEf], getRowRegularCbmam);
  const cbmamInterior = sumList(interiorEf, getRowRegularCbmam);
  const cbmamBases = sumList(basesEf, getRowRegularCbmam);

  const opamCapital = sumList([manausEf], getRowOpam);
  const opamInterior = sumList(interiorEf, getRowOpam);
  const opamBases = sumList(basesEf, getRowOpam);

  const turmasCapital = sumList([manausEf], getRowTurmas);
  const turmasInterior = sumList(interiorEf, getRowTurmas);
  const turmasBases = sumList(basesEf, getRowTurmas);

  const parceirosCapital = sumList([manausEf], getRowParceiros);
  const parceirosInterior = sumList(interiorEf, getRowParceiros);
  const parceirosBases = sumList(basesEf, getRowParceiros);

  const brigCapital = sumList([manausEf], getRowBrig);
  const brigInterior = sumList(interiorEf, getRowBrig);
  const brigBases = sumList(basesEf, getRowBrig);

  const totalCapital = getListTotal([manausEf]);
  const totalInterior = getListTotal(interiorEf);
  const totalBases = getListTotal(basesEf);

  const resumoTerritorialBody = [
    [
      "Capital (Manaus)",
      cbmamCapital || "0",
      opamCapital || "0",
      turmasCapital || "0",
      parceirosCapital || "0",
      brigCapital || "0",
      totalCapital || "0",
    ],
    [
      "Interior (Municípios)",
      cbmamInterior || "0",
      opamInterior || "0",
      turmasInterior || "0",
      parceirosInterior || "0",
      brigInterior || "0",
      totalInterior || "0",
    ],
    [
      "Bases Avançadas / Postos",
      cbmamBases || "0",
      opamBases || "0",
      turmasBases || "0",
      parceirosBases || "0",
      brigBases || "0",
      totalBases || "0",
    ],
    [
      "TOTAL GERAL",
      cbmamCapital + cbmamInterior + cbmamBases || "0",
      opamCapital + opamInterior + opamBases || "0",
      turmasCapital + turmasInterior + turmasBases || "0",
      parceirosCapital + parceirosInterior + parceirosBases || "0",
      brigCapital + brigInterior + brigBases || "0",
      grandTotalEfetivo || "0",
    ],
  ];

  autoTable(doc, {
    startY: 96,
    margin: { left: 564 },
    tableWidth: 262,
    head: [
      [
        {
          content: "SÍNTESE POR TERRITÓRIO & TIPO DE FORÇA",
          colSpan: 7,
          styles: {
            fillColor: [BRAND_DARK.r, BRAND_DARK.g, BRAND_DARK.b],
            textColor: 255,
            fontStyle: "bold",
            halign: "center",
            fontSize: 6.8,
          },
        },
      ],
      ["ÂMBITO", "ORD", "OPAM", "TURMAS", "FED", "BRIG", "TOTAL"],
    ],
    body: resumoTerritorialBody,
    styles: {
      fontSize: 5.8,
      cellPadding: 1.8,
      lineColor: BORDER_COLOR,
      lineWidth: 0.25,
      halign: "center",
    },
    alternateRowStyles: { fillColor: BG_LIGHT_ROW },
    headStyles: {
      fillColor: [BRAND_GREEN.r, BRAND_GREEN.g, BRAND_GREEN.b],
      textColor: 255,
      fontStyle: "bold",
      fontSize: 5.8,
      halign: "center",
    },
    columnStyles: {
      0: { fontStyle: "bold", halign: "left", cellWidth: 70 },
      6: { fontStyle: "bold", fillColor: [235, 245, 238] },
    },
  });

  const lastTableY = (doc as any).lastAutoTable.finalY + 8;

  // Tabela de Tropas Federais & Parceiras
  const totalCbmsp = efetivoList.reduce((s, r) => s + num(r.cbmsp), 0);
  const totalBrig = totalBrigadistas;

  const tropasFederaisBody = [
    ["Corpo de Bombeiros Militar do AM (CBMAM)", totalCbmam, grandTotalEfetivo > 0 ? ((totalCbmam / grandTotalEfetivo) * 100).toFixed(1) + "%" : "0%"],
    ["Força Nacional de Segurança Pública (FN)", totalFn, grandTotalEfetivo > 0 ? ((totalFn / grandTotalEfetivo) * 100).toFixed(1) + "%" : "0%"],
    ["IBAMA / PREVFOGO (Brigadas Federais)", totalPrevfogo, grandTotalEfetivo > 0 ? ((totalPrevfogo / grandTotalEfetivo) * 100).toFixed(1) + "%" : "0%"],
    ["Marinha do Brasil & ICMBio", totalMarinha, grandTotalEfetivo > 0 ? ((totalMarinha / grandTotalEfetivo) * 100).toFixed(1) + "%" : "0%"],
    ["Corpo de Bombeiros da PMESP (CBMSP)", totalCbmsp, grandTotalEfetivo > 0 ? ((totalCbmsp / grandTotalEfetivo) * 100).toFixed(1) + "%" : "0%"],
    ["Brigadas Civis Municipais & SEMA", totalBrig, grandTotalEfetivo > 0 ? ((totalBrig / grandTotalEfetivo) * 100).toFixed(1) + "%" : "0%"],
    ["TOTAL FORÇA INTEGRADA MOBILIZADA", grandTotalEfetivo, "100.0%"],
  ];

  autoTable(doc, {
    startY: lastTableY,
    margin: { left: 564 },
    tableWidth: 262,
    head: [
      [
        {
          content: "COMPOSIÇÃO INTEGRADA DAS FORÇAS (INTERINSTITUCIONAL)",
          colSpan: 3,
          styles: {
            fillColor: [BRAND_DARK.r, BRAND_DARK.g, BRAND_DARK.b],
            textColor: 255,
            fontStyle: "bold",
            halign: "center",
            fontSize: 6.8,
          },
        },
      ],
      ["FORÇA / INSTITUIÇÃO", "EFETIVO", "PART."],
    ],
    body: tropasFederaisBody,
    styles: {
      fontSize: 5.6,
      cellPadding: 1.8,
      lineColor: BORDER_COLOR,
      lineWidth: 0.25,
      halign: "left",
    },
    alternateRowStyles: { fillColor: BG_LIGHT_ROW },
    headStyles: {
      fillColor: [BRAND_GREEN.r, BRAND_GREEN.g, BRAND_GREEN.b],
      textColor: 255,
      fontStyle: "bold",
      fontSize: 5.8,
      halign: "center",
    },
    columnStyles: {
      0: { fontStyle: "bold", cellWidth: 152 },
      1: { halign: "center", fontStyle: "bold", cellWidth: 55, textColor: [16, 78, 46] },
      2: { halign: "center", fontStyle: "bold", cellWidth: 55 },
    },
  });

  // ---------------------------------------------------------------------------
  // RODAPÉ E AUTENTICAÇÃO OFICIAL
  // ---------------------------------------------------------------------------
  const footerY = pageH - 24;
  doc.setDrawColor(BORDER_COLOR[0], BORDER_COLOR[1], BORDER_COLOR[2]);
  doc.setLineWidth(0.5);
  doc.line(16, footerY - 4, pageW - 16, footerY - 4);

  doc.setFont("helvetica", "normal");
  doc.setFontSize(6.5);
  doc.setTextColor(100, 110, 105);
  doc.text(
    "Corpo de Bombeiros Militar do Estado do Amazonas · Sistema Integrado de Comando e Controle Operacional · Operação Amazonas + Verde",
    16,
    footerY + 8,
  );
  doc.text(
    `Documento emitido eletronicamente em ${new Date().toLocaleDateString("pt-BR")} às ${new Date().toLocaleTimeString("pt-BR")} · Sala de Situação CBMAM`,
    pageW - 16,
    footerY + 8,
    { align: "right" },
  );

  return doc;
}

