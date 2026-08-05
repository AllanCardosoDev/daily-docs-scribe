import { createFileRoute } from "@tanstack/react-router";
import { createClient } from "@supabase/supabase-js";

/**
 * Sincronização agendada com a pasta pública do Google Drive.
 *
 * Chamada por um agendador externo (cron) com o cabeçalho `x-cron-secret`.
 * Mantém `daily_reports` sempre espelhando as planilhas oficiais publicadas.
 *
 * Ex.: curl -H "x-cron-secret: ***" https://<app>/api/public/drive-sync?days=3
 */
export const Route = createFileRoute("/api/public/drive-sync")({
  server: {
    handlers: {
      POST: handler,
      GET: handler,
    },
  },
});

async function handler({ request }: { request: Request }) {
  const secret = process.env.DRIVE_SYNC_SECRET;
  if (!secret) {
    return Response.json({ error: "Sincronização não configurada." }, { status: 503 });
  }

  const url = new URL(request.url);
  const provided =
    request.headers.get("x-cron-secret") ??
    request.headers.get("authorization")?.replace(/^Bearer\s+/i, "") ??
    "";
  if (provided !== secret) {
    return new Response("Unauthorized", { status: 401 });
  }

  const supabaseUrl =
    process.env.CUSTOM_SUPABASE_URL ??
    process.env.VITE_CUSTOM_SUPABASE_URL ??
    process.env.SUPABASE_URL;
  const serviceKey =
    process.env.CUSTOM_SUPABASE_SERVICE_ROLE_KEY ?? process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!supabaseUrl || !serviceKey) {
    return Response.json({ error: "Backend não configurado." }, { status: 503 });
  }

  const supabase = createClient(supabaseUrl, serviceKey, {
    auth: { persistSession: false, autoRefreshToken: false },
    global: {
      fetch: (input, init) => {
        const headers = new Headers(init?.headers);
        // Chaves opacas (sb_secret_*) vão apenas no cabeçalho `apikey`.
        if (serviceKey.startsWith("sb_")) headers.delete("Authorization");
        headers.set("apikey", serviceKey);
        return fetch(input as any, { ...init, headers });
      },
    },
  });

  const days = Number(url.searchParams.get("days") ?? 3);
  const folderId = url.searchParams.get("folder") ?? undefined;

  const [{ syncDriveFolder }, { DEFAULT_DRIVE_FOLDER_ID }] = await Promise.all([
    import("@/lib/drive-sync.server"),
    import("@/lib/drive-config"),
  ]);

  try {
    const result = await syncDriveFolder({
      supabase,
      folderId: folderId || DEFAULT_DRIVE_FOLDER_ID,
      sinceDays: Number.isFinite(days) ? Math.min(Math.max(days, 1), 120) : 3,
      maxFiles: 40,
      actorId: null,
    });
    return Response.json({ ok: true, ...result });
  } catch (e) {
    console.error("[drive-sync]", e);
    return Response.json(
      { ok: false, error: (e as Error)?.message ?? "Falha na sincronização." },
      { status: 500 },
    );
  }
}
