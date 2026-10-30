import { createFileRoute, Link } from "@tanstack/react-router";
import { manausFirst, canonicalMunicipio, harmonizeMunicipalitySections, isNonMunicipioTroop } from "@/lib/municipio-order";
import { useEffect, useMemo, useRef, useState } from "react";
import { keepPreviousData, useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";
import { ArrowLeft, Save, Plus, Trash2, CalendarDays, Lock, CheckCircle2, Clock, Info, Check, Loader2, RotateCcw, SlidersHorizontal, Upload, Flame } from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { getDailyReport, saveDailyReport, listAvailableReportDates } from "@/lib/daily-reports.functions";
import { SHIFTS, SHIFT_LABEL, SHIFT_TAB, type ReportShift } from "@/lib/report-shift";
import { DailyReportAuditDialog } from "@/components/dashboard/DailyReportAuditDialog";
import { ImportPlanilhaDialog } from "@/components/dashboard/ImportPlanilhaDialog";
import { MunicipioPicker } from "@/components/dashboard/MunicipiosDialog";
import {
  DadosComplementaresForm,
  type DadosComplementaresState,
} from "@/components/dashboard/DadosComplementaresForm";
import { EfetivoColumnsDialog } from "@/components/dashboard/EfetivoColumnsDialog";
import { DataTable } from "@/components/dashboard/DataTable";
import { OccurrenceDetailDialog } from "@/components/dashboard/OccurrenceDetailDialog";
import { DASHBOARD_COLUMNS, getStoredEfetivoColumns, saveStoredEfetivoColumns, type Column } from "@/lib/dashboard-columns";
import type { OccurrenceRow } from "@/lib/sheets.types";

export const Route = createFileRoute("/_authenticated/registro")({
  head: () => ({
    meta: [
      { title: "Registro Diário · Sala de Situação · CBMAM" },
      { name: "robots", content: "noindex" },
    ],
  }),
  component: RegistroPage,
});

// ------- Row types -------
type EfetivoRow = { mun: string; [key: string]: any };
type RecursoRow = { mun: string; viaturas: number; aeronaves: number; embarcacoes: number };
type IncendioRow = { mun: string; urb: number; flor: number; focos: number };

const EFETIVO_EMPTY: EfetivoRow = { mun: "", ord: 0, cbmam: 0, seg: 0, brig: 0 };
const RECURSO_EMPTY: RecursoRow = { mun: "", viaturas: 0, aeronaves: 0, embarcacoes: 0 };
const INCENDIO_EMPTY: IncendioRow = { mun: "", urb: 0, flor: 0, focos: 0 };

function todayISO() {
  const d = new Date();
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

function RegistroPage() {
  const [date, setDate] = useState<string>(todayISO());
  const [shift, setShift] = useState<ReportShift>("noturno");
  const qc = useQueryClient();
  const getFn = useServerFn(getDailyReport);
  const saveFn = useServerFn(saveDailyReport);
  const listDatesFn = useServerFn(listAvailableReportDates);

  const availableDatesQuery = useQuery({
    queryKey: ["available-report-dates"],
    queryFn: () => listDatesFn(),
    staleTime: 60_000,
  });

  const availableDates = useMemo(() => {
    const list = availableDatesQuery.data ?? [];
    const set = new Set<string>();
    for (const r of list) {
      if (r.report_date) set.add(r.report_date);
    }
    return Array.from(set).sort().reverse();
  }, [availableDatesQuery.data]);

  const q = useQuery({
    queryKey: ["daily-report", date, shift],
    queryFn: () => getFn({ data: { date, shift } }),
    staleTime: 30_000,
  });

  const day25TemplateQuery = useQuery({
    queryKey: ["daily-report", "2026-10-25", "noturno"],
    queryFn: () => getFn({ data: { date: "2026-10-25", shift: "noturno" } }),
    staleTime: 5 * 60_000,
  });

  const [efetivoColumns, setEfetivoColumns] = useState<Column[]>(() => getStoredEfetivoColumns());
  const [columnsDialogOpen, setColumnsDialogOpen] = useState(false);

  const [efetivo, setEfetivo] = useState<EfetivoRow[]>([]);
  const [recursos, setRecursos] = useState<RecursoRow[]>([]);
  const [incendios, setIncendios] = useState<IncendioRow[]>([]);
  const [dadosComplementares, setDadosComplementares] = useState<DadosComplementaresState>({});
  const [notes, setNotes] = useState<string>("");
  const [selectedOccurrence, setSelectedOccurrence] = useState<OccurrenceRow | null>(null);
  const cadOccurrences = useMemo(() => {
    return ((q.data as any)?.occurrences ?? []) as OccurrenceRow[];
  }, [q.data]);

  function handleSaveColumns(newCols: Column[]) {
    setEfetivoColumns(newCols);
    saveStoredEfetivoColumns(newCols);
    dirtyRef.current = true;
    setDadosComplementares((prev) => ({ ...prev, efetivo_columns: newCols }));
    setEfetivo((prev) =>
      prev.map((r) => {
        const copy: any = { ...r };
        for (const col of newCols) {
          if (col.numeric && copy[col.key] === undefined) {
            copy[col.key] = 0;
          }
        }
        return copy;
      }),
    );
  }

  /** Marca edições ainda não salvas — evita que um refetch em segundo plano
   *  (foco de janela, outro editor salvando) descarte o que está sendo digitado. */
  const dirtyRef = useRef(false);
  const loadedKeyRef = useRef<string>("");
  const mark =
    <T,>(fn: (v: T) => void) =>
    (v: T) => {
      dirtyRef.current = true;
      fn(v);
    };

  /** Confirma antes de trocar de relatório com rascunho pendente. */
  const confirmDiscard = () =>
    !dirtyRef.current ||
    (typeof window !== "undefined" &&
      window.confirm("Há alterações não salvas neste registro. Deseja descartá-las?"));

  // Avisa ao fechar/recarregar a aba com alterações pendentes.
  useEffect(() => {
    const onBeforeUnload = (e: BeforeUnloadEvent) => {
      if (!dirtyRef.current) return;
      e.preventDefault();
      e.returnValue = "";
    };
    window.addEventListener("beforeunload", onBeforeUnload);
    return () => window.removeEventListener("beforeunload", onBeforeUnload);
  }, []);

  const prevDateISO = useMemo(() => {
    const d = new Date(`${date}T00:00:00Z`);
    d.setDate(d.getDate() - 1);
    return d.toISOString().slice(0, 10);
  }, [date]);

  const sameDayParcialQuery = useQuery({
    queryKey: ["daily-report", date, "parcial"],
    queryFn: () => getFn({ data: { date, shift: "parcial" } }),
    enabled: shift === "noturno",
    staleTime: 60_000,
  });

  const prevParcialQuery = useQuery({
    queryKey: ["daily-report", prevDateISO, "parcial"],
    queryFn: () => getFn({ data: { date: prevDateISO, shift: "parcial" } }),
    enabled: shift === "noturno",
    staleTime: 60_000,
  });

  const parcialBaselineRow = sameDayParcialQuery.data?.row || prevParcialQuery.data?.row;

  const prevIncMap = useMemo(() => {
    const map = new Map<string, IncendioRow>();
    const list = (parcialBaselineRow?.incendios as IncendioRow[]) ?? [];
    for (const item of list) {
      if (item.mun) map.set(canonicalMunicipio(item.mun).toLowerCase(), item);
    }
    return map;
  }, [parcialBaselineRow?.incendios]);

  const [noturnoBaselineIncMap, setNoturnoBaselineIncMap] = useState<Map<string, IncendioRow>>(new Map());

  useEffect(() => {
    // Se a consulta ainda estiver buscando na rede e não tiver dados, aguarda
    if (q.isFetching && !q.data) return;

    const key = `${date}|${shift}`;
    const switchedReport = key !== loadedKeyRef.current;
    // Só sobrescreve se mudou de relatório ou se não há edições não salvas
    if (!switchedReport && dirtyRef.current) return;

    const row: any = q.data?.row;

    // Se o relatório de 24h estiver sendo aberto pela primeira vez e houver parcial:
    const baselineRow = sameDayParcialQuery.data?.row || prevParcialQuery.data?.row;
    let initialInc = (row?.incendios as IncendioRow[]) ?? [];

    if (shift === "noturno" && initialInc.length === 0 && baselineRow?.incendios) {
      initialInc = baselineRow.incendios as IncendioRow[];
    }

    if (shift === "noturno") {
      const incMap = new Map<string, IncendioRow>();
      for (const item of initialInc) {
        if (item.mun) incMap.set(canonicalMunicipio(item.mun).toLowerCase(), item);
      }
      setNoturnoBaselineIncMap(incMap);
    } else {
      setNoturnoBaselineIncMap(new Map());
    }

    // Carrega dados salvos ou pré-popula a partir do dia 25 se for do dia 25 em diante
    let loadedEfetivo = (row?.efetivo as EfetivoRow[]) ?? [];
    let loadedRecursos = (row?.recursos as RecursoRow[]) ?? [];

    if (!row && date >= "2026-10-25" && day25TemplateQuery.data?.row) {
      const d25 = day25TemplateQuery.data.row;
      if (Array.isArray(d25.efetivo) && d25.efetivo.length > 0) {
        loadedEfetivo = d25.efetivo as EfetivoRow[];
      }
      if (Array.isArray(d25.recursos) && d25.recursos.length > 0) {
        loadedRecursos = d25.recursos as RecursoRow[];
      }
    }

    if (Array.isArray(row?.dados_complementares?.efetivo_columns) && row.dados_complementares.efetivo_columns.length > 0) {
      setEfetivoColumns(row.dados_complementares.efetivo_columns);
    }

    // Harmoniza as seções para que todas possuam a mesma lista de municípios
    const harmonized = harmonizeMunicipalitySections(
      loadedEfetivo,
      loadedRecursos,
      initialInc,
      (mun) => ({ ...EFETIVO_EMPTY, mun }),
      (mun) => ({ ...RECURSO_EMPTY, mun }),
      (mun) => ({ ...INCENDIO_EMPTY, mun }),
    );

    setEfetivo(harmonized.efetivo);
    setRecursos(harmonized.recursos);
    setIncendios(harmonized.incendios);
    setDadosComplementares((row?.dados_complementares as DadosComplementaresState) ?? {});
    setNotes(row?.notes ?? "");
    loadedKeyRef.current = key;
    dirtyRef.current = false;
  }, [
    date,
    shift,
    q.data,
    q.isFetching,
    sameDayParcialQuery.data?.row,
    prevParcialQuery.data?.row,
    day25TemplateQuery.data?.row,
  ]);

  const canEdit = !!q.data?.canEdit;

  /** Municípios já presentes em qualquer seção do registro. */
  const municipiosNoRegistro = useMemo(() => {
    const s = new Set<string>();
    for (const r of efetivo) if (r.mun) s.add(r.mun);
    for (const r of recursos) if (r.mun) s.add(r.mun);
    for (const r of incendios) if (r.mun) s.add(r.mun);
    return Array.from(s);
  }, [efetivo, recursos, incendios]);

  function addMunicipio(name: string) {
    const has = (arr: { mun: string }[]) => arr.some((x) => x.mun.toLowerCase() === name.toLowerCase());
    let added = false;
    if (!has(efetivo)) {
      setEfetivo((p) => [...p, { ...EFETIVO_EMPTY, mun: name }]);
      added = true;
    }
    if (!has(recursos)) {
      setRecursos((p) => [...p, { ...RECURSO_EMPTY, mun: name }]);
      added = true;
    }
    if (!has(incendios)) {
      setIncendios((p) => [...p, { ...INCENDIO_EMPTY, mun: name }]);
      added = true;
    }
    toast[added ? "success" : "info"](
      added
        ? `${name} incluído em todas as seções. Preencha os dados e salve.`
        : `${name} já está em todas as seções.`,
    );
  }

  function renameMunicipio(oldMun: string, newMun: string) {
    dirtyRef.current = true;
    const oldNorm = canonicalMunicipio(oldMun).toLowerCase();
    setEfetivo((prev) =>
      prev.map((r) => (canonicalMunicipio(r.mun).toLowerCase() === oldNorm ? { ...r, mun: newMun } : r)),
    );
    setRecursos((prev) =>
      prev.map((r) => (canonicalMunicipio(r.mun).toLowerCase() === oldNorm ? { ...r, mun: newMun } : r)),
    );
    setIncendios((prev) =>
      prev.map((r) => (canonicalMunicipio(r.mun).toLowerCase() === oldNorm ? { ...r, mun: newMun } : r)),
    );
  }

  function removeMunicipioRow(munToRemove: string) {
    dirtyRef.current = true;
    const norm = canonicalMunicipio(munToRemove).toLowerCase();
    setEfetivo((prev) => prev.filter((r) => canonicalMunicipio(r.mun).toLowerCase() !== norm));
    setRecursos((prev) => prev.filter((r) => canonicalMunicipio(r.mun).toLowerCase() !== norm));
    setIncendios((prev) => prev.filter((r) => canonicalMunicipio(r.mun).toLowerCase() !== norm));
    toast.success(`Município "${munToRemove}" removido de Efetivo, Recursos e Incêndios.`);
  }

  function handleAddEmptyRow() {
    dirtyRef.current = true;
    setEfetivo((prev) => [...prev, { ...EFETIVO_EMPTY }]);
    setRecursos((prev) => [...prev, { ...RECURSO_EMPTY }]);
    setIncendios((prev) => [...prev, { ...INCENDIO_EMPTY }]);
  }

  function handleSyncAllSections() {
    const harmonized = harmonizeMunicipalitySections(
      efetivo,
      recursos,
      incendios,
      (mun) => ({ ...EFETIVO_EMPTY, mun }),
      (mun) => ({ ...RECURSO_EMPTY, mun }),
      (mun) => ({ ...INCENDIO_EMPTY, mun }),
    );
    setEfetivo(harmonized.efetivo);
    setRecursos(harmonized.recursos);
    setIncendios(harmonized.incendios);
    dirtyRef.current = true;
    toast.success(`Todas as 3 seções sincronizadas com ${harmonized.efetivo.length} municípios idênticos!`);
  }

  const save = useMutation({
    mutationFn: () => {
      const harmonized = harmonizeMunicipalitySections(
        efetivo,
        recursos,
        incendios,
        (mun) => ({ ...EFETIVO_EMPTY, mun }),
        (mun) => ({ ...RECURSO_EMPTY, mun }),
        (mun) => ({ ...INCENDIO_EMPTY, mun }),
      );
      return saveFn({
        data: {
          report_date: date,
          shift,
          efetivo: harmonized.efetivo,
          recursos: harmonized.recursos as any,
          incendios: harmonized.incendios,
          outras: [],
          dados_complementares: {
            ...dadosComplementares,
            efetivo_columns: efetivoColumns,
          } as any,
          notes,
        },
      });
    },
    onSuccess: () => {
      dirtyRef.current = false;
      toast.success("Registro salvo com sucesso no banco de dados.");
      qc.invalidateQueries({ queryKey: ["daily-report", date, shift] });
      qc.invalidateQueries({ queryKey: ["daily-reports"] });
      qc.invalidateQueries({ queryKey: ["available-report-dates"] });
    },
    onError: (e: any) => toast.error("Falha ao salvar dados", { description: e?.message }),
  });

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "s") {
        e.preventDefault();
        if (canEdit && !save.isPending) {
          save.mutate();
        }
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [canEdit, save]);

  const dateLabel = useMemo(() => {
    try {
      const [y, m, d] = date.split("-").map(Number);
      return new Date(y, m - 1, d).toLocaleDateString("pt-BR", {
        weekday: "long",
        day: "2-digit",
        month: "long",
        year: "numeric",
      });
    } catch {
      return date;
    }
  }, [date]);

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
              Registro Diário
            </h1>
          </div>
          <div className="col-span-2 flex flex-wrap items-center gap-2 md:col-auto md:ml-auto">
            <Button
              asChild
              variant="secondary"
              size="sm"
              className="flex-1 min-w-0 md:flex-none bg-white/95 text-foreground"
            >
              <Link to="/totais">Totais</Link>
            </Button>
            <Button
              asChild
              variant="secondary"
              size="sm"
              className="flex-1 min-w-0 md:flex-none bg-white/95 text-foreground"
            >
              <Link to="/escala">
                <CalendarDays className="w-4 h-4 mr-1.5" />
                Escala
              </Link>
            </Button>
          </div>
        </div>
      </header>

      <main className="w-full max-w-[98%] mx-auto px-3 sm:px-6 py-6 space-y-5">
        <section className="rounded-xl bg-card shadow-elevated p-4 sm:p-5 space-y-4">
          <div className="flex flex-col lg:flex-row lg:items-end gap-3">
            <div className="flex-1 min-w-0">
              <Label htmlFor="report-date" className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                Data do serviço na sala
              </Label>
              <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2 mt-1">
                <Input
                  id="report-date"
                  type="date"
                  value={date}
                  onChange={(e) => {
                    const newD = e.target.value;
                    if (!newD) return;
                    if (confirmDiscard()) {
                      dirtyRef.current = false;
                      setDate(newD);
                    }
                  }}
                  className="w-full sm:w-44 font-medium"
                />
                {availableDates.length > 0 && (
                  <select
                    aria-label="Selecionar dia com dados existentes"
                    value={availableDates.includes(date) ? date : ""}
                    onChange={(e) => {
                      const newD = e.target.value;
                      if (newD && confirmDiscard()) {
                        dirtyRef.current = false;
                        setDate(newD);
                      }
                    }}
                    className="h-9 px-3 rounded-md border border-input bg-background text-xs font-medium text-foreground focus:outline-none focus:ring-2 focus:ring-ring"
                  >
                    <option value="" disabled>
                      📅 Ver dias já gravados ({availableDates.length} dias)...
                    </option>
                    {availableDates.map((d) => (
                      <option key={d} value={d}>
                        {d.split("-").reverse().join("/")}
                      </option>
                    ))}
                  </select>
                )}
              </div>
              <p className="text-xs text-muted-foreground mt-1 capitalize">{dateLabel}</p>
            </div>

            <div className="flex-1 min-w-0">
              <Label className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                Turno
              </Label>
              <div className="mt-1 grid grid-cols-2 gap-1 rounded-lg border border-border bg-muted/40 p-1 sm:inline-flex">
                {SHIFTS.map((s) => (
                  <button
                    key={s}
                    type="button"
                    onClick={() => {
                      if (confirmDiscard()) {
                        dirtyRef.current = false;
                        setShift(s);
                      }
                    }}
                    aria-pressed={shift === s}
                    className={`min-h-9 px-3 py-1.5 text-sm rounded-md transition-colors ${
                      shift === s
                        ? "bg-card shadow-sm font-semibold"
                        : "text-muted-foreground hover:text-foreground"
                    }`}
                  >
                    {SHIFT_TAB[s]}
                  </button>
                ))}
              </div>
              <p className="text-xs text-muted-foreground mt-1">{SHIFT_LABEL[shift]}</p>
            </div>

            <div className="flex flex-wrap items-center gap-2 [&>*]:flex-1 [&>*]:min-w-[10rem] sm:[&>*]:flex-none">
              <ImportPlanilhaDialog
                triggerButton={
                  <Button variant="outline" size="sm" disabled={!canEdit} className="gap-2 min-h-10">
                    <Upload className="size-4" />
                    <span className="hidden sm:inline">Importar Planilha</span>
                    <span className="sm:hidden">Planilha</span>
                  </Button>
                }
                onSuccess={(res) => {
                  if (res.latestDate) {
                    dirtyRef.current = false;
                    setDate(res.latestDate);
                    if (res.shift) setShift(res.shift as ReportShift);
                  }
                }}
              />

              {q.data?.isAdmin && <DailyReportAuditDialog date={date} shift={shift} />}

              {!canEdit && (
                <Badge variant="secondary" className="gap-1.5 justify-center">
                  <Lock className="w-3 h-3" /> Somente leitura
                </Badge>
              )}

              <Button
                onClick={() => save.mutate()}
                disabled={!canEdit || save.isPending || q.isLoading}
                className="gap-2 bg-gradient-brand text-white font-bold shadow-elevated hover:opacity-95 hover-lift px-6 min-h-10"
              >
                {save.isPending ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin" />
                    Salvando dados…
                  </>
                ) : (
                  <>
                    <Save className="w-4 h-4" />
                    Salvar Dados (Ctrl+S)
                  </>
                )}
              </Button>
            </div>
          </div>

          {/* Feedback automático do dia carregado */}
          <div className="pt-2 border-t border-border/60">
            {q.isFetching ? (
              <div className="flex items-center gap-2 text-xs text-primary font-medium p-2.5 rounded-md bg-primary/10 animate-pulse">
                <Loader2 className="w-4 h-4 animate-spin shrink-0" />
                Carregando dados salvos de {date.split("-").reverse().join("/")} ({SHIFT_TAB[shift]})…
              </div>
            ) : q.data?.row ? (
              <div className="flex flex-wrap items-center justify-between gap-2 text-xs text-emerald-800 bg-emerald-50 border border-emerald-200 p-2.5 rounded-md">
                <div className="flex items-center gap-2">
                  <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
                  <span>
                    <strong>Dados carregados:</strong> Registro de {date.split("-").reverse().join("/")} ({SHIFT_TAB[shift]}) carregado do banco ({efetivo.length} municípios).
                  </span>
                </div>
                {q.data.row.updated_at && (
                  <span className="text-emerald-700 font-mono">
                    Última gravação: {new Date(q.data.row.updated_at).toLocaleString("pt-BR")}
                  </span>
                )}
              </div>
            ) : (
              <div className="flex flex-wrap items-center justify-between gap-2 text-xs text-blue-800 bg-blue-50 border border-blue-200 p-2.5 rounded-md">
                <div className="flex items-center gap-2">
                  <Info className="w-4 h-4 text-blue-600 shrink-0" />
                  <span>
                    <strong>Inserção de dados:</strong> Nenhum registro salvo para {date.split("-").reverse().join("/")} ({SHIFT_TAB[shift]}). Preencha os dados e clique em Salvar Dados.
                  </span>
                </div>
                <div className="flex flex-wrap items-center gap-2">
                  {date >= "2026-10-25" && day25TemplateQuery.data?.row && (
                    <Button
                      type="button"
                      size="sm"
                      variant="outline"
                      className="h-7 text-xs bg-white text-emerald-800 border-emerald-300 hover:bg-emerald-50"
                      onClick={() => {
                        const template = day25TemplateQuery.data?.row;
                        if (template) {
                          if (template.efetivo) setEfetivo(manausFirst(template.efetivo as any));
                          if (template.recursos) setRecursos(manausFirst(template.recursos as any).filter((r: any) => !isNonMunicipioTroop(r?.mun)) as RecursoRow[]);
                          dirtyRef.current = true;
                          toast.success("Efetivo e Recursos carregados com base no modelo de 25/10!");
                        }
                      }}
                    >
                      Carregar modelo de 25/10
                    </Button>
                  )}
                  {shift === "noturno" && sameDayParcialQuery.data?.row && (
                    <Button
                      type="button"
                      size="sm"
                      variant="outline"
                      className="h-7 text-xs bg-white text-blue-900 border-blue-300 hover:bg-blue-100"
                      onClick={() => {
                        const base = sameDayParcialQuery.data?.row;
                        if (base) {
                          if (base.efetivo) setEfetivo(manausFirst(base.efetivo as any));
                          if (base.recursos) setRecursos(manausFirst(base.recursos as any).filter((r: any) => !isNonMunicipioTroop(r?.mun)) as RecursoRow[]);
                          if (base.incendios) setIncendios(manausFirst(base.incendios as any).filter((r: any) => !isNonMunicipioTroop(r?.mun)) as IncendioRow[]);
                          dirtyRef.current = true;
                          toast.success("Dados do relatório Parcial copiados para este 24h.");
                        }
                      }}
                    >
                      Copiar base do Parcial deste dia
                    </Button>
                  )}
                </div>
              </div>
            )}
          </div>

          <div className="mt-4 pt-4 border-t border-border flex flex-wrap items-center justify-between gap-3">
            <div className="flex-1 min-w-[280px]">
              <MunicipioPicker
                isAdmin={!!q.data?.isAdmin}
                disabled={!canEdit}
                existing={municipiosNoRegistro}
                onAdd={addMunicipio}
              />
              <p className="text-xs text-muted-foreground mt-2">
                Ao incluir, o município é adicionado simultaneamente em Efetivo, Recursos e Incêndios.
              </p>
            </div>
            {canEdit && (
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={handleSyncAllSections}
                className="gap-1.5 text-xs font-semibold text-emerald-800 bg-emerald-50/60 border-emerald-300 hover:bg-emerald-100 shrink-0"
                title="Garante que Efetivo, Recursos e Incêndios possuam rigorosamente a mesma lista de municípios"
              >
                <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" />
                <span>Sincronizar Municípios (3 Seções)</span>
              </Button>
            )}
          </div>

          {!canEdit && q.data?.row && (
            <p className="text-xs text-amber-700 mt-3">
              Você não estava escalado neste dia. Peça a um admin ou ao operador do dia para editar.
            </p>
          )}
        </section>

        <Tabs defaultValue="efetivo">
          <TabsList className="flex-wrap">
            <TabsTrigger value="efetivo">Efetivo</TabsTrigger>
            <TabsTrigger value="recursos">Recursos</TabsTrigger>
            <TabsTrigger value="incendios">Incêndios</TabsTrigger>
            <TabsTrigger value="ocorrencias" className="gap-1.5">
              <span>Ocorrências (CAD)</span>
              {cadOccurrences.length > 0 && (
                <Badge variant="secondary" className="px-1.5 py-0 text-[10px] font-bold">
                  {cadOccurrences.length}
                </Badge>
              )}
            </TabsTrigger>
            <TabsTrigger value="complementares">Dados Complementares (API)</TabsTrigger>
            <TabsTrigger value="notas">Observações</TabsTrigger>
          </TabsList>

          <TabsContent value="efetivo">
            <SectionTable
              title="Efetivo empenhado"
              headers={[
                "Município",
                ...efetivoColumns.filter((c) => c.key !== "mun" && c.key !== "total").map((c) => c.label),
                "",
              ]}
              rows={efetivo}
              onChange={mark(setEfetivo)}
              onAddRow={handleAddEmptyRow}
              onRemoveRow={(r) => removeMunicipioRow(r.mun)}
              empty={EFETIVO_EMPTY}
              canEdit={canEdit}
              extraActions={
                <Button
                  type="button"
                  size="sm"
                  variant="outline"
                  onClick={() => setColumnsDialogOpen(true)}
                  className="gap-1.5 text-xs font-semibold text-primary border-primary/30 hover:bg-primary/5"
                  title="Alterar nomes, adicionar ou remover colunas do efetivo"
                >
                  <SlidersHorizontal className="w-3.5 h-3.5" />
                  <span>Personalizar Colunas</span>
                </Button>
              }
              renderCells={(r, patch) => {
                const numericCols = efetivoColumns.filter((c) => c.key !== "mun" && c.key !== "total");
                return (
                  <>
                    <TableCell className="min-w-[280px] w-[280px]">
                      <Input
                        value={r.mun}
                        onChange={(e) => renameMunicipio(r.mun, e.target.value)}
                        disabled={!canEdit}
                        title={r.mun}
                        className="font-bold text-foreground min-w-[260px]"
                      />
                    </TableCell>
                    {numericCols.map((col) => (
                      <NumCell
                        key={col.key}
                        v={Number(r[col.key] ?? 0)}
                        on={(v) => patch({ [col.key]: v })}
                        disabled={!canEdit}
                      />
                    ))}
                  </>
                );
              }}
            />
          </TabsContent>

          <TabsContent value="recursos">
            <SectionTable
              title="Recursos empregados"
              headers={["Município", "Viaturas", "Aeronaves", "Embarcações", ""]}
              rows={recursos}
              onChange={mark(setRecursos)}
              onAddRow={handleAddEmptyRow}
              onRemoveRow={(r) => removeMunicipioRow(r.mun)}
              empty={RECURSO_EMPTY}
              canEdit={canEdit}
              renderCells={(r, patch) => (
                <>
                  <TableCell className="min-w-[280px] w-[280px]">
                    <Input
                      value={r.mun}
                      onChange={(e) => renameMunicipio(r.mun, e.target.value)}
                      disabled={!canEdit}
                      title={r.mun}
                      className="font-bold text-foreground min-w-[260px]"
                    />
                  </TableCell>
                  <NumCell v={r.viaturas} on={(v) => patch({ viaturas: v })} disabled={!canEdit} />
                  <NumCell
                    v={r.aeronaves}
                    on={(v) => patch({ aeronaves: v })}
                    disabled={!canEdit}
                  />
                  <NumCell
                    v={r.embarcacoes}
                    on={(v) => patch({ embarcacoes: v })}
                    disabled={!canEdit}
                  />
                </>
              )}
            />
          </TabsContent>

          <TabsContent value="incendios">
            <SectionTable
              title="Incêndios (do dia)"
              headers={["Município", "Urbano", "Florestal", "Focos", ""]}
              rows={incendios}
              onChange={mark(setIncendios)}
              onAddRow={handleAddEmptyRow}
              onRemoveRow={(r) => removeMunicipioRow(r.mun)}
              empty={INCENDIO_EMPTY}
              canEdit={canEdit}
              onReset={() => {
                if (shift === "noturno") {
                  setIncendios((prev) =>
                    prev.map((r) => {
                      const key = canonicalMunicipio(r.mun).toLowerCase();
                      const baseInc = prevIncMap.get(key) || noturnoBaselineIncMap.get(key);
                      return {
                        ...r,
                        urb: baseInc?.urb || 0,
                        flor: baseInc?.flor || 0,
                        focos: baseInc?.focos || 0,
                        total_periodo: (baseInc?.urb || 0) + (baseInc?.flor || 0) + (baseInc?.focos || 0),
                      };
                    }),
                  );
                  dirtyRef.current = true;
                  toast.success("Incêndios do dia restaurados para o piso mínimo do Parcial.");
                } else {
                  setIncendios((prev) =>
                    prev.map((r) => ({ ...r, urb: 0, flor: 0, focos: 0, total_periodo: 0 })),
                  );
                  dirtyRef.current = true;
                  toast.success("Incêndios do dia zerados para nova digitação.");
                }
              }}
              renderCells={(r, patch) => {
                const key = canonicalMunicipio(r.mun).toLowerCase();
                const prevQueryItem = shift === "noturno" ? prevIncMap.get(key) : undefined;
                const loadedItem = shift === "noturno" ? noturnoBaselineIncMap.get(key) : undefined;

                const minUrb = shift === "noturno" ? Math.max(prevQueryItem?.urb || 0, loadedItem?.urb || 0) : 0;
                const minFlor = shift === "noturno" ? Math.max(prevQueryItem?.flor || 0, loadedItem?.flor || 0) : 0;
                const minFocos = shift === "noturno" ? Math.max(prevQueryItem?.focos || 0, loadedItem?.focos || 0) : 0;

                return (
                  <>
                    <TableCell className="min-w-[280px] w-[280px]">
                      <Input
                        value={r.mun}
                        onChange={(e) => renameMunicipio(r.mun, e.target.value)}
                        disabled={!canEdit}
                        title={r.mun}
                        className="font-bold text-foreground min-w-[260px]"
                      />
                    </TableCell>
                    <NumCell
                      v={r.urb}
                      on={(v) => patch({ urb: v })}
                      disabled={!canEdit}
                      minVal={minUrb}
                      isPrevFilled={shift === "noturno" && minUrb > 0}
                    />
                    <NumCell
                      v={r.flor}
                      on={(v) => patch({ flor: v })}
                      disabled={!canEdit}
                      minVal={minFlor}
                      isPrevFilled={shift === "noturno" && minFlor > 0}
                    />
                    <NumCell
                      v={r.focos}
                      on={(v) => patch({ focos: v })}
                      disabled={!canEdit}
                      minVal={minFocos}
                      isPrevFilled={shift === "noturno" && minFocos > 0}
                    />
                  </>
                );
              }}
            />
          </TabsContent>

          <TabsContent value="ocorrencias" className="space-y-4">
            <div className="rounded-xl bg-card shadow-elevated p-4 sm:p-5 space-y-4">
              <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 border-b border-border/60 pb-3">
                <div>
                  <h3 className="font-bold text-base text-foreground flex items-center gap-2">
                    <Flame className="w-4 h-4 text-primary" />
                    Ocorrências Oficiais de Incêndio (CAD)
                  </h3>
                  <p className="text-xs text-muted-foreground mt-0.5">
                    Ocorrências catalogadas pelo CBMAM para o dia {date.split("-").reverse().join("/")}. Clique em qualquer ocorrência para inspecionar todos os dados operacionais (equipes, narrativa, relato do CAD, viatura e mapa).
                  </p>
                </div>
                <Badge variant="outline" className="font-bold text-xs bg-muted/60 shrink-0">
                  {cadOccurrences.length} registro(s)
                </Badge>
              </div>

              <DataTable
                title="Ocorrências do CAD"
                badgeText={`${cadOccurrences.length} ${cadOccurrences.length === 1 ? "registro" : "registros"}`}
                editable={false}
                columns={DASHBOARD_COLUMNS.occurrences}
                rows={cadOccurrences}
                emptyMessage={`Sem ocorrências de incêndio catalogadas no CAD para ${date.split("-").reverse().join("/")}.`}
                onRowClick={(row) => setSelectedOccurrence(row as OccurrenceRow)}
              />
            </div>
          </TabsContent>

          <TabsContent value="complementares">
            <DadosComplementaresForm
              value={dadosComplementares}
              onChange={mark(setDadosComplementares)}
              canEdit={canEdit}
            />
          </TabsContent>

          <TabsContent value="notas">
            <div className="rounded-xl bg-card shadow-elevated p-4 sm:p-5 space-y-2">
              <Label htmlFor="notas">Observações do serviço na sala</Label>
              <Textarea
                id="notas"
                rows={8}
                value={notes}
                onChange={(e) => {
                  dirtyRef.current = true;
                  setNotes(e.target.value);
                }}
                placeholder="Registre eventos relevantes, decisões, apoios acionados etc."
                disabled={!canEdit}
              />
            </div>
          </TabsContent>
        </Tabs>

        <EfetivoColumnsDialog
          open={columnsDialogOpen}
          onOpenChange={setColumnsDialogOpen}
          columns={efetivoColumns}
          onSave={handleSaveColumns}
        />

        <OccurrenceDetailDialog
          occurrence={selectedOccurrence}
          open={!!selectedOccurrence}
          onOpenChange={(open) => !open && setSelectedOccurrence(null)}
        />
      </main>
    </div>
  );
}

// ---------- Reusable table ----------
function SectionTable<T extends { mun: string }>(props: {
  title: string;
  headers: string[];
  rows: T[];
  onChange: (rows: T[]) => void;
  empty: T;
  canEdit: boolean;
  onReset?: () => void;
  onAddRow?: () => void;
  onRemoveRow?: (row: T, idx: number) => void;
  extraActions?: React.ReactNode;
  renderCells: (row: T, patch: (p: Partial<T>) => void) => React.ReactNode;
}) {
  const { title, headers, rows, onChange, empty, canEdit, onReset, onAddRow, onRemoveRow, extraActions, renderCells } = props;
  return (
    <div className="rounded-xl bg-card shadow-elevated p-4 sm:p-5 space-y-3">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h2 className="font-semibold text-base min-w-0">{title}</h2>
        <div className="flex items-center gap-2">
          {extraActions}
          {onReset && canEdit && (
            <Button
              size="sm"
              variant="ghost"
              onClick={onReset}
              className="gap-1.5 text-xs text-muted-foreground hover:text-foreground"
              title="Zerar todos os campos desta seção para nova digitação"
            >
              <RotateCcw className="w-3.5 h-3.5" /> Zerar valores
            </Button>
          )}
          <Button
            size="sm"
            variant="outline"
            disabled={!canEdit}
            onClick={onAddRow ? onAddRow : () => onChange([...rows, { ...empty }])}
            className="gap-1.5 shrink-0"
          >
            <Plus className="w-4 h-4" /> <span className="hidden xs:inline">Adicionar linha</span>
            <span className="xs:hidden">Adicionar</span>
          </Button>
        </div>
      </div>
      <div className="-mx-4 sm:-mx-5 overflow-x-auto px-4 sm:px-5">
        <Table className="min-w-[36rem]">
          <TableHeader>
            <TableRow>
              {headers.map((h, i) => (
                <TableHead
                  key={i}
                  className={i === 0 ? "min-w-[280px] w-[280px] whitespace-nowrap font-bold" : "whitespace-nowrap"}
                >
                  {h}
                </TableHead>
              ))}
            </TableRow>
          </TableHeader>

          <TableBody>
            {rows.length === 0 ? (
              <TableRow>
                <TableCell
                  colSpan={headers.length}
                  className="text-center text-sm text-muted-foreground py-6"
                >
                  Nenhuma linha. Clique em "Adicionar linha".
                </TableCell>
              </TableRow>
            ) : (
              rows.map((r, idx) => {
                const patch = (p: Partial<T>) => {
                  const next = rows.slice();
                  next[idx] = { ...r, ...p };
                  onChange(next);
                };
                return (
                  <TableRow key={idx}>
                    {renderCells(r, patch)}
                    <TableCell className="w-10 text-right">
                      <Button
                        size="icon"
                        variant="ghost"
                        disabled={!canEdit}
                        onClick={() =>
                          onRemoveRow ? onRemoveRow(r, idx) : onChange(rows.filter((_, i) => i !== idx))
                        }
                        aria-label="Remover linha"
                      >
                        <Trash2 className="w-4 h-4 text-red-600" />
                      </Button>
                    </TableCell>
                  </TableRow>
                );
              })
            )}
          </TableBody>
        </Table>
      </div>
    </div>
  );
}

function NumCell({
  v,
  on,
  disabled,
  minVal = 0,
  isPrevFilled = false,
}: {
  v: number;
  on: (v: number) => void;
  disabled?: boolean;
  minVal?: number;
  isPrevFilled?: boolean;
}) {
  const current = Number.isFinite(v) ? v : 0;
  const isRed = isPrevFilled || (minVal > 0 && current > 0);
  const [localStr, setLocalStr] = useState<string | null>(null);

  useEffect(() => {
    setLocalStr(null);
  }, [v]);

  const displayVal = localStr !== null ? localStr : (current === 0 ? "0" : String(current));

  const validateAndCommit = (rawStr: string) => {
    if (rawStr.trim() === "" || !Number.isFinite(Number(rawStr))) {
      if (minVal > 0) {
        toast.warning(`No Relatório 24h, o valor não pode ser menor que o prévio acumulado (${minVal}).`);
        on(minVal);
        setLocalStr(String(minVal));
      } else {
        on(0);
        setLocalStr("0");
      }
      return;
    }
    const parsed = Math.trunc(Number(rawStr));
    const val = Number.isFinite(parsed) && parsed > 0 ? parsed : 0;
    if (minVal > 0 && val < minVal) {
      toast.warning(`No Relatório 24h, o valor não pode ser menor que o prévio acumulado (${minVal}).`);
      on(minVal);
      setLocalStr(String(minVal));
      return;
    }
    on(val);
    setLocalStr(null);
  };

  return (
    <TableCell className="w-24">
      <Input
        type="number"
        min={minVal}
        step={1}
        inputMode="numeric"
        value={displayVal}
        onFocus={(e) => e.target.select()}
        onChange={(e) => {
          const raw = e.target.value;
          const parsed = Math.trunc(Number(raw));
          if (minVal > 0 && (raw === "" || !Number.isFinite(parsed) || parsed < minVal)) {
            toast.warning(`No Relatório 24h, o valor não pode ser menor que o prévio acumulado (${minVal}).`);
            on(minVal);
            setLocalStr(String(minVal));
            return;
          }
          setLocalStr(raw);
          on(parsed > 0 ? parsed : 0);
        }}
        onBlur={(e) => validateAndCommit(e.target.value)}
        disabled={disabled}
        className={cn(
          "text-center transition-colors font-medium",
          isRed &&
            "border-red-500/60 bg-red-50/40 text-red-600 dark:bg-red-950/30 dark:text-red-400 font-bold focus-visible:ring-red-500",
        )}
        title={minVal > 0 ? `Valor acumulado prévio: ${minVal} (piso mínimo imutável)` : undefined}
      />
    </TableCell>
  );
}
