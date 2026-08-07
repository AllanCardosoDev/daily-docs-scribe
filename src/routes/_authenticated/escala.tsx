import { createFileRoute, Link } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { useQuery, useQueryClient, useMutation } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";
import { ArrowLeft, Plus, Pencil, Trash2, Phone, Users, CalendarDays } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
  DialogDescription,
} from "@/components/ui/dialog";
import { Download, RefreshCcw } from "lucide-react";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
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
import { useSheetsDashboard } from "@/hooks/use-sheets";
import {
  listOperators,
  saveOperator,
  deleteOperator,
  listShifts,
  saveShift,
  deleteShift,
} from "@/lib/escala.functions";
import { seedEscala } from "@/lib/seed-escala.functions";
import { exportEscalaPdf } from "@/lib/export-escala-pdf";

function getDefaultShiftTimes(dateStr: string) {
  if (!dateStr) return { start_time: "14:00", end_time: "19:00" };
  const d = new Date(dateStr + "T12:00:00");
  const dayOfWeek = d.getDay(); // 0 = Domingo, 6 = Sábado
  const isWeekend = dayOfWeek === 0 || dayOfWeek === 6;
  if (isWeekend) {
    return { start_time: "07:00", end_time: "19:00" };
  }
  return { start_time: "14:00", end_time: "19:00" };
}

export const Route = createFileRoute("/_authenticated/escala")({
  head: () => ({
    meta: [{ title: "Escala da Sala de Situação · CBMAM" }, { name: "robots", content: "noindex" }],
  }),
  component: EscalaPage,
});

type Operator = {
  id: string;
  rank: string;
  name: string;
  phone: string;
  active: boolean;
  profile_id: string | null;
};

type Shift = {
  id: string;
  shift_date: string;
  start_time: string;
  end_time: string;
  operator_id: string;
  notes: string | null;
};

const WEEK_DAYS = ["DOM", "SEG", "TER", "QUA", "QUI", "SEX", "SÁB"] as const;

/** ISO local (nunca UTC) — evita "pular" um dia em fusos negativos como UTC-4. */
function toISOLocal(d: Date) {
  const p = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`;
}
function todayISO() {
  return toISOLocal(new Date());
}
function addDays(iso: string, n: number) {
  const d = new Date(iso + "T00:00:00");
  d.setDate(d.getDate() + n);
  return toISOLocal(d);
}
function fmtDatePt(iso: string) {
  const [y, m, d] = iso.split("-");
  return `${d}/${m}/${y.slice(2)}`;
}
function trimHM(t: string) {
  return t.slice(0, 5);
}

function EscalaPage() {
  const qc = useQueryClient();
  const { configQuery } = useSheetsDashboard();
  const isAdmin = !!configQuery.data?.isAdmin;

  const listOpsFn = useServerFn(listOperators);
  const listShiftsFn = useServerFn(listShifts);
  const seedFn = useServerFn(seedEscala);

  const seedMutation = useMutation({
    mutationFn: async () => seedFn(),
    onSuccess: () => {
      toast.success("Escala sincronizada com o documento oficial!");
      qc.invalidateQueries({ queryKey: ["escala"] });
    },
    onError: (e: any) => toast.error("Erro ao sincronizar escala", { description: e.message }),
  });

  const [currentMonth, setCurrentMonth] = useState(() => {
    const t = new Date();
    return new Date(t.getFullYear(), t.getMonth(), 1);
  });

  const { rangeFrom, rangeTo } = useMemo(() => {
    const year = currentMonth.getFullYear();
    const month = currentMonth.getMonth();
    const firstDay = new Date(year, month, 1);
    const lastDay = new Date(year, month + 1, 0);
    const startOffset = firstDay.getDay(); // 0 = Sunday
    const endOffset = 6 - lastDay.getDay();
    return {
      rangeFrom: addDays(toISOLocal(firstDay), -startOffset),
      rangeTo: addDays(toISOLocal(lastDay), endOffset),
    };
  }, [currentMonth]);

  const operatorsQuery = useQuery({
    queryKey: ["escala", "operators"],
    queryFn: () => listOpsFn() as Promise<Operator[]>,
  });

  const shiftsQuery = useQuery({
    queryKey: ["escala", "shifts", rangeFrom, rangeTo],
    queryFn: () => listShiftsFn({ data: { from: rangeFrom, to: rangeTo } }) as Promise<Shift[]>,
  });

  const operators = operatorsQuery.data ?? [];
  const shifts = shiftsQuery.data ?? [];
  const opsById = useMemo(() => Object.fromEntries(operators.map((o) => [o.id, o])), [operators]);

  const refresh = () => {
    qc.invalidateQueries({ queryKey: ["escala"] });
  };

  return (
    <div className="min-h-dvh bg-gradient-brand-soft">
      <header className="sticky top-0 z-30 bg-gradient-brand text-white shadow-elevated">
        <div className="w-full max-w-[98%] mx-auto px-4 md:px-6 py-3 md:py-4 flex items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <Button asChild variant="secondary" size="sm" className="gap-2">
              <Link to="/painel">
                <ArrowLeft className="w-4 h-4" /> Painel
              </Link>
            </Button>
            <div className="min-w-0">
              <div className="text-[10px] uppercase tracking-[0.14em] text-white/60 font-semibold">
                CBMAM · Sala de Situação
              </div>
              <h1 className="font-display text-lg md:text-xl font-bold truncate">
                Serviço na Sala de Situação
              </h1>
            </div>
          </div>
          {isAdmin && (
            <Button
              variant="secondary"
              size="sm"
              className="gap-2"
              onClick={() => seedMutation.mutate()}
              disabled={seedMutation.isPending}
            >
              <RefreshCcw className={`w-4 h-4 ${seedMutation.isPending ? "animate-spin" : ""}`} />
              <span className="hidden sm:inline">Sincronizar Oficial</span>
            </Button>
          )}
        </div>
      </header>

      <main className="w-full max-w-[98%] mx-auto px-3 sm:px-4 md:px-6 py-6 space-y-6">
        {!isAdmin && (
          <div className="rounded-lg border bg-amber-50 border-amber-200 text-amber-900 text-sm px-4 py-3">
            Você está visualizando a escala em modo somente leitura. Apenas administradores podem
            editar serviços na sala e operadores.
          </div>
        )}

        <Tabs defaultValue="calendar" className="space-y-4">
          <TabsList>
            <TabsTrigger value="calendar" className="gap-2">
              <CalendarDays className="w-4 h-4" /> Calendário
            </TabsTrigger>
            <TabsTrigger value="operators" className="gap-2">
              <Users className="w-4 h-4" /> Operadores
            </TabsTrigger>
          </TabsList>

          <TabsContent value="calendar">
            <ShiftsView
              shifts={shifts}
              operators={operators}
              opsById={opsById}
              isAdmin={isAdmin}
              onChanged={refresh}
              currentMonth={currentMonth}
              onChangeMonth={setCurrentMonth}
              rangeFrom={rangeFrom}
              rangeTo={rangeTo}
            />
          </TabsContent>

          <TabsContent value="operators">
            <OperatorsView operators={operators} isAdmin={isAdmin} onChanged={refresh} />
          </TabsContent>
        </Tabs>
      </main>
    </div>
  );
}

// -------------------- Shifts --------------------

function ShiftsView({
  shifts,
  operators,
  opsById,
  isAdmin,
  onChanged,
  currentMonth,
  onChangeMonth,
  rangeFrom,
  rangeTo,
}: {
  shifts: Shift[];
  operators: Operator[];
  opsById: Record<string, Operator>;
  isAdmin: boolean;
  onChanged: () => void;
  currentMonth: Date;
  onChangeMonth: (d: Date) => void;
  rangeFrom: string;
  rangeTo: string;
}) {
  const [editing, setEditing] = useState<Shift | null>(null);
  const [creatingDate, setCreatingDate] = useState<string | null>(null);

  const monthLabel = useMemo(() => {
    return currentMonth.toLocaleDateString("pt-BR", {
      month: "long",
      year: "numeric",
    });
  }, [currentMonth]);

  const calendarDays = useMemo(() => {
    const year = currentMonth.getFullYear();
    const month = currentMonth.getMonth();
    const firstDay = new Date(year, month, 1);
    const lastDay = new Date(year, month + 1, 0);
    const startOffset = firstDay.getDay(); // 0 = Sunday
    const endOffset = 6 - lastDay.getDay();

    const days: { date: string; inMonth: boolean }[] = [];
    const totalCells = startOffset + lastDay.getDate() + endOffset;

    for (let i = 0; i < totalCells; i++) {
      const d = new Date(year, month, 1 - startOffset + i);
      days.push({ date: toISOLocal(d), inMonth: d.getMonth() === month });
    }

    // Pad to complete 6 weeks if needed for stable layout
    while (days.length < 42) {
      const last = new Date(days[days.length - 1].date + "T00:00:00");
      last.setDate(last.getDate() + 1);
      days.push({ date: toISOLocal(last), inMonth: false });
    }

    return days;
  }, [currentMonth]);

  const shiftsByDate = useMemo(() => {
    const map = new Map<string, Shift[]>();
    shifts.forEach((s) => {
      const list = map.get(s.shift_date) ?? [];
      list.push(s);
      map.set(s.shift_date, list);
    });
    return map;
  }, [shifts]);

  const goToday = () => onChangeMonth(new Date());
  const goPrev = () =>
    onChangeMonth(new Date(currentMonth.getFullYear(), currentMonth.getMonth() - 1, 1));
  const goNext = () =>
    onChangeMonth(new Date(currentMonth.getFullYear(), currentMonth.getMonth() + 1, 1));

  return (
    <div className="space-y-4">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <h2 className="text-lg font-display font-bold capitalize leading-tight">{monthLabel}</h2>
          <p className="text-sm text-muted-foreground">
            Exibindo serviços na sala de <strong>{fmtDatePt(rangeFrom)}</strong> a{" "}
            <strong>{fmtDatePt(rangeTo)}</strong>.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="outline" size="sm" onClick={goPrev}>
            ←
          </Button>
          <Button variant="outline" size="sm" onClick={goToday}>
            Hoje
          </Button>
          <Button variant="outline" size="sm" onClick={goNext}>
            →
          </Button>
          <Button
            variant="outline"
            size="sm"
            onClick={() => exportEscalaPdf({ currentMonth, operators, shifts })}
            className="gap-2 bg-emerald-950/40 border-emerald-700 text-emerald-100 hover:bg-emerald-800 font-medium"
            title="Gerar PDF oficial com o calendário e relação de militares escalados"
          >
            <Download className="w-4 h-4 text-emerald-400" /> Imprimir Calendário PDF
          </Button>
          {isAdmin && (
            <Button
              size="sm"
              className="gap-2"
              onClick={() => setCreatingDate(todayISO())}
              disabled={operators.length === 0}
            >
              <Plus className="w-4 h-4" /> Novo serviço na sala
            </Button>
          )}
        </div>
      </div>

      {operators.length === 0 && (
        <div className="rounded-lg border bg-muted/40 text-sm px-4 py-3">
          Cadastre operadores na aba <strong>Operadores</strong> antes de criar serviços na sala.
        </div>
      )}

      <div className="rounded-xl border bg-card p-2 sm:p-4 shadow-sm">
        {/* Weekday headers */}
        <div className="grid grid-cols-7 gap-1 mb-2">
          {WEEK_DAYS.map((d) => (
            <div
              key={d}
              className="text-center text-[10px] sm:text-xs font-semibold uppercase tracking-wider text-muted-foreground py-1"
            >
              {d}
            </div>
          ))}
        </div>

        {/* Calendar grid */}
        <div className="grid grid-cols-7 gap-1 sm:gap-2">
          {calendarDays.map((day) => {
            const isToday = day.date === todayISO();
            const dayShifts = shiftsByDate.get(day.date) ?? [];
            const dateNum = new Date(day.date + "T00:00:00").getDate();
            const dateObj = new Date(day.date + "T12:00:00");
            const isWeekend = dateObj.getDay() === 0 || dateObj.getDay() === 6;

            return (
              <div
                key={day.date}
                onClick={() => isAdmin && day.inMonth && setCreatingDate(day.date)}
                className={`
                  relative min-h-[5.5rem] sm:min-h-[7rem] rounded-lg border p-1.5 sm:p-2 flex flex-col gap-1
                  transition-colors
                  ${day.inMonth ? (isWeekend ? "bg-red-50/30" : "bg-background") : "bg-muted/30 text-muted-foreground"}
                  ${isToday ? "border-primary ring-1 ring-primary/30 bg-primary/5" : "border-border"}
                  ${isAdmin && day.inMonth ? "hover:bg-accent/40 cursor-pointer" : ""}
                `}
              >
                <div className="flex items-center justify-between gap-1">
                  <span
                    className={`
                      text-xs sm:text-sm font-semibold w-6 h-6 sm:w-7 sm:h-7 flex items-center justify-center rounded-full
                      ${isToday ? "bg-primary text-primary-foreground" : ""}
                    `}
                  >
                    {dateNum}
                  </span>
                  {isAdmin && day.inMonth && (
                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        setCreatingDate(day.date);
                      }}
                      className="opacity-0 group-hover:opacity-100 focus:opacity-100 hover:text-primary text-muted-foreground"
                      title="Adicionar serviço na sala"
                    >
                      <Plus className="w-3.5 h-3.5" />
                    </button>
                  )}
                </div>

                <div className="flex flex-col gap-1 flex-1 min-h-0">
                  {dayShifts.length === 0 && day.inMonth && (
                    <span className="text-[10px] sm:text-xs text-muted-foreground/70 italic mt-auto">
                      Sem serviço na sala
                    </span>
                  )}
                  {dayShifts.map((s) => {
                    const op = opsById[s.operator_id];
                    return (
                      <button
                        key={s.id}
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          if (isAdmin) setEditing(s);
                        }}
                        className={`
                          text-left rounded-md border px-1.5 py-1 text-[10px] sm:text-xs leading-tight
                          bg-primary/10 border-primary/30 hover:bg-primary/20
                          ${isAdmin ? "cursor-pointer" : "cursor-default"}
                        `}
                      >
                        <div className="font-semibold truncate">
                          {op ? `${op.rank ? op.rank + " " : ""}${op.name}` : "—"}
                        </div>
                        {op?.phone && (
                          <div className="text-[9px] text-muted-foreground/80 flex items-center gap-1">
                            <Phone className="w-2.5 h-2.5" /> {op.phone}
                          </div>
                        )}
                        <div className="text-[10px] text-muted-foreground whitespace-nowrap">
                          {trimHM(s.start_time)}–{trimHM(s.end_time)}
                        </div>
                      </button>
                    );
                  })}
                </div>
              </div>
            );
          })}
        </div>
      </div>

      <ShiftDialog
        open={!!editing || !!creatingDate}
        initial={useMemo(
          () => {
            if (editing) return editing;
            if (creatingDate) {
              const def = getDefaultShiftTimes(creatingDate);
              return {
                id: undefined as unknown as string,
                shift_date: creatingDate,
                start_time: def.start_time,
                end_time: def.end_time,
                operator_id: operators[0]?.id ?? "",
                notes: "",
              };
            }
            return null;
          },
          // Stable identity while the dialog is open — prevents a background
          // refetch from wiping in-progress form input via useMemoSync.
          [editing, creatingDate, operators],
        )}
        operators={operators}
        onClose={() => {
          setEditing(null);
          setCreatingDate(null);
        }}
        onSaved={() => {
          onChanged();
          setEditing(null);
          setCreatingDate(null);
        }}
      />
    </div>
  );
}

function ShiftDialog({
  open,
  initial,
  operators,
  onClose,
  onSaved,
}: {
  open: boolean;
  initial:
    | (Partial<Shift> & {
        shift_date: string;
        start_time: string;
        end_time: string;
        operator_id: string;
        notes: string | null;
      })
    | null;
  operators: Operator[];
  onClose: () => void;
  onSaved: () => void;
}) {
  const saveFn = useServerFn(saveShift);
  const delFn = useServerFn(deleteShift);
  const isEdit = !!initial?.id;

  const [date, setDate] = useState(initial?.shift_date ?? todayISO());
  const [start, setStart] = useState(trimHM(initial?.start_time ?? "14:00"));
  const [end, setEnd] = useState(trimHM(initial?.end_time ?? "19:00"));
  const [operatorId, setOperatorId] = useState(initial?.operator_id ?? "");
  const [notes, setNotes] = useState(initial?.notes ?? "");

  // Sync when initial changes
  useMemoSync(initial, () => {
    if (!initial) return;
    setDate(initial.shift_date);
    setStart(trimHM(initial.start_time));
    setEnd(trimHM(initial.end_time));
    setOperatorId(initial.operator_id);
    setNotes(initial.notes ?? "");
  });

  const handleDateChange = (newDate: string) => {
    setDate(newDate);
    if (!isEdit && newDate) {
      const def = getDefaultShiftTimes(newDate);
      setStart(def.start_time);
      setEnd(def.end_time);
    }
  };

  const save = useMutation({
    mutationFn: async () =>
      saveFn({
        data: {
          id: initial?.id,
          shift_date: date,
          start_time: start,
          end_time: end,
          operator_id: operatorId,
          notes: notes || null,
        },
      }),
    onSuccess: () => {
      toast.success(isEdit ? "Serviço na sala atualizado" : "Serviço na sala criado");
      onSaved();
    },
    onError: (e: any) => toast.error("Erro ao salvar", { description: e.message }),
  });

  const del = useMutation({
    mutationFn: async () => delFn({ data: { id: initial!.id! } }),
    onSuccess: () => {
      toast.success("Serviço na sala removido");
      onSaved();
    },
    onError: (e: any) => toast.error("Erro ao remover", { description: e.message }),
  });

  if (!initial) return null;

  return (
    <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{isEdit ? "Editar serviço na sala" : "Novo serviço na sala"}</DialogTitle>
          <DialogDescription>Defina data, horário e operador de serviço.</DialogDescription>
        </DialogHeader>

        <div className="grid gap-3">
          <div className="grid gap-1.5">
            <Label htmlFor="date">Data</Label>
            <Input id="date" type="date" value={date} onChange={(e) => handleDateChange(e.target.value)} />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="grid gap-1.5">
              <Label htmlFor="start">Início</Label>
              <Input
                id="start"
                type="time"
                value={start}
                onChange={(e) => setStart(e.target.value)}
              />
            </div>
            <div className="grid gap-1.5">
              <Label htmlFor="end">Término</Label>
              <Input id="end" type="time" value={end} onChange={(e) => setEnd(e.target.value)} />
            </div>
          </div>
          <div className="grid gap-1.5">
            <Label>Operador</Label>
            <Select value={operatorId} onValueChange={setOperatorId}>
              <SelectTrigger>
                <SelectValue placeholder="Selecione o operador" />
              </SelectTrigger>
              <SelectContent>
                {operators
                  .filter((o) => o.active || o.id === operatorId)
                  .map((o) => (
                    <SelectItem key={o.id} value={o.id}>
                      {o.rank ? `${o.rank} ` : ""}
                      {o.name}
                      {o.phone ? ` · ${o.phone}` : ""}
                    </SelectItem>
                  ))}
              </SelectContent>
            </Select>
          </div>
          <div className="grid gap-1.5">
            <Label htmlFor="notes">Observações</Label>
            <Input
              id="notes"
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="Opcional"
              maxLength={500}
            />
          </div>
        </div>

        <DialogFooter className="gap-2 sm:justify-between">
          <div>
            {isEdit && (
              <Button
                variant="destructive"
                size="sm"
                onClick={() => del.mutate()}
                disabled={del.isPending}
              >
                <Trash2 className="w-4 h-4 mr-1" /> Remover
              </Button>
            )}
          </div>
          <div className="flex gap-2">
            <Button variant="outline" onClick={onClose}>
              Cancelar
            </Button>
            <Button onClick={() => save.mutate()} disabled={save.isPending || !operatorId}>
              Salvar
            </Button>
          </div>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// -------------------- Operators --------------------

function OperatorsView({
  operators,
  isAdmin,
  onChanged,
}: {
  operators: Operator[];
  isAdmin: boolean;
  onChanged: () => void;
}) {
  const [editing, setEditing] = useState<Operator | null>(null);
  const [creating, setCreating] = useState(false);
  const delFn = useServerFn(deleteOperator);

  const del = useMutation({
    mutationFn: async (id: string) => delFn({ data: { id } }),
    onSuccess: () => {
      toast.success("Operador removido");
      onChanged();
    },
    onError: (e: any) =>
      toast.error("Erro ao remover", {
        description: e.message.includes("violates foreign key")
          ? "Este operador possui serviços na sala vinculados."
          : e.message,
      }),
  });

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between gap-3">
        <p className="text-sm text-muted-foreground">
          {operators.length} {operators.length === 1 ? "operador" : "operadores"} cadastrado
          {operators.length === 1 ? "" : "s"}.
        </p>
        {isAdmin && (
          <Button size="sm" className="gap-2" onClick={() => setCreating(true)}>
            <Plus className="w-4 h-4" /> Novo operador
          </Button>
        )}
      </div>

      <div className="rounded-xl border bg-card overflow-x-auto">
        <Table className="min-w-[38rem]">
          <TableHeader>
            <TableRow>
              <TableHead className="w-28 whitespace-nowrap">Posto/Grad.</TableHead>
              <TableHead className="min-w-[10rem]">Nome</TableHead>
              <TableHead className="w-40 whitespace-nowrap">Telefone</TableHead>
              <TableHead className="w-24 whitespace-nowrap">Status</TableHead>
              {isAdmin && (
                <TableHead className="w-24 text-right whitespace-nowrap">Ações</TableHead>
              )}
            </TableRow>
          </TableHeader>

          <TableBody>
            {operators.length === 0 && (
              <TableRow>
                <TableCell
                  colSpan={isAdmin ? 5 : 4}
                  className="text-center text-muted-foreground py-8"
                >
                  Nenhum operador cadastrado.
                </TableCell>
              </TableRow>
            )}
            {operators.map((o) => (
              <TableRow key={o.id}>
                <TableCell className="font-mono text-xs">{o.rank || "—"}</TableCell>
                <TableCell className="font-medium">{o.name}</TableCell>
                <TableCell>{o.phone || "—"}</TableCell>
                <TableCell>
                  {o.active ? (
                    <Badge variant="secondary" className="bg-primary/15 text-primary">
                      Ativo
                    </Badge>
                  ) : (
                    <Badge variant="outline">Inativo</Badge>
                  )}
                </TableCell>
                {isAdmin && (
                  <TableCell className="text-right">
                    <div className="flex justify-end gap-1">
                      <Button size="icon" variant="ghost" onClick={() => setEditing(o)}>
                        <Pencil className="w-4 h-4" />
                      </Button>
                      <Button
                        size="icon"
                        variant="ghost"
                        className="text-destructive"
                        onClick={() => {
                          if (confirm(`Remover ${o.name}?`)) del.mutate(o.id);
                        }}
                      >
                        <Trash2 className="w-4 h-4" />
                      </Button>
                    </div>
                  </TableCell>
                )}
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>

      <OperatorDialog
        open={!!editing || creating}
        initial={editing}
        onClose={() => {
          setEditing(null);
          setCreating(false);
        }}
        onSaved={() => {
          onChanged();
          setEditing(null);
          setCreating(false);
        }}
      />
    </div>
  );
}

function OperatorDialog({
  open,
  initial,
  onClose,
  onSaved,
}: {
  open: boolean;
  initial: Operator | null;
  onClose: () => void;
  onSaved: () => void;
}) {
  const saveFn = useServerFn(saveOperator);
  const isEdit = !!initial;
  const [rank, setRank] = useState(initial?.rank ?? "");
  const [name, setName] = useState(initial?.name ?? "");
  const [phone, setPhone] = useState(initial?.phone ?? "");
  const [active, setActive] = useState(initial?.active ?? true);

  useMemoSync(initial, () => {
    setRank(initial?.rank ?? "");
    setName(initial?.name ?? "");
    setPhone(initial?.phone ?? "");
    setActive(initial?.active ?? true);
  });

  const save = useMutation({
    mutationFn: async () =>
      saveFn({
        data: {
          id: initial?.id,
          rank,
          name,
          phone,
          active,
        },
      }),
    onSuccess: () => {
      toast.success(isEdit ? "Operador atualizado" : "Operador cadastrado");
      onSaved();
    },
    onError: (e: any) => toast.error("Erro ao salvar", { description: e.message }),
  });

  return (
    <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{isEdit ? "Editar operador" : "Novo operador"}</DialogTitle>
          <DialogDescription>
            Cadastre o operador da Sala de Situação. Exemplo: SGT SIMONE · (92) 98425-9853.
          </DialogDescription>
        </DialogHeader>
        <div className="grid gap-3">
          <div className="grid gap-1.5">
            <Label htmlFor="rank">Posto / Graduação</Label>
            <Input
              id="rank"
              value={rank}
              onChange={(e) => setRank(e.target.value.toUpperCase())}
              placeholder="Ex: SGT, SD, CAP"
              maxLength={50}
            />
          </div>
          <div className="grid gap-1.5">
            <Label htmlFor="name">Nome de guerra</Label>
            <Input
              id="name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Ex: SIMONE"
              maxLength={120}
            />
          </div>
          <div className="grid gap-1.5">
            <Label htmlFor="phone">Telefone</Label>
            <Input
              id="phone"
              value={phone}
              onChange={(e) => setPhone(e.target.value)}
              placeholder="Ex: (92) 98425-9853"
              maxLength={30}
            />
          </div>
          <div className="flex items-center justify-between rounded-md border p-3">
            <div>
              <Label className="text-sm">Operador ativo</Label>
              <p className="text-xs text-muted-foreground">
                Operadores inativos não aparecem na escolha de serviços na sala.
              </p>
            </div>
            <Switch checked={active} onCheckedChange={setActive} />
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={onClose}>
            Cancelar
          </Button>
          <Button onClick={() => save.mutate()} disabled={save.isPending || !name.trim()}>
            Salvar
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// Small helper to re-init local state when the "initial" prop identity changes.
import { useEffect, useRef } from "react";
function useMemoSync(dep: unknown, fn: () => void) {
  const ref = useRef(dep);
  useEffect(() => {
    if (ref.current !== dep) {
      ref.current = dep;
      fn();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [dep]);
}
