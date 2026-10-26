import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireBackendAuth } from "@/integrations/backend/auth-middleware";
import type { ImportSpreadsheetResult } from "./occurrences-import.server";

export const importSpreadsheetOccurrences = createServerFn({ method: "POST" })
  .middleware([requireBackendAuth])
  .inputValidator((input: unknown) =>
    z
      .object({
        fileName: z.string().min(1),
        base64Data: z.string().min(1),
      })
      .parse(input),
  )
  .handler(async ({ data: input, context }): Promise<ImportSpreadsheetResult> => {
    const { processSpreadsheetBuffer } = await import("./occurrences-import.server");
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

    const buffer = Buffer.from(input.base64Data, "base64");
    const dbClient = supabaseAdmin ?? context.supabase;

    return processSpreadsheetBuffer(buffer, input.fileName, dbClient);
  });
