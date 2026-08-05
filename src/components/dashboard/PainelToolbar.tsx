import { memo } from "react";
import { Button } from "@/components/ui/button";
import { LazyCalendar } from "@/components/ui/lazy-calendar";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
  DropdownMenuSeparator,
  DropdownMenuLabel,
} from "@/components/ui/dropdown-menu";
import { Link } from "@tanstack/react-router";
import {
  FileText,
  Eye,
  CalendarIcon,
  X,
  Sparkles,
  ChevronDown,
  FileSpreadsheet,
  BarChart3,
} from "lucide-react";
import { ReportHistoryDialog } from "./ReportHistoryDialog";
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

          <div className="flex flex-wrap items-center gap-2">
            <ReportHistoryDialog />

            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button
                  size="default"
                  className="h-11 sm:h-10 bg-gradient-brand text-white hover:opacity-95 shadow-elevated gap-2 font-bold px-5 hover-lift"
                >
                  <FileText className="w-4 h-4 shrink-0 text-white" />
                  <span className="text-sm">Gerar Relatório</span>
                  <ChevronDown className="w-4 h-4 opacity-80 shrink-0" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-80 p-2 shadow-2xl border-border">
                <DropdownMenuLabel className="text-[11px] uppercase tracking-wider text-muted-foreground font-bold px-2 py-1.5">
                  Opções de Emissão de Relatório
                </DropdownMenuLabel>
                
                <DropdownMenuItem
                  onClick={onExportPdf}
                  className="flex items-start gap-3 p-2.5 cursor-pointer rounded-lg hover:bg-muted focus:bg-muted transition-colors"
                >
                  <div className="p-2 rounded-md bg-emerald-100 text-emerald-800 dark:bg-emerald-900/50 dark:text-emerald-300 mt-0.5">
                    <FileText className="w-4 h-4 shrink-0" />
                  </div>
                  <div>
                    <div className="font-bold text-sm text-foreground">Relatório Diário Oficial (PDF)</div>
                    <div className="text-xs text-muted-foreground leading-snug">
                      Documento oficial formatado com cabeçalho institucional, efetivo, recursos e incêndios.
                    </div>
                  </div>
                </DropdownMenuItem>

                <DropdownMenuItem
                  onClick={onPreviewPdf}
                  className="flex items-start gap-3 p-2.5 cursor-pointer rounded-lg hover:bg-muted focus:bg-muted transition-colors"
                >
                  <div className="p-2 rounded-md bg-blue-100 text-blue-800 dark:bg-blue-900/50 dark:text-blue-300 mt-0.5">
                    <Eye className="w-4 h-4 shrink-0" />
                  </div>
                  <div>
                    <div className="font-bold text-sm text-foreground">Pré-visualizar Relatório</div>
                    <div className="text-xs text-muted-foreground leading-snug">
                      Visualização interativa em tela cheia antes de imprimir ou salvar.
                    </div>
                  </div>
                </DropdownMenuItem>

                <DropdownMenuSeparator className="my-1.5" />

                <DropdownMenuItem
                  onClick={onExportXlsx}
                  className="flex items-start gap-3 p-2.5 cursor-pointer rounded-lg hover:bg-muted focus:bg-muted transition-colors"
                >
                  <div className="p-2 rounded-md bg-emerald-100 text-emerald-800 dark:bg-emerald-900/50 dark:text-emerald-300 mt-0.5">
                    <FileSpreadsheet className="w-4 h-4 shrink-0" />
                  </div>
                  <div>
                    <div className="font-bold text-sm text-foreground">Exportar Planilha (Excel .xlsx)</div>
                    <div className="text-xs text-muted-foreground leading-snug">
                      Exportação das matrizes brutas tabulares de efetivo, recursos e ocorrências.
                    </div>
                  </div>
                </DropdownMenuItem>

                <DropdownMenuItem
                  asChild
                  className="flex items-start gap-3 p-2.5 cursor-pointer rounded-lg hover:bg-muted focus:bg-muted transition-colors"
                >
                  <Link to="/totais">
                    <div className="p-2 rounded-md bg-amber-100 text-amber-800 dark:bg-amber-900/50 dark:text-amber-300 mt-0.5">
                      <BarChart3 className="w-4 h-4 shrink-0" />
                    </div>
                    <div>
                      <div className="font-bold text-sm text-foreground">Relatório Acumulado (Período)</div>
                      <div className="text-xs text-muted-foreground leading-snug">
                        Gerar consolidado mensal/anual e relatórios de período longo em /totais.
                      </div>
                    </div>
                  </Link>
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        </div>
      </div>
    </div>
  );
});
