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
  ChevronDown,
  FileSpreadsheet,
  BarChart3,
  Users,
} from "lucide-react";
import { ReportHistoryDialog } from "./ReportHistoryDialog";
import { AddMunicipioDialog } from "./AddMunicipioDialog";
import { AddOutroEfetivoDialog } from "./AddOutroEfetivoDialog";
import { ImportPlanilhaDialog } from "./ImportPlanilhaDialog";
import { cn } from "@/lib/utils";

import { ReportShift } from "@/lib/report-shift";

interface Props {
  canEdit: boolean;
  isRefreshing: boolean;
  reportDate: Date | null;
  onReportDateChange: (d: Date | null) => void;
  onRefresh: () => void;
  onExportXlsx: () => void;
  onExportPdf: () => void;
  onPreviewPdf: () => void;
  onExportEfetivoMapas?: () => void;
  existingMunicipios?: string[];
  onAddMunicipio?: (name: string) => Promise<void> | void;
  onAddOutroEfetivo?: (name: string, ord?: number, seg?: number, brig?: number) => Promise<void> | void;
  shift?: ReportShift;
  onShiftChange?: (s: ReportShift) => void;
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
  onRefresh,
  onExportXlsx,
  onExportPdf,
  onPreviewPdf,
  onExportEfetivoMapas,
  existingMunicipios = [],
  onAddMunicipio,
  onAddOutroEfetivo,
  shift = "noturno",
  onShiftChange,
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
          {/* Shift selector: 24h vs Parcial */}
          {onShiftChange && (
            <div className="flex items-center rounded-lg border border-border bg-muted/50 p-1 h-11 sm:h-10">
              <button
                type="button"
                onClick={() => onShiftChange("noturno")}
                className={cn(
                  "px-3 h-full rounded-md text-xs font-bold transition-all cursor-pointer flex items-center gap-1.5",
                  shift === "noturno"
                    ? "bg-red-600 text-white shadow-sm"
                    : "text-muted-foreground hover:text-foreground",
                )}
                title="Relatório 24h (07:00 da manhã — consolidação com pré-preenchimento em vermelho)"
              >
                <span className={cn("w-2 h-2 rounded-full", shift === "noturno" ? "bg-white animate-pulse" : "bg-red-500")} />
                Relatório 24h
              </button>
              <button
                type="button"
                onClick={() => onShiftChange("parcial")}
                className={cn(
                  "px-3 h-full rounded-md text-xs font-bold transition-all cursor-pointer flex items-center gap-1.5",
                  shift === "parcial"
                    ? "bg-emerald-600 text-white shadow-sm"
                    : "text-muted-foreground hover:text-foreground",
                )}
                title="Relatório Parcial (18:30 da tarde — ocorrências zeradas para entrada do dia)"
              >
                <span className={cn("w-2 h-2 rounded-full", shift === "parcial" ? "bg-white animate-pulse" : "bg-emerald-500")} />
                Relatório Parcial
              </button>
            </div>
          )}

          {/* Single report date selector */}
          <div className="flex items-center gap-1 rounded-lg border border-border bg-muted/50 px-1 py-1 min-w-0">
            <Popover>
              <PopoverTrigger asChild>
                <Button
                  variant="ghost"
                  className={cn(
                    "h-9 min-w-[135px] justify-start gap-2 font-medium text-xs px-2.5",
                    !reportDate && "text-muted-foreground",
                  )}
                >
                  <CalendarIcon className="w-3.5 h-3.5 shrink-0 text-primary" />
                  <span className="truncate font-semibold">
                    {reportDate ? reportDate.toLocaleDateString("pt-BR") : "Selecionar dia"}
                  </span>
                </Button>
              </PopoverTrigger>
              <PopoverContent align="end" className="w-auto p-0">
                <LazyCalendar
                  mode="single"
                  selected={reportDate ?? undefined}
                  onSelect={(d) => onReportDateChange(d ?? null)}
                  initialFocus
                />
              </PopoverContent>
            </Popover>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            {onAddMunicipio && (
              <AddMunicipioDialog
                existingMunicipios={existingMunicipios}
                onAddMunicipio={onAddMunicipio}
                disabled={!canEdit}
              />
            )}

            {onAddOutroEfetivo && (
              <AddOutroEfetivoDialog
                onAddOutroEfetivo={onAddOutroEfetivo}
                disabled={!canEdit}
              />
            )}

            <ReportHistoryDialog reportDate={reportDate} />

            <ImportPlanilhaDialog
              onSuccess={(res) => {
                if (res.latestDate) {
                  const [y, m, d] = res.latestDate.split("-").map(Number);
                  onReportDateChange(new Date(y, m - 1, d));
                }
              }}
            />

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

                {onExportEfetivoMapas && (
                  <DropdownMenuItem
                    onClick={onExportEfetivoMapas}
                    className="flex items-start gap-3 p-2.5 cursor-pointer rounded-lg hover:bg-muted focus:bg-muted transition-colors"
                  >
                    <div className="p-2 rounded-md bg-cyan-100 text-cyan-800 dark:bg-cyan-900/50 dark:text-cyan-300 mt-0.5">
                      <Users className="w-4 h-4 shrink-0" />
                    </div>
                    <div>
                      <div className="font-bold text-sm text-foreground">Exportar Efetivo (Mapas .xlsx)</div>
                      <div className="text-xs text-muted-foreground leading-snug">
                        Matriz de efetivo do dia e bases para integração direta com o Projeto Mapas.
                      </div>
                    </div>
                  </DropdownMenuItem>
                )}

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
