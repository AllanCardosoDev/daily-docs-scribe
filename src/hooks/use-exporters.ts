import { useCallback } from "react";
import { toast } from "sonner";
import type { SheetsData } from "@/lib/sheets.types";
import type { ComparisonResult } from "@/lib/comparison";
import { validateForExport, formatIssues, sanitizeSheetsData } from "@/lib/report-validation";
import type { PdfQuality } from "@/lib/export-pdf";
import { fmtDateBR } from "@/lib/report-date";

/**
 * Wires the Excel + PDF export handlers with lazy loading (the export
 * libraries are heavy — deferred until the user triggers an export).
 * `reportDate` (optional) is the operational date the report reflects; when
 * provided it filters daily occurrences and stamps the document header.
 * `endDate` (optional) is the end date for a consolidated period.
 * `quality` controls font/padding scaling of the generated PDF ("high"
 * yields larger glyphs and roomier cells for better legibility).
 */
export function useExporters(
  data: SheetsData | undefined,
  reportDate: Date | null = null,
  quality: PdfQuality = "standard",
  comparisonData?: ComparisonResult,
  endDate?: Date | null,
) {
  const isRange = Boolean(
    endDate &&
      reportDate &&
      reportDate.toISOString().slice(0, 10) !== endDate.toISOString().slice(0, 10),
  );

  const periodoLabel = isRange
    ? `${fmtDateBR(reportDate!)} a ${fmtDateBR(endDate!)}`
    : reportDate
    ? fmtDateBR(reportDate)
    : "Data de Hoje";

  const getCleanDataWithPeriod = useCallback(() => {
    if (!data) return undefined;
    const clean = sanitizeSheetsData(data);
    if (isRange) {
      return {
        ...clean,
        isRange: true,
        header: {
          ...clean.header,
          titulo: clean.header?.titulo || "Relatório Consolidado de Período",
          periodo: clean.header?.periodo || periodoLabel,
        },
      };
    }
    return clean;
  }, [data, isRange, periodoLabel]);

  const exportXlsx = useCallback(async () => {
    if (!data) return;
    try {
      const cleanData = getCleanDataWithPeriod()!;
      const { exportSheetsToXlsx } = await import("@/lib/export-xlsx");
      exportSheetsToXlsx(cleanData, reportDate, undefined, comparisonData);
      toast.success("Excel gerado. Verifique seus downloads.");
    } catch (e) {
      toast.error("Falha ao gerar Excel", { description: (e as Error)?.message });
    }
  }, [data, reportDate, comparisonData, getCleanDataWithPeriod]);

  const exportPdf = useCallback(async () => {
    if (!data) return;

    // Autocorrige e sanitiza quaisquer células negativas ou valores ausentes
    const cleanData = getCleanDataWithPeriod()!;
    const check = validateForExport(cleanData);
    if (!check.ok) {
      toast.error("Não é possível gerar o PDF oficial", {
        description: formatIssues(check.issues),
        duration: 8000,
      });
      return;
    }

    try {
      const { exportSheetsToPdf } = await import("@/lib/export-pdf");
      exportSheetsToPdf(cleanData, reportDate, quality, comparisonData);
      toast.success(
        quality === "high"
          ? "PDF em alta legibilidade gerado."
          : "PDF gerado. Verifique seus downloads.",
      );
    } catch (e) {
      toast.error("Falha ao gerar PDF", { description: (e as Error)?.message });
    }
  }, [data, reportDate, quality, comparisonData, getCleanDataWithPeriod]);

  const exportEfetivoPdf = useCallback(async () => {
    if (!data) return;
    try {
      const cleanData = getCleanDataWithPeriod()!;
      const { exportEfetivoPdf: runExport } = await import("@/lib/export-efetivo-pdf");
      runExport({
        efetivo: cleanData.efetivo || [],
        periodoLabel,
        reportDate,
        comandante: cleanData.header?.comandante,
        coordenador: cleanData.header?.coordenador,
      });
      toast.success("Relatório Oficial do Efetivo (PDF) gerado com sucesso!", {
        description: `Período: ${periodoLabel}`,
      });
    } catch (e) {
      toast.error("Falha ao gerar Relatório do Efetivo", { description: (e as Error)?.message });
    }
  }, [data, reportDate, periodoLabel, getCleanDataWithPeriod]);

  const exportMunicipioPdf = useCallback(async (municipioName: string) => {
    if (!data) return;
    try {
      const cleanData = sanitizeSheetsData(data);
      const { exportMunicipioToPdf } = await import("@/lib/export-municipio");
      exportMunicipioToPdf(cleanData, municipioName, reportDate);
      toast.success(`PDF de ${municipioName} gerado.`);
    } catch (e) {
      toast.error("Falha ao gerar PDF do município");
    }
  }, [data, reportDate]);

  const exportMunicipioCsv = useCallback(async (municipioName: string) => {
    if (!data) return;
    try {
      const cleanData = sanitizeSheetsData(data);
      const { exportMunicipioToCsv } = await import("@/lib/export-municipio");
      exportMunicipioToCsv(cleanData, municipioName, reportDate);
      toast.success(`CSV de ${municipioName} gerado.`);
    } catch (e) {
      toast.error("Falha ao gerar CSV do município");
    }
  }, [data, reportDate]);

  const exportEfetivoMapasXlsx = useCallback(async () => {
    if (!data) return;
    try {
      const { exportEfetivoMapasXlsx } = await import("@/lib/efetivo-mapas");
      exportEfetivoMapasXlsx(data, reportDate);
      toast.success("Planilha de Efetivo (Mapas) gerada com sucesso!");
    } catch (e) {
      toast.error("Falha ao exportar Efetivo", { description: (e as Error)?.message });
    }
  }, [data, reportDate]);

  const exportEfetivoMapasJson = useCallback(async () => {
    if (!data) return;
    try {
      const { exportEfetivoMapasJson } = await import("@/lib/efetivo-mapas");
      exportEfetivoMapasJson(data, reportDate);
      toast.success("JSON de Efetivo para o Mapas exportado com sucesso!");
    } catch (e) {
      toast.error("Falha ao exportar JSON de Efetivo", { description: (e as Error)?.message });
    }
  }, [data, reportDate]);

  return {
    exportXlsx,
    exportPdf,
    exportEfetivoPdf,
    exportMunicipioPdf,
    exportMunicipioCsv,
    exportEfetivoMapasXlsx,
    exportEfetivoMapasJson,
  };
}
