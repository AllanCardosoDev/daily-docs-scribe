import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireBackendAuth } from "@/integrations/backend/auth-middleware";
import { dbFail } from "./server-errors";
import { ShiftEnum } from "./report-shift";
import { manausFirst } from "./municipio-order";

import { DEFAULT_DRIVE_FOLDER_ID, extractFolderId } from "./drive-config";

const FolderSchema = z.object({
  folderId: z
    .string()
    .trim()
    .max(200)
    .optional()
    .transform((v) => extractFolderId(v || DEFAULT_DRIVE_FOLDER_ID)),
});

export const listDriveReports = createServerFn({ method: "GET" })
  .middleware([requireBackendAuth])
  .inputValidator((raw: unknown) => FolderSchema.parse(raw ?? {}))
  .handler(async ({ data }) => {
    const { listFolderSpreadsheets } = await import("./drive-import.server");
    try {
      const files = await listFolderSpreadsheets(data.folderId);
      return { ok: true as const, folderId: data.folderId, files };
    } catch (e) {
      return {
        ok: false as const,
        folderId: data.folderId,
        files: [],
        error:
          (e as Error)?.name === "TimeoutError"
            ? "O Google Drive não respondeu a tempo."
            : (e as Error)?.message || "Falha ao listar a pasta.",
      };
    }
  });

const ImportSchema = z.object({
  fileId: z
    .string()
    .trim()
    .regex(/^[-_A-Za-z0-9]{10,}$/, "Arquivo inválido"),
  reportDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Data inválida"),
  shift: ShiftEnum,
});

export const importDriveReport = createServerFn({ method: "POST" })
  .middleware([requireBackendAuth])
  .inputValidator((raw: unknown) => ImportSchema.parse(raw))
  .handler(async ({ data, context }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const dbClient = supabaseAdmin ?? context.supabase;

    const { data: roles } = await dbClient
      .from("user_roles")
      .select("role")
      .eq("user_id", context.userId);
    const allowed = (roles ?? []).some((r: any) => r.role === "admin" || r.role === "editor");
    if (!allowed) throw new Error("Sem permissão para importar relatórios.");

    const { downloadSheetMatrix, parseDailyReportSheet } = await import("./drive-import.server");
    const { harmonizeMunicipalitySections } = await import("./municipio-order");

    const matrix = await downloadSheetMatrix(data.fileId);
    const parsed = parseDailyReportSheet(matrix);

    const harmonized = harmonizeMunicipalitySections(
      parsed.efetivo as any,
      parsed.recursos as any,
      parsed.incendios as any,
      (mun) => ({ mun, ord: 0, cbmam: 0, seg: 0, brig: 0 }),
      (mun) => ({ mun, viaturas: 0, aeronaves: 0, embarcacoes: 0 }),
      (mun) => ({ mun, urb: 0, flor: 0, focos: 0, total_periodo: 0 }),
    );

    const notesJson = JSON.stringify({
      header: parsed.header,
      incendios_acumulado: manausFirst(parsed.incendios_acumulado),
    });

    const payload = {
      report_date: data.reportDate,
      shift: data.shift,
      efetivo: manausFirst(harmonized.efetivo) as any,
      recursos: manausFirst(harmonized.recursos) as any,
      incendios: manausFirst(harmonized.incendios) as any,
      outras: manausFirst(parsed.outras) as any,
      notes: notesJson,
      updated_by: context.userId,
    };

    const { data: existing, error: readErr } = await dbClient
      .from("daily_reports")
      .select("id")
      .eq("report_date", data.reportDate)
      .eq("shift", data.shift)
      .maybeSingle();
    if (readErr) dbFail(readErr, "drive-import");

    if (existing) {
      const { error } = await dbClient
        .from("daily_reports")
        .update(payload)
        .eq("id", existing.id);
      if (error) dbFail(error, "drive-import");
    } else {
      const { error } = await dbClient
        .from("daily_reports")
        .insert({ ...payload, created_by: context.userId });
      if (error) dbFail(error, "drive-import");
    }

    return {
      ok: true as const,
      created: !existing,
      counts: {
        efetivo: harmonized.efetivo.length,
        recursos: harmonized.recursos.length,
        incendios: harmonized.incendios.length,
        outras: parsed.outras.length,
      },
    };
  });

// ---------------- Sincronização contínua ----------------

const SyncSchema = z.object({
  folderId: z
    .string()
    .trim()
    .max(200)
    .optional()
    .transform((v) => extractFolderId(v || DEFAULT_DRIVE_FOLDER_ID)),
  sinceDays: z.coerce.number().int().min(1).max(3650).default(365),
  maxFiles: z.coerce.number().int().min(1).max(1000).default(100),
  targetDate: z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/)
    .optional(),
});

/**
 * Puxa do Drive todas as planilhas recentes e atualiza os registros diários.
 * Chamada pelo botão "Sincronizar" e automaticamente ao abrir o painel.
 */
export const syncDriveReports = createServerFn({ method: "POST" })
  .middleware([requireBackendAuth])
  .inputValidator((raw: unknown) => SyncSchema.parse(raw ?? {}))
  .handler(async ({ data, context }) => {
    const { data: roles } = await context.supabase
      .from("user_roles")
      .select("role")
      .eq("user_id", context.userId);
    const allowed = (roles ?? []).some((r: any) => r.role === "admin" || r.role === "editor");
    if (!allowed) return { ok: false as const, reason: "forbidden" as const };

    const { syncDriveFolder } = await import("./drive-sync.server");
    try {
      const result = await syncDriveFolder({
        supabase: context.supabase as any,
        folderId: data.folderId,
        sinceDays: data.sinceDays,
        maxFiles: data.maxFiles,
        actorId: context.userId,
        targetDate: data.targetDate,
      });
      return { ok: true as const, ...result };
    } catch (e) {
      return {
        ok: false as const,
        reason: "error" as const,
        error: (e as Error)?.message ?? "Falha na sincronização.",
      };
    }
  });
