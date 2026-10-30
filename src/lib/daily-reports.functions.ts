import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireBackendAuth } from "@/integrations/backend/auth-middleware";
import { dbFail } from "./server-errors";
import { ShiftEnum } from "./report-shift";
import { canonicalMunicipio, compareMunicipios, harmonizeMunicipalitySections, isNonMunicipioTroop } from "./municipio-order";

// ---------- Schemas ----------

const nnInt = z.preprocess(
  (v) => (v === "" || v === null || v === undefined ? 0 : v),
  z.coerce.number().finite().min(0).max(1_000_000_000),
);
const shortStr = z.preprocess((v) => (v == null ? "" : String(v)), z.string().trim().max(200));

const EfetivoRow = z
  .object({
    mun: shortStr,
    ord: nnInt,
    seg: nnInt,
    brig: nnInt,
    servico: nnInt.optional(),
    opamv: nnInt.optional(),
    opam_ref: nnInt.optional(),
    inc1: nnInt.optional(),
    inc2: nnInt.optional(),
    inc3: nnInt.optional(),
    cbmsp: nnInt.optional(),
    prevfogo: nnInt.optional(),
    fn: nnInt.optional(),
    brig_mun: nnInt.optional(),
    brig_semas: nnInt.optional(),
  })
  .passthrough();
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
    let dbClient = context.supabase;
    try {
      const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
      if (supabaseAdmin) dbClient = supabaseAdmin;
    } catch {
      dbClient = context.supabase;
    }
    const { getLatestOccurrenceDate } = await import("./occurrences-store.server");
    const { data } = await dbClient
      .from("daily_reports")
      .select("report_date")
      .order("report_date", { ascending: false })
      .order("shift", { ascending: false })
      .limit(1)
      .maybeSingle();

    const latestOccDate = getLatestOccurrenceDate();
    const reportDate = data?.report_date ?? null;

    if (!reportDate) return latestOccDate;
    if (latestOccDate && latestOccDate > reportDate) return latestOccDate;
    return reportDate;
  });

export const listAvailableReportDates = createServerFn({ method: "GET" })
  .middleware([requireBackendAuth])
  .handler(async ({ context }) => {
    let dbClient = context.supabase;
    try {
      const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
      if (supabaseAdmin) dbClient = supabaseAdmin;
    } catch {
      dbClient = context.supabase;
    }
    const { getAvailableDates } = await import("./occurrences-store.server");
    const { data } = await dbClient
      .from("daily_reports")
      .select("report_date, shift")
      .order("report_date", { ascending: false })
      .limit(300);

    const map = new Map<string, { report_date: string; shift?: string }>();
    for (const d of getAvailableDates()) {
      map.set(d, { report_date: d, shift: "noturno" });
    }
    for (const row of (data ?? [])) {
      if (row.report_date) {
        map.set(row.report_date, row);
      }
    }

    return Array.from(map.values()).sort((a, b) => b.report_date.localeCompare(a.report_date));
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
    let row = reportRes.data;

    if (row) {
      const num = (v: any) => (Number(v) || 0);
      const cleanList = <T extends Record<string, any>>(list: any[], numericKeys: string[]): T[] => {
        if (!Array.isArray(list)) return [];
        const map = new Map<string, T>();
        for (const r of list) {
          const rawMun = r?.mun ?? r?.municipio;
          if (!rawMun || isNonMunicipioTroop(rawMun)) continue;
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

      const EFETIVO_NUMERIC_KEYS = [
        "ord", "seg", "brig", "servico", "cbmam", "serv_ord",
        "opamv", "opam_ref", "inc1", "inc2", "inc3", "cbmsp",
        "prevfogo", "fn", "marinha", "sec", "brig_mun", "brig_semas", "total"
      ];
      (row as any).efetivo = cleanList((row as any).efetivo, EFETIVO_NUMERIC_KEYS);
      (row as any).incendios = cleanList((row as any).incendios, ["urb", "flor", "focos"]);
      (row as any).outras = cleanList((row as any).outras, ["salvamento", "acidentes", "aph", "prevencao", "servicos"]);

      // Recursos
      if (Array.isArray((row as any).recursos)) {
        const recMap = new Map<string, Record<string, any>>();
        for (const item of (row as any).recursos) {
          const rawMun = item?.mun ?? item?.municipio;
          if (!rawMun || isNonMunicipioTroop(rawMun)) continue;
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

      // Harmonizar efetivo, recursos e incêndios para que sempre possuam a mesma lista de municípios
      const harmonized = harmonizeMunicipalitySections(
        (row as any).efetivo ?? [],
        (row as any).recursos ?? [],
        (row as any).incendios ?? [],
        (mun) => ({ mun, ord: 0, cbmam: 0, seg: 0, brig: 0 }),
        (mun) => ({ mun, viaturas: 0, aeronaves: 0, embarcacoes: 0 }),
        (mun) => ({ mun, urb: 0, flor: 0, focos: 0, total_periodo: 0 }),
      );
      (row as any).efetivo = harmonized.efetivo;
      (row as any).recursos = harmonized.recursos;
      (row as any).incendios = harmonized.incendios;
    }

    const roles = new Set((rolesRes.data ?? []).map((r) => r.role));
    const isAdmin = roles.has("admin");
    const canEdit = true; // Usuários autenticados podem editar no módulo de Inserção

    const { getOccurrencesForDate } = await import("./occurrences-store.server");
    let occurrences = getOccurrencesForDate(data.date);

    // Se occurrences-store em memória não possuir registros para a data, busca de row.notes no Supabase:
    if (occurrences.length === 0 && row && (row as any).notes) {
      try {
        const n = typeof (row as any).notes === "string" ? JSON.parse((row as any).notes) : (row as any).notes;
        if (Array.isArray(n.occurrences) && n.occurrences.length > 0) {
          occurrences = n.occurrences;
        }
      } catch {}
    }

    // Se houver ocorrências CAD para esta data, garantir integração com a tabela de incêndios
    if (occurrences.length > 0) {
      const { isFlorestalAmbiental } = await import("./fire-classification");
      const muniFires = new Map<string, { urb: number; flor: number; focos: number }>();
      for (const occ of occurrences) {
        const mun = canonicalMunicipio(occ.municipio);
        const cur = muniFires.get(mun) || { urb: 0, flor: 0, focos: 0 };
        if (isFlorestalAmbiental(occ.natureza)) cur.flor += 1;
        else cur.urb += 1;
        cur.focos += Math.max(1, occ.focos || 1);
        muniFires.set(mun, cur);
      }

      if (row) {
        const incArray = (row as any).incendios || [];
        const hasFiresInRow = incArray.some(
          (r: any) => (Number(r.urb) || 0) > 0 || (Number(r.flor) || 0) > 0,
        );
        if (!hasFiresInRow) {
          const incMap = new Map<string, any>();
          for (const r of incArray) {
            if (r?.mun) incMap.set(canonicalMunicipio(r.mun), { ...r });
          }
          for (const [mun, vals] of muniFires.entries()) {
            const ex = incMap.get(mun);
            if (ex) {
              ex.urb = vals.urb;
              ex.flor = vals.flor;
              ex.focos = vals.focos;
              ex.total_periodo = vals.urb + vals.flor;
            } else {
              incMap.set(mun, { mun, urb: vals.urb, flor: vals.flor, focos: vals.focos, total_periodo: vals.urb + vals.flor });
            }
          }
          (row as any).incendios = Array.from(incMap.values()).sort((a, b) => compareMunicipios(a.mun, b.mun));
        }
      } else {
        const { fetchOperationalDonor } = await import("./sheets-fallback.server");
        const donor = await fetchOperationalDonor(context.supabase, data.date);
        const targetInc = Array.from(muniFires.entries()).map(([mun, vals]) => ({
          mun,
          urb: vals.urb,
          flor: vals.flor,
          focos: vals.focos,
          total_periodo: vals.urb + vals.flor,
        }));
        const harmonized = harmonizeMunicipalitySections(
          donor?.efetivo || [],
          donor?.recursos || [],
          targetInc,
          (mun) => ({ mun, ord: 0, cbmam: 0, seg: 0, brig: 0 }),
          (mun) => ({ mun, viaturas: 0, aeronaves: 0, embarcacoes: 0 }),
          (mun) => ({ mun, urb: 0, flor: 0, focos: 0, total_periodo: 0 }),
        );
        row = {
          report_date: data.date,
          shift: data.shift,
          efetivo: harmonized.efetivo,
          recursos: harmonized.recursos,
          incendios: harmonized.incendios,
          outras: donor?.outras || [],
          notes: JSON.stringify({ occurrences }),
          created_by: context.userId,
          updated_by: context.userId,
          updated_at: new Date().toISOString(),
          version: 1,
        } as any;
      }
    }

    return { row: row ?? null, canEdit, isAdmin, occurrences };
  });

// ---------- Save (upsert) ----------

export const saveDailyReport = createServerFn({ method: "POST" })
  .middleware([requireBackendAuth])
  .inputValidator((raw: unknown) => DailyReportSchema.parse(raw))
  .handler(async ({ data, context }) => {
    const dbClient = context.supabase;

    const [{ data: rolesData }, { data: existing, error: readErr }] = await Promise.all([
      dbClient.from("user_roles").select("role").eq("user_id", context.userId),
      dbClient
        .from("daily_reports")
        .select("id, created_by")
        .eq("report_date", data.report_date)
        .eq("shift", data.shift)
        .maybeSingle(),
    ]);
    if (readErr) dbFail(readErr, "daily-reports");

    const roles = new Set((rolesData ?? []).map((r: any) => r.role));
    const isAdmin = roles.has("admin");
    // Todos os usuários autenticados têm permissão para editar os dados da Inserção

    const harmonized = harmonizeMunicipalitySections(
      data.efetivo as any,
      data.recursos as any,
      data.incendios as any,
      (mun) => ({ mun, ord: 0, cbmam: 0, seg: 0, brig: 0 }),
      (mun) => ({ mun, viaturas: 0, aeronaves: 0, embarcacoes: 0 }),
      (mun) => ({ mun, urb: 0, flor: 0, focos: 0, total_periodo: 0 }),
    );

    const payload = {
      report_date: data.report_date,
      shift: data.shift,
      efetivo: harmonized.efetivo as any,
      recursos: harmonized.recursos as any,
      incendios: harmonized.incendios as any,
      outras: data.outras as any,
      notes: data.notes ?? null,
      updated_by: context.userId,
    };

    if (existing) {
      const { error } = await dbClient
        .from("daily_reports")
        .update(payload)
        .eq("id", existing.id);
      if (error) dbFail(error, "daily-reports");
      return { id: existing.id, created: false };
    }
    const { data: inserted, error } = await dbClient
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
