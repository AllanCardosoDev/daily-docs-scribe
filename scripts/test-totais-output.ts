import { createClient } from "@supabase/supabase-js";
import { canonicalMunicipio, compareMunicipios } from "../src/lib/municipio-order";

const supabase = createClient(
  "https://zeyxclvokbllixyezgoe.supabase.co",
  "sb_publishable_B608rXzlGxV4b0yk-6XaBw_riQTnj7y"
);

async function testTotaisAggregation() {
  await supabase.auth.signInWithPassword({
    email: "salacbmam@gmail.com",
    password: "9p&8jA_))rF$e6C",
  });

  const { data: dbRows } = await supabase
    .from("daily_reports")
    .select("report_date, shift, incendios");

  const map = new Map<string, Record<string, number>>();
  const nameMap = new Map<string, string>();

  for (const r of dbRows ?? []) {
    const list = (r.incendios as any[]) ?? [];
    for (const item of list) {
      const mun = canonicalMunicipio(item.mun ?? item.municipio);
      if (!mun || mun === "—") continue;
      const key = mun.toLowerCase();
      nameMap.set(key, mun);

      const cur = map.get(key) ?? { urb: 0, flor: 0, focos: 0 };
      cur.urb += Number(item.urb) || 0;
      cur.flor += Number(item.flor) || 0;
      cur.focos += Number(item.focos) || 0;
      map.set(key, cur);
    }
  }

  const aggregated = Array.from(map.entries())
    .map(([key, vals]) => ({ mun: nameMap.get(key) || key, ...vals }))
    .sort((a, b) => compareMunicipios(a.mun, b.mun));

  console.log("Total de municípios únicos na tabela Totais:", aggregated.length);
  const manausEntries = aggregated.filter(r => r.mun.toLowerCase() === "manaus");
  console.log("Entradas de Manaus encontradas:", manausEntries);
}

testTotaisAggregation().catch(console.error);
