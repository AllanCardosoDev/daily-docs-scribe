import { useCallback } from "react";
import { toast } from "sonner";
import type { SheetsData } from "@/lib/sheets.types";
import { validateForExport, formatIssues } from "@/lib/report-validation";
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
) {
  const exportXlsx = useCallback(async () => {
    if (!data) return;
    try {
      const { exportSheetsToXlsx } = await import("@/lib/export-xlsx");
      exportSheetsToXlsx(data, reportDate);
      toast.success("Excel gerado. Verifique seus downloads.");
    } catch (e) {
      toast.error("Falha ao gerar Excel", { description: (e as Error)?.message });
    }
  }, [data, reportDate]);

  const exportPdf = useCallback(async () => {
    if (!data) return;

    const check = validateForExport(data);
    if (!check.ok) {
      toast.error("Não é possível gerar o PDF oficial", {
        description: formatIssues(check.issues),
        duration: 8000,
      });
      return;
    }

    try {
      const { exportSheetsToPdf } = await import("@/lib/export-pdf");
      exportSheetsToPdf(data, reportDate, quality);
      toast.success(
        quality === "high"
          ? "PDF em alta legibilidade gerado."
          : "PDF gerado. Verifique seus downloads.",
      );
    } catch (e) {
      toast.error("Falha ao gerar PDF", { description: (e as Error)?.message });
    }
  }, [data, reportDate, quality]);

  return { exportXlsx, exportPdf };
}
