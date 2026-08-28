import { createClient } from "@supabase/supabase-js";

const supabase = createClient(
  process.env.SUPABASE_URL || "https://zeyxclvokbllixyezgoe.supabase.co",
  process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_PUBLISHABLE_KEY || ""
);

async function run() {
  const { data: rows, error } = await supabase
    .from("daily_reports")
    .select("report_date, shift, incendios, outras, efetivo, recursos")
    .order("report_date", { ascending: true });

  if (error || !rows) {
    console.error("Error:", error);
    return;
  }

  console.log("Total de linhas em daily_reports:", rows.length);

  const byYear: Record<string, { count: number; inc: number; outras: number; ef: number; rec: number }> = {};
  for (const r of rows) {
    const year = r.report_date.split("-")[0];
    if (!byYear[year]) byYear[year] = { count: 0, inc: 0, outras: 0, ef: 0, rec: 0 };
    byYear[year].count++;

    const incList = Array.isArray(r.incendios) ? r.incendios : [];
    const incSum = incList.reduce((s: number, x: any) => s + (Number(x.urb || x.incendio_urbano || 0) + Number(x.flor || x.incendio_florestal || 0)), 0);
    byYear[year].inc += incSum;

    const outList = Array.isArray(r.outras) ? r.outras : [];
    const outSum = outList.reduce((s: number, x: any) => s + (Number(x.salvamento || 0) + Number(x.acidentes || 0) + Number(x.aph || 0) + Number(x.prevencao || 0) + Number(x.servicos || 0)), 0);
    byYear[year].outras += outSum;

    const efList = Array.isArray(r.efetivo) ? r.efetivo : [];
    const efSum = efList.reduce((s: number, x: any) => s + (Number(x.ord || 0) + Number(x.seg || 0) + Number(x.brig || 0)), 0);
    byYear[year].ef += efSum;

    const recList = Array.isArray(r.recursos) ? r.recursos : [];
    const recSum = recList.length;
    byYear[year].rec += recSum;
  }

  console.log("Estatísticas por Ano:", JSON.stringify(byYear, null, 2));

  // Let's inspect where 2025 data came from
  const r2025 = rows.filter(r => r.report_date.startsWith("2025"));
  console.log("Total 2025 rows:", r2025.length);
  if (r2025.length > 0) {
    console.log("Sample 2025 row:", {
      date: r2025[0].report_date,
      incendios_sample: Array.isArray(r2025[0].incendios) ? r2025[0].incendios.slice(0, 2) : r2025[0].incendios,
      outras_sample: r2025[0].outras,
      efetivo_sample: r2025[0].efetivo,
    });
  }
}

run();
