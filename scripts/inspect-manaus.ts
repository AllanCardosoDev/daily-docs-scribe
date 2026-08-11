import { createClient } from "@supabase/supabase-js";

const supabase = createClient(
  "https://zeyxclvokbllixyezgoe.supabase.co",
  "sb_publishable_B608rXzlGxV4b0yk-6XaBw_riQTnj7y"
);

async function inspect() {
  await supabase.auth.signInWithPassword({
    email: "salacbmam@gmail.com",
    password: "9p&8jA_))rF$e6C",
  });

  const { data, error } = await supabase
    .from("daily_reports")
    .select("report_date, shift, incendios")
    .order("report_date", { ascending: false })
    .limit(5);

  console.log("Error:", error);
  for (const r of data ?? []) {
    console.log(`\n📅 Data: ${r.report_date} (${r.shift})`);
    const manaus = (r.incendios as any[])?.find(x => (x.mun || x.municipio || "").toLowerCase().includes("manaus"));
    console.log("Manaus incendios:", manaus);
    const apui = (r.incendios as any[])?.find(x => (x.mun || x.municipio || "").toLowerCase().includes("apui"));
    console.log("Apuí incendios:", apui);
  }
}

inspect().catch(console.error);
