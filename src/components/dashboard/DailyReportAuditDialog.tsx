import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { ShieldCheck, Loader2, User, ArrowRight } from "lucide-react";
import { getDailyReportAudit } from "@/lib/daily-reports.functions";
import { SHIFT_LABEL, type ReportShift } from "@/lib/report-shift";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";

const stamp = new Intl.DateTimeFormat("pt-BR", {
  dateStyle: "short",
  timeStyle: "medium",
});

/**
 * Admin-only audit trail for a single report date: shows every save, the
 * responsible operator, and the exact fields changed (before → after).
 */
export function DailyReportAuditDialog({
  date,
  shift = "noturno",
}: {
  date: string;
  shift?: ReportShift;
}) {
  const [open, setOpen] = useState(false);
  const auditFn = useServerFn(getDailyReportAudit);

  const q = useQuery({
    queryKey: ["daily-report-audit", date, shift],
    queryFn: () => auditFn({ data: { date, shift } }),
    enabled: open,
    staleTime: 10_000,
  });

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant="outline" className="h-10 gap-2">
          <ShieldCheck className="w-4 h-4 shrink-0 text-primary" aria-hidden="true" />
          <span className="truncate">Auditoria do dia</span>
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-3xl max-h-[85dvh] flex flex-col overflow-hidden">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <ShieldCheck className="w-4 h-4 text-primary" aria-hidden="true" />
            Auditoria — {date.split("-").reverse().join("/")}
          </DialogTitle>
          <DialogDescription>
            {SHIFT_LABEL[shift]} · visível apenas para administradores. Cada alteração feita pelo
            militar de serviço na sala, com valor anterior e valor novo.
          </DialogDescription>
        </DialogHeader>

        <div className="flex-1 overflow-y-auto -mx-6 px-6 space-y-4">
          {q.isLoading && (
            <div className="flex items-center justify-center py-10 text-sm text-muted-foreground">
              <Loader2 className="w-4 h-4 mr-2 animate-spin" /> Carregando…
            </div>
          )}

          {q.isError && (
            <div className="py-6 text-sm text-destructive">{(q.error as Error).message}</div>
          )}

          {q.data && q.data.length === 0 && (
            <div className="py-10 text-center text-sm text-muted-foreground">
              Nenhuma alteração registrada para esta data.
            </div>
          )}

          {q.data?.map((entry) => (
            <article
              key={entry.id}
              className="rounded-xl border border-border bg-card p-4 shadow-sm"
            >
              <header className="flex flex-wrap items-center justify-between gap-2">
                <div className="flex items-center gap-2">
                  <Badge variant="secondary" className="tabular-nums">
                    v{entry.version}
                  </Badge>
                  <Badge variant={entry.operation === "insert" ? "default" : "outline"}>
                    {entry.operation === "insert" ? "Criação" : "Alteração"}
                  </Badge>
                  <span className="inline-flex items-center gap-1.5 text-sm font-medium">
                    <User className="w-3.5 h-3.5 text-muted-foreground" aria-hidden="true" />
                    {entry.author || (
                      <span className="italic text-muted-foreground">não identificado</span>
                    )}
                  </span>
                </div>
                <span className="text-xs text-muted-foreground tabular-nums">
                  {stamp.format(new Date(entry.changedAt))}
                </span>
              </header>

              {entry.changes.length === 0 ? (
                <p className="mt-3 text-xs text-muted-foreground">
                  Salvamento sem mudança de valores.
                </p>
              ) : (
                <ul className="mt-3 space-y-1.5">
                  {entry.changes.map((c, i) => (
                    <li
                      key={i}
                      className="flex flex-wrap items-center gap-x-2 gap-y-1 rounded-lg bg-muted/50 px-3 py-2 text-sm"
                    >
                      <span className="text-[11px] uppercase tracking-wider font-semibold text-muted-foreground">
                        {c.section}
                      </span>
                      <span className="font-medium">{c.row}</span>
                      <span className="text-muted-foreground">· {c.field}</span>
                      <span className="ml-auto flex items-center gap-2 tabular-nums">
                        <span className="rounded bg-destructive/10 text-destructive px-1.5 py-0.5 line-through">
                          {c.before}
                        </span>
                        <ArrowRight
                          className="w-3.5 h-3.5 text-muted-foreground"
                          aria-hidden="true"
                        />
                        <span className="rounded bg-primary/15 text-primary font-semibold px-1.5 py-0.5">
                          {c.after}
                        </span>
                      </span>
                    </li>
                  ))}
                </ul>
              )}
            </article>
          ))}
        </div>
      </DialogContent>
    </Dialog>
  );
}
