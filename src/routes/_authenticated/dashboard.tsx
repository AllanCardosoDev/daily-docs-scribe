import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { DashboardHeader } from "@/components/dashboard/Header";
import { KpiCards } from "@/components/dashboard/KpiCards";
import { PainelToolbar } from "@/components/dashboard/PainelToolbar";
import { DashboardSkeleton } from "@/components/dashboard/DashboardSkeleton";
import { DashboardFooter } from "@/components/dashboard/DashboardFooter";
import { ScrollToTop } from "@/components/dashboard/ScrollToTop";
import { EditableHeader } from "@/components/dashboard/EditableHeader";
import { DashboardAnalytics } from "@/components/dashboard/DashboardAnalytics";
import { AmazonasMap } from "@/components/map/AmazonasMap";
import { useSheetsDashboard } from "@/hooks/use-sheets";
import { EMPTY_SHEETS_DATA } from "@/lib/sheets.types";
import { getComparisonData } from "@/lib/sheets.functions";
import { useExporters } from "@/hooks/use-exporters";
import { useServerFn } from "@tanstack/react-start";
import { getLatestReportDate } from "@/lib/daily-reports.functions";
import { useState, useEffect, useCallback, lazy, Suspense } from "react";
import { ReportShift } from "@/lib/report-shift";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { LayoutGrid, Map } from "lucide-react";

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

export const Route = createFileRoute("/_authenticated/dashboard")({
  head: () => ({
    meta: [
      { title: "Dashboard Analítico · CBMAM Amazonas + Verde" },
      { name: "robots", content: "noindex" },
    ],
  }),
  component: DashboardPage,
});

function DashboardPage() {
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
  const { configQuery, dataQuery, refresh } = useSheetsDashboard(
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

  const isBooting = configQuery.isLoading || (dataQuery.isLoading && !dataQuery.isPlaceholderData);

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
              canEdit={false}
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
              existingMunicipios={[]}
              onAddMunicipio={() => {}}
              shift={shift}
              onShiftChange={setShift}
              comparisonMode={comparisonMode}
              onComparisonModeChange={setComparisonMode}
              compReportDate={compReportDate}
              onCompReportDateChange={setCompReportDate}
              compEndDate={compEndDate}
              onCompEndDateChange={setCompEndDate}
            />
            
            <EditableHeader 
              header={data.header ?? {}} 
              editable={false} 
              onSave={async () => {}} 
            />

            <KpiCards data={data} />
            
            <Tabs defaultValue="dashboard" className="w-full space-y-6">
              <div className="flex justify-center">
                <TabsList className="bg-card border border-border shadow-sm p-1 h-12 rounded-xl">
                  <TabsTrigger 
                    value="dashboard" 
                    className="gap-2 px-6 rounded-lg font-bold data-[state=active]:bg-gradient-brand data-[state=active]:text-white transition-all"
                  >
                    <LayoutGrid className="w-4 h-4" />
                    Gráficos e Análise
                  </TabsTrigger>
                  <TabsTrigger 
                    value="map" 
                    className="gap-2 px-6 rounded-lg font-bold data-[state=active]:bg-gradient-brand data-[state=active]:text-white transition-all"
                  >
                    <Map className="w-4 h-4" />
                    Mapa Amazonas
                  </TabsTrigger>
                </TabsList>
              </div>

              <TabsContent value="dashboard" className="animate-fade-in-soft focus-visible:outline-none">
                <DashboardAnalytics 
                  data={data} 
                  comparisonData={comparisonQuery.data || undefined} 
                  isComparisonLoading={comparisonQuery.isFetching}
                />
              </TabsContent>

              <TabsContent value="map" className="animate-fade-in-soft focus-visible:outline-none">
                <AmazonasMap data={data} onExportPdf={exportMunicipioPdf} onExportCsv={exportMunicipioCsv} />
              </TabsContent>
            </Tabs>
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
