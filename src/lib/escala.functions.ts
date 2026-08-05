import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireBackendAuth } from "@/integrations/backend/auth-middleware";
import { dbFail } from "./server-errors";

async function assertAdmin(supabase: any, userId: string) {
  const { data, error } = await supabase.rpc("has_role", {
    _user_id: userId,
    _role: "admin",
  });
  if (error) dbFail(error, "escala");
  if (!data) throw new Error("Apenas administradores podem gerenciar a escala.");
}

// ------------------ Operators ------------------

export const listOperators = createServerFn({ method: "GET" })
  .middleware([requireBackendAuth])
  .handler(async ({ context }) => {
    const { data, error } = await context.supabase
      .from("escala_operators")
      .select("id, rank, name, phone, active, profile_id")
      .order("name");
    if (error) dbFail(error, "escala");
    return data ?? [];
  });

const OperatorInput = z.object({
  id: z.string().uuid().optional(),
  rank: z.string().trim().max(50).default(""),
  name: z.string().trim().min(1, "Nome obrigatório").max(120),
  phone: z.string().trim().max(30).default(""),
  active: z.boolean().default(true),
  profile_id: z.string().uuid().nullable().optional(),
});

export const saveOperator = createServerFn({ method: "POST" })
  .middleware([requireBackendAuth])
  .inputValidator((raw: unknown) => OperatorInput.parse(raw))
  .handler(async ({ data, context }) => {
    await assertAdmin(context.supabase, context.userId);
    const payload = {
      rank: data.rank ?? "",
      name: data.name,
      phone: data.phone ?? "",
      active: data.active,
      profile_id: data.profile_id ?? null,
    };
    if (data.id) {
      const { error } = await context.supabase
        .from("escala_operators")
        .update(payload)
        .eq("id", data.id);
      if (error) dbFail(error, "escala");
      return { id: data.id };
    }
    const { data: row, error } = await context.supabase
      .from("escala_operators")
      .insert(payload)
      .select("id")
      .single();
    if (error) dbFail(error, "escala");
    return { id: row.id as string };
  });

export const deleteOperator = createServerFn({ method: "POST" })
  .middleware([requireBackendAuth])
  .inputValidator((raw: unknown) => z.object({ id: z.string().uuid() }).parse(raw))
  .handler(async ({ data, context }) => {
    await assertAdmin(context.supabase, context.userId);
    const { error } = await context.supabase.from("escala_operators").delete().eq("id", data.id);
    if (error) dbFail(error, "escala");
    return { ok: true };
  });

// ------------------ Shifts ------------------

export const listShifts = createServerFn({ method: "GET" })
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
      })
      .parse(raw ?? {}),
  )
  .handler(async ({ data, context }) => {
    let q = context.supabase
      .from("escala_shifts")
      .select("id, shift_date, start_time, end_time, operator_id, notes")
      .order("shift_date");
    if (data.from) q = q.gte("shift_date", data.from);
    if (data.to) q = q.lte("shift_date", data.to);
    const { data: rows, error } = await q;
    if (error) dbFail(error, "escala");
    return rows ?? [];
  });

const ShiftInput = z.object({
  id: z.string().uuid().optional(),
  shift_date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Data inválida"),
  start_time: z.string().regex(/^\d{2}:\d{2}$/, "Hora inválida"),
  end_time: z.string().regex(/^\d{2}:\d{2}$/, "Hora inválida"),
  operator_id: z.string().uuid("Selecione um operador"),
  notes: z.string().trim().max(500).nullish(),
});

export const saveShift = createServerFn({ method: "POST" })
  .middleware([requireBackendAuth])
  .inputValidator((raw: unknown) => ShiftInput.parse(raw))
  .handler(async ({ data, context }) => {
    await assertAdmin(context.supabase, context.userId);
    if (data.start_time >= data.end_time) {
      throw new Error("Horário de início deve ser antes do término.");
    }
    const payload = {
      shift_date: data.shift_date,
      start_time: data.start_time,
      end_time: data.end_time,
      operator_id: data.operator_id,
      notes: data.notes ?? null,
      created_by: context.userId,
    };
    if (data.id) {
      const { error } = await context.supabase
        .from("escala_shifts")
        .update(payload)
        .eq("id", data.id);
      if (error) dbFail(error, "escala");
      return { id: data.id };
    }
    const { data: row, error } = await context.supabase
      .from("escala_shifts")
      .insert(payload)
      .select("id")
      .single();
    if (error) dbFail(error, "escala");
    return { id: row.id as string };
  });

export const deleteShift = createServerFn({ method: "POST" })
  .middleware([requireBackendAuth])
  .inputValidator((raw: unknown) => z.object({ id: z.string().uuid() }).parse(raw))
  .handler(async ({ data, context }) => {
    await assertAdmin(context.supabase, context.userId);
    const { error } = await context.supabase.from("escala_shifts").delete().eq("id", data.id);
    if (error) dbFail(error, "escala");
    return { ok: true };
  });
