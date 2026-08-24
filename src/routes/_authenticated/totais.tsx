import { compareMunicipios, canonicalMunicipio } from "@/lib/municipio-order";
import { createFileRoute, Link } from "@tanstack/react-router";
import { useMemo, useState, useEffect } from "react";
import { keepPreviousData, useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import {
  ArrowLeft,
  Filter,
  FileText,
  Layers,
  Loader2,
  Share2,
  Download,
  Search,
  Flame,
  ShieldAlert,
  Users,
  Truck,
  FileSpreadsheet,
  Calendar,
  Sparkles,
  ArrowRightLeft,
  TrendingUp,
  TrendingDown,
} from "lucide-react";

import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { listDailyReports, getLatestReportDate } from "@/lib/daily-reports.functions";
import { getAnnualIncendios } from "@/lib/annual-reports.functions";
import { SHIFTS, SHIFT_TAB, type ReportShift } from "@/lib/report-shift";
import { exportTotaisToXlsx } from "@/lib/export-xlsx";

export const Route = createFileRoute("/_authenticated/totais")({
  head: () => ({
    meta: [
      { title: "Totais acumulados · Sala de Situação · CBMAM" },
      { name: "robots", content: "noindex" },
    ],
  }),
  component: TotaisPage,
});

function firstOfMonthISO() {
  const d = new Date();
  d.setDate(1);
  return d.toISOString().split("T")[0];
}
function todayISO() {
  return new Date().toISOString().split("T")[0];
}

type AnyRow = Record<string, any>;

function getItemVal(item: AnyRow | undefined, key: string): number {
  if (!item) return 0;
  if (item[key] !== undefined && item[key] !== null) return Number(item[key]) || 0;
  const normTarget = key
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]/gi, "")
    .toLowerCase();

  for (const [k, v] of Object.entries(item)) {
    if (k === "mun" || k === "municipio") continue;
    const normK = k
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "")
      .replace(/[^a-z0-9]/gi, "")
      .toLowerCase();
    if (normK === normTarget) return Number(v) || 0;
  }
  return 0;
}

function aggregateSum(rows: AnyRow[], field: string, keys: string[]) {
  const map = new Map<string, Record<string, number>>();
  const nameMap = new Map<string, string>();
  for (const r of rows) {
    const list: AnyRow[] = (r?.[field] as AnyRow[]) ?? [];
    for (const item of list) {
      const mun = canonicalMunicipio(item?.mun ?? item?.municipio);
      if (!mun || mun === "—") continue;
      const key = mun.toLowerCase();
      nameMap.set(key, mun);
      const cur = map.get(key) ?? Object.fromEntries(keys.map((k) => [k, 0]));
      for (const k of keys) cur[k] = (cur[k] ?? 0) + getItemVal(item, k);
      map.set(key, cur);
    }
  }
  return Array.from(map.entries())
    .map(([key, vals]) => ({ mun: nameMap.get(key) || key, ...vals }))
    .sort((a, b) => compareMunicipios(a.mun, b.mun));
}

function aggregateSnapshot(rows: AnyRow[], field: string, keys: string[]) {
  const sortedRows = [...rows].sort((a, b) =>
    String(b.report_date || "").localeCompare(String(a.report_date || ""))
  );
  const map = new Map<string, Record<string, number>>();
  const nameMap = new Map<string, string>();
  const seenDates = new Map<string, string>();

  for (const r of sortedRows) {
    const reportDate = String(r.report_date || "");
    const list: AnyRow[] = (r?.[field] as AnyRow[]) ?? [];
    for (const item of list) {
      const mun = canonicalMunicipio(item?.mun ?? item?.municipio);
      if (!mun || mun === "—") continue;
      const key = mun.toLowerCase();
      nameMap.set(key, mun);

      const lastDate = seenDates.get(key);
      if (!lastDate) {
        seenDates.set(key, reportDate);
        const cur = Object.fromEntries(keys.map((k) => [k, getItemVal(item, k)]));
        map.set(key, cur);
      } else if (lastDate === reportDate) {
        const cur = map.get(key) ?? Object.fromEntries(keys.map((k) => [k, 0]));
        for (const k of keys) {
          cur[k] = (cur[k] ?? 0) + getItemVal(item, k);
        }
        map.set(key, cur);
      }
    }
  }
  return Array.from(map.entries())
    .map(([key, vals]) => ({ mun: nameMap.get(key) || key, ...vals }))
    .sort((a, b) => compareMunicipios(a.mun, b.mun));
}

function TotaisPage() {
  const [from, setFrom] = useState<string>("2026-06-01");
  const [to, setTo] = useState<string>(todayISO());
  const [searchMun, setSearchMun] = useState<string>("");
  const getLatest = useServerFn(getLatestReportDate);

  useEffect(() => {
    getLatest().then((dateStr) => {
      if (dateStr) {
        const latestDate = new Date(`${dateStr}T12:00:00Z`);
        const now = new Date();
        if (
          latestDate.getFullYear() !== now.getFullYear() ||
          latestDate.getMonth() !== now.getMonth()
        ) {
          const first = new Date(latestDate);
          first.setDate(1);
          setFrom(first.toISOString().split("T")[0]);
          setTo(latestDate.toISOString().split("T")[0]);
        }
      }
    });
  }, [getLatest]);
  const [scope, setScope] = useState<"periodo" | "geral">("periodo");
  const [shift, setShift] = useState<ReportShift | "ambos">("ambos");
  const [activeTab, setActiveTab] = useState<"incendios" | "outras" | "efetivo" | "recursos">("incendios");

  const listFn = useServerFn(listDailyReports);
  
  const fromPrev = useMemo(() => {
    const d = new Date(from + "T12:00:00Z");
    d.setFullYear(d.getFullYear() - 1);
    return d.toISOString().split("T")[0];
  }, [from]);

  const toPrev = useMemo(() => {
    const d = new Date(to + "T12:00:00Z");
    d.setFullYear(d.getFullYear() - 1);
    return d.toISOString().split("T")[0];
  }, [to]);

  const q = useQuery({
    queryKey: ["daily-reports", scope, from, to, shift],
    queryFn: () => listFn({ data: { ...(scope === "periodo" ? { from, to } : {}), ...(shift === "ambos" ? {} : { shift }) } }),
    placeholderData: keepPreviousData,
    staleTime: 60_000,
  });

  const qPrev = useQuery({
    queryKey: ["daily-reports-prev", scope, fromPrev, toPrev, shift],
    queryFn: () => listFn({ data: { from: fromPrev, to: toPrev, ...(shift === "ambos" ? {} : { shift }) } }),
    enabled: isAnnualComparison && scope === "periodo",
    placeholderData: keepPreviousData,
    staleTime: 60_000,
  });


  const rows = useMemo(() => {
    const raw = (q.data ?? []) as AnyRow[];
    if (shift !== "ambos") return raw;
    const byDate = new Map<string, AnyRow>();
    for (const r of raw) {
      const d = String(r.report_date || "");
      if (!d) continue;
      const cur = byDate.get(d);
      if (!cur) {
        byDate.set(d, r);
      } else if (r.shift === "noturno" && cur.shift !== "noturno") {
        byDate.set(d, r);
      }
    }
    return Array.from(byDate.values());
  }, [q.data, shift]);

  const efetivoFull = useMemo(() => aggregateSnapshot(rows, "efetivo", ["ord", "seg", "brig"]), [rows]);
  const recursosFull = useMemo(
    () =>
      aggregateSnapshot(rows, "recursos", [
        "abt",
        "at",
        "aem",
        "atp",
        "ata",
        "abf",
        "atf",
        "abs",
        "pipa",
        "dosa",
        "crs",
        "ar",
        "ur",
        "gse",
        "mt",
        "ta",
        "quadriciclo",
        "embarcacao",
        "picape_fn",
        "picape_muni",
        "autoarp",
        "picape_esfron",
        "helicoptero",
        "aviao",
        "jetski",
      ]),
    [rows],
  );

  const incendiosFull = useMemo(() => aggregateSum(rows, "incendios", ["urb", "flor", "focos"]), [rows]);
  const outrasFull = useMemo(
    () => aggregateSum(rows, "outras", ["salvamento", "acidentes", "aph", "prevencao", "servicos"]),
    [rows],
  );

  // Filtro de município por busca
  const filterBySearch = <T extends { mun: string }>(list: T[]): T[] => {
    if (!searchMun.trim()) return list;
    const term = searchMun.trim().toLowerCase();
    return list.filter((item) => item.mun.toLowerCase().includes(term));
  };

  const incendios = useMemo(() => filterBySearch(incendiosFull), [incendiosFull, searchMun]);
  const outras = useMemo(() => filterBySearch(outrasFull), [outrasFull, searchMun]);
  const efetivo = useMemo(() => filterBySearch(efetivoFull), [efetivoFull, searchMun]);
  const recursos = useMemo(() => filterBySearch(recursosFull), [recursosFull, searchMun]);

  const totals = useMemo(() => {
    const sum = (list: AnyRow[], keys: string[]) =>
      keys.reduce((acc, k) => acc + list.reduce((s, r) => s + (Number(r[k]) || 0), 0), 0);
    return {
      dias: rows.length,
      incendios: sum(incendiosFull, ["urb", "flor"]),
      focos: sum(incendiosFull, ["focos"]),
      outras: sum(outrasFull, ["salvamento", "acidentes", "aph", "prevencao", "servicos"]),
      efetivo: sum(efetivoFull, ["ord", "seg", "brig"]),
    };
  }, [rows, incendiosFull, outrasFull, efetivoFull]);

  // Atalhos Rápidos de Período
  const [isAnnualComparison, setIsAnnualComparison] = useState(false);

  const applyPresetFilter = (type: "hoje" | "7d" | "mes" | "safra" | "ano") => {

    const now = new Date();
    const pad = (n: number) => String(n).padStart(2, "0");
    const fmt = (d: Date) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;

    setScope("periodo");
    if (type === "hoje") {
      setFrom(fmt(now));
      setTo(fmt(now));
    } else if (type === "7d") {
      const past = new Date(now);
      past.setDate(now.getDate() - 6);
      setFrom(fmt(past));
      setTo(fmt(now));
    } else if (type === "mes") {
      const first = new Date(now.getFullYear(), now.getMonth(), 1);
      setFrom(fmt(first));
      setTo(fmt(now));
    } else if (type === "safra") {
      setFrom(`${now.getFullYear()}-06-01`);
      setTo(`${now.getFullYear()}-11-30`);
    } else if (type === "ano") {
      setFrom(`${now.getFullYear()}-01-01`);
      setTo(fmt(now));
    }
  };

  // Gerador de Resumo para WhatsApp / Boletim Informativo
  const copyWhatsAppSummary = () => {
    const periodoStr = scope === "periodo" ? `${from} a ${to}` : "Geral (Histórico Completo)";
    const topIncendios = ([...incendiosFull] as Array<Record<string, any>>)
      .sort((a, b) => (Number(b.urb || 0) + Number(b.flor || 0)) - (Number(a.urb || 0) + Number(a.flor || 0)))
      .slice(0, 5)
      .map((r) => `  • *${r.mun}*: ${Number(r.urb || 0) + Number(r.flor || 0)} inc. (${Number(r.focos || 0)} focos)`)
      .join("\n");

    const text = `🔥 *CBMAM · SARA / SALA DE SITUAÇÃO*
📊 *BOLETIM OPERACIONAL CONSOLIDADO*
📅 *Período:* ${periodoStr}

───────────────
📈 *INDICADORES CHAVE:*
 • *Relatórios computados:* ${totals.dias}
 • *Combate a Incêndios:* ${totals.incendios} ocorrências
 • *Focos de Queimadas:* ${totals.focos} focos
 • *Atendimentos Diversos:* ${totals.outras} chamados
 • *Efetivo Mobilizado:* ${totals.efetivo} militares/brigadistas

───────────────
🏆 *MUNICÍPIOS COM MAIOR INCIDÊNCIA:*
${topIncendios || "  Nenhum registro no período."}

───────────────
ℹ️ _Gerado automaticamente pelo Painel Amazonas + Verde CBMAM em ${new Date().toLocaleDateString("pt-BR")} às ${new Date().toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" })}._`;

    navigator.clipboard.writeText(text);
    toast.success("Resumo do Boletim copiado!", {
      description: "Pronto para colar no WhatsApp ou relatórios oficiais.",
    });
  };

  const handleExportXlsx = () => {
    const label = scope === "periodo" ? `${from}-ate-${to}` : "geral";
    exportTotaisToXlsx(incendiosFull, outrasFull, efetivoFull, recursosFull, label);
    toast.success("Planilha Excel (.xlsx) baixada com sucesso!");
  };

  return (
    <div className="min-h-dvh bg-gradient-brand-soft">
      <header className="sticky top-0 z-40 bg-gradient-brand text-white shadow-elevated">
        <div className="w-full max-w-[98%] mx-auto px-3 sm:px-6 py-3 grid grid-cols-[auto_minmax(0,1fr)] items-center gap-x-3 gap-y-2 md:flex md:items-center">
          <Button
            asChild
            variant="secondary"
            size="sm"
            className="shrink-0 bg-white/95 text-foreground"
          >
            <Link to="/painel">
              <ArrowLeft className="w-4 h-4 mr-1.5" />
              Voltar
            </Link>
          </Button>
          <div className="min-w-0">
            <div className="text-[10px] uppercase tracking-widest text-white/60">
              Sala de Situação · CBMAM
            </div>
            <h1 className="font-display text-base sm:text-lg md:text-xl font-bold truncate">
              Central de Relatórios & Totais Acumulados
            </h1>
          </div>
          <div className="col-span-2 flex flex-wrap items-center gap-2 md:col-auto md:ml-auto">
            <Button
              onClick={copyWhatsAppSummary}
              variant="secondary"
              size="sm"
              className="bg-emerald-600 hover:bg-emerald-700 text-white font-semibold gap-1.5 shadow-sm"
            >
              <Share2 className="w-4 h-4" />
              Copiar Resumo WhatsApp
            </Button>
            <Button
              onClick={handleExportXlsx}
              variant="secondary"
              size="sm"
              className="bg-white/95 text-foreground font-semibold gap-1.5"
            >
              <FileSpreadsheet className="w-4 h-4 text-emerald-600" />
              Excel (.xlsx)
            </Button>
            <Button
              asChild
              variant="secondary"
              size="sm"
              className="bg-white/95 text-foreground"
            >
              <Link to="/registro">Registro do dia</Link>
            </Button>
          </div>
        </div>
      </header>

      <main className="w-full max-w-[98%] mx-auto px-3 sm:px-6 py-6 space-y-5">
        {/* Filtros e Controles Superiores */}
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <Button
              variant={!isAnnualComparison ? "default" : "outline"}
              size="sm"
              onClick={() => setIsAnnualComparison(false)}
              className="rounded-full"
            >
              Visão por Período
            </Button>
            <Button
              variant={isAnnualComparison ? "default" : "outline"}
              size="sm"
              onClick={() => setIsAnnualComparison(true)}
              className="rounded-full gap-2"
            >
              <ArrowRightLeft className="w-4 h-4" />
              Comparativo Anual
            </Button>
          </div>
        </div>

        {/* KPIs gerais */}
        <section className="grid grid-cols-1 xs:grid-cols-2 md:grid-cols-5 gap-3">
          <Kpi label="Relatórios no filtro" value={totals.dias} />
          <Kpi label="Incêndios (total)" value={totals.incendios} />
          <Kpi label="Focos de Queimada" value={totals.focos} />
          <Kpi label="Ocorrências" value={totals.outras} />
          <Kpi label="Efetivo empenhado" value={totals.efetivo} />
        </section>


        {/* Modelos e Categorias de Relatório */}
        <section className="rounded-xl bg-card shadow-elevated p-4 sm:p-5 border border-border/80">
          <div className="flex items-center gap-2 mb-3">
            <Sparkles className="w-5 h-5 text-primary" />
            <h2 className="font-bold text-base">Modelos de Relatórios & Operações</h2>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
            <button
              type="button"
              onClick={() => {
                setActiveTab("incendios");
                applyPresetFilter("safra");
              }}
              className="p-3.5 rounded-lg border border-border bg-gradient-to-br from-amber-500/10 to-transparent hover:border-amber-500/50 text-left transition-all group"
            >
              <div className="flex items-center justify-between">
                <Flame className="w-5 h-5 text-amber-600 group-hover:scale-110 transition-transform" />
                <span className="text-[10px] font-bold uppercase tracking-wider bg-amber-500/20 text-amber-800 dark:text-amber-300 px-2 py-0.5 rounded">
                  Safra do Fogo
                </span>
              </div>
              <h3 className="font-semibold text-sm mt-2">Operação Amazonas + Verde</h3>
              <p className="text-xs text-muted-foreground mt-1">
                Foco total em combate a incêndios florestais e de vegetação (Jun-Nov).
              </p>
            </button>

            <button
              type="button"
              onClick={() => {
                setActiveTab("incendios");
                applyPresetFilter("mes");
              }}
              className="p-3.5 rounded-lg border border-border bg-gradient-to-br from-red-500/10 to-transparent hover:border-red-500/50 text-left transition-all group"
            >
              <div className="flex items-center justify-between">
                <Flame className="w-5 h-5 text-red-600 group-hover:scale-110 transition-transform" />
                <span className="text-[10px] font-bold uppercase tracking-wider bg-red-500/20 text-red-800 dark:text-red-300 px-2 py-0.5 rounded">
                  INPE / Queimadas
                </span>
              </div>
              <h3 className="font-semibold text-sm mt-2">Focos de Calor & Incêndios</h3>
              <p className="text-xs text-muted-foreground mt-1">
                Acompanhamento mensal de focos de queimada urbanos e florestais.
              </p>
            </button>

            <button
              type="button"
              onClick={() => {
                setActiveTab("outras");
                applyPresetFilter("mes");
              }}
              className="p-3.5 rounded-lg border border-border bg-gradient-to-br from-blue-500/10 to-transparent hover:border-blue-500/50 text-left transition-all group"
            >
              <div className="flex items-center justify-between">
                <ShieldAlert className="w-5 h-5 text-blue-600 group-hover:scale-110 transition-transform" />
                <span className="text-[10px] font-bold uppercase tracking-wider bg-blue-500/20 text-blue-800 dark:text-blue-300 px-2 py-0.5 rounded">
                  Atendimentos
                </span>
              </div>
              <h3 className="font-semibold text-sm mt-2">Ocorrências & Resgates</h3>
              <p className="text-xs text-muted-foreground mt-1">
                Salvamentos, APH, acidentes de trânsito e ações preventivas.
              </p>
            </button>

            <button
              type="button"
              onClick={() => {
                setActiveTab("efetivo");
                applyPresetFilter("hoje");
              }}
              className="p-3.5 rounded-lg border border-border bg-gradient-to-br from-emerald-500/10 to-transparent hover:border-emerald-500/50 text-left transition-all group"
            >
              <div className="flex items-center justify-between">
                <Users className="w-5 h-5 text-emerald-600 group-hover:scale-110 transition-transform" />
                <span className="text-[10px] font-bold uppercase tracking-wider bg-emerald-500/20 text-emerald-800 dark:text-emerald-300 px-2 py-0.5 rounded">
                  Logística
                </span>
              </div>
              <h3 className="font-semibold text-sm mt-2">Efetivo & Recursos Mobilizados</h3>
              <p className="text-xs text-muted-foreground mt-1">
                Mapeamento de viaturas, aeronaves, embarcações e militares empenhados.
              </p>
            </button>
          </div>
        </section>

        {/* Filtro principal */}
        <section className="rounded-xl bg-card shadow-elevated p-4 sm:p-5 space-y-4">
          <div className="flex flex-col gap-3 lg:flex-row lg:flex-wrap lg:items-end">
            <div className="grid grid-cols-2 gap-2 sm:flex">
              <Button
                variant={scope === "periodo" ? "default" : "outline"}
                size="sm"
                onClick={() => setScope("periodo")}
              >
                <Filter className="w-4 h-4 mr-1.5" /> Por período
              </Button>
              <Button
                variant={scope === "geral" ? "default" : "outline"}
                size="sm"
                onClick={() => setScope("geral")}
              >
                Geral (Histórico Completo)
              </Button>
            </div>
            {scope === "periodo" && (
              <div className="grid grid-cols-2 gap-2 sm:flex sm:gap-3">
                <div className="min-w-0">
                  <Label htmlFor="from">De</Label>
                  <Input
                    id="from"
                    type="date"
                    value={from}
                    onChange={(e) => setFrom(e.target.value)}
                    className="mt-1 w-full"
                  />
                </div>
                <div className="min-w-0">
                  <Label htmlFor="to">Até</Label>
                  <Input
                    id="to"
                    type="date"
                    value={to}
                    onChange={(e) => setTo(e.target.value)}
                    className="mt-1 w-full"
                  />
                </div>
              </div>
            )}

            <div className="w-full lg:w-auto lg:ml-auto">
              <Label>Turno / Fechamento</Label>
              <div className="mt-1 grid grid-cols-3 gap-1 rounded-lg border border-border bg-muted/40 p-1 sm:inline-flex">
                {(["ambos", ...SHIFTS] as const).map((s) => (
                  <button
                    key={s}
                    type="button"
                    onClick={() => setShift(s as ReportShift | "ambos")}
                    aria-pressed={shift === s}
                    className={`min-h-9 px-2 sm:px-3 py-1.5 text-xs sm:text-sm rounded-md transition-colors ${
                      shift === s
                        ? "bg-card shadow-sm font-semibold"
                        : "text-muted-foreground hover:text-foreground"
                    }`}
                  >
                    {s === "ambos" ? "Ambos" : SHIFT_TAB[s as ReportShift]}
                  </button>
                ))}
              </div>
            </div>
          </div>

          {/* Atalhos Rápidos de Período */}
          {scope === "periodo" && (
            <div className="flex flex-wrap items-center gap-1.5 pt-2 border-t border-border/60">
              <span className="text-xs font-semibold text-muted-foreground mr-1 flex items-center gap-1">
                <Calendar className="w-3.5 h-3.5" /> Filtros Rápidos:
              </span>
              <Button size="sm" variant="ghost" className="h-7 text-xs px-2.5" onClick={() => applyPresetFilter("hoje")}>
                Hoje
              </Button>
              <Button size="sm" variant="ghost" className="h-7 text-xs px-2.5" onClick={() => applyPresetFilter("7d")}>
                Últimos 7 Dias
              </Button>
              <Button size="sm" variant="ghost" className="h-7 text-xs px-2.5" onClick={() => applyPresetFilter("mes")}>
                Este Mês
              </Button>
              <Button size="sm" variant="ghost" className="h-7 text-xs px-2.5 text-amber-700 font-semibold" onClick={() => applyPresetFilter("safra")}>
                🔥 Safra do Fogo
              </Button>
              <Button size="sm" variant="ghost" className="h-7 text-xs px-2.5" onClick={() => applyPresetFilter("ano")}>
                Ano Atual
              </Button>
            </div>
          )}
        </section>

        <AnnualReportsCard activeTab={activeTab} />

        {/* Busca por Município e Abas */}
        <section className="space-y-4">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <Tabs value={activeTab} onValueChange={(v) => setActiveTab(v as any)} className="w-full sm:w-auto">
              <TabsList className="flex-wrap w-full sm:w-auto">
                <TabsTrigger value="incendios" className="gap-1.5">
                  <Flame className="w-4 h-4 text-amber-600" /> Incêndios
                </TabsTrigger>
                <TabsTrigger value="outras" className="gap-1.5">
                  <ShieldAlert className="w-4 h-4 text-blue-600" /> Ocorrências
                </TabsTrigger>
                <TabsTrigger value="efetivo" className="gap-1.5">
                  <Users className="w-4 h-4 text-emerald-600" /> Efetivo
                </TabsTrigger>
                <TabsTrigger value="recursos" className="gap-1.5">
                  <Truck className="w-4 h-4 text-purple-600" /> Recursos
                </TabsTrigger>
              </TabsList>
            </Tabs>

            <div className="relative w-full sm:w-72">
              <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
              <Input
                placeholder="Filtrar município..."
                value={searchMun}
                onChange={(e) => setSearchMun(e.target.value)}
                className="pl-9 text-sm"
              />
            </div>
          </div>

          <Tabs value={activeTab} onValueChange={(v) => setActiveTab(v as any)}>
            <TabsContent value="incendios">
              <AggTable
                title="Incêndios por município"
                headers={["Município", "Urbano", "Florestal", "Focos", "Total"]}
                rows={incendios}
                keys={["urb", "flor", "focos"]}
                sumKeys={["urb", "flor"]}
              />
            </TabsContent>
            <TabsContent value="outras">
              <AggTable
                title="Ocorrências por município"
                headers={[
                  "Município",
                  "Salvamento",
                  "Acidentes",
                  "APH",
                  "Prevenção",
                  "Serviços",
                  "Total",
                ]}
                rows={outras}
                keys={["salvamento", "acidentes", "aph", "prevencao", "servicos"]}
              />
            </TabsContent>
            <TabsContent value="efetivo">
              <AggTable
                title="Efetivo por município"
                headers={["Município", "Ordinário", "SEG", "Brigada", "Total"]}
                rows={efetivo}
                keys={["ord", "seg", "brig"]}
              />
            </TabsContent>
            <TabsContent value="recursos">
              <AggTable
                title="Recursos por município"
                headers={[
                  "Município",
                  "ABT",
                  "AT",
                  "AEM",
                  "ATP",
                  "ATA",
                  "ABF",
                  "ATF",
                  "ABS",
                  "Pipa",
                  "DOSA",
                  "CRS",
                  "AR",
                  "UR",
                  "GSE",
                  "MT",
                  "TA",
                  "Quadriciclo",
                  "Embarcação",
                  "Picape FN",
                  "Picape MUNI",
                  "Autoarp",
                  "Picape ESFRON",
                  "Helicóptero",
                  "Avião",
                  "Jet Ski",
                  "Total",
                ]}
                rows={recursos}
                keys={[
                  "abt",
                  "at",
                  "aem",
                  "atp",
                  "ata",
                  "abf",
                  "atf",
                  "abs",
                  "pipa",
                  "dosa",
                  "crs",
                  "ar",
                  "ur",
                  "gse",
                  "mt",
                  "ta",
                  "quadriciclo",
                  "embarcacao",
                  "picape_fn",
                  "picape_muni",
                  "autoarp",
                  "picape_esfron",
                  "helicoptero",
                  "aviao",
                  "jetski",
                ]}
              />
            </TabsContent>
          </Tabs>
        </section>
      </main>
    </div>
  );
}

function AnnualReportsCard({
  activeTab,
}: {
  activeTab: "incendios" | "outras" | "efetivo" | "recursos";
}) {
  const year = new Date().getFullYear();
  const [scope, setScope] = useState<"current" | "todos">("current");
  const [busy, setBusy] = useState<"completo" | "consolidado" | null>(null);
  const fetchAnnual = useServerFn(getAnnualIncendios);

  const TAB_LABELS: Record<string, string> = {
    incendios: "Incêndios",
    outras: "Ocorrências",
    efetivo: "Efetivo",
    recursos: "Recursos",
  };

  const generate = async (kind: "completo" | "consolidado") => {
    setBusy(kind);
    try {
      const data = await fetchAnnual({ data: { years: [year] } });
      const mod = await import("@/lib/export-annual-pdf");
      const targetCategory = scope === "current" ? activeTab : "todos";
      if (kind === "completo") mod.exportAnnualIncendiosPdf(data, targetCategory);
      else mod.exportConsolidatedIncendiosPdf(data, targetCategory);
      toast.success("PDF gerado. Verifique seus downloads.");
    } catch (e) {
      toast.error("Falha ao gerar o relatório", { description: (e as Error)?.message });
    } finally {
      setBusy(null);
    }
  };

  return (
    <section className="rounded-xl bg-card shadow-elevated p-4 sm:p-5">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-4">
        <div>
          <h2 className="font-semibold text-base">Comparativo e Resumos Consolidados · {year}</h2>
          <p className="text-xs sm:text-sm text-muted-foreground mt-0.5">
            Gera os documentos oficiais de comparativo e totais acumulados de {year} conforme o tipo selecionado na aba abaixo ou o relatório geral completo.
          </p>
        </div>

        <div className="flex items-center gap-1 bg-muted/60 p-1 rounded-lg border border-border shrink-0 text-xs">
          <button
            type="button"
            onClick={() => setScope("current")}
            className={`px-2.5 py-1 rounded-md transition-colors ${
              scope === "current"
                ? "bg-card shadow-sm font-semibold text-foreground"
                : "text-muted-foreground hover:text-foreground"
            }`}
          >
            Tipo Atual ({TAB_LABELS[activeTab]})
          </button>
          <button
            type="button"
            onClick={() => setScope("todos")}
            className={`px-2.5 py-1 rounded-md transition-colors ${
              scope === "todos"
                ? "bg-card shadow-sm font-semibold text-foreground"
                : "text-muted-foreground hover:text-foreground"
            }`}
          >
            Todas as Seções (Geral)
          </button>
        </div>
      </div>

      <div className="grid grid-cols-1 gap-2 sm:flex sm:justify-end">
        <Button
          variant="outline"
          size="sm"
          disabled={busy !== null}
          onClick={() => generate("completo")}
        >
          {busy === "completo" ? (
            <Loader2 className="w-4 h-4 mr-1.5 animate-spin" />
          ) : (
            <FileText className="w-4 h-4 mr-1.5" />
          )}
          Resumo detalhado por município ({scope === "current" ? TAB_LABELS[activeTab] : "Geral"})
        </Button>
        <Button size="sm" disabled={busy !== null} onClick={() => generate("consolidado")}>
          {busy === "consolidado" ? (
            <Loader2 className="w-4 h-4 mr-1.5 animate-spin" />
          ) : (
            <Layers className="w-4 h-4 mr-1.5" />
          )}
          Resumo consolidado ({scope === "current" ? TAB_LABELS[activeTab] : "Geral"})
        </Button>
      </div>
    </section>
  );
}

function Kpi({ label, value }: { label: string; value: number }) {
  return (
    <div className="rounded-xl bg-card shadow-elevated p-4">
      <div className="text-[11px] sm:text-xs uppercase tracking-widest text-muted-foreground">
        {label}
      </div>
      <div className="text-xl sm:text-2xl font-bold mt-1 tabular-nums">
        {value.toLocaleString("pt-BR")}
      </div>
    </div>
  );
}

function AggTable({
  title,
  headers,
  rows,
  keys,
  sumKeys,
}: {
  title: string;
  headers: string[];
  rows: Array<Record<string, any>>;
  keys: string[];
  sumKeys?: string[];
}) {
  const activeSumKeys = sumKeys ?? keys;
  const totals = keys.reduce<Record<string, number>>((acc, k) => {
    acc[k] = rows.reduce((s, r) => s + (Number(r[k]) || 0), 0);
    return acc;
  }, {});
  const grand = activeSumKeys.reduce((a, k) => a + (totals[k] || 0), 0);

  return (
    <div className="rounded-xl bg-card shadow-elevated p-4 sm:p-5">
      <h2 className="font-semibold text-base mb-3">{title}</h2>
      <div className="-mx-4 sm:-mx-5 overflow-x-auto px-4 sm:px-5">
        <Table className="min-w-[34rem]">
          <TableHeader>
            <TableRow>
              {headers.map((h, i) => {
                const isFirst = i === 0;
                const widthCls = isFirst ? "min-w-[160px]" : "min-w-[92px]";
                return (
                  <TableHead
                    key={i}
                    className={`whitespace-nowrap text-[11px] uppercase font-bold text-foreground p-1 ${widthCls}`}
                  >
                    <div
                      className={`h-9 w-full flex items-center px-3 ${
                        isFirst ? "justify-start" : "justify-center text-center"
                      }`}
                    >
                      {h}
                    </div>
                  </TableHead>
                );
              })}
            </TableRow>
          </TableHeader>
          <TableBody>
            {rows.length === 0 ? (
              <TableRow>
                <TableCell
                  colSpan={headers.length}
                  className="text-center text-muted-foreground py-6"
                >
                  Nenhum registro no período selecionado.
                </TableCell>
              </TableRow>
            ) : (
              rows.map((r) => {
                const total = activeSumKeys.reduce((s, k) => s + (Number(r[k]) || 0), 0);
                return (
                  <TableRow key={r.mun} className="hover:bg-primary/5 transition-colors group">
                    <TableCell className="p-1 align-middle min-w-[160px]">
                      <div className="h-9 w-full flex items-center px-3 font-bold text-foreground justify-start">
                        {r.mun}
                      </div>
                    </TableCell>
                    {keys.map((k) => (
                      <TableCell key={k} className="p-1 align-middle min-w-[92px]">
                        <div className="h-9 w-full flex items-center justify-center px-3 text-center tabular-nums font-normal text-slate-600 dark:text-slate-400">
                          {(Number(r[k]) || 0).toLocaleString("pt-BR")}
                        </div>
                      </TableCell>
                    ))}
                    <TableCell className="p-1 align-middle min-w-[92px]">
                      <div className="h-9 w-full flex items-center justify-center px-3 text-center tabular-nums font-black text-foreground bg-muted/20 rounded-md">
                        {total.toLocaleString("pt-BR")}
                      </div>
                    </TableCell>
                  </TableRow>
                );
              })
            )}
            {rows.length > 0 && (
              <TableRow className="bg-muted/70 font-bold border-t-2 border-border/80">
                <TableCell className="p-1 align-middle min-w-[160px]">
                  <div className="h-9 w-full flex items-center px-3 font-bold text-foreground justify-start">
                    TOTAL GERAL
                  </div>
                </TableCell>
                {keys.map((k) => (
                  <TableCell key={k} className="p-1 align-middle min-w-[92px]">
                    <div className="h-9 w-full flex items-center justify-center px-3 text-center tabular-nums font-bold text-foreground">
                      {totals[k].toLocaleString("pt-BR")}
                    </div>
                  </TableCell>
                ))}
                <TableCell className="p-1 align-middle min-w-[92px]">
                  <div className="h-9 w-full flex items-center justify-center px-3 text-center tabular-nums font-black text-primary">
                    {grand.toLocaleString("pt-BR")}
                  </div>
                </TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
      </div>
    </div>
  );
}

