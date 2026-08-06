import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireBackendAuth } from "@/integrations/backend/auth-middleware";
import { dbFail } from "./server-errors";
import { ShiftEnum } from "./report-shift";
import { canonicalMunicipio, compareMunicipios } from "./municipio-order";

// ---------- Schemas ----------

const nnInt = z.preprocess(
  (v) => (v === "" || v === null || v === undefined ? 0 : v),
  z.coerce.number().finite().min(0).max(1_000_000_000),
);
const shortStr = z.preprocess((v) => (v == null ? "" : String(v)), z.string().trim().max(200));

const EfetivoRow = z.object({ mun: shortStr, ord: nnInt, seg: nnInt, brig: nnInt });
const RecursosRow = z.object({ mun: shortStr }).catchall(z.any());
const IncendiosRow = z.object({ mun: shortStr, urb: nnInt, flor: nnInt, focos: nnInt });
const OutrasRow = z.object({
  mun: shortStr,
  salvamento: nnInt,
  acidentes: nnInt,
  aph: nnInt,
  prevencao: nnInt,
  servicos: nnInt,
});

const DailyReportSchema = z.object({
  report_date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Data inválida"),
  shift: ShiftEnum.default("noturno"),
  efetivo: z.array(EfetivoRow).max(500).default([]),
  recursos: z.array(RecursosRow).max(500).default([]),
  incendios: z.array(IncendiosRow).max(500).default([]),
  outras: z.array(OutrasRow).max(500).default([]),
  dados_complementares: z.record(z.any()).nullish().default({}),
  notes: z.string().max(4000).nullish(),
});

export type DailyReportInput = z.infer<typeof DailyReportSchema>;

// ---------- List / read ----------

export const listDailyReports = createServerFn({ method: "GET" })
  .middleware([requireBackendAuth])
  .inputValidator((raw: unknown) =>
    z
      .object({
        from: z
          .string()
          .regex(/^\d{4}-\d{2}-\d{2}$/)
          .optional(),
        to: z
          .string()
          .regex(/^\d{4}-\d{2}-\d{2}$/)
          .optional(),
        shift: ShiftEnum.optional(),
      })
      .parse(raw ?? {}),
  )
  .handler(async ({ data, context }) => {
    let q = context.supabase
      .from("daily_reports")
      .select(
        "id, report_date, shift, efetivo, recursos, incendios, outras, notes, created_by, updated_by, updated_at",
      )
      .order("report_date", { ascending: false })
      .order("shift", { ascending: false })
      // Hard cap: an unbounded scan would grow without limit and stall the
      // "Totais" page. 800 rows ≈ 13 months of both shifts.
      .limit(800);
    if (data.from) q = q.gte("report_date", data.from);
    if (data.to) q = q.lte("report_date", data.to);
    if (data.shift) q = q.eq("shift", data.shift);
    const { data: rows, error } = await q;
    if (error) dbFail(error, "daily-reports");
    return rows ?? [];
  });

export const getLatestReportDate = createServerFn({ method: "GET" })
  .middleware([requireBackendAuth])
  .handler(async ({ context }) => {
    const { data, error } = await context.supabase
      .from("daily_reports")
      .select("report_date")
      .order("report_date", { ascending: false })
      .order("shift", { ascending: false })
      .limit(1)
      .maybeSingle();
    if (error) dbFail(error, "daily-reports");
    return data?.report_date ?? null;
  });

export const getDailyReport = createServerFn({ method: "GET" })
  .middleware([requireBackendAuth])
  .inputValidator((raw: unknown) =>
    z
      .object({
        date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
        shift: ShiftEnum.default("noturno"),
      })
      .parse(raw),
  )
  .handler(async ({ data, context }) => {
    // O relatório consolidado 24h cobre o serviço na sala iniciado no dia anterior,
    // então a escala válida para ele é a do dia anterior.
    const scaleISO =
      data.shift === "noturno"
        ? new Date(new Date(`${data.date}T00:00:00Z`).getTime() - 86_400_000)
            .toISOString()
            .slice(0, 10)
        : data.date;

    // Todas as leituras são independentes entre si — disparadas em paralelo
    // para eliminar 3 idas e voltas sequenciais ao banco.
    const [reportRes, rolesRes, scheduledRes] = await Promise.all([
      context.supabase
        .from("daily_reports")
        .select(
          "id, report_date, shift, efetivo, recursos, incendios, outras, notes, created_by, updated_by, updated_at, version",
        )
        .eq("report_date", data.date)
        .eq("shift", data.shift)
        .maybeSingle(),
      // Um único SELECT substitui duas chamadas RPC has_role().
      context.supabase.from("user_roles").select("role").eq("user_id", context.userId),
      context.supabase
        .from("escala_shifts")
        .select("id, escala_operators!inner(profile_id)")
        .in("shift_date", Array.from(new Set([data.date, scaleISO])))
        .eq("escala_operators.profile_id", context.userId)
        .limit(1),
    ]);

    if (reportRes.error) dbFail(reportRes.error, "daily-reports");
    const row = reportRes.data;

    if (row) {
      const num = (v: any) => (Number(v) || 0);
      const cleanList = <T extends Record<string, any>>(list: any[], numericKeys: string[]): T[] => {
        if (!Array.isArray(list)) return [];
        const map = new Map<string, T>();
        for (const r of list) {
          const rawMun = r?.mun ?? r?.municipio;
          if (!rawMun) continue;
          const mun = canonicalMunicipio(rawMun);
          const existing = map.get(mun);
          if (!existing) {
            const copy = { ...r, mun };
            for (const k of numericKeys) (copy as any)[k] = num(r[k]);
            map.set(mun, copy);
          } else {
            for (const k of numericKeys) {
              (existing as any)[k] = num((existing as any)[k]) + num(r[k]);
            }
          }
        }
        return Array.from(map.values()).sort((a, b) => compareMunicipios(a.mun, b.mun));
      };

      (row as any).efetivo = cleanList((row as any).efetivo, ["ord", "seg", "brig"]);
      (row as any).incendios = cleanList((row as any).incendios, ["urb", "flor", "focos"]);
      (row as any).outras = cleanList((row as any).outras, ["salvamento", "acidentes", "aph", "prevencao", "servicos"]);

      // Recursos
      if (Array.isArray((row as any).recursos)) {
        const recMap = new Map<string, Record<string, any>>();
        for (const item of (row as any).recursos) {
          const rawMun = item?.mun ?? item?.municipio;
          if (!rawMun) continue;
          const mun = canonicalMunicipio(rawMun);
          const existing = recMap.get(mun);
          if (!existing) {
            recMap.set(mun, { ...item, mun });
          } else {
            for (const [k, v] of Object.entries(item)) {
              if (k === "mun" || k === "municipio") continue;
              existing[k] = num(existing[k]) + num(v);
            }
          }
        }
        (row as any).recursos = Array.from(recMap.values()).sort((a, b) => compareMunicipios(a.mun, b.mun));
      }
    }

    const roles = new Set((rolesRes.data ?? []).map((r) => r.role));
    const isAdmin = roles.has("admin");
    const isEditor = roles.has("editor");
    const scheduled = (scheduledRes.data?.length ?? 0) > 0;

    const canEdit =
      isAdmin || (isEditor && (!row || (row as any).created_by === context.userId || scheduled));

    return { row: row ?? null, canEdit, isAdmin };
  });

// ---------- Save (upsert) ----------

export const saveDailyReport = createServerFn({ method: "POST" })
  .middleware([requireBackendAuth])
  .inputValidator((raw: unknown) => DailyReportSchema.parse(raw))
  .handler(async ({ data, context }) => {
    const { data: existing, error: readErr } = await context.supabase
      .from("daily_reports")
      .select("id, created_by")
      .eq("report_date", data.report_date)
      .eq("shift", data.shift)
      .maybeSingle();
    if (readErr) dbFail(readErr, "daily-reports");

    const payload = {
      report_date: data.report_date,
      shift: data.shift,
      efetivo: data.efetivo as any,
      recursos: data.recursos as any,
      incendios: data.incendios as any,
      outras: data.outras as any,
      dados_complementares: (data.dados_complementares ?? {}) as any,
      notes: data.notes ?? null,
      updated_by: context.userId,
    };

    if (existing) {
      const { error } = await context.supabase
        .from("daily_reports")
        .update(payload)
        .eq("id", existing.id);
      if (error) dbFail(error, "daily-reports");
      return { id: existing.id, created: false };
    }
    const { data: inserted, error } = await context.supabase
      .from("daily_reports")
      .insert({ ...payload, created_by: context.userId })
      .select("id")
      .single();
    if (error) dbFail(error, "daily-reports");
    return { id: inserted.id as string, created: true };
  });

export const deleteDailyReport = createServerFn({ method: "POST" })
  .middleware([requireBackendAuth])
  .inputValidator((raw: unknown) => z.object({ id: z.string().uuid() }).parse(raw))
  .handler(async ({ data, context }) => {
    const { error } = await context.supabase.from("daily_reports").delete().eq("id", data.id);
    if (error) dbFail(error, "daily-reports");
    return { ok: true };
  });

// ---------- Audit trail (admin only) ----------

export const getDailyReportAudit = createServerFn({ method: "GET" })
  .middleware([requireBackendAuth])
  .inputValidator((raw: unknown) =>
    z
      .object({
        date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
        shift: ShiftEnum.default("noturno"),
      })
      .parse(raw),
  )
  .handler(async ({ data, context }) => {
    const { data: isAdmin } = await context.supabase.rpc("has_role", {
      _user_id: context.userId,
      _role: "admin",
    });
    if (!isAdmin) throw new Error("Acesso restrito ao administrador.");

    const { data: rows, error } = await (context.supabase as any)
      .from("daily_reports_history")
      .select("id, version, data, changed_by, changed_at, operation")
      .eq("report_date", data.date)
      .eq("shift", data.shift)
      .order("version", { ascending: true })
      .limit(200);
    if (error) dbFail(error, "daily-reports");

    const list = (rows ?? []) as Array<{
      id: number;
      version: number;
      data: any;
      changed_by: string | null;
      changed_at: string;
      operation: string;
    }>;

    const ids = Array.from(new Set(list.map((r) => r.changed_by).filter(Boolean) as string[]));
    let names: Record<string, string> = {};
    if (ids.length) {
      const { data: profiles } = await context.supabase
        .from("profiles")
        .select("id, email, display_name")
        .in("id", ids);
      names = Object.fromEntries(
        (profiles ?? []).map((p: any) => [p.id, p.display_name || p.email || ""]),
      );
    }

    const { diffDailyReport } = await import("./audit-diff");

    return list
      .map((entry, i) => ({
        id: entry.id,
        version: entry.version,
        operation: entry.operation,
        changedAt: entry.changed_at,
        author: entry.changed_by ? (names[entry.changed_by] ?? "") : "",
        changes:
          entry.operation === "insert"
            ? diffDailyReport(null, entry.data)
            : diffDailyReport(list[i - 1]?.data ?? null, entry.data),
      }))
      .reverse();
  });
