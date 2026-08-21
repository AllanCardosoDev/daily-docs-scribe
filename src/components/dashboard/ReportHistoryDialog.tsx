import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { listReportHistory } from "@/lib/sheets.functions";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogTrigger,
} from "@/components/ui/dialog";
import { History, Loader2, User } from "lucide-react";

const dateFmt = new Intl.DateTimeFormat("pt-BR", {
  dateStyle: "short",
  timeStyle: "medium",
});

/** History drawer/dialog — shows the last 50 saves of the report. */
export function ReportHistoryDialog({ reportDate }: { reportDate?: Date | null }) {
  const [open, setOpen] = useState(false);
  const listFn = useServerFn(listReportHistory);
  const restoreFn = useServerFn(import("@/lib/sheets.functions").then(m => m.restoreReportVersion));

  const dateIso = reportDate?.toISOString().split("T")[0];

  const query = useQuery({
    queryKey: ["report-history", dateIso],
    queryFn: () => listFn({ data: { reportDate: dateIso } }),
    enabled: open,
    staleTime: 15_000,
  });

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant="outline" className="h-11 sm:h-10" aria-label="Ver histórico de alterações">
          <History className="w-4 h-4 mr-2" /> Histórico
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-2xl max-h-[85dvh] overflow-hidden flex flex-col">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <History className="w-4 h-4 text-primary" aria-hidden="true" />
            Histórico de alterações
          </DialogTitle>
          <DialogDescription>
            Registro de auditoria — quem alterou o relatório e quando. Últimas 50 versões.
          </DialogDescription>
        </DialogHeader>

        <div className="flex-1 overflow-y-auto -mx-6 px-6">
          {query.isLoading && (
            <div className="flex items-center justify-center py-10 text-muted-foreground text-sm">
              <Loader2 className="w-4 h-4 mr-2 animate-spin" /> Carregando…
            </div>
          )}

          {query.isError && (
            <div className="py-6 text-sm text-red-600">
              Falha ao carregar o histórico: {(query.error as Error).message}
            </div>
          )}

          {query.data && query.data.length === 0 && (
            <div className="py-10 text-center text-sm text-muted-foreground">
              Nenhuma alteração registrada ainda.
            </div>
          )}

          {query.data && query.data.length > 0 && (
            <ol className="relative border-l border-border ml-2 space-y-4 py-2">
              {query.data.map((entry) => (
                <li key={entry.id} className="pl-5 relative">
                  <span
                    aria-hidden="true"
                    className="absolute -left-[7px] top-1.5 w-3 h-3 rounded-full bg-primary ring-4 ring-card"
                  />
                  <div className="rounded-lg border border-border bg-card p-3 hover:border-primary/40 transition-colors">
                    <div className="flex items-center justify-between gap-2 flex-wrap">
                      <span className="inline-flex items-center rounded-full bg-primary/10 text-primary text-[11px] font-semibold px-2 py-0.5 border border-primary/20">
                        v{entry.version}
                      </span>
                      <span className="text-xs text-muted-foreground tabular-nums">
                        {dateFmt.format(new Date(entry.updatedAt))}
                      </span>
                    </div>
                    <div className="mt-2 flex items-center gap-1.5 text-sm text-foreground">
                      <User className="w-3.5 h-3.5 text-muted-foreground/70" aria-hidden="true" />
                      <span className="truncate">
                        {entry.updatedByEmail || (
                          <span className="text-muted-foreground/70 italic">
                            usuário desconhecido
                          </span>
                        )}
                      </span>
                    </div>
                    <div className="mt-2 flex items-center justify-between gap-4">
                      <div className="flex items-center gap-1.5 text-sm text-foreground truncate">
                        <User className="w-3.5 h-3.5 text-muted-foreground/70" aria-hidden="true" />
                        <span className="truncate">
                          {entry.updatedByEmail || (
                            <span className="text-muted-foreground/70 italic">
                              usuário desconhecido
                            </span>
                          )}
                        </span>
                      </div>
                      <Button
                        size="sm"
                        variant="ghost"
                        className="h-7 text-[10px] font-bold uppercase hover:bg-primary/10 hover:text-primary"
                        onClick={async () => {
                          try {
                            await restoreFn({ data: { historyId: entry.id } });
                            window.location.reload();
                          } catch (err) {
                            console.error(err);
                          }
                        }}
                      >
                        Restaurar
                      </Button>
                    </div>
              ))}
            </ol>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
