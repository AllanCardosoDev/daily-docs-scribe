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
  activeTab: "incendios" | "outras" | "efetivo" | "recursos";
  totals1: {
    incendios: number;
    flor: number;
    urb: number;
    focos: number;
    outras: number;
    efetivo: number;
    dias: number;
  };
  totals2: {
    incendios: number;
    flor: number;
    urb: number;
    focos: number;
    outras: number;
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

export function exportComparisonPdf(params: ComparisonExportParams) {
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

  // 1. Resumo Executivo dos Anos Comparados
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
        "OCORRÊNCIAS DIVERSAS",
        "EFETIVO MOBILIZADO",
      ],
    ],
    body: [
      [
        String(year1),
        periodStr,
        NF.format(totals1.dias),
        NF.format(totals1.incendios),
        NF.format(totals1.flor),
        NF.format(totals1.urb),
        NF.format(totals1.focos),
        NF.format(totals1.outras),
        NF.format(totals1.efetivo),
      ],
      [
        String(year2),
        periodStr,
        NF.format(totals2.dias),
        NF.format(totals2.incendios),
        NF.format(totals2.flor),
        NF.format(totals2.urb),
        NF.format(totals2.focos),
        NF.format(totals2.outras),
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

  // 2. Unificação e Construção da Tabela por Município
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

  // Montagem conforme a categoria selecionada
  if (activeTab === "incendios") {
    let totUrb1 = 0, totFlor1 = 0, totFoc1 = 0, totAll1 = 0;
    let totUrb2 = 0, totFlor2 = 0, totFoc2 = 0, totAll2 = 0;

    const tableBody = sortedMuns.map((mun, idx) => {
      const d1 = map1.get(mun) || {};
      const d2 = map2.get(mun) || {};

      const u1 = Number(d1.urb) || 0;
      const f1 = Number(d1.flor) || 0;
      const foc1 = Number(d1.focos) || 0;
      const t1 = u1 + f1;

      const u2 = Number(d2.urb) || 0;
      const f2 = Number(d2.flor) || 0;
      const foc2 = Number(d2.focos) || 0;
      const t2 = u2 + f2;

      totUrb1 += u1; totFlor1 += f1; totFoc1 += foc1; totAll1 += t1;
      totUrb2 += u2; totFlor2 += f2; totFoc2 += foc2; totAll2 += t2;

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
          NF.format(totUrb1),
          NF.format(totUrb2),
          NF.format(totFlor1),
          NF.format(totFlor2),
          NF.format(totFoc1),
          NF.format(totFoc2),
          NF.format(totAll1),
          NF.format(totAll2),
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
  } else if (activeTab === "outras") {
    let totSal1 = 0, totAci1 = 0, totAph1 = 0, totPre1 = 0, totSer1 = 0, totOut1 = 0;
    let totSal2 = 0, totAci2 = 0, totAph2 = 0, totPre2 = 0, totSer2 = 0, totOut2 = 0;

    const tableBody = sortedMuns.map((mun, idx) => {
      const d1 = map1.get(mun) || {};
      const d2 = map2.get(mun) || {};

      const sal1 = Number(d1.salvamento) || 0;
      const aci1 = Number(d1.acidentes) || 0;
      const aph1 = Number(d1.aph) || 0;
      const pre1 = Number(d1.prevencao) || 0;
      const ser1 = Number(d1.servicos) || 0;
      const t1 = sal1 + aci1 + aph1 + pre1 + ser1;

      const sal2 = Number(d2.salvamento) || 0;
      const aci2 = Number(d2.acidentes) || 0;
      const aph2 = Number(d2.aph) || 0;
      const pre2 = Number(d2.prevencao) || 0;
      const ser2 = Number(d2.servicos) || 0;
      const t2 = sal2 + aci2 + aph2 + pre2 + ser2;

      totSal1 += sal1; totAci1 += aci1; totAph1 += aph1; totPre1 += pre1; totSer1 += ser1; totOut1 += t1;
      totSal2 += sal2; totAci2 += aci2; totAph2 += aph2; totPre2 += pre2; totSer2 += ser2; totOut2 += t2;

      return [
        String(idx + 1),
        mun,
        NF.format(sal1),
        NF.format(sal2),
        NF.format(aci1),
        NF.format(aci2),
        NF.format(aph1),
        NF.format(aph2),
        NF.format(pre1),
        NF.format(pre2),
        NF.format(ser1),
        NF.format(ser2),
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
          { content: "SALVAMENTO", colSpan: 2, styles: { halign: "center" } },
          { content: "ACIDENTES", colSpan: 2, styles: { halign: "center" } },
          { content: "APH / RESGATE", colSpan: 2, styles: { halign: "center" } },
          { content: "PREVENÇÃO", colSpan: 2, styles: { halign: "center" } },
          { content: "SERVIÇOS", colSpan: 2, styles: { halign: "center" } },
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
          NF.format(totSal1), NF.format(totSal2),
          NF.format(totAci1), NF.format(totAci2),
          NF.format(totAph1), NF.format(totAph2),
          NF.format(totPre1), NF.format(totPre2),
          NF.format(totSer1), NF.format(totSer2),
          NF.format(totOut1), NF.format(totOut2),
        ],
      ],
      styles: {
        fontSize: 7,
        cellPadding: 2.5,
        lineColor: [220, 226, 222],
        lineWidth: 0.25,
        valign: "middle",
      },
      headStyles: {
        fillColor: [BRAND_LIGHT.r, BRAND_LIGHT.g, BRAND_LIGHT.b],
        textColor: 255,
        fontStyle: "bold",
        fontSize: 6.5,
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
        0: { halign: "center", cellWidth: 20 },
        1: { halign: "left", cellWidth: 120 },
        12: { fontStyle: "bold" },
        13: { fontStyle: "bold" },
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

      const ord1 = Number(d1.ord) || 0;
      const seg1 = Number(d1.seg) || 0;
      const bri1 = Number(d1.brig) || 0;
      const t1 = ord1 + seg1 + bri1;

      const ord2 = Number(d2.ord) || 0;
      const seg2 = Number(d2.seg) || 0;
      const bri2 = Number(d2.brig) || 0;
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
    let totRec1 = 0, totRec2 = 0;
    const tableBody = sortedMuns.map((mun, idx) => {
      const d1 = map1.get(mun) || {};
      const d2 = map2.get(mun) || {};

      const t1 = Object.keys(d1).filter(k => k !== "mun").reduce((acc, k) => acc + (Number(d1[k]) || 0), 0);
      const t2 = Object.keys(d2).filter(k => k !== "mun").reduce((acc, k) => acc + (Number(d2[k]) || 0), 0);
      totRec1 += t1;
      totRec2 += t2;

      return [
        String(idx + 1),
        mun,
        NF.format(Number(d1.abt) || 0), NF.format(Number(d2.abt) || 0),
        NF.format(Number(d1.at) || 0), NF.format(Number(d2.at) || 0),
        NF.format(Number(d1.ur) || 0), NF.format(Number(d2.ur) || 0),
        NF.format(Number(d1.ar) || 0), NF.format(Number(d2.ar) || 0),
        NF.format(Number(d1.embarcacao) || 0), NF.format(Number(d2.embarcacao) || 0),
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
          "", "", "", "", "", "", "", "",
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

  doc.save(
    `relatorio-comparativo-${year1}-vs-${year2}-${activeTab}-${startMonth.toString().padStart(2, "0")}a${endMonth.toString().padStart(2, "0")}.pdf`
  );
}
