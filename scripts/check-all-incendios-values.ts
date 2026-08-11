import { createClient } from "@supabase/supabase-js";

const supabase = createClient(
  "https://zeyxclvokbllixyezgoe.supabase.co",
  "sb_publishable_B608rXzlGxV4b0yk-6XaBw_riQTnj7y"
);

async function check() {
  await supabase.auth.signInWithPassword({
    email: "salacbmam@gmail.com",
    password: "9p&8jA_))rF$e6C",
  });

  const { data: rows, error } = await supabase
    .from("daily_reports")
    .select("id, report_date, shift, incendios");

  if (error || !rows) {
    console.error("Error:", error);
    return;
  }

  let highCount = 0;
  for (const r of rows) {
    const incendios = (r.incendios as any[]) ?? [];
    const hasAbsurd = incendios.some(item => (item.urb > 50 || item.flor > 50));
    if (hasAbsurd) {
      highCount++;
      const manaus = incendios.find(x => (x.mun || x.municipio || "").toLowerCase().includes("manaus"));
      console.log(`⚠️ ID ${r.id} | ${r.report_date} (${r.shift}) -> Manaus: urb=${manaus?.urb}, flor=${manaus?.flor}, focos=${manaus?.focos}`);
    }
  }
  console.log(`\nTotal relatórios no banco: ${rows.length}`);
  console.log(`Relatórios com valores acumulados/absurdos em incendios_diario: ${highCount}`);
}

check().catch(console.error);
