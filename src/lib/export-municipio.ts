import * as XLSX from "xlsx";
import { jsPDF } from "jspdf";
import autoTable from "jspdf-autotable";
import type { SheetsData } from "./sheets.types";
import { manausFirstSheets } from "./municipio-order";
import { fmtDateBR } from "./report-date";
import { CBMAM_LOGO_BASE64 } from "./cbmam-logo";

/**
 * Filtra os dados de um único município para exportação isolada.
 */
function getMunicipioSpecificData(data: SheetsData, municipioName: string): SheetsData {
  const normalize = (s: string) =>
    s.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase();
  const target = normalize(municipioName);

  return {
    header: data.header,
    efetivo: data.efetivo.filter((r) => normalize(r.mun || "") === target),
    recursos: data.recursos.filter((r) => normalize(r.mun || "") === target),
    incendios_diario: data.incendios_diario.filter((r) => normalize(r.mun || "") === target),
    incendios_acumulado: data.incendios_acumulado.filter((r) => normalize(r.mun || "") === target),
    outras_diarias: data.outras_diarias.filter((r) => normalize(r.mun || "") === target),
    occurrences: data.occurrences.filter((r) => normalize(r.municipio || "") === target),
    isRange: data.isRange,
    startDate: data.startDate,
    endDate: data.endDate,
  };
}

export function exportMunicipioToPdf(data: SheetsData, municipioName: string, reportDate: Date | null = null) {
  const munData = getMunicipioSpecificData(data, municipioName);
  const doc = new jsPDF({ orientation: "portrait", unit: "pt", format: "a4" });
  const pageW = doc.internal.pageSize.getWidth();
  const opDateStr = reportDate ? fmtDateBR(reportDate) : (munData.startDate || new Date().toLocaleDateString("pt-BR"));

  // Header
  doc.setFillColor(8, 46, 31);
  doc.rect(0, 0, pageW, 60, "F");
  try {
    doc.addImage(CBMAM_LOGO_BASE64, "PNG", 20, 10, 40, 40);
  } catch (e) {}
  
  doc.setTextColor(255, 255, 255);
  doc.setFontSize(12);
  doc.setFont("helvetica", "bold");
  doc.text("CBMAM - RELATÓRIO POR MUNICÍPIO", pageW / 2, 25, { align: "center" });
  doc.setFontSize(14);
  doc.text(municipioName.toUpperCase(), pageW / 2, 45, { align: "center" });

  doc.setTextColor(0, 0, 0);
  doc.setFontSize(10);
  doc.text(`Data: ${opDateStr}`, 20, 80);

  let finalY = 100;

  // Efetivo
  if (munData.efetivo.length > 0) {
    doc.setFont("helvetica", "bold");
    doc.text("EFETIVO OPERACIONAL", 20, finalY);
    autoTable(doc, {
      startY: finalY + 10,
      head: [["Ord. Público", "Seg. Presidencial", "Brigadistas", "Total"]],
      body: munData.efetivo.map(r => [r.ord, r.seg, r.brig, Number(r.ord) + Number(r.seg) + Number(r.brig)]),
      theme: "striped",
      headStyles: { fillColor: [16, 78, 46] }
    });
    finalY = (doc as any).lastAutoTable.finalY + 30;
  }

  // Incêndios
  if (munData.incendios_diario.length > 0) {
    doc.setFont("helvetica", "bold");
    doc.text("INCÊNDIOS (DIÁRIO)", 20, finalY);
    autoTable(doc, {
      startY: finalY + 10,
      head: [["Urbanos", "Florestais", "Focos", "Total"]],
      body: munData.incendios_diario.map(r => [r.urb, r.flor, r.focos, Number(r.urb) + Number(r.flor)]),
      theme: "striped",
      headStyles: { fillColor: [185, 28, 28] }
    });
    finalY = (doc as any).lastAutoTable.finalY + 30;
  }

  // Outras Ocorrências
  if (munData.outras_diarias.length > 0) {
    doc.setFont("helvetica", "bold");
    doc.text("OUTRAS NATUREZAS", 20, finalY);
    autoTable(doc, {
      startY: finalY + 10,
      head: [["Salv.", "Acid.", "APH", "Prev.", "Serv.", "Total"]],
      body: munData.outras_diarias.map(r => [r.salvamento, r.acidentes, r.aph, r.prevencao, r.servicos, 
        Number(r.salvamento) + Number(r.acidentes) + Number(r.aph) + Number(r.prevencao) + Number(r.servicos)]),
      theme: "striped",
      headStyles: { fillColor: [28, 78, 128] }
    });
    finalY = (doc as any).lastAutoTable.finalY + 30;
  }

  doc.save(`relatorio-${municipioName.toLowerCase()}-${opDateStr.replace(/\//g, "-")}.pdf`);
}

export function exportMunicipioToCsv(data: SheetsData, municipioName: string, reportDate: Date | null = null) {
  const munData = getMunicipioSpecificData(data, municipioName);
  const wb = XLSX.utils.book_new();
  const opDateStr = reportDate ? fmtDateBR(reportDate) : (munData.startDate || "atual");

  // Flat data for CSV
  const flatData = [
    ["Município", municipioName],
    ["Data Referência", opDateStr],
    [],
    ["CATEGORIA", "TIPO", "VALOR"],
  ];

  munData.efetivo.forEach(r => {
    flatData.push(["EFETIVO", "Ordinário", String(r.ord)]);
    flatData.push(["EFETIVO", "Segurança", String(r.seg)]);
    flatData.push(["EFETIVO", "Brigadista", String(r.brig)]);
  });

  munData.incendios_diario.forEach(r => {
    flatData.push(["INCÊNDIO", "Urbano", String(r.urb)]);
    flatData.push(["INCÊNDIO", "Florestal", String(r.flor)]);
    flatData.push(["INCÊNDIO", "Focos", String(r.focos)]);
  });

  munData.outras_diarias.forEach(r => {
    flatData.push(["OUTRAS", "Salvamento", String(r.salvamento)]);
    flatData.push(["OUTRAS", "Acidentes", String(r.acidentes)]);
    flatData.push(["OUTRAS", "APH", String(r.aph)]);
    flatData.push(["OUTRAS", "Prevenção", String(r.prevencao)]);
    flatData.push(["OUTRAS", "Serviços", String(r.servicos)]);
  });

  const ws = XLSX.utils.aoa_to_sheet(flatData);
  XLSX.utils.book_append_sheet(wb, ws, "Dados");
  XLSX.writeFile(wb, `dados-${municipioName.toLowerCase()}-${opDateStr.replace(/\//g, "-")}.csv`, { bookType: "csv" });
}
