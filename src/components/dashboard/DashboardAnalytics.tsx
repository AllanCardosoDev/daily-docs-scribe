import { memo, useMemo } from "react";
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  PieChart,
  Pie,
  Cell,
  Legend,
  AreaChart,
  Area,
  LabelList,
} from "recharts";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  CardDescription,
} from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  Flame,
  ShieldAlert,
  Users,
  Activity,
  ArrowRightLeft,
  TrendingUp,
  TrendingDown,
  Minus,
  Sparkles,
  TreePine,
  Building2,
  AlertTriangle,
  CheckCircle2,
  Truck,
  HeartPulse,
  Shield,
  MapPin,
} from "lucide-react";
import type { SheetsData } from "@/lib/sheets.types";
import { NF } from "@/lib/formatters";
import type { ComparisonResult } from "@/lib/comparison";
import { canonicalMunicipio } from "@/lib/municipio-order";
import { cn } from "@/lib/utils";
import { useServerFn } from "@tanstack/react-start";
import { useQuery } from "@tanstack/react-query";
import { getAnnualIncendios } from "@/lib/annual-reports.functions";
import { TerritorialFireSummary } from "./TerritorialFireSummary";

interface Props {
  data: SheetsData;
  comparisonData?: ComparisonResult;
  isComparisonLoading?: boolean;
  selectedMunicipio?: string;
  selectedCalha?: string;
}

const PIE_COLORS = [
  "#10b981", // Esmeralda (Prevenção / Salvamento)
  "#3b82f6", // Azul (APH / Resgate)
  "#f59e0b", // Âmbar (Incêndio Urbano)
  "#ef4444", // Vermelho (Incêndio Florestal)
  "#8b5cf6", // Roxo (Acidentes)
  "#06b6d4", // Ciano (Serviços)
];

export const DashboardAnalytics = memo(function DashboardAnalytics({
  data,
  comparisonData,
  isComparisonLoading,
  selectedMunicipio = "todos",
  selectedCalha = "todas",
}: Props) {
  const fetchAnnual = useServerFn(getAnnualIncendios);
  const { data: annualData } = useQuery({
    queryKey: ["annual-dashboard-charts"],
    queryFn: () => fetchAnnual({ data: { years: [2023, 2024, 2025, 2026] } }),
    staleTime: 1000 * 60 * 5,
  });

  // Ocorrências por ano (Florestal vs Urbano)
  const yearlyChartData = useMemo(() => {
    if (!annualData || annualData.length === 0) return [];
    return annualData.map((y) => {
      const florestal = Number(y.incendios?.totals?.flor) || 0;
      const urbano = Number(y.incendios?.totals?.urb) || 0;

      return {
        year: String(y.year),
        florestal,
        urbano,
      };
    });
  }, [annualData]);

  // Municípios mais afetados por Incêndios (Florestal vs Urbano)
  const topMunicipiosHistorico = useMemo(() => {
    if (!annualData || annualData.length === 0) return [];
    const munMap = new Map<
      string,
      { name: string; florestal: number; urbano: number; total: number }
    >();

    for (const y of annualData) {
      for (const inc of y.incendios?.rows || []) {
        const m = canonicalMunicipio(inc.mun);
        if (!m || m === "—") continue;
        const cur = munMap.get(m) || { name: m, florestal: 0, urbano: 0, total: 0 };
        const flor = Number(inc.flor) || 0;
        const urb = Number(inc.urb) || 0;
        cur.florestal += flor;
        cur.urbano += urb;
        cur.total += (flor + urb);
        munMap.set(m, cur);
      }
    }

    return Array.from(munMap.values())
      .sort((a, b) => b.total - a.total)
      .slice(0, 10)
      .reverse(); // para aparecer na ordem correta de cima para baixo no gráfico vertical
  }, [annualData]);

  // Período formatado
  const dateRangeLabel = useMemo(() => {
    if (!annualData || annualData.length === 0) return "Período: 12/07/2023 a 27/08/2026";
    let minDate: string | null = null;
    let maxDate: string | null = null;
    for (const y of annualData) {
      if (y.from && (!minDate || y.from < minDate)) minDate = y.from;
      if (y.to && (!maxDate || y.to > maxDate)) maxDate = y.to;
    }
    const fmt = (d: string | null) => {
      if (!d) return "";
      const [yy, mm, dd] = d.split("-");
      return `${dd}/${mm}/${yy}`;
    };
    return minDate && maxDate
      ? `Período: ${fmt(minDate)} a ${fmt(maxDate)}`
      : "Período: 12/07/2023 a 27/08/2026";
  }, [annualData]);

  // 1. Incêndios por Município (Ranking)
  const rankingIncendios = useMemo(() => {
    return (data.incendios_diario ?? [])
      .map((r) => {
        const mun = canonicalMunicipio(r.mun);
        const urbano = Number(r.urb) || 0;
        const florestal = Number(r.flor) || 0;
        return {
          name: mun,
          urbano,
          florestal,
          total: urbano + florestal,
        };
      })
      .filter((r) => r.total > 0)
      .sort((a, b) => b.total - a.total)
      .slice(0, 10);
  }, [data.incendios_diario]);

  // 2. Distribuição por Categoria de Ocorrência (Donut)
  const ocorrenciasDist = useMemo(() => {
    const list = data.outras_diarias ?? [];
    const incList = data.incendios_diario ?? [];

    const totalFlorestal = incList.reduce((acc, r) => acc + (Number(r.flor) || 0), 0);
    const totalUrbano = incList.reduce((acc, r) => acc + (Number(r.urb) || 0), 0);

    const totals = {
      florestal: totalFlorestal,
      urbano: totalUrbano,
      salvamento: list.reduce((acc, r) => acc + (Number(r.salvamento) || 0), 0),
      aph: list.reduce((acc, r) => acc + (Number(r.aph) || 0), 0),
      prevencao: list.reduce((acc, r) => acc + (Number(r.prevencao) || 0), 0),
      acidentes: list.reduce((acc, r) => acc + (Number(r.acidentes) || 0), 0),
    };

    return [
      { name: "Incêndio Florestal", value: totals.florestal, color: "#ef4444" },
      { name: "Incêndio Urbano", value: totals.urbano, color: "#f59e0b" },
      { name: "APH / Resgate", value: totals.aph, color: "#3b82f6" },
      { name: "Salvamento", value: totals.salvamento, color: "#10b981" },
      { name: "Ações Preventivas", value: totals.prevencao, color: "#06b6d4" },
      { name: "Acidentes", value: totals.acidentes, color: "#8b5cf6" },
    ].filter((d) => d.value > 0);
  }, [data.outras_diarias, data.incendios_diario]);

  // 3. Efetivo Mobilizado
  const efetivoInfo = useMemo(() => {
    const list = data.efetivo ?? [];
    const ord = list.reduce((acc, r) => acc + (Number(r.ord) || 0), 0);
    const seg = list.reduce((acc, r) => acc + (Number(r.seg) || 0), 0);
    const brig = list.reduce((acc, r) => acc + (Number(r.brig) || 0), 0);
    const total = ord + seg + brig;

    const items = [
      {
        id: "ord",
        name: "Serviço Ordinário (BM)",
        subtitle: "Bombeiros Militares em regime regular",
        value: ord,
        pct: total > 0 ? ((ord / total) * 100).toFixed(1) : "0.0",
        color: "#3b82f6",
        accentBorder: "border-blue-500/30 hover:border-blue-500/50",
        accentBg: "bg-blue-500/[0.04]",
        iconBg: "bg-blue-500/10 text-blue-600 dark:text-blue-400",
        badgeStyle: "bg-blue-500/15 text-blue-700 dark:text-blue-300",
        barColor: "bg-blue-500",
        icon: Shield,
      },
      {
        id: "seg",
        name: "SEG Especial (BM)",
        subtitle: "Serviço Extra Gratificado de prontidão",
        value: seg,
        pct: total > 0 ? ((seg / total) * 100).toFixed(1) : "0.0",
        color: "#10b981",
        accentBorder: "border-emerald-500/30 hover:border-emerald-500/50",
        accentBg: "bg-emerald-500/[0.04]",
        iconBg: "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400",
        badgeStyle: "bg-emerald-500/15 text-emerald-700 dark:text-emerald-300",
        barColor: "bg-emerald-500",
        icon: Sparkles,
      },
      {
        id: "brig",
        name: "Brigadistas Civis",
        subtitle: "Brigadas municipais & voluntários",
        value: brig,
        pct: total > 0 ? ((brig / total) * 100).toFixed(1) : "0.0",
        color: "#f59e0b",
        accentBorder: "border-amber-500/30 hover:border-amber-500/50",
        accentBg: "bg-amber-500/[0.04]",
        iconBg: "bg-amber-500/10 text-amber-600 dark:text-amber-400",
        badgeStyle: "bg-amber-500/15 text-amber-700 dark:text-amber-300",
        barColor: "bg-amber-500",
        icon: Users,
      },
    ];

    return { total, items };
  }, [data.efetivo]);

  // 4. Totais gerais e proporção florestal vs urbano
  const totalCombates = useMemo(() => {
    const list = data.incendios_diario ?? [];
    const flor = list.reduce((acc, r) => acc + (Number(r.flor) || 0), 0);
    const urb = list.reduce((acc, r) => acc + (Number(r.urb) || 0), 0);
    const total = flor + urb;
    const pctFlor = total > 0 ? ((flor / total) * 100).toFixed(1) : "0";
    const pctUrb = total > 0 ? ((urb / total) * 100).toFixed(1) : "0";
    return { flor, urb, total, pctFlor, pctUrb };
  }, [data.incendios_diario]);

  // 5. Recursos Operacionais em Campo
  const recursosInfo = useMemo(() => {
    const list = data.recursos ?? [];
    const sum = (keys: string[]) =>
      list.reduce(
        (acc, r: any) =>
          acc + keys.reduce((s, k) => s + (Number(r[k]) || 0), 0),
        0
      );

    const viaturas = sum([
      "abt", "at", "aem", "atp", "ata", "abf", "atf", "abs", "pipa", "dosa",
      "crs", "ar", "ur", "gse", "mt", "ta", "quadriciclo", "picape_fn",
      "picape_muni", "autoarp", "picape_esfron",
    ]);
    const embarcacoes = sum(["embarcacao", "jetski"]);
    const aeronaves = sum(["helicoptero", "aviao"]);
    const total = viaturas + embarcacoes + aeronaves;

    const items = [
      {
        id: "viaturas",
        name: "Viaturas Terrestres",
        subtitle: "ABT, UR, Salvamento, Resgate e Apoio",
        value: viaturas,
        pct: total > 0 ? ((viaturas / total) * 100).toFixed(1) : "0.0",
        color: "#3b82f6",
        accentBorder: "border-blue-500/30 hover:border-blue-500/50",
        accentBg: "bg-blue-500/[0.04]",
        iconBg: "bg-blue-500/10 text-blue-600 dark:text-blue-400",
        badgeStyle: "bg-blue-500/15 text-blue-700 dark:text-blue-300",
        barColor: "bg-blue-500",
        icon: Truck,
      },
      {
        id: "embarcacoes",
        name: "Meios Fluviais",
        subtitle: "Lanchas, Embarcações e Jet Skis",
        value: embarcacoes,
        pct: total > 0 ? ((embarcacoes / total) * 100).toFixed(1) : "0.0",
        color: "#06b6d4",
        accentBorder: "border-cyan-500/30 hover:border-cyan-500/50",
        accentBg: "bg-cyan-500/[0.04]",
        iconBg: "bg-cyan-500/10 text-cyan-600 dark:text-cyan-400",
        badgeStyle: "bg-cyan-500/15 text-cyan-700 dark:text-cyan-300",
        barColor: "bg-cyan-500",
        icon: Activity,
      },
      {
        id: "aeronaves",
        name: "Apoio Aéreo",
        subtitle: "Aviões e Helicópteros em monitoramento",
        value: aeronaves,
        pct: total > 0 ? ((aeronaves / total) * 100).toFixed(1) : "0.0",
        color: "#8b5cf6",
        accentBorder: "border-purple-500/30 hover:border-purple-500/50",
        accentBg: "bg-purple-500/[0.04]",
        iconBg: "bg-purple-500/10 text-purple-600 dark:text-purple-400",
        badgeStyle: "bg-purple-500/15 text-purple-700 dark:text-purple-300",
        barColor: "bg-purple-500",
        icon: TreePine,
      },
    ];

    return { total, items };
  }, [data.recursos]);

  const hasData = rankingIncendios.length > 0 || ocorrenciasDist.length > 0;

  if (!hasData) {
    return (
      <Card className="border-dashed border-2 bg-muted/20">
        <CardContent className="flex flex-col items-center justify-center py-16 text-center space-y-3">
          <div className="w-14 h-14 rounded-2xl bg-muted flex items-center justify-center text-muted-foreground">
            <Activity className="w-7 h-7" />
          </div>
          <div className="space-y-1">
            <h3 className="font-semibold text-lg">Nenhum dado encontrado para os filtros ativos</h3>
            <p className="text-sm text-muted-foreground max-w-md">
              Tente alterar o período de datas, selecionar "Todos os Municípios" ou limpar os filtros para visualizar os indicadores operacionais.
            </p>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-6">
      {/* Banner de Comparação (se ativo) */}
      {comparisonData && (
        <div className="bg-amber-500/10 border border-amber-500/30 rounded-2xl p-4 flex flex-col md:flex-row items-start md:items-center justify-between gap-3 animate-in fade-in">
          <div className="flex items-center gap-3">
            <div className="p-2.5 rounded-xl bg-amber-500 text-white shadow-sm">
              <ArrowRightLeft className="w-5 h-5" />
            </div>
            <div>
              <p className="font-bold text-sm text-foreground">
                Modo Comparativo Ativo
              </p>
              <p className="text-xs text-muted-foreground">
                Comparando período base com período anterior da operação.
              </p>
            </div>
          </div>
          <div className="flex items-center gap-4 text-xs font-mono font-semibold">
            <div className="flex items-center gap-1.5">
              <span>Incêndios:</span>
              <DeltaBadge delta={comparisonData.deltas.incendios.total.percentage} isGoodWhenNegative />
            </div>
            <div className="flex items-center gap-1.5">
              <span>Efetivo:</span>
              <DeltaBadge delta={comparisonData.deltas.efetivo.total.percentage} />
            </div>
          </div>
        </div>
      )}

      {/* Destaque de Proporção: Combate Florestal vs Urbano */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {/* Card Florestal */}
        <Card className="border-rose-500/20 bg-gradient-to-br from-rose-500/5 via-card to-card overflow-hidden">
          <CardContent className="p-5 flex items-center justify-between">
            <div className="space-y-1">
              <span className="text-xs font-bold uppercase tracking-wider text-rose-600 dark:text-rose-400 flex items-center gap-1.5">
                <TreePine className="w-4 h-4" /> Incêndios Florestais (Vegetação)
              </span>
              <p className="text-3xl font-extrabold font-display tabular-nums text-foreground">
                {NF.format(totalCombates.flor)}
              </p>
              <p className="text-xs text-muted-foreground">
                Representa <strong className="text-rose-600">{totalCombates.pctFlor}%</strong> do total de combates registrados
              </p>
            </div>
            <div className="w-14 h-14 rounded-2xl bg-rose-500/10 text-rose-600 flex items-center justify-center shrink-0">
              <Flame className="w-8 h-8" />
            </div>
          </CardContent>
        </Card>

        {/* Card Urbano */}
        <Card className="border-amber-500/20 bg-gradient-to-br from-amber-500/5 via-card to-card overflow-hidden">
          <CardContent className="p-5 flex items-center justify-between">
            <div className="space-y-1">
              <span className="text-xs font-bold uppercase tracking-wider text-amber-600 dark:text-amber-400 flex items-center gap-1.5">
                <Building2 className="w-4 h-4" /> Incêndios Urbanos (Edificações / Lotes)
              </span>
              <p className="text-3xl font-extrabold font-display tabular-nums text-foreground">
                {NF.format(totalCombates.urb)}
              </p>
              <p className="text-xs text-muted-foreground">
                Representa <strong className="text-amber-600">{totalCombates.pctUrb}%</strong> do total de combates registrados
              </p>
            </div>
            <div className="w-14 h-14 rounded-2xl bg-amber-500/10 text-amber-600 flex items-center justify-center shrink-0">
              <Flame className="w-8 h-8" />
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Resumo Territorial de Incêndios com Filtros Individuais de Ano e Meses */}
      <div className="space-y-3">
        <div className="flex items-center gap-2 px-4 py-2.5 rounded-xl bg-amber-500/10 border border-amber-500/25 text-amber-500 text-xs font-medium">
          <span>• Há período em andamento ou incompleto.</span>
        </div>
        <TerritorialFireSummary annualData={annualData} />
      </div>

      {/* Linha de Gráficos Históricos: Ocorrências por Ano e Municípios Mais Afetados */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
        {/* Gráfico 1: Ocorrências por ano */}
        <Card className="border-border bg-card shadow-sm">
          <CardHeader className="p-4 sm:p-5 border-b border-border/60">
            <div className="flex items-center justify-between">
              <div>
                <CardTitle className="text-base font-bold text-foreground flex items-center gap-2">
                  <Activity className="w-4 h-4 text-emerald-500" />
                  Ocorrências por ano
                </CardTitle>
                <CardDescription className="text-xs">
                  {dateRangeLabel}
                </CardDescription>
              </div>
              <Badge variant="outline" className="text-xs font-mono font-bold">
                2023 - 2026
              </Badge>
            </div>
          </CardHeader>
          <CardContent className="p-4 sm:p-5">
            <div className="h-80 w-full">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart
                  data={yearlyChartData}
                  margin={{ top: 25, right: 15, left: -15, bottom: 10 }}
                >
                  <CartesianGrid strokeDasharray="3 3" opacity={0.15} vertical={false} />
                  <XAxis
                    dataKey="year"
                    tick={{ fontSize: 12, fill: "currentColor" }}
                    axisLine={{ strokeOpacity: 0.2 }}
                  />
                  <YAxis tick={{ fontSize: 11 }} axisLine={{ strokeOpacity: 0.2 }} />
                  <Tooltip
                    contentStyle={{
                      backgroundColor: "rgba(15, 23, 42, 0.95)",
                      borderRadius: "12px",
                      border: "none",
                      color: "#fff",
                      fontSize: "12px",
                    }}
                  />
                  <Legend wrapperStyle={{ fontSize: "11px", paddingTop: "10px" }} />
                  <Bar
                    dataKey="florestal"
                    name="Florestal"
                    fill="#10b981"
                    radius={[4, 4, 0, 0]}
                  >
                    <LabelList
                      dataKey="florestal"
                      position="top"
                      fill="currentColor"
                      fontSize={11}
                      fontWeight={700}
                      formatter={(v: any) => (Number(v) > 0 ? NF.format(Number(v)) : "")}
                    />
                  </Bar>
                  <Bar
                    dataKey="urbano"
                    name="Urbano"
                    fill="#0ea5e9"
                    radius={[4, 4, 0, 0]}
                  >
                    <LabelList
                      dataKey="urbano"
                      position="top"
                      fill="currentColor"
                      fontSize={11}
                      fontWeight={700}
                      formatter={(v: any) => (Number(v) > 0 ? NF.format(Number(v)) : "")}
                    />
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </div>
          </CardContent>
        </Card>

        {/* Gráfico 2: Municípios mais afetados */}
        <Card className="border-border bg-card shadow-sm">
          <CardHeader className="p-4 sm:p-5 border-b border-border/60">
            <div className="flex items-center justify-between">
              <div>
                <CardTitle className="text-base font-bold text-foreground flex items-center gap-2">
                  <MapPin className="w-4 h-4 text-blue-500" />
                  Municípios mais afetados
                </CardTitle>
                <CardDescription className="text-xs">
                  Top 10 no {dateRangeLabel.toLowerCase()}
                </CardDescription>
              </div>
              <Badge variant="outline" className="text-xs font-mono font-bold">
                Top 10
              </Badge>
            </div>
          </CardHeader>
          <CardContent className="p-4 sm:p-5">
            <div className="h-80 w-full">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart
                  layout="vertical"
                  data={topMunicipiosHistorico}
                  margin={{ top: 10, right: 40, left: 30, bottom: 10 }}
                >
                  <CartesianGrid strokeDasharray="3 3" opacity={0.15} horizontal={false} />
                  <XAxis type="number" tick={{ fontSize: 11 }} axisLine={{ strokeOpacity: 0.2 }} />
                  <YAxis
                    dataKey="name"
                    type="category"
                    tick={{ fontSize: 11, fill: "currentColor" }}
                    width={95}
                    axisLine={{ strokeOpacity: 0.2 }}
                  />
                  <Tooltip
                    contentStyle={{
                      backgroundColor: "rgba(15, 23, 42, 0.95)",
                      borderRadius: "12px",
                      border: "none",
                      color: "#fff",
                      fontSize: "12px",
                    }}
                  />
                  <Legend wrapperStyle={{ fontSize: "11px", paddingTop: "10px" }} />
                  <Bar
                    dataKey="florestal"
                    name="Florestal"
                    fill="#10b981"
                    radius={[0, 4, 4, 0]}
                  >
                    <LabelList
                      dataKey="florestal"
                      position="right"
                      fill="#10b981"
                      fontSize={10}
                      fontWeight={700}
                      formatter={(v: any) => (Number(v) > 0 ? NF.format(Number(v)) : "")}
                    />
                  </Bar>
                  <Bar
                    dataKey="urbano"
                    name="Urbano"
                    fill="#0ea5e9"
                    radius={[0, 4, 4, 0]}
                  >
                    <LabelList
                      dataKey="urbano"
                      position="right"
                      fill="#0ea5e9"
                      fontSize={10}
                      fontWeight={700}
                      formatter={(v: any) => (Number(v) > 0 ? NF.format(Number(v)) : "")}
                    />
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Grid de Gráficos do Período Filtrado */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">
        {/* Gráfico 1: Top 10 Municípios com Mais Incêndios (Ocupa 2 colunas) */}
        <Card className="lg:col-span-2 border-border bg-card shadow-sm">
          <CardHeader className="p-4 sm:p-5 border-b border-border/60">
            <div className="flex items-center justify-between">
              <div>
                <CardTitle className="text-base font-bold flex items-center gap-2">
                  <Flame className="w-4 h-4 text-rose-500" />
                  Top Municípios com Maior Incidência de Incêndios
                </CardTitle>
                <CardDescription className="text-xs">
                  Combates florestais e urbanos registrados no período
                </CardDescription>
              </div>
              <Badge variant="outline" className="text-xs font-mono">
                Top {rankingIncendios.length}
              </Badge>
            </div>
          </CardHeader>
          <CardContent className="p-4 sm:p-5">
            <div className="h-72 w-full">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart
                  data={rankingIncendios}
                  margin={{ top: 10, right: 10, left: -20, bottom: 25 }}
                >
                  <CartesianGrid strokeDasharray="3 3" opacity={0.15} vertical={false} />
                  <XAxis
                    dataKey="name"
                    tick={{ fontSize: 11, fill: "currentColor" }}
                    angle={-30}
                    textAnchor="end"
                    interval={0}
                  />
                  <YAxis tick={{ fontSize: 11 }} />
                  <Tooltip
                    contentStyle={{
                      backgroundColor: "rgba(15, 23, 42, 0.95)",
                      borderRadius: "12px",
                      border: "none",
                      color: "#fff",
                      fontSize: "12px",
                    }}
                  />
                  <Legend wrapperStyle={{ fontSize: "11px", paddingTop: "10px" }} />
                  <Bar
                    dataKey="florestal"
                    name="Florestal"
                    fill="#ef4444"
                    radius={[4, 4, 0, 0]}
                    stackId="a"
                  />
                  <Bar
                    dataKey="urbano"
                    name="Urbano"
                    fill="#f59e0b"
                    radius={[4, 4, 0, 0]}
                    stackId="a"
                  />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </CardContent>
        </Card>

        {/* Gráfico 2: Donut Chart de Distribuição de Ocorrências */}
        <Card className="border-border bg-card shadow-sm">
          <CardHeader className="p-4 sm:p-5 border-b border-border/60">
            <CardTitle className="text-base font-bold flex items-center gap-2">
              <Activity className="w-4 h-4 text-emerald-500" />
              Tipologia Geral de Atendimentos
            </CardTitle>
            <CardDescription className="text-xs">
              Proporção de ocorrências por categoria
            </CardDescription>
          </CardHeader>
          <CardContent className="p-4 sm:p-5 flex flex-col items-center justify-center">
            <div className="h-64 w-full">
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie
                    data={ocorrenciasDist}
                    dataKey="value"
                    nameKey="name"
                    cx="50%"
                    cy="50%"
                    innerRadius={50}
                    outerRadius={80}
                    paddingAngle={4}
                  >
                    {ocorrenciasDist.map((entry, index) => (
                      <Cell key={`cell-${index}`} fill={entry.color || PIE_COLORS[index % PIE_COLORS.length]} />
                    ))}
                  </Pie>
                  <Tooltip
                    contentStyle={{
                      backgroundColor: "rgba(15, 23, 42, 0.95)",
                      borderRadius: "10px",
                      border: "none",
                      color: "#fff",
                      fontSize: "12px",
                    }}
                  />
                  <Legend wrapperStyle={{ fontSize: "10px" }} />
                </PieChart>
              </ResponsiveContainer>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Linha 2: Força Operacional e Recursos em Campo */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
        {/* Composição de Efetivo */}
        <Card className="border-border bg-card shadow-sm overflow-hidden">
          <CardHeader className="p-4 sm:p-5 border-b border-border/60 bg-muted/20">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
              <div className="flex items-center gap-2.5">
                <div className="w-9 h-9 rounded-xl bg-blue-500/10 text-blue-600 flex items-center justify-center font-bold">
                  <Users className="w-5 h-5" />
                </div>
                <div>
                  <CardTitle className="text-base font-bold text-foreground">
                    Composição de Força Operacional
                  </CardTitle>
                  <CardDescription className="text-xs">
                    Distribuição do efetivo mobilizado em campo
                  </CardDescription>
                </div>
              </div>
              <Badge variant="outline" className="bg-background text-xs font-mono font-bold px-2.5 py-1 self-start sm:self-auto border-blue-500/30 text-blue-600 dark:text-blue-400">
                {NF.format(efetivoInfo.total)} agentes / dia
              </Badge>
            </div>

            {/* Barra de Distribuição Proporcional Segmentada */}
            {efetivoInfo.total > 0 && (
              <div className="mt-3">
                <div className="w-full h-2 rounded-full overflow-hidden flex bg-muted">
                  {efetivoInfo.items.map((e) => (
                    <div
                      key={e.id}
                      style={{ width: `${e.pct}%`, backgroundColor: e.color }}
                      className="h-full transition-all"
                      title={`${e.name}: ${e.pct}%`}
                    />
                  ))}
                </div>
              </div>
            )}
          </CardHeader>

          <CardContent className="p-4 sm:p-5 space-y-3">
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              {efetivoInfo.items.map((e) => {
                const IconComponent = e.icon;
                return (
                  <div
                    key={e.id}
                    className={cn(
                      "p-3.5 rounded-xl border transition-all flex flex-col justify-between space-y-2.5",
                      e.accentBorder,
                      e.accentBg
                    )}
                  >
                    <div className="flex items-center justify-between">
                      <div className={cn("w-7 h-7 rounded-lg flex items-center justify-center", e.iconBg)}>
                        <IconComponent className="w-3.5 h-3.5" />
                      </div>
                      <span className={cn("text-[11px] font-bold px-2 py-0.5 rounded-md", e.badgeStyle)}>
                        {e.pct}%
                      </span>
                    </div>

                    <div>
                      <div className="text-2xl font-black tabular-nums text-foreground">
                        {NF.format(e.value)}
                      </div>
                      <div className="text-xs font-bold text-foreground mt-0.5">
                        {e.name}
                      </div>
                      <p className="text-[11px] text-muted-foreground mt-0.5 line-clamp-1">
                        {e.subtitle}
                      </p>
                    </div>

                    <div className="w-full h-1.5 bg-muted rounded-full overflow-hidden">
                      <div
                        className={cn("h-full rounded-full", e.barColor)}
                        style={{ width: `${e.pct}%` }}
                      />
                    </div>
                  </div>
                );
              })}
            </div>
          </CardContent>
        </Card>

        {/* Recursos em Operação */}
        <Card className="border-border bg-card shadow-sm overflow-hidden">
          <CardHeader className="p-4 sm:p-5 border-b border-border/60 bg-muted/20">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
              <div className="flex items-center gap-2.5">
                <div className="w-9 h-9 rounded-xl bg-emerald-500/10 text-emerald-600 flex items-center justify-center font-bold">
                  <Shield className="w-5 h-5" />
                </div>
                <div>
                  <CardTitle className="text-base font-bold text-foreground">
                    Recursos & Logística em Operação
                  </CardTitle>
                  <CardDescription className="text-xs">
                    Meios materiais empenhados nas ações operacionais
                  </CardDescription>
                </div>
              </div>
              <Badge variant="outline" className="bg-background text-xs font-mono font-bold px-2.5 py-1 self-start sm:self-auto border-emerald-500/30 text-emerald-600 dark:text-emerald-400">
                {NF.format(recursosInfo.total)} meios ativos
              </Badge>
            </div>

            {/* Barra de Distribuição Proporcional Segmentada */}
            {recursosInfo.total > 0 && (
              <div className="mt-3">
                <div className="w-full h-2 rounded-full overflow-hidden flex bg-muted">
                  {recursosInfo.items.map((r) => (
                    <div
                      key={r.id}
                      style={{ width: `${r.pct}%`, backgroundColor: r.color }}
                      className="h-full transition-all"
                      title={`${r.name}: ${r.pct}%`}
                    />
                  ))}
                </div>
              </div>
            )}
          </CardHeader>

          <CardContent className="p-4 sm:p-5 space-y-3">
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              {recursosInfo.items.map((r) => {
                const IconComponent = r.icon;
                return (
                  <div
                    key={r.id}
                    className={cn(
                      "p-3.5 rounded-xl border transition-all flex flex-col justify-between space-y-2.5",
                      r.accentBorder,
                      r.accentBg
                    )}
                  >
                    <div className="flex items-center justify-between">
                      <div className={cn("w-7 h-7 rounded-lg flex items-center justify-center", r.iconBg)}>
                        <IconComponent className="w-3.5 h-3.5" />
                      </div>
                      <span className={cn("text-[11px] font-bold px-2 py-0.5 rounded-md", r.badgeStyle)}>
                        {r.pct}%
                      </span>
                    </div>

                    <div>
                      <div className="text-2xl font-black tabular-nums text-foreground">
                        {NF.format(r.value)}
                      </div>
                      <div className="text-xs font-bold text-foreground mt-0.5">
                        {r.name}
                      </div>
                      <p className="text-[11px] text-muted-foreground mt-0.5 line-clamp-1">
                        {r.subtitle}
                      </p>
                    </div>

                    <div className="w-full h-1.5 bg-muted rounded-full overflow-hidden">
                      <div
                        className={cn("h-full rounded-full", r.barColor)}
                        style={{ width: `${r.pct}%` }}
                      />
                    </div>
                  </div>
                );
              })}
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
});

function DeltaBadge({
  delta,
  isGoodWhenNegative = false,
}: {
  delta: number;
  isGoodWhenNegative?: boolean;
}) {
  if (delta === 0) {
    return (
      <span className="text-muted-foreground flex items-center">
        <Minus className="w-3 h-3 mr-0.5" /> 0%
      </span>
    );
  }

  const isPositive = delta > 0;
  const isGood = isGoodWhenNegative ? !isPositive : isPositive;

  return (
    <span
      className={`flex items-center px-1.5 py-0.5 rounded text-[11px] font-bold ${
        isGood
          ? "bg-emerald-500/20 text-emerald-700 dark:text-emerald-300"
          : "bg-rose-500/20 text-rose-700 dark:text-rose-300"
      }`}
    >
      {isPositive ? (
        <TrendingUp className="w-3 h-3 mr-0.5" />
      ) : (
        <TrendingDown className="w-3 h-3 mr-0.5" />
      )}
      {isPositive ? `+${delta}%` : `${delta}%`}
    </span>
  );
}
