import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";
import { NF } from "./formatters";
import { CBMAM_LOGO_BASE64 } from "./cbmam-logo";
import { compareMunicipios, canonicalMunicipio } from "./municipio-order";

const BRAND = { r: 8, g: 46, b: 31 };
const BRAND_LIGHT = { r: 24, g: 96, b: 54 };
const GOLD = { r: 201, g: 168, b: 76 };
const INK = { r: 20, g: 20, b: 20 };
const MUTED = { r: 110, g: 118, b: 128 };
const ROW_ALT = { r: 244, g: 251, b: 246 };

const MONTH_NAMES = [
  "",
  "Janeiro",
  "Fevereiro",
  "Março",
  "Abril",
  "Maio",
  "Junho",
  "Julho",
  "Agosto",
  "Setembro",
  "Outubro",
  "Novembro",
  "Dezembro",
];

export type ComparisonExportParams = {
  year1: number;
  year2: number;
  startMonth: number;
  endMonth: number;
  activeTab: "incendios" | "efetivo" | "recursos";
  totals1: {
    incendios: number;
    flor: number;
    urb: number;
    focos: number;
    efetivo: number;
    dias: number;
  };
  totals2: {
    incendios: number;
    flor: number;
    urb: number;
    focos: number;
    efetivo: number;
    dias: number;
  };
  rows1: any[];
  rows2: any[];
};

function drawHeader(
  doc: jsPDF,
  pageW: number,
  title: string,
  subtitle: string,
) {
  doc.setFillColor(GOLD.r, GOLD.g, GOLD.b);
  doc.rect(0, 0, pageW, 3, "F");
  doc.setFillColor(BRAND.r, BRAND.g, BRAND.b);
  doc.rect(0, 3, pageW, 64, "F");
  doc.setFillColor(BRAND_LIGHT.r, BRAND_LIGHT.g, BRAND_LIGHT.b);
  doc.triangle(pageW - 190, 3, pageW, 3, pageW, 67, "F");

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
  doc.text(title, 72, 28);
  doc.setFont("helvetica", "normal");
  doc.setFontSize(8.5);
  doc.text(subtitle, 72, 42);
  doc.text(
    `Emitido em ${new Date().toLocaleString("pt-BR")}`,
    pageW - 20,
    42,
    { align: "right" }
  );
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
    doc.line(20, pageH - 24, pageW - 20, pageH - 24);
    doc.setFont("helvetica", "normal");
    doc.setFontSize(7.5);
    doc.setTextColor(MUTED.r, MUTED.g, MUTED.b);
    doc.text(label, 20, pageH - 12);
    doc.text(`Página ${i} de ${count}`, pageW - 20, pageH - 12, {
      align: "right",
    });
  }
}

export function buildComparisonPdfDoc(params: ComparisonExportParams): jsPDF {
  const {
    year1,
    year2,
    startMonth,
    endMonth,
    activeTab,
    totals1,
    totals2,
    rows1,
    rows2,
  } = params;

  // Use landscape for clean tabular presentation
  const doc = new jsPDF({ orientation: "landscape", unit: "pt", format: "a4" });
  const pageW = doc.internal.pageSize.getWidth();

  const TAB_NAMES: Record<string, string> = {
    incendios: "INCÊNDIOS (URBANO, FLORESTAL E FOCOS)",
    outras: "ATENDIMENTOS E OCORRÊNCIAS DIVERSAS",
    efetivo: "EFETIVO OPERACIONAL MOBILIZADO",
    recursos: "RECURSOS OPERACIONAIS EMPREGADOS",
  };

  const periodStr = `${MONTH_NAMES[startMonth]} a ${MONTH_NAMES[endMonth]}`;
  const headerTitle = `RELATÓRIO COMPARATIVO OPERACIONAL · ${year1} vs ${year2}`;
  const headerSubtitle = `Período: ${periodStr} · Categoria: ${TAB_NAMES[activeTab] || "Geral"}`;

  drawHeader(doc, pageW, headerTitle, headerSubtitle);

  let startY = 78;

  // 1. Unificação e Construção dos Mapas por Município
  const map1 = new Map<string, any>();
  const map2 = new Map<string, any>();
  const allMunsSet = new Set<string>();

  for (const r of rows1) {
    const mun = canonicalMunicipio(r.mun);
    if (mun && mun !== "—") {
      map1.set(mun, r);
      allMunsSet.add(mun);
    }
  }

  for (const r of rows2) {
    const mun = canonicalMunicipio(r.mun);
    if (mun && mun !== "—") {
      map2.set(mun, r);
      allMunsSet.add(mun);
    }
  }

  const sortedMuns = Array.from(allMunsSet).sort(compareMunicipios);

  // Pre-cálculo de somas exatas dos municípios
  let calcUrb1 = 0, calcFlor1 = 0, calcFoc1 = 0, calcAll1 = 0;
  let calcUrb2 = 0, calcFlor2 = 0, calcFoc2 = 0, calcAll2 = 0;

  for (const mun of sortedMuns) {
    const d1 = map1.get(mun) || {};
    const d2 = map2.get(mun) || {};

    const u1 = Number(d1.urb) || 0;
    const f1 = Number(d1.flor) || 0;
    const foc1 = Number(d1.focos) || Number(d1.focos_combatidos) || Number(d1.focos_atendidos) || 0;
    calcUrb1 += u1;
    calcFlor1 += f1;
    calcFoc1 += foc1;
    calcAll1 += (u1 + f1);

    const u2 = Number(d2.urb) || 0;
    const f2 = Number(d2.flor) || 0;
    const foc2 = Number(d2.focos) || Number(d2.focos_combatidos) || Number(d2.focos_atendidos) || 0;
    calcUrb2 += u2;
    calcFlor2 += f2;
    calcFoc2 += foc2;
    calcAll2 += (u2 + f2);
  }

  // 2. Resumo Executivo dos Anos Comparados
  // Se estiver na aba incêndios e houver dados municipais, usa as somas calculadas para garantir coerência absoluta
  const row1Total = sortedMuns.length > 0 && activeTab === "incendios" ? calcAll1 : totals1.incendios;
  const row1Flor = sortedMuns.length > 0 && activeTab === "incendios" ? calcFlor1 : totals1.flor;
  const row1Urb = sortedMuns.length > 0 && activeTab === "incendios" ? calcUrb1 : totals1.urb;
  const row1Focos = sortedMuns.length > 0 && activeTab === "incendios" ? calcFoc1 : totals1.focos;

  const row2Total = sortedMuns.length > 0 && activeTab === "incendios" ? calcAll2 : totals2.incendios;
  const row2Flor = sortedMuns.length > 0 && activeTab === "incendios" ? calcFlor2 : totals2.flor;
  const row2Urb = sortedMuns.length > 0 && activeTab === "incendios" ? calcUrb2 : totals2.urb;
  const row2Focos = sortedMuns.length > 0 && activeTab === "incendios" ? calcFoc2 : totals2.focos;

  autoTable(doc, {
    startY,
    head: [
      [
        "ANO",
        "PERÍODO",
        "RELATÓRIOS",
        "TOTAL INCÊNDIOS",
        "INC. FLORESTAIS",
        "INC. URBANOS",
        "FOCOS COMBATIDOS",
        "EFETIVO MOBILIZADO",
      ],
    ],
    body: [
      [
        String(year1),
        periodStr,
        NF.format(totals1.dias),
        NF.format(row1Total),
        NF.format(row1Flor),
        NF.format(row1Urb),
        NF.format(row1Focos),
        NF.format(totals1.efetivo),
      ],
      [
        String(year2),
        periodStr,
        NF.format(totals2.dias),
        NF.format(row2Total),
        NF.format(row2Flor),
        NF.format(row2Urb),
        NF.format(row2Focos),
        NF.format(totals2.efetivo),
      ],
    ],
    styles: {
      fontSize: 8,
      cellPadding: 4,
      lineColor: [220, 226, 222],
      lineWidth: 0.25,
      valign: "middle",
    },
    headStyles: {
      fillColor: [BRAND.r, BRAND.g, BRAND.b],
      textColor: 255,
      fontStyle: "bold",
      fontSize: 7.5,
      halign: "center",
    },
    bodyStyles: { textColor: [INK.r, INK.g, INK.b], halign: "right" },
    columnStyles: {
      0: { halign: "center", fontStyle: "bold" },
      1: { halign: "center" },
    },
    alternateRowStyles: { fillColor: [ROW_ALT.r, ROW_ALT.g, ROW_ALT.b] },
    margin: { left: 24, right: 24, top: 78, bottom: 32 },
  });

  startY = (doc as any).lastAutoTable.finalY + 14;

  // 3. Montagem conforme a categoria selecionada
  if (activeTab === "incendios") {
    const tableBody = sortedMuns.map((mun, idx) => {
      const d1 = map1.get(mun) || {};
      const d2 = map2.get(mun) || {};

      const u1 = Number(d1.urb) || 0;
      const f1 = Number(d1.flor) || 0;
      const foc1 = Number(d1.focos) || Number(d1.focos_combatidos) || Number(d1.focos_atendidos) || 0;
      const t1 = u1 + f1;

      const u2 = Number(d2.urb) || 0;
      const f2 = Number(d2.flor) || 0;
      const foc2 = Number(d2.focos) || Number(d2.focos_combatidos) || Number(d2.focos_atendidos) || 0;
      const t2 = u2 + f2;

      return [
        String(idx + 1),
        mun,
        NF.format(u1),
        NF.format(u2),
        NF.format(f1),
        NF.format(f2),
        NF.format(foc1),
        NF.format(foc2),
        NF.format(t1),
        NF.format(t2),
      ];
    });

    autoTable(doc, {
      startY,
      head: [
        [
          { content: "Nº", rowSpan: 2, styles: { valign: "middle", halign: "center" } },
          { content: "MUNICÍPIO", rowSpan: 2, styles: { valign: "middle", halign: "left" } },
          { content: "INCÊNDIOS URBANOS", colSpan: 2, styles: { halign: "center" } },
          { content: "INCÊNDIOS FLORESTAIS", colSpan: 2, styles: { halign: "center" } },
          { content: "FOCOS COMBATIDOS", colSpan: 2, styles: { halign: "center" } },
          { content: "TOTAL DE INCÊNDIOS", colSpan: 2, styles: { halign: "center" } },
        ],
        [
          String(year1),
          String(year2),
          String(year1),
          String(year2),
          String(year1),
          String(year2),
          String(year1),
          String(year2),
        ],
      ],
      body: tableBody,
      foot: [
        [
          "",
          "TOTAL GERAL",
          NF.format(calcUrb1),
          NF.format(calcUrb2),
          NF.format(calcFlor1),
          NF.format(calcFlor2),
          NF.format(calcFoc1),
          NF.format(calcFoc2),
          NF.format(calcAll1),
          NF.format(calcAll2),
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
      bodyStyles: { textColor: [INK.r, INK.g, INK.b], halign: "right" },
      columnStyles: {
        0: { halign: "center", cellWidth: 24 },
        1: { halign: "left", cellWidth: 140 },
        8: { fontStyle: "bold" },
        9: { fontStyle: "bold" },
      },
      alternateRowStyles: { fillColor: [ROW_ALT.r, ROW_ALT.g, ROW_ALT.b] },
      margin: { left: 24, right: 24, top: 78, bottom: 32 },
    });
  } else if (activeTab === "efetivo") {
    let totOrd1 = 0, totSeg1 = 0, totBri1 = 0, totEf1 = 0;
    let totOrd2 = 0, totSeg2 = 0, totBri2 = 0, totEf2 = 0;

    const tableBody = sortedMuns.map((mun, idx) => {
      const d1 = map1.get(mun) || {};
      const d2 = map2.get(mun) || {};

      const ord1 = Number(d1.ord) || Number(d1.cbmam) || Number(d1.servico) || Number(d1.serv_ord) || 0;
      const seg1 = Number(d1.seg) || 0;
      const bri1 = Number(d1.brig) || Number(d1.brig_mun) || Number(d1.brig_semas) || Number(d1.brig_sema) || 0;
      const t1 = ord1 + seg1 + bri1;

      const ord2 = Number(d2.ord) || Number(d2.cbmam) || Number(d2.servico) || Number(d2.serv_ord) || 0;
      const seg2 = Number(d2.seg) || 0;
      const bri2 = Number(d2.brig) || Number(d2.brig_mun) || Number(d2.brig_semas) || Number(d2.brig_sema) || 0;
      const t2 = ord2 + seg2 + bri2;

      totOrd1 += ord1; totSeg1 += seg1; totBri1 += bri1; totEf1 += t1;
      totOrd2 += ord2; totSeg2 += seg2; totBri2 += bri2; totEf2 += t2;

      return [
        String(idx + 1),
        mun,
        NF.format(ord1),
        NF.format(ord2),
        NF.format(seg1),
        NF.format(seg2),
        NF.format(bri1),
        NF.format(bri2),
        NF.format(t1),
        NF.format(t2),
      ];
    });

    autoTable(doc, {
      startY,
      head: [
        [
          { content: "Nº", rowSpan: 2, styles: { valign: "middle", halign: "center" } },
          { content: "MUNICÍPIO", rowSpan: 2, styles: { valign: "middle", halign: "left" } },
          { content: "ORDINÁRIO (BM)", colSpan: 2, styles: { halign: "center" } },
          { content: "SEG ESPECIAL (BM)", colSpan: 2, styles: { halign: "center" } },
          { content: "BRIGADISTAS CIVIS", colSpan: 2, styles: { halign: "center" } },
          { content: "TOTAL EFETIVO", colSpan: 2, styles: { halign: "center" } },
        ],
        [
          String(year1), String(year2),
          String(year1), String(year2),
          String(year1), String(year2),
          String(year1), String(year2),
        ],
      ],
      body: tableBody,
      foot: [
        [
          "",
          "TOTAL GERAL",
          NF.format(totOrd1), NF.format(totOrd2),
          NF.format(totSeg1), NF.format(totSeg2),
          NF.format(totBri1), NF.format(totBri2),
          NF.format(totEf1), NF.format(totEf2),
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
      bodyStyles: { textColor: [INK.r, INK.g, INK.b], halign: "right" },
      columnStyles: {
        0: { halign: "center", cellWidth: 24 },
        1: { halign: "left", cellWidth: 140 },
        8: { fontStyle: "bold" },
        9: { fontStyle: "bold" },
      },
      alternateRowStyles: { fillColor: [ROW_ALT.r, ROW_ALT.g, ROW_ALT.b] },
      margin: { left: 24, right: 24, top: 78, bottom: 32 },
    });
  } else {
    // Recursos
    let totAbt1 = 0, totAbt2 = 0;
    let totAt1 = 0, totAt2 = 0;
    let totUr1 = 0, totUr2 = 0;
    let totAr1 = 0, totAr2 = 0;
    let totEmb1 = 0, totEmb2 = 0;
    let totRec1 = 0, totRec2 = 0;

    const tableBody = sortedMuns.map((mun, idx) => {
      const d1 = map1.get(mun) || {};
      const d2 = map2.get(mun) || {};

      const abt1 = Number(d1.abt) || 0;
      const abt2 = Number(d2.abt) || 0;
      const at1 = Number(d1.at) || 0;
      const at2 = Number(d2.at) || 0;
      const ur1 = Number(d1.ur) || 0;
      const ur2 = Number(d2.ur) || 0;
      const ar1 = Number(d1.ar) || 0;
      const ar2 = Number(d2.ar) || 0;
      const emb1 = Number(d1.embarcacao) || 0;
      const emb2 = Number(d2.embarcacao) || 0;

      const t1 = Object.keys(d1).filter(k => k !== "mun").reduce((acc, k) => acc + (Number(d1[k]) || 0), 0);
      const t2 = Object.keys(d2).filter(k => k !== "mun").reduce((acc, k) => acc + (Number(d2[k]) || 0), 0);

      totAbt1 += abt1; totAbt2 += abt2;
      totAt1 += at1; totAt2 += at2;
      totUr1 += ur1; totUr2 += ur2;
      totAr1 += ar1; totAr2 += ar2;
      totEmb1 += emb1; totEmb2 += emb2;
      totRec1 += t1;
      totRec2 += t2;

      return [
        String(idx + 1),
        mun,
        NF.format(abt1), NF.format(abt2),
        NF.format(at1), NF.format(at2),
        NF.format(ur1), NF.format(ur2),
        NF.format(ar1), NF.format(ar2),
        NF.format(emb1), NF.format(emb2),
        NF.format(t1),
        NF.format(t2),
      ];
    });

    autoTable(doc, {
      startY,
      head: [
        [
          { content: "Nº", rowSpan: 2, styles: { valign: "middle", halign: "center" } },
          { content: "MUNICÍPIO", rowSpan: 2, styles: { valign: "middle", halign: "left" } },
          { content: "ABT", colSpan: 2, styles: { halign: "center" } },
          { content: "AT", colSpan: 2, styles: { halign: "center" } },
          { content: "UR", colSpan: 2, styles: { halign: "center" } },
          { content: "AR", colSpan: 2, styles: { halign: "center" } },
          { content: "EMBARCAÇÃO", colSpan: 2, styles: { halign: "center" } },
          { content: "TOTAL", colSpan: 2, styles: { halign: "center" } },
        ],
        [
          String(year1), String(year2),
          String(year1), String(year2),
          String(year1), String(year2),
          String(year1), String(year2),
          String(year1), String(year2),
          String(year1), String(year2),
        ],
      ],
      body: tableBody,
      foot: [
        [
          "",
          "TOTAL GERAL",
          NF.format(totAbt1), NF.format(totAbt2),
          NF.format(totAt1), NF.format(totAt2),
          NF.format(totUr1), NF.format(totUr2),
          NF.format(totAr1), NF.format(totAr2),
          NF.format(totEmb1), NF.format(totEmb2),
          NF.format(totRec1), NF.format(totRec2),
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
      bodyStyles: { textColor: [INK.r, INK.g, INK.b], halign: "right" },
      columnStyles: {
        0: { halign: "center", cellWidth: 24 },
        1: { halign: "left", cellWidth: 140 },
        12: { fontStyle: "bold" },
        13: { fontStyle: "bold" },
      },
      alternateRowStyles: { fillColor: [ROW_ALT.r, ROW_ALT.g, ROW_ALT.b] },
      margin: { left: 24, right: 24, top: 78, bottom: 32 },
    });
  }

  drawFooter(doc, "Corpo de Bombeiros Militar do Amazonas · SARA / Sala de Situação");
  return doc;
}

export function exportComparisonPdf(params: ComparisonExportParams) {
  const doc = buildComparisonPdfDoc(params);
  doc.save(
    `relatorio-comparativo-${params.year1}-vs-${params.year2}-${params.activeTab}-${params.startMonth.toString().padStart(2, "0")}a${params.endMonth.toString().padStart(2, "0")}.pdf`
  );
}
