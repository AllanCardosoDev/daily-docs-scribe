import { useMemo, useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";
import { CloudDownload, Loader2, RefreshCw, FileSpreadsheet } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { listDriveReports, importDriveReport, syncDriveReports } from "@/lib/drive.functions";
import { SHIFT_LABEL, type ReportShift } from "@/lib/report-shift";

/**
 * Importa um relatório diário oficial a partir das planilhas publicadas
 * na pasta pública do Google Drive, gravando-o no registro do dia/turno.
 */
export function DriveImportDialog(props: {
  onImported?: (date: string, shift: ReportShift) => void;
  disabled?: boolean;
}) {
  const [open, setOpen] = useState(false);
  const [folder, setFolder] = useState("");
  const [filter, setFilter] = useState("");
  const [busyId, setBusyId] = useState<string | null>(null);
  const qc = useQueryClient();

  const listFn = useServerFn(listDriveReports);
  const importFn = useServerFn(importDriveReport);
  const syncFn = useServerFn(syncDriveReports);

  const syncMut = useMutation({
    mutationFn: () =>
      syncFn({ data: { folderId: folder || undefined, sinceDays: 7, maxFiles: 20 } }),
    onSuccess: (res: any) => {
      if (!res?.ok) {
        toast.error(
          res?.reason === "forbidden"
            ? "Você não tem permissão para sincronizar."
            : (res?.error ?? "Falha na sincronização."),
        );
        return;
      }
      toast.success(
        res.imported > 0
          ? `${res.imported} relatório(s) atualizado(s) a partir do Drive.`
          : "Tudo já está sincronizado com o Drive.",
      );
      qc.invalidateQueries({ queryKey: ["daily-report"] });
      qc.invalidateQueries({ queryKey: ["daily-reports"] });
    },
    onError: (e: any) => toast.error(e?.message ?? "Falha na sincronização."),
  });

  const q = useQuery({
    queryKey: ["drive-reports", folder],
    queryFn: () => listFn({ data: { folderId: folder || undefined } }),
    enabled: open,
    staleTime: 5 * 60_000,
  });

  const files = useMemo(() => {
    const all = q.data?.files ?? [];
    const term = filter.trim().toLowerCase();
    return term ? all.filter((f) => f.name.toLowerCase().includes(term)) : all;
  }, [q.data, filter]);

  const importMut = useMutation({
    mutationFn: (vars: { fileId: string; reportDate: string; shift: ReportShift }) =>
      importFn({ data: vars }),
    onSuccess: (res, vars) => {
      const c = res.counts;
      toast.success(
        `Planilha importada (${c.efetivo} efetivo · ${c.incendios} incêndios · ${c.outras} ocorrências).`,
      );
      qc.invalidateQueries({ queryKey: ["daily-report"] });
      qc.invalidateQueries({ queryKey: ["daily-reports"] });
      props.onImported?.(vars.reportDate, vars.shift);
    },
    onError: (e: any) => toast.error(e?.message ?? "Falha ao importar a planilha."),
    onSettled: () => setBusyId(null),
  });

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant="outline" size="sm" disabled={props.disabled} className="gap-2">
          <CloudDownload className="size-4" />
          <span className="hidden sm:inline">Importar do Drive</span>
          <span className="sm:hidden">Drive</span>
        </Button>
      </DialogTrigger>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle>Importar planilha do Google Drive</DialogTitle>
          <DialogDescription>
            Planilhas oficiais publicadas na pasta compartilhada. A importação substitui os dados do
            dia e turno correspondentes.
          </DialogDescription>
        </DialogHeader>

        <div className="grid gap-3 sm:grid-cols-2">
          <div className="space-y-1.5">
            <Label htmlFor="drive-folder">Pasta (opcional)</Label>
            <Input
              id="drive-folder"
              placeholder="ID ou link da pasta pública"
              value={folder}
              onChange={(e) => setFolder(e.target.value)}
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="drive-filter">Filtrar</Label>
            <Input
              id="drive-filter"
              placeholder="ex.: 28.07 ou Parcial"
              value={filter}
              onChange={(e) => setFilter(e.target.value)}
            />
          </div>
        </div>

        <div className="flex items-center justify-between gap-2 text-sm text-muted-foreground">
          <span>
            {q.isFetching ? "Consultando o Drive…" : `${files.length} planilha(s) disponível(is)`}
          </span>
          <div className="flex items-center gap-1">
            <Button
              variant="ghost"
              size="sm"
              className="gap-2"
              disabled={syncMut.isPending}
              onClick={() => syncMut.mutate()}
            >
              {syncMut.isPending ? (
                <Loader2 className="size-4 animate-spin" />
              ) : (
                <CloudDownload className="size-4" />
              )}
              Sincronizar recentes
            </Button>
            <Button variant="ghost" size="sm" className="gap-2" onClick={() => q.refetch()}>
              <RefreshCw className={`size-4 ${q.isFetching ? "animate-spin" : ""}`} />
              Atualizar
            </Button>
          </div>
        </div>

        {q.data && !q.data.ok && (
          <p className="text-sm text-destructive">{(q.data as any).error}</p>
        )}

        <ScrollArea className="h-[340px] rounded-md border">
          <ul className="divide-y">
            {files.map((f) => {
              const ready = !!f.reportDate && !!f.shift;
              const busy = busyId === f.id;
              return (
                <li key={f.id} className="flex items-center gap-3 p-3">
                  <FileSpreadsheet className="size-4 shrink-0 text-muted-foreground" />
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-medium">{f.name}</p>
                    <p className="text-xs text-muted-foreground">
                      {ready ? (
                        <>
                          {f.reportDate!.split("-").reverse().join("/")} ·{" "}
                          <Badge variant="secondary" className="align-middle">
                            {SHIFT_LABEL[f.shift as ReportShift]}
                          </Badge>
                        </>
                      ) : (
                        "Data ou turno não identificados no nome do arquivo"
                      )}
                    </p>
                  </div>
                  <Button
                    size="sm"
                    disabled={!ready || busy || importMut.isPending}
                    onClick={() => {
                      setBusyId(f.id);
                      importMut.mutate({
                        fileId: f.id,
                        reportDate: f.reportDate!,
                        shift: f.shift as ReportShift,
                      });
                    }}
                  >
                    {busy ? <Loader2 className="size-4 animate-spin" /> : "Importar"}
                  </Button>
                </li>
              );
            })}
            {!q.isFetching && files.length === 0 && (
              <li className="p-6 text-center text-sm text-muted-foreground">
                Nenhuma planilha encontrada nesta pasta.
              </li>
            )}
          </ul>
        </ScrollArea>
      </DialogContent>
    </Dialog>
  );
}
