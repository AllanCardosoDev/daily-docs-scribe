import { compareMunicipios, canonicalMunicipio } from "@/lib/municipio-order";
import { createFileRoute, Link } from "@tanstack/react-router";
import { useMemo, useState, useEffect } from "react";
import { keepPreviousData, useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { ArrowLeft, Filter, FileText, Layers, Loader2 } from "lucide-react";
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
  const getLatest = useServerFn(getLatestReportDate);

  useEffect(() => {
    getLatest().then((dateStr) => {
      if (dateStr) {
        // Se a data mais recente for anterior ao mês atual, ajustamos o filtro
        // para exibir o mês que contém dados por padrão.
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

  const listFn = useServerFn(listDailyReports);
  const q = useQuery({
    queryKey: [
      "daily-reports",
      scope,
      scope === "periodo" ? from : "all",
      scope === "periodo" ? to : "all",
      shift,
    ],
    queryFn: () =>
      listFn({
        data: {
          ...(scope === "periodo" ? { from, to } : {}),
          ...(shift === "ambos" ? {} : { shift }),
        },
      }),
    placeholderData: keepPreviousData,
    staleTime: 60_000,
  });

  // Deduplica relatórios do mesmo dia (dando preferência para 'noturno'/24h)
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

  // Efetivo e Recursos são bens/pessoal fixo -> usa snapshot mais recente do período por município.
  const efetivo = useMemo(() => aggregateSnapshot(rows, "efetivo", ["ord", "seg", "brig"]), [rows]);
  const recursos = useMemo(
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

  // Incêndios e Outras Ocorrências são eventos diários -> usa somatório (SUM) no período.
  const incendios = useMemo(() => aggregateSum(rows, "incendios", ["urb", "flor", "focos"]), [rows]);
  const outras = useMemo(
    () => aggregateSum(rows, "outras", ["salvamento", "acidentes", "aph", "prevencao", "servicos"]),
    [rows],
  );

  const totals = useMemo(() => {
    const sum = (list: AnyRow[], keys: string[]) =>
      keys.reduce((acc, k) => acc + list.reduce((s, r) => s + (Number(r[k]) || 0), 0), 0);
    return {
      dias: rows.length,
      incendios: sum(incendios, ["urb", "flor"]),
      outras: sum(outras, ["salvamento", "acidentes", "aph", "prevencao", "servicos"]),
      efetivo: sum(efetivo, ["ord", "seg", "brig"]),
    };
  }, [rows, incendios, outras, efetivo]);

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
              Sala de Situação
            </div>
            <h1 className="font-display text-base sm:text-lg md:text-xl font-bold truncate">
              Totais acumulados e Comparativo
            </h1>
          </div>
          <div className="col-span-2 flex gap-2 md:col-auto md:ml-auto">
            <Button
              asChild
              variant="secondary"
              size="sm"
              className="w-full md:w-auto bg-white/95 text-foreground"
            >
              <Link to="/registro">Registro do dia</Link>
            </Button>
          </div>
        </div>
      </header>

      <main className="w-full max-w-[98%] mx-auto px-3 sm:px-6 py-6 space-y-5">
        {/* KPIs gerais */}
        <section className="grid grid-cols-1 xs:grid-cols-2 md:grid-cols-4 gap-3">
          <Kpi label="Relatórios no filtro" value={totals.dias} />
          <Kpi label="Incêndios (total)" value={totals.incendios} />
          <Kpi label="Ocorrências" value={totals.outras} />
          <Kpi label="Efetivo empenhado" value={totals.efetivo} />
        </section>

        {/* Filtro */}
        <section className="rounded-xl bg-card shadow-elevated p-4 sm:p-5">
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
                Geral (tudo)
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
              <Label>Relatório</Label>
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
        </section>

        <AnnualReportsCard />

        <Tabs defaultValue="incendios">
          <TabsList className="flex-wrap">
            <TabsTrigger value="incendios">Incêndios</TabsTrigger>
            <TabsTrigger value="outras">Ocorrências</TabsTrigger>
            <TabsTrigger value="efetivo">Efetivo</TabsTrigger>
            <TabsTrigger value="recursos">Recursos</TabsTrigger>
          </TabsList>

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
      </main>
    </div>
  );
}

function AnnualReportsCard() {
  // Somente o ano corrente: é o único período cujas planilhas são
  // consumidas/registradas no sistema.
  const year = new Date().getFullYear();
  const [busy, setBusy] = useState<"completo" | "consolidado" | null>(null);
  const fetchAnnual = useServerFn(getAnnualIncendios);

  const generate = async (kind: "completo" | "consolidado") => {
    setBusy(kind);
    try {
      const data = await fetchAnnual({ data: { years: [year] } });
      const mod = await import("@/lib/export-annual-pdf");
      if (kind === "completo") mod.exportAnnualIncendiosPdf(data);
      else mod.exportConsolidatedIncendiosPdf(data);
      toast.success("PDF gerado. Verifique seus downloads.");
    } catch (e) {
      toast.error("Falha ao gerar o relatório", { description: (e as Error)?.message });
    } finally {
      setBusy(null);
    }
  };

  return (
    <section className="rounded-xl bg-card shadow-elevated p-4 sm:p-5">
      <div className="flex flex-col gap-1 mb-4">
        <h2 className="font-semibold text-base">Comparativo e Resumos Consolidados · {year}</h2>
        <p className="text-xs sm:text-sm text-muted-foreground">
          Gera os documentos oficiais de comparativo e totais acumulados de {year} abrangendo todos os tipos de ocorrências (Incêndios, Atendimentos Diversos, Efetivo e Recursos): o detalhado por município (Resumo Completo por Seção) e o executivo consolidado (Resumo Geral Operacional).
        </p>
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
          Resumo detalhado por município
        </Button>
        <Button size="sm" disabled={busy !== null} onClick={() => generate("consolidado")}>
          {busy === "consolidado" ? (
            <Loader2 className="w-4 h-4 mr-1.5 animate-spin" />
          ) : (
            <Layers className="w-4 h-4 mr-1.5" />
          )}
          Resumo consolidado
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
                  <TableRow key={r.mun} className="hover:bg-primary/5">
                    <TableCell className="p-1 align-middle min-w-[160px]">
                      <div className="h-9 w-full flex items-center px-3 font-bold text-foreground justify-start">
                        {r.mun}
                      </div>
                    </TableCell>
                    {keys.map((k) => (
                      <TableCell key={k} className="p-1 align-middle min-w-[92px]">
                        <div className="h-9 w-full flex items-center justify-center px-3 text-center tabular-nums font-normal text-foreground">
                          {(Number(r[k]) || 0).toLocaleString("pt-BR")}
                        </div>
                      </TableCell>
                    ))}
                    <TableCell className="p-1 align-middle min-w-[92px]">
                      <div className="h-9 w-full flex items-center justify-center px-3 text-center tabular-nums font-bold text-foreground">
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
                    Total
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
                  <div className="h-9 w-full flex items-center justify-center px-3 text-center tabular-nums font-bold text-foreground">
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
