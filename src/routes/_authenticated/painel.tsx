import { createFileRoute } from "@tanstack/react-router";
import { lazy, Suspense, useCallback, useEffect, useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { DashboardHeader } from "@/components/dashboard/Header";
import { KpiCards } from "@/components/dashboard/KpiCards";
import { DashboardSections } from "@/components/dashboard/DashboardSections";
import { EditableHeader } from "@/components/dashboard/EditableHeader";
import { PainelToolbar } from "@/components/dashboard/PainelToolbar";
import { DashboardSkeleton } from "@/components/dashboard/DashboardSkeleton";
import { DashboardFooter } from "@/components/dashboard/DashboardFooter";
import { ScrollToTop } from "@/components/dashboard/ScrollToTop";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Map, LayoutGrid, BarChart3 } from "lucide-react";
import { DashboardAnalytics } from "@/components/dashboard/DashboardAnalytics";
import { AmazonasMap } from "@/components/map/AmazonasMap";
import { useSheetsDashboard } from "@/hooks/use-sheets";
import { EMPTY_SHEETS_DATA } from "@/lib/sheets.types";
import { getComparisonData } from "@/lib/sheets.functions";
import type { ComparisonResult } from "@/lib/comparison";
import { useExporters } from "@/hooks/use-exporters";
import { useServerFn } from "@tanstack/react-start";
import { getLatestReportDate } from "@/lib/daily-reports.functions";
import { canonicalMunicipio } from "@/lib/municipio-order";
import { toast } from "sonner";
import { ReportShift } from "@/lib/report-shift";

/**
 * Diálogos pesados (visualizador de PDF e configurações) são carregados
 * apenas quando abertos pela primeira vez, mantendo o painel leve.
 */
const ReportPreviewDialog = lazy(() =>
  import("@/components/dashboard/ReportPreviewDialog").then((m) => ({
    default: m.ReportPreviewDialog,
  })),
);
const SettingsDialog = lazy(() =>
  import("@/components/dashboard/SettingsDialog").then((m) => ({
    default: m.SettingsDialog,
  })),
);

export const Route = createFileRoute("/_authenticated/painel")({
  head: () => ({
    meta: [{ title: "Painel · CBMAM Amazonas + Verde" }, { name: "robots", content: "noindex" }],
  }),
  component: PainelPage,
});

function PainelPage() {
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [previewOpen, setPreviewOpen] = useState(false);
  const [reportDate, setReportDate] = useState<Date | null>(null);
  const [endDate, setEndDate] = useState<Date | null>(null);
  const [shift, setShift] = useState<ReportShift>("noturno");
  const getLatest = useServerFn(getLatestReportDate);
  const [comparisonMode, setComparisonMode] = useState(false);
  const [compReportDate, setCompReportDate] = useState<Date | null>(null);
  const [compEndDate, setCompEndDate] = useState<Date | null>(null);

  useEffect(() => {
    getLatest().then((dateStr) => {
      if (dateStr) {
        // Use local time for the date string from DB to avoid timezone shifts
        const [y, m, d] = dateStr.split("-").map(Number);
        setReportDate(new Date(y, m - 1, d));
        setEndDate(new Date(y, m - 1, d));
      } else {
        setReportDate(new Date());
        setEndDate(new Date());
      }
    });
  }, [getLatest]);

  const [pdfQuality, setPdfQuality] = useState<"standard" | "high">("standard");
  const { configQuery, dataQuery, savers, canEdit, refresh } = useSheetsDashboard(
    reportDate,
    endDate,
  );

  const getComparison = useServerFn(getComparisonData);
  const comparisonQuery = useQuery({
    queryKey: [
      "comparison-data",
      reportDate?.toISOString().split("T")[0],
      endDate?.toISOString().split("T")[0],
      compReportDate?.toISOString().split("T")[0],
      compEndDate?.toISOString().split("T")[0],
    ],
    queryFn: () =>
      getComparison({
        data: {
          rangeA: {
            reportDate: reportDate!.toISOString().split("T")[0],
            endDate: endDate?.toISOString().split("T")[0],
          },
          rangeB: {
            reportDate: compReportDate!.toISOString().split("T")[0],
            endDate: compEndDate?.toISOString().split("T")[0],
          },
        },
      }),
    enabled: comparisonMode && !!reportDate && !!compReportDate,
  });

  const cfg = configQuery.data;
  const payload = dataQuery.data;
  const data = payload?.data ?? EMPTY_SHEETS_DATA;

  // Uma vez montado, o diálogo permanece no DOM para preservar a animação
  // de fechamento sem recarregar o pacote.
  const [settingsMounted, setSettingsMounted] = useState(false);
  const [previewMounted, setPreviewMounted] = useState(false);

  const openSettings = useCallback(() => {
    setSettingsMounted(true);
    setSettingsOpen(true);
  }, []);
  const openPreview = useCallback(() => {
    setPreviewMounted(true);
    setPreviewOpen(true);
  }, []);
  const { exportXlsx, exportPdf, exportMunicipioPdf, exportMunicipioCsv } = useExporters(
    data, 
    reportDate, 
    pdfQuality,
    comparisonQuery.data || undefined
  );


  const existingMunicipios = useMemo(() => {
    const list = data.incendios_diario ?? [];
    return list.map((r) => r.mun);
  }, [data.incendios_diario]);

  const handleAddMunicipio = useCallback(
    async (name: string) => {
      const canonicalName = canonicalMunicipio(name);
      const appendRow = <T extends { mun?: string; municipio?: string }>(
        list: T[],
        newRow: T,
      ) => {
        if (
          list.some(
            (r) =>
              canonicalMunicipio(r.mun ?? r.municipio).toLowerCase() ===
              canonicalName.toLowerCase(),
          )
        ) {
          return list;
        }
        return [...list, { ...newRow, mun: canonicalName }];
      };

      const updatedEfetivo = appendRow(data.efetivo ?? [], {
        mun: canonicalName,
        ord: 0,
        seg: 0,
        brig: 0,
      });
      const updatedRecursos = appendRow(data.recursos ?? [], { mun: canonicalName });
      const updatedIncendios = appendRow(data.incendios_diario ?? [], {
        mun: canonicalName,
        urb: 0,
        flor: 0,
        focos: 0,
        total_periodo: 0,
      });
      const updatedOutras = appendRow(data.outras_diarias ?? [], {
        mun: canonicalName,
        salvamento: 0,
        acidentes: 0,
        aph: 0,
        prevencao: 0,
        servicos: 0,
        total_periodo: 0,
      });

      await savers.efetivo(updatedEfetivo);
      await savers.recursos(updatedRecursos);
      await savers.incendios_diario(updatedIncendios);
      await savers.outras_diarias(updatedOutras);
      toast.success(`Município ${canonicalName} inserido no relatório!`);
    },
    [data, savers],
  );

  const isBooting = configQuery.isLoading || (dataQuery.isLoading && !dataQuery.isPlaceholderData);
  // A fonte oficial é sempre a pasta do Google Drive — não há configuração manual.

  return (
    <div className="min-h-dvh bg-gradient-brand-soft">
      <DashboardHeader
        header={data.header ?? {}}
        configured
        error={payload?.error}
        isAdmin={!!cfg?.isAdmin}
        onOpenSettings={openSettings}
      />

      <main className="w-full max-w-[98%] mx-auto px-3 sm:px-4 md:px-6 py-4 sm:py-6 space-y-4 sm:space-y-6">
        {isBooting ? (
          <DashboardSkeleton />
        ) : (
          <div className="space-y-5 sm:space-y-7 animate-fade-in-soft">
            <PainelToolbar
              canEdit={canEdit}
              isRefreshing={dataQuery.isFetching}
              reportDate={reportDate}
              endDate={endDate}
              onReportDateChange={(d) => {
                setReportDate(d);
                if (d && endDate && d > endDate) setEndDate(d);
              }}
              onEndDateChange={setEndDate}
              pdfQuality={pdfQuality}
              onPdfQualityChange={setPdfQuality}
              onRefresh={refresh}
              onExportXlsx={exportXlsx}
              onExportPdf={exportPdf}
              onPreviewPdf={openPreview}
              existingMunicipios={existingMunicipios}
              onAddMunicipio={handleAddMunicipio}
              shift={shift}
              onShiftChange={setShift}
              comparisonMode={comparisonMode}
              onComparisonModeChange={setComparisonMode}
              compReportDate={compReportDate}
              onCompReportDateChange={setCompReportDate}
              compEndDate={compEndDate}
              onCompEndDateChange={setCompEndDate}
            />
            <EditableHeader header={data.header ?? {}} editable={canEdit} onSave={savers.header} />
            <KpiCards data={data} />
            
            <div className="pt-4 border-t border-border/50">
              <div className="flex items-center gap-2 mb-6">
                <LayoutGrid className="w-5 h-5 text-primary" />
                <h2 className="text-xl font-bold font-display tracking-tight text-foreground">
                  Registro e Inserção de Dados
                </h2>
              </div>
              <DashboardSections data={data} canEdit={canEdit} savers={savers} />
            </div>
          </div>
        )}
      </main>

      <DashboardFooter />
      <ScrollToTop />

      <Suspense fallback={null}>
        {settingsMounted && (
          <SettingsDialog
            open={settingsOpen}
            onOpenChange={setSettingsOpen}
            currentUrl={cfg?.apps_script_url ?? ""}
          />
        )}

        {previewMounted && (
          <ReportPreviewDialog
            open={previewOpen}
            onOpenChange={setPreviewOpen}
            data={data}
            reportDate={reportDate}
            quality={pdfQuality}
          />
        )}
      </Suspense>
    </div>
  );
}
