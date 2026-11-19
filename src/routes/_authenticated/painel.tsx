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
import { LayoutGrid } from "lucide-react";
import { useSheetsDashboard } from "@/hooks/use-sheets";
import { EMPTY_SHEETS_DATA } from "@/lib/sheets.types";
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
  ssr: false,
  head: () => ({
    meta: [{ title: "Inserção de Dados · CBMAM Amazonas + Verde" }, { name: "robots", content: "noindex" }],
  }),
  component: PainelPage,
});

function PainelPage() {
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [previewOpen, setPreviewOpen] = useState(false);
  const [reportDate, setReportDate] = useState<Date | null>(null);
  const [endDate, setEndDate] = useState<Date | null>(null);
  const [shift, setShift] = useState<ReportShift>("noturno");
  const [pdfQuality, setPdfQuality] = useState<"standard" | "high">("standard");
  const getLatest = useServerFn(getLatestReportDate);

  useEffect(() => {
    getLatest().then((dateStr) => {
      if (dateStr) {
        // Use local time for the date string from DB to avoid timezone shifts
        const [y, m, d] = dateStr.split("-").map(Number);
        const dt = new Date(y, m - 1, d);
        setReportDate(dt);
        setEndDate(dt);
      } else {
        const dt = new Date();
        setReportDate(dt);
        setEndDate(dt);
      }
    });
  }, [getLatest]);

  const { configQuery, dataQuery, savers, canEdit, refresh } = useSheetsDashboard(
    reportDate,
    endDate,
  );

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
  const { exportXlsx, exportPdf, exportEfetivoPdf, exportCompletoAmvPdf, exportEfetivoMapasXlsx } = useExporters(
    data, 
    reportDate, 
    "standard",
    undefined
  );

  const existingMunicipios = useMemo(() => {
    const list = data.incendios_diario ?? [];
    return list.map((r) => r.mun);
  }, [data.incendios_diario]);

  const handleAddMunicipio = useCallback(
    async (name: string, tipo: "interior" | "base" = "interior") => {
      const canonicalName = canonicalMunicipio(name);
      const isBase = tipo === "base";

      const appendRow = <T extends { mun?: string; municipio?: string; tipo?: string }>(
        list: T[],
        newRow: T,
      ) => {
        const normTarget = canonicalName.toLowerCase();
        if (
          list.some(
            (r) =>
              canonicalMunicipio(r.mun ?? r.municipio).toLowerCase() === normTarget &&
              (r.tipo === tipo || (!r.tipo && tipo === "interior")),
          )
        ) {
          return list;
        }
        return [...list, { ...newRow, mun: canonicalName, tipo }];
      };

      const updatedEfetivo = appendRow(data.efetivo ?? [], {
        mun: canonicalName,
        tipo,
        cbmam: 0,
        serv_ord: 0,
        ord: 0,
        servico: 0,
        opamv: 0,
        opam_ref: 0,
        inc1: 0,
        inc2: 0,
        inc3: 0,
        cbmsp: 0,
        prevfogo: 0,
        fn: 0,
        marinha: 0,
        seg: 0,
        brig_mun: 0,
        brig_semas: 0,
        total: 0,
        _custom: true,
      });

      const updatedRecursos = appendRow(data.recursos ?? [], {
        mun: canonicalName,
        tipo,
        abt: 0,
        at: 0,
        aem: 0,
        atp: 0,
        ata: 0,
        abf: 0,
        atf: 0,
        abs: 0,
        abtf: 0,
        pipa: 0,
        dosa: 0,
        crs: 0,
        ar: 0,
        ur: 0,
        gse: 0,
        mt: 0,
        ta: 0,
        quadriciclo: 0,
        embarcacao: 0,
        picape_fn: 0,
        picape_muni: 0,
        autoarp: 0,
        helicoptero: 0,
        aviao: 0,
        jetski: 0,
        total: 0,
      });

      const updatedIncendios = appendRow(data.incendios_diario ?? [], {
        mun: canonicalName,
        tipo,
        urb: 0,
        flor: 0,
        focos: 0,
        total_periodo: 0,
      });

      await savers.batch({
        efetivo: updatedEfetivo,
        recursos: updatedRecursos,
        incendios_diario: updatedIncendios,
      });

      toast.success(
        `${isBase ? "Base Temporária" : "Município"} ${canonicalName} inserido no relatório!`,
      );
    },
    [data, savers],
  );

  const handleAddOutroEfetivo = useCallback(
    async (name: string, ord = 0, seg = 0, brig = 0) => {
      const cleanName = name.trim();
      if (!cleanName) return;

      const appendOrUpdate = <T extends { mun?: string; municipio?: string }>(
        list: T[],
        newRow: T,
      ) => {
        const idx = list.findIndex(
          (r) =>
            (r.mun ?? (r as any).municipio)?.trim().toLowerCase() ===
            cleanName.toLowerCase(),
        );
        if (idx >= 0) {
          const updated = [...list];
          updated[idx] = { ...updated[idx], ...newRow };
          return updated;
        }
        return [...list, newRow];
      };

      const updatedEfetivo = appendOrUpdate(data.efetivo ?? [], {
        mun: cleanName,
        ord: Number(ord) || 0,
        seg: Number(seg) || 0,
        brig: Number(brig) || 0,
      });

      await savers.efetivo(updatedEfetivo);
      toast.success(`Efetivo "${cleanName}" adicionado ao relatório!`);
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
              onReportDateChange={(d) => {
                setReportDate(d);
                setEndDate(d);
              }}
              onRefresh={refresh}
              onExportXlsx={exportXlsx}
              onExportPdf={exportPdf}
              onPreviewPdf={openPreview}
              onExportEfetivoPdf={exportEfetivoPdf}
              onExportCompletoAmvPdf={exportCompletoAmvPdf}
              onExportEfetivoMapas={exportEfetivoMapasXlsx}
              existingMunicipios={existingMunicipios}
              onAddMunicipio={handleAddMunicipio}
              onAddOutroEfetivo={handleAddOutroEfetivo}
              shift={shift}
              onShiftChange={setShift}
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
