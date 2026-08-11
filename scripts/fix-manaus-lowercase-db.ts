import { createClient } from "@supabase/supabase-js";
import { canonicalMunicipio, compareMunicipios } from "../src/lib/municipio-order";

const supabase = createClient(
  "https://zeyxclvokbllixyezgoe.supabase.co",
  "sb_publishable_B608rXzlGxV4b0yk-6XaBw_riQTnj7y"
);

function cleanAndMergeList(list: any[]): any[] {
  if (!Array.isArray(list) || list.length === 0) return [];
  const map = new Map<string, any>();

  for (const r of list) {
    const rawMun = r?.mun ?? r?.municipio;
    if (!rawMun) continue;
    const mun = canonicalMunicipio(rawMun);
    const key = mun.toLowerCase();

    const existing = map.get(key);
    if (!existing) {
      const copy = { ...r, mun };
      if ("municipio" in copy) delete copy.municipio;
      map.set(key, copy);
    } else {
      for (const [k, v] of Object.entries(r)) {
        if (k === "mun" || k === "municipio") continue;
        const num1 = Number(existing[k]) || 0;
        const num2 = Number(v) || 0;
        existing[k] = num1 + num2;
      }
    }
  }

  const result = Array.from(map.values());
  const manaus = result.filter(r => r.mun?.toLowerCase() === "manaus");
  const rest = result.filter(r => r.mun?.toLowerCase() !== "manaus").sort((a, b) => compareMunicipios(a.mun, b.mun));
  return [...manaus, ...rest];
}

async function fixManausDb() {
  console.log("📡 Autenticando no Supabase...");
  await supabase.auth.signInWithPassword({
    email: "salacbmam@gmail.com",
    password: "9p&8jA_))rF$e6C",
  });

  const { data: rows, error } = await supabase
    .from("daily_reports")
    .select("id, report_date, shift, efetivo, recursos, incendios, outras");

  if (error || !rows) {
    console.error("Erro ao buscar dados:", error);
    process.exit(1);
  }

  console.log(`Verificando ${rows.length} relatórios para higienização estrita de manaus/Manaus...`);

  let updatedCount = 0;

  for (const r of rows) {
    const cleanedEf = cleanAndMergeList((r.efetivo as any[]) ?? []);
    const cleanedRec = cleanAndMergeList((r.recursos as any[]) ?? []);
    const cleanedInc = cleanAndMergeList((r.incendios as any[]) ?? []);
    const cleanedOut = cleanAndMergeList((r.outras as any[]) ?? []);

    const { error: upErr } = await supabase
      .from("daily_reports")
      .update({
        efetivo: cleanedEf as any,
        recursos: cleanedRec as any,
        incendios: cleanedInc as any,
        outras: cleanedOut as any,
      })
      .eq("id", r.id);

    if (upErr) {
      console.error(`Erro ao atualizar ${r.id}:`, upErr.message);
    } else {
      updatedCount++;
    }
  }

  console.log(`\n✅ Higienização concluída! ${updatedCount} relatórios atualizados no Supabase.`);
}

fixManausDb().catch(console.error);
