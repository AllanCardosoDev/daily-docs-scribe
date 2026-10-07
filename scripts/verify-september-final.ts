import { createClient } from "@supabase/supabase-js";

async function main() {
  const url = "https://zeyxclvokbllixyezgoe.supabase.co";
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY || "";

  const supabase = createClient(url, serviceKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });

  const { data: rows, error } = await supabase
    .from("daily_reports")
    .select("report_date, shift, efetivo, recursos, incendios, outras, notes")
    .gte("report_date", "2026-09-01")
    .lte("report_date", "2026-09-30")
    .order("report_date", { ascending: true })
    .order("shift", { ascending: false });

  if (error || !rows) {
    console.error("Erro:", error);
    return;
  }

  console.log(`\n================================================================`);
  console.log(`📊 AUDITORIA COMPLETA DE SETEMBRO/2026 (${rows.length} relatórios)`);
  console.log(`================================================================`);

  const daysMap = new Map<string, { noturno?: any; parcial?: any }>();
  for (let d = 1; d <= 30; d++) {
    const dayStr = `2026-09-${String(d).padStart(2, "0")}`;
    daysMap.set(dayStr, {});
  }

  for (const r of rows) {
    const dayObj = daysMap.get(r.report_date) || {};
    if (r.shift === "noturno") dayObj.noturno = r;
    if (r.shift === "parcial") dayObj.parcial = r;
    daysMap.set(r.report_date, dayObj);
  }

  let totalUrb = 0;
  let totalFlor = 0;
  let totalEfetivoNoturno = 0;

  for (const [day, data] of daysMap.entries()) {
    const hasNoturno = !!data.noturno;
    const hasParcial = !!data.parcial;

    const noturnoInc = (data.noturno?.incendios as any[]) || [];
    const noturnoEf = (data.noturno?.efetivo as any[]) || [];
    const noturnoRec = (data.noturno?.recursos as any[]) || [];
    const noturnoOutras = (data.noturno?.outras as any[]) || [];

    const dayUrb = noturnoInc.reduce((s, x) => s + (x.urb || 0), 0);
    const dayFlor = noturnoInc.reduce((s, x) => s + (x.flor || 0), 0);
    const dayEf = noturnoEf.reduce((s, x) => s + (x.ord || 0) + (x.seg || 0) + (x.brig || 0), 0);

    totalUrb += dayUrb;
    totalFlor += dayFlor;
    totalEfetivoNoturno += dayEf;

    const notesSummary = data.noturno?.notes ? (data.noturno.notes.includes("Preenchido") ? " [Preenchido via Parcial]" : "") : "";

    console.log(
      `${day} | 24h: ${hasNoturno ? "✅" : "❌"} (${noturnoInc.length} mun, ${dayUrb} urb, ${dayFlor} flor, ${dayEf} ef) | Parcial: ${hasParcial ? "✅" : "❌"}${notesSummary}`
    );
  }

  console.log(`\n----------------------------------------------------------------`);
  console.log(`TOTAL SETEMBRO (24h/Noturno):`);
  console.log(`- Incêndios Urbanos: ${totalUrb}`);
  console.log(`- Incêndios Florestais: ${totalFlor}`);
  console.log(`- Total de Incêndios (Urb + Flor): ${totalUrb + totalFlor}`);
  console.log(`- Média diária de efetivo empregado: ${(totalEfetivoNoturno / 30).toFixed(1)}`);
  console.log(`================================================================\n`);
}

main().catch(console.error);
