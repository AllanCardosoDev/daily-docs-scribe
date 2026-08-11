import { createClient } from "@supabase/supabase-js";
import { canonicalMunicipio, compareMunicipios } from "../src/lib/municipio-order";

const supabase = createClient(
  "https://zeyxclvokbllixyezgoe.supabase.co",
  "sb_publishable_B608rXzlGxV4b0yk-6XaBw_riQTnj7y"
);

function cleanList(list: any[]): any[] {
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

async function fixManausOnly() {
  console.log("📡 Autenticando no Supabase...");
  await supabase.auth.signInWithPassword({
    email: "salacbmam@gmail.com",
    password: "9p&8jA_))rF$e6C",
  });

  const { data: rows, error } = await supabase
    .from("daily_reports")
    .select("id, report_date, shift, efetivo, recursos, incendios, outras");

  if (error || !rows) {
    console.error("Erro:", error);
    return;
  }

  let fixedCount = 0;

  for (const r of rows) {
    const str = JSON.stringify(r);
    // Só atualiza se contiver a palavra "manaus" em minúsculo
    if (str.includes('"manaus"')) {
      const cleanedEf = cleanList((r.efetivo as any[]) ?? []);
      const cleanedRec = cleanList((r.recursos as any[]) ?? []);
      const cleanedInc = cleanList((r.incendios as any[]) ?? []);
      const cleanedOut = cleanList((r.outras as any[]) ?? []);

      const { error: upErr } = await supabase
        .from("daily_reports")
        .update({
          efetivo: cleanedEf as any,
          recursos: cleanedRec as any,
          incendios: cleanedInc as any,
          outras: cleanedOut as any,
        })
        .eq("id", r.id);

      if (!upErr) fixedCount++;
    }
  }

  console.log(`\n🎉 FUSÃO CONCLUÍDA! ${fixedCount} relatórios que continham "manaus" minúsculo foram corrigidos e fundidos.`);
}

fixManausOnly().catch(console.error);
