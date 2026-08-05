import { manausFirstSheets } from "./municipio-order";
import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";
import type { SheetsData } from "./sheets.types";
import { NF } from "./formatters";
import { fmtDateBR, fmtDateLong, fmtDateStamp, filterOccurrencesByDate } from "./report-date";
import { CBMAM_LOGO_BASE64 } from "./cbmam-logo";

/** Filename convention used by both preview and download. */
export function reportFilename(reportDate: Date | null, generatedAt: Date = new Date()) {
  const suffix = reportDate ? `-${fmtDateStamp(reportDate)}` : `-${fmtDateStamp(generatedAt)}`;
  return `relatorio-operacional-cbmam${suffix}.pdf`;
}

// Institutional palette (CBMAM / Amazonas + Verde)
const BRAND = { r: 8, g: 46, b: 31 }; // deep forest green
const BRAND_LIGHT = { r: 24, g: 96, b: 54 };
const GOLD = { r: 201, g: 168, b: 76 };
const INK = { r: 20, g: 20, b: 20 };
const MUTED = { r: 110, g: 118, b: 128 };
const ROW_ALT = { r: 244, g: 251, b: 246 };

export type PdfQuality = "standard" | "high";

/**
 * Font/padding scaling for the "high legibility" export. Vector output stays
 * crisp at any zoom, so quality here means larger glyphs and roomier cells
 * — not more raster DPI.
 */
function qualityScale(q: PdfQuality) {
  return q === "high"
    ? { body: 9, head: 8.5, cellPad: 5, metaBody: 9, titleBar: 10 }
    : { body: 7, head: 7, cellPad: 3.5, metaBody: 8, titleBar: 9 };
}

/**
 * Generates the official operational report PDF.
 * `reportDate` (optional) sets the operational date printed on the cover
 * and filters daily occurrences to that day.
 */
export function exportSheetsToPdf(
  data: SheetsData,
  reportDate: Date | null = null,
  quality: PdfQuality = "standard",
) {
  const doc = buildSheetsPdfDoc(data, reportDate, quality);
  doc.save(reportFilename(reportDate));
}

/**
 * Builds the official operational report and returns the jsPDF instance
 * WITHOUT saving it. Used by both the download flow (which saves) and the
 * WYSIWYG preview dialog (which streams it into an iframe via a blob URL).
 */
export function buildSheetsPdfDoc(
  rawData: SheetsData,
  reportDate: Date | null = null,
  quality: PdfQuality = "standard",
): jsPDF {
  // Manaus (capital) sempre na primeira linha de todas as tabelas.
  const data = manausFirstSheets(rawData);
  const Q = qualityScale(quality);
  const doc = new jsPDF({ orientation: "landscape", unit: "pt", format: "a4" });
  const pageW = doc.internal.pageSize.getWidth();
  const pageH = doc.internal.pageSize.getHeight();
  const header = data.header ?? {};
  const generatedAt = new Date();
  const opDate = reportDate ?? generatedAt;

  const { rows: occurrencesForDay, filtered: occurrencesFiltered } = filterOccurrencesByDate(
    data.occurrences,
    reportDate,
  );

  // ---------- Institutional header ----------
  const drawInstitutionalHeader = () => {
    // Top gold rule
    doc.setFillColor(GOLD.r, GOLD.g, GOLD.b);
    doc.rect(0, 0, pageW, 3, "F");
    // Main green band
    doc.setFillColor(BRAND.r, BRAND.g, BRAND.b);
    doc.rect(0, 3, pageW, 82, "F");
    // Diagonal accent
    doc.setFillColor(BRAND_LIGHT.r, BRAND_LIGHT.g, BRAND_LIGHT.b);
    doc.triangle(pageW - 220, 3, pageW, 3, pageW, 85, "F");

    // Official CBMAM Emblem (Brasão)
    try {
      doc.addImage(CBMAM_LOGO_BASE64, "PNG", 24, 12, 48, 56);
    } catch {
      // Fallback ring if image fails
      const cx = 46;
      const cy = 44;
      doc.setDrawColor(GOLD.r, GOLD.g, GOLD.b);
      doc.setLineWidth(1.5);
      doc.circle(cx, cy, 22, "S");
    }

    // Titles
    doc.setTextColor(255, 255, 255);
    doc.setFont("helvetica", "bold");
    doc.setFontSize(13);
    doc.text("CORPO DE BOMBEIROS MILITAR DO AMAZONAS", 84, 32);
    doc.setFont("helvetica", "normal");
    doc.setFontSize(9.5);
    doc.text("Operação Amazonas + Verde", 84, 48);

    // Right side — document identification
    doc.setFont("helvetica", "bold");
    doc.setFontSize(9);
    doc.text("RELATÓRIO OPERACIONAL DIÁRIO", pageW - 20, 22, { align: "right" });
    doc.setFont("helvetica", "normal");
    doc.setFontSize(8);
    doc.text(`Data operacional: ${fmtDateBR(opDate)}`, pageW - 20, 36, { align: "right" });
    doc.text(`Emitido em: ${generatedAt.toLocaleString("pt-BR")}`, pageW - 20, 48, {
      align: "right",
    });
    doc.text("Documento oficial — uso restrito", pageW - 20, 60, { align: "right" });

    doc.setTextColor(INK.r, INK.g, INK.b);
  };

  // ---------- Cover metadata block (only page 1) ----------
  drawInstitutionalHeader();

  // Report title
  doc.setFont("helvetica", "bold");
  doc.setFontSize(14);
  doc.setTextColor(INK.r, INK.g, INK.b);
  doc.text(header.titulo || "RELATÓRIO DE OCORRÊNCIAS", 40, 112);
  doc.setDrawColor(GOLD.r, GOLD.g, GOLD.b);
  doc.setLineWidth(1);
  doc.line(40, 118, 200, 118);

  doc.setFont("helvetica", "normal");
  doc.setFontSize(9);
  doc.setTextColor(INK.r, INK.g, INK.b);

  // Two-column meta table
  const metaLeft: [string, string][] = [
    ["Período Operacional", header.periodo ?? "—"],
    ["Próximo Período", header.proximoPeriodo ?? "—"],
    ["Reunião de Planejamento", header.reuniaoPlanejamento ?? "—"],
    ["Reunião de Briefing", header.reuniaoBriefing ?? "—"],
  ];
  const metaRight: [string, string][] = [
    ["Comandante do Incidente", header.comandante ?? "—"],
    ["Chefe de Operações — Capital", header.chefeCapital ?? "—"],
    ["Chefe de Operações — Interior", header.chefeInterior ?? "—"],
    ["Coordenador — Sala de Situação", header.coordSituacao ?? "—"],
  ];

  autoTable(doc, {
    startY: 144,
    body: metaLeft,
    theme: "plain",
    styles: { fontSize: Q.metaBody, cellPadding: { top: 3, right: 4, bottom: 3, left: 4 } },
    columnStyles: {
      0: { fontStyle: "bold", textColor: [MUTED.r, MUTED.g, MUTED.b], cellWidth: 130 },
      1: { textColor: [INK.r, INK.g, INK.b] },
    },
    margin: { left: 40, right: pageW / 2 + 10 },
    tableWidth: pageW / 2 - 50,
  });
  autoTable(doc, {
    startY: 144,
    body: metaRight,
    theme: "plain",
    styles: { fontSize: Q.metaBody, cellPadding: { top: 3, right: 4, bottom: 3, left: 4 } },
    columnStyles: {
      0: { fontStyle: "bold", textColor: [MUTED.r, MUTED.g, MUTED.b], cellWidth: 150 },
      1: { textColor: [INK.r, INK.g, INK.b] },
    },
    margin: { left: pageW / 2 + 10, right: 40 },
    tableWidth: pageW / 2 - 50,
  });

  let cursorY = Math.max((doc as any).lastAutoTable?.finalY ?? 220, 220) + 18;

  // Vertical reserved zones so autoTable never collides with the
  // institutional header (top) or footer (bottom).
  const HEADER_RESERVED = 100;
  const FOOTER_RESERVED = 40;

  // ---------- Section renderer ----------
  // Each section is rendered as an INDEPENDENT block: it always starts on
  // a fresh page (after the cover), so it never shares a page with another
  // section and its title/header/body stay visually cohesive. If the section
  // itself is larger than a single page, autoTable paginates it and the
  // section title bar + institutional header are reprinted on every
  // continuation page so the block reads as one continuous unit.
  let sectionsRendered = 0;

  const drawSectionTitleBar = (
    romanIndex: string,
    title: string,
    subtitle: string,
    y: number,
    continuation = false,
  ) => {
    doc.setFillColor(BRAND.r, BRAND.g, BRAND.b);
    doc.rect(20, y, pageW - 40, 20, "F");
    doc.setFillColor(GOLD.r, GOLD.g, GOLD.b);
    doc.rect(20, y, 4, 20, "F");
    doc.setTextColor(255, 255, 255);
    doc.setFont("helvetica", "bold");
    doc.setFontSize(Q.titleBar);
    const label = `${romanIndex}  ·  ${title.toUpperCase()}${continuation ? "  (continuação)" : ""}`;
    doc.text(label, 32, y + 13);
    if (subtitle) {
      doc.setFont("helvetica", "normal");
      doc.setFontSize(7.5);
      doc.setTextColor(220, 235, 225);
      doc.text(subtitle, pageW - 28, y + 13, { align: "right" });
    }
    doc.setTextColor(INK.r, INK.g, INK.b);
  };

  const addSection = (
    romanIndex: string,
    title: string,
    subtitle: string,
    cols: { key: string; label: string; numeric?: boolean }[],
    rows: any[],
  ) => {
    if (!rows?.length) return;

    // Always start a new page for each section (except the first, which
    // continues right after the cover metadata block if there's room).
    if (sectionsRendered > 0 || cursorY > pageH - HEADER_RESERVED - 80) {
      doc.addPage();
      drawInstitutionalHeader();
      cursorY = HEADER_RESERVED;
    }

    // Reserved space for the section title bar on each page of this section.
    const SECTION_TITLE_H = 22;

    // Draw the title bar for the first page of the section.
    drawSectionTitleBar(romanIndex, title, subtitle, cursorY);
    const bodyStartY = cursorY + SECTION_TITLE_H;

    let lastDrawnPage = (doc as any).internal.getCurrentPageInfo().pageNumber;
    const sectionStartPage = lastDrawnPage;

    const tableBody = rows.map((r) =>
      cols.map((c) => {
        if (c.key === "total" && c.numeric === true) {
          const rowTotal = cols
            .filter(
              (col) =>
                col.numeric &&
                col.key !== "total" &&
                col.key !== "total_periodo" &&
                col.key !== "focos" &&
                col.key !== "sat" &&
                col.key !== "area",
            )
            .reduce((s, col) => s + (Number(r[col.key]) || 0), 0);
          return NF.format(rowTotal);
        }
        return c.numeric ? NF.format(Number(r[c.key]) || 0) : String(r[c.key] ?? "");
      }),
    );

    // Add footer total row if there are multiple columns and numeric values
    const numericCols = cols.filter((c) => c.numeric);
    if (numericCols.length > 0 && rows.length > 0) {
      const footerRow = cols.map((c, i) => {
        if (i === 0) return "TOTAL";
        if (c.numeric) {
          const sum = rows.reduce((acc, r) => {
            if (c.key === "total") {
              return (
                acc +
                cols
                  .filter(
                    (col) =>
                      col.numeric &&
                      col.key !== "total" &&
                      col.key !== "total_periodo" &&
                      col.key !== "focos" &&
                      col.key !== "sat" &&
                      col.key !== "area",
                  )
                  .reduce((s, col) => s + (Number(r[col.key]) || 0), 0)
              );
            }
            return acc + (Number(r[c.key]) || 0);
          }, 0);
          return NF.format(sum);
        }
        return "";
      });
      tableBody.push(footerRow);
    }

    autoTable(doc, {
      startY: bodyStartY,
      head: [cols.map((c) => c.label)],
      body: tableBody,
      styles: {
        fontSize: Q.body,
        cellPadding: Q.cellPad,
        lineColor: [220, 226, 222],
        lineWidth: 0.25,
        overflow: "linebreak",
        valign: "middle",
      },
      headStyles: {
        fillColor: [BRAND_LIGHT.r, BRAND_LIGHT.g, BRAND_LIGHT.b],
        textColor: 255,
        fontStyle: "bold",
        fontSize: Q.head,
        halign: "center",
      },
      bodyStyles: { textColor: [INK.r, INK.g, INK.b] },
      alternateRowStyles: { fillColor: [ROW_ALT.r, ROW_ALT.g, ROW_ALT.b] },
      columnStyles: Object.fromEntries(
        cols.map((c, i) => {
          const style: any = { halign: c.numeric ? "right" : "left" };
          const col0Width = cols.length > 15 ? 85 : 130;
          if (i === 0) {
            style.cellWidth = col0Width;
          } else {
            style.cellWidth = (555.28 - col0Width) / (cols.length - 1);
          }
          return [i, style];
        }),
      ),
      // Reserve room at the top of every continuation page for the reprinted
      // institutional header + the section title bar, so the block stays
      // visually contiguous across page breaks.
      margin: {
        left: 20,
        right: 20,
        top: HEADER_RESERVED + SECTION_TITLE_H,
        bottom: FOOTER_RESERVED,
      },
      showHead: "everyPage",
      rowPageBreak: "avoid",
      pageBreak: "auto",
      didDrawPage: (hookData: any) => {
        const current = hookData.pageNumber;
        if (current > sectionStartPage && current !== lastDrawnPage) {
          // Continuation page: reprint institutional header and section bar with (continuação).
          drawInstitutionalHeader();
          drawSectionTitleBar(romanIndex, title, subtitle, HEADER_RESERVED, true);
          lastDrawnPage = current;
        }
      },
    });

    cursorY = (doc as any).lastAutoTable.finalY + 16;
    sectionsRendered += 1;
    // Silence unused variable lint while keeping section boundary intent clear.
    void sectionStartPage;
  };

  addSection(
    "I",
    "Efetivo empregado",
    "Distribuição por município",
    [
      { key: "mun", label: "Município" },
      { key: "ord", label: "Serv. Ordinário", numeric: true },
      { key: "seg", label: "SEG", numeric: true },
      { key: "brig", label: "Brigadista", numeric: true },
      { key: "total", label: "Total", numeric: true },
    ],
    data.efetivo,
  );

  addSection(
    "II",
    "Recursos empregados",
    "Meios materiais em campo",
    [
      { key: "mun", label: "Município" },
      { key: "abt", label: "ABT", numeric: true },
      { key: "at", label: "AT", numeric: true },
      { key: "aem", label: "AEM", numeric: true },
      { key: "atp", label: "ATP", numeric: true },
      { key: "ata", label: "ATA", numeric: true },
      { key: "abf", label: "ABF", numeric: true },
      { key: "atf", label: "ATF", numeric: true },
      { key: "abs", label: "ABS", numeric: true },
      { key: "pipa", label: "Pipa", numeric: true },
      { key: "dosa", label: "DOSA", numeric: true },
      { key: "crs", label: "CRS", numeric: true },
      { key: "ar", label: "AR", numeric: true },
      { key: "ur", label: "UR", numeric: true },
      { key: "gse", label: "GSE", numeric: true },
      { key: "mt", label: "MT", numeric: true },
      { key: "ta", label: "TA", numeric: true },
      { key: "quadriciclo", label: "Quadric.", numeric: true },
      { key: "embarcacao", label: "Embarc.", numeric: true },
      { key: "picape_fn", label: "Pic.FN", numeric: true },
      { key: "picape_muni", label: "Pic.MUNI", numeric: true },
      { key: "autoarp", label: "Autoarp", numeric: true },
      { key: "picape_esfron", label: "Pic.ESFRON", numeric: true },
      { key: "helicoptero", label: "Helic.", numeric: true },
      { key: "aviao", label: "Avião", numeric: true },
      { key: "jetski", label: "Jet Ski", numeric: true },
      { key: "total", label: "Total", numeric: true },
    ],
    data.recursos,
  );

  addSection(
    "III",
    "Incêndios do dia",
    "Ocorrências registradas nas últimas 24h",
    [
      { key: "mun", label: "Município" },
      { key: "urb", label: "Urbanos", numeric: true },
      { key: "flor", label: "Florestais", numeric: true },
      { key: "focos", label: "Focos", numeric: true },
      { key: "total", label: "Total", numeric: true },
    ],
    data.incendios_diario,
  );

  addSection(
    "IV",
    "Incêndios acumulados",
    "Consolidado do período",
    [
      { key: "mun", label: "Município" },
      { key: "urb", label: "Urbanos", numeric: true },
      { key: "flor", label: "Florestais", numeric: true },
      { key: "focos", label: "Focos", numeric: true },
      { key: "sat", label: "Satélite", numeric: true },
      { key: "area", label: "Área (m²)", numeric: true },
      { key: "total", label: "Total", numeric: true },
    ],
    data.incendios_acumulado,
  );

  addSection(
    "V",
    "Ocorrências do dia",
    "Salvamento, APH, prevenção e serviços",
    [
      { key: "mun", label: "Município" },
      { key: "salvamento", label: "Salvamento", numeric: true },
      { key: "acidentes", label: "Acidentes", numeric: true },
      { key: "aph", label: "APH", numeric: true },
      { key: "prevencao", label: "Prevenção", numeric: true },
      { key: "servicos", label: "Serviços", numeric: true },
      { key: "total", label: "Total", numeric: true },
    ],
    data.outras_diarias,
  );

  addSection(
    "VI",
    "Ocorrências detalhadas",
    occurrencesFiltered
      ? `Filtrado por ${fmtDateBR(opDate)} — ${occurrencesForDay.length} registro(s)`
      : `${occurrencesForDay.length} registro(s)`,
    [
      { key: "data", label: "Data" },
      { key: "municipio", label: "Município" },
      { key: "horario", label: "Horário" },
      { key: "natureza", label: "Natureza" },
      { key: "endereco", label: "Endereço" },
      { key: "area", label: "Área (m²)", numeric: true },
      { key: "agua", label: "Água (L)", numeric: true },
    ],
    occurrencesForDay,
  );

  // ---------- Signature block ----------
  if (cursorY > pageH - 160) {
    doc.addPage();
    drawInstitutionalHeader();
    cursorY = 120;
  } else {
    cursorY += 20;
  }

  doc.setDrawColor(GOLD.r, GOLD.g, GOLD.b);
  doc.setLineWidth(0.5);
  doc.line(40, cursorY, pageW - 40, cursorY);
  cursorY += 22;

  doc.setFontSize(9);
  doc.setFont("helvetica", "bold");
  doc.setTextColor(INK.r, INK.g, INK.b);
  doc.text("AUTENTICAÇÃO DO DOCUMENTO", pageW / 2, cursorY, { align: "center" });
  cursorY += 32;

  const sigWidth = (pageW - 120) / 2;
  const drawSig = (x: number, name: string, role: string) => {
    doc.setDrawColor(60, 60, 60);
    doc.setLineWidth(0.5);
    doc.line(x, cursorY, x + sigWidth, cursorY);
    doc.setFont("helvetica", "bold");
    doc.setFontSize(9);
    doc.setTextColor(INK.r, INK.g, INK.b);
    doc.text(name || "—", x + sigWidth / 2, cursorY + 14, { align: "center" });
    doc.setFont("helvetica", "normal");
    doc.setFontSize(7.5);
    doc.setTextColor(MUTED.r, MUTED.g, MUTED.b);
    doc.text(role, x + sigWidth / 2, cursorY + 24, { align: "center" });
  };
  drawSig(40, header.comandante ?? "", "Comandante do Incidente");
  drawSig(pageW / 2 + 20, header.coordSituacao ?? "", "Coordenador — Sala de Situação");

  // ---------- Footer on every page ----------
  const pageCount = (doc as any).internal.getNumberOfPages();
  for (let i = 1; i <= pageCount; i++) {
    doc.setPage(i);
    // Footer rule
    doc.setDrawColor(BRAND.r, BRAND.g, BRAND.b);
    doc.setLineWidth(0.4);
    doc.line(20, pageH - 28, pageW - 20, pageH - 28);

    doc.setFont("helvetica", "normal");
    doc.setFontSize(7.5);
    doc.setTextColor(MUTED.r, MUTED.g, MUTED.b);
    doc.text(`Página ${i} de ${pageCount}`, pageW - 20, pageH - 14, { align: "right" });
  }

  return doc;
}
