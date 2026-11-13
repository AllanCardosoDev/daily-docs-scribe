import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";
import { CBMAM_LOGO_BASE64 } from "./cbmam-logo";
import { canonicalMunicipio, isNonMunicipioTroop, compareMunicipios, deduplicateAndOrderMunicipios } from "./municipio-order";
import { resolveEfetivoColumns, calculateRowTotal } from "./dashboard-columns";
import { fmtDateBR, fmtDateStamp } from "./report-date";
import { NF } from "./formatters";
import { EFETIVO_BASES_PADRAO, norm, buildEfetivoMapasData, type EfetivoMapasItem } from "./efetivo-mapas";

// Cores Institucionais CBMAM 100% Verde Floresta e Militar
const BRAND_DARK = { r: 8, g: 46, b: 31 };     // #082e1f - Verde Floresta Amazônica Profundo
const BRAND_GREEN = { r: 16, g: 78, b: 46 };   // #104e2e - Verde CBMAM Oficial
const ACCENT_GOLD = { r: 180, g: 130, b: 20 }; // #b48214 - Ouro Militar
const BG_LIGHT_ROW: [number, number, number] = [248, 250, 248];
const BORDER_COLOR: [number, number, number] = [185, 200, 190];

export interface ExportEfetivoPdfOptions {
  efetivo: Array<Record<string, any>>;
  efetivoDiario?: Array<Record<string, any>>;
  efetivoGeral?: Array<Record<string, any>>;
  mode?: "diario" | "total" | "completo";
  periodoLabel?: string;
  dataDiariaLabel?: string;
  reportDate?: Date | null;
  operador?: string;
  responsavel?: string;
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
  const modeSlug = options.mode || "diario";
  const slug = (options.periodoLabel || "")
    .replace(/[^a-zA-Z0-9]+/g, "-")
    .replace(/^-|-$/g, "");
  const filename = `relatorio-efetivo-${modeSlug}-${slug || stamp}.pdf`;
  doc.save(filename);
}

export function exportEfetivoDiarioPdf(options: ExportEfetivoPdfOptions) {
  exportEfetivoPdf({ ...options, mode: "diario" });
}

export function exportEfetivoTotalPdf(options: ExportEfetivoPdfOptions) {
  exportEfetivoPdf({ ...options, mode: "total" });
}

export function exportEfetivoCompletoPdf(options: ExportEfetivoPdfOptions) {
  exportEfetivoPdf({ ...options, mode: "completo" });
}

export function buildEfetivoPdfDoc(options: ExportEfetivoPdfOptions): jsPDF {
  const mode: "diario" | "total" | "completo" = options.mode || "diario";
  const {
    efetivo: rawEfetivo,
    efetivoDiario: rawEfDiario,
    efetivoGeral: rawEfGeral,
    periodoLabel,
    dataDiariaLabel,
    reportDate,
  } = options;

  const DocConstructor = (jsPDF as any).jsPDF || jsPDF;
  const doc = new DocConstructor({ orientation: "landscape", unit: "pt", format: "a4" });
  const pageW = doc.internal.pageSize.getWidth(); // ~841.89 pt
  const pageH = doc.internal.pageSize.getHeight(); // ~595.28 pt

  const num = (v: any) => Math.max(0, Math.abs(typeof v === "number" && !isNaN(v) ? v : Number(v) || 0));

  const isBaseRow = (r: any) =>
    r?.tipo === "base" ||
    norm(r?.mun) === "autazes posto km 53" ||
    norm(r?.mun) === "posto km 53" ||
    /posto\s*km\s*53|base\b/i.test(r?.mun || "");

  const isCapitalRow = (r: any) => r?.tipo === "capital" || norm(r?.mun) === "manaus";

  // Captura do Nome de Guerra do Operador da Sala
  let operador = (options.operador || options.responsavel || "").trim();
  if (!operador && typeof window !== "undefined") {
    try {
      for (let i = 0; i < localStorage.length; i++) {
        const k = localStorage.key(i) || "";
        if (k.includes("auth-token")) {
          const raw = localStorage.getItem(k);
          if (raw) {
            const parsed = JSON.parse(raw);
            const u = parsed.user || parsed.currentSession?.user;
            if (u) {
              operador =
                u.user_metadata?.display_name ||
                u.user_metadata?.full_name ||
                u.user_metadata?.name ||
                "";
              if (operador) break;
            }
          }
        }
      }
    } catch {
      // fallback
    }
  }
  if (!operador) {
    operador = "2º SGT QCPBM NARA";
  }
  operador = operador.toUpperCase();

  const opDate = reportDate ?? new Date();
  const dateStr = dataDiariaLabel || fmtDateBR(opDate);
  const periodStr = periodoLabel || (mode === "diario" ? `${dateStr} — 24H` : "Operação Amazonas + Verde 2026");

  // Função auxiliar para desenhar o cabeçalho institucional em todas as páginas
  const drawPageHeader = (pageNumber: number, titleText: string, subRightLabel: string, subRightVal: string) => {
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
      // Fallback se logo falhar
    }

    // Identificação Central Oficial CBMAM / AMAZONAS + VERDE (Caixa Alta)
    doc.setFont("helvetica", "bold");
    doc.setFontSize(12);
    doc.setTextColor(255, 255, 255);
    doc.text("CBMAM", pageW / 2, 16, { align: "center" });

    doc.setFont("helvetica", "bold");
    doc.setFontSize(10.5);
    doc.setTextColor(110, 231, 183);
    doc.text("AMAZONAS + VERDE", pageW / 2, 28, { align: "center" });

    doc.setFont("helvetica", "bold");
    doc.setFontSize(9);
    doc.setTextColor(255, 220, 140);
    doc.text(titleText, pageW / 2, 42, { align: "center" });

    // Metadados (Direita)
    const rightMarginX = pageW - 16;
    const labelStartX = pageW - 230;

    doc.setTextColor(230, 240, 235);
    doc.setFontSize(6.8);

    doc.setFont("helvetica", "bold");
    doc.text(subRightLabel, labelStartX, 16);
    doc.setFont("helvetica", "normal");
    doc.text(subRightVal, rightMarginX, 16, { align: "right" });

    doc.setFont("helvetica", "bold");
    doc.text("Emissão do Relatório:", labelStartX, 28);
    doc.setFont("helvetica", "normal");
    const emissaoStr = `${new Date().toLocaleDateString("pt-BR")} às ${new Date().toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" })}`;
    doc.text(emissaoStr, rightMarginX, 28, { align: "right" });

    doc.setFont("helvetica", "bold");
    doc.text("Status Operacional:", labelStartX, 40);
    doc.setFont("helvetica", "normal");
    doc.text("Força Ativa (100% Prontidão)", rightMarginX, 40, { align: "right" });
  };

  // KPI Cards executivos (Nomes à esquerda, Números à direita, sem subtextos)
  const drawCards = (
    startY: number,
    cards: Array<{ label: string; value: string | number; highlight?: boolean }>,
  ) => {
    const cardH = 26;
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

      // Nome do indicador à esquerda
      doc.setFont("helvetica", "bold");
      doc.setFontSize(6.8);
      doc.setTextColor(c.highlight ? 230 : BRAND_DARK.r, c.highlight ? 245 : BRAND_DARK.g, c.highlight ? 235 : BRAND_DARK.b);
      doc.text(c.label.toUpperCase(), x + 10, startY + cardH / 2 + 2.5);

      // Número à direita
      doc.setFont("helvetica", "bold");
      doc.setFontSize(11);
      doc.setTextColor(c.highlight ? 255 : BRAND_DARK.r, c.highlight ? 220 : BRAND_DARK.g, c.highlight ? 140 : BRAND_DARK.b);
      doc.text(String(c.value), x + cardW - 10, startY + cardH / 2 + 3.5, { align: "right" });
    });
  };

  // Helper para converter dados de efetivo para modelo de forças padronizado
  const getForcasSum = (list: any[]) => {
    let cbmam = 0, fn = 0, prevfogo = 0, marinha = 0, cbmsp = 0, brig = 0;
    list.forEach((r) => {
      const regular = num(r.cbmam) || num(r.servico) || num(r.ord) || num(r.serv_ord);
      const opamv = num(r.opamv);
      const opam_ref = num(r.opam_ref);
      const inc1 = num(r.inc1 || r.inc_1);
      const inc2 = num(r.inc2 || r.inc_2);
      const inc3 = num(r.inc3 || r.inc_3);
      const seg = num(r.seg);
      cbmam += regular + opamv + opam_ref + inc1 + inc2 + inc3 + seg;

      fn += num(r.fn);
      prevfogo += num(r.prevfogo);
      marinha += num(r.marinha || r.icmbio);
      cbmsp += num(r.cbmsp);

      const brigVal = (num(r.brig_mun) > 0 || num(r.brig_semas) > 0 || num(r.brig_sema) > 0)
        ? (num(r.brig_mun) + num(r.brig_semas) + num(r.brig_sema))
        : num(r.brig);
      brig += brigVal;
    });
    const total = cbmam + fn + prevfogo + marinha + cbmsp + brig;
    return { cbmam, fn, prevfogo, marinha, cbmsp, brig, total };
  };

  // ===========================================================================
  // 🟢 MODO 3: RELATÓRIO COMPLETO DE EFETIVO (DIÁRIO × TOTAL INTEGRADO)
  // ===========================================================================
  if (mode === "completo") {
    let efDiarioList = rawEfDiario && rawEfDiario.length > 0 ? rawEfDiario : rawEfetivo || [];
    let efGeralList = rawEfGeral && rawEfGeral.length > 0 ? rawEfGeral : rawEfetivo || [];

    if (!efDiarioList.some(isBaseRow)) {
      const calc = buildEfetivoMapasData({ efetivo: efDiarioList } as any, "diario");
      efDiarioList = [...calc.municipios, ...calc.bases].map((b) => ({
        mun: b.nome,
        tipo: b.tipo,
        serv_ord: b.serv_ord,
        cbmam: b.serv_ord,
        ord: b.serv_ord,
        opamv: b.opamv,
        opam_ref: b.opam_ref,
        inc1: b.inc1,
        inc2: b.inc2,
        inc3: b.inc3,
        cbmsp: b.cbmsp,
        prevfogo: b.prevfogo,
        fn: b.fn,
        marinha: b.marinha,
        brig_mun: b.brig_mun,
        brig_semas: b.brig_semas,
        total: b.total,
        _custom: true,
      }));
    }

    if (!efGeralList.some(isBaseRow) || efGeralList === efDiarioList) {
      const calc = buildEfetivoMapasData({ efetivo: efGeralList } as any, "consolidado");
      efGeralList = [...calc.municipios, ...calc.bases].map((b) => ({
        mun: b.nome,
        tipo: b.tipo,
        serv_ord: b.serv_ord,
        cbmam: b.serv_ord,
        ord: b.serv_ord,
        opamv: b.opamv,
        opam_ref: b.opam_ref,
        inc1: b.inc1,
        inc2: b.inc2,
        inc3: b.inc3,
        cbmsp: b.cbmsp,
        prevfogo: b.prevfogo,
        fn: b.fn,
        marinha: b.marinha,
        brig_mun: b.brig_mun,
        brig_semas: b.brig_semas,
        total: b.total,
        _custom: true,
      }));
    }

    drawPageHeader(
      1,
      "RELATÓRIO COMPLETO DE EFETIVO — SALA DE SITUAÇÃO",
      "Período Consolidado:",
      `${dateStr} · ${periodStr}`,
    );

    const forcasDia = getForcasSum(efDiarioList);
    const forcasGeral = getForcasSum(efGeralList);

    // Cards do Relatório Completo
    drawCards(62, [
      {
        label: "EFETIVO TOTAL MOBILIZADO",
        value: NF.format(forcasGeral.total || forcasDia.total),
        highlight: true,
      },
      {
        label: "MILITARES CBMAM",
        value: NF.format(forcasGeral.cbmam || forcasDia.cbmam),
      },
      {
        label: "FORÇAS FEDERAIS & PARCEIROS",
        value: NF.format((forcasGeral.fn + forcasGeral.prevfogo + forcasGeral.marinha + forcasGeral.cbmsp) || (forcasDia.fn + forcasDia.prevfogo + forcasDia.marinha + forcasDia.cbmsp)),
      },
      {
        label: "BRIGADISTAS FLORESTAIS",
        value: NF.format(forcasGeral.brig || forcasDia.brig),
      },
    ]);

    // Tabela 1: Resumo Geral por Força (Esquerda, Width 260)
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
            content: "RESUMO DE EFETIVO GERAL (POR FORÇA)",
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

    const leftFinalY = (doc as any).lastAutoTable.finalY + 8;

    // Tabela Territorial (Capital vs Interior vs Bases)
    const manausDia = efDiarioList.find(isCapitalRow) ?? {};
    const basesDia = efDiarioList.filter(isBaseRow);
    const interiorDia = efDiarioList.filter((r) => !isCapitalRow(r) && !isBaseRow(r));

    const manausGeral = efGeralList.find(isCapitalRow) ?? {};
    const basesGeral = efGeralList.filter(isBaseRow);
    const interiorGeral = efGeralList.filter((r) => !isCapitalRow(r) && !isBaseRow(r));

    const sumTot = (list: any[]) => list.reduce((s, r) => s + (num(r.total) || calculateRowTotal(r, resolveEfetivoColumns(list))), 0);

    const totCapDia = sumTot([manausDia]);
    const totIntDia = sumTot(interiorDia);
    const totBaseDia = sumTot(basesDia);

    const totCapGeral = sumTot([manausGeral]);
    const totIntGeral = sumTot(interiorGeral);
    const totBaseGeral = sumTot(basesGeral);

    const resumoTerritorialBody = [
      [
        "Capital (Manaus)",
        totCapDia || "0",
        totCapGeral || "0",
        forcasGeral.total > 0 ? ((totCapGeral / forcasGeral.total) * 100).toFixed(1) + "%" : "0%",
      ],
      [
        "Interior (Municípios)",
        totIntDia || "0",
        totIntGeral || "0",
        forcasGeral.total > 0 ? ((totIntGeral / forcasGeral.total) * 100).toFixed(1) + "%" : "0%",
      ],
      [
        "Bases Avançadas / Postos",
        totBaseDia || "0",
        totBaseGeral || "0",
        forcasGeral.total > 0 ? ((totBaseGeral / forcasGeral.total) * 100).toFixed(1) + "%" : "0%",
      ],
      [
        "TOTAL GERAL",
        (totCapDia + totIntDia + totBaseDia) || "0",
        (totCapGeral + totIntGeral + totBaseGeral) || "0",
        "100.0%",
      ],
    ];

    autoTable(doc, {
      startY: leftFinalY,
      margin: { left: 16 },
      tableWidth: 260,
      head: [
        [
          {
            content: "SÍNTESE POR TERRITÓRIO (CAPITAL × INTERIOR × BASES)",
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
        ["ÂMBITO", "DIÁRIO", "TOTAIS", "PART."],
      ],
      body: resumoTerritorialBody,
      styles: {
        fontSize: 5.6,
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
        0: { fontStyle: "bold", halign: "left", cellWidth: 120 },
        1: { halign: "center", fontStyle: "bold" },
        2: { halign: "center", fontStyle: "bold", textColor: [16, 78, 46], fillColor: [235, 245, 238] },
        3: { halign: "right" },
      },
    });

    // Tabela 2: Matriz Comparativa Completa por Localidade (Direita, Width ~540)
    const efDiaMap = new Map<string, any>();
    efDiarioList.forEach((r) => {
      const m = canonicalMunicipio(r.mun || r.municipio || r.nome);
      efDiaMap.set(m.toLowerCase(), r);
    });

    const efGeralMap = new Map<string, any>();
    efGeralList.forEach((r) => {
      const m = canonicalMunicipio(r.mun || r.municipio || r.nome);
      efGeralMap.set(m.toLowerCase(), r);
    });

    const allEfMunsSet = new Set<string>();
    efGeralList.forEach((r) => allEfMunsSet.add(canonicalMunicipio(r.mun || r.municipio || r.nome)));
    efDiarioList.forEach((r) => allEfMunsSet.add(canonicalMunicipio(r.mun || r.municipio || r.nome)));

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
          content: "EFETIVO GERAL - MUNICÍPIOS (POR FORÇA)",
          colSpan: 4,
          styles: { fillColor: [BRAND_DARK.r, BRAND_DARK.g, BRAND_DARK.b], textColor: 255, halign: "center", fontStyle: "bold" },
        },
        {
          content: `EFETIVO DIÁRIO - POR MUNICÍPIO (POR FORÇA) · ${dateStr}`,
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

      const dCbmamBase = num(d.cbmam) || num(d.servico) || num(d.ord) || num(d.serv_ord);
      const dCbmam = dCbmamBase + num(d.opamv) + num(d.opam_ref) + num(d.inc1) + num(d.inc2) + num(d.inc3) + num(d.seg);
      const dFed = num(d.fn) + num(d.prevfogo) + num(d.marinha) + num(d.icmbio) + num(d.cbmsp);
      const dBrig = (num(d.brig_mun) > 0 || num(d.brig_semas) > 0 || num(d.brig_sema) > 0)
        ? (num(d.brig_mun) + num(d.brig_semas) + num(d.brig_sema))
        : num(d.brig);
      const dTot = dCbmam + dFed + dBrig;

      const gCbmamBase = num(g.cbmam) || num(g.servico) || num(g.ord) || num(g.serv_ord);
      const gCbmam = gCbmamBase + num(g.opamv) + num(g.opam_ref) + num(g.inc1) + num(g.inc2) + num(g.inc3) + num(g.seg);
      const gFed = num(g.fn) + num(g.prevfogo) + num(g.marinha) + num(g.icmbio) + num(g.cbmsp);
      const gBrig = (num(g.brig_mun) > 0 || num(g.brig_semas) > 0 || num(g.brig_sema) > 0)
        ? (num(g.brig_mun) + num(g.brig_semas) + num(g.brig_sema))
        : num(g.brig);
      const gTot = gCbmam + gFed + gBrig;

      return [
        mun,
        gCbmam || "0",
        gFed || "0",
        gBrig || "0",
        gTot || "0",
        dCbmam || "0",
        dFed || "0",
        dBrig || "0",
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
          forcasGeral.cbmam || "0",
          (forcasGeral.fn + forcasGeral.prevfogo + forcasGeral.marinha + forcasGeral.cbmsp) || "0",
          forcasGeral.brig || "0",
          forcasGeral.total || "0",
          forcasDia.cbmam || "0",
          (forcasDia.fn + forcasDia.prevfogo + forcasDia.marinha + forcasDia.cbmsp) || "0",
          forcasDia.brig || "0",
          forcasDia.total || "0",
        ],
      ],
      styles: {
        fontSize: 5.4,
        cellPadding: 1.1,
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
        0: { fontStyle: "bold", halign: "left", cellWidth: 96 },
        1: { halign: "center" },
        2: { halign: "center" },
        3: { halign: "center" },
        4: { halign: "center", fontStyle: "bold", textColor: [16, 78, 46], fillColor: [235, 245, 238] },
        5: { halign: "center" },
        6: { halign: "center" },
        7: { halign: "center" },
        8: { halign: "center", fontStyle: "bold", textColor: [16, 78, 46], fillColor: [235, 245, 238] },
      },
      didDrawPage: (data) => {
        if (data.pageNumber > 1) {
          drawPageHeader(
            data.pageNumber,
            "RELATÓRIO COMPLETO DE EFETIVO — CONTINUAÇÃO",
            "Período Consolidado:",
            `${dateStr} · ${periodStr}`,
          );
        }
      },
    });
  }

  // ===========================================================================
  // 🟢 MODO 1 E 2: RELATÓRIO DE EFETIVO DIÁRIO OU TOTAL
  // ===========================================================================
  if (mode === "diario" || mode === "total") {
    const isDiarioMode = mode === "diario";
    const titleText = isDiarioMode
      ? "RELATÓRIO DE EFETIVO DIÁRIO — SALA DE SITUAÇÃO"
      : "RELATÓRIO DE EFETIVO TOTAL — SALA DE SITUAÇÃO";

    const subLabel = isDiarioMode ? "Período Operacional:" : "Período Consolidado:";
    const subVal = isDiarioMode ? `${dateStr} — 24H` : (periodoLabel || "Operação Amazonas + Verde 2026");

    let efetivoList = deduplicateAndOrderMunicipios(rawEfetivo || []);
    if (!efetivoList.some(isBaseRow)) {
      const calc = buildEfetivoMapasData({ efetivo: efetivoList } as any, isDiarioMode ? "diario" : "consolidado");
      if (calc.bases && calc.bases.length > 0) {
        const baseRows = calc.bases.map((b) => ({
          mun: b.nome,
          tipo: "base",
          serv_ord: b.serv_ord,
          cbmam: b.serv_ord,
          ord: b.serv_ord,
          servico: b.serv_ord,
          opamv: b.opamv,
          opam_ref: b.opam_ref,
          inc1: b.inc1,
          inc2: b.inc2,
          inc3: b.inc3,
          cbmsp: b.cbmsp,
          prevfogo: b.prevfogo,
          fn: b.fn,
          marinha: b.marinha,
          seg: 0,
          brig_mun: b.brig_mun,
          brig_semas: b.brig_semas,
          total: b.total,
          _custom: true,
        }));
        efetivoList = [...efetivoList, ...baseRows];
      }
    }

    const fullCols = resolveEfetivoColumns(efetivoList);
    const activeDataCols = fullCols.filter(
      (c) => c.numeric && c.key !== "mun" && c.key !== "total" && c.key !== "cbmsp",
    );

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

    const totalCbmam = efetivoList.reduce((s, r) => s + getRowCbmam(r) + num(r.seg), 0);
    const totalFn = efetivoList.reduce((s, r) => s + num(r.fn), 0);
    const totalPrevfogo = efetivoList.reduce((s, r) => s + num(r.prevfogo), 0);
    const totalMarinha = efetivoList.reduce((s, r) => s + num(r.marinha || r.icmbio), 0);
    const totalFederais = totalFn + totalPrevfogo + totalMarinha;
    const totalBrigadistas = efetivoList.reduce(
      (s, r) => s + num(r.brig_mun) + num(r.brig_semas || r.brig_sema || r.brig),
      0,
    );

    const grandTotalEfetivo = efetivoList.reduce(
      (s, r) => s + calculateRowTotal(r, fullCols),
      0,
    );

    drawPageHeader(1, titleText, subLabel, subVal);

    // KPI Cards do Efetivo Diário / Total
    drawCards(62, [
      {
        label: "EFETIVO TOTAL MOBILIZADO",
        value: NF.format(grandTotalEfetivo),
        highlight: true,
      },
      {
        label: "MILITARES CBMAM",
        value: NF.format(totalCbmam),
      },
      {
        label: "FORÇAS FEDERAIS & PARCEIROS",
        value: NF.format(totalFederais),
      },
      {
        label: "BRIGADISTAS FLORESTAIS",
        value: NF.format(totalBrigadistas),
      },
    ]);

    // Rótulos de cabeçalho da tabela principal
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
        return v > 0 ? String(v) : "0";
      });
      const rowTot = calculateRowTotal(r, fullCols);
      return [canonicalMunicipio(r.mun || r.municipio), ...rowVals, rowTot > 0 ? String(rowTot) : "0"];
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
        ["TOTAL GERAL", ...efColTotals.map((v) => String(v || 0)), String(grandTotalEfetivo || 0)],
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
      didDrawPage: (data) => {
        if (data.pageNumber > 1) {
          drawPageHeader(data.pageNumber, `${titleText} — CONTINUAÇÃO`, subLabel, subVal);
        }
      },
    });

    // Painel Lateral Direito
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
        String(cbmamCapital || 0),
        String(opamCapital || 0),
        String(turmasCapital || 0),
        String(parceirosCapital || 0),
        String(brigCapital || 0),
        String(totalCapital || 0),
      ],
      [
        "Interior (Municípios)",
        String(cbmamInterior || 0),
        String(opamInterior || 0),
        String(turmasInterior || 0),
        String(parceirosInterior || 0),
        String(brigInterior || 0),
        String(totalInterior || 0),
      ],
      [
        "Bases Avançadas / Postos",
        String(cbmamBases || 0),
        String(opamBases || 0),
        String(turmasBases || 0),
        String(parceirosBases || 0),
        String(brigBases || 0),
        String(totalBases || 0),
      ],
      [
        "TOTAL GERAL",
        String((cbmamCapital + cbmamInterior + cbmamBases) || 0),
        String((opamCapital + opamInterior + opamBases) || 0),
        String((turmasCapital + turmasInterior + turmasBases) || 0),
        String((parceirosCapital + parceirosInterior + parceirosBases) || 0),
        String((brigCapital + brigInterior + brigBases) || 0),
        String(grandTotalEfetivo || 0),
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

    const totalCbmsp = efetivoList.reduce((s, r) => s + num(r.cbmsp), 0);
    const totalBrig = totalBrigadistas;

    const tropasFederaisBody = [
      ["Corpo de Bombeiros Militar do AM (CBMAM)", String(totalCbmam || 0), grandTotalEfetivo > 0 ? ((totalCbmam / grandTotalEfetivo) * 100).toFixed(1) + "%" : "0%"],
      ["Força Nacional de Segurança Pública (FN)", String(totalFn || 0), grandTotalEfetivo > 0 ? ((totalFn / grandTotalEfetivo) * 100).toFixed(1) + "%" : "0%"],
      ["IBAMA / PREVFOGO (Brigadas Federais)", String(totalPrevfogo || 0), grandTotalEfetivo > 0 ? ((totalPrevfogo / grandTotalEfetivo) * 100).toFixed(1) + "%" : "0%"],
      ["Marinha do Brasil & ICMBio", String(totalMarinha || 0), grandTotalEfetivo > 0 ? ((totalMarinha / grandTotalEfetivo) * 100).toFixed(1) + "%" : "0%"],
      ["Corpo de Bombeiros da PMESP (CBMSP)", String(totalCbmsp || 0), grandTotalEfetivo > 0 ? ((totalCbmsp / grandTotalEfetivo) * 100).toFixed(1) + "%" : "0%"],
      ["Brigadas Civis Municipais & SEMA", String(totalBrig || 0), grandTotalEfetivo > 0 ? ((totalBrig / grandTotalEfetivo) * 100).toFixed(1) + "%" : "0%"],
      ["TOTAL FORÇA INTEGRADA MOBILIZADA", String(grandTotalEfetivo || 0), "100.0%"],
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
  }

  // ===========================================================================
  // ✍️ ASSINATURA OFICIAL DO OPERADOR DA SALA NA ÚLTIMA PÁGINA
  // ===========================================================================
  const lastPageNum = (doc as any).internal.getNumberOfPages();
  doc.setPage(lastPageNum);
  const sigY = pageH - 46;

  doc.setDrawColor(BRAND_DARK.r, BRAND_DARK.g, BRAND_DARK.b);
  doc.setLineWidth(0.6);
  doc.line(pageW / 2 - 180, sigY - 10, pageW / 2 + 180, sigY - 10);

  // Nome de Guerra do Operador da Sala
  doc.setFont("helvetica", "bold");
  doc.setFontSize(9);
  doc.setTextColor(BRAND_DARK.r, BRAND_DARK.g, BRAND_DARK.b);
  doc.text(operador, pageW / 2, sigY - 1, { align: "center" });

  doc.setFont("helvetica", "bold");
  doc.setFontSize(7.5);
  doc.setTextColor(BRAND_DARK.r, BRAND_DARK.g, BRAND_DARK.b);
  doc.text("SALA DE SITUAÇÃO — CBMAM", pageW / 2, sigY + 9, { align: "center" });

  doc.setFont("helvetica", "normal");
  doc.setFontSize(6.8);
  doc.setTextColor(80, 90, 85);
  doc.text("Responsável pelo Preenchimento · Comando Operacional Integrado", pageW / 2, sigY + 18, { align: "center" });

  // ---------------------------------------------------------------------------
  // RODAPÉ E AUTENTICAÇÃO OFICIAL EM TODAS AS PÁGINAS
  // ---------------------------------------------------------------------------
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
      "Corpo de Bombeiros Militar do Estado do Amazonas · Sala de Situação · Relatório Oficial de Efetivo",
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
