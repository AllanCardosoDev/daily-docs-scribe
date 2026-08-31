import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { DashboardHeader } from "@/components/dashboard/Header";
import { KpiCards } from "@/components/dashboard/KpiCards";
import { DashboardSkeleton } from "@/components/dashboard/DashboardSkeleton";
import { DashboardFooter } from "@/components/dashboard/DashboardFooter";
import { ScrollToTop } from "@/components/dashboard/ScrollToTop";
import { DashboardAnalytics } from "@/components/dashboard/DashboardAnalytics";
import {
  DashboardFilterBar,
  type DashboardFilterState,
  CALHAS_AMAZONAS,
} from "@/components/dashboard/DashboardFilterBar";
import {
  MunicipiosAnalyticsTable,
  type MunicipioRowData,
} from "@/components/dashboard/MunicipiosAnalyticsTable";
import { useSheetsDashboard } from "@/hooks/use-sheets";
import { EMPTY_SHEETS_DATA, type SheetsData } from "@/lib/sheets.types";
import { getComparisonData } from "@/lib/sheets.functions";
import { useExporters } from "@/hooks/use-exporters";
import { useServerFn } from "@tanstack/react-start";
import { getLatestReportDate } from "@/lib/daily-reports.functions";
import { useState, useEffect, useCallback, useMemo, lazy, Suspense } from "react";
import { canonicalMunicipio } from "@/lib/municipio-order";

const ReportPreviewDialog = lazy(() =>
  import("@/components/dashboard/ReportPreviewDialog").then((m) => ({
    default: m.ReportPreviewDialog,
  }))
);
const SettingsDialog = lazy(() =>
  import("@/components/dashboard/SettingsDialog").then((m) => ({
    default: m.SettingsDialog,
  }))
);

export const Route = createFileRoute("/_authenticated/dashboard")({
  head: () => ({
    meta: [
      { title: "Dashboard Executivo & Analítico · CBMAM Amazonas + Verde" },
      { name: "robots", content: "noindex" },
    ],
  }),
  component: DashboardPage,
});

function DashboardPage() {
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [previewOpen, setPreviewOpen] = useState(false);
  const [pdfQuality, setPdfQuality] = useState<"standard" | "high">("standard");

  const [filters, setFilters] = useState<DashboardFilterState>(() => {
    const d = new Date(2026, 7, 30);
    return {
      reportDate: d,
      endDate: d,
      shift: "todos",
      selectedCalha: "todas",
      selectedMunicipio: "todos",
      searchQuery: "",
    };
  });

  const getLatest = useServerFn(getLatestReportDate);

  useEffect(() => {
    getLatest()
      .then((dateStr) => {
        if (dateStr) {
          const [y, m, d] = dateStr.split("-").map(Number);
          const dt = new Date(y, m - 1, d);
          setFilters((prev) => ({
            ...prev,
            reportDate: dt,
            endDate: dt,
          }));
        }
      })
      .catch((err) => {
        console.error("Erro ao sincronizar última data:", err);
      });
  }, [getLatest]);

  const { configQuery, dataQuery, refresh } = useSheetsDashboard(
    filters.reportDate,
    filters.endDate
  );

  const cfg = configQuery.data;
  const rawPayload = dataQuery.data;
  const rawData: SheetsData = rawPayload?.data ?? EMPTY_SHEETS_DATA;

  // Lista de todos os municípios presentes nos dados
  const availableMunicipios = useMemo(() => {
    const set = new Set<string>();
    (rawData.incendios_diario ?? []).forEach((r) => set.add(canonicalMunicipio(r.mun)));
    (rawData.efetivo ?? []).forEach((r) => set.add(canonicalMunicipio(r.mun)));
    (rawData.outras_diarias ?? []).forEach((r) => set.add(canonicalMunicipio(r.mun)));
    return Array.from(set).filter((m) => m && m !== "—");
  }, [rawData]);

  // Aplica filtros de Município, Calha e Busca Textual
  const filteredData = useMemo<SheetsData>(() => {
    const { selectedCalha, selectedMunicipio, searchQuery } = filters;
    const query = searchQuery.trim().toLowerCase();

    const matchesFilter = (munRaw: unknown) => {
      const mun = canonicalMunicipio(munRaw);
      if (selectedMunicipio !== "todos" && mun !== selectedMunicipio) {
        return false;
      }
      if (selectedCalha !== "todas") {
        const calhaList = CALHAS_AMAZONAS[selectedCalha] ?? [];
        if (!calhaList.includes(mun)) return false;
      }
      if (query && !mun.toLowerCase().includes(query)) {
        return false;
      }
      return true;
    };

    return {
      header: rawData.header,
      incendios_diario: (rawData.incendios_diario ?? []).filter((r) => matchesFilter(r.mun)),
      incendios_acumulado: (rawData.incendios_acumulado ?? []).filter((r) => matchesFilter(r.mun)),
      outras_diarias: (rawData.outras_diarias ?? []).filter((r) => matchesFilter(r.mun)),
      efetivo: (rawData.efetivo ?? []).filter((r) => matchesFilter(r.mun)),
      recursos: (rawData.recursos ?? []).filter((r) => matchesFilter(r.mun)),
      occurrences: (rawData.occurrences ?? []).filter((r) => matchesFilter(r.municipio)),
    };
  }, [rawData, filters]);

  // Monta as linhas consolidadas da tabela de municípios
  const municipioRows = useMemo<MunicipioRowData[]>(() => {
    const map = new Map<string, {
      flor: number;
      urb: number;
      tot: number;
      efetivo: number;
      viaturas: number;
      outras: number;
      calha?: string;
    }>();

    // Identifica calha de cada município
    const getCalha = (mun: string) => {
      for (const [calhaName, list] of Object.entries(CALHAS_AMAZONAS)) {
        if (list.includes(mun)) return calhaName;
      }
      return undefined;
    };

    // 1. Incêndios
    (filteredData.incendios_diario ?? []).forEach((r) => {
      const mun = canonicalMunicipio(r.mun);
      if (!mun || mun === "—") return;
      const current = map.get(mun) ?? {
        flor: 0,
        urb: 0,
        tot: 0,
        efetivo: 0,
        viaturas: 0,
        outras: 0,
        calha: getCalha(mun),
      };
      const f = Number(r.flor) || 0;
      const u = Number(r.urb) || 0;
      current.flor += f;
      current.urb += u;
      current.tot += f + u;
      map.set(mun, current);
    });

    // 2. Efetivo
    (filteredData.efetivo ?? []).forEach((r) => {
      const mun = canonicalMunicipio(r.mun);
      if (!mun || mun === "—") return;
      const current = map.get(mun) ?? {
        flor: 0,
        urb: 0,
        tot: 0,
        efetivo: 0,
        viaturas: 0,
        outras: 0,
        calha: getCalha(mun),
      };
      current.efetivo += (Number(r.ord) || 0) + (Number(r.seg) || 0) + (Number(r.brig) || 0);
      map.set(mun, current);
    });

    // 3. Viaturas / Recursos
    (filteredData.recursos ?? []).forEach((r) => {
      const mun = canonicalMunicipio(r.mun);
      if (!mun || mun === "—") return;
      const current = map.get(mun) ?? {
        flor: 0,
        urb: 0,
        tot: 0,
        efetivo: 0,
        viaturas: 0,
        outras: 0,
        calha: getCalha(mun),
      };
      current.viaturas += (Number(r.vtr) || 0) + (Number(r.emb) || 0) + (Number(r.aer) || 0);
      map.set(mun, current);
    });

    // 4. Outras ocorrências
    (filteredData.outras_diarias ?? []).forEach((r) => {
      const mun = canonicalMunicipio(r.mun);
      if (!mun || mun === "—") return;
      const current = map.get(mun) ?? {
        flor: 0,
        urb: 0,
        tot: 0,
        efetivo: 0,
        viaturas: 0,
        outras: 0,
        calha: getCalha(mun),
      };
      current.outras +=
        (Number(r.salvamento) || 0) +
        (Number(r.aph) || 0) +
        (Number(r.prevencao) || 0) +
        (Number(r.acidentes) || 0) +
        (Number(r.servicos) || 0);
      map.set(mun, current);
    });

    return Array.from(map.entries()).map(([mun, val]) => {
      let severidade: MunicipioRowData["severidade"] = "estavel";
      if (val.tot >= 50) severidade = "critico";
      else if (val.tot >= 20) severidade = "alto";
      else if (val.tot >= 5) severidade = "moderado";

      return {
        municipio: mun,
        calha: val.calha,
        incendiosFlorestais: val.flor,
        incendiosUrbanos: val.urb,
        totalIncendios: val.tot,
        efetivoTotal: val.efetivo,
        viaturasTotal: val.viaturas,
        outrasOcorrencias: val.outras,
        severidade,
      };
    });
  }, [filteredData]);

  const handleFilterChange = useCallback((updates: Partial<DashboardFilterState>) => {
    setFilters((prev) => ({ ...prev, ...updates }));
  }, []);

  const handleResetFilters = useCallback(() => {
    setFilters((prev) => ({
      ...prev,
      shift: "todos",
      selectedCalha: "todas",
      selectedMunicipio: "todos",
      searchQuery: "",
    }));
  }, []);

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

  const { exportXlsx, exportPdf } = useExporters(
    filteredData,
    filters.reportDate,
    pdfQuality
  );

  const isBooting = configQuery.isLoading || (dataQuery.isLoading && !dataQuery.isPlaceholderData);

  return (
    <div className="min-h-dvh bg-gradient-brand-soft">
      <DashboardHeader
        header={filteredData.header ?? {}}
        configured
        error={rawPayload?.error}
        isAdmin={!!cfg?.isAdmin}
        onOpenSettings={openSettings}
      />

      <main className="w-full max-w-[98%] mx-auto px-3 sm:px-4 md:px-6 py-4 sm:py-6 space-y-4 sm:space-y-6">
        {isBooting ? (
          <DashboardSkeleton />
        ) : (
          <div className="space-y-5 sm:space-y-7 animate-fade-in-soft">
            {/* Barra de Filtros Multidimensional */}
            <DashboardFilterBar
              filters={filters}
              onChange={handleFilterChange}
              onReset={handleResetFilters}
              availableMunicipios={availableMunicipios}
              isRefreshing={dataQuery.isFetching}
              onRefresh={refresh}
              onExportXlsx={exportXlsx}
              onExportPdf={exportPdf}
            />

            {/* Cartões Executivos de KPIs */}
            <KpiCards
              data={filteredData}
              isRange={Boolean(
                filters.reportDate &&
                  filters.endDate &&
                  filters.reportDate.toISOString().split("T")[0] !==
                    filters.endDate.toISOString().split("T")[0]
              )}
            />

            {/* Visualizações e Gráficos de Inteligência */}
            <DashboardAnalytics
              data={filteredData}
              selectedMunicipio={filters.selectedMunicipio}
              selectedCalha={filters.selectedCalha}
            />

            {/* Matriz Analítica Municipal Detalhada */}
            <MunicipiosAnalyticsTable
              rows={municipioRows}
              onSelectMunicipio={(mun) => handleFilterChange({ selectedMunicipio: mun })}
            />
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
            data={filteredData}
            reportDate={filters.reportDate}
            quality={pdfQuality}
          />
        )}
      </Suspense>
    </div>
  );
}
