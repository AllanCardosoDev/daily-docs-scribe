import { memo } from "react";
import { Button } from "@/components/ui/button";
import { LazyCalendar } from "@/components/ui/lazy-calendar";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { RefreshCcw, Download, FileText, Eye, CalendarIcon, X, Sparkles } from "lucide-react";
import { ReportHistoryDialog } from "./ReportHistoryDialog";
import { DriveSyncButton } from "./DriveSyncButton";
import { fmtDateLong } from "@/lib/report-date";
import { cn } from "@/lib/utils";
import type { PdfQuality } from "@/lib/export-pdf";

interface Props {
  canEdit: boolean;
  isRefreshing: boolean;
  reportDate: Date | null;
  onReportDateChange: (d: Date | null) => void;
  pdfQuality: PdfQuality;
  onPdfQualityChange: (q: PdfQuality) => void;
  onRefresh: () => void;
  onExportXlsx: () => void;
  onExportPdf: () => void;
  onPreviewPdf: () => void;
}

/**
 * Sticky "Panorama operacional" toolbar: date selector for the report
 * + Refresh / Excel / PDF actions.
 */
export const PainelToolbar = memo(function PainelToolbar({
  canEdit,
  isRefreshing,
  reportDate,
  onReportDateChange,
  pdfQuality,
  onPdfQualityChange,
  onRefresh,
  onExportXlsx,
  onExportPdf,
  onPreviewPdf,
}: Props) {
  return (
    <div className="relative overflow-hidden rounded-2xl border border-border bg-card shadow-elevated animate-fade-in-soft">
      <div aria-hidden="true" className="absolute inset-x-0 top-0 h-1 bg-gradient-brand" />
      <div
        aria-hidden="true"
        className="pointer-events-none absolute -right-16 -top-16 h-48 w-48 rounded-full bg-primary/5 blur-2xl"
      />
      <div className="p-4 sm:p-5 flex flex-col gap-4 lg:flex-row lg:flex-wrap lg:items-center lg:justify-between">
        <div className="min-w-[240px] flex-1 basis-[280px] space-y-1.5">
          <div className="flex items-center gap-2 text-[10px] sm:text-[11px] uppercase tracking-[0.14em] font-semibold text-muted-foreground">
            <span className="inline-flex items-center gap-1.5">
              <span className="w-1.5 h-1.5 rounded-full bg-primary animate-pulse" />
              Ao vivo
            </span>
            <span aria-hidden="true">·</span>
            <span>Documento oficial · Comando Integrado</span>
          </div>
          <h2 className="font-display text-xl sm:text-2xl font-bold tracking-tight text-foreground">
            Panorama operacional
          </h2>
          <p className="text-xs sm:text-sm text-muted-foreground">
            {canEdit
              ? "Edite as células diretamente — o autosave envia para a planilha."
              : "Somente leitura. Peça o papel de editor para alterar."}
          </p>
        </div>

        <div className="flex flex-col gap-2 sm:flex-row sm:flex-wrap lg:items-center lg:justify-end">
          {/* Report date selector */}
          <div className="flex items-center gap-1 rounded-lg border border-border bg-muted/50 pl-1 pr-1 py-1 min-w-0">
            <Popover>
              <PopoverTrigger asChild>
                <Button
                  variant="ghost"
                  className={cn(
                    "h-9 min-w-0 flex-1 justify-start gap-2 font-medium text-sm px-2.5",
                    !reportDate && "text-muted-foreground",
                  )}
                  aria-label="Escolher data do relatório"
                >
                  <CalendarIcon className="w-4 h-4 shrink-0 text-primary" />
                  <span className="hidden truncate sm:inline">
                    {reportDate ? fmtDateLong(reportDate) : "Data do relatório"}
                  </span>
                  <span className="truncate sm:hidden">
                    {reportDate ? reportDate.toLocaleDateString("pt-BR") : "Data do relatório"}
                  </span>
                </Button>
              </PopoverTrigger>
              <PopoverContent align="end" className="w-auto p-0 pointer-events-auto">
                <LazyCalendar
                  mode="single"
                  selected={reportDate ?? undefined}
                  onSelect={(d) => onReportDateChange(d ?? null)}
                  initialFocus
                  className={cn("p-3 pointer-events-auto")}
                />
              </PopoverContent>
            </Popover>
            {reportDate && (
              <Button
                variant="ghost"
                size="icon"
                className="h-8 w-8 text-muted-foreground hover:text-foreground"
                onClick={() => onReportDateChange(null)}
                aria-label="Limpar data do relatório"
              >
                <X className="w-4 h-4" />
              </Button>
            )}
          </div>

          {/* Quality selector for PDF export/preview */}
          <div
            role="group"
            aria-label="Qualidade do PDF"
            className="flex items-center rounded-lg border border-border bg-muted/50 p-0.5 h-11 sm:h-10 sm:inline-flex [&>button]:flex-1 sm:[&>button]:flex-none [&>button]:justify-center"
          >
            <button
              type="button"
              onClick={() => onPdfQualityChange("standard")}
              className={cn(
                "px-3 h-full rounded-md text-xs font-semibold cursor-pointer transition-all duration-200 hover:bg-background/60",
                pdfQuality === "standard"
                  ? "bg-card shadow-sm text-foreground"
                  : "text-muted-foreground hover:text-foreground",
              )}
              aria-pressed={pdfQuality === "standard"}
              title="Qualidade padrão"
            >
              Padrão
            </button>
            <button
              type="button"
              onClick={() => onPdfQualityChange("high")}
              className={cn(
                "px-3 h-full rounded-md text-xs font-semibold inline-flex items-center gap-1 cursor-pointer transition-all duration-200 hover:bg-background/60",
                pdfQuality === "high"
                  ? "bg-card shadow-sm text-primary"
                  : "text-muted-foreground hover:text-foreground",
              )}
              aria-pressed={pdfQuality === "high"}
              title="Alta legibilidade — fontes e espaçamento maiores"
            >
              <Sparkles className="w-3.5 h-3.5" /> Alta
            </button>
          </div>

          <div className="grid grid-cols-2 gap-2 sm:flex sm:flex-wrap [&>*]:w-full sm:[&>*]:w-auto">
            <ReportHistoryDialog />

            <Button onClick={onExportXlsx} variant="outline" className="h-11 sm:h-10">
              <Download className="w-4 h-4 mr-2 shrink-0" /> Excel
            </Button>
            <Button
              onClick={onPreviewPdf}
              variant="outline"
              className="h-11 sm:h-10 border-primary/40 text-primary hover:bg-primary/10"
            >
              <Eye className="w-4 h-4 mr-2 shrink-0" />{" "}
              <span className="truncate">Pré-visualizar</span>
            </Button>
            <Button onClick={onExportPdf} className="h-11 sm:h-10 hover-lift shadow-elevated">
              <FileText className="w-4 h-4 mr-2 shrink-0" /> PDF
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
});
