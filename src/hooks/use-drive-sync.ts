import { useEffect, useRef } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { syncDriveReports } from "@/lib/drive.functions";

const INTERVAL_MS = 24 * 60 * 60_000; // Sincronização diária (24h)

/**
 * Mantém o app sempre conectado às planilhas do Google Drive: sincroniza os
 * relatórios recentes ao entrar na área autenticada e a cada 10 minutos,
 * silenciosamente (usuários sem permissão simplesmente não sincronizam).
 */
export function useDriveAutoSync(enabled = true) {
  const qc = useQueryClient();
  const syncFn = useServerFn(syncDriveReports);
  const running = useRef(false);

  useEffect(() => {
    if (!enabled) return;
    let cancelled = false;

    const run = async () => {
      if (running.current || document.visibilityState === "hidden") return;
      running.current = true;
      try {
        const res: any = await syncFn({ data: { sinceDays: 7, maxFiles: 20 } });
        if (!cancelled && res?.ok && res.imported > 0) {
          qc.invalidateQueries({ queryKey: ["daily-report"] });
          qc.invalidateQueries({ queryKey: ["daily-reports"] });
        }
      } catch {
        // Sincronização em segundo plano nunca interrompe o uso do sistema.
      } finally {
        running.current = false;
      }
    };

    void run();
    const id = window.setInterval(run, INTERVAL_MS);
    return () => {
      cancelled = true;
      window.clearInterval(id);
    };
  }, [enabled, qc, syncFn]);
}
