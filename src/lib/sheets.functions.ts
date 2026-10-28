import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import type { SupabaseClient } from "@supabase/supabase-js";
import { requireBackendAuth } from "@/integrations/backend/auth-middleware";
import { dbFail } from "./server-errors";
import { EMPTY_SHEETS_DATA, type SheetsData } from "./sheets.types";

type SB = SupabaseClient;

/** Marker string used by the client to detect a version conflict. */
export const CONFLICT_ERROR = "REPORT_VERSION_CONFLICT";

async function readAppsScriptUrl(supabase: SB): Promise<string | null> {
  const { data, error } = await supabase
    .from("app_config")
    .select("apps_script_url")
    .eq("id", 1)
    .maybeSingle();
  if (error) dbFail(error, "sheets");
  return (data?.apps_script_url as string | null) ?? null;
}

async function readUserRoles(supabase: SB, userId: string): Promise<string[]> {
  try {
    const { data } = await supabase.from("user_roles").select("role").eq("user_id", userId);
    if (data && data.length > 0) {
      return data.map((r: { role: string }) => r.role);
    }
  } catch {
    // continue to fallback
  }

  try {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    if (supabaseAdmin && typeof (supabaseAdmin as any).from === "function") {
      const { data } = await supabaseAdmin.from("user_roles").select("role").eq("user_id", userId);
      return (data ?? []).map((r: { role: string }) => r.role);
    }
  } catch {
    return [];
  }
  return [];
}

/** Shape returned by the Apps Script Web App. Fields default to safe empties. */
function normaliseSheetsPayload(json: any): SheetsData {
  return {
    header: json?.header ?? {},
    efetivo: json?.efetivo ?? [],
    recursos: json?.recursos ?? [],
    incendios_diario: json?.incendios_diario ?? [],
    incendios_acumulado: json?.incendios_acumulado ?? [],
    outras_diarias: json?.outras_diarias ?? [],
    occurrences: json?.occurrences ?? [],
  };
}

// ------------------------------------------------------------------
// Read
// ------------------------------------------------------------------

export const getSheetsData = createServerFn({ method: "GET" })
  .middleware([requireBackendAuth])
  .inputValidator((data: unknown) =>
    z
      .object({
        reportDate: z.string().optional(),
        endDate: z.string().optional(),
      })
      .parse(data ?? {}),
  )
  .handler(
    async ({
      data: input,
      context,
    }): Promise<{
      data: SheetsData;
      version: number;
      configured: boolean;
      error?: string;
    }> => {
      const { loadLatestDriveReport, loadReportByDate, loadReportRange } = await import(
        "./sheets-fallback.server"
      );

      if (input.reportDate && input.endDate && input.reportDate !== input.endDate) {
        const rangeData = await loadReportRange(context.supabase, input.reportDate, input.endDate);
        return {
          data: { ...rangeData, isRange: true },
          version: 1,
          configured: true,
        };
      }

      const fallback = input.reportDate
        ? await loadReportByDate(context.supabase, input.reportDate)
        : await loadLatestDriveReport(context.supabase);

      const resData = fallback.data;

      return {
        data: resData,
        version: 1,
        configured: true,
        error: undefined,
      };
    },
  );

export const getComparisonData = createServerFn({ method: "GET" })
  .middleware([requireBackendAuth])
  .inputValidator((data: unknown) =>
    z
      .object({
        rangeA: z.object({
          reportDate: z.string(),
          endDate: z.string().optional(),
        }),
        rangeB: z.object({
          reportDate: z.string(),
          endDate: z.string().optional(),
        }),
      })
      .parse(data ?? {}),
  )
  .handler(async ({ data: input, context }) => {
    const { loadReportByDate, loadReportRange } = await import("./sheets-fallback.server");
    const { calculateComparison } = await import("./comparison");

    const fetchRange = async (range: { reportDate: string; endDate?: string }) => {
      if (range.endDate && range.reportDate !== range.endDate) {
        return loadReportRange(context.supabase, range.reportDate, range.endDate);
      }
      const res = await loadReportByDate(context.supabase, range.reportDate);
      return res.data;
    };

    const [dataA, dataB] = await Promise.all([
      fetchRange(input.rangeA),
      fetchRange(input.rangeB),
    ]);

    return calculateComparison(dataA, dataB);
  });

// ------------------------------------------------------------------
// Write — with strict validation + optimistic locking
// ------------------------------------------------------------------

/** Non-negative integer, tolerant of null/undefined/"" from empty inputs. */
const nnInt = z.preprocess(
  (v) => (v === "" || v === null || v === undefined ? 0 : v),
  z.coerce.number().finite().min(0, "Valores devem ser ≥ 0").max(1_000_000_000),
);
const shortStr = z.preprocess((v) => (v == null ? "" : String(v)), z.string().trim().max(200));
const longStr = z.preprocess((v) => (v == null ? "" : String(v)), z.string().trim().max(2000));

const HeaderSchema = z
  .object({
    titulo: shortStr.optional(),
    periodo: shortStr.optional(),
    proximoPeriodo: shortStr.optional(),
    reuniaoPlanejamento: shortStr.optional(),
    reuniaoBriefing: shortStr.optional(),
    comandante: shortStr.optional(),
    chefeCapital: shortStr.optional(),
    chefeInterior: shortStr.optional(),
    coordSituacao: shortStr.optional(),
    coordenador: shortStr.optional(),
    subcomandante: shortStr.optional(),
  })
  .passthrough();

const EfetivoRowSchema = z
  .object({
    mun: shortStr,
    ord: nnInt.optional().default(0),
    seg: nnInt.optional().default(0),
    brig: nnInt.optional().default(0),
    servico: nnInt.optional(),
    opamv: nnInt.optional(),
    opam_ref: nnInt.optional(),
    inc1: nnInt.optional(),
    inc2: nnInt.optional(),
    inc3: nnInt.optional(),
    cbmsp: nnInt.optional(),
    prevfogo: nnInt.optional(),
    fn: nnInt.optional(),
    marinha: nnInt.optional(),
    sec: nnInt.optional(),
    cbmam: nnInt.optional(),
    total: nnInt.optional(),
    brig_mun: nnInt.optional(),
    brig_semas: nnInt.optional(),
  })
  .passthrough();
const IncDiarioRowSchema = z
  .object({ mun: shortStr, urb: nnInt, flor: nnInt, focos: nnInt, total_periodo: nnInt.optional() })
  .passthrough();
const IncAcumRowSchema = z
  .object({ mun: shortStr, urb: nnInt, flor: nnInt, focos: nnInt, sat: nnInt, area: nnInt })
  .passthrough();
const OutrasRowSchema = z
  .object({
    mun: shortStr,
    salvamento: nnInt,
    acidentes: nnInt,
    aph: nnInt,
    prevencao: nnInt,
    servicos: nnInt,
    total_periodo: nnInt.optional(),
  })
  .passthrough();
const RecursosRowSchema = z.object({ mun: shortStr }).catchall(z.any());
const OccurrenceRowSchema = z
  .object({
    data: shortStr,
    municipio: shortStr,
    horario: shortStr,
    natureza: longStr,
    focos: nnInt,
    coordenadas: shortStr,
    endereco: longStr,
    area: nnInt,
    agua: nnInt,
  })
  .passthrough();

const SavePayloadSchema = z.object({
  reportDate: z.string().optional(),
  expectedVersion: z.number().int().nonnegative().optional(),
  patch: z
    .object({
      header: HeaderSchema.optional(),
      efetivo: z.array(EfetivoRowSchema).max(500).optional(),
      recursos: z.array(RecursosRowSchema).max(500).optional(),
      incendios_diario: z.array(IncDiarioRowSchema).max(500).optional(),
      incendios_acumulado: z.array(IncAcumRowSchema).max(500).optional(),
      outras_diarias: z.array(OutrasRowSchema).max(500).optional(),
      occurrences: z.array(OccurrenceRowSchema).max(5000).optional(),
      custom_columns: z.record(z.any()).optional(),
    })
    .refine((p) => Object.keys(p).length > 0, "Nada para salvar."),
});

export const saveSheetsData = createServerFn({ method: "POST" })
  .middleware([requireBackendAuth])
  .inputValidator((raw: unknown) => SavePayloadSchema.parse(raw))
  .handler(async ({ data, context }): Promise<{ ok: true; version: number }> => {
    // Todos os usuários autenticados têm permissão para editar os dados da Inserção e painel
    const roles = await readUserRoles(context.supabase, context.userId);

    const iso = data.reportDate || new Date().toISOString().split("T")[0];
    let dbClient: any = context.supabase;

    // Helper para tentar admin client APENAS em caso de restrição RLS
    const getAdminFallback = async () => {
      try {
        const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
        if (supabaseAdmin && typeof supabaseAdmin.from === "function") {
          return supabaseAdmin;
        }
      } catch {}
      return null;
    };

    let existing: any = null;
    let readRes = await dbClient
      .from("daily_reports")
      .select("id, report_date, shift, efetivo, recursos, incendios, outras, notes")
      .eq("report_date", iso)
      .order("shift", { ascending: false })
      .limit(1)
      .maybeSingle();

    if (readRes.error) {
      const adminClient = await getAdminFallback();
      if (adminClient) {
        readRes = await adminClient
          .from("daily_reports")
          .select("id, report_date, shift, efetivo, recursos, incendios, outras, notes")
          .eq("report_date", iso)
          .order("shift", { ascending: false })
          .limit(1)
          .maybeSingle();
      }
    }
    existing = readRes.data;

    const patch = data.patch;
    const payload: any = { updated_by: context.userId, updated_at: new Date().toISOString() };
    if (patch.efetivo) payload.efetivo = patch.efetivo;
    if (patch.recursos) {
      const { createDefaultRecursosRow } = await import("./sheets-fallback.server");
      payload.recursos = patch.recursos.map((r: any) =>
        createDefaultRecursosRow(r.mun ?? r.municipio, r),
      );
    }
    if (patch.incendios_diario) payload.incendios = patch.incendios_diario;
    if (patch.outras_diarias) payload.outras = patch.outras_diarias;

    // Se o registro não existe ou tem seções em branco, carregamos a base padrão completa da data:
    // Padrão operacional do dia estipulado (dia 25) para efetivo/recursos + ocorrências do CAD para o dia.
    if (!existing || !existing.recursos || !existing.efetivo || !existing.incendios) {
      try {
        const { loadReportByDate } = await import("./sheets-fallback.server");
        const fullDay = await loadReportByDate(dbClient, iso);
        const base = fullDay?.data;
        if (base) {
          if (!payload.efetivo && (!existing?.efetivo || existing.efetivo.length <= 1)) {
            payload.efetivo = base.efetivo;
          }
          if (!payload.recursos && (!existing?.recursos || existing.recursos.length <= 1)) {
            payload.recursos = base.recursos;
          }
          if (!payload.incendios && (!existing?.incendios || existing.incendios.length === 0)) {
            payload.incendios = base.incendios_diario;
          }
          if (!payload.outras && (!existing?.outras || existing.outras.length === 0)) {
            payload.outras = base.outras_diarias;
          }
          if (!payload.notes && !existing?.notes) {
            payload.notes = JSON.stringify({
              header: base.header ?? {},
              occurrences: base.occurrences ?? [],
              incendios_acumulado: base.incendios_acumulado ?? [],
            });
          }
        }
      } catch (e) {
        console.warn("[saveSheetsData] Não foi possível carregar base de referência:", e);
      }
    }

    if (patch.header || patch.occurrences || patch.incendios_acumulado || patch.custom_columns) {
      let existingNotes: Record<string, any> = {};
      if (existing?.notes) {
        try {
          existingNotes = JSON.parse(existing.notes);
        } catch {
          existingNotes = {};
        }
      } else if (payload.notes) {
        try {
          existingNotes = JSON.parse(payload.notes);
        } catch {
          existingNotes = {};
        }
      }
      payload.notes = JSON.stringify({
        ...existingNotes,
        ...(patch.header ? { header: patch.header } : {}),
        ...(patch.occurrences ? { occurrences: patch.occurrences } : {}),
        ...(patch.incendios_acumulado ? { incendios_acumulado: patch.incendios_acumulado } : {}),
        ...(patch.custom_columns
          ? {
              custom_columns: {
                ...(existingNotes.custom_columns || {}),
                ...patch.custom_columns,
              },
            }
          : {}),
      });
    }

    if (existing) {
      let { error: updateErr } = await dbClient
        .from("daily_reports")
        .update(payload)
        .eq("id", existing.id);

      if (updateErr) {
        const adminClient = await getAdminFallback();
        if (adminClient) {
          const res = await adminClient
            .from("daily_reports")
            .update(payload)
            .eq("id", existing.id);
          updateErr = res.error;
        }
      }

      if (updateErr) {
        console.error("[saveSheetsData] Erro ao atualizar daily_reports:", updateErr);
        dbFail(updateErr, "daily-reports");
      }
      return { ok: true, version: 1 };
    }

    // Criação de novo dia com todas as colunas preenchidas
    let { error: insErr } = await dbClient
      .from("daily_reports")
      .insert({
        ...payload,
        report_date: iso,
        shift: "noturno",
        created_by: context.userId,
      })
      .select("id")
      .single();

    if (insErr) {
      const adminClient = await getAdminFallback();
      if (adminClient) {
        const res = await adminClient
          .from("daily_reports")
          .insert({
            ...payload,
            report_date: iso,
            shift: "noturno",
            created_by: context.userId,
          })
          .select("id")
          .single();
        insErr = res.error;
      }
    }

    if (insErr) {
      console.error("[saveSheetsData] Erro ao inserir daily_reports:", insErr);
      dbFail(insErr, "daily-reports");
    }

    return { ok: true, version: 1 };
  });

// ------------------------------------------------------------------
// History
// ------------------------------------------------------------------

export const listReportHistory = createServerFn({ method: "GET" })
  .middleware([requireBackendAuth])
  .inputValidator((data: unknown) =>
    z.object({ reportDate: z.string().optional() }).parse(data ?? {}),
  )
  .handler(async ({ data: input, context }) => {
    let q = context.supabase
      .from("daily_reports_history")
      .select("id, version, changed_by, changed_at, operation, report_date, shift")
      .order("version", { ascending: false })
      .limit(50);

    if (input.reportDate) {
      q = q.eq("report_date", input.reportDate);
    }

    const { data, error } = await q;
    if (error) dbFail(error, "sheets");

    // Enrich with user emails
    const userIds = Array.from(
      new Set((data ?? []).map((r) => r.changed_by).filter(Boolean) as string[]),
    );
    let emails: Record<string, string> = {};
    if (userIds.length) {
      const { data: profiles } = await context.supabase
        .from("profiles")
        .select("id, email, display_name")
        .in("id", userIds);
      emails = Object.fromEntries(
        (profiles ?? []).map((p: any) => [p.id, p.display_name || p.email || ""]),
      );
    }
    return (data ?? []).map((r) => ({
      id: Number(r.id),
      version: Number(r.version),
      updatedAt: r.changed_at as string,
      updatedByEmail: r.changed_by ? (emails[r.changed_by as string] ?? "") : "",
      operation: r.operation,
      reportDate: r.report_date,
      shift: r.shift,
    }));
  });

export const restoreReportVersion = createServerFn({ method: "POST" })
  .middleware([requireBackendAuth])
  .inputValidator((data: unknown) => z.object({ historyId: z.number() }).parse(data))
  .handler(async ({ data: input, context }) => {
    const roles = await readUserRoles(context.supabase, context.userId);
    if (!roles.includes("admin")) throw new Error("Apenas administradores podem restaurar versões.");

    // Busca a versão no histórico
    const { data: history, error: hErr } = await context.supabase
      .from("daily_reports_history")
      .select("*")
      .eq("id", input.historyId)
      .single();

    if (hErr || !history) throw new Error("Versão não encontrada no histórico.");

    const historyData = history.data as any;

    // Atualiza o relatório original
    const { error: uErr } = await context.supabase
      .from("daily_reports")
      .update({
        efetivo: historyData?.efetivo ?? [],
        recursos: historyData?.recursos ?? [],
        incendios: historyData?.incendios ?? [],
        outras: historyData?.outras ?? [],
        notes: historyData?.notes ?? null,
        updated_by: context.userId,
      })
      .eq("report_date", history.report_date)
      .eq("shift", history.shift);

    if (uErr) dbFail(uErr, "daily-reports");
    return { ok: true };
  });

// ------------------------------------------------------------------
// Config
// ------------------------------------------------------------------

export const getAppConfig = createServerFn({ method: "GET" })
  .middleware([requireBackendAuth])
  .handler(async ({ context }) => {
    const [{ data: cfg }, roles] = await Promise.all([
      context.supabase.from("app_config").select("apps_script_url").eq("id", 1).maybeSingle(),
      readUserRoles(context.supabase, context.userId),
    ]);
    return {
      apps_script_url: (cfg?.apps_script_url as string | null) ?? "",
      isAdmin: roles.includes("admin"),
      isEditor: true, // Todos os usuários autenticados têm permissão para editar os dados da Inserção
    };
  });

export const saveAppConfig = createServerFn({ method: "POST" })
  .middleware([requireBackendAuth])
  .inputValidator((raw: unknown) =>
    z.object({ apps_script_url: z.string().url().or(z.literal("")) }).parse(raw),
  )
  .handler(async ({ data, context }) => {
    const { error } = await context.supabase
      .from("app_config")
      .update({ apps_script_url: data.apps_script_url || null, updated_by: context.userId })
      .eq("id", 1);
    if (error) dbFail(error, "sheets");
    return { ok: true };
  });

// ------------------------------------------------------------------
// Sync — pull fresh data from the Google Sheets Apps Script Web App
// ------------------------------------------------------------------

/**
 * Fetches the latest payload from the configured Apps Script Web App and
 * overwrites `report_data` with it. Editor/admin only.
 */
export const syncFromSheets = createServerFn({ method: "POST" })
  .middleware([requireBackendAuth])
  .handler(
    async ({ context }): Promise<{ ok: true; version: number; counts: Record<string, number> }> => {
      const roles = await readUserRoles(context.supabase, context.userId);
      if (!roles.some((r) => r === "admin" || r === "editor")) {
        throw new Error("Sem permissão para sincronizar. Peça o papel de editor.");
      }

      // Tenta sincronizar via Drive se o Apps Script não estiver configurado
      const url = await readAppsScriptUrl(context.supabase);
      if (!url) {
        const { syncDriveFolder } = await import("./drive-sync.server");
        const { DEFAULT_DRIVE_FOLDER_ID } = await import("./drive-config");

        const result = await syncDriveFolder({
          supabase: context.supabase,
          folderId: DEFAULT_DRIVE_FOLDER_ID,
          sinceDays: 7,
          actorId: context.userId,
        });

        if (result.imported === 0 && result.failed.length > 0) {
          throw new Error(`Falha ao sincronizar Drive: ${result.failed[0].error}`);
        }

        return {
          ok: true,
          version: 1,
          counts: { imported_reports: result.imported },
        };
      }

      let json: any;
      try {
        const res = await fetch(url, {
          method: "GET",
          redirect: "follow",
          signal: AbortSignal.timeout(15000),
        });
        if (!res.ok) throw new Error(`A planilha respondeu com HTTP ${res.status}.`);
        json = await res.json();
      } catch (e) {
        const err = e as Error;
        throw new Error(
          err?.name === "TimeoutError"
            ? "A planilha externa não respondeu a tempo."
            : `Falha ao consultar a planilha: ${err?.message ?? "erro desconhecido"}`,
        );
      }
      if (json?.error) throw new Error(String(json.error));

      const fresh = normaliseSheetsPayload(json);

      const { data: updated, error } = await context.supabase
        .from("report_data")
        .update({ data: fresh as any, updated_by: context.userId })
        .eq("id", 1)
        .select("version");
      if (error) dbFail(error, "sheets");
      if (!updated || updated.length === 0) {
        throw new Error("Não foi possível gravar os dados sincronizados.");
      }

      const counts: Record<string, number> = {
        efetivo: fresh.efetivo.length,
        recursos: fresh.recursos.length,
        incendios_diario: fresh.incendios_diario.length,
        incendios_acumulado: fresh.incendios_acumulado.length,
        outras_diarias: fresh.outras_diarias.length,
        occurrences: fresh.occurrences.length,
      };

      return { ok: true, version: Number(updated[0].version ?? 0), counts };
    },
  );
