import { createClient } from "@supabase/supabase-js";
import { canonicalMunicipio, compareMunicipios } from "../src/lib/municipio-order";

const supabase = createClient(
  "https://zeyxclvokbllixyezgoe.supabase.co",
  "sb_publishable_B608rXzlGxV4b0yk-6XaBw_riQTnj7y"
);

async function cleanDatabase() {
  console.log("📡 Autenticando e limpando dados no Supabase...");
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

  console.log(`Encontrados ${rows.length} relatórios para higienizar.`);

  const num = (v: any) => (Number(v) || 0);

  const cleanList = <T extends Record<string, any>>(list: any[], numericKeys: string[]): T[] => {
    if (!Array.isArray(list)) return [];
    const map = new Map<string, T>();
    for (const r of list) {
      const rawMun = r?.mun ?? r?.municipio;
      if (!rawMun) continue;
      const mun = canonicalMunicipio(rawMun);
      const existing = map.get(mun);
      if (!existing) {
        const copy = { ...r, mun };
        for (const k of numericKeys) (copy as any)[k] = num(r[k]);
        map.set(mun, copy);
      } else {
        for (const k of numericKeys) {
          (existing as any)[k] = num((existing as any)[k]) + num(r[k]);
        }
      }
    }
    return Array.from(map.values()).sort((a, b) => compareMunicipios(a.mun, b.mun));
  };

  let updatedCount = 0;

  for (const row of rows) {
    const cleanedEfetivo = cleanList(row.efetivo, ["ord", "seg", "brig"]);
    const cleanedInc = cleanList(row.incendios, ["urb", "flor", "focos", "sat", "area"]);
    const cleanedOutras = cleanList(row.outras, ["salvamento", "acidentes", "aph", "prevencao", "servicos"]);

    let cleanedRecursos = row.recursos;
    if (Array.isArray(row.recursos)) {
      const recMap = new Map<string, Record<string, any>>();
      for (const item of row.recursos) {
        const rawMun = item?.mun ?? item?.municipio;
        if (!rawMun) continue;
        const mun = canonicalMunicipio(rawMun);
        const existing = recMap.get(mun);
        if (!existing) {
          recMap.set(mun, { ...item, mun });
        } else {
          for (const [k, v] of Object.entries(item)) {
            if (k === "mun" || k === "municipio") continue;
            existing[k] = num(existing[k]) + num(v);
          }
        }
      }
      cleanedRecursos = Array.from(recMap.values()).sort((a, b) => compareMunicipios(a.mun, b.mun));
    }

    const { error: updateErr } = await supabase
      .from("daily_reports")
      .update({
        efetivo: cleanedEfetivo as any,
        recursos: cleanedRecursos as any,
        incendios: cleanedInc as any,
        outras: cleanedOutras as any,
      })
      .eq("id", row.id);

    if (updateErr) {
      console.error(`Erro ao atualizar id ${row.id}:`, updateErr.message);
    } else {
      updatedCount++;
    }
  }

  console.log(`✅ Higienização concluída com sucesso! ${updatedCount} relatórios atualizados no Supabase.`);
}

cleanDatabase().catch(console.error);
