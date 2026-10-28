import { createFileRoute } from "@tanstack/react-router";
import * as XLSX from "xlsx";
import {
  getEfetivoMapasPayload,
  buildEfetivoMapasWorkbook,
} from "@/lib/efetivo-mapas";
import { EMPTY_SHEETS_DATA, type SheetsData } from "@/lib/sheets.types";
import { createClient } from "@supabase/supabase-js";
import { OWN_PROJECT_URL } from "@/integrations/backend/own-project";

export const Route = createFileRoute("/api/public/efetivo")({
  server: {
    handlers: {
      GET: handler,
    },
  },
});

async function handler({ request }: { request: Request }) {
  const url = new URL(request.url);
  const format = url.searchParams.get("format")?.toLowerCase() || "json";
  const dateParam = url.searchParams.get("date") || undefined;

  let reportDate: Date = new Date();
  let dateIso = new Date().toISOString().split("T")[0];

  if (dateParam && /^\d{4}-\d{2}-\d{2}$/.test(dateParam)) {
    dateIso = dateParam;
    const [y, m, d] = dateParam.split("-").map(Number);
    reportDate = new Date(y, m - 1, d);
  }

  let sheetsData: SheetsData = EMPTY_SHEETS_DATA;

  try {
    const supabaseUrl =
      process.env.CUSTOM_SUPABASE_URL ??
      process.env.VITE_CUSTOM_SUPABASE_URL ??
      process.env.SUPABASE_URL ??
      OWN_PROJECT_URL;
    const serviceKey =
      process.env.CUSTOM_SUPABASE_SERVICE_ROLE_KEY ??
      process.env.SUPABASE_SERVICE_ROLE_KEY;

    if (supabaseUrl && serviceKey) {
      const supabase = createClient(supabaseUrl, serviceKey, {
        auth: { persistSession: false },
      });

      const { loadReportByDate, loadLatestDriveReport } = await import(
        "@/lib/sheets-fallback.server"
      );
      if (dateParam) {
        const res = await loadReportByDate(supabase, dateIso);
        if (res?.data) sheetsData = res.data;
      } else {
        const res = await loadLatestDriveReport(supabase);
        if (res?.data) sheetsData = res.data;
      }
    }
  } catch (err) {
    console.warn("[API /api/public/efetivo] Falha ao carregar do Supabase:", err);
  }

  if (format === "xlsx") {
    const wb = buildEfetivoMapasWorkbook(sheetsData, reportDate);
    const buf = XLSX.write(wb, { type: "buffer", bookType: "xlsx" });

    return new Response(buf, {
      status: 200,
      headers: {
        "Content-Type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        "Content-Disposition": `attachment; filename="EFETIVO-CBMAM-MAPAS-${dateIso}.xlsx"`,
        "Access-Control-Allow-Origin": "*",
        "Cache-Control": "no-cache, no-store, must-revalidate",
      },
    });
  }

  // Formato padrão: JSON pronto para o Mapas (efetivoDB)
  const payload = getEfetivoMapasPayload(sheetsData, reportDate);

  return Response.json(payload, {
    status: 200,
    headers: {
      "Content-Type": "application/json; charset=utf-8",
      "Access-Control-Allow-Origin": "*",
      "Access-Control-Allow-Methods": "GET, OPTIONS",
      "Cache-Control": "no-cache, no-store, must-revalidate",
    },
  });
}
