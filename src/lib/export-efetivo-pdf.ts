import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";
import { CBMAM_LOGO_BASE64 } from "./cbmam-logo";
import { canonicalMunicipio, isNonMunicipioTroop } from "./municipio-order";
import { resolveEfetivoColumns, calculateRowTotal } from "./dashboard-columns";
import { fmtDateBR, fmtDateStamp } from "./report-date";
import { NF } from "./formatters";

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
  const {
    efetivo: rawEfetivo,
    periodoLabel,
    reportDate,
    comandante = "CEL QOBM BORGES",
    coordenador = "CEL QOBM CRISTIANO BRAZ FERREIRA",
    chefeCapital = "CEL QOBM MENEZES",
    chefeInterior = "CEL QOBM MONTEIRO",
    coordSituacao = "CEL QOBM FERREIRA",
  } = options;

  const DocConstructor = (jsPDF as any).jsPDF || jsPDF;
  const doc = new DocConstructor({ orientation: "landscape", unit: "pt", format: "a4" });
  const pageW = doc.internal.pageSize.getWidth(); // ~841.89 pt
  const pageH = doc.internal.pageSize.getHeight(); // ~595.28 pt

  const num = (v: any) => Math.max(0, Math.abs(typeof v === "number" && !isNaN(v) ? v : Number(v) || 0));

  // Ordenação institucional: Manaus primeiro, depois municípios alfabéticos, depois bases
  const efetivoList = [...(rawEfetivo || [])].sort((a, b) => {
    const aMun = canonicalMunicipio(a.mun || a.municipio);
    const bMun = canonicalMunicipio(b.mun || b.municipio);
    if (aMun.toLowerCase() === "manaus") return -1;
    if (bMun.toLowerCase() === "manaus") return 1;
    const aIsBase = isNonMunicipioTroop(aMun) || aMun.toLowerCase().includes("base") || aMun.toLowerCase().includes("posto");
    const bIsBase = isNonMunicipioTroop(bMun) || bMun.toLowerCase().includes("base") || bMun.toLowerCase().includes("posto");
    if (!aIsBase && bIsBase) return -1;
    if (aIsBase && !bIsBase) return 1;
    return aMun.localeCompare(bMun, "pt-BR");
  });

  const fullCols = resolveEfetivoColumns(efetivoList);
  const activeDataCols = fullCols.filter(
    (c) => c.numeric && c.key !== "mun" && c.key !== "total" && c.key !== "cbmsp",
  );

  const opDate = reportDate ?? new Date();
  const opDateStr = periodoLabel || `${fmtDateBR(opDate)} — 24H`;

  // Cálculos de Grupos
  const totalCbmam = efetivoList.reduce(
    (s, r) =>
      s +
      num(r.ord) +
      num(r.cbmam) +
      num(r.servico) +
      num(r.opamv) +
      num(r.opam_ref) +
      num(r.inc1) +
      num(r.inc_1) +
      num(r.inc2) +
      num(r.inc_2) +
      num(r.inc3) +
      num(r.inc_3) +
      num(r.seg),
    0,
  );

  const totalFederais = efetivoList.reduce(
    (s, r) => s + num(r.fn) + num(r.prevfogo) + num(r.marinha) + num(r.icmbio),
    0,
  );

  const totalBrigadistas = efetivoList.reduce(
    (s, r) => s + num(r.brig_mun) + num(r.brig) + num(r.brig_semas) + num(r.brig_sema),
    0,
  );

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

  // Título Central
  doc.setTextColor(255, 255, 255);
  doc.setFont("helvetica", "bold");
  doc.setFontSize(10.5);
  doc.text("CORPO DE BOMBEIROS MILITAR DO AMAZONAS", pageW / 2, 16, { align: "center" });

  doc.setFontSize(11);
  doc.setTextColor(220, 240, 225);
  doc.text("COMANDO OPERACIONAL INTEGRADO · SALA DE SITUAÇÃO", pageW / 2, 29, { align: "center" });

  doc.setFontSize(9);
  doc.setTextColor(255, 220, 140);
  doc.text("RELATÓRIO OFICIAL DE EFETIVO OPERACIONAL MOBILIZADO", pageW / 2, 44, { align: "center" });

  // Metadados Oficiais (Esquerda)
  doc.setTextColor(230, 240, 235);
  doc.setFontSize(6.5);
  doc.setFont("helvetica", "bold");
  doc.text("Comandante do Incidente:", 68, 15);
  doc.text("Chefe Op. Capital:", 68, 25);
  doc.text("Chefe Op. Interior:", 68, 35);
  doc.text("Coord. Sala Situação:", 68, 45);

  doc.setFont("helvetica", "normal");
  doc.text(comandante, 170, 15);
  doc.text(chefeCapital, 170, 25);
  doc.text(chefeInterior, 170, 35);
  doc.text(coordSituacao, 170, 45);

  // Metadados (Direita)
  const rightMarginX = pageW - 16;
  const labelStartX = pageW - 250;

  doc.setFont("helvetica", "bold");
  doc.text("Período Operacional:", labelStartX, 15);
  doc.text("Data de Emissão:", labelStartX, 25);
  doc.text("Coord. Geral da Operação:", labelStartX, 35);
  doc.text("Status da Mobilização:", labelStartX, 45);

  doc.setFont("helvetica", "normal");
  doc.text(opDateStr, rightMarginX, 15, { align: "right" });
  doc.text(`${new Date().toLocaleDateString("pt-BR")} às ${new Date().toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" })}`, rightMarginX, 25, { align: "right" });
  doc.text(coordenador, rightMarginX, 35, { align: "right" });
  doc.text("Mobilização Total Ativa (100%)", rightMarginX, 45, { align: "right" });

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
    return list.reduce((acc, row) => {
      return acc + keys.reduce((s, k) => s + num(row[k]), 0);
    }, 0);
  };

  const getListTotal = (list: any[]) => {
    return list.reduce((s, r) => s + calculateRowTotal(r, fullCols), 0);
  };

  const cbmamCapital = getColSum([manausEf], "ord", "cbmam", "servico", "seg");
  const cbmamInterior = getColSum(interiorEf, "ord", "cbmam", "servico", "seg");
  const cbmamBases = getColSum(basesEf, "ord", "cbmam", "servico", "seg");

  const opamCapital = getColSum([manausEf], "opamv", "opam_ref");
  const opamInterior = getColSum(interiorEf, "opamv", "opam_ref");
  const opamBases = getColSum(basesEf, "opamv", "opam_ref");

  const turmasCapital = getColSum([manausEf], "inc1", "inc_1", "inc2", "inc_2", "inc3", "inc_3");
  const turmasInterior = getColSum(interiorEf, "inc1", "inc_1", "inc2", "inc_2", "inc3", "inc_3");
  const turmasBases = getColSum(basesEf, "inc1", "inc_1", "inc2", "inc_2", "inc3", "inc_3");

  const parceirosCapital = getColSum([manausEf], "fn", "prevfogo", "marinha", "icmbio");
  const parceirosInterior = getColSum(interiorEf, "fn", "prevfogo", "marinha", "icmbio");
  const parceirosBases = getColSum(basesEf, "fn", "prevfogo", "marinha", "icmbio");

  const brigCapital = getColSum([manausEf], "brig_mun", "brig", "brig_semas");
  const brigInterior = getColSum(interiorEf, "brig_mun", "brig", "brig_semas");
  const brigBases = getColSum(basesEf, "brig_mun", "brig", "brig_semas");

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
  const totalFn = efetivoList.reduce((s, r) => s + num(r.fn), 0);
  const totalPrevfogo = efetivoList.reduce((s, r) => s + num(r.prevfogo), 0);
  const totalMarinha = efetivoList.reduce((s, r) => s + num(r.marinha) + num(r.icmbio), 0);
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
