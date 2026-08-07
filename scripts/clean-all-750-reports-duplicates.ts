import { createClient } from "@supabase/supabase-js";
import { canonicalMunicipio, compareMunicipios } from "../src/lib/municipio-order";

const supabase = createClient(
  "https://zeyxclvokbllixyezgoe.supabase.co",
  "sb_publishable_B608rXzlGxV4b0yk-6XaBw_riQTnj7y"
);

function mergeDuplicates(list: any[]): any[] {
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

  // Ordena com Manaus primeiro, depois alfabético
  const result = Array.from(map.values());
  const manaus = result.filter(r => r.mun?.toLowerCase() === "manaus");
  const rest = result.filter(r => r.mun?.toLowerCase() !== "manaus").sort((a, b) => compareMunicipios(a.mun, b.mun));
  return [...manaus, ...rest];
}

async function cleanAllDuplicates() {
  console.log("📡 Autenticando no Supabase...");
  await supabase.auth.signInWithPassword({
    email: "salacbmam@gmail.com",
    password: "9p&8jA_))rF$e6C",
  });

  console.log("🔍 Buscando todos os relatórios do Supabase...");
  const { data: rows, error } = await supabase
    .from("daily_reports")
    .select("id, report_date, shift, efetivo, recursos, incendios, outras");

  if (error || !rows) {
    console.error("Erro ao buscar relatórios:", error);
    process.exit(1);
  }

  console.log(`Analizando ${rows.length} relatórios para fusão de municípios duplicados...`);

  let updatedCount = 0;
  let totalDuplicatesMerged = 0;

  for (const row of rows) {
    const origEf = (row.efetivo as any[]) ?? [];
    const origRec = (row.recursos as any[]) ?? [];
    const origInc = (row.incendios as any[]) ?? [];
    const origOut = (row.outras as any[]) ?? [];

    const cleanedEf = mergeDuplicates(origEf);
    const cleanedRec = mergeDuplicates(origRec);
    const cleanedInc = mergeDuplicates(origInc);
    const cleanedOut = mergeDuplicates(origOut);

    const hasMerged =
      cleanedEf.length !== origEf.length ||
      cleanedRec.length !== origRec.length ||
      cleanedInc.length !== origInc.length ||
      cleanedOut.length !== origOut.length;

    if (hasMerged) {
      totalDuplicatesMerged++;
      const { error: upErr } = await supabase
        .from("daily_reports")
        .update({
          efetivo: cleanedEf as any,
          recursos: cleanedRec as any,
          incendios: cleanedInc as any,
          outras: cleanedOut as any,
        })
        .eq("id", row.id);

      if (upErr) {
        console.error(`Erro ao atualizar id ${row.id}:`, upErr.message);
      } else {
        updatedCount++;
      }
    }
  }

  console.log(`\n✅ Higienização de Duplicidades Concluída com Sucesso!`);
  console.log(`  - Total de relatórios verificados: ${rows.length}`);
  console.log(`  - Relatórios com municípios duplicados corrigidos e fundidos: ${updatedCount}`);
}

cleanAllDuplicates().catch(console.error);
