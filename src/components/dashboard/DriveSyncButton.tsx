import { useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { CloudDownload } from "lucide-react";
import { syncDriveReports } from "@/lib/drive.functions";

/**
 * Força uma re-sincronização imediata com a pasta oficial do Google Drive
 * e atualiza o painel assim que a importação termina.
 */
export function DriveSyncButton({
  onSynced,
  reportDate,
}: {
  onSynced?: () => void;
  reportDate?: Date | null;
}) {
  const qc = useQueryClient();
  const syncFn = useServerFn(syncDriveReports);
  const [busy, setBusy] = useState(false);

  const run = async () => {
    if (busy) return;
    setBusy(true);
    const dateIso = reportDate?.toISOString().split("T")[0];
    const id = toast.loading(
      dateIso ? `Sincronizando relatório de ${dateIso}...` : "Sincronizando com o Google Drive...",
    );
    try {
      const res: any = await syncFn({
        data: {
          sinceDays: 30,
          maxFiles: 40,
          targetDate: dateIso,
        },
      });
      if (!res?.ok) {
        toast.error(
          res?.reason === "forbidden"
            ? "Você não tem permissão para sincronizar."
            : res?.error || "Falha na sincronização.",
          { id },
        );
        return;
      }
      await Promise.all([
        qc.invalidateQueries({ queryKey: ["daily-report"] }),
        qc.invalidateQueries({ queryKey: ["daily-reports"] }),
        qc.invalidateQueries({ queryKey: ["sheets"] }),
      ]);
      onSynced?.();
      toast.success(
        res.imported > 0
          ? `Sincronização concluída — ${res.imported} planilha(s) atualizada(s).`
          : "Tudo já estava atualizado.",
        { id },
      );
    } catch (e) {
      toast.error((e as Error)?.message || "Falha na sincronização.", { id });
    } finally {
      setBusy(false);
    }
  };

  return (
    <Button
      variant="outline"
      onClick={run}
      disabled={busy}
      title="Forçar re-sincronização com o Google Drive agora"
      className="h-11 sm:h-10 transition-transform active:scale-95"
    >
      <CloudDownload className={`w-4 h-4 mr-2 shrink-0 ${busy ? "animate-bounce" : ""}`} />
      <span className="truncate">{busy ? "Sincronizando" : "Importar dados do Google Drive"}</span>
    </Button>
  );
}
