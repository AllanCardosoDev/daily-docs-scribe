import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";
import type { AnnualYearSummary } from "./annual-reports.functions";
import { NF } from "./formatters";
import { CBMAM_LOGO_BASE64 } from "./cbmam-logo";

/**
 * Relatórios consolidados operacionais completos (Incêndios, Atendimentos Diversos, Efetivo e Recursos):
 *  1. "Resumo detalhado por município" — detalhamento completo por município de todos os tipos de ocorrências.
 *  2. "Resumo consolidado" — resumo executivo comparativo com grandes totais de todos os tipos de atendimento.
 */

const BRAND = { r: 8, g: 46, b: 31 };
const BRAND_LIGHT = { r: 24, g: 96, b: 54 };
const GOLD = { r: 201, g: 168, b: 76 };
const INK = { r: 20, g: 20, b: 20 };
const MUTED = { r: 110, g: 118, b: 128 };
const ROW_ALT = { r: 244, g: 251, b: 246 };

function fmtBR(iso: string | null) {
  if (!iso) return "—";
  const [y, m, d] = iso.split("-");
  return `${d}/${m}/${y}`;
}

function periodLabel(y: AnnualYearSummary) {
  return y.from && y.to ? `${fmtBR(y.from)} a ${fmtBR(y.to)}` : "Sem registros";
}

function drawHeader(doc: jsPDF, pageW: number, title: string, subtitle: string) {
  doc.setFillColor(GOLD.r, GOLD.g, GOLD.b);
  doc.rect(0, 0, pageW, 3, "F");
  doc.setFillColor(BRAND.r, BRAND.g, BRAND.b);
  doc.rect(0, 3, pageW, 64, "F");
  doc.setFillColor(BRAND_LIGHT.r, BRAND_LIGHT.g, BRAND_LIGHT.b);
  doc.triangle(pageW - 170, 3, pageW, 3, pageW, 67, "F");

  try {
    doc.addImage(CBMAM_LOGO_BASE64, "PNG", 24, 10, 36, 44);
  } catch {
    const cx = 42;
    const cy = 36;
    doc.setDrawColor(GOLD.r, GOLD.g, GOLD.b);
    doc.setLineWidth(1.4);
    doc.circle(cx, cy, 18, "S");
  }

  doc.setTextColor(255, 255, 255);
  doc.setFont("helvetica", "bold");
  doc.setFontSize(11);
  doc.text(title, 72, 30);
  doc.setFont("helvetica", "normal");
  doc.setFontSize(8);
  doc.text(subtitle, 72, 44);
  doc.text(`Emitido em ${new Date().toLocaleString("pt-BR")}`, pageW - 20, 44, { align: "right" });
  doc.setTextColor(INK.r, INK.g, INK.b);
}

function drawFooter(doc: jsPDF, label: string) {
  const pageW = doc.internal.pageSize.getWidth();
  const pageH = doc.internal.pageSize.getHeight();
  const count = (doc as any).internal.getNumberOfPages();
  for (let i = 1; i <= count; i++) {
    doc.setPage(i);
    doc.setDrawColor(BRAND.r, BRAND.g, BRAND.b);
    doc.setLineWidth(0.4);
    doc.line(20, pageH - 28, pageW - 20, pageH - 28);
    doc.setFont("helvetica", "normal");
    doc.setFontSize(7.5);
    doc.setTextColor(MUTED.r, MUTED.g, MUTED.b);
    doc.text(label, 20, pageH - 14);
    doc.text(`Página ${i} de ${count}`, pageW - 20, pageH - 14, { align: "right" });
  }
}

/** Relatório detalhado — tabelas completas para TODOS os tipos de ocorrências por município. */
export function buildAnnualIncendiosDoc(years: AnnualYearSummary[]): jsPDF {
  const doc = new jsPDF({ orientation: "portrait", unit: "pt", format: "a4" });
  const pageW = doc.internal.pageSize.getWidth();

  years.forEach((y, idx) => {
    if (idx > 0) doc.addPage();

    drawHeader(
      doc,
      pageW,
      `RELATÓRIO OPERACIONAL COMPLETO POR MUNICÍPIO — ANO ${y.year}`,
      "Corpo de Bombeiros Militar do Amazonas · Sala de Situação",
    );

    // --- SEÇÃO 1: INCÊNDIOS ---
    doc.setFont("helvetica", "bold");
    doc.setFontSize(10);
    doc.setTextColor(BRAND.r, BRAND.g, BRAND.b);
    doc.text(`1. OCORRÊNCIAS DE INCÊNDIOS (${periodLabel(y)})`, 40, 88);

    autoTable(doc, {
      startY: 96,
      head: [
        [
          "Nº",
          "MUNICÍPIO",
          "INCÊNDIO URBANO",
          "INCÊNDIO FLORESTAL",
          "FOCOS ATENDIDOS",
          "TOTAL INCÊNDIOS",
        ],
      ],
      body: (y.incendios?.rows ?? y.rows ?? []).map((r, i) => [
        String(i + 1),
        r.mun,
        NF.format(r.urb),
        NF.format(r.flor),
        NF.format(r.focos),
        NF.format(r.total),
      ]),
      foot: [
        [
          "",
          "TOTAL INCÊNDIOS",
          NF.format(y.incendios?.totals?.urb ?? y.totals.urb),
          NF.format(y.incendios?.totals?.flor ?? y.totals.flor),
          NF.format(y.incendios?.totals?.focos ?? y.totals.focos),
          NF.format(y.incendios?.totals?.total ?? y.totals.total),
        ],
      ],
      styles: {
        fontSize: 7.5,
        cellPadding: 3,
        lineColor: [220, 226, 222],
        lineWidth: 0.25,
        valign: "middle",
      },
      headStyles: {
        fillColor: [BRAND_LIGHT.r, BRAND_LIGHT.g, BRAND_LIGHT.b],
        textColor: 255,
        fontStyle: "bold",
        fontSize: 7,
        halign: "center",
      },
      footStyles: {
        fillColor: [BRAND.r, BRAND.g, BRAND.b],
        textColor: 255,
        fontStyle: "bold",
        halign: "right",
      },
      bodyStyles: { textColor: [INK.r, INK.g, INK.b] },
      alternateRowStyles: { fillColor: [ROW_ALT.r, ROW_ALT.g, ROW_ALT.b] },
      columnStyles: {
        0: { halign: "center", cellWidth: 24 },
        1: { cellWidth: 140 },
        2: { halign: "right" },
        3: { halign: "right" },
        4: { halign: "right" },
        5: { halign: "right", fontStyle: "bold" },
      },
      margin: { left: 40, right: 40, top: 85, bottom: 44 },
    });

    // --- SEÇÃO 2: ATENDIMENTOS DIVERSOS ---
    const nextY2 = (doc as any).lastAutoTable.finalY + 18;
    if (nextY2 > 700) doc.addPage();
    const currentY2 = nextY2 > 700 ? 80 : nextY2;

    doc.setFont("helvetica", "bold");
    doc.setFontSize(10);
    doc.setTextColor(BRAND.r, BRAND.g, BRAND.b);
    doc.text(`2. ATENDIMENTOS E OCORRÊNCIAS DIVERSAS`, 40, currentY2);

    autoTable(doc, {
      startY: currentY2 + 8,
      head: [
        [
          "Nº",
          "MUNICÍPIO",
          "SALVAMENTO",
          "ACIDENTES",
          "APH",
          "PREVENÇÃO",
          "SERVIÇOS",
          "TOTAL OCORRÊNCIAS",
        ],
      ],
      body: (y.outras?.rows ?? []).map((r, i) => [
        String(i + 1),
        r.mun,
        NF.format(r.salvamento),
        NF.format(r.acidentes),
        NF.format(r.aph),
        NF.format(r.prevencao),
        NF.format(r.servicos),
        NF.format(r.total),
      ]),
      foot: [
        [
          "",
          "TOTAL OCORRÊNCIAS",
          NF.format(y.outras?.totals?.salvamento ?? 0),
          NF.format(y.outras?.totals?.acidentes ?? 0),
          NF.format(y.outras?.totals?.aph ?? 0),
          NF.format(y.outras?.totals?.prevencao ?? 0),
          NF.format(y.outras?.totals?.servicos ?? 0),
          NF.format(y.outras?.totals?.total ?? 0),
        ],
      ],
      styles: {
        fontSize: 7.5,
        cellPadding: 3,
        lineColor: [220, 226, 222],
        lineWidth: 0.25,
        valign: "middle",
      },
      headStyles: {
        fillColor: [BRAND_LIGHT.r, BRAND_LIGHT.g, BRAND_LIGHT.b],
        textColor: 255,
        fontStyle: "bold",
        fontSize: 7,
        halign: "center",
      },
      footStyles: {
        fillColor: [BRAND.r, BRAND.g, BRAND.b],
        textColor: 255,
        fontStyle: "bold",
        halign: "right",
      },
      bodyStyles: { textColor: [INK.r, INK.g, INK.b] },
      alternateRowStyles: { fillColor: [ROW_ALT.r, ROW_ALT.g, ROW_ALT.b] },
      columnStyles: {
        0: { halign: "center", cellWidth: 24 },
        1: { cellWidth: 120 },
        2: { halign: "right" },
        3: { halign: "right" },
        4: { halign: "right" },
        5: { halign: "right" },
        6: { halign: "right" },
        7: { halign: "right", fontStyle: "bold" },
      },
      margin: { left: 40, right: 40, top: 85, bottom: 44 },
    });

    // --- SEÇÃO 3: EFETIVO EMPREGADO ---
    const nextY3 = (doc as any).lastAutoTable.finalY + 18;
    if (nextY3 > 700) doc.addPage();
    const currentY3 = nextY3 > 700 ? 80 : nextY3;

    doc.setFont("helvetica", "bold");
    doc.setFontSize(10);
    doc.setTextColor(BRAND.r, BRAND.g, BRAND.b);
    doc.text(`3. EFETIVO OPERACIONAL EMPREGADO POR MUNICÍPIO`, 40, currentY3);

    autoTable(doc, {
      startY: currentY3 + 8,
      head: [["Nº", "MUNICÍPIO", "ORDINÁRIO", "SEG", "BRIGADA", "TOTAL EFETIVO"]],
      body: (y.efetivo?.rows ?? []).map((r, i) => [
        String(i + 1),
        r.mun,
        NF.format(r.ord),
        NF.format(r.seg),
        NF.format(r.brig),
        NF.format(r.total),
      ]),
      foot: [
        [
          "",
          "TOTAL EFETIVO",
          NF.format(y.efetivo?.totals?.ord ?? 0),
          NF.format(y.efetivo?.totals?.seg ?? 0),
          NF.format(y.efetivo?.totals?.brig ?? 0),
          NF.format(y.efetivo?.totals?.total ?? 0),
        ],
      ],
      styles: {
        fontSize: 7.5,
        cellPadding: 3,
        lineColor: [220, 226, 222],
        lineWidth: 0.25,
        valign: "middle",
      },
      headStyles: {
        fillColor: [BRAND_LIGHT.r, BRAND_LIGHT.g, BRAND_LIGHT.b],
        textColor: 255,
        fontStyle: "bold",
        fontSize: 7,
        halign: "center",
      },
      footStyles: {
        fillColor: [BRAND.r, BRAND.g, BRAND.b],
        textColor: 255,
        fontStyle: "bold",
        halign: "right",
      },
      bodyStyles: { textColor: [INK.r, INK.g, INK.b] },
      alternateRowStyles: { fillColor: [ROW_ALT.r, ROW_ALT.g, ROW_ALT.b] },
      columnStyles: {
        0: { halign: "center", cellWidth: 24 },
        1: { cellWidth: 150 },
        2: { halign: "right" },
        3: { halign: "right" },
        4: { halign: "right" },
        5: { halign: "right", fontStyle: "bold" },
      },
      margin: { left: 40, right: 40, top: 85, bottom: 44 },
    });

    // --- SEÇÃO 4: RECURSOS EMPREGADOS ---
    const nextY4 = (doc as any).lastAutoTable.finalY + 18;
    if (nextY4 > 700) doc.addPage();
    const currentY4 = nextY4 > 700 ? 80 : nextY4;

    doc.setFont("helvetica", "bold");
    doc.setFontSize(10);
    doc.setTextColor(BRAND.r, BRAND.g, BRAND.b);
    doc.text(`4. RECURSOS OPERACIONAIS EMPREGADOS POR MUNICÍPIO`, 40, currentY4);

    autoTable(doc, {
      startY: currentY4 + 8,
      head: [["Nº", "MUNICÍPIO", "VIATURAS", "AERONAVES", "EMBARCAÇÕES", "TOTAL RECURSOS"]],
      body: (y.recursos?.rows ?? []).map((r, i) => [
        String(i + 1),
        r.mun,
        NF.format(r.viaturas),
        NF.format(r.aeronaves),
        NF.format(r.embarcacoes),
        NF.format(r.total),
      ]),
      foot: [
        [
          "",
          "TOTAL RECURSOS",
          NF.format(y.recursos?.totals?.viaturas ?? 0),
          NF.format(y.recursos?.totals?.aeronaves ?? 0),
          NF.format(y.recursos?.totals?.embarcacoes ?? 0),
          NF.format(y.recursos?.totals?.total ?? 0),
        ],
      ],
      styles: {
        fontSize: 7.5,
        cellPadding: 3,
        lineColor: [220, 226, 222],
        lineWidth: 0.25,
        valign: "middle",
      },
      headStyles: {
        fillColor: [BRAND_LIGHT.r, BRAND_LIGHT.g, BRAND_LIGHT.b],
        textColor: 255,
        fontStyle: "bold",
        fontSize: 7,
        halign: "center",
      },
      footStyles: {
        fillColor: [BRAND.r, BRAND.g, BRAND.b],
        textColor: 255,
        fontStyle: "bold",
        halign: "right",
      },
      bodyStyles: { textColor: [INK.r, INK.g, INK.b] },
      alternateRowStyles: { fillColor: [ROW_ALT.r, ROW_ALT.g, ROW_ALT.b] },
      columnStyles: {
        0: { halign: "center", cellWidth: 24 },
        1: { cellWidth: 150 },
        2: { halign: "right" },
        3: { halign: "right" },
        4: { halign: "right" },
        5: { halign: "right", fontStyle: "bold" },
      },
      margin: { left: 40, right: 40, top: 85, bottom: 44 },
    });
  });

  drawFooter(doc, "Corpo de Bombeiros / Sistema de Registro de Ocorrências");
  return doc;
}

/** Resumo executivo consolidado comparativo com TODOS os tipos de ocorrências. */
export function buildConsolidatedIncendiosDoc(years: AnnualYearSummary[]): jsPDF {
  const doc = new jsPDF({ orientation: "portrait", unit: "pt", format: "a4" });
  const pageW = doc.internal.pageSize.getWidth();
  const labels = years.map((y) => y.year);
  const range =
    labels.length <= 1 ? String(labels[0] ?? "") : `${labels[0]} - ${labels[labels.length - 1]}`;

  drawHeader(
    doc,
    pageW,
    "RESUMO EXECUTIVO OPERACIONAL CONSOLIDADO",
    `Síntese Geral de Ocorrências, Atendimentos e Recursos Empregados (${range})`,
  );

  const grandInc = years.reduce(
    (acc, y) => ({
      urb: acc.urb + (y.incendios?.totals?.urb ?? y.totals.urb),
      flor: acc.flor + (y.incendios?.totals?.flor ?? y.totals.flor),
      focos: acc.focos + (y.incendios?.totals?.focos ?? y.totals.focos),
      total: acc.total + (y.incendios?.totals?.total ?? y.totals.total),
    }),
    { urb: 0, flor: 0, focos: 0, total: 0 },
  );

  const grandOut = years.reduce(
    (acc, y) => ({
      salvamento: acc.salvamento + (y.outras?.totals?.salvamento ?? 0),
      acidentes: acc.acidentes + (y.outras?.totals?.acidentes ?? 0),
      aph: acc.aph + (y.outras?.totals?.aph ?? 0),
      prevencao: acc.prevencao + (y.outras?.totals?.prevencao ?? 0),
      servicos: acc.servicos + (y.outras?.totals?.servicos ?? 0),
      total: acc.total + (y.outras?.totals?.total ?? 0),
    }),
    { salvamento: 0, acidentes: 0, aph: 0, prevencao: 0, servicos: 0, total: 0 },
  );

  const grandEf = years.reduce(
    (acc, y) => ({
      ord: acc.ord + (y.efetivo?.totals?.ord ?? 0),
      seg: acc.seg + (y.efetivo?.totals?.seg ?? 0),
      brig: acc.brig + (y.efetivo?.totals?.brig ?? 0),
      total: acc.total + (y.efetivo?.totals?.total ?? 0),
    }),
    { ord: 0, seg: 0, brig: 0, total: 0 },
  );

  const grandRec = years.reduce(
    (acc, y) => ({
      viaturas: acc.viaturas + (y.recursos?.totals?.viaturas ?? 0),
      aeronaves: acc.aeronaves + (y.recursos?.totals?.aeronaves ?? 0),
      embarcacoes: acc.embarcacoes + (y.recursos?.totals?.embarcacoes ?? 0),
      total: acc.total + (y.recursos?.totals?.total ?? 0),
    }),
    { viaturas: 0, aeronaves: 0, embarcacoes: 0, total: 0 },
  );

  // Tabela 1: Incêndios
  doc.setFont("helvetica", "bold");
  doc.setFontSize(10);
  doc.setTextColor(BRAND.r, BRAND.g, BRAND.b);
  doc.text("1. SÍNTESE ACUMULADA DE INCÊNDIOS", 40, 88);

  autoTable(doc, {
    startY: 96,
    head: [
      [
        "ANO",
        "PERÍODO",
        "INCÊNDIO URBANO",
        "INCÊNDIO FLORESTAL",
        "FOCOS COMBATIDOS",
        "TOTAL INCÊNDIOS",
      ],
    ],
    body: years.map((y) => [
      String(y.year),
      periodLabel(y),
      NF.format(y.incendios?.totals?.urb ?? y.totals.urb),
      NF.format(y.incendios?.totals?.flor ?? y.totals.flor),
      NF.format(y.incendios?.totals?.focos ?? y.totals.focos),
      NF.format(y.incendios?.totals?.total ?? y.totals.total),
    ]),
    foot: [
      [
        "TOTAL ACUMULADO",
        "",
        NF.format(grandInc.urb),
        NF.format(grandInc.flor),
        NF.format(grandInc.focos),
        NF.format(grandInc.total),
      ],
    ],
    styles: { fontSize: 8.5, cellPadding: 5, lineColor: [220, 226, 222], lineWidth: 0.25, valign: "middle" },
    headStyles: { fillColor: [BRAND_LIGHT.r, BRAND_LIGHT.g, BRAND_LIGHT.b], textColor: 255, fontStyle: "bold", fontSize: 8, halign: "center" },
    footStyles: { fillColor: [BRAND.r, BRAND.g, BRAND.b], textColor: 255, fontStyle: "bold", halign: "right" },
    bodyStyles: { textColor: [INK.r, INK.g, INK.b] },
    alternateRowStyles: { fillColor: [ROW_ALT.r, ROW_ALT.g, ROW_ALT.b] },
    columnStyles: {
      0: { halign: "center", fontStyle: "bold", cellWidth: 50 },
      1: { halign: "center", cellWidth: 100 },
      2: { halign: "right" },
      3: { halign: "right" },
      4: { halign: "right" },
      5: { halign: "right", fontStyle: "bold" },
    },
    margin: { left: 40, right: 40, top: 85, bottom: 44 },
  });

  // Tabela 2: Atendimentos Diversos
  const nextY2 = (doc as any).lastAutoTable.finalY + 16;
  doc.setFont("helvetica", "bold");
  doc.setFontSize(10);
  doc.setTextColor(BRAND.r, BRAND.g, BRAND.b);
  doc.text("2. SÍNTESE ACUMULADA DE ATENDIMENTOS E OCORRÊNCIAS DIVERSAS", 40, nextY2);

  autoTable(doc, {
    startY: nextY2 + 8,
    head: [["ANO", "SALVAMENTO", "ACIDENTES", "APH", "PREVENÇÃO", "SERVIÇOS", "TOTAL ATENDIMENTOS"]],
    body: years.map((y) => [
      String(y.year),
      NF.format(y.outras?.totals?.salvamento ?? 0),
      NF.format(y.outras?.totals?.acidentes ?? 0),
      NF.format(y.outras?.totals?.aph ?? 0),
      NF.format(y.outras?.totals?.prevencao ?? 0),
      NF.format(y.outras?.totals?.servicos ?? 0),
      NF.format(y.outras?.totals?.total ?? 0),
    ]),
    foot: [
      [
        "TOTAL ACUMULADO",
        NF.format(grandOut.salvamento),
        NF.format(grandOut.acidentes),
        NF.format(grandOut.aph),
        NF.format(grandOut.prevencao),
        NF.format(grandOut.servicos),
        NF.format(grandOut.total),
      ],
    ],
    styles: { fontSize: 8.5, cellPadding: 5, lineColor: [220, 226, 222], lineWidth: 0.25, valign: "middle" },
    headStyles: { fillColor: [BRAND_LIGHT.r, BRAND_LIGHT.g, BRAND_LIGHT.b], textColor: 255, fontStyle: "bold", fontSize: 8, halign: "center" },
    footStyles: { fillColor: [BRAND.r, BRAND.g, BRAND.b], textColor: 255, fontStyle: "bold", halign: "right" },
    bodyStyles: { textColor: [INK.r, INK.g, INK.b] },
    alternateRowStyles: { fillColor: [ROW_ALT.r, ROW_ALT.g, ROW_ALT.b] },
    columnStyles: {
      0: { halign: "center", fontStyle: "bold", cellWidth: 50 },
      1: { halign: "right" },
      2: { halign: "right" },
      3: { halign: "right" },
      4: { halign: "right" },
      5: { halign: "right" },
      6: { halign: "right", fontStyle: "bold" },
    },
    margin: { left: 40, right: 40, top: 85, bottom: 44 },
  });

  // Tabela 3: Efetivo e Recursos
  const nextY3 = (doc as any).lastAutoTable.finalY + 16;
  doc.setFont("helvetica", "bold");
  doc.setFontSize(10);
  doc.setTextColor(BRAND.r, BRAND.g, BRAND.b);
  doc.text("3. MOBILIZAÇÃO OPERACIONAL: EFETIVO E RECURSOS EMPREGADOS", 40, nextY3);

  autoTable(doc, {
    startY: nextY3 + 8,
    head: [["ANO", "EFETIVO ORDINÁRIO", "EFETIVO SEG", "BRIGADISTAS", "VIATURAS", "AERONAVES", "EMBARCAÇÕES", "TOTAL RECURSOS/EFETIVO"]],
    body: years.map((y) => [
      String(y.year),
      NF.format(y.efetivo?.totals?.ord ?? 0),
      NF.format(y.efetivo?.totals?.seg ?? 0),
      NF.format(y.efetivo?.totals?.brig ?? 0),
      NF.format(y.recursos?.totals?.viaturas ?? 0),
      NF.format(y.recursos?.totals?.aeronaves ?? 0),
      NF.format(y.recursos?.totals?.embarcacoes ?? 0),
      NF.format((y.efetivo?.totals?.total ?? 0) + (y.recursos?.totals?.total ?? 0)),
    ]),
    foot: [
      [
        "TOTAL ACUMULADO",
        NF.format(grandEf.ord),
        NF.format(grandEf.seg),
        NF.format(grandEf.brig),
        NF.format(grandRec.viaturas),
        NF.format(grandRec.aeronaves),
        NF.format(grandRec.embarcacoes),
        NF.format(grandEf.total + grandRec.total),
      ],
    ],
    styles: { fontSize: 8, cellPadding: 4, lineColor: [220, 226, 222], lineWidth: 0.25, valign: "middle" },
    headStyles: { fillColor: [BRAND_LIGHT.r, BRAND_LIGHT.g, BRAND_LIGHT.b], textColor: 255, fontStyle: "bold", fontSize: 7.5, halign: "center" },
    footStyles: { fillColor: [BRAND.r, BRAND.g, BRAND.b], textColor: 255, fontStyle: "bold", halign: "right" },
    bodyStyles: { textColor: [INK.r, INK.g, INK.b] },
    alternateRowStyles: { fillColor: [ROW_ALT.r, ROW_ALT.g, ROW_ALT.b] },
    columnStyles: {
      0: { halign: "center", fontStyle: "bold", cellWidth: 45 },
      1: { halign: "right" },
      2: { halign: "right" },
      3: { halign: "right" },
      4: { halign: "right" },
      5: { halign: "right" },
      6: { halign: "right" },
      7: { halign: "right", fontStyle: "bold" },
    },
    margin: { left: 40, right: 40, top: 85, bottom: 44 },
  });

  // Grande Total Consolidado
  const grandTotalAll = grandInc.total + grandOut.total;
  const nextY4 = (doc as any).lastAutoTable.finalY + 16;
  doc.setFont("helvetica", "bold");
  doc.setFontSize(11);
  doc.setTextColor(BRAND.r, BRAND.g, BRAND.b);
  doc.text(`GRANDE TOTAL OPERACIONAL ACUMULADO (INCÊNDIOS + OCORRÊNCIAS): ${NF.format(grandTotalAll)} INTERVENÇÕES`, 40, nextY4);

  drawFooter(doc, "Corpo de Bombeiros / Relatório Consolidado Operacional");
  return doc;
}

export function exportAnnualIncendiosPdf(years: AnnualYearSummary[]) {
  const labels = years.map((y) => y.year).join("-");
  buildAnnualIncendiosDoc(years).save(`resumo-ocorrencias-${labels}-completo.pdf`);
}

export function exportConsolidatedIncendiosPdf(years: AnnualYearSummary[]) {
  const labels = years.map((y) => y.year).join("-");
  buildConsolidatedIncendiosDoc(years).save(`resumo-ocorrencias-${labels}-consolidado.pdf`);
}
