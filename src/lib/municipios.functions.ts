import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireBackendAuth } from "@/integrations/backend/auth-middleware";
import { dbFail } from "./server-errors";

const NameSchema = z
  .string()
  .trim()
  .min(2, "Informe o nome do município.")
  .max(120, "Nome muito longo.");

export const listMunicipios = createServerFn({ method: "GET" })
  .middleware([requireBackendAuth])
  .handler(async ({ context }) => {
    const { data, error } = await context.supabase
      .from("municipios")
      .select("id, name, active")
      .order("name", { ascending: true });
    if (error) dbFail(error, "municipios");
    return data ?? [];
  });

export const createMunicipio = createServerFn({ method: "POST" })
  .middleware([requireBackendAuth])
  .inputValidator((raw: unknown) => z.object({ name: NameSchema }).parse(raw))
  .handler(async ({ data, context }) => {
    const { data: row, error } = await context.supabase
      .from("municipios")
      .insert({ name: data.name, created_by: context.userId })
      .select("id, name, active")
      .single();
    if (error) {
      if (error.code === "23505") throw new Error("Este município já está cadastrado.");
      dbFail(error, "municipios");
    }
    return row;
  });

export const updateMunicipio = createServerFn({ method: "POST" })
  .middleware([requireBackendAuth])
  .inputValidator((raw: unknown) =>
    z
      .object({
        id: z.string().uuid(),
        name: NameSchema.optional(),
        active: z.boolean().optional(),
      })
      .parse(raw),
  )
  .handler(async ({ data, context }) => {
    const patch: { name?: string; active?: boolean } = {};
    if (data.name !== undefined) patch.name = data.name;
    if (data.active !== undefined) patch.active = data.active;
    const { error } = await context.supabase.from("municipios").update(patch).eq("id", data.id);
    if (error) dbFail(error, "municipios");
    return { ok: true };
  });

export const deleteMunicipio = createServerFn({ method: "POST" })
  .middleware([requireBackendAuth])
  .inputValidator((raw: unknown) => z.object({ id: z.string().uuid() }).parse(raw))
  .handler(async ({ data, context }) => {
    const { error } = await context.supabase.from("municipios").delete().eq("id", data.id);
    if (error) dbFail(error, "municipios");
    return { ok: true };
  });
