import { compareMunicipios, canonicalMunicipio } from "@/lib/municipio-order";
import { createFileRoute, Link } from "@tanstack/react-router";
import * as React from "react";
import { useMemo, useState, useEffect, Fragment } from "react";
import { keepPreviousData, useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { cn } from "@/lib/utils";
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
  Trees,
  Building2,
  Target,
  MapPin,
  AlertTriangle,
  LifeBuoy,
  HeartPulse,
  Shield,
  Wrench,
} from "lucide-react";
import { NF } from "@/lib/formatters";



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
import { exportComparisonPdf } from "@/lib/export-comparison-pdf";
import { MonthMultiSelectDropdown } from "@/components/dashboard/TerritorialFireSummary";
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

const MONTHS = [
  { value: 1, label: "Janeiro" },
  { value: 2, label: "Fevereiro" },
  { value: 3, label: "Março" },
  { value: 4, label: "Abril" },
  { value: 5, label: "Maio" },
  { value: 6, label: "Junho" },
  { value: 7, label: "Julho" },
  { value: 8, label: "Agosto" },
  { value: 9, label: "Setembro" },
  { value: 10, label: "Outubro" },
  { value: 11, label: "Novembro" },
  { value: 12, label: "Dezembro" },
];

const MONTH_NAMES = [
  "", "Janeiro", "Fevereiro", "Março", "Abril", "Maio", "Junho",
  "Julho", "Agosto", "Setembro", "Outubro", "Novembro", "Dezembro"
];

const AVAILABLE_YEARS = [2026, 2025, 2024, 2023];

function getMonthDateRange(year: number, startMonth: number, endMonth: number) {
  const pad = (n: number) => String(n).padStart(2, "0");
  const sMonth = Math.min(startMonth, endMonth);
  const eMonth = Math.max(startMonth, endMonth);
  const from = `${year}-${pad(sMonth)}-01`;
  const lastDay = new Date(year, eMonth, 0).getDate();
  const to = `${year}-${pad(eMonth)}-${pad(lastDay)}`;
  return { from, to };
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
  const [isAnnualComparison, setIsAnnualComparison] = useState(false);

  const [compYear1, setCompYear1] = useState<number>(2025);
  const [compYear2, setCompYear2] = useState<number>(2026);
  const [compMonths, setCompMonths] = useState<number[]>([6, 7, 8]);
  const [compViewMode, setCompViewMode] = useState<"lado-a-lado" | "unificada">("lado-a-lado");

  const compStartMonth = useMemo(() => (compMonths.length > 0 ? Math.min(...compMonths) : 1), [compMonths]);
  const compEndMonth = useMemo(() => (compMonths.length > 0 ? Math.max(...compMonths) : 12), [compMonths]);

  const listFn = useServerFn(listDailyReports);
  
  const { from: compFrom1, to: compTo1 } = useMemo(
    () => getMonthDateRange(compYear1, compStartMonth, compEndMonth),
    [compYear1, compStartMonth, compEndMonth]
  );

  const { from: compFrom2, to: compTo2 } = useMemo(
    () => getMonthDateRange(compYear2, compStartMonth, compEndMonth),
    [compYear2, compStartMonth, compEndMonth]
  );

  const q = useQuery({
    queryKey: ["daily-reports", scope, from, to, shift],
    queryFn: () => listFn({ data: { ...(scope === "periodo" ? { from, to } : {}), ...(shift === "ambos" ? {} : { shift }) } }),
    placeholderData: keepPreviousData,
    staleTime: 60_000,
  });

  const qComp1 = useQuery({
    queryKey: ["daily-reports-comp1", compFrom1, compTo1, shift],
    queryFn: () => listFn({ data: { from: compFrom1, to: compTo1, ...(shift === "ambos" ? {} : { shift }) } }),
    enabled: isAnnualComparison,
    placeholderData: keepPreviousData,
    staleTime: 60_000,
  });

  const qComp2 = useQuery({
    queryKey: ["daily-reports-comp2", compFrom2, compTo2, shift],
    queryFn: () => listFn({ data: { from: compFrom2, to: compTo2, ...(shift === "ambos" ? {} : { shift }) } }),
    enabled: isAnnualComparison,
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
      if (!cur || (r.shift === "noturno" && cur.shift !== "noturno")) {
        byDate.set(d, r);
      }
    }
    return Array.from(byDate.values());
  }, [q.data, shift]);

  const rowsComp1 = useMemo(() => {
    const raw = (qComp1.data ?? []) as AnyRow[];
    const byDate = new Map<string, AnyRow>();
    for (const r of raw) {
      const d = String(r.report_date || "");
      if (!d) continue;
      const m = Number(d.slice(5, 7));
      if (compMonths.length > 0 && !compMonths.includes(m)) continue;
      if (shift !== "ambos" && r.shift !== shift) {
        byDate.set(d, r);
        continue;
      }
      const cur = byDate.get(d);
      if (!cur || (r.shift === "noturno" && cur.shift !== "noturno")) {
        byDate.set(d, r);
      }
    }
    return Array.from(byDate.values());
  }, [qComp1.data, shift, compMonths]);

  const rowsComp2 = useMemo(() => {
    const raw = (qComp2.data ?? []) as AnyRow[];
    const byDate = new Map<string, AnyRow>();
    for (const r of raw) {
      const d = String(r.report_date || "");
      if (!d) continue;
      const m = Number(d.slice(5, 7));
      if (compMonths.length > 0 && !compMonths.includes(m)) continue;
      if (shift !== "ambos" && r.shift !== shift) {
        byDate.set(d, r);
        continue;
      }
      const cur = byDate.get(d);
      if (!cur || (r.shift === "noturno" && cur.shift !== "noturno")) {
        byDate.set(d, r);
      }
    }
    return Array.from(byDate.values());
  }, [qComp2.data, shift, compMonths]);


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

  const incendiosFull = useMemo(
    () =>
      aggregateSum(rows, "incendios", [
        "urb",
        "flor",
        "focos",
        "focos_combatidos",
        "focos_atendidos",
        "sat",
      ]),
    [rows],
  );
  
  const outrasFull = useMemo(
    () => aggregateSum(rows, "outras", ["salvamento", "acidentes", "aph", "prevencao", "servicos"]),
    [rows],
  );

  const incendiosComp1 = useMemo(() => aggregateSum(rowsComp1, "incendios", ["urb", "flor", "focos", "focos_combatidos", "focos_atendidos", "sat"]), [rowsComp1]);
  const outrasComp1 = useMemo(() => aggregateSum(rowsComp1, "outras", ["salvamento", "acidentes", "aph", "prevencao", "servicos"]), [rowsComp1]);
  const efetivoComp1 = useMemo(() => aggregateSnapshot(rowsComp1, "efetivo", ["ord", "seg", "brig"]), [rowsComp1]);
  const recursosComp1 = useMemo(() => aggregateSnapshot(rowsComp1, "recursos", ["abt", "at", "aem", "atp", "ata", "abf", "atf", "abs", "pipa", "dosa", "crs", "ar", "ur", "gse", "mt", "ta", "quadriciclo", "embarcacao", "picape_fn", "picape_muni", "autoarp", "picape_esfron", "helicoptero", "aviao", "jetski"]), [rowsComp1]);

  const incendiosComp2 = useMemo(() => aggregateSum(rowsComp2, "incendios", ["urb", "flor", "focos", "focos_combatidos", "focos_atendidos", "sat"]), [rowsComp2]);
  const outrasComp2 = useMemo(() => aggregateSum(rowsComp2, "outras", ["salvamento", "acidentes", "aph", "prevencao", "servicos"]), [rowsComp2]);
  const efetivoComp2 = useMemo(() => aggregateSnapshot(rowsComp2, "efetivo", ["ord", "seg", "brig"]), [rowsComp2]);
  const recursosComp2 = useMemo(() => aggregateSnapshot(rowsComp2, "recursos", ["abt", "at", "aem", "atp", "ata", "abf", "atf", "abs", "pipa", "dosa", "crs", "ar", "ur", "gse", "mt", "ta", "quadriciclo", "embarcacao", "picape_fn", "picape_muni", "autoarp", "picape_esfron", "helicoptero", "aviao", "jetski"]), [rowsComp2]);

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

  const incendiosFiltered1 = useMemo(() => filterBySearch(incendiosComp1), [incendiosComp1, searchMun]);
  const incendiosFiltered2 = useMemo(() => filterBySearch(incendiosComp2), [incendiosComp2, searchMun]);
  const outrasFiltered1 = useMemo(() => filterBySearch(outrasComp1), [outrasComp1, searchMun]);
  const outrasFiltered2 = useMemo(() => filterBySearch(outrasComp2), [outrasComp2, searchMun]);
  const efetivoFiltered1 = useMemo(() => filterBySearch(efetivoComp1), [efetivoComp1, searchMun]);
  const efetivoFiltered2 = useMemo(() => filterBySearch(efetivoComp2), [efetivoComp2, searchMun]);
  const recursosFiltered1 = useMemo(() => filterBySearch(recursosComp1), [recursosComp1, searchMun]);
  const recursosFiltered2 = useMemo(() => filterBySearch(recursosComp2), [recursosComp2, searchMun]);

  const totals = useMemo(() => {
    const sum = (list: AnyRow[], keys: string[]) =>
      keys.reduce((acc, k) => acc + list.reduce((s, r) => s + (Number(r[k]) || 0), 0), 0);
    return {
      dias: rows.length,
      incendios: sum(incendiosFull, ["urb", "flor"]),
      focos: sum(incendiosFull, ["focos", "focos_combatidos", "focos_atendidos", "sat"]),
      outras: sum(outrasFull, ["salvamento", "acidentes", "aph", "prevencao", "servicos"]),
      efetivo: sum(efetivoFull, ["ord", "seg", "brig"]),
    };
  }, [rows, incendiosFull, outrasFull, efetivoFull]);

  const compTotals1 = useMemo(() => {
    const sum = (list: AnyRow[], keys: string[]) =>
      keys.reduce((acc, k) => acc + list.reduce((s, r) => s + (Number(r[k]) || 0), 0), 0);
    return {
      dias: rowsComp1.length,
      incendios: sum(incendiosComp1, ["urb", "flor"]),
      flor: sum(incendiosComp1, ["flor"]),
      urb: sum(incendiosComp1, ["urb"]),
      focos: sum(incendiosComp1, ["focos", "focos_combatidos", "focos_atendidos", "sat"]),
      outras: sum(outrasComp1, ["salvamento", "acidentes", "aph", "prevencao", "servicos"]),
      efetivo: sum(efetivoComp1, ["ord", "seg", "brig"]),
    };
  }, [rowsComp1, incendiosComp1, outrasComp1, efetivoComp1]);

  const compTotals2 = useMemo(() => {
    const sum = (list: AnyRow[], keys: string[]) =>
      keys.reduce((acc, k) => acc + list.reduce((s, r) => s + (Number(r[k]) || 0), 0), 0);
    return {
      dias: rowsComp2.length,
      incendios: sum(incendiosComp2, ["urb", "flor"]),
      flor: sum(incendiosComp2, ["flor"]),
      urb: sum(incendiosComp2, ["urb"]),
      focos: sum(incendiosComp2, ["focos", "focos_combatidos", "focos_atendidos", "sat"]),
      outras: sum(outrasComp2, ["salvamento", "acidentes", "aph", "prevencao", "servicos"]),
      efetivo: sum(efetivoComp2, ["ord", "seg", "brig"]),
    };
  }, [rowsComp2, incendiosComp2, outrasComp2, efetivoComp2]);


  // Atalhos Rápidos de Período
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

  const applyCompPreset = (type: "safra" | "jun-ago" | "semestre1" | "ano") => {
    if (type === "safra") {
      setCompMonths([6, 7, 8, 9, 10, 11]);
    } else if (type === "jun-ago") {
      setCompMonths([6, 7, 8]);
    } else if (type === "semestre1") {
      setCompMonths([1, 2, 3, 4, 5, 6]);
    } else if (type === "ano") {
      setCompMonths([1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12]);
    }
  };

  // 1. Incêndios Analytics
  const incendiosStats = useMemo(() => {
    let florTotal = 0;
    let urbTotal = 0;
    let focosTotal = 0;
    let topMun = { mun: "—", total: 0 };
    const munSet = new Set<string>();

    for (const item of incendiosFull) {
      const r = item as Record<string, any>;
      const flor = Number(r.flor) || 0;
      const urb = Number(r.urb) || 0;
      const focos = Number(r.focos) || Number(r.focos_combatidos) || Number(r.sat) || 0;
      florTotal += flor;
      urbTotal += urb;
      focosTotal += focos;
      const total = flor + urb;
      if (total > 0) {
        munSet.add(r.mun);
        if (total > topMun.total) {
          topMun = { mun: r.mun, total };
        }
      }
    }

    const totalInc = florTotal + urbTotal;
    const florPct = totalInc > 0 ? ((florTotal / totalInc) * 100).toFixed(1) : "0.0";
    const urbPct = totalInc > 0 ? ((urbTotal / totalInc) * 100).toFixed(1) : "0.0";

    return {
      total: totalInc,
      florestal: florTotal,
      florestalPct: florPct,
      urbano: urbTotal,
      urbanoPct: urbPct,
      focos: focosTotal,
      munsAfetados: munSet.size,
      topMun,
    };
  }, [incendiosFull]);

  // 2. Outras Ocorrências Analytics
  const outrasStats = useMemo(() => {
    let salvTotal = 0;
    let acidTotal = 0;
    let aphTotal = 0;
    let prevTotal = 0;
    let servTotal = 0;
    let topMun = { mun: "—", total: 0 };
    const munSet = new Set<string>();

    for (const item of outrasFull) {
      const r = item as Record<string, any>;
      const salv = Number(r.salvamento) || 0;
      const acid = Number(r.acidentes) || 0;
      const aph = Number(r.aph) || 0;
      const prev = Number(r.prevencao) || 0;
      const serv = Number(r.servicos) || 0;
      salvTotal += salv;
      acidTotal += acid;
      aphTotal += aph;
      prevTotal += prev;
      servTotal += serv;
      const total = salv + acid + aph + prev + serv;
      if (total > 0) {
        munSet.add(r.mun);
        if (total > topMun.total) {
          topMun = { mun: r.mun, total };
        }
      }
    }

    const totalOutras = salvTotal + acidTotal + aphTotal + prevTotal + servTotal;
    const salvPct = totalOutras > 0 ? ((salvTotal / totalOutras) * 100).toFixed(1) : "0.0";
    const acidPct = totalOutras > 0 ? ((acidTotal / totalOutras) * 100).toFixed(1) : "0.0";
    const aphPct = totalOutras > 0 ? ((aphTotal / totalOutras) * 100).toFixed(1) : "0.0";
    const prevPct = totalOutras > 0 ? ((prevTotal / totalOutras) * 100).toFixed(1) : "0.0";
    const servPct = totalOutras > 0 ? ((servTotal / totalOutras) * 100).toFixed(1) : "0.0";

    return {
      total: totalOutras,
      salvamento: salvTotal,
      salvamentoPct: salvPct,
      acidentes: acidTotal,
      acidentesPct: acidPct,
      aph: aphTotal,
      aphPct: aphPct,
      prevencao: prevTotal,
      prevencaoPct: prevPct,
      servicos: servTotal,
      servicosPct: servPct,
      munsAfetados: munSet.size,
      topMun,
    };
  }, [outrasFull]);

  // Gerador de Resumo para WhatsApp / Boletim Informativo
  const copyWhatsAppSummary = () => {
    const periodoStr = !isAnnualComparison
      ? scope === "periodo"
        ? `${from} a ${to}`
        : "Geral (Histórico Completo)"
      : `Comparativo ${compYear1} vs ${compYear2} (${MONTH_NAMES[compStartMonth]} a ${MONTH_NAMES[compEndMonth]})`;
      
    const sourceList = !isAnnualComparison ? incendiosFull : incendiosComp2;
    const topIncendios = ([...sourceList] as Array<Record<string, any>>)
      .sort((a, b) => (Number(b.urb || 0) + Number(b.flor || 0)) - (Number(a.urb || 0) + Number(a.flor || 0)))
      .slice(0, 5)
      .map((r) => `  • *${r.mun}*: ${Number(r.urb || 0) + Number(r.flor || 0)} inc. (${Number(r.focos || 0)} focos)`)
      .join("\n");

    const text = `🔥 *CBMAM · SARA / SALA DE SITUAÇÃO*
📊 *BOLETIM OPERACIONAL CONSOLIDADO*
📅 *Período:* ${periodoStr}

───────────────
📈 *INDICADORES CHAVE:*
 • *Relatórios computados:* ${!isAnnualComparison ? totals.dias : `${compTotals1.dias} (${compYear1}) / ${compTotals2.dias} (${compYear2})`}
 • *Combate a Incêndios:* ${!isAnnualComparison ? totals.incendios : `${compTotals1.incendios} vs ${compTotals2.incendios}`} ocorrências
 • *Focos de Queimadas:* ${!isAnnualComparison ? totals.focos : `${compTotals1.focos} vs ${compTotals2.focos}`} focos
 • *Atendimentos Diversos:* ${!isAnnualComparison ? totals.outras : `${compTotals1.outras} vs ${compTotals2.outras}`} chamados
 • *Efetivo Mobilizado:* ${!isAnnualComparison ? totals.efetivo : `${compTotals1.efetivo} vs ${compTotals2.efetivo}`} militares/brigadistas

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
    const label = !isAnnualComparison
      ? scope === "periodo" ? `${from}-ate-${to}` : "geral"
      : `comparativo-${compYear1}-vs-${compYear2}-${MONTH_NAMES[compStartMonth]}-${MONTH_NAMES[compEndMonth]}`;
    exportTotaisToXlsx(
      !isAnnualComparison ? incendiosFull : incendiosComp2,
      !isAnnualComparison ? outrasFull : outrasComp2,
      !isAnnualComparison ? efetivoFull : efetivoComp2,
      !isAnnualComparison ? recursosFull : recursosComp2,
      label
    );
    toast.success("Planilha Excel (.xlsx) baixada com sucesso!");
  };

  const handleExportExactComparisonPdf = () => {
    try {
      exportComparisonPdf({
        year1: compYear1,
        year2: compYear2,
        startMonth: compStartMonth,
        endMonth: compEndMonth,
        activeTab,
        totals1: compTotals1,
        totals2: compTotals2,
        rows1:
          activeTab === "incendios"
            ? incendiosFiltered1
            : activeTab === "outras"
            ? outrasFiltered1
            : activeTab === "efetivo"
            ? efetivoFiltered1
            : recursosFiltered1,
        rows2:
          activeTab === "incendios"
            ? incendiosFiltered2
            : activeTab === "outras"
            ? outrasFiltered2
            : activeTab === "efetivo"
            ? efetivoFiltered2
            : recursosFiltered2,
      });
      toast.success("Relatório Comparativo em PDF gerado com sucesso!", {
        description: `Exportado: ${compYear1} vs ${compYear2} (${MONTH_NAMES[compStartMonth]} a ${MONTH_NAMES[compEndMonth]})`,
      });
    } catch (e) {
      toast.error("Falha ao gerar o relatório comparativo", {
        description: (e as Error)?.message,
      });
    }
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
        {/* Alternador de Modo: Visão por Período vs Comparativo Anual */}
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
              Comparativo
            </Button>
          </div>
        </div>

        {/* ------------------------------------------------------------- */}
        {/* MODO 1: VISÃO POR PERÍODO REGULAR (PADRÃO)                     */}
        {/* ------------------------------------------------------------- */}
        {!isAnnualComparison ? (
          <>
            {/* KPIs gerais */}
            <section className="grid grid-cols-1 xs:grid-cols-2 md:grid-cols-5 gap-3">
              <Kpi label="Relatórios no filtro" value={totals.dias} />
              <Kpi label="Incêndios (total)" value={totals.incendios} />
              <Kpi label="Focos de Queimada" value={totals.focos} />
              <Kpi label="Ocorrências" value={totals.outras} />
              <Kpi label="Efetivo empenhado" value={totals.efetivo} />
            </section>

            {/* Quadro 1: Painel Executivo de Incêndios (Florestal e Urbano) */}
            <section className="rounded-2xl bg-card border border-border p-4 sm:p-5 shadow-elevated space-y-4">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 pb-2 border-b border-border/60">
                <div className="flex items-center gap-2.5">
                  <div className="w-8 h-8 rounded-lg bg-red-500/10 text-red-600 flex items-center justify-center font-bold">
                    <Flame className="w-4 h-4" />
                  </div>
                  <div>
                    <h2 className="font-bold text-base text-foreground tracking-tight flex items-center gap-2">
                      Painel de Incêndios (Florestal vs Urbano)
                      <span className="text-[11px] font-semibold px-2 py-0.5 rounded-full bg-red-500/10 text-red-600 dark:text-red-400">
                        Incêndios
                      </span>
                    </h2>
                    <p className="text-xs text-muted-foreground">
                      Totais acumulados de Incêndios Florestais, Urbanos e Focos de Queimada no período selecionado
                    </p>
                  </div>
                </div>
                <div className="text-xs text-muted-foreground font-medium bg-muted/60 px-3 py-1 rounded-md self-start sm:self-auto">
                  📅 {scope === "periodo" ? `${from} a ${to}` : "Geral (Histórico Completo)"}
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3.5">
                {/* Total Incêndios */}
                <div className="p-4 rounded-xl border border-border bg-card/60 relative overflow-hidden group hover:border-red-500/30 transition-all">
                  <div className="flex items-start justify-between">
                    <div>
                      <span className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">
                        Total de Incêndios
                      </span>
                      <div className="mt-1 text-2xl sm:text-3xl font-extrabold text-foreground tabular-nums">
                        {NF.format(incendiosStats.total)}
                      </div>
                    </div>
                    <div className="w-9 h-9 rounded-lg bg-red-500/10 text-red-600 flex items-center justify-center">
                      <Flame className="w-4 h-4" />
                    </div>
                  </div>
                  <div className="mt-2 text-xs text-muted-foreground flex items-center justify-between">
                    <span>Ocorrências registradas</span>
                    <span className="font-semibold text-foreground">100%</span>
                  </div>
                </div>

                {/* Incêndios Florestais */}
                <div className="p-4 rounded-xl border border-emerald-500/30 bg-emerald-500/[0.04] relative overflow-hidden group hover:border-emerald-500/50 transition-all">
                  <div className="flex items-start justify-between">
                    <div>
                      <span className="text-[10px] font-bold uppercase tracking-wider text-emerald-700 dark:text-emerald-400">
                        Incêndios Florestais
                      </span>
                      <div className="mt-1 text-2xl sm:text-3xl font-extrabold text-emerald-600 dark:text-emerald-400 tabular-nums">
                        {NF.format(incendiosStats.florestal)}
                      </div>
                    </div>
                    <div className="w-9 h-9 rounded-lg bg-emerald-500/15 text-emerald-600 dark:text-emerald-400 flex items-center justify-center">
                      <Trees className="w-4 h-4" />
                    </div>
                  </div>
                  <div className="mt-2 text-xs flex items-center justify-between">
                    <span className="text-muted-foreground">Vegetação e Matas</span>
                    <span className="font-bold text-emerald-700 dark:text-emerald-400 bg-emerald-500/20 px-1.5 py-0.5 rounded text-[11px]">
                      {incendiosStats.florestalPct}% do total
                    </span>
                  </div>
                </div>

                {/* Incêndios Urbanos */}
                <div className="p-4 rounded-xl border border-amber-500/30 bg-amber-500/[0.04] relative overflow-hidden group hover:border-amber-500/50 transition-all">
                  <div className="flex items-start justify-between">
                    <div>
                      <span className="text-[10px] font-bold uppercase tracking-wider text-amber-700 dark:text-amber-400">
                        Incêndios Urbanos
                      </span>
                      <div className="mt-1 text-2xl sm:text-3xl font-extrabold text-amber-600 dark:text-amber-400 tabular-nums">
                        {NF.format(incendiosStats.urbano)}
                      </div>
                    </div>
                    <div className="w-9 h-9 rounded-lg bg-amber-500/15 text-amber-600 dark:text-amber-400 flex items-center justify-center">
                      <Building2 className="w-4 h-4" />
                    </div>
                  </div>
                  <div className="mt-2 text-xs flex items-center justify-between">
                    <span className="text-muted-foreground">Edificações e Lotes</span>
                    <span className="font-bold text-amber-700 dark:text-amber-400 bg-amber-500/20 px-1.5 py-0.5 rounded text-[11px]">
                      {incendiosStats.urbanoPct}% do total
                    </span>
                  </div>
                </div>

                {/* Focos Combatidos */}
                <div className="p-4 rounded-xl border border-border bg-card/60 relative overflow-hidden group hover:border-primary/40 transition-all">
                  <div className="flex items-start justify-between">
                    <div>
                      <span className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">
                        Focos Combatidos
                      </span>
                      <div className="mt-1 text-2xl sm:text-3xl font-extrabold text-foreground tabular-nums">
                        {NF.format(incendiosStats.focos)}
                      </div>
                    </div>
                    <div className="w-9 h-9 rounded-lg bg-primary/10 text-primary flex items-center justify-center">
                      <Target className="w-4 h-4" />
                    </div>
                  </div>
                  <p className="mt-2 text-xs text-muted-foreground truncate">
                    Ações operacionais de combate in loco
                  </p>
                </div>

                {/* Municípios Atingidos */}
                <div className="p-4 rounded-xl border border-border bg-card/60 relative overflow-hidden group hover:border-primary/40 transition-all">
                  <div className="flex items-start justify-between">
                    <div>
                      <span className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">
                        Municípios com Incêndio
                      </span>
                      <div className="mt-1 text-2xl sm:text-3xl font-extrabold text-foreground tabular-nums">
                        {incendiosStats.munsAfetados}
                      </div>
                    </div>
                    <div className="w-9 h-9 rounded-lg bg-blue-500/10 text-blue-600 flex items-center justify-center">
                      <MapPin className="w-4 h-4" />
                    </div>
                  </div>
                  <p className="mt-2 text-xs text-muted-foreground truncate">
                    {rows.length} relatório(s) computado(s)
                  </p>
                </div>

                {/* Município mais crítico */}
                <div className="p-4 rounded-xl border border-border bg-card/60 relative overflow-hidden group hover:border-red-500/40 transition-all">
                  <div className="flex items-start justify-between">
                    <div className="min-w-0 pr-2">
                      <span className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">
                        Município Mais Crítico
                      </span>
                      <div className="mt-1 text-xl sm:text-2xl font-bold text-foreground truncate">
                        {incendiosStats.topMun.mun}
                      </div>
                    </div>
                    <div className="w-9 h-9 rounded-lg bg-red-500/10 text-red-600 flex items-center justify-center shrink-0">
                      <AlertTriangle className="w-4 h-4" />
                    </div>
                  </div>
                  <p className="mt-2 text-xs text-muted-foreground truncate">
                    <span className="font-semibold text-foreground">{NF.format(incendiosStats.topMun.total)}</span> incêndios registrados
                  </p>
                </div>
              </div>
            </section>

            {/* Quadro 2: Painel Executivo de Ocorrências e Resgates */}
            <section className="rounded-2xl bg-card border border-border p-4 sm:p-5 shadow-elevated space-y-4">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 pb-2 border-b border-border/60">
                <div className="flex items-center gap-2.5">
                  <div className="w-8 h-8 rounded-lg bg-blue-500/10 text-blue-600 flex items-center justify-center font-bold">
                    <ShieldAlert className="w-4 h-4" />
                  </div>
                  <div>
                    <h2 className="font-bold text-base text-foreground tracking-tight flex items-center gap-2">
                      Painel de Ocorrências & Resgates (Por Categoria)
                      <span className="text-[11px] font-semibold px-2 py-0.5 rounded-full bg-blue-500/10 text-blue-600 dark:text-blue-400">
                        Atendimentos
                      </span>
                    </h2>
                    <p className="text-xs text-muted-foreground">
                      Distribuição detalhada de Salvamentos, Acidentes, APH, Ações Preventivas e Serviços
                    </p>
                  </div>
                </div>
                <div className="text-xs font-semibold text-blue-600 dark:text-blue-400 bg-blue-500/10 px-3 py-1 rounded-md self-start sm:self-auto">
                  Total: {NF.format(outrasStats.total)} chamados
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-3.5">
                {/* Salvamento */}
                <div className="p-3.5 rounded-xl border border-cyan-500/30 bg-cyan-500/[0.04] relative overflow-hidden group hover:border-cyan-500/50 transition-all">
                  <div className="flex items-start justify-between">
                    <div>
                      <span className="text-[10px] font-bold uppercase tracking-wider text-cyan-700 dark:text-cyan-400">
                        Salvamento
                      </span>
                      <div className="mt-1 text-2xl font-extrabold text-cyan-600 dark:text-cyan-400 tabular-nums">
                        {NF.format(outrasStats.salvamento)}
                      </div>
                    </div>
                    <div className="w-8 h-8 rounded-lg bg-cyan-500/15 text-cyan-600 dark:text-cyan-400 flex items-center justify-center">
                      <LifeBuoy className="w-4 h-4" />
                    </div>
                  </div>
                  <div className="mt-2 text-xs flex items-center justify-between text-muted-foreground">
                    <span>Resgates</span>
                    <span className="font-semibold text-cyan-700 dark:text-cyan-400">{outrasStats.salvamentoPct}%</span>
                  </div>
                </div>

                {/* Acidentes */}
                <div className="p-3.5 rounded-xl border border-rose-500/30 bg-rose-500/[0.04] relative overflow-hidden group hover:border-rose-500/50 transition-all">
                  <div className="flex items-start justify-between">
                    <div>
                      <span className="text-[10px] font-bold uppercase tracking-wider text-rose-700 dark:text-rose-400">
                        Acidentes
                      </span>
                      <div className="mt-1 text-2xl font-extrabold text-rose-600 dark:text-rose-400 tabular-nums">
                        {NF.format(outrasStats.acidentes)}
                      </div>
                    </div>
                    <div className="w-8 h-8 rounded-lg bg-rose-500/15 text-rose-600 dark:text-rose-400 flex items-center justify-center">
                      <AlertTriangle className="w-4 h-4" />
                    </div>
                  </div>
                  <div className="mt-2 text-xs flex items-center justify-between text-muted-foreground">
                    <span>Trânsito / Outros</span>
                    <span className="font-semibold text-rose-700 dark:text-rose-400">{outrasStats.acidentesPct}%</span>
                  </div>
                </div>

                {/* APH */}
                <div className="p-3.5 rounded-xl border border-purple-500/30 bg-purple-500/[0.04] relative overflow-hidden group hover:border-purple-500/50 transition-all">
                  <div className="flex items-start justify-between">
                    <div>
                      <span className="text-[10px] font-bold uppercase tracking-wider text-purple-700 dark:text-purple-400">
                        APH
                      </span>
                      <div className="mt-1 text-2xl font-extrabold text-purple-600 dark:text-purple-400 tabular-nums">
                        {NF.format(outrasStats.aph)}
                      </div>
                    </div>
                    <div className="w-8 h-8 rounded-lg bg-purple-500/15 text-purple-600 dark:text-purple-400 flex items-center justify-center">
                      <HeartPulse className="w-4 h-4" />
                    </div>
                  </div>
                  <div className="mt-2 text-xs flex items-center justify-between text-muted-foreground">
                    <span>Pré-Hospitalar</span>
                    <span className="font-semibold text-purple-700 dark:text-purple-400">{outrasStats.aphPct}%</span>
                  </div>
                </div>

                {/* Prevenção */}
                <div className="p-3.5 rounded-xl border border-emerald-500/30 bg-emerald-500/[0.04] relative overflow-hidden group hover:border-emerald-500/50 transition-all">
                  <div className="flex items-start justify-between">
                    <div>
                      <span className="text-[10px] font-bold uppercase tracking-wider text-emerald-700 dark:text-emerald-400">
                        Prevenção
                      </span>
                      <div className="mt-1 text-2xl font-extrabold text-emerald-600 dark:text-emerald-400 tabular-nums">
                        {NF.format(outrasStats.prevencao)}
                      </div>
                    </div>
                    <div className="w-8 h-8 rounded-lg bg-emerald-500/15 text-emerald-600 dark:text-emerald-400 flex items-center justify-center">
                      <Shield className="w-4 h-4" />
                    </div>
                  </div>
                  <div className="mt-2 text-xs flex items-center justify-between text-muted-foreground">
                    <span>Ações Preventivas</span>
                    <span className="font-semibold text-emerald-700 dark:text-emerald-400">{outrasStats.prevencaoPct}%</span>
                  </div>
                </div>

                {/* Serviços */}
                <div className="p-3.5 rounded-xl border border-blue-500/30 bg-blue-500/[0.04] relative overflow-hidden group hover:border-blue-500/50 transition-all">
                  <div className="flex items-start justify-between">
                    <div>
                      <span className="text-[10px] font-bold uppercase tracking-wider text-blue-700 dark:text-blue-400">
                        Serviços
                      </span>
                      <div className="mt-1 text-2xl font-extrabold text-blue-600 dark:text-blue-400 tabular-nums">
                        {NF.format(outrasStats.servicos)}
                      </div>
                    </div>
                    <div className="w-8 h-8 rounded-lg bg-blue-500/15 text-blue-600 dark:text-blue-400 flex items-center justify-center">
                      <Wrench className="w-4 h-4" />
                    </div>
                  </div>
                  <div className="mt-2 text-xs flex items-center justify-between text-muted-foreground">
                    <span>Apoios Gerais</span>
                    <span className="font-semibold text-blue-700 dark:text-blue-400">{outrasStats.servicosPct}%</span>
                  </div>
                </div>
              </div>
            </section>

            {/* Filtro principal de datas */}
            <section className="rounded-xl bg-card shadow-elevated p-4 sm:p-5 space-y-4">
              <div className="flex flex-col gap-3 lg:flex-row lg:flex-wrap lg:items-end">
                <div className="grid grid-cols-2 gap-2 sm:flex">
                  <Button
                    variant={scope === "periodo" ? "default" : "outline"}
                    size="sm"
                    onClick={() => setScope("periodo")}
                  >
                    Por período
                  </Button>
                  <Button
                    variant={scope === "geral" ? "default" : "outline"}
                    size="sm"
                    onClick={() => setScope("geral")}
                  >
                    Geral (tudo)
                  </Button>
                </div>

                {scope === "periodo" && (
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 flex-1">
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

            {/* Busca por Município e Abas (Modo Regular) */}
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
                      "abt", "at", "aem", "atp", "ata", "abf", "atf", "abs", "pipa", "dosa", "crs", "ar", "ur", "gse", "mt", "ta", "quadriciclo", "embarcacao", "picape_fn", "picape_muni", "autoarp", "picape_esfron", "helicoptero", "aviao", "jetski"
                    ]}
                  />
                </TabsContent>
              </Tabs>
            </section>
          </>
        ) : (
          /* ------------------------------------------------------------- */
          /* MODO 2: COMPARATIVO ANUAL / INTERANUAL PERSONALIZADO LADO A LADO */
          /* ------------------------------------------------------------- */
          <div className="space-y-5 animate-fade-in-up">
            {/* Barra de Filtros Comparativos */}
            <section className="rounded-2xl bg-card border border-border p-4 sm:p-6 shadow-elevated space-y-4">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3 border-b border-border/60">
                <div className="flex items-center gap-2.5">
                  <div className="w-9 h-9 rounded-xl bg-primary/10 text-primary flex items-center justify-center font-bold">
                    <ArrowRightLeft className="w-5 h-5" />
                  </div>
                  <div>
                    <h2 className="font-bold text-base sm:text-lg text-foreground">
                      Painel Comparativo · Escolha os Anos e Meses
                    </h2>
                    <p className="text-xs text-muted-foreground">
                      Compare o mesmo período em anos diferentes lado a lado sem colunas de diferença.
                    </p>
                  </div>
                </div>

                <div className="flex flex-wrap items-center gap-2">
                  <Button
                    onClick={handleExportExactComparisonPdf}
                    size="sm"
                    className="bg-emerald-600 hover:bg-emerald-700 text-white font-semibold gap-1.5 shadow-sm h-8 text-xs"
                  >
                    <FileText className="w-3.5 h-3.5" />
                    Gerar Relatório Comparativo ({compYear1} vs {compYear2})
                  </Button>
                  <Button
                    size="sm"
                    variant={compViewMode === "lado-a-lado" ? "default" : "outline"}
                    onClick={() => setCompViewMode("lado-a-lado")}
                    className="h-8 text-xs gap-1.5"
                  >
                    📑 2 Tabelas Lado a Lado
                  </Button>
                  <Button
                    size="sm"
                    variant={compViewMode === "unificada" ? "default" : "outline"}
                    onClick={() => setCompViewMode("unificada")}
                    className="h-8 text-xs gap-1.5"
                  >
                    📊 Tabela Unificada
                  </Button>
                </div>
              </div>

              {/* Controles de Seleção de Anos e Meses */}
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3.5">
                <div>
                  <Label className="text-xs font-semibold text-foreground">Ano Base (Ano 1)</Label>
                  <select
                    value={compYear1}
                    onChange={(e) => setCompYear1(Number(e.target.value))}
                    className="mt-1 w-full h-9 rounded-md border border-input bg-card px-3 text-sm font-semibold shadow-sm focus:outline-none focus:ring-1 focus:ring-primary"
                  >
                    {AVAILABLE_YEARS.map((y) => (
                      <option key={y} value={y}>
                        Ano {y}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <Label className="text-xs font-semibold text-primary">Ano de Comparação (Ano 2)</Label>
                  <select
                    value={compYear2}
                    onChange={(e) => setCompYear2(Number(e.target.value))}
                    className="mt-1 w-full h-9 rounded-md border border-input bg-card px-3 text-sm font-semibold text-primary shadow-sm focus:outline-none focus:ring-1 focus:ring-primary"
                  >
                    {AVAILABLE_YEARS.map((y) => (
                      <option key={y} value={y}>
                        Ano {y}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <Label className="text-xs font-semibold text-foreground">
                    Meses para Comparação ({compMonths.length} selecionado{compMonths.length === 1 ? "" : "s"})
                  </Label>
                  <div className="mt-1">
                    <MonthMultiSelectDropdown
                      selectedMonths={compMonths}
                      onChange={setCompMonths}
                      colorScheme="sky"
                    />
                  </div>
                </div>

                <div>
                  <Label className="text-xs font-semibold text-foreground">Turno</Label>
                  <select
                    value={shift}
                    onChange={(e) => setShift(e.target.value as any)}
                    className="mt-1 w-full h-9 rounded-md border border-input bg-card px-3 text-sm shadow-sm focus:outline-none focus:ring-1 focus:ring-primary"
                  >
                    <option value="ambos">Ambos (24h + 12h)</option>
                    <option value="noturno">Diário 24h (Consolidado)</option>
                    <option value="parcial">Parcial 12h (Diurno)</option>
                  </select>
                </div>
              </div>

              {/* Atalhos Rápidos Comparativos */}
              <div className="flex flex-wrap items-center gap-1.5 pt-2 border-t border-border/60">
                <span className="text-xs font-semibold text-muted-foreground mr-1 flex items-center gap-1">
                  <Calendar className="w-3.5 h-3.5" /> Períodos Comparativos Rápidos:
                </span>
                <Button
                  size="sm"
                  variant="ghost"
                  className="h-7 text-xs px-2.5 text-amber-700 font-semibold"
                  onClick={() => applyCompPreset("safra")}
                >
                  🔥 Safra do Fogo (Jun a Nov)
                </Button>
                <Button
                  size="sm"
                  variant="ghost"
                  className="h-7 text-xs px-2.5 font-semibold text-foreground"
                  onClick={() => applyCompPreset("jun-ago")}
                >
                  ⚡ Junho a Agosto (Atual)
                </Button>
                <Button
                  size="sm"
                  variant="ghost"
                  className="h-7 text-xs px-2.5"
                  onClick={() => applyCompPreset("semestre1")}
                >
                  1º Semestre (Jan a Jun)
                </Button>
                <Button
                  size="sm"
                  variant="ghost"
                  className="h-7 text-xs px-2.5"
                  onClick={() => applyCompPreset("ano")}
                >
                  Ano Completo (Jan a Dez)
                </Button>
              </div>
            </section>

            {/* Cards de Resumo Comparativo Lado a Lado */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
              {/* Card Resumo Ano 1 */}
              <div className="p-4 sm:p-5 rounded-2xl bg-card border border-border shadow-elevated space-y-3 relative overflow-hidden">
                <div className="flex items-center justify-between border-b border-border/60 pb-2">
                  <div className="flex items-center gap-2">
                    <span className="text-xs font-bold uppercase tracking-wider px-2.5 py-0.5 rounded-full bg-muted text-foreground">
                      Ano Base
                    </span>
                    <h3 className="font-bold text-lg text-foreground">{compYear1}</h3>
                  </div>
                  <span className="text-xs text-muted-foreground font-medium">
                    📅 {MONTH_NAMES[compStartMonth]} a {MONTH_NAMES[compEndMonth]}
                  </span>
                </div>

                <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5">
                  <div className="p-2.5 rounded-lg bg-muted/30 border border-border/50">
                    <span className="text-[10px] uppercase font-bold text-muted-foreground block">Incêndios</span>
                    <span className="text-xl font-extrabold text-foreground tabular-nums block mt-0.5">
                      {NF.format(compTotals1.incendios)}
                    </span>
                    <span className="text-[10px] text-muted-foreground">
                      {compTotals1.flor} flor. / {compTotals1.urb} urb.
                    </span>
                  </div>

                  <div className="p-2.5 rounded-lg bg-muted/30 border border-border/50">
                    <span className="text-[10px] uppercase font-bold text-muted-foreground block">Focos</span>
                    <span className="text-xl font-extrabold text-foreground tabular-nums block mt-0.5">
                      {NF.format(compTotals1.focos)}
                    </span>
                    <span className="text-[10px] text-muted-foreground">Combatidos</span>
                  </div>

                  <div className="p-2.5 rounded-lg bg-muted/30 border border-border/50">
                    <span className="text-[10px] uppercase font-bold text-muted-foreground block">Ocorrências</span>
                    <span className="text-xl font-extrabold text-foreground tabular-nums block mt-0.5">
                      {NF.format(compTotals1.outras)}
                    </span>
                    <span className="text-[10px] text-muted-foreground">Atendimentos</span>
                  </div>

                  <div className="p-2.5 rounded-lg bg-muted/30 border border-border/50">
                    <span className="text-[10px] uppercase font-bold text-muted-foreground block">Relatórios</span>
                    <span className="text-xl font-extrabold text-foreground tabular-nums block mt-0.5">
                      {compTotals1.dias}
                    </span>
                    <span className="text-[10px] text-muted-foreground">Registros</span>
                  </div>
                </div>
              </div>

              {/* Card Resumo Ano 2 */}
              <div className="p-4 sm:p-5 rounded-2xl bg-card border border-primary/40 shadow-elevated space-y-3 relative overflow-hidden bg-gradient-to-br from-primary/[0.03] to-transparent">
                <div className="flex items-center justify-between border-b border-border/60 pb-2">
                  <div className="flex items-center gap-2">
                    <span className="text-xs font-bold uppercase tracking-wider px-2.5 py-0.5 rounded-full bg-primary/15 text-primary">
                      Ano Comparado
                    </span>
                    <h3 className="font-bold text-lg text-primary">{compYear2}</h3>
                  </div>
                  <span className="text-xs text-muted-foreground font-medium">
                    📅 {MONTH_NAMES[compStartMonth]} a {MONTH_NAMES[compEndMonth]}
                  </span>
                </div>

                <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5">
                  <div className="p-2.5 rounded-lg bg-primary/[0.05] border border-primary/20">
                    <span className="text-[10px] uppercase font-bold text-primary block">Incêndios</span>
                    <span className="text-xl font-extrabold text-primary tabular-nums block mt-0.5">
                      {NF.format(compTotals2.incendios)}
                    </span>
                    <span className="text-[10px] text-muted-foreground">
                      {compTotals2.flor} flor. / {compTotals2.urb} urb.
                    </span>
                  </div>

                  <div className="p-2.5 rounded-lg bg-primary/[0.05] border border-primary/20">
                    <span className="text-[10px] uppercase font-bold text-primary block">Focos</span>
                    <span className="text-xl font-extrabold text-primary tabular-nums block mt-0.5">
                      {NF.format(compTotals2.focos)}
                    </span>
                    <span className="text-[10px] text-muted-foreground">Combatidos</span>
                  </div>

                  <div className="p-2.5 rounded-lg bg-primary/[0.05] border border-primary/20">
                    <span className="text-[10px] uppercase font-bold text-primary block">Ocorrências</span>
                    <span className="text-xl font-extrabold text-primary tabular-nums block mt-0.5">
                      {NF.format(compTotals2.outras)}
                    </span>
                    <span className="text-[10px] text-muted-foreground">Atendimentos</span>
                  </div>

                  <div className="p-2.5 rounded-lg bg-primary/[0.05] border border-primary/20">
                    <span className="text-[10px] uppercase font-bold text-primary block">Relatórios</span>
                    <span className="text-xl font-extrabold text-primary tabular-nums block mt-0.5">
                      {compTotals2.dias}
                    </span>
                    <span className="text-[10px] text-muted-foreground">Registros</span>
                  </div>
                </div>
              </div>
            </div>

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

              {/* Conteúdo Comparativo Lado a Lado vs Unificado */}
              {compViewMode === "lado-a-lado" ? (
                <div className="grid grid-cols-1 xl:grid-cols-2 gap-6">
                  {/* Tabela do Ano 1 (Esquerda) */}
                  <div className="space-y-3">
                    <div className="flex items-center justify-between bg-card p-3 rounded-xl border border-border">
                      <span className="font-bold text-sm text-foreground flex items-center gap-2">
                        🗓️ Ano {compYear1} · {MONTH_NAMES[compStartMonth]} a {MONTH_NAMES[compEndMonth]}
                      </span>
                      <span className="text-xs font-semibold px-2 py-0.5 rounded bg-muted text-muted-foreground">
                        {rowsComp1.length} relatórios
                      </span>
                    </div>

                    {activeTab === "incendios" && (
                      <AggTable
                        title={`Incêndios em ${compYear1}`}
                        headers={["Município", "Urbano", "Florestal", "Focos", "Total"]}
                        rows={incendiosFiltered1}
                        keys={["urb", "flor", "focos"]}
                        sumKeys={["urb", "flor"]}
                      />
                    )}
                    {activeTab === "outras" && (
                      <AggTable
                        title={`Ocorrências em ${compYear1}`}
                        headers={["Município", "Salvamento", "Acidentes", "APH", "Prevenção", "Serviços", "Total"]}
                        rows={outrasFiltered1}
                        keys={["salvamento", "acidentes", "aph", "prevencao", "servicos"]}
                      />
                    )}
                    {activeTab === "efetivo" && (
                      <AggTable
                        title={`Efetivo em ${compYear1}`}
                        headers={["Município", "Ordinário", "SEG", "Brigada", "Total"]}
                        rows={efetivoFiltered1}
                        keys={["ord", "seg", "brig"]}
                      />
                    )}
                    {activeTab === "recursos" && (
                      <AggTable
                        title={`Recursos em ${compYear1}`}
                        headers={[
                          "Município", "ABT", "AT", "AEM", "ATP", "ATA", "ABF", "ATF", "ABS", "Pipa", "DOSA", "CRS", "AR", "UR", "GSE", "MT", "TA", "Quadriciclo", "Embarcação", "Picape FN", "Picape MUNI", "Autoarp", "Picape ESFRON", "Helicóptero", "Avião", "Jet Ski", "Total"
                        ]}
                        rows={recursosFiltered1}
                        keys={[
                          "abt", "at", "aem", "atp", "ata", "abf", "atf", "abs", "pipa", "dosa", "crs", "ar", "ur", "gse", "mt", "ta", "quadriciclo", "embarcacao", "picape_fn", "picape_muni", "autoarp", "picape_esfron", "helicoptero", "aviao", "jetski"
                        ]}
                      />
                    )}
                  </div>

                  {/* Tabela do Ano 2 (Direita) */}
                  <div className="space-y-3">
                    <div className="flex items-center justify-between bg-card p-3 rounded-xl border border-primary/40">
                      <span className="font-bold text-sm text-primary flex items-center gap-2">
                        🗓️ Ano {compYear2} · {MONTH_NAMES[compStartMonth]} a {MONTH_NAMES[compEndMonth]}
                      </span>
                      <span className="text-xs font-semibold px-2 py-0.5 rounded bg-primary/10 text-primary">
                        {rowsComp2.length} relatórios
                      </span>
                    </div>

                    {activeTab === "incendios" && (
                      <AggTable
                        title={`Incêndios em ${compYear2}`}
                        headers={["Município", "Urbano", "Florestal", "Focos", "Total"]}
                        rows={incendiosFiltered2}
                        keys={["urb", "flor", "focos"]}
                        sumKeys={["urb", "flor"]}
                      />
                    )}
                    {activeTab === "outras" && (
                      <AggTable
                        title={`Ocorrências em ${compYear2}`}
                        headers={["Município", "Salvamento", "Acidentes", "APH", "Prevenção", "Serviços", "Total"]}
                        rows={outrasFiltered2}
                        keys={["salvamento", "acidentes", "aph", "prevencao", "servicos"]}
                      />
                    )}
                    {activeTab === "efetivo" && (
                      <AggTable
                        title={`Efetivo em ${compYear2}`}
                        headers={["Município", "Ordinário", "SEG", "Brigada", "Total"]}
                        rows={efetivoFiltered2}
                        keys={["ord", "seg", "brig"]}
                      />
                    )}
                    {activeTab === "recursos" && (
                      <AggTable
                        title={`Recursos em ${compYear2}`}
                        headers={[
                          "Município", "ABT", "AT", "AEM", "ATP", "ATA", "ABF", "ATF", "ABS", "Pipa", "DOSA", "CRS", "AR", "UR", "GSE", "MT", "TA", "Quadriciclo", "Embarcação", "Picape FN", "Picape MUNI", "Autoarp", "Picape ESFRON", "Helicóptero", "Avião", "Jet Ski", "Total"
                        ]}
                        rows={recursosFiltered2}
                        keys={[
                          "abt", "at", "aem", "atp", "ata", "abf", "atf", "abs", "pipa", "dosa", "crs", "ar", "ur", "gse", "mt", "ta", "quadriciclo", "embarcacao", "picape_fn", "picape_muni", "autoarp", "picape_esfron", "helicoptero", "aviao", "jetski"
                        ]}
                      />
                    )}
                  </div>
                </div>
              ) : (
                /* Modo Tabela Unificada com Colunas Pareadas */
                <div>
                  {activeTab === "incendios" && (
                    <UnifiedComparisonTable
                      title="Incêndios"
                      year1={compYear1}
                      year2={compYear2}
                      rows1={incendiosFiltered1}
                      rows2={incendiosFiltered2}
                      keys={["urb", "flor", "focos"]}
                      keyLabels={{ urb: "Urbano", flor: "Florestal", focos: "Focos" }}
                      sumKeys={["urb", "flor"]}
                    />
                  )}
                  {activeTab === "outras" && (
                    <UnifiedComparisonTable
                      title="Ocorrências"
                      year1={compYear1}
                      year2={compYear2}
                      rows1={outrasFiltered1}
                      rows2={outrasFiltered2}
                      keys={["salvamento", "acidentes", "aph", "prevencao", "servicos"]}
                      keyLabels={{
                        salvamento: "Salvamento",
                        acidentes: "Acidentes",
                        aph: "APH",
                        prevencao: "Prevenção",
                        servicos: "Serviços",
                      }}
                    />
                  )}
                  {activeTab === "efetivo" && (
                    <UnifiedComparisonTable
                      title="Efetivo"
                      year1={compYear1}
                      year2={compYear2}
                      rows1={efetivoFiltered1}
                      rows2={efetivoFiltered2}
                      keys={["ord", "seg", "brig"]}
                      keyLabels={{ ord: "Ordinário", seg: "SEG", brig: "Brigada" }}
                    />
                  )}
                  {activeTab === "recursos" && (
                    <UnifiedComparisonTable
                      title="Recursos"
                      year1={compYear1}
                      year2={compYear2}
                      rows1={recursosFiltered1}
                      rows2={recursosFiltered2}
                      keys={["abt", "at", "ur", "ar", "mt", "embarcacao", "autoarp", "helicoptero"]}
                      keyLabels={{
                        abt: "ABT",
                        at: "AT",
                        ur: "UR",
                        ar: "AR",
                        mt: "MT",
                        embarcacao: "Embarcação",
                        autoarp: "AutoARP",
                        helicoptero: "Helicóptero",
                      }}
                    />
                  )}
                </div>
              )}
            </section>
          </div>
        )}
      </main>
    </div>
  );
}

function AnnualReportsCard({
  activeTab,
  years,
}: {
  activeTab: "incendios" | "outras" | "efetivo" | "recursos";
  years?: number[];
}) {
  const currentYear = new Date().getFullYear();
  const targetYears = years && years.length > 0 ? years : [currentYear];
  const isMultiYear = targetYears.length > 1;
  const yearTitle = targetYears.join(" · ");
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
      const data = await fetchAnnual({ data: { years: targetYears } });
      const mod = await import("@/lib/export-annual-pdf");
      const targetCategory = scope === "current" ? activeTab : "todos";
      if (kind === "completo") mod.exportAnnualIncendiosPdf(data, targetCategory);
      else mod.exportConsolidatedIncendiosPdf(data, targetCategory);
      toast.success("PDF gerado com sucesso. Verifique seus downloads.");
    } catch (e) {
      toast.error("Falha ao gerar o relatório", { description: (e as Error)?.message });
    } finally {
      setBusy(null);
    }
  };

  return (
    <section className="rounded-2xl bg-card border border-border shadow-elevated p-4 sm:p-5">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-4">
        <div>
          <h2 className="font-bold text-base text-foreground flex items-center gap-2">
            Relatórios Oficiais e Resumos Consolidados · {yearTitle}
          </h2>
          <p className="text-xs text-muted-foreground mt-0.5">
            {isMultiYear
              ? `Gera os documentos oficiais em PDF do comparativo (${yearTitle}) conforme o tipo selecionado na aba abaixo ou o relatório geral completo.`
              : `Gera os documentos oficiais de comparativo e totais acumulados de ${yearTitle} conforme o tipo selecionado na aba abaixo ou o relatório geral completo.`}
          </p>
        </div>

        <div className="flex items-center gap-1 bg-muted/60 p-1 rounded-lg border border-border shrink-0 text-xs self-start sm:self-auto">
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

      <div className="grid grid-cols-1 gap-2.5 sm:flex sm:justify-end">
        <Button
          variant="outline"
          size="sm"
          disabled={busy !== null}
          onClick={() => generate("completo")}
          className="font-medium gap-1.5"
        >
          {busy === "completo" ? (
            <Loader2 className="w-4 h-4 mr-1.5 animate-spin" />
          ) : (
            <FileText className="w-4 h-4 mr-1.5 text-muted-foreground" />
          )}
          Resumo detalhado por município ({scope === "current" ? TAB_LABELS[activeTab] : "Geral"})
        </Button>
        <Button
          size="sm"
          disabled={busy !== null}
          onClick={() => generate("consolidado")}
          className="bg-emerald-600 hover:bg-emerald-700 text-white font-semibold gap-1.5 shadow-sm"
        >
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
    <div className="rounded-xl bg-card shadow-elevated p-4 sm:p-5 border border-border/80">
      <div className="flex items-center justify-between gap-2 mb-3">
        <h2 className="font-semibold text-base">{title}</h2>
        <span className="text-xs text-muted-foreground font-medium">
          {rows.length} município(s) listado(s)
        </span>
      </div>
      <div className="-mx-4 sm:-mx-5 overflow-x-auto px-4 sm:px-5">
        <Table className="min-w-[34rem]">
          <TableHeader>
            <TableRow>
              {headers.map((h, i) => {
                const isFirst = i === 0;
                const isLast = i === headers.length - 1;
                const widthCls = isFirst ? "min-w-[150px]" : "min-w-[85px]";
                return (
                  <TableHead
                    key={i}
                    className={`whitespace-nowrap text-[11px] uppercase font-bold text-foreground p-1 ${widthCls}`}
                  >
                    <div
                      className={`h-9 w-full flex items-center px-3 ${
                        isFirst ? "justify-start" : "justify-center text-center"
                      } ${isLast ? "font-black text-primary" : ""}`}
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
                    <TableCell className="p-1 align-middle min-w-[150px]">
                      <div className="h-9 w-full flex items-center px-3 font-semibold text-foreground justify-start">
                        {r.mun}
                      </div>
                    </TableCell>
                    {keys.map((k) => (
                      <TableCell key={k} className="p-1 align-middle min-w-[85px]">
                        <div className="h-9 w-full flex items-center justify-center px-3 text-center tabular-nums font-normal text-slate-600 dark:text-slate-400">
                          {(Number(r[k]) || 0).toLocaleString("pt-BR")}
                        </div>
                      </TableCell>
                    ))}
                    <TableCell className="p-1 align-middle min-w-[85px]">
                      <div className="h-9 w-full flex items-center justify-center px-3 text-center tabular-nums font-bold text-foreground bg-muted/30 rounded-md">
                        {total.toLocaleString("pt-BR")}
                      </div>
                    </TableCell>
                  </TableRow>
                );
              })
            )}

            {rows.length > 0 && (
              <TableRow className="bg-muted/70 font-bold border-t-2 border-border/80">
                <TableCell className="p-1 align-middle min-w-[150px]">
                  <div className="h-9 w-full flex items-center px-3 font-bold text-foreground justify-start">
                    TOTAL GERAL
                  </div>
                </TableCell>
                {keys.map((k) => (
                  <TableCell key={k} className="p-1 align-middle min-w-[85px]">
                    <div className="h-9 w-full flex items-center justify-center px-3 text-center tabular-nums font-bold text-foreground">
                      {totals[k].toLocaleString("pt-BR")}
                    </div>
                  </TableCell>
                ))}
                <TableCell className="p-1 align-middle min-w-[85px]">
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

function UnifiedComparisonTable({
  title,
  year1,
  year2,
  rows1,
  rows2,
  keys,
  keyLabels,
  sumKeys,
}: {
  title: string;
  year1: number;
  year2: number;
  rows1: Array<Record<string, any>>;
  rows2: Array<Record<string, any>>;
  keys: string[];
  keyLabels: Record<string, string>;
  sumKeys?: string[];
}) {
  const activeSumKeys = sumKeys ?? keys;

  const allMuns = useMemo(() => {
    const set = new Set<string>();
    for (const r of rows1) set.add(r.mun);
    for (const r of rows2) set.add(r.mun);
    return Array.from(set).sort(compareMunicipios);
  }, [rows1, rows2]);

  const map1 = useMemo(() => new Map(rows1.map((r) => [r.mun.toLowerCase(), r])), [rows1]);
  const map2 = useMemo(() => new Map(rows2.map((r) => [r.mun.toLowerCase(), r])), [rows2]);

  const totals1 = keys.reduce<Record<string, number>>((acc, k) => {
    acc[k] = rows1.reduce((s, r) => s + (Number(r[k]) || 0), 0);
    return acc;
  }, {});
  const grand1 = activeSumKeys.reduce((a, k) => a + (totals1[k] || 0), 0);

  const totals2 = keys.reduce<Record<string, number>>((acc, k) => {
    acc[k] = rows2.reduce((s, r) => s + (Number(r[k]) || 0), 0);
    return acc;
  }, {});
  const grand2 = activeSumKeys.reduce((a, k) => a + (totals2[k] || 0), 0);

  return (
    <div className="rounded-xl bg-card shadow-elevated p-4 sm:p-5 border border-border/80">
      <div className="flex items-center justify-between gap-2 mb-3">
        <h2 className="font-semibold text-base">{title} · Comparativo Unificado ({year1} vs {year2})</h2>
      </div>
      <div className="-mx-4 sm:-mx-5 overflow-x-auto px-4 sm:px-5">
        <Table className="min-w-[40rem]">
          <TableHeader>
            <TableRow>
              <TableHead className="min-w-[160px] text-[11px] uppercase font-bold text-foreground p-1">
                <div className="h-9 w-full flex items-center px-3 justify-start">Município</div>
              </TableHead>
              {keys.map((k) => (
                <TableHead key={k} colSpan={2} className="text-center text-[11px] uppercase font-bold text-foreground p-1 border-l border-border/60">
                  <div className="h-9 w-full flex items-center justify-center px-2">{keyLabels[k] || k}</div>
                </TableHead>
              ))}
              <TableHead colSpan={2} className="text-center text-[11px] uppercase font-black text-primary p-1 border-l border-border/60">
                <div className="h-9 w-full flex items-center justify-center px-2">Total Geral</div>
              </TableHead>
            </TableRow>
            <TableRow className="bg-muted/40">
              <TableHead className="min-w-[160px] text-[10px] text-muted-foreground p-1 px-3">Nome</TableHead>
              {keys.map((k) => (
                <React.Fragment key={k}>
                  <TableHead className="text-center text-[10px] font-semibold text-muted-foreground p-1 px-2 border-l border-border/40">{year1}</TableHead>
                  <TableHead className="text-center text-[10px] font-semibold text-primary p-1 px-2">{year2}</TableHead>
                </React.Fragment>
              ))}
              <TableHead className="text-center text-[10px] font-bold text-muted-foreground p-1 px-2 border-l border-border/40">{year1}</TableHead>
              <TableHead className="text-center text-[10px] font-bold text-primary p-1 px-2">{year2}</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {allMuns.map((mun) => {
              const r1 = map1.get(mun.toLowerCase());
              const r2 = map2.get(mun.toLowerCase());
              const tot1 = activeSumKeys.reduce((s, k) => s + (Number(r1?.[k]) || 0), 0);
              const tot2 = activeSumKeys.reduce((s, k) => s + (Number(r2?.[k]) || 0), 0);

              return (
                <TableRow key={mun} className="hover:bg-primary/5 transition-colors">
                  <TableCell className="p-1 align-middle min-w-[160px]">
                    <div className="h-9 w-full flex items-center px-3 font-semibold text-foreground justify-start">
                      {mun}
                    </div>
                  </TableCell>
                  {keys.map((k) => {
                    const v1 = Number(r1?.[k]) || 0;
                    const v2 = Number(r2?.[k]) || 0;
                    return (
                      <React.Fragment key={k}>
                        <TableCell className="p-1 align-middle text-center tabular-nums text-muted-foreground border-l border-border/40">
                          {v1.toLocaleString("pt-BR")}
                        </TableCell>
                        <TableCell className="p-1 align-middle text-center tabular-nums font-semibold text-foreground">
                          {v2.toLocaleString("pt-BR")}
                        </TableCell>
                      </React.Fragment>
                    );
                  })}
                  <TableCell className="p-1 align-middle text-center tabular-nums font-bold text-muted-foreground bg-muted/20 border-l border-border/40">
                    {tot1.toLocaleString("pt-BR")}
                  </TableCell>
                  <TableCell className="p-1 align-middle text-center tabular-nums font-black text-primary bg-primary/10">
                    {tot2.toLocaleString("pt-BR")}
                  </TableCell>
                </TableRow>
              );
            })}

            <TableRow className="bg-muted/70 font-bold border-t-2 border-border/80">
              <TableCell className="p-1 align-middle min-w-[160px]">
                <div className="h-9 w-full flex items-center px-3 font-bold text-foreground justify-start">
                  TOTAL GERAL
                </div>
              </TableCell>
              {keys.map((k) => (
                <React.Fragment key={k}>
                  <TableCell className="p-1 align-middle text-center tabular-nums font-bold text-muted-foreground border-l border-border/40">
                    {(totals1[k] || 0).toLocaleString("pt-BR")}
                  </TableCell>
                  <TableCell className="p-1 align-middle text-center tabular-nums font-bold text-foreground">
                    {(totals2[k] || 0).toLocaleString("pt-BR")}
                  </TableCell>
                </React.Fragment>
              ))}
              <TableCell className="p-1 align-middle text-center tabular-nums font-black text-foreground bg-muted/40 border-l border-border/40">
                {grand1.toLocaleString("pt-BR")}
              </TableCell>
              <TableCell className="p-1 align-middle text-center tabular-nums font-black text-primary bg-primary/15">
                {grand2.toLocaleString("pt-BR")}
              </TableCell>
            </TableRow>
          </TableBody>
        </Table>
      </div>
    </div>
  );
}
