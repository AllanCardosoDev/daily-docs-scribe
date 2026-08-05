import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";
import type { AnnualYearSummary } from "./annual-reports.functions";
import { NF } from "./formatters";
import { CBMAM_LOGO_BASE64 } from "./cbmam-logo";

/**
 * Relatórios consolidados de incêndios:
 *  1. "Ano a ano" — uma página por ano, com a quebra por município.
 *  2. "Comparativo" — resumo executivo de uma página com todos os anos.
 *
 * Ambos seguem o padrão institucional CBMAM (verde floresta + dourado).
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

/** Relatório detalhado — uma página por ano, quebra por município. */
export function buildAnnualIncendiosDoc(years: AnnualYearSummary[]): jsPDF {
  const doc = new jsPDF({ orientation: "portrait", unit: "pt", format: "a4" });
  const pageW = doc.internal.pageSize.getWidth();

  years.forEach((y, idx) => {
    if (idx > 0) doc.addPage();
    drawHeader(
      doc,
      pageW,
      `ANO ${y.year}`,
      "Corpo de Bombeiros Militar do Amazonas · Sala de Situação",
    );

    doc.setFont("helvetica", "bold");
    doc.setFontSize(11);
    doc.setTextColor(INK.r, INK.g, INK.b);
    doc.text(`OCORRÊNCIAS DE INCÊNDIOS (${periodLabel(y)})`, 40, 96);
    doc.setFont("helvetica", "normal");
    doc.setFontSize(8.5);
    doc.setTextColor(MUTED.r, MUTED.g, MUTED.b);
    doc.text(
      "Relatório Operacional de Ocorrências de Incêndios Urbanos, Florestais e Focos Atendidos",
      40,
      110,
    );
    doc.setTextColor(INK.r, INK.g, INK.b);

    autoTable(doc, {
      startY: 124,
      head: [
        [
          "Nº",
          "MUNICÍPIO",
          "INCÊNDIO URBANO",
          "INCÊNDIO FLORESTAL",
          "FOCOS ATENDIDOS",
          "TOTAL DE OCORRÊNCIAS",
        ],
      ],
      body: y.rows.map((r, i) => [
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
          "TOTAL",
          NF.format(y.totals.urb),
          NF.format(y.totals.flor),
          NF.format(y.totals.focos),
          NF.format(y.totals.total),
        ],
      ],
      styles: {
        fontSize: 8,
        cellPadding: 4,
        lineColor: [220, 226, 222],
        lineWidth: 0.25,
        overflow: "linebreak",
        valign: "middle",
      },
      headStyles: {
        fillColor: [BRAND_LIGHT.r, BRAND_LIGHT.g, BRAND_LIGHT.b],
        textColor: 255,
        fontStyle: "bold",
        fontSize: 7.5,
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
        0: { halign: "center", cellWidth: 28 },
        1: { cellWidth: 150 },
        2: { halign: "right" },
        3: { halign: "right" },
        4: { halign: "right" },
        5: { halign: "right", fontStyle: "bold" },
      },
      margin: { left: 40, right: 40, top: 90, bottom: 44 },
      showHead: "everyPage",
      rowPageBreak: "avoid",
    });
  });

  drawFooter(doc, "Corpo de Bombeiros / Sistema de Registro de Ocorrências");
  return doc;
}

/** Resumo executivo comparativo — uma página com todos os anos. */
export function buildConsolidatedIncendiosDoc(years: AnnualYearSummary[]): jsPDF {
  const doc = new jsPDF({ orientation: "portrait", unit: "pt", format: "a4" });
  const pageW = doc.internal.pageSize.getWidth();
  const labels = years.map((y) => y.year);
  const range =
    labels.length <= 1 ? String(labels[0] ?? "") : `${labels[0]} - ${labels[labels.length - 1]}`;

  drawHeader(
    doc,
    pageW,
    "RESUMO OPERACIONAL CONSOLIDADO",
    labels.length <= 1
      ? `Ocorrências de Incêndios e Focos Atendidos (${range})`
      : `Comparativo de Ocorrências de Incêndios e Focos Atendidos (${range})`,
  );

  const grand = years.reduce(
    (acc, y) => ({
      urb: acc.urb + y.totals.urb,
      flor: acc.flor + y.totals.flor,
      focos: acc.focos + y.totals.focos,
      total: acc.total + y.totals.total,
    }),
    { urb: 0, flor: 0, focos: 0, total: 0 },
  );

  autoTable(doc, {
    startY: 110,
    head: [
      [
        "ANO",
        "PERÍODO",
        "INCÊNDIO EM EDIFICAÇÕES / URBANO",
        "INCÊNDIO FLORESTAL",
        "FOCOS ATENDIDOS / COMBATIDOS",
        "TOTAL DE OCORRÊNCIAS",
      ],
    ],
    body: years.map((y) => [
      String(y.year),
      periodLabel(y),
      NF.format(y.totals.urb),
      NF.format(y.totals.flor),
      NF.format(y.totals.focos),
      NF.format(y.totals.total),
    ]),
    foot: [
      [
        "TOTAL GERAL",
        "",
        NF.format(grand.urb),
        NF.format(grand.flor),
        NF.format(grand.focos),
        NF.format(grand.total),
      ],
    ],
    styles: {
      fontSize: 9,
      cellPadding: 8,
      lineColor: [220, 226, 222],
      lineWidth: 0.25,
      overflow: "linebreak",
      valign: "middle",
    },
    headStyles: {
      fillColor: [BRAND_LIGHT.r, BRAND_LIGHT.g, BRAND_LIGHT.b],
      textColor: 255,
      fontStyle: "bold",
      fontSize: 8,
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
      0: { halign: "center", fontStyle: "bold", cellWidth: 52 },
      1: { halign: "center", cellWidth: 108 },
      2: { halign: "right" },
      3: { halign: "right" },
      4: { halign: "right" },
      5: { halign: "right", fontStyle: "bold" },
    },
    margin: { left: 40, right: 40, top: 90, bottom: 44 },
  });

  drawFooter(doc, "Corpo de Bombeiros / Relatório Consolidado");
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
