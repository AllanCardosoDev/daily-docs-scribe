import { createFileRoute, Link } from "@tanstack/react-router";
import * as React from "react";
import { useState, useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import {
  Flame,
  Search,
  Filter,
  RefreshCw,
  FileSpreadsheet,
  ExternalLink,
  MapPin,
  Calendar,
  Clock,
  ShieldAlert,
  TreePine,
  Satellite,
  Sun,
  Moon,
  Zap,
  Layers,
  ArrowLeft,
  ChevronRight,
  Info,
  CheckCircle2,
  AlertTriangle,
  Radio,
  Eye,
  Crosshair,
  Building,
} from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import {
  getPainelDoFogoOverview,
  getPainelDoFogoEventoDetalhes,
  AMAZONAS_MUNICIPALITY_CENTROIDS,
} from "@/lib/painel-do-fogo.functions";
import type {
  PainelDoFogoEvento,
  PainelDoFogoFoco,
  PainelDoFogoDeteccao,
  PainelDoFogoCar,
} from "@/lib/painel-do-fogo.types";
import { exportFocosXlsx } from "@/lib/export-focos";
import { NF } from "@/lib/formatters";

export const Route = createFileRoute("/_authenticated/focos")({
  ssr: false,
  head: () => ({
    meta: [
      { title: "Painel do Fogo (CENSIPAM) · Focos & Queimadas no Amazonas" },
      { name: "robots", content: "noindex" },
    ],
  }),
  component: FocosPage,
});

function FocosPage() {
  const [dataRef, setDataRef] = useState<string>(new Date().toISOString().slice(0, 10));
  const [horas, setHoras] = useState<number>(24);
  const [selectedMunicipio, setSelectedMunicipio] = useState<string>("todos");
  const [statusFiltro, setStatusFiltro] = useState<"todos" | "Ativo" | "Em observação">("todos");
  const [searchQuery, setSearchQuery] = useState<string>("");
  const [activeTab, setActiveTab] = useState<"visao-geral" | "eventos" | "focos" | "areas-protegidas" | "prioridades">("visao-geral");

  // Modal de Detalhes do Evento
  const [selectedEvento, setSelectedEvento] = useState<PainelDoFogoEvento | null>(null);
  const [isModalOpen, setIsModalOpen] = useState(false);

  const fetchOverview = useServerFn(getPainelDoFogoOverview);
  const fetchEventoDetalhes = useServerFn(getPainelDoFogoEventoDetalhes);

  const {
    data: overview,
    isLoading,
    isRefetching,
    refetch,
  } = useQuery({
    queryKey: ["painel-do-fogo-overview", dataRef, horas],
    queryFn: async () => {
      return await fetchOverview({
        data: {
          data: dataRef,
          horas,
        },
      });
    },
    staleTime: 60_000,
  });

  // Query sob demanda dos detalhes do evento selecionado no modal
  const { data: eventoDetalhes, isLoading: isLoadingDetalhes } = useQuery({
    queryKey: ["painel-do-fogo-evento-detalhes", selectedEvento?.id_evento],
    queryFn: async () => {
      if (!selectedEvento?.id_evento) return null;
      return await fetchEventoDetalhes({
        data: {
          id_evento: selectedEvento.id_evento,
        },
      });
    },
    enabled: !!selectedEvento?.id_evento && isModalOpen,
  });

  const handleOpenEventoModal = (evento: PainelDoFogoEvento) => {
    setSelectedEvento(evento);
    setIsModalOpen(true);
  };

  const handleExportExcel = () => {
    if (!overview) {
      toast.error("Aguarde o carregamento dos dados para exportar.");
      return;
    }
    try {
      exportFocosXlsx(overview);
      toast.success("Planilha do Painel do Fogo (Amazonas) exportada com sucesso!");
    } catch (e) {
      console.error(e);
      toast.error("Falha ao exportar planilha", { description: (e as Error)?.message });
    }
  };

  // Filtragem de Eventos por município, status e busca
  const eventosFiltrados = useMemo(() => {
    if (!overview?.eventos) return [];
    return overview.eventos.filter((e) => {
      if (statusFiltro !== "todos" && e.status_evento !== statusFiltro) return false;
      if (selectedMunicipio !== "todos") {
        const munStr = (e.municipio || "").toLowerCase();
        if (!munStr.includes(selectedMunicipio.toLowerCase())) return false;
      }
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase();
        const munStr = (e.municipio || "").toLowerCase();
        const ucStr = (e.unidade_conservacao || "").toLowerCase();
        const tiStr = (e.terra_indigena || "").toLowerCase();
        const domStr = (e.dominio || "").toLowerCase();
        const idStr = String(e.id_evento);
        if (
          !munStr.includes(q) &&
          !ucStr.includes(q) &&
          !tiStr.includes(q) &&
          !domStr.includes(q) &&
          !idStr.includes(q)
        ) {
          return false;
        }
      }
      return true;
    });
  }, [overview?.eventos, statusFiltro, selectedMunicipio, searchQuery]);

  // Filtragem de Focos de Calor
  const focosFiltrados = useMemo(() => {
    if (!overview?.focos) return [];
    return overview.focos.filter((f) => {
      if (selectedMunicipio !== "todos") {
        const m = (f.municipio_prox || "").toLowerCase();
        if (m !== selectedMunicipio.toLowerCase()) return false;
      }
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase();
        const m = (f.municipio_prox || "").toLowerCase();
        const sat = (f.satelite || f.satellite || "").toLowerCase();
        const idStr = String(f.id);
        if (!m.includes(q) && !sat.includes(q) && !idStr.includes(q)) return false;
      }
      return true;
    });
  }, [overview?.focos, selectedMunicipio, searchQuery]);

  // Ranking de Municípios filtrado
  const rankingFiltrado = useMemo(() => {
    if (!overview?.ranking_municipios) return [];
    let list = overview.ranking_municipios;
    if (selectedMunicipio !== "todos") {
      list = list.filter((m) => m.nome.toLowerCase() === selectedMunicipio.toLowerCase());
    }
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      list = list.filter((m) => m.nome.toLowerCase().includes(q));
    }
    return list;
  }, [overview?.ranking_municipios, selectedMunicipio, searchQuery]);

  return (
    <div className="min-h-dvh bg-gradient-brand-soft">
      {/* HEADER SUPERIOR PADRÃO CBMAM COM NAVEGAÇÃO */}
      <header className="sticky top-0 z-40 bg-gradient-brand text-white shadow-elevated">
        <div className="w-full max-w-[98%] mx-auto px-3 sm:px-6 py-3 flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <Button asChild variant="secondary" size="sm" className="bg-white/95 text-foreground shrink-0">
              <Link to="/painel">
                <ArrowLeft className="w-4 h-4 mr-1.5" /> Voltar
              </Link>
            </Button>
            <div>
              <div className="text-[10px] uppercase tracking-widest text-white/70 font-semibold flex items-center gap-1.5">
                <Radio className="w-3 h-3 text-red-400 animate-pulse" />
                Sala de Situação · CBMAM · Monitoramento CENSIPAM
              </div>
              <h1 className="font-display text-base sm:text-lg md:text-xl font-bold truncate flex items-center gap-2">
                <Flame className="w-5 h-5 text-amber-400" />
                Painel do Fogo — Focos & Queimadas no Amazonas
              </h1>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <div className="hidden md:flex items-center gap-2 text-xs bg-white/10 border border-white/20 rounded-full px-3 py-1">
              <span className="w-2 h-2 rounded-full bg-emerald-400 animate-ping" />
              <span className="font-medium text-white/90">API CENSIPAM Online</span>
            </div>
            <Button
              onClick={handleExportExcel}
              disabled={isLoading || !overview}
              size="sm"
              className="bg-emerald-700 hover:bg-emerald-800 text-white font-semibold gap-1.5 shadow-sm"
              title="Exportar dados consolidados em planilha Excel"
            >
              <FileSpreadsheet className="w-4 h-4 text-emerald-200" />
              Exportar Excel (.xlsx)
            </Button>
            <Button
              onClick={() => refetch()}
              disabled={isLoading || isRefetching}
              size="sm"
              variant="outline"
              className="bg-white/95 text-foreground font-semibold gap-1.5 hover:bg-emerald-50"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${isRefetching ? "animate-spin" : ""}`} />
              Atualizar
            </Button>
            <Button asChild variant="secondary" size="sm" className="bg-white/95 text-foreground">
              <Link to="/totais">Ver Totais</Link>
            </Button>
          </div>
        </div>
      </header>

      <main className="w-full max-w-[98%] mx-auto px-3 sm:px-6 py-5 space-y-6">
        {/* BARRA DE FILTROS & SELEÇÃO DE DIAS */}
        <div className="rounded-xl border border-primary/20 bg-card p-4 shadow-sm space-y-4">
          <div className="flex flex-wrap items-center justify-between gap-3 border-b border-border/40 pb-3">
            <div className="flex items-center gap-2 text-sm font-bold text-foreground">
              <Filter className="w-4 h-4 text-primary" />
              Filtros Operacionais de Monitoramento · Estado do Amazonas
            </div>
            <a
              href="https://panorama.sipam.gov.br/painel-do-fogo/api/swagger"
              target="_blank"
              rel="noopener noreferrer"
              className="text-xs text-primary hover:underline flex items-center gap-1 font-medium"
            >
              Swagger Oficial CENSIPAM <ExternalLink className="w-3 h-3" />
            </a>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 lg:grid-cols-5 gap-3">
            {/* Seletor de Data */}
            <div className="space-y-1">
              <label className="text-xs font-semibold text-muted-foreground flex items-center gap-1.5">
                <Calendar className="w-3.5 h-3.5 text-primary" /> Data de Referência
              </label>
              <Input
                type="date"
                value={dataRef}
                onChange={(e) => setDataRef(e.target.value)}
                className="h-9 text-xs bg-background"
              />
            </div>

            {/* Janela de Horas Retroativas */}
            <div className="space-y-1">
              <label className="text-xs font-semibold text-muted-foreground flex items-center gap-1.5">
                <Clock className="w-3.5 h-3.5 text-primary" /> Janela Retroativa
              </label>
              <select
                value={horas}
                onChange={(e) => setHoras(Number(e.target.value))}
                className="w-full h-9 rounded-md border border-input bg-background px-3 text-xs font-medium focus:border-primary focus:outline-none"
              >
                <option value={12}>Últimas 12 horas</option>
                <option value={24}>Últimas 24 horas (Diário Oficial)</option>
                <option value={48}>Últimas 48 horas</option>
                <option value={72}>Últimas 72 horas</option>
                <option value={168}>Últimos 7 dias (Semanal)</option>
              </select>
            </div>

            {/* Filtro de Município do Amazonas */}
            <div className="space-y-1">
              <label className="text-xs font-semibold text-muted-foreground flex items-center gap-1.5">
                <MapPin className="w-3.5 h-3.5 text-primary" /> Município (62 do AM)
              </label>
              <select
                value={selectedMunicipio}
                onChange={(e) => setSelectedMunicipio(e.target.value)}
                className="w-full h-9 rounded-md border border-input bg-background px-3 text-xs font-medium focus:border-primary focus:outline-none"
              >
                <option value="todos">Todos os 62 Municípios do Amazonas</option>
                {AMAZONAS_MUNICIPALITY_CENTROIDS.map((m) => (
                  <option key={m.nome} value={m.nome}>
                    {m.nome}
                  </option>
                ))}
              </select>
            </div>

            {/* Status do Evento de Fogo */}
            <div className="space-y-1">
              <label className="text-xs font-semibold text-muted-foreground flex items-center gap-1.5">
                <ShieldAlert className="w-3.5 h-3.5 text-primary" /> Status do Evento
              </label>
              <select
                value={statusFiltro}
                onChange={(e) => setStatusFiltro(e.target.value as any)}
                className="w-full h-9 rounded-md border border-input bg-background px-3 text-xs font-medium focus:border-primary focus:outline-none"
              >
                <option value="todos">Todos os Status</option>
                <option value="Ativo">Apenas Ativos (Fogo em Combate)</option>
                <option value="Em observação">Apenas Em Observação</option>
              </select>
            </div>

            {/* Busca Rápida Textual */}
            <div className="space-y-1">
              <label className="text-xs font-semibold text-muted-foreground flex items-center gap-1.5">
                <Search className="w-3.5 h-3.5 text-primary" /> Busca Rápida
              </label>
              <div className="relative">
                <Input
                  type="text"
                  placeholder="Município, UC, TI ou ID..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="h-9 text-xs pl-8 bg-background"
                />
                <Search className="w-3.5 h-3.5 text-muted-foreground absolute left-2.5 top-2.5" />
              </div>
            </div>
          </div>
        </div>

        {/* CARDS EXECUTIVOS DE KPIS DO AMAZONAS */}
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3 sm:gap-4">
          {/* Card 1: Focos de Calor AM */}
          <div className="rounded-xl border border-amber-200/60 bg-gradient-to-br from-amber-500/10 via-amber-500/5 to-transparent p-3.5 shadow-sm">
            <div className="flex items-center justify-between text-xs font-bold text-amber-800 uppercase tracking-wider">
              <span>Focos no AM</span>
              <Flame className="w-4 h-4 text-amber-600" />
            </div>
            <div className="mt-2 text-2xl font-black text-amber-950 font-display">
              {isLoading ? "..." : NF.format(overview?.total_focos_am ?? 0)}
            </div>
            <div className="mt-1 text-[11px] text-amber-800/80 font-medium">
              Satélites CENSIPAM + FIRMS ({horas}h)
            </div>
          </div>

          {/* Card 2: Eventos de Fogo Ativos */}
          <div className="rounded-xl border border-red-200/60 bg-gradient-to-br from-red-500/10 via-red-500/5 to-transparent p-3.5 shadow-sm">
            <div className="flex items-center justify-between text-xs font-bold text-red-800 uppercase tracking-wider">
              <span>Eventos de Fogo</span>
              <ShieldAlert className="w-4 h-4 text-red-600" />
            </div>
            <div className="mt-2 text-2xl font-black text-red-950 font-display">
              {isLoading ? "..." : NF.format(overview?.total_eventos_am ?? 0)}
            </div>
            <div className="mt-1 text-[11px] text-red-800/80 font-medium flex items-center gap-1.5">
              <span className="inline-block w-2 h-2 rounded-full bg-red-600" />
              <span>{overview?.eventos_ativos_am ?? 0} ativos</span>
              <span className="text-muted-foreground">· {overview?.eventos_observacao_am ?? 0} observação</span>
            </div>
          </div>

          {/* Card 3: Área Total Sob Fogo */}
          <div className="rounded-xl border border-emerald-200/60 bg-gradient-to-br from-emerald-500/10 via-emerald-500/5 to-transparent p-3.5 shadow-sm">
            <div className="flex items-center justify-between text-xs font-bold text-emerald-800 uppercase tracking-wider">
              <span>Área Atingida</span>
              <TreePine className="w-4 h-4 text-emerald-600" />
            </div>
            <div className="mt-2 text-2xl font-black text-emerald-950 font-display truncate">
              {isLoading ? "..." : `${NF.format(overview?.area_total_afetada_ha ?? 0)} ha`}
            </div>
            <div className="mt-1 text-[11px] text-emerald-800/80 font-medium">
              Equivalente a {NF.format(overview?.area_total_afetada_km2 ?? 0)} km²
            </div>
          </div>

          {/* Card 4: Município Mais Crítico */}
          <div className="rounded-xl border border-purple-200/60 bg-gradient-to-br from-purple-500/10 via-purple-500/5 to-transparent p-3.5 shadow-sm">
            <div className="flex items-center justify-between text-xs font-bold text-purple-800 uppercase tracking-wider">
              <span>Município Crítico</span>
              <Crosshair className="w-4 h-4 text-purple-600" />
            </div>
            <div className="mt-2 text-lg sm:text-xl font-black text-purple-950 font-display truncate" title={overview?.municipio_mais_critico?.nome}>
              {isLoading ? "..." : overview?.municipio_mais_critico?.nome || "Manaus"}
            </div>
            <div className="mt-1 text-[11px] text-purple-800/80 font-medium">
              {overview?.municipio_mais_critico?.focos ?? 0} focos · {overview?.municipio_mais_critico?.eventos ?? 0} eventos
            </div>
          </div>

          {/* Card 5: Áreas Protegidas (UCs & TIs) */}
          <div className="rounded-xl border border-blue-200/60 bg-gradient-to-br from-blue-500/10 via-blue-500/5 to-transparent p-3.5 shadow-sm">
            <div className="flex items-center justify-between text-xs font-bold text-blue-800 uppercase tracking-wider">
              <span>Áreas Protegidas</span>
              <Building className="w-4 h-4 text-blue-600" />
            </div>
            <div className="mt-2 text-2xl font-black text-blue-950 font-display">
              {isLoading ? "..." : (overview?.ucs_afetadas?.length ?? 0) + (overview?.tis_afetadas?.length ?? 0)}
            </div>
            <div className="mt-1 text-[11px] text-blue-800/80 font-medium">
              {overview?.ucs_afetadas?.length ?? 0} UCs · {overview?.tis_afetadas?.length ?? 0} Terras Indígenas
            </div>
          </div>

          {/* Card 6: Potência do Fogo (FRP) */}
          <div className="rounded-xl border border-orange-200/60 bg-gradient-to-br from-orange-500/10 via-orange-500/5 to-transparent p-3.5 shadow-sm">
            <div className="flex items-center justify-between text-xs font-bold text-orange-800 uppercase tracking-wider">
              <span>Intensidade (FRP)</span>
              <Zap className="w-4 h-4 text-orange-600" />
            </div>
            <div className="mt-2 text-2xl font-black text-orange-950 font-display">
              {isLoading ? "..." : `${overview?.frp_media ?? 0} MW`}
            </div>
            <div className="mt-1 text-[11px] text-orange-800/80 font-medium">
              Pico máximo: {overview?.frp_maxima ?? 0} MW
            </div>
          </div>
        </div>

        {/* ABAS PRINCIPAIS */}
        <Tabs value={activeTab} onValueChange={(v) => setActiveTab(v as any)} className="space-y-4">
          <TabsList className="bg-card border border-border p-1 w-full justify-start overflow-x-auto h-auto flex-wrap">
            <TabsTrigger value="visao-geral" className="gap-2 text-xs font-bold data-[state=active]:bg-primary data-[state=active]:text-white">
              <Layers className="w-3.5 h-3.5" /> Visão Geral & Totais Acumulados
            </TabsTrigger>
            <TabsTrigger value="eventos" className="gap-2 text-xs font-bold data-[state=active]:bg-primary data-[state=active]:text-white">
              <ShieldAlert className="w-3.5 h-3.5" /> Eventos de Fogo Ativos ({eventosFiltrados.length})
            </TabsTrigger>
            <TabsTrigger value="focos" className="gap-2 text-xs font-bold data-[state=active]:bg-primary data-[state=active]:text-white">
              <Satellite className="w-3.5 h-3.5" /> Focos de Calor Orbitais ({focosFiltrados.length})
            </TabsTrigger>
            <TabsTrigger value="areas-protegidas" className="gap-2 text-xs font-bold data-[state=active]:bg-primary data-[state=active]:text-white">
              <TreePine className="w-3.5 h-3.5" /> Áreas Protegidas (UCs & TIs)
            </TabsTrigger>
            <TabsTrigger value="prioridades" className="gap-2 text-xs font-bold data-[state=active]:bg-primary data-[state=active]:text-white">
              <Crosshair className="w-3.5 h-3.5" /> Prioridades de Acionamento CENSIPAM
            </TabsTrigger>
          </TabsList>

          {/* ================================================================= */}
          {/* ABA 1: VISÃO GERAL & TOTAIS ACUMULADOS */}
          {/* ================================================================= */}
          <TabsContent value="visao-geral" className="space-y-5">
            {/* Gráficos / Distribuições complementares */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              {/* Distribuição por Satélite */}
              <div className="rounded-xl border border-border bg-card p-4 shadow-sm space-y-3">
                <div className="text-xs font-bold text-foreground uppercase tracking-wider flex items-center gap-1.5">
                  <Satellite className="w-4 h-4 text-primary" /> Satélites Detectores
                </div>
                <div className="space-y-2">
                  {Object.entries(overview?.distribuicao_satelites ?? {}).length === 0 ? (
                    <div className="text-xs text-muted-foreground py-4 text-center">Nenhum satélite reportado no período</div>
                  ) : (
                    Object.entries(overview?.distribuicao_satelites ?? {}).map(([sat, count]) => {
                      const total = overview?.total_focos_am || 1;
                      const pct = ((count / total) * 100).toFixed(1);
                      return (
                        <div key={sat} className="space-y-1">
                          <div className="flex justify-between text-xs font-medium">
                            <span>{sat}</span>
                            <span className="text-muted-foreground font-mono">{count} focos ({pct}%)</span>
                          </div>
                          <div className="w-full h-2 rounded-full bg-muted overflow-hidden">
                            <div className="h-full bg-emerald-600 rounded-full" style={{ width: `${pct}%` }} />
                          </div>
                        </div>
                      );
                    })
                  )}
                </div>
              </div>

              {/* Distribuição Diurno x Noturno */}
              <div className="rounded-xl border border-border bg-card p-4 shadow-sm space-y-3">
                <div className="text-xs font-bold text-foreground uppercase tracking-wider flex items-center gap-1.5">
                  <Sun className="w-4 h-4 text-amber-500" /> Período de Detecção (Dia vs Noite)
                </div>
                <div className="grid grid-cols-2 gap-3 pt-2">
                  <div className="rounded-lg border border-amber-100 bg-amber-50/50 p-3 text-center">
                    <Sun className="w-5 h-5 text-amber-600 mx-auto" />
                    <div className="text-xl font-black text-amber-950 mt-1 font-display">
                      {overview?.distribuicao_periodo?.diurno ?? 0}
                    </div>
                    <div className="text-[11px] text-amber-800 font-medium">Focos Diurnos</div>
                  </div>
                  <div className="rounded-lg border border-indigo-100 bg-indigo-50/50 p-3 text-center">
                    <Moon className="w-5 h-5 text-indigo-600 mx-auto" />
                    <div className="text-xl font-black text-indigo-950 mt-1 font-display">
                      {overview?.distribuicao_periodo?.noturno ?? 0}
                    </div>
                    <div className="text-[11px] text-indigo-800 font-medium">Focos Noturnos</div>
                  </div>
                </div>
                <div className="text-[11px] text-muted-foreground pt-1">
                  Detecções noturnas indicam alta probabilidade de queima contínua sem controle ativo.
                </div>
              </div>

              {/* Distribuição Fundiária / Domínio */}
              <div className="rounded-xl border border-border bg-card p-4 shadow-sm space-y-3">
                <div className="text-xs font-bold text-foreground uppercase tracking-wider flex items-center gap-1.5">
                  <Building className="w-4 h-4 text-primary" /> Domínio Territorial (Eventos)
                </div>
                <div className="space-y-1.5 max-h-[160px] overflow-y-auto pr-1">
                  {Object.entries(overview?.distribuicao_dominio ?? {}).slice(0, 6).map(([dom, count]) => (
                    <div key={dom} className="flex items-center justify-between text-xs py-1 border-b border-border/40">
                      <span className="truncate max-w-[180px] font-medium text-foreground" title={dom}>{dom}</span>
                      <Badge variant="outline" className="font-mono text-[11px]">{count}</Badge>
                    </div>
                  ))}
                </div>
              </div>
            </div>

            {/* Tabela do Ranking de Municípios do Amazonas */}
            <div className="rounded-xl border border-border bg-card shadow-sm overflow-hidden">
              <div className="p-4 border-b border-border flex items-center justify-between">
                <div>
                  <h3 className="font-display font-bold text-sm sm:text-base text-foreground flex items-center gap-2">
                    <Crosshair className="w-4 h-4 text-emerald-600" />
                    Ranking de Municípios do Amazonas com Focos e Eventos Ativos
                  </h3>
                  <p className="text-xs text-muted-foreground">
                    Consolidado de focos orbitais e eventos de incêndio ativos por município do Estado do Amazonas
                  </p>
                </div>
                <Badge variant="secondary" className="font-mono text-xs">
                  {rankingFiltrado.length} municípios
                </Badge>
              </div>

              <div className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow className="bg-muted/50 hover:bg-muted/50">
                      <TableHead className="w-14 text-center font-bold">Nº</TableHead>
                      <TableHead className="font-bold">MUNICÍPIO DO AMAZONAS</TableHead>
                      <TableHead className="text-center font-bold text-amber-800">FOCOS DE CALOR ({horas}H)</TableHead>
                      <TableHead className="text-center font-bold text-red-800">EVENTOS DE FOGO</TableHead>
                      <TableHead className="text-center font-bold text-emerald-800">ÁREA AFETADA (HA)</TableHead>
                      <TableHead className="text-center font-bold">PERSISTÊNCIA MÁXIMA</TableHead>
                      <TableHead className="text-right font-bold">AÇÃO</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {rankingFiltrado.length === 0 ? (
                      <TableRow>
                        <TableCell colSpan={7} className="text-center py-8 text-muted-foreground">
                          Nenhum dado encontrado para os filtros selecionados.
                        </TableCell>
                      </TableRow>
                    ) : (
                      rankingFiltrado.map((m, idx) => (
                        <TableRow key={m.nome} className="hover:bg-muted/30">
                          <TableCell className="text-center font-mono font-bold text-muted-foreground">{idx + 1}</TableCell>
                          <TableCell className="font-semibold text-foreground">
                            {m.nome}
                            {idx === 0 && m.focos > 0 && (
                              <Badge className="ml-2 bg-red-600 text-white text-[10px] py-0 px-1.5">Mais Crítico</Badge>
                            )}
                          </TableCell>
                          <TableCell className="text-center font-mono font-bold text-amber-700">
                            {m.focos > 0 ? NF.format(m.focos) : <span className="text-muted-foreground font-normal">0</span>}
                          </TableCell>
                          <TableCell className="text-center font-mono font-bold text-red-700">
                            {m.eventos > 0 ? NF.format(m.eventos) : <span className="text-muted-foreground font-normal">0</span>}
                          </TableCell>
                          <TableCell className="text-center font-mono font-semibold text-emerald-700">
                            {m.area_ha > 0 ? `${NF.format(Number(m.area_ha.toFixed(1)))} ha` : "—"}
                          </TableCell>
                          <TableCell className="text-center font-mono">
                            {m.persistencia_max > 0 ? `${m.persistencia_max} dias` : "—"}
                          </TableCell>
                          <TableCell className="text-right">
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => {
                                setSelectedMunicipio(m.nome);
                                setActiveTab("eventos");
                              }}
                              className="h-7 text-xs font-semibold text-primary hover:text-primary hover:bg-primary/10 gap-1"
                            >
                              Ver Eventos <ChevronRight className="w-3.5 h-3.5" />
                            </Button>
                          </TableCell>
                        </TableRow>
                      ))
                    )}
                  </TableBody>
                </Table>
              </div>
            </div>
          </TabsContent>

          {/* ================================================================= */}
          {/* ABA 2: EVENTOS DE FOGO ATIVOS NO AMAZONAS */}
          {/* ================================================================= */}
          <TabsContent value="eventos" className="space-y-4">
            <div className="rounded-xl border border-border bg-card shadow-sm overflow-hidden">
              <div className="p-4 border-b border-border flex flex-wrap items-center justify-between gap-3">
                <div>
                  <h3 className="font-display font-bold text-sm sm:text-base text-foreground flex items-center gap-2">
                    <ShieldAlert className="w-4 h-4 text-red-600" />
                    Eventos de Fogo Ativos no Amazonas (CENSIPAM)
                  </h3>
                  <p className="text-xs text-muted-foreground">
                    Incêndios florestais e queimadas ativas mapeadas por satélite com polígonos de calor contínuos
                  </p>
                </div>
                <div className="flex items-center gap-2">
                  <Badge variant="outline" className="font-mono text-xs">
                    {eventosFiltrados.length} evento(s) no AM
                  </Badge>
                </div>
              </div>

              <div className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow className="bg-muted/50 hover:bg-muted/50">
                      <TableHead className="w-20 font-bold">ID</TableHead>
                      <TableHead className="w-28 font-bold text-center">STATUS</TableHead>
                      <TableHead className="font-bold">MUNICÍPIO(S)</TableHead>
                      <TableHead className="text-center font-bold">ÁREA (HA)</TableHead>
                      <TableHead className="text-center font-bold">PERSISTÊNCIA</TableHead>
                      <TableHead className="font-bold">DOMÍNIO / ÁREA PROTEGIDA</TableHead>
                      <TableHead className="text-center font-bold">COORDENADAS</TableHead>
                      <TableHead className="text-right font-bold">DETALHES</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {eventosFiltrados.length === 0 ? (
                      <TableRow>
                        <TableCell colSpan={8} className="text-center py-8 text-muted-foreground">
                          Nenhum evento de fogo encontrado para os filtros selecionados.
                        </TableCell>
                      </TableRow>
                    ) : (
                      eventosFiltrados.map((ev) => (
                        <TableRow key={ev.id_evento} className="hover:bg-muted/30">
                          <TableCell className="font-mono font-bold text-xs text-muted-foreground">
                            #{ev.id_evento}
                          </TableCell>
                          <TableCell className="text-center">
                            {ev.status_evento === "Ativo" ? (
                              <Badge className="bg-red-600 hover:bg-red-700 text-white text-[11px] py-0.5">
                                <span className="w-1.5 h-1.5 rounded-full bg-white mr-1.5 animate-ping" />
                                Ativo
                              </Badge>
                            ) : (
                              <Badge variant="outline" className="text-amber-700 border-amber-300 bg-amber-50 text-[11px]">
                                Em observação
                              </Badge>
                            )}
                          </TableCell>
                          <TableCell className="font-semibold text-foreground max-w-[200px] truncate" title={ev.municipio || ""}>
                            {ev.municipio || "Amazonas"}
                          </TableCell>
                          <TableCell className="text-center font-mono font-bold text-emerald-700">
                            {NF.format(Number((ev.area_total_evento || 0).toFixed(1)))} ha
                          </TableCell>
                          <TableCell className="text-center font-mono text-xs">
                            {ev.persistencia_dias} dia(s)
                          </TableCell>
                          <TableCell className="text-xs text-foreground max-w-[260px] truncate" title={`${ev.dominio || ""} ${ev.unidade_conservacao || ""} ${ev.terra_indigena || ""}`}>
                            {ev.unidade_conservacao ? (
                              <span className="font-semibold text-emerald-800">UC: {ev.unidade_conservacao}</span>
                            ) : ev.terra_indigena ? (
                              <span className="font-semibold text-purple-800">TI: {ev.terra_indigena}</span>
                            ) : (
                              ev.dominio || "—"
                            )}
                          </TableCell>
                          <TableCell className="text-center font-mono text-[11px] text-muted-foreground">
                            {ev.latitude.toFixed(4)}, {ev.longitude.toFixed(4)}
                          </TableCell>
                          <TableCell className="text-right">
                            <Button
                              variant="outline"
                              size="sm"
                              onClick={() => handleOpenEventoModal(ev)}
                              className="h-7 text-xs font-semibold gap-1 text-primary hover:bg-primary/10 border-primary/30"
                            >
                              <Eye className="w-3.5 h-3.5" /> Detalhes & CAR
                            </Button>
                          </TableCell>
                        </TableRow>
                      ))
                    )}
                  </TableBody>
                </Table>
              </div>
            </div>
          </TabsContent>

          {/* ================================================================= */}
          {/* ABA 3: FOCOS DE CALOR ORBITAIS (CENSIPAM + FIRMS) */}
          {/* ================================================================= */}
          <TabsContent value="focos" className="space-y-4">
            <div className="rounded-xl border border-border bg-card shadow-sm overflow-hidden">
              <div className="p-4 border-b border-border flex flex-wrap items-center justify-between gap-3">
                <div>
                  <h3 className="font-display font-bold text-sm sm:text-base text-foreground flex items-center gap-2">
                    <Satellite className="w-4 h-4 text-emerald-600" />
                    Detecções Individuais de Focos de Calor Orbitais no Amazonas
                  </h3>
                  <p className="text-xs text-muted-foreground">
                    Passagens de satélites com sensores termais (MODIS, VIIRS, NOAA, Terra e Aqua)
                  </p>
                </div>
                <Badge variant="outline" className="font-mono text-xs">
                  {focosFiltrados.length} foco(s) filtrado(s)
                </Badge>
              </div>

              <div className="overflow-x-auto max-h-[600px]">
                <Table>
                  <TableHeader className="sticky top-0 bg-muted/90 backdrop-blur-sm z-10">
                    <TableRow>
                      <TableHead className="w-20 font-bold">ID FOCO</TableHead>
                      <TableHead className="font-bold">DATA / HORA</TableHead>
                      <TableHead className="font-bold">SATÉLITE</TableHead>
                      <TableHead className="font-bold">MUNICÍPIO PRÓXIMO</TableHead>
                      <TableHead className="text-center font-bold">FRP (MW)</TableHead>
                      <TableHead className="text-center font-bold">TEMP. TI4 (K)</TableHead>
                      <TableHead className="text-center font-bold">PERÍODO</TableHead>
                      <TableHead className="text-center font-bold">CONFIANÇA</TableHead>
                      <TableHead className="text-right font-bold">COORDENADAS</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {focosFiltrados.length === 0 ? (
                      <TableRow>
                        <TableCell colSpan={9} className="text-center py-8 text-muted-foreground">
                          Nenhum foco de calor detectado para os parâmetros selecionados.
                        </TableCell>
                      </TableRow>
                    ) : (
                      focosFiltrados.slice(0, 300).map((f) => (
                        <TableRow key={f.id} className="hover:bg-muted/30">
                          <TableCell className="font-mono text-xs text-muted-foreground">#{f.id}</TableCell>
                          <TableCell className="font-mono text-xs">
                            {f.acq_date} {f.acq_time ? `às ${f.acq_time}h` : ""}
                          </TableCell>
                          <TableCell className="font-semibold text-xs text-foreground">
                            {f.satelite || f.satellite}
                          </TableCell>
                          <TableCell className="font-semibold text-xs text-primary">
                            {f.municipio_prox || "Amazonas"}
                          </TableCell>
                          <TableCell className="text-center font-mono font-bold text-xs text-amber-700">
                            {f.frp ? `${f.frp.toFixed(1)} MW` : "—"}
                          </TableCell>
                          <TableCell className="text-center font-mono text-xs text-muted-foreground">
                            {f.bright_ti4 ? `${f.bright_ti4.toFixed(1)} K` : "—"}
                          </TableCell>
                          <TableCell className="text-center">
                            {f.daynight === "D" ? (
                              <Badge variant="outline" className="text-amber-700 border-amber-300 bg-amber-50 text-[10px]">
                                <Sun className="w-3 h-3 mr-1" /> Diurno
                              </Badge>
                            ) : (
                              <Badge variant="outline" className="text-indigo-700 border-indigo-300 bg-indigo-50 text-[10px]">
                                <Moon className="w-3 h-3 mr-1" /> Noturno
                              </Badge>
                            )}
                          </TableCell>
                          <TableCell className="text-center font-mono text-xs">
                            {f.confidence || "—"}
                          </TableCell>
                          <TableCell className="text-right font-mono text-[11px] text-muted-foreground">
                            {f.geom?.coordinates ? (
                              <a
                                href={`https://www.google.com/maps/search/?api=1&query=${f.geom.coordinates[1]},${f.geom.coordinates[0]}`}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="text-primary hover:underline flex items-center justify-end gap-1"
                              >
                                {f.geom.coordinates[1].toFixed(4)}, {f.geom.coordinates[0].toFixed(4)}
                                <ExternalLink className="w-3 h-3" />
                              </a>
                            ) : "—"}
                          </TableCell>
                        </TableRow>
                      ))
                    )}
                  </TableBody>
                </Table>
              </div>
              {focosFiltrados.length > 300 && (
                <div className="p-3 bg-muted/30 border-t border-border text-center text-xs text-muted-foreground">
                  Exibindo os primeiros 300 focos de {focosFiltrados.length}. Para visualizar a totalidade completa, utilize a exportação em Excel.
                </div>
              )}
            </div>
          </TabsContent>

          {/* ================================================================= */}
          {/* ABA 4: ÁREAS PROTEGIDAS (UCS & TIS) */}
          {/* ================================================================= */}
          <TabsContent value="areas-protegidas" className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {/* Unidades de Conservação (UC) */}
              <div className="rounded-xl border border-border bg-card shadow-sm p-4 space-y-3">
                <div className="flex items-center justify-between border-b border-border pb-2">
                  <h3 className="font-display font-bold text-sm text-foreground flex items-center gap-2">
                    <TreePine className="w-4 h-4 text-emerald-600" />
                    Unidades de Conservação Atingidas no AM ({overview?.ucs_afetadas?.length ?? 0})
                  </h3>
                </div>
                <div className="space-y-2 max-h-[400px] overflow-y-auto pr-1">
                  {(overview?.ucs_afetadas ?? []).length === 0 ? (
                    <div className="text-xs text-muted-foreground py-6 text-center">Nenhuma UC com evento ativo no período</div>
                  ) : (
                    overview?.ucs_afetadas.map((uc) => (
                      <div key={uc.nome} className="rounded-lg border border-border/60 bg-muted/20 p-2.5 flex items-center justify-between">
                        <div className="min-w-0 pr-2">
                          <div className="text-xs font-bold text-foreground truncate" title={uc.nome}>{uc.nome}</div>
                          <div className="text-[11px] text-muted-foreground">Área estimada: {NF.format(uc.area_ha)} ha</div>
                        </div>
                        <Badge variant="secondary" className="font-mono text-xs shrink-0">
                          {uc.eventos_count} evento(s)
                        </Badge>
                      </div>
                    ))
                  )}
                </div>
              </div>

              {/* Terras Indígenas (TI) */}
              <div className="rounded-xl border border-border bg-card shadow-sm p-4 space-y-3">
                <div className="flex items-center justify-between border-b border-border pb-2">
                  <h3 className="font-display font-bold text-sm text-foreground flex items-center gap-2">
                    <Building className="w-4 h-4 text-purple-600" />
                    Terras Indígenas Atingidas no AM ({overview?.tis_afetadas?.length ?? 0})
                  </h3>
                </div>
                <div className="space-y-2 max-h-[400px] overflow-y-auto pr-1">
                  {(overview?.tis_afetadas ?? []).length === 0 ? (
                    <div className="text-xs text-muted-foreground py-6 text-center">Nenhuma Terra Indígena com evento ativo no período</div>
                  ) : (
                    overview?.tis_afetadas.map((ti) => (
                      <div key={ti.nome} className="rounded-lg border border-border/60 bg-muted/20 p-2.5 flex items-center justify-between">
                        <div className="min-w-0 pr-2">
                          <div className="text-xs font-bold text-foreground truncate" title={ti.nome}>{ti.nome}</div>
                          <div className="text-[11px] text-muted-foreground">Área estimada: {NF.format(ti.area_ha)} ha</div>
                        </div>
                        <Badge variant="secondary" className="font-mono text-xs shrink-0">
                          {ti.eventos_count} evento(s)
                        </Badge>
                      </div>
                    ))
                  )}
                </div>
              </div>
            </div>
          </TabsContent>

          {/* ================================================================= */}
          {/* ABA 5: PRIORIDADES DE ACIONAMENTO CENSIPAM */}
          {/* ================================================================= */}
          <TabsContent value="prioridades" className="space-y-4">
            <div className="rounded-xl border border-border bg-card shadow-sm overflow-hidden">
              <div className="p-4 border-b border-border flex items-center justify-between">
                <div>
                  <h3 className="font-display font-bold text-sm sm:text-base text-foreground flex items-center gap-2">
                    <Crosshair className="w-4 h-4 text-red-600" />
                    Índice de Prioridade para Acionamento de Equipes (CENSIPAM)
                  </h3>
                  <p className="text-xs text-muted-foreground">
                    Cálculo automatizado do SIPAM considerando velocidade de propagação, proximidade de vilas/UCs e persistência
                  </p>
                </div>
                <Badge variant="outline" className="font-mono text-xs">
                  {overview?.prioridades_am?.length ?? 0} evento(s) priorizados
                </Badge>
              </div>

              <div className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow className="bg-muted/50 hover:bg-muted/50">
                      <TableHead className="w-20 font-bold">ID EVENTO</TableHead>
                      <TableHead className="font-bold">MUNICÍPIO / LOCAL</TableHead>
                      <TableHead className="text-center font-bold text-red-800">ÍNDICE DE PRIORIDADE</TableHead>
                      <TableHead className="text-center font-bold">VARIAÇÃO ABSOLUTA</TableHead>
                      <TableHead className="text-center font-bold">VARIAÇÃO (%)</TableHead>
                      <TableHead className="text-center font-bold">DATA MÁXIMA</TableHead>
                      <TableHead className="text-right font-bold">COORDENADAS</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {(overview?.prioridades_am ?? []).length === 0 ? (
                      <TableRow>
                        <TableCell colSpan={7} className="text-center py-8 text-muted-foreground">
                          Nenhum índice de prioridade emitido para o período.
                        </TableCell>
                      </TableRow>
                    ) : (
                      overview?.prioridades_am.map((p) => (
                        <TableRow key={p.id_evento} className="hover:bg-muted/30">
                          <TableCell className="font-mono font-bold text-xs text-muted-foreground">#{p.id_evento}</TableCell>
                          <TableCell className="font-semibold text-foreground">{p.municipio || "Amazonas"}</TableCell>
                          <TableCell className="text-center font-mono font-black text-red-700 text-sm">
                            {p.indice ? p.indice.toFixed(1) : "—"}
                          </TableCell>
                          <TableCell className="text-center font-mono text-xs">
                            {p.variacao_absoluta ? (p.variacao_absoluta > 0 ? `+${p.variacao_absoluta.toFixed(1)}` : p.variacao_absoluta.toFixed(1)) : "—"}
                          </TableCell>
                          <TableCell className="text-center font-mono text-xs">
                            {p.variacao_percentual ? `${p.variacao_percentual.toFixed(1)}%` : "—"}
                          </TableCell>
                          <TableCell className="text-center font-mono text-xs text-muted-foreground">
                            {p.dt_maxima ? new Date(p.dt_maxima).toLocaleString("pt-BR") : "—"}
                          </TableCell>
                          <TableCell className="text-right font-mono text-xs text-primary">
                            <a
                              href={`https://www.google.com/maps/search/?api=1&query=${p.latitude},${p.longitude}`}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="hover:underline flex items-center justify-end gap-1"
                            >
                              {p.latitude.toFixed(4)}, {p.longitude.toFixed(4)}
                              <ExternalLink className="w-3 h-3" />
                            </a>
                          </TableCell>
                        </TableRow>
                      ))
                    )}
                  </TableBody>
                </Table>
              </div>
            </div>
          </TabsContent>
        </Tabs>
      </main>

      {/* MODAL DE DETALHES DO EVENTO DE FOGO (DETECÇÕES, CARS E HISTÓRICO) */}
      <Dialog open={isModalOpen} onOpenChange={setIsModalOpen}>
        <DialogContent className="max-w-3xl max-h-[85vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-lg font-bold font-display">
              <Flame className="w-5 h-5 text-red-600" />
              Evento de Fogo #{selectedEvento?.id_evento} — {selectedEvento?.municipio || "Amazonas"}
            </DialogTitle>
            <DialogDescription>
              Dados integrados CENSIPAM · Cadastro Ambiental Rural (CAR) e Detecções de Calor
            </DialogDescription>
          </DialogHeader>

          {selectedEvento && (
            <div className="space-y-5 pt-2">
              {/* Quadro de Resumo Rápido */}
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 bg-muted/30 p-3 rounded-lg border border-border text-xs">
                <div>
                  <span className="text-muted-foreground block">Status:</span>
                  <span className="font-bold text-foreground">{selectedEvento.status_evento}</span>
                </div>
                <div>
                  <span className="text-muted-foreground block">Área Total:</span>
                  <span className="font-bold text-emerald-700">{NF.format(Number(selectedEvento.area_total_evento.toFixed(1)))} ha</span>
                </div>
                <div>
                  <span className="text-muted-foreground block">Persistência:</span>
                  <span className="font-bold text-foreground">{selectedEvento.persistencia_dias} dia(s)</span>
                </div>
                <div>
                  <span className="text-muted-foreground block">Coordenadas:</span>
                  <span className="font-mono text-primary font-medium">{selectedEvento.latitude.toFixed(4)}, {selectedEvento.longitude.toFixed(4)}</span>
                </div>
              </div>

              {/* Informações Territoriais e Ambientais */}
              <div className="space-y-2 text-xs">
                <div className="font-bold text-foreground">Classificação Fundiária e Ambiental:</div>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-muted-foreground">
                  <div><strong>Domínio:</strong> {selectedEvento.dominio || "Área Não Identificada"}</div>
                  <div><strong>Unidade de Conservação:</strong> {selectedEvento.unidade_conservacao || "Nenhuma"}</div>
                  <div><strong>Terra Indígena:</strong> {selectedEvento.terra_indigena || "Nenhuma"}</div>
                  <div><strong>Assentamento:</strong> {selectedEvento.projeto_assentamento || "Nenhum"}</div>
                </div>
              </div>

              {/* Ações Rápidas */}
              <div className="flex gap-2 pt-1">
                <Button asChild size="sm" variant="outline" className="text-xs gap-1.5">
                  <a
                    href={`https://www.google.com/maps/search/?api=1&query=${selectedEvento.latitude},${selectedEvento.longitude}`}
                    target="_blank"
                    rel="noopener noreferrer"
                  >
                    <MapPin className="w-3.5 h-3.5 text-red-500" /> Abrir no Google Maps
                  </a>
                </Button>
                <Button asChild size="sm" variant="outline" className="text-xs gap-1.5">
                  <a
                    href={`https://panorama.sipam.gov.br/painel-do-fogo/api/v1/eventos/${selectedEvento.id_evento}`}
                    target="_blank"
                    rel="noopener noreferrer"
                  >
                    <ExternalLink className="w-3.5 h-3.5 text-primary" /> Ver JSON Oficial CENSIPAM
                  </a>
                </Button>
              </div>

              {/* Detecções Vinculadas ao Evento */}
              <div className="space-y-2 border-t border-border pt-3">
                <div className="flex items-center justify-between text-xs font-bold text-foreground">
                  <span className="flex items-center gap-1.5">
                    <Satellite className="w-4 h-4 text-primary" /> Detecções / Passagens de Satélite ({eventoDetalhes?.deteccoes?.length ?? 0})
                  </span>
                  {isLoadingDetalhes && <span className="text-muted-foreground font-normal">Carregando...</span>}
                </div>
                <div className="max-h-36 overflow-y-auto rounded border border-border text-xs divide-y divide-border">
                  {(eventoDetalhes?.deteccoes ?? []).length === 0 ? (
                    <div className="p-3 text-center text-muted-foreground">Nenhuma detecção específica reportada</div>
                  ) : (
                    eventoDetalhes?.deteccoes.map((det) => (
                      <div key={det.id_deteccoes} className="p-2 flex items-center justify-between">
                        <span className="font-mono text-muted-foreground">ID #{det.id_deteccoes}</span>
                        <span className="font-medium">{det.satelite}</span>
                        <span className="font-mono text-muted-foreground">
                          {det.dt_aquisicao ? new Date(det.dt_aquisicao).toLocaleString("pt-BR") : "—"}
                        </span>
                        <Badge variant="outline" className="text-[10px]">{det.npontos} ponto(s)</Badge>
                      </div>
                    ))
                  )}
                </div>
              </div>

              {/* Imóveis Rurais Atingidos (CAR) */}
              <div className="space-y-2 border-t border-border pt-3">
                <div className="flex items-center justify-between text-xs font-bold text-foreground">
                  <span className="flex items-center gap-1.5">
                    <TreePine className="w-4 h-4 text-emerald-600" /> Imóveis Rurais Atingidos — CAR ({eventoDetalhes?.cars?.length ?? 0})
                  </span>
                  {isLoadingDetalhes && <span className="text-muted-foreground font-normal">Carregando...</span>}
                </div>
                <div className="max-h-36 overflow-y-auto rounded border border-border text-xs divide-y divide-border">
                  {(eventoDetalhes?.cars ?? []).length === 0 ? (
                    <div className="p-3 text-center text-muted-foreground">Nenhum imóvel CAR interceptado pelo polígono do evento</div>
                  ) : (
                    eventoDetalhes?.cars.map((car) => (
                      <div key={car.cod_imovel} className="p-2 flex items-center justify-between">
                        <span className="font-mono text-primary font-medium truncate max-w-[320px]" title={car.cod_imovel}>
                          {car.cod_imovel}
                        </span>
                        <span className="text-muted-foreground">{car.municipio} - {car.estado}</span>
                      </div>
                    ))
                  )}
                </div>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}

