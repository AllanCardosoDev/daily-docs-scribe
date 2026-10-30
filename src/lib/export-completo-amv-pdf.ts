import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";
import { CBMAM_LOGO_BASE64 } from "./cbmam-logo";
import { canonicalMunicipio, isNonMunicipioTroop, compareMunicipios } from "./municipio-order";
import { fmtDateBR, fmtDateStamp } from "./report-date";
import { NF } from "./formatters";

// Cores Institucionais Militares CBMAM 100% Verde
const BRAND_DARK = { r: 8, g: 46, b: 31 };     // #082e1f - Verde Floresta Amazônica Profundo
const BRAND_GREEN = { r: 16, g: 78, b: 46 };   // #104e2e - Verde Oficial CBMAM
const ACCENT_GOLD = { r: 180, g: 130, b: 20 }; // #b48214 - Ouro Militar
const BG_LIGHT_ROW: [number, number, number] = [248, 250, 248];
const BORDER_COLOR: [number, number, number] = [185, 200, 190];

export interface RelatorioCompletoAmvOptions {
  periodoLabel: string;
  dataDiariaLabel: string;
  reportDate?: Date | null;
  comandante?: string;
  coordenador?: string;
  chefeCapital?: string;
  chefeInterior?: string;
  coordSituacao?: string;

  // 1ª Seção: Ocorrências
  ocorrenciasDiarias: Array<Record<string, any>>;
  ocorrenciasTotais: Array<Record<string, any>>;

  // 2ª Seção: Efetivo
  efetivoDiario: Array<Record<string, any>>;
  efetivoGeral: Array<Record<string, any>>;

  // 3ª Seção: Viaturas / Recursos
  viaturasDiarias: Array<Record<string, any>>;
  viaturasTotais: Array<Record<string, any>>;
}

export function exportRelatorioCompletoAmvPdf(options: RelatorioCompletoAmvOptions) {
  const doc = buildRelatorioCompletoAmvDoc(options);
  const cleanPeriod = options.periodoLabel.replace(/[^a-zA-Z0-9]+/g, "-").replace(/^-|-$/g, "");
  const filename = `relatorio-completo-amv-${cleanPeriod || "consolidado"}.pdf`;
  doc.save(filename);
}

export function buildRelatorioCompletoAmvDoc(options: RelatorioCompletoAmvOptions): jsPDF {
  const {
    periodoLabel,
    dataDiariaLabel,
    comandante = "CEL QOBM BORGES",
    coordenador = "CEL QOBM CRISTIANO BRAZ FERREIRA",
    chefeCapital = "CEL QOBM MENEZES",
    chefeInterior = "CEL QOBM MONTEIRO",
    coordSituacao = "CEL QOBM FERREIRA",
    ocorrenciasDiarias,
    ocorrenciasTotais,
    efetivoDiario,
    efetivoGeral,
    viaturasDiarias,
    viaturasTotais,
  } = options;

  const DocConstructor = (jsPDF as any).jsPDF || jsPDF;
  const doc = new DocConstructor({ orientation: "landscape", unit: "pt", format: "a4" });
  const pageW = doc.internal.pageSize.getWidth(); // ~841.89 pt
  const pageH = doc.internal.pageSize.getHeight(); // ~595.28 pt

  const num = (v: any) => Math.max(0, Math.abs(typeof v === "number" && !isNaN(v) ? v : Number(v) || 0));

  // Função auxiliar para desenhar o cabeçalho institucional em todas as páginas
  const drawPageHeader = (pageNumber: number, sectionNumber: string, sectionTitle: string, subtitle: string) => {
    doc.setPage(pageNumber);

    // Barra superior verde escuro institucional
    doc.setFillColor(BRAND_DARK.r, BRAND_DARK.g, BRAND_DARK.b);
    doc.rect(0, 0, pageW, 54, "F");

    // Linha de realce dourada militar
    doc.setFillColor(ACCENT_GOLD.r, ACCENT_GOLD.g, ACCENT_GOLD.b);
    doc.rect(0, 54, pageW, 2, "F");

    // Brasão CBMAM
    try {
      doc.addImage(CBMAM_LOGO_BASE64, "PNG", 16, 5, 42, 44);
    } catch {
      // Fallback
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
    doc.text(`${sectionNumber.toUpperCase()} — ${sectionTitle.toUpperCase()} · ${subtitle.toUpperCase()}`, pageW / 2, 44, { align: "center" });

    // Oficiais Responsáveis (Esquerda)
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

    // Metadados do Período (Direita)
    const rightMarginX = pageW - 16;
    const labelStartX = pageW - 270;

    doc.setFont("helvetica", "bold");
    doc.text("Período Consolidado:", labelStartX, 15);
    doc.text("Fechamento Diário:", labelStartX, 25);
    doc.text("Coord. Geral Operação:", labelStartX, 35);
    doc.text("Emissão do Relatório:", labelStartX, 45);

    doc.setFont("helvetica", "normal");
    doc.text(periodoLabel, rightMarginX, 15, { align: "right" });
    doc.text(dataDiariaLabel, rightMarginX, 25, { align: "right" });
    doc.text(coordenador, rightMarginX, 35, { align: "right" });
    doc.text(`${new Date().toLocaleDateString("pt-BR")} às ${new Date().toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" })}`, rightMarginX, 45, { align: "right" });
  };

  // KPI Cards executivos
  const drawKpiCards = (
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

  // ===========================================================================
  // 📄 1ª PÁGINA: OCORRÊNCIAS (1º ITEM DA IMAGEM)
  // ===========================================================================
  let currentOccPage = 1;
  drawPageHeader(1, "1º Item", "Ocorrências", "COMBATE A INCÊNDIOS (DIÁRIO × ACUMULADO)");

  // Mapa de Ocorrências Diárias vs Totais
  const munsSet = new Set<string>();
  ocorrenciasTotais.forEach((r) => munsSet.add(canonicalMunicipio(r.mun || r.municipio)));
  ocorrenciasDiarias.forEach((r) => munsSet.add(canonicalMunicipio(r.mun || r.municipio)));

  const sortedMuns = Array.from(munsSet)
    .filter((m) => m && m !== "—")
    .sort((a, b) => compareMunicipios(a, b));

  const occTotMap = new Map<string, Record<string, number>>();
  ocorrenciasTotais.forEach((r) => {
    const m = canonicalMunicipio(r.mun || r.municipio);
    occTotMap.set(m.toLowerCase(), {
      urb: num(r.urb),
      flor: num(r.flor),
      focos: num(r.focos),
      tot: num(r.urb) + num(r.flor),
    });
  });

  const occDiaMap = new Map<string, Record<string, number>>();
  ocorrenciasDiarias.forEach((r) => {
    const m = canonicalMunicipio(r.mun || r.municipio);
    occDiaMap.set(m.toLowerCase(), {
      urb: num(r.urb),
      flor: num(r.flor),
      focos: num(r.focos),
      tot: num(r.urb) + num(r.flor),
    });
  });

  // Totais Gerais
  let sumDiaUrb = 0, sumDiaFlor = 0, sumDiaFocos = 0, sumDiaTot = 0;
  let sumAcumUrb = 0, sumAcumFlor = 0, sumAcumFocos = 0, sumAcumTot = 0;

  const occRows = sortedMuns.map((mun) => {
    const k = mun.toLowerCase();
    const d = occDiaMap.get(k) || { urb: 0, flor: 0, focos: 0, tot: 0 };
    const t = occTotMap.get(k) || { urb: 0, flor: 0, focos: 0, tot: 0 };

    sumDiaUrb += d.urb;
    sumDiaFlor += d.flor;
    sumDiaFocos += d.focos;
    sumDiaTot += d.tot;

    sumAcumUrb += t.urb;
    sumAcumFlor += t.flor;
    sumAcumFocos += t.focos;
    sumAcumTot += t.tot;

    return {
      mun,
      diaUrb: d.urb,
      diaFlor: d.flor,
      diaFocos: d.focos,
      diaTot: d.tot,
      acumUrb: t.urb,
      acumFlor: t.flor,
      acumFocos: t.focos,
      acumTot: t.tot,
    };
  });

  drawKpiCards(62, [
    {
      label: "Total de Incêndios",
      value: NF.format(sumAcumTot),
      subtext: `Dia: ${NF.format(sumDiaTot)} | Acum: ${NF.format(sumAcumTot)}`,
      highlight: true,
    },
    {
      label: "Focos de Calor",
      value: NF.format(sumAcumFocos),
      subtext: `Dia: ${NF.format(sumDiaFocos)} | Acum: ${NF.format(sumAcumFocos)}`,
    },
    {
      label: "Incêndios Florestais",
      value: NF.format(sumAcumFlor),
      subtext: `Dia: ${NF.format(sumDiaFlor)} | Acum: ${NF.format(sumAcumFlor)}`,
    },
    {
      label: "Incêndios Urbanos",
      value: NF.format(sumAcumUrb),
      subtext: `Dia: ${NF.format(sumDiaUrb)} | Acum: ${NF.format(sumAcumUrb)}`,
    },
  ]);

  const occTableHead = [
    [
      {
        content: "LOCALIDADE",
        colSpan: 1,
        styles: { fillColor: [BRAND_DARK.r, BRAND_DARK.g, BRAND_DARK.b], textColor: 255, halign: "center", fontStyle: "bold" },
      },
      {
        content: `OCORRÊNCIAS NO DIA (${dataDiariaLabel})`,
        colSpan: 4,
        styles: { fillColor: [BRAND_GREEN.r, BRAND_GREEN.g, BRAND_GREEN.b], textColor: 255, halign: "center", fontStyle: "bold" },
      },
      {
        content: `TOTAIS ACUMULADOS NO PERÍODO (${periodoLabel})`,
        colSpan: 4,
        styles: { fillColor: [BRAND_DARK.r, BRAND_DARK.g, BRAND_DARK.b], textColor: 255, halign: "center", fontStyle: "bold" },
      },
      {
        content: "PART.",
        colSpan: 1,
        styles: { fillColor: [BRAND_GREEN.r, BRAND_GREEN.g, BRAND_GREEN.b], textColor: 255, halign: "center", fontStyle: "bold" },
      },
    ],
    [
      "MUNICÍPIO",
      "URB",
      "FLOR",
      "FOCOS",
      "TOTAL DIA",
      "URB",
      "FLOR",
      "FOCOS",
      "TOTAL ACUM",
      "% TOTAL",
    ],
  ];

  const occTableBody = occRows.map((r) => {
    const part = sumAcumTot > 0 ? ((r.acumTot / sumAcumTot) * 100).toFixed(1) + "%" : "0%";
    return [
      r.mun,
      r.diaUrb || "—",
      r.diaFlor || "—",
      r.diaFocos || "—",
      r.diaTot || "0",
      r.acumUrb || "—",
      r.acumFlor || "—",
      r.acumFocos || "—",
      r.acumTot || "0",
      part,
    ];
  });

  autoTable(doc, {
    startY: 96,
    margin: { left: 16, top: 62 },
    tableWidth: pageW - 32,
    head: occTableHead as any,
    body: [
      ...occTableBody,
      [
        "TOTAL GERAL DO AMAZONAS",
        sumDiaUrb,
        sumDiaFlor,
        sumDiaFocos,
        sumDiaTot,
        sumAcumUrb,
        sumAcumFlor,
        sumAcumFocos,
        sumAcumTot,
        "100.0%",
      ],
    ],
    didDrawPage: (data) => {
      if (data.pageNumber > 1) {
        drawPageHeader(data.pageNumber, "1º Item", "Ocorrências", "COMBATE A INCÊNDIOS (DIÁRIO × ACUMULADO) · CONTINUAÇÃO");
      }
    },
    styles: {
      fontSize: 5.7,
      cellPadding: 1.4,
      lineColor: BORDER_COLOR,
      lineWidth: 0.25,
      halign: "center",
      valign: "middle",
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
      0: { fontStyle: "bold", halign: "left", cellWidth: 100 },
      4: { fontStyle: "bold", fillColor: [240, 248, 242] },
      8: { fontStyle: "bold", fillColor: [235, 245, 238], textColor: [16, 78, 46] },
      9: { fontStyle: "bold", halign: "right" },
    },
  });

  // ===========================================================================
  // 📄 2ª PÁGINA: EFETIVO (2º ITEM DA IMAGEM - PESSOAL)
  // Ordem estrita exigida:
  // 1. RESUMO DE EFETIVO GERAL (POR FORÇA)
  // 2. EFETIVO GERAL - MUNICÍPIOS (POR FORÇA)
  // 3. EFETIVO DIARIO - POR MUNICIPIO (POR FORÇA)
  // ===========================================================================
  doc.addPage();
  const efStartPage = (doc as any).internal.getNumberOfPages();
  drawPageHeader(efStartPage, "2º Item", "Efetivo", "PESSOAL & FORÇAS INTEGRADAS (DIÁRIO × TOTAIS)");

  // Cálculos de Efetivo por Força
  const getForcasSum = (list: Array<Record<string, any>>) => {
    let cbmam = 0, fn = 0, prevfogo = 0, marinha = 0, cbmsp = 0, brig = 0;
    list.forEach((r) => {
      cbmam += num(r.ord) + num(r.cbmam) + num(r.servico) + num(r.opamv) + num(r.opam_ref) + num(r.inc1) + num(r.inc2) + num(r.inc3) + num(r.seg);
      fn += num(r.fn);
      prevfogo += num(r.prevfogo);
      marinha += num(r.marinha) + num(r.icmbio);
      cbmsp += num(r.cbmsp);
      brig += num(r.brig_mun) + num(r.brig) + num(r.brig_semas) + num(r.brig_sema);
    });
    const total = cbmam + fn + prevfogo + marinha + cbmsp + brig;
    return { cbmam, fn, prevfogo, marinha, cbmsp, brig, total };
  };

  const forcasDia = getForcasSum(efetivoDiario);
  const forcasGeral = getForcasSum(efetivoGeral);

  drawKpiCards(62, [
    {
      label: "Efetivo Total Mobilizado",
      value: NF.format(forcasGeral.total),
      subtext: `Dia: ${NF.format(forcasDia.total)} | Geral: ${NF.format(forcasGeral.total)}`,
      highlight: true,
    },
    {
      label: "Militares CBMAM",
      value: NF.format(forcasGeral.cbmam),
      subtext: `Dia: ${NF.format(forcasDia.cbmam)} | Geral: ${NF.format(forcasGeral.cbmam)}`,
    },
    {
      label: "Forças Federais & Parceiros",
      value: NF.format(forcasGeral.fn + forcasGeral.prevfogo + forcasGeral.marinha + forcasGeral.cbmsp),
      subtext: `Dia: ${NF.format(forcasDia.fn + forcasDia.prevfogo + forcasDia.marinha + forcasDia.cbmsp)}`,
    },
    {
      label: "Brigadistas Florestais",
      value: NF.format(forcasGeral.brig),
      subtext: `Dia: ${NF.format(forcasDia.brig)} | Geral: ${NF.format(forcasGeral.brig)}`,
    },
  ]);

  // 1. RESUMO DE EFETIVO GERAL (POR FORÇA)
  const resumoForcasBody = [
    [
      "Corpo de Bombeiros Militar do AM (CBMAM)",
      forcasDia.cbmam || "0",
      forcasGeral.cbmam || "0",
      forcasGeral.total > 0 ? ((forcasGeral.cbmam / forcasGeral.total) * 100).toFixed(1) + "%" : "0%",
    ],
    [
      "Força Nacional de Segurança Pública (FN)",
      forcasDia.fn || "0",
      forcasGeral.fn || "0",
      forcasGeral.total > 0 ? ((forcasGeral.fn / forcasGeral.total) * 100).toFixed(1) + "%" : "0%",
    ],
    [
      "IBAMA / PREVFOGO (Brigadas Federais)",
      forcasDia.prevfogo || "0",
      forcasGeral.prevfogo || "0",
      forcasGeral.total > 0 ? ((forcasGeral.prevfogo / forcasGeral.total) * 100).toFixed(1) + "%" : "0%",
    ],
    [
      "Marinha do Brasil & ICMBio",
      forcasDia.marinha || "0",
      forcasGeral.marinha || "0",
      forcasGeral.total > 0 ? ((forcasGeral.marinha / forcasGeral.total) * 100).toFixed(1) + "%" : "0%",
    ],
    [
      "Corpo de Bombeiros da PMESP (CBMSP)",
      forcasDia.cbmsp || "0",
      forcasGeral.cbmsp || "0",
      forcasGeral.total > 0 ? ((forcasGeral.cbmsp / forcasGeral.total) * 100).toFixed(1) + "%" : "0%",
    ],
    [
      "Brigadas Civis Municipais & SEMA",
      forcasDia.brig || "0",
      forcasGeral.brig || "0",
      forcasGeral.total > 0 ? ((forcasGeral.brig / forcasGeral.total) * 100).toFixed(1) + "%" : "0%",
    ],
    [
      "TOTAL GERAL DA FORÇA INTEGRADA",
      forcasDia.total || "0",
      forcasGeral.total || "0",
      "100.0%",
    ],
  ];

  autoTable(doc, {
    startY: 96,
    margin: { left: 16 },
    tableWidth: 260,
    head: [
      [
        {
          content: "1. RESUMO DE EFETIVO GERAL (POR FORÇA)",
          colSpan: 4,
          styles: {
            fillColor: [BRAND_DARK.r, BRAND_DARK.g, BRAND_DARK.b],
            textColor: 255,
            fontStyle: "bold",
            halign: "center",
            fontSize: 6.5,
          },
        },
      ],
      ["FORÇA OPERACIONAL", "DIÁRIO", "TOTAIS", "PART."],
    ],
    body: resumoForcasBody,
    styles: {
      fontSize: 5.5,
      cellPadding: 1.5,
      lineColor: BORDER_COLOR,
      lineWidth: 0.25,
      halign: "center",
      valign: "middle",
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
      0: { fontStyle: "bold", halign: "left", cellWidth: 120 },
      1: { halign: "center", fontStyle: "bold" },
      2: { halign: "center", fontStyle: "bold", textColor: [16, 78, 46], fillColor: [235, 245, 238] },
      3: { halign: "right" },
    },
  });

  // 2. EFETIVO GERAL - MUNICÍPIOS (POR FORÇA) & 3. EFETIVO DIARIO - POR MUNICIPIO (POR FORÇA)
  // Monta tabela comparativa detalhada por município (lado direito da página)
  const efDiaMap = new Map<string, any>();
  efetivoDiario.forEach((r) => {
    const m = canonicalMunicipio(r.mun || r.municipio);
    efDiaMap.set(m.toLowerCase(), r);
  });

  const efGeralMap = new Map<string, any>();
  efetivoGeral.forEach((r) => {
    const m = canonicalMunicipio(r.mun || r.municipio);
    efGeralMap.set(m.toLowerCase(), r);
  });

  const allEfMunsSet = new Set<string>();
  efetivoGeral.forEach((r) => allEfMunsSet.add(canonicalMunicipio(r.mun || r.municipio)));
  efetivoDiario.forEach((r) => allEfMunsSet.add(canonicalMunicipio(r.mun || r.municipio)));

  const sortedEfMuns = Array.from(allEfMunsSet)
    .filter((m) => m && m !== "—")
    .sort((a, b) => compareMunicipios(a, b));

  const efTableHead = [
    [
      {
        content: "LOCALIDADE",
        colSpan: 1,
        styles: { fillColor: [BRAND_DARK.r, BRAND_DARK.g, BRAND_DARK.b], textColor: 255, halign: "center", fontStyle: "bold" },
      },
      {
        content: "2. EFETIVO GERAL - MUNICÍPIOS (POR FORÇA)",
        colSpan: 4,
        styles: { fillColor: [BRAND_DARK.r, BRAND_DARK.g, BRAND_DARK.b], textColor: 255, halign: "center", fontStyle: "bold" },
      },
      {
        content: `3. EFETIVO DIÁRIO - POR MUNICÍPIO (POR FORÇA) · ${dataDiariaLabel}`,
        colSpan: 4,
        styles: { fillColor: [BRAND_GREEN.r, BRAND_GREEN.g, BRAND_GREEN.b], textColor: 255, halign: "center", fontStyle: "bold" },
      },
    ],
    [
      "MUNICÍPIO / BASE",
      "CBMAM",
      "FED/PARC",
      "BRIG",
      "TOT GERAL",
      "CBMAM",
      "FED/PARC",
      "BRIG",
      "TOT DIA",
    ],
  ];

  const efTableBody = sortedEfMuns.map((mun) => {
    const k = mun.toLowerCase();
    const d = efDiaMap.get(k) || {};
    const g = efGeralMap.get(k) || {};

    const dCbmam = num(d.ord) + num(d.cbmam) + num(d.servico) + num(d.opamv) + num(d.opam_ref) + num(d.inc1) + num(d.inc2) + num(d.inc3) + num(d.seg);
    const dFed = num(d.fn) + num(d.prevfogo) + num(d.marinha) + num(d.cbmsp);
    const dBrig = num(d.brig_mun) + num(d.brig) + num(d.brig_semas);
    const dTot = dCbmam + dFed + dBrig;

    const gCbmam = num(g.ord) + num(g.cbmam) + num(g.servico) + num(g.opamv) + num(g.opam_ref) + num(g.inc1) + num(g.inc2) + num(g.inc3) + num(g.seg);
    const gFed = num(g.fn) + num(g.prevfogo) + num(g.marinha) + num(g.cbmsp);
    const gBrig = num(g.brig_mun) + num(g.brig) + num(g.brig_semas);
    const gTot = gCbmam + gFed + gBrig;

    return [
      mun,
      gCbmam || "—",
      gFed || "—",
      gBrig || "—",
      gTot || "0",
      dCbmam || "—",
      dFed || "—",
      dBrig || "—",
      dTot || "0",
    ];
  });

  autoTable(doc, {
    startY: 96,
    margin: { left: 284, top: 62 },
    tableWidth: pageW - 300,
    head: efTableHead as any,
    body: [
      ...efTableBody,
      [
        "TOTAL GERAL",
        forcasGeral.cbmam,
        forcasGeral.fn + forcasGeral.prevfogo + forcasGeral.marinha + forcasGeral.cbmsp,
        forcasGeral.brig,
        forcasGeral.total,
        forcasDia.cbmam,
        forcasDia.fn + forcasDia.prevfogo + forcasDia.marinha + forcasDia.cbmsp,
        forcasDia.brig,
        forcasDia.total,
      ],
    ],
    didDrawPage: (data) => {
      if (data.pageNumber > efStartPage) {
        drawPageHeader(data.pageNumber, "2º Item", "Efetivo", "PESSOAL & FORÇAS INTEGRADAS · CONTINUAÇÃO");
      }
    },
    styles: {
      fontSize: 5.4,
      cellPadding: 1.25,
      lineColor: BORDER_COLOR,
      lineWidth: 0.25,
      halign: "center",
      valign: "middle",
    },
    alternateRowStyles: { fillColor: BG_LIGHT_ROW },
    headStyles: {
      fillColor: [BRAND_GREEN.r, BRAND_GREEN.g, BRAND_GREEN.b],
      textColor: 255,
      fontStyle: "bold",
      fontSize: 5.6,
      halign: "center",
    },
    columnStyles: {
      0: { fontStyle: "bold", halign: "left", cellWidth: 80 },
      4: { fontStyle: "bold", fillColor: [235, 245, 238], textColor: [16, 78, 46] },
      8: { fontStyle: "bold", fillColor: [240, 248, 242] },
    },
  });

  // ===========================================================================
  // 📄 3ª PÁGINA: VIATURAS (3º ITEM DA IMAGEM - VTR E MAT.)
  // ===========================================================================
  doc.addPage();
  const vtrStartPage = (doc as any).internal.getNumberOfPages();
  drawPageHeader(vtrStartPage, "3º Item", "Viaturas", "VIATURAS, EQUIPAMENTOS E MATERIAIS (DIÁRIO × TOTAIS)");

  const vtrDiaMap = new Map<string, any>();
  viaturasDiarias.forEach((r) => {
    const m = canonicalMunicipio(r.mun || r.municipio);
    vtrDiaMap.set(m.toLowerCase(), r);
  });

  const vtrTotMap = new Map<string, any>();
  viaturasTotais.forEach((r) => {
    const m = canonicalMunicipio(r.mun || r.municipio);
    vtrTotMap.set(m.toLowerCase(), r);
  });

  const allVtrMunsSet = new Set<string>();
  viaturasTotais.forEach((r) => allVtrMunsSet.add(canonicalMunicipio(r.mun || r.municipio)));
  viaturasDiarias.forEach((r) => allVtrMunsSet.add(canonicalMunicipio(r.mun || r.municipio)));

  const sortedVtrMuns = Array.from(allVtrMunsSet)
    .filter((m) => m && m !== "—")
    .sort((a, b) => compareMunicipios(a, b));

  let totDiaCombate = 0, totDiaApoio = 0, totDiaFluvial = 0, totDiaMeios = 0;
  let totAcumCombate = 0, totAcumApoio = 0, totAcumFluvial = 0, totAcumMeios = 0;

  const vtrTableRows = sortedVtrMuns.map((mun) => {
    const k = mun.toLowerCase();
    const d = vtrDiaMap.get(k) || {};
    const t = vtrTotMap.get(k) || {};

    const dCombate = num(d.abt) + num(d.at) + num(d.aem) + num(d.abf) + num(d.atf) + num(d.abs);
    const dApoio = num(d.atp) + num(d.ata) + num(d.pipa) + num(d.ar) + num(d.ur) + num(d.gse) + num(d.mt) + num(d.picape_fn) + num(d.picape_muni);
    const dFluvial = num(d.embarcacao) + num(d.jetski);
    const dTotal = dCombate + dApoio + dFluvial + num(d.helicoptero) + num(d.aviao);

    const tCombate = num(t.abt) + num(t.at) + num(t.aem) + num(t.abf) + num(t.atf) + num(t.abs);
    const tApoio = num(t.atp) + num(t.ata) + num(t.pipa) + num(t.ar) + num(t.ur) + num(t.gse) + num(t.mt) + num(t.picape_fn) + num(t.picape_muni);
    const tFluvial = num(t.embarcacao) + num(t.jetski);
    const tTotal = tCombate + tApoio + tFluvial + num(t.helicoptero) + num(t.aviao);

    totDiaCombate += dCombate;
    totDiaApoio += dApoio;
    totDiaFluvial += dFluvial;
    totDiaMeios += dTotal;

    totAcumCombate += tCombate;
    totAcumApoio += tApoio;
    totAcumFluvial += tFluvial;
    totAcumMeios += tTotal;

    return [
      mun,
      dCombate || "—",
      dApoio || "—",
      dFluvial || "—",
      dTotal || "0",
      tCombate || "—",
      tApoio || "—",
      tFluvial || "—",
      tTotal || "0",
    ];
  });

  drawKpiCards(62, [
    {
      label: "Total de Meios Operacionais",
      value: NF.format(totAcumMeios),
      subtext: `Dia: ${NF.format(totDiaMeios)} | Totais: ${NF.format(totAcumMeios)}`,
      highlight: true,
    },
    {
      label: "Viaturas de Combate",
      value: NF.format(totAcumCombate),
      subtext: `ABT, AT, AEM, ABF, ATF`,
    },
    {
      label: "Viaturas de Apoio & Logística",
      value: NF.format(totAcumApoio),
      subtext: `ATP, ATA, Pipa, AR, UR, GSE`,
    },
    {
      label: "Meios Fluviais & Especiais",
      value: NF.format(totAcumFluvial),
      subtext: `Embarcações, Botes & Jet Skis`,
    },
  ]);

  const vtrTableHead = [
    [
      {
        content: "LOCALIDADE",
        colSpan: 1,
        styles: { fillColor: [BRAND_DARK.r, BRAND_DARK.g, BRAND_DARK.b], textColor: 255, halign: "center", fontStyle: "bold" },
      },
      {
        content: `VIATURAS E MATERIAIS NO DIA (${dataDiariaLabel})`,
        colSpan: 4,
        styles: { fillColor: [BRAND_GREEN.r, BRAND_GREEN.g, BRAND_GREEN.b], textColor: 255, halign: "center", fontStyle: "bold" },
      },
      {
        content: `TOTAIS EMPREGADOS NO PERÍODO (${periodoLabel})`,
        colSpan: 4,
        styles: { fillColor: [BRAND_DARK.r, BRAND_DARK.g, BRAND_DARK.b], textColor: 255, halign: "center", fontStyle: "bold" },
      },
    ],
    [
      "MUNICÍPIO / BASE",
      "COMBATE",
      "APOIO/LOG",
      "FLUVIAL",
      "TOTAL DIA",
      "COMBATE",
      "APOIO/LOG",
      "FLUVIAL",
      "TOTAL GERAL",
    ],
  ];

  autoTable(doc, {
    startY: 96,
    margin: { left: 16, top: 62 },
    tableWidth: pageW - 32,
    head: vtrTableHead as any,
    body: [
      ...vtrTableRows,
      [
        "TOTAL GERAL DE MEIOS E VIATURAS",
        totDiaCombate,
        totDiaApoio,
        totDiaFluvial,
        totDiaMeios,
        totAcumCombate,
        totAcumApoio,
        totAcumFluvial,
        totAcumMeios,
      ],
    ],
    didDrawPage: (data) => {
      if (data.pageNumber > vtrStartPage) {
        drawPageHeader(data.pageNumber, "3º Item", "Viaturas", "VIATURAS, EQUIPAMENTOS E MATERIAIS · CONTINUAÇÃO");
      }
    },
    styles: {
      fontSize: 5.6,
      cellPadding: 1.3,
      lineColor: BORDER_COLOR,
      lineWidth: 0.25,
      halign: "center",
      valign: "middle",
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
      0: { fontStyle: "bold", halign: "left", cellWidth: 100 },
      4: { fontStyle: "bold", fillColor: [240, 248, 242] },
      8: { fontStyle: "bold", fillColor: [235, 245, 238], textColor: [16, 78, 46] },
    },
  });

  // Rodapé em todas as páginas
  const totalPages = (doc as any).internal.getNumberOfPages();
  for (let i = 1; i <= totalPages; i++) {
    doc.setPage(i);
    const footerY = pageH - 20;
    doc.setDrawColor(BORDER_COLOR[0], BORDER_COLOR[1], BORDER_COLOR[2]);
    doc.setLineWidth(0.5);
    doc.line(16, footerY - 4, pageW - 16, footerY - 4);

    doc.setFont("helvetica", "normal");
    doc.setFontSize(6.5);
    doc.setTextColor(100, 110, 105);
    doc.text(
      "Corpo de Bombeiros Militar do Estado do Amazonas · Sala de Situação · Relatório Integrado AM+V (Diário × Totais)",
      16,
      footerY + 8,
    );
    doc.text(
      `Página ${i} de ${totalPages} · Documento emitido eletronicamente em ${new Date().toLocaleDateString("pt-BR")}`,
      pageW - 16,
      footerY + 8,
      { align: "right" },
    );
  }

  return doc;
}
