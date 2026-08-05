/**
 * Sincronização contínua com a pasta pública do Google Drive.
 *
 * O Drive é a fonte da verdade dos relatórios oficiais: cada planilha .xlsx
 * publicada é lida e gravada em `daily_reports` (dia + turno). Usado tanto
 * pelo botão "Sincronizar" quanto pela rota de cron `/api/public/drive-sync`.
 *
 * Server-only.
 */
import type { SupabaseClient } from "@supabase/supabase-js";
import { manausFirst } from "./municipio-order";
import type { ReportShift } from "./report-shift";
import {
  listFolderSpreadsheets,
  downloadSheetMatrix,
  parseDailyReportSheet,
} from "./drive-import.server";

export type SyncResult = {
  folderId: string;
  scanned: number;
  imported: number;
  skipped: number;
  failed: Array<{ name: string; error: string }>;
  reports: Array<{ reportDate: string; shift: ReportShift; created: boolean }>;
};

function daysAgoISO(days: number): string {
  const d = new Date(Date.now() - days * 86_400_000);
  return d.toISOString().slice(0, 10);
}

/**
 * Importa todas as planilhas da pasta cuja data seja igual ou posterior a
 * `sinceDays` atrás. O Drive sempre sobrescreve o registro correspondente.
 */
export async function syncDriveFolder(opts: {
  supabase: SupabaseClient<any>;
  folderId: string;
  sinceDays?: number;
  maxFiles?: number;
  actorId?: string | null;
  targetDate?: string;
}): Promise<SyncResult> {
  const { supabase, folderId, targetDate } = opts;
  const since = daysAgoISO(opts.sinceDays ?? 7);
  const maxFiles = Math.min(opts.maxFiles ?? 20, 1000);

  const files = await listFolderSpreadsheets(folderId);
  const targets = files
    .filter((f) => {
      if (!f.reportDate || !f.shift) return false;
      if (targetDate) return f.reportDate === targetDate;
      return f.reportDate >= since;
    })
    .slice(0, maxFiles);

  const result: SyncResult = {
    folderId,
    scanned: files.length,
    imported: 0,
    skipped: files.length - targets.length,
    failed: [],
    reports: [],
  };

  for (const file of targets) {
    try {
      const parsed = parseDailyReportSheet(await downloadSheetMatrix(file.id));
      const payload = {
        report_date: file.reportDate!,
        shift: file.shift as ReportShift,
        efetivo: manausFirst(parsed.efetivo) as any,
        recursos: manausFirst(parsed.recursos) as any,
        incendios: manausFirst(parsed.incendios) as any,
        outras: manausFirst(parsed.outras) as any,
        updated_by: opts.actorId ?? null,
      };

      const { data: existing } = await supabase
        .from("daily_reports")
        .select("id, efetivo, recursos, incendios, outras")
        .eq("report_date", payload.report_date)
        .eq("shift", payload.shift)
        .maybeSingle();

      if (existing) {
        // Evita gravações (e versões de auditoria) desnecessárias quando
        // a planilha não mudou desde a última sincronização.
        const same =
          JSON.stringify([
            existing.efetivo,
            existing.recursos,
            existing.incendios,
            existing.outras,
          ]) ===
          JSON.stringify([payload.efetivo, payload.recursos, payload.incendios, payload.outras]);
        if (same) {
          result.skipped += 1;
          continue;
        }
        const { error } = await supabase
          .from("daily_reports")
          .update(payload)
          .eq("id", existing.id);
        if (error) throw new Error(error.message);
        result.reports.push({
          reportDate: payload.report_date,
          shift: payload.shift,
          created: false,
        });
      } else {
        const { error } = await supabase
          .from("daily_reports")
          .insert({ ...payload, created_by: opts.actorId ?? null });
        if (error) throw new Error(error.message);
        result.reports.push({
          reportDate: payload.report_date,
          shift: payload.shift,
          created: true,
        });
      }
      result.imported += 1;
    } catch (e) {
      result.failed.push({ name: file.name, error: (e as Error)?.message ?? "erro" });
    }
  }

  return result;
}
