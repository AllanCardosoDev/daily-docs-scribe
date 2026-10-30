import { useCallback } from "react";
import { toast } from "sonner";
import type { SheetsData } from "@/lib/sheets.types";
import type { ComparisonResult } from "@/lib/comparison";
import { validateForExport, formatIssues, sanitizeSheetsData } from "@/lib/report-validation";
import type { PdfQuality } from "@/lib/export-pdf";


/**
 * Wires the Excel + PDF export handlers with lazy loading (the export
 * libraries are heavy — deferred until the user triggers an export).
 * `reportDate` (optional) is the operational date the report reflects; when
 * provided it filters daily occurrences and stamps the document header.
 * `quality` controls font/padding scaling of the generated PDF ("high"
 * yields larger glyphs and roomier cells for better legibility).
 */
export function useExporters(
  data: SheetsData | undefined,
  reportDate: Date | null = null,
  quality: PdfQuality = "standard",
  comparisonData?: ComparisonResult,
) {

  const exportXlsx = useCallback(async () => {
    if (!data) return;
    try {
      const cleanData = sanitizeSheetsData(data);
      const { exportSheetsToXlsx } = await import("@/lib/export-xlsx");
      exportSheetsToXlsx(cleanData, reportDate, undefined, comparisonData);
      toast.success("Excel gerado. Verifique seus downloads.");

    } catch (e) {
      toast.error("Falha ao gerar Excel", { description: (e as Error)?.message });
    }
  }, [data, reportDate]);

  const exportPdf = useCallback(async () => {
    if (!data) return;

    // Autocorrige e sanitiza quaisquer células negativas ou valores ausentes
    const cleanData = sanitizeSheetsData(data);
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
  }, [data, reportDate, quality]);

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
    exportMunicipioPdf,
    exportMunicipioCsv,
    exportEfetivoMapasXlsx,
    exportEfetivoMapasJson,
  };
}
