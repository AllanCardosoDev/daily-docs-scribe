import { createFileRoute } from "@tanstack/react-router";
import { useState, useEffect, useMemo, useCallback } from "react";
import { useServerFn } from "@tanstack/react-start";
import { DashboardHeader } from "@/components/dashboard/Header";
import { DashboardFooter } from "@/components/dashboard/DashboardFooter";
import { DashboardSkeleton } from "@/components/dashboard/DashboardSkeleton";
import { ScrollToTop } from "@/components/dashboard/ScrollToTop";
import { LazyCalendar } from "@/components/ui/lazy-calendar";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  Users,
  Shield,
  MapPin,
  Flame,
  FileSpreadsheet,
  Download,
  Share2,
  CalendarIcon,
  RefreshCw,
  Building2,
  Tent,
  Radio,
  CheckCircle2,
  Copy,
  Edit3,
  Save,
  X,
  RotateCcw,
} from "lucide-react";
import { toast } from "sonner";
import { useSheetsDashboard } from "@/hooks/use-sheets";
import { useExporters } from "@/hooks/use-exporters";
import { getLatestReportDate } from "@/lib/daily-reports.functions";
import { EMPTY_SHEETS_DATA, type SheetsData, type EfetivoRow } from "@/lib/sheets.types";
import { fmtDateBR } from "@/lib/report-date";
import {
  buildEfetivoMapasData,
  exportEfetivoMapasXlsx,
  exportEfetivoMapasJson,
  norm,
  type EfetivoMapasItem,
} from "@/lib/efetivo-mapas";

export const Route = createFileRoute("/_authenticated/efetivo")({
  head: () => ({
    meta: [
      { title: "Efetivo Operacional & Integração Mapas · CBMAM" },
      { name: "robots", content: "noindex" },
    ],
  }),
  component: EfetivoPage,
});

function EditableCell({
  value,
  isEditing,
  onChange,
}: {
  value: number;
  isEditing: boolean;
  onChange: (val: number) => void;
}) {
  if (!isEditing) {
    return <>{value ?? 0}</>;
  }
  return (
    <input
      type="number"
      min={0}
      value={value ?? 0}
      onChange={(e) => onChange(Number(e.target.value) || 0)}
      onFocus={(e) => e.target.select()}
      className="w-14 h-7 text-right font-mono text-xs px-1 py-0.5 rounded border border-input bg-background text-foreground focus:border-emerald-600 focus:ring-1 focus:ring-emerald-600 focus:outline-none transition-colors"
    />
  );
}

function EfetivoPage() {
  const [reportDate, setReportDate] = useState<Date | null>(new Date());
  const [viewMode, setViewMode] = useState<"consolidado" | "diario">("consolidado");
  const [activeTab, setActiveTab] = useState<"todos" | "municipios" | "bases" | "resumo">("todos");
  const [copiedApi, setCopiedApi] = useState(false);
  const [isEditing, setIsEditing] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [localEdits, setLocalEdits] = useState<Record<string, Record<string, number>>>({});

  const getLatest = useServerFn(getLatestReportDate);

  useEffect(() => {
    getLatest()
      .then((dateStr) => {
        if (dateStr) {
          const [y, m, d] = dateStr.split("-").map(Number);
          setReportDate(new Date(y, m - 1, d));
        }
      })
      .catch((err) => {
        console.error("Erro ao sincronizar data:", err);
      });
  }, [getLatest]);

  const { configQuery, dataQuery, savers, refresh } = useSheetsDashboard(reportDate, reportDate);

  const cfg = configQuery.data;
  const rawPayload = dataQuery.data;
  const rawData: SheetsData = rawPayload?.data ?? EMPTY_SHEETS_DATA;

  const { exportXlsx } = useExporters(rawData, reportDate);

  // Aplica edições locais em tempo real para recálculo instantâneo
  const effectiveSheetsData = useMemo(() => {
    if (Object.keys(localEdits).length === 0) return rawData;
    const currentEfetivo = [...(rawData.efetivo || [])];
    for (const [nome, edits] of Object.entries(localEdits)) {
      const idx = currentEfetivo.findIndex((r) => norm(r.mun) === norm(nome));
      if (idx >= 0) {
        currentEfetivo[idx] = { ...currentEfetivo[idx], ...edits, _custom: true };
      } else {
        currentEfetivo.push({ mun: nome, ...edits, _custom: true });
      }
    }
    return { ...rawData, efetivo: currentEfetivo };
  }, [rawData, localEdits]);

  // Calcula o efetivo segregado por municípios, bases e resumo consolidado
  const efetivoCalculado = useMemo(() => {
    return buildEfetivoMapasData(effectiveSheetsData, viewMode);
  }, [effectiveSheetsData, viewMode]);

  const handleCellChange = useCallback((nome: string, colKey: string, val: number) => {
    const currentItem = [...efetivoCalculado.municipios, ...efetivoCalculado.bases].find(
      (it) => norm(it.nome) === norm(nome)
    );

    setLocalEdits((prev) => {
      const existingRow = prev[nome] || {
        serv_ord: currentItem?.serv_ord ?? 0,
        opamv: currentItem?.opamv ?? 0,
        opam_ref: currentItem?.opam_ref ?? 0,
        inc1: currentItem?.inc1 ?? 0,
        inc2: currentItem?.inc2 ?? 0,
        inc3: currentItem?.inc3 ?? 0,
        cbmsp: currentItem?.cbmsp ?? 0,
        prevfogo: currentItem?.prevfogo ?? 0,
        fn: currentItem?.fn ?? 0,
        marinha: currentItem?.marinha ?? 0,
        brig_mun: currentItem?.brig_mun ?? 0,
        brig_semas: currentItem?.brig_semas ?? 0,
      };

      return {
        ...prev,
        [nome]: {
          ...existingRow,
          [colKey]: Math.max(0, val),
        },
      };
    });
  }, [efetivoCalculado]);

  const handleSaveEdits = useCallback(async () => {
    try {
      setIsSaving(true);
      const allItems = [...efetivoCalculado.municipios, ...efetivoCalculado.bases];

      const rowsToSave: EfetivoRow[] = allItems.map((item) => ({
        mun: item.nome,
        tipo: item.tipo,
        serv_ord: item.serv_ord,
        cbmam: item.serv_ord,
        ord: item.serv_ord,
        servico: item.serv_ord,
        opamv: item.opamv,
        opam_ref: item.opam_ref,
        inc1: item.inc1,
        inc2: item.inc2,
        inc3: item.inc3,
        cbmsp: item.cbmsp,
        prevfogo: item.prevfogo,
        fn: item.fn,
        marinha: item.marinha,
        brig_mun: item.brig_mun,
        brig_semas: item.brig_semas,
        total: item.total,
        _custom: true,
      }));

      const savedNames = new Set(allItems.map((it) => norm(it.nome)));
      for (const extra of rawData.efetivo || []) {
        if (extra?.mun && !savedNames.has(norm(extra.mun))) {
          rowsToSave.push(extra);
        }
      }

      await savers.efetivo(rowsToSave);
      toast.success("Efetivo operacional atualizado e gravado com sucesso!");
      setIsEditing(false);
      setLocalEdits({});
      await refresh();
    } catch (err) {
      console.error("Erro ao salvar efetivo:", err);
      toast.error("Falha ao salvar alterações no efetivo", {
        description: (err as Error)?.message,
      });
    } finally {
      setIsSaving(false);
    }
  }, [efetivoCalculado, rawData.efetivo, savers, refresh]);

  const handleCancelEdits = useCallback(() => {
    setLocalEdits({});
    setIsEditing(false);
    toast.info("Edições descartadas.");
  }, []);

  const handleExportXlsx = useCallback(() => {
    try {
      exportEfetivoMapasXlsx(effectiveSheetsData, reportDate);
      toast.success("Planilha EFETIVO.xlsx (Mapas) exportada com sucesso!");
    } catch (e) {
      toast.error("Falha ao exportar planilha de efetivo", {
        description: (e as Error)?.message,
      });
    }
  }, [effectiveSheetsData, reportDate]);

  const handleExportJson = useCallback(() => {
    try {
      exportEfetivoMapasJson(effectiveSheetsData, reportDate);
      toast.success("Arquivo JSON para o Projeto Mapas exportado com sucesso!");
    } catch (e) {
      toast.error("Falha ao exportar JSON de efetivo", {
        description: (e as Error)?.message,
      });
    }
  }, [effectiveSheetsData, reportDate]);

  const handleCopyApiUrl = useCallback(() => {
    const origin = typeof window !== "undefined" ? window.location.origin : "";
    const dateStr = reportDate ? reportDate.toISOString().slice(0, 10) : "";
    const apiUrl = `${origin}/api/public/efetivo?date=${dateStr}&format=json`;
    navigator.clipboard.writeText(apiUrl);
    setCopiedApi(true);
    toast.success("Link da API copiado para a área de transferência!", {
      description: apiUrl,
    });
    setTimeout(() => setCopiedApi(false), 3000);
  }, [reportDate]);

  const isBooting = configQuery.isLoading || (dataQuery.isLoading && !dataQuery.isPlaceholderData);

  const { municipios, bases, resumo, totals } = efetivoCalculado;

  return (
    <div className="min-h-dvh bg-gradient-brand-soft">
      <DashboardHeader
        header={rawData.header ?? {}}
        configured
        error={rawPayload?.error}
        isAdmin={!!cfg?.isAdmin}
        onOpenSettings={() => {}}
      />

      <main className="w-full max-w-[98%] mx-auto px-3 sm:px-4 md:px-6 py-4 sm:py-6 space-y-5 sm:space-y-6">
        {isBooting ? (
          <DashboardSkeleton />
        ) : (
          <>
            {/* TOOLBAR SUPERIOR DO EFETIVO */}
            <div className="relative overflow-hidden rounded-2xl border border-border bg-card shadow-elevated p-4 sm:p-6 animate-fade-in-soft">
              <div aria-hidden="true" className="absolute inset-x-0 top-0 h-1 bg-gradient-brand" />
              <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4">
                <div className="space-y-1.5">
                  <div className="flex items-center gap-2 text-[11px] uppercase tracking-wider font-bold text-muted-foreground">
                    <span className="inline-flex items-center gap-1 text-emerald-700 dark:text-emerald-400">
                      <Radio className="w-3.5 h-3.5 animate-pulse" />
                      Sincronização em Tempo Real
                    </span>
                    <span>·</span>
                    <span>Consumo do Projeto Mapas</span>
                  </div>
                  <h1 className="text-2xl sm:text-3xl font-display font-bold text-foreground tracking-tight flex items-center gap-2">
                    <Users className="w-7 h-7 text-emerald-700 dark:text-emerald-400" />
                    Quadro Geral de Efetivo & Bases
                  </h1>
                  <p className="text-sm text-muted-foreground max-w-3xl">
                    Visualização institucional fiel ao modelo oficial{" "}
                    <code className="text-xs font-mono bg-muted px-1.5 py-0.5 rounded border">
                      EFETIVO.xlsx
                    </code>
                    . Dados consumidos diretamente pela Sala de Situação e pelo Sistema de Mapas
                    Táticos do CBMAM.
                  </p>
                </div>

                {/* CONTROLES E EXPORTAÇÃO */}
                <div className="flex flex-wrap items-center gap-2.5">
                  {/* Seletor de Data */}
                  <Popover>
                    <PopoverTrigger asChild>
                      <Button
                        variant="outline"
                        size="sm"
                        className="h-10 px-3.5 gap-2 border-border/70 hover:border-emerald-600 bg-background font-medium"
                      >
                        <CalendarIcon className="w-4 h-4 text-emerald-700" />
                        <span>{reportDate ? fmtDateBR(reportDate) : "Data de hoje"}</span>
                      </Button>
                    </PopoverTrigger>
                    <PopoverContent align="end" className="w-auto p-0 shadow-2xl border-border">
                      <LazyCalendar
                        mode="single"
                        selected={reportDate ?? undefined}
                        onSelect={(d) => setReportDate(d ?? null)}
                        initialFocus
                      />
                    </PopoverContent>
                  </Popover>

                  {/* Recarregar */}
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => refresh()}
                    className="h-10 px-3 border-border/70 hover:bg-muted"
                    title="Atualizar dados"
                  >
                    <RefreshCw className="w-4 h-4 text-muted-foreground" />
                  </Button>

                  {/* Exportar XLSX (Mapas) */}
                  <Button
                    onClick={handleExportXlsx}
                    className="h-10 px-4 bg-emerald-700 hover:bg-emerald-800 text-white font-bold gap-2 shadow-sm"
                  >
                    <FileSpreadsheet className="w-4 h-4" />
                    <span>Exportar Efetivo (.xlsx)</span>
                  </Button>

                  {/* Exportar JSON (Mapas) */}
                  <Button
                    variant="secondary"
                    onClick={handleExportJson}
                    className="h-10 px-3.5 border border-border/70 font-semibold gap-2 hover:bg-accent"
                    title="Baixar JSON estruturado para ingestão no projeto Mapas"
                  >
                    <Download className="w-4 h-4 text-primary" />
                    <span>JSON (Mapas)</span>
                  </Button>

                  {/* Botão de Edição de Efetivo */}
                  {!isEditing ? (
                    <Button
                      variant="default"
                      onClick={() => setIsEditing(true)}
                      className="h-10 px-4 bg-amber-600 hover:bg-amber-700 text-white font-bold gap-2 shadow-sm"
                      title="Ativar edição direta dos valores de efetivo nas tabelas"
                    >
                      <Edit3 className="w-4 h-4" />
                      <span>Editar Efetivo</span>
                    </Button>
                  ) : (
                    <div className="flex items-center gap-2">
                      <Button
                        onClick={handleSaveEdits}
                        disabled={isSaving}
                        className="h-10 px-4 bg-emerald-700 hover:bg-emerald-800 text-white font-bold gap-2 shadow-sm"
                        title="Salvar alterações no banco de dados"
                      >
                        {isSaving ? (
                          <RefreshCw className="w-4 h-4 animate-spin" />
                        ) : (
                          <Save className="w-4 h-4" />
                        )}
                        <span>{isSaving ? "Salvando..." : "Salvar Alterações"}</span>
                      </Button>
                      <Button
                        variant="outline"
                        onClick={handleCancelEdits}
                        disabled={isSaving}
                        className="h-10 px-3.5 border-border hover:bg-destructive/10 hover:text-destructive hover:border-destructive/30 font-medium gap-1.5"
                        title="Descartar alterações locais e sair do modo de edição"
                      >
                        <X className="w-4 h-4" />
                        <span>Cancelar</span>
                      </Button>
                    </div>
                  )}

                  {/* Copiar API */}
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={handleCopyApiUrl}
                    className="h-10 px-3 text-muted-foreground hover:text-foreground"
                    title="Copiar URL pública da API de Efetivo"
                  >
                    {copiedApi ? (
                      <CheckCircle2 className="w-4 h-4 text-emerald-600" />
                    ) : (
                      <Copy className="w-4 h-4" />
                    )}
                  </Button>
                </div>
              </div>
            </div>

            {/* BANNER INFORMATIVO DE EDIÇÃO ATIVA */}
            {isEditing && (
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 p-4 bg-amber-500/10 border-2 border-amber-500/40 rounded-2xl text-amber-950 dark:text-amber-100 shadow-sm animate-fade-in-soft">
                <div className="flex items-center gap-3">
                  <div className="p-2 rounded-xl bg-amber-500/20 text-amber-700 dark:text-amber-300 shrink-0">
                    <Edit3 className="w-5 h-5" />
                  </div>
                  <div>
                    <p className="text-sm font-bold flex items-center gap-2">
                      Modo de Edição de Efetivo Ativado
                      <Badge variant="secondary" className="bg-amber-500/20 text-amber-800 dark:text-amber-300 text-[10px] uppercase font-bold">
                        Edição Direta
                      </Badge>
                    </p>
                    <p className="text-xs text-muted-foreground mt-0.5">
                      Altere os números nas células das tabelas abaixo. Subtotais, totais e o resumo por missão são recalculados em tempo real. Clique em <strong>Salvar Alterações</strong> para persistir no banco de dados.
                    </p>
                  </div>
                </div>
                <div className="flex items-center gap-2 shrink-0">
                  <Button
                    size="sm"
                    onClick={handleSaveEdits}
                    disabled={isSaving}
                    className="h-9 px-4 bg-emerald-700 hover:bg-emerald-800 text-white font-bold text-xs gap-1.5 shadow-sm"
                  >
                    {isSaving ? <RefreshCw className="w-3.5 h-3.5 animate-spin" /> : <Save className="w-3.5 h-3.5" />}
                    {isSaving ? "Salvando..." : "Salvar"}
                  </Button>
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={handleCancelEdits}
                    disabled={isSaving}
                    className="h-9 px-3 text-xs border-border hover:bg-destructive/10 hover:text-destructive"
                  >
                    <X className="w-3.5 h-3.5 mr-1" />
                    Cancelar
                  </Button>
                </div>
              </div>
            )}

            {/* SELETOR DE MODO: CONSOLIDADO (1.533) vs DIÁRIO */}
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-3 bg-card border border-border/80 rounded-2xl p-3.5 sm:p-4 shadow-sm">
              <div className="flex flex-col sm:flex-row sm:items-center gap-2.5">
                <span className="text-xs font-bold uppercase tracking-wider text-muted-foreground whitespace-nowrap">
                  Visualização:
                </span>
                <div className="inline-flex rounded-xl p-1 bg-muted/80 border border-border/60">
                  <button
                    type="button"
                    onClick={() => setViewMode("consolidado")}
                    className={`px-3.5 py-1.5 text-xs font-bold rounded-lg transition-all flex items-center gap-2 cursor-pointer ${
                      viewMode === "consolidado"
                        ? "bg-emerald-700 text-white shadow-sm"
                        : "text-muted-foreground hover:text-foreground"
                    }`}
                  >
                    <Shield className="w-3.5 h-3.5" />
                    <span>Total Consolidado da Operação (1.533)</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => setViewMode("diario")}
                    className={`px-3.5 py-1.5 text-xs font-bold rounded-lg transition-all flex items-center gap-2 cursor-pointer ${
                      viewMode === "diario"
                        ? "bg-emerald-700 text-white shadow-sm"
                        : "text-muted-foreground hover:text-foreground"
                    }`}
                  >
                    <CalendarIcon className="w-3.5 h-3.5" />
                    <span>Efetivo do Dia ({reportDate ? fmtDateBR(reportDate) : "Data Selecionada"})</span>
                  </button>
                </div>
              </div>
              <div className="flex items-center gap-2 text-xs">
                {viewMode === "consolidado" ? (
                  <Badge variant="outline" className="bg-emerald-500/10 text-emerald-700 dark:text-emerald-300 border-emerald-500/30 font-semibold py-1">
                    Matriz Oficial Consolidada · 1.533 Operacionais (26 Municípios + 9 Bases)
                  </Badge>
                ) : (
                  <Badge variant="outline" className="bg-blue-500/10 text-blue-700 dark:text-blue-300 border-blue-500/30 font-semibold py-1">
                    Efetivo Diário da Sala de Situação ({reportDate ? fmtDateBR(reportDate) : "Hoje"})
                  </Badge>
                )}
              </div>
            </div>

            {/* CARDS DE INDICADORES / KPI */}
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3.5 sm:gap-4">
              {/* Total Geral */}
              <Card className="border-border/80 shadow-sm relative overflow-hidden bg-gradient-to-br from-card to-emerald-500/5">
                <CardContent className="p-4 sm:p-5">
                  <div className="flex items-center justify-between">
                    <span className="text-xs uppercase tracking-wider font-bold text-muted-foreground">
                      Efetivo Total Integrado
                    </span>
                    <div className="p-2 rounded-xl bg-emerald-100 dark:bg-emerald-950/50 text-emerald-800 dark:text-emerald-300">
                      <Shield className="w-5 h-5" />
                    </div>
                  </div>
                  <div className="mt-3 flex items-baseline gap-2">
                    <span className="text-3xl sm:text-4xl font-extrabold font-display text-foreground">
                      {totals.totalGeral}
                    </span>
                    <span className="text-xs text-muted-foreground">operacionais em campo</span>
                  </div>
                  <div className="mt-2 text-[11px] text-muted-foreground flex items-center gap-1.5">
                    <Badge variant="outline" className="text-[10px] font-semibold bg-emerald-500/10 text-emerald-700 dark:text-emerald-300 border-emerald-500/30">
                      100% Cobertura
                    </Badge>
                    <span>Capital + Interior + Bases</span>
                  </div>
                </CardContent>
              </Card>

              {/* Capital / Manaus */}
              <Card className="border-border/80 shadow-sm relative overflow-hidden">
                <CardContent className="p-4 sm:p-5">
                  <div className="flex items-center justify-between">
                    <span className="text-xs uppercase tracking-wider font-bold text-muted-foreground">
                      Capital (Manaus)
                    </span>
                    <div className="p-2 rounded-xl bg-blue-100 dark:bg-blue-950/50 text-blue-800 dark:text-blue-300">
                      <Building2 className="w-5 h-5" />
                    </div>
                  </div>
                  <div className="mt-3 flex items-baseline gap-2">
                    <span className="text-3xl sm:text-4xl font-extrabold font-display text-blue-700 dark:text-blue-400">
                      {totals.capital}
                    </span>
                    <span className="text-xs text-muted-foreground">
                      ({totals.totalGeral > 0 ? ((totals.capital / totals.totalGeral) * 100).toFixed(1) : 0}%)
                    </span>
                  </div>
                  <div className="mt-2 text-[11px] text-muted-foreground">
                    Sede do Comando Geral & Região Metropolitana
                  </div>
                </CardContent>
              </Card>

              {/* Interior */}
              <Card className="border-border/80 shadow-sm relative overflow-hidden">
                <CardContent className="p-4 sm:p-5">
                  <div className="flex items-center justify-between">
                    <span className="text-xs uppercase tracking-wider font-bold text-muted-foreground">
                      Comando Interior
                    </span>
                    <div className="p-2 rounded-xl bg-amber-100 dark:bg-amber-950/50 text-amber-800 dark:text-amber-300">
                      <MapPin className="w-5 h-5" />
                    </div>
                  </div>
                  <div className="mt-3 flex items-baseline gap-2">
                    <span className="text-3xl sm:text-4xl font-extrabold font-display text-amber-700 dark:text-amber-400">
                      {totals.interior - totals.bases}
                    </span>
                    <span className="text-xs text-muted-foreground">nos municípios polo</span>
                  </div>
                  <div className="mt-2 text-[11px] text-muted-foreground">
                    Pelotões e postos nos municípios do interior
                  </div>
                </CardContent>
              </Card>

              {/* Bases Temporárias */}
              <Card className="border-border/80 shadow-sm relative overflow-hidden">
                <CardContent className="p-4 sm:p-5">
                  <div className="flex items-center justify-between">
                    <span className="text-xs uppercase tracking-wider font-bold text-muted-foreground">
                      Bases Temporárias
                    </span>
                    <div className="p-2 rounded-xl bg-orange-100 dark:bg-orange-950/50 text-orange-800 dark:text-orange-300">
                      <Tent className="w-5 h-5" />
                    </div>
                  </div>
                  <div className="mt-3 flex items-baseline gap-2">
                    <span className="text-3xl sm:text-4xl font-extrabold font-display text-orange-600 dark:text-orange-400">
                      {totals.bases}
                    </span>
                    <span className="text-xs text-muted-foreground">em 9 bases avançadas</span>
                  </div>
                  <div className="mt-2 text-[11px] text-muted-foreground">
                    Postos estratégicos de combate florestal
                  </div>
                </CardContent>
              </Card>
            </div>

            {/* SELETOR DE ABAS DE VISUALIZAÇÃO */}
            <div className="flex items-center justify-between border-b border-border pb-3">
              <div className="flex items-center gap-1.5 p-1 bg-muted/60 rounded-xl border border-border/50 text-xs font-semibold">
                <button
                  type="button"
                  onClick={() => setActiveTab("todos")}
                  className={`px-3 py-1.5 rounded-lg transition-all ${
                    activeTab === "todos"
                      ? "bg-card text-foreground shadow-sm font-bold"
                      : "text-muted-foreground hover:text-foreground"
                  }`}
                >
                  Visão Geral 3-em-1
                </button>
                <button
                  type="button"
                  onClick={() => setActiveTab("municipios")}
                  className={`px-3 py-1.5 rounded-lg transition-all ${
                    activeTab === "municipios"
                      ? "bg-card text-foreground shadow-sm font-bold"
                      : "text-muted-foreground hover:text-foreground"
                  }`}
                >
                  Municípios ({municipios.length})
                </button>
                <button
                  type="button"
                  onClick={() => setActiveTab("bases")}
                  className={`px-3 py-1.5 rounded-lg transition-all ${
                    activeTab === "bases"
                      ? "bg-card text-foreground shadow-sm font-bold"
                      : "text-muted-foreground hover:text-foreground"
                  }`}
                >
                  Bases Temporárias ({bases.length})
                </button>
                <button
                  type="button"
                  onClick={() => setActiveTab("resumo")}
                  className={`px-3 py-1.5 rounded-lg transition-all ${
                    activeTab === "resumo"
                      ? "bg-card text-foreground shadow-sm font-bold"
                      : "text-muted-foreground hover:text-foreground"
                  }`}
                >
                  Resumo por Missão
                </button>
              </div>

              <div className="text-xs text-muted-foreground hidden sm:block">
                Referência: <span className="font-semibold text-foreground">{fmtDateBR(reportDate ?? new Date())}</span>
              </div>
            </div>

            {/* TABELA 1: MUNICÍPIOS (BLOCO DA ESQUERDA) */}
            {(activeTab === "todos" || activeTab === "municipios") && (
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <Building2 className="w-5 h-5 text-emerald-700 dark:text-emerald-400" />
                    <h2 className="text-lg font-bold font-display text-foreground">
                      1. Efetivo por Município ({municipios.length} municípios)
                    </h2>
                  </div>
                  <Badge variant="outline" className="text-xs">
                    Subtotal: {municipios.reduce((s, m) => s + m.total, 0)} operacionais
                  </Badge>
                </div>

                <div className="overflow-x-auto rounded-xl border border-border bg-card shadow-sm">
                  <table className="w-full text-xs text-left border-collapse">
                    <thead className="bg-muted/80 text-[11px] font-bold uppercase tracking-wider text-muted-foreground border-b border-border">
                      <tr>
                        <th className="p-2.5 pl-3">Município</th>
                        <th className="p-2.5 text-right font-mono">Serviço OP</th>
                        <th className="p-2.5 text-right font-mono">OPAMV 26/10</th>
                        <th className="p-2.5 text-right font-mono">OPAM REF</th>
                        <th className="p-2.5 text-right font-mono">INC 1 29/10</th>
                        <th className="p-2.5 text-right font-mono">INC 2 17/11</th>
                        <th className="p-2.5 text-right font-mono">INC 3 30/10</th>
                        <th className="p-2.5 text-right font-mono">CBMSP</th>
                        <th className="p-2.5 text-right font-mono">PREVFOGO</th>
                        <th className="p-2.5 text-right font-mono">FN</th>
                        <th className="p-2.5 text-right font-mono">Brig. Mun</th>
                        <th className="p-2.5 text-right font-mono">Brig. SEMA</th>
                        <th className="p-2.5 pr-3 text-right font-mono font-extrabold text-foreground bg-muted">
                          Total
                        </th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-border/60">
                      {municipios.map((m) => {
                        const isCap = m.tipo === "capital";
                        return (
                          <tr
                            key={m.id}
                            className={`hover:bg-muted/40 transition-colors ${
                              isCap ? "bg-emerald-50/40 dark:bg-emerald-950/20 font-semibold" : ""
                            }`}
                          >
                            <td className="p-2.5 pl-3 flex items-center gap-1.5">
                              {isCap ? (
                                <Badge variant="secondary" className="text-[10px] bg-emerald-600 text-white font-bold px-1.5 py-0">
                                  Capital
                                </Badge>
                              ) : null}
                              <span className="font-medium text-foreground">{m.nome}</span>
                            </td>
                            <td className="p-2 text-right font-mono">
                              <EditableCell
                                value={m.serv_ord}
                                isEditing={isEditing}
                                onChange={(v) => handleCellChange(m.nome, "serv_ord", v)}
                              />
                            </td>
                            <td className="p-2 text-right font-mono">
                              <EditableCell
                                value={m.opamv}
                                isEditing={isEditing}
                                onChange={(v) => handleCellChange(m.nome, "opamv", v)}
                              />
                            </td>
                            <td className="p-2 text-right font-mono">
                              <EditableCell
                                value={m.opam_ref}
                                isEditing={isEditing}
                                onChange={(v) => handleCellChange(m.nome, "opam_ref", v)}
                              />
                            </td>
                            <td className="p-2 text-right font-mono">
                              <EditableCell
                                value={m.inc1}
                                isEditing={isEditing}
                                onChange={(v) => handleCellChange(m.nome, "inc1", v)}
                              />
                            </td>
                            <td className="p-2 text-right font-mono">
                              <EditableCell
                                value={m.inc2}
                                isEditing={isEditing}
                                onChange={(v) => handleCellChange(m.nome, "inc2", v)}
                              />
                            </td>
                            <td className="p-2 text-right font-mono">
                              <EditableCell
                                value={m.inc3}
                                isEditing={isEditing}
                                onChange={(v) => handleCellChange(m.nome, "inc3", v)}
                              />
                            </td>
                            <td className="p-2 text-right font-mono">
                              <EditableCell
                                value={m.cbmsp}
                                isEditing={isEditing}
                                onChange={(v) => handleCellChange(m.nome, "cbmsp", v)}
                              />
                            </td>
                            <td className="p-2 text-right font-mono">
                              <EditableCell
                                value={m.prevfogo}
                                isEditing={isEditing}
                                onChange={(v) => handleCellChange(m.nome, "prevfogo", v)}
                              />
                            </td>
                            <td className="p-2 text-right font-mono">
                              <EditableCell
                                value={m.fn}
                                isEditing={isEditing}
                                onChange={(v) => handleCellChange(m.nome, "fn", v)}
                              />
                            </td>
                            <td className="p-2 text-right font-mono">
                              <EditableCell
                                value={m.brig_mun}
                                isEditing={isEditing}
                                onChange={(v) => handleCellChange(m.nome, "brig_mun", v)}
                              />
                            </td>
                            <td className="p-2 text-right font-mono">
                              <EditableCell
                                value={m.brig_semas}
                                isEditing={isEditing}
                                onChange={(v) => handleCellChange(m.nome, "brig_semas", v)}
                              />
                            </td>
                            <td className="p-2.5 pr-3 text-right font-mono font-bold text-foreground bg-muted/40">
                              {m.total}
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                    <tfoot className="bg-muted font-bold text-foreground border-t-2 border-border text-[11px]">
                      <tr>
                        <td className="p-2.5 pl-3 uppercase">Total Municípios</td>
                        <td className="p-2.5 text-right font-mono">
                          {municipios.reduce((s, m) => s + m.serv_ord, 0)}
                        </td>
                        <td className="p-2.5 text-right font-mono">
                          {municipios.reduce((s, m) => s + m.opamv, 0)}
                        </td>
                        <td className="p-2.5 text-right font-mono">
                          {municipios.reduce((s, m) => s + m.opam_ref, 0)}
                        </td>
                        <td className="p-2.5 text-right font-mono">
                          {municipios.reduce((s, m) => s + m.inc1, 0)}
                        </td>
                        <td className="p-2.5 text-right font-mono">
                          {municipios.reduce((s, m) => s + m.inc2, 0)}
                        </td>
                        <td className="p-2.5 text-right font-mono">
                          {municipios.reduce((s, m) => s + m.inc3, 0)}
                        </td>
                        <td className="p-2.5 text-right font-mono">
                          {municipios.reduce((s, m) => s + m.cbmsp, 0)}
                        </td>
                        <td className="p-2.5 text-right font-mono">
                          {municipios.reduce((s, m) => s + m.prevfogo, 0)}
                        </td>
                        <td className="p-2.5 text-right font-mono">
                          {municipios.reduce((s, m) => s + m.fn, 0)}
                        </td>
                        <td className="p-2.5 text-right font-mono">
                          {municipios.reduce((s, m) => s + m.brig_mun, 0)}
                        </td>
                        <td className="p-2.5 text-right font-mono">
                          {municipios.reduce((s, m) => s + m.brig_semas, 0)}
                        </td>
                        <td className="p-2.5 pr-3 text-right font-mono font-extrabold text-emerald-700 dark:text-emerald-400 bg-muted">
                          {municipios.reduce((s, m) => s + m.total, 0)}
                        </td>
                      </tr>
                    </tfoot>
                  </table>
                </div>
              </div>
            )}

            {/* TABELA 2: BASES TEMPORÁRIAS (BLOCO DO MEIO) */}
            {(activeTab === "todos" || activeTab === "bases") && (
              <div className="space-y-3 pt-2">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <Tent className="w-5 h-5 text-orange-600 dark:text-orange-400" />
                    <h2 className="text-lg font-bold font-display text-foreground">
                      2. Bases Temporárias de Combate ({bases.length} bases ativas)
                    </h2>
                  </div>
                  <Badge variant="outline" className="text-xs bg-orange-500/10 text-orange-700 dark:text-orange-300 border-orange-500/30">
                    Subtotal: {totals.bases} operacionais
                  </Badge>
                </div>

                <div className="overflow-x-auto rounded-xl border border-border bg-card shadow-sm">
                  <table className="w-full text-xs text-left border-collapse">
                    <thead className="bg-muted/80 text-[11px] font-bold uppercase tracking-wider text-muted-foreground border-b border-border">
                      <tr>
                        <th className="p-2.5 pl-3">Base Temporária</th>
                        <th className="p-2.5 text-right font-mono">OPAMV 26/10</th>
                        <th className="p-2.5 text-right font-mono">OPAM REF</th>
                        <th className="p-2.5 text-right font-mono">INC 1 29/10</th>
                        <th className="p-2.5 text-right font-mono">INC 2 17/11</th>
                        <th className="p-2.5 text-right font-mono">INC 3 30/10</th>
                        <th className="p-2.5 text-right font-mono">CBMSP</th>
                        <th className="p-2.5 text-right font-mono">PREVFOGO</th>
                        <th className="p-2.5 text-right font-mono">Marinha</th>
                        <th className="p-2.5 text-right font-mono">FN</th>
                        <th className="p-2.5 text-right font-mono">Brig. Mun</th>
                        <th className="p-2.5 text-right font-mono">Brig. SEMA</th>
                        <th className="p-2.5 pr-3 text-right font-mono font-extrabold text-foreground bg-muted">
                          Total Geral
                        </th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-border/60">
                      {bases.map((b) => (
                        <tr key={b.id} className="hover:bg-muted/40 transition-colors">
                          <td className="p-2.5 pl-3 font-semibold text-foreground flex items-center gap-1.5">
                            <span className="w-2 h-2 rounded-full bg-orange-500 shrink-0" />
                            {b.nome}
                          </td>
                          <td className="p-2 text-right font-mono">
                            <EditableCell
                              value={b.opamv}
                              isEditing={isEditing}
                              onChange={(v) => handleCellChange(b.nome, "opamv", v)}
                            />
                          </td>
                          <td className="p-2 text-right font-mono">
                            <EditableCell
                              value={b.opam_ref}
                              isEditing={isEditing}
                              onChange={(v) => handleCellChange(b.nome, "opam_ref", v)}
                            />
                          </td>
                          <td className="p-2 text-right font-mono">
                            <EditableCell
                              value={b.inc1}
                              isEditing={isEditing}
                              onChange={(v) => handleCellChange(b.nome, "inc1", v)}
                            />
                          </td>
                          <td className="p-2 text-right font-mono">
                            <EditableCell
                              value={b.inc2}
                              isEditing={isEditing}
                              onChange={(v) => handleCellChange(b.nome, "inc2", v)}
                            />
                          </td>
                          <td className="p-2 text-right font-mono">
                            <EditableCell
                              value={b.inc3}
                              isEditing={isEditing}
                              onChange={(v) => handleCellChange(b.nome, "inc3", v)}
                            />
                          </td>
                          <td className="p-2 text-right font-mono">
                            <EditableCell
                              value={b.cbmsp}
                              isEditing={isEditing}
                              onChange={(v) => handleCellChange(b.nome, "cbmsp", v)}
                            />
                          </td>
                          <td className="p-2 text-right font-mono">
                            <EditableCell
                              value={b.prevfogo}
                              isEditing={isEditing}
                              onChange={(v) => handleCellChange(b.nome, "prevfogo", v)}
                            />
                          </td>
                          <td className="p-2 text-right font-mono">
                            <EditableCell
                              value={b.marinha}
                              isEditing={isEditing}
                              onChange={(v) => handleCellChange(b.nome, "marinha", v)}
                            />
                          </td>
                          <td className="p-2 text-right font-mono">
                            <EditableCell
                              value={b.fn}
                              isEditing={isEditing}
                              onChange={(v) => handleCellChange(b.nome, "fn", v)}
                            />
                          </td>
                          <td className="p-2 text-right font-mono">
                            <EditableCell
                              value={b.brig_mun}
                              isEditing={isEditing}
                              onChange={(v) => handleCellChange(b.nome, "brig_mun", v)}
                            />
                          </td>
                          <td className="p-2 text-right font-mono">
                            <EditableCell
                              value={b.brig_semas}
                              isEditing={isEditing}
                              onChange={(v) => handleCellChange(b.nome, "brig_semas", v)}
                            />
                          </td>
                          <td className="p-2.5 pr-3 text-right font-mono font-bold text-foreground bg-muted/40">
                            {b.total}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                    <tfoot className="bg-muted font-bold text-foreground border-t-2 border-border text-[11px]">
                      <tr>
                        <td className="p-2.5 pl-3 uppercase">Total Bases Temporárias</td>
                        <td className="p-2.5 text-right font-mono">
                          {bases.reduce((s, b) => s + b.opamv, 0)}
                        </td>
                        <td className="p-2.5 text-right font-mono">
                          {bases.reduce((s, b) => s + b.opam_ref, 0)}
                        </td>
                        <td className="p-2.5 text-right font-mono">
                          {bases.reduce((s, b) => s + b.inc1, 0)}
                        </td>
                        <td className="p-2.5 text-right font-mono">
                          {bases.reduce((s, b) => s + b.inc2, 0)}
                        </td>
                        <td className="p-2.5 text-right font-mono">
                          {bases.reduce((s, b) => s + b.inc3, 0)}
                        </td>
                        <td className="p-2.5 text-right font-mono">
                          {bases.reduce((s, b) => s + b.cbmsp, 0)}
                        </td>
                        <td className="p-2.5 text-right font-mono">
                          {bases.reduce((s, b) => s + b.prevfogo, 0)}
                        </td>
                        <td className="p-2.5 text-right font-mono">
                          {bases.reduce((s, b) => s + b.marinha, 0)}
                        </td>
                        <td className="p-2.5 text-right font-mono">
                          {bases.reduce((s, b) => s + b.fn, 0)}
                        </td>
                        <td className="p-2.5 text-right font-mono">
                          {bases.reduce((s, b) => s + b.brig_mun, 0)}
                        </td>
                        <td className="p-2.5 text-right font-mono">
                          {bases.reduce((s, b) => s + b.brig_semas, 0)}
                        </td>
                        <td className="p-2.5 pr-3 text-right font-mono font-extrabold text-orange-600 dark:text-orange-400 bg-muted">
                          {bases.reduce((s, b) => s + b.total, 0)}
                        </td>
                      </tr>
                    </tfoot>
                  </table>
                </div>
              </div>
            )}

            {/* TABELA 3: RESUMO GERAL POR MISSÃO (BLOCO DA DIREITA) */}
            {(activeTab === "todos" || activeTab === "resumo") && (
              <div className="space-y-3 pt-2">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <Shield className="w-5 h-5 text-emerald-700 dark:text-emerald-400" />
                    <h2 className="text-lg font-bold font-display text-foreground">
                      3. Resumo Consolidado por Missão (Capital x Interior x Total)
                    </h2>
                  </div>
                  <Badge variant="outline" className="text-xs bg-emerald-500/10 text-emerald-700 dark:text-emerald-300 border-emerald-500/30">
                    Total Operacional: {totals.totalGeral}
                  </Badge>
                </div>

                <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                  {/* Tabela do Resumo */}
                  <div className="lg:col-span-2 overflow-x-auto rounded-xl border border-border bg-card shadow-sm">
                    <table className="w-full text-xs text-left border-collapse">
                      <thead className="bg-muted/80 text-[11px] font-bold uppercase tracking-wider text-muted-foreground border-b border-border">
                        <tr>
                          <th className="p-2.5 pl-3">Missão / Força Operacional</th>
                          <th className="p-2.5 text-right font-mono text-blue-700 dark:text-blue-400">Capital</th>
                          <th className="p-2.5 text-right font-mono text-amber-700 dark:text-amber-400">Interior</th>
                          <th className="p-2.5 text-right font-mono font-bold text-foreground">Total</th>
                          <th className="p-2.5 pr-3 text-right font-mono">Participação</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-border/60">
                        {resumo.map((r, i) => (
                          <tr key={r.missao || i} className="hover:bg-muted/40 transition-colors">
                            <td className="p-2.5 pl-3">
                              <div className="font-bold text-foreground">{r.missao}</div>
                              <div className="text-[11px] text-muted-foreground">{r.label}</div>
                            </td>
                            <td className="p-2.5 text-right font-mono font-semibold text-blue-700 dark:text-blue-400">
                              {r.capital}
                            </td>
                            <td className="p-2.5 text-right font-mono font-semibold text-amber-700 dark:text-amber-400">
                              {r.interior}
                            </td>
                            <td className="p-2.5 text-right font-mono font-bold text-foreground">
                              {r.total}
                            </td>
                            <td className="p-2.5 pr-3 text-right font-mono text-muted-foreground">
                              {r.perc}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                      <tfoot className="bg-muted font-bold text-foreground border-t-2 border-border text-[11px]">
                        <tr>
                          <td className="p-2.5 pl-3 uppercase">Total Geral Integrado</td>
                          <td className="p-2.5 text-right font-mono text-blue-700 dark:text-blue-400 text-sm">
                            {totals.capital}
                          </td>
                          <td className="p-2.5 text-right font-mono text-amber-700 dark:text-amber-400 text-sm">
                            {totals.interior}
                          </td>
                          <td className="p-2.5 text-right font-mono text-emerald-700 dark:text-emerald-400 text-sm font-extrabold">
                            {totals.totalGeral}
                          </td>
                          <td className="p-2.5 pr-3 text-right font-mono text-foreground font-extrabold">
                            100.0%
                          </td>
                        </tr>
                      </tfoot>
                    </table>
                  </div>

                  {/* Card Explicativo de Integração Mapas */}
                  <div className="space-y-4">
                    <Card className="border-border bg-gradient-to-br from-card to-muted/40 p-4 sm:p-5">
                      <div className="space-y-3">
                        <div className="flex items-center gap-2 text-primary font-bold text-sm">
                          <Share2 className="w-4 h-4" />
                          Integração com o Projeto Mapas
                        </div>
                        <p className="text-xs text-muted-foreground leading-relaxed">
                          O sistema <strong>Mapas Táticos CBMAM</strong> utiliza as matrizes desta aba
                          para posicionar automaticamente militares, viaturas e brigadas sobre a malha
                          geográfica dos 62 municípios e bases temporárias do Amazonas.
                        </p>
                        <div className="space-y-2 pt-2 text-xs">
                          <div className="flex items-center justify-between p-2 rounded-lg bg-background border border-border">
                            <span className="font-medium text-foreground">Formato XLSX</span>
                            <span className="font-mono text-[11px] text-muted-foreground">3 abas oficiais</span>
                          </div>
                          <div className="flex items-center justify-between p-2 rounded-lg bg-background border border-border">
                            <span className="font-medium text-foreground">Formato JSON</span>
                            <span className="font-mono text-[11px] text-muted-foreground">efetivoDB v1.0</span>
                          </div>
                          <div className="flex items-center justify-between p-2 rounded-lg bg-background border border-border">
                            <span className="font-medium text-foreground">Endpoint API</span>
                            <span className="font-mono text-[11px] text-emerald-600 dark:text-emerald-400">/api/public/efetivo</span>
                          </div>
                        </div>

                        <div className="pt-2 flex flex-col gap-2">
                          <Button
                            onClick={handleExportXlsx}
                            className="w-full bg-emerald-700 hover:bg-emerald-800 text-white font-bold h-9 text-xs gap-1.5"
                          >
                            <FileSpreadsheet className="w-3.5 h-3.5" />
                            Baixar Planilha do Mapa (.xlsx)
                          </Button>
                          <Button
                            variant="outline"
                            onClick={handleExportJson}
                            className="w-full font-semibold h-9 text-xs gap-1.5 border-border"
                          >
                            <Download className="w-3.5 h-3.5" />
                            Baixar Matriz JSON para o Mapas
                          </Button>
                        </div>
                      </div>
                    </Card>
                  </div>
                </div>
              </div>
            )}
          </>
        )}
      </main>

      <ScrollToTop />
      <DashboardFooter />
    </div>
  );
}
