import { createFileRoute, Link } from "@tanstack/react-router";
import { manausFirst } from "@/lib/municipio-order";
import { useEffect, useMemo, useRef, useState } from "react";
import { keepPreviousData, useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";
import { ArrowLeft, Save, Plus, Trash2, CalendarDays, Lock } from "lucide-react";
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
import { getDailyReport, saveDailyReport } from "@/lib/daily-reports.functions";
import { SHIFTS, SHIFT_LABEL, SHIFT_TAB, type ReportShift } from "@/lib/report-shift";
import { DailyReportAuditDialog } from "@/components/dashboard/DailyReportAuditDialog";
import { DriveImportDialog } from "@/components/dashboard/DriveImportDialog";
import { MunicipioPicker } from "@/components/dashboard/MunicipiosDialog";
import { DailyReportExportCard } from "@/components/dashboard/DailyReportExportCard";
import {
  DadosComplementaresForm,
  type DadosComplementaresState,
} from "@/components/dashboard/DadosComplementaresForm";

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
type EfetivoRow = { mun: string; ord: number; seg: number; brig: number };
type RecursoRow = { mun: string; viaturas: number; aeronaves: number; embarcacoes: number };
type IncendioRow = { mun: string; urb: number; flor: number; focos: number };
type OutraRow = {
  mun: string;
  salvamento: number;
  acidentes: number;
  aph: number;
  prevencao: number;
  servicos: number;
};

const EFETIVO_EMPTY: EfetivoRow = { mun: "", ord: 0, seg: 0, brig: 0 };
const RECURSO_EMPTY: RecursoRow = { mun: "", viaturas: 0, aeronaves: 0, embarcacoes: 0 };
const INCENDIO_EMPTY: IncendioRow = { mun: "", urb: 0, flor: 0, focos: 0 };
const OUTRA_EMPTY: OutraRow = {
  mun: "",
  salvamento: 0,
  acidentes: 0,
  aph: 0,
  prevencao: 0,
  servicos: 0,
};

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

  const q = useQuery({
    queryKey: ["daily-report", date, shift],
    queryFn: () => getFn({ data: { date, shift } }),
    // Mantém os dados anteriores visíveis ao trocar de data/turno,
    // evitando o "pisca" de tela em branco a cada consulta.
    placeholderData: keepPreviousData,
    staleTime: 30_000,
  });

  const [efetivo, setEfetivo] = useState<EfetivoRow[]>([]);
  const [recursos, setRecursos] = useState<RecursoRow[]>([]);
  const [incendios, setIncendios] = useState<IncendioRow[]>([]);
  const [outras, setOutras] = useState<OutraRow[]>([]);
  const [dadosComplementares, setDadosComplementares] = useState<DadosComplementaresState>({});
  const [notes, setNotes] = useState<string>("");

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

  // Enquanto `placeholderData` mantém o resultado da data anterior na tela,
  // o formulário é limpo — assim o usuário nunca salva dados de outro dia
  // na data recém-selecionada.
  useEffect(() => {
    const key = `${date}|${shift}`;
    const switchedReport = key !== loadedKeyRef.current;
    // Só sobrescreve o formulário quando muda de relatório ou não há rascunho.
    if (!switchedReport && dirtyRef.current) return;
    if (q.isPlaceholderData) {
      setEfetivo([]);
      setRecursos([]);
      setIncendios([]);
      setOutras([]);
      setDadosComplementares({});
      setNotes("");
      return;
    }
    const row: any = q.data?.row;
    // Manaus (capital) sempre na primeira linha de todas as seções.
    setEfetivo(manausFirst((row?.efetivo as EfetivoRow[]) ?? []));
    setRecursos(manausFirst((row?.recursos as RecursoRow[]) ?? []));
    setIncendios(manausFirst((row?.incendios as IncendioRow[]) ?? []));
    setOutras(manausFirst((row?.outras as OutraRow[]) ?? []));
    setDadosComplementares((row?.dados_complementares as DadosComplementaresState) ?? {});
    setNotes(row?.notes ?? "");
    loadedKeyRef.current = key;
    dirtyRef.current = false;
  }, [date, shift, q.isPlaceholderData, q.data?.row?.id, q.data?.row?.updated_at]);

  const canEdit = !!q.data?.canEdit;

  /** Municípios já presentes em qualquer seção do registro. */
  const municipiosNoRegistro = useMemo(() => {
    const s = new Set<string>();
    for (const r of efetivo) if (r.mun) s.add(r.mun);
    for (const r of recursos) if (r.mun) s.add(r.mun);
    for (const r of incendios) if (r.mun) s.add(r.mun);
    for (const r of outras) if (r.mun) s.add(r.mun);
    return Array.from(s);
  }, [efetivo, recursos, incendios, outras]);

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
    if (!has(outras)) {
      setOutras((p) => [...p, { ...OUTRA_EMPTY, mun: name }]);
      added = true;
    }
    toast[added ? "success" : "info"](
      added
        ? `${name} incluído em todas as seções. Preencha os dados e salve.`
        : `${name} já está em todas as seções.`,
    );
  }

  const save = useMutation({
    mutationFn: () =>
      saveFn({
        data: {
          report_date: date,
          shift,
          efetivo,
          recursos: recursos as any,
          incendios,
          outras,
          dados_complementares: dadosComplementares as any,
          notes,
        },
      }),
    onSuccess: () => {
      dirtyRef.current = false;
      toast.success("Registro salvo.");
      qc.invalidateQueries({ queryKey: ["daily-report", date, shift] });
      qc.invalidateQueries({ queryKey: ["daily-reports"] });
    },
    onError: (e: any) => toast.error("Falha ao salvar", { description: e?.message }),
  });

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
        <section className="rounded-xl bg-card shadow-elevated p-4 sm:p-5">
          <div className="flex flex-col lg:flex-row lg:items-end gap-3">
            <div className="flex-1 min-w-0">
              <Label htmlFor="report-date">Data do serviço na sala</Label>
              <Input
                id="report-date"
                type="date"
                value={date}
                onChange={(e) => {
                  if (confirmDiscard()) {
                    dirtyRef.current = false;
                    setDate(e.target.value);
                  }
                }}
                className="mt-1 w-full sm:max-w-xs"
              />
              <p className="text-xs text-muted-foreground mt-1 capitalize">{dateLabel}</p>
            </div>

            <div className="flex-1 min-w-0">
              <Label>Relatório</Label>
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
              {q.data?.isAdmin && <DailyReportAuditDialog date={date} shift={shift} />}

              <DriveImportDialog
                disabled={!canEdit}
                onImported={(d, s) => {
                  dirtyRef.current = false;
                  loadedKeyRef.current = "";
                  setDate(d);
                  setShift(s);
                }}
              />

              {!canEdit && (
                <Badge variant="secondary" className="gap-1.5 justify-center">
                  <Lock className="w-3 h-3" /> Somente leitura
                </Badge>
              )}

              <Button
                onClick={() => save.mutate()}
                disabled={!canEdit || save.isPending || q.isPlaceholderData || q.isLoading}
                className="gap-2"
              >
                <Save className="w-4 h-4" />
                {save.isPending ? "Salvando…" : "Salvar registro"}
              </Button>
            </div>
          </div>

          <div className="mt-4 pt-4 border-t border-border">
            <MunicipioPicker
              isAdmin={!!q.data?.isAdmin}
              disabled={!canEdit}
              existing={municipiosNoRegistro}
              onAdd={addMunicipio}
            />
            <p className="text-xs text-muted-foreground mt-2">
              Ao incluir, o município é adicionado em Efetivo, Recursos, Incêndios e Ocorrências
              para preenchimento dos dados.
            </p>
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
            <TabsTrigger value="outras">Ocorrências</TabsTrigger>
            <TabsTrigger value="complementares">Dados Complementares (API)</TabsTrigger>
            <TabsTrigger value="notas">Observações</TabsTrigger>
          </TabsList>

          <TabsContent value="efetivo">
            <SectionTable
              title="Efetivo empenhado"
              headers={["Município", "Ordinário", "Segurança", "Brigada", ""]}
              rows={efetivo}
              onChange={mark(setEfetivo)}
              empty={EFETIVO_EMPTY}
              canEdit={canEdit}
              renderCells={(r, patch) => (
                <>
                  <TableCell>
                    <Input
                      value={r.mun}
                      onChange={(e) => patch({ mun: e.target.value })}
                      disabled={!canEdit}
                    />
                  </TableCell>
                  <NumCell v={r.ord} on={(v) => patch({ ord: v })} disabled={!canEdit} />
                  <NumCell v={r.seg} on={(v) => patch({ seg: v })} disabled={!canEdit} />
                  <NumCell v={r.brig} on={(v) => patch({ brig: v })} disabled={!canEdit} />
                </>
              )}
            />
          </TabsContent>

          <TabsContent value="recursos">
            <SectionTable
              title="Recursos empregados"
              headers={["Município", "Viaturas", "Aeronaves", "Embarcações", ""]}
              rows={recursos}
              onChange={mark(setRecursos)}
              empty={RECURSO_EMPTY}
              canEdit={canEdit}
              renderCells={(r, patch) => (
                <>
                  <TableCell>
                    <Input
                      value={r.mun}
                      onChange={(e) => patch({ mun: e.target.value })}
                      disabled={!canEdit}
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
              empty={INCENDIO_EMPTY}
              canEdit={canEdit}
              renderCells={(r, patch) => (
                <>
                  <TableCell>
                    <Input
                      value={r.mun}
                      onChange={(e) => patch({ mun: e.target.value })}
                      disabled={!canEdit}
                    />
                  </TableCell>
                  <NumCell v={r.urb} on={(v) => patch({ urb: v })} disabled={!canEdit} />
                  <NumCell v={r.flor} on={(v) => patch({ flor: v })} disabled={!canEdit} />
                  <NumCell v={r.focos} on={(v) => patch({ focos: v })} disabled={!canEdit} />
                </>
              )}
            />
          </TabsContent>

          <TabsContent value="outras">
            <SectionTable
              title="Ocorrências (do dia)"
              headers={["Município", "Salvamento", "Acidentes", "APH", "Prevenção", "Serviços", ""]}
              rows={outras}
              onChange={mark(setOutras)}
              empty={OUTRA_EMPTY}
              canEdit={canEdit}
              renderCells={(r, patch) => (
                <>
                  <TableCell>
                    <Input
                      value={r.mun}
                      onChange={(e) => patch({ mun: e.target.value })}
                      disabled={!canEdit}
                    />
                  </TableCell>
                  <NumCell
                    v={r.salvamento}
                    on={(v) => patch({ salvamento: v })}
                    disabled={!canEdit}
                  />
                  <NumCell
                    v={r.acidentes}
                    on={(v) => patch({ acidentes: v })}
                    disabled={!canEdit}
                  />
                  <NumCell v={r.aph} on={(v) => patch({ aph: v })} disabled={!canEdit} />
                  <NumCell
                    v={r.prevencao}
                    on={(v) => patch({ prevencao: v })}
                    disabled={!canEdit}
                  />
                  <NumCell v={r.servicos} on={(v) => patch({ servicos: v })} disabled={!canEdit} />
                </>
              )}
            />
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

        <DailyReportExportCard
          date={date}
          shift={shift}
          row={{ efetivo, recursos, incendios, outras, notes }}
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
  renderCells: (row: T, patch: (p: Partial<T>) => void) => React.ReactNode;
}) {
  const { title, headers, rows, onChange, empty, canEdit, renderCells } = props;
  return (
    <div className="rounded-xl bg-card shadow-elevated p-4 sm:p-5 space-y-3">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h2 className="font-semibold text-base min-w-0">{title}</h2>
        <Button
          size="sm"
          variant="outline"
          disabled={!canEdit}
          onClick={() => onChange([...rows, { ...empty }])}
          className="gap-1.5 shrink-0"
        >
          <Plus className="w-4 h-4" /> <span className="hidden xs:inline">Adicionar linha</span>
          <span className="xs:hidden">Adicionar</span>
        </Button>
      </div>
      <div className="-mx-4 sm:-mx-5 overflow-x-auto px-4 sm:px-5">
        <Table className="min-w-[36rem]">
          <TableHeader>
            <TableRow>
              {headers.map((h, i) => (
                <TableHead key={i} className="whitespace-nowrap">
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
                        onClick={() => onChange(rows.filter((_, i) => i !== idx))}
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

function NumCell({ v, on, disabled }: { v: number; on: (v: number) => void; disabled?: boolean }) {
  return (
    <TableCell className="w-24">
      <Input
        type="number"
        min={0}
        step={1}
        inputMode="numeric"
        value={Number.isFinite(v) ? v : 0}
        onChange={(e) => {
          // Nunca envia NaN nem negativo — o servidor rejeita valores < 0.
          const n = Math.trunc(Number(e.target.value));
          on(Number.isFinite(n) && n > 0 ? n : 0);
        }}
        disabled={disabled}
      />
    </TableCell>
  );
}
