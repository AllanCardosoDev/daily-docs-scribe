import { createClient } from "@supabase/supabase-js";
import fs from "fs";
import { canonicalMunicipio, manausFirst, harmonizeMunicipalitySections } from "../src/lib/municipio-order";
import { isFlorestalAmbiental } from "../src/lib/fire-classification";

const envText = fs.readFileSync(".env", "utf-8");
const env: Record<string, string> = {};
envText.split("\n").forEach((line) => {
  const [k, ...v] = line.split("=");
  if (k && v.length > 0) env[k.trim()] = v.join("=").trim().replace(/(^["']|["']$)/g, "");
});

const url = env.SUPABASE_URL || env.VITE_SUPABASE_URL;
const key = env.SUPABASE_SERVICE_ROLE_KEY || env.VITE_SUPABASE_ANON_KEY;
const supabase = createClient(url, key);

function ensureAllMunicipios(rows: any[], defaultFactory: (mun: string) => any) {
  const map = new Map<string, any>();
  for (const r of rows) {
    const mun = canonicalMunicipio(r.mun || r.municipio);
    map.set(mun, { ...r, mun });
  }
  return manausFirst(Array.from(map.values()));
}

async function alignDays26And27() {
  console.log("=== ALINHANDO DIAS 26 E 27 COM PRECISÃO DE 100% ===");

  const allOccs = JSON.parse(fs.readFileSync("src/data/occurrences.json", "utf-8"));

  // ----------------------------------------------------
  // DIA 26
  // ----------------------------------------------------
  console.log("\n--- Sincronizando Dia 26/10/2026 ---");
  const occs26 = allOccs.filter((o: any) => o.data === "2026-10-26");
  console.log(`Carregadas ${occs26.length} ocorrências oficiais de 26/10`);

  const map26 = new Map<string, { urb: number; flor: number; focos: number; total_periodo: number }>();
  for (const occ of occs26) {
    const mun = canonicalMunicipio(occ.municipio);
    const cur = map26.get(mun) || { urb: 0, flor: 0, focos: 0, total_periodo: 0 };
    const nat = String(occ.natureza || "").toLowerCase();
    if (nat.includes("apoio") && !nat.includes("incêndio") && !nat.includes("fogo")) continue;
    
    if (isFlorestalAmbiental(occ.natureza)) cur.flor += 1;
    else cur.urb += 1;
    cur.focos += Math.max(1, Number(occ.focos) || 1);
    cur.total_periodo += 1;
    map26.set(mun, cur);
  }

  // Buscar template de efetivo/recursos de 25/10
  const { data: donor25 } = await supabase
    .from("daily_reports")
    .select("*")
    .eq("report_date", "2026-10-25")
    .eq("shift", "noturno")
    .single();

  const incendios26 = ensureAllMunicipios(
    Array.from(map26.entries()).map(([mun, vals]) => ({ mun, ...vals })),
    (mun) => ({ mun, urb: 0, flor: 0, focos: 0, total_periodo: 0 })
  );

  const harmonized26 = harmonizeMunicipalitySections(
    donor25.efetivo,
    donor25.recursos,
    incendios26,
    (mun) => ({ mun, cbmam: 0, ord: 0, seg: 0, brig: 0 }),
    (mun) => ({ mun, viaturas: 0, aeronaves: 0, embarcacoes: 0 }),
    (mun) => ({ mun, urb: 0, flor: 0, focos: 0, total_periodo: 0 })
  );

  const notes26 = {
    header: {
      titulo: "Relatório Diário — Sala de Situação",
      periodo: "26/10/2026 · 24h (18:30-07:00)",
      proximoPeriodo: "27/10/2026 · 24h (18:30-07:00)",
      reuniaoPlanejamento: "26/10/2026 – 8H15",
      reuniaoBriefing: "26/10/2026 – 8H30",
      comandante: "CEL QOBM BORGES",
      chefeCapital: "CEL QOBM MENEZES",
      chefeInterior: "CEL QOBM MONTEIRO",
      coordSituacao: "CEL QOBM FERREIRA",
      coordenador: "CEL QOBM CRISTIANO BRAZ FERREIRA",
      subcomandante: "Subcomandante-Geral do CBMAM",
    },
    occurrences: occs26,
  };

  await supabase.from("daily_reports").upsert(
    {
      report_date: "2026-10-26",
      shift: "noturno",
      efetivo: harmonized26.efetivo,
      recursos: harmonized26.recursos,
      incendios: harmonized26.incendios,
      outras: donor25.outras,
      notes: JSON.stringify(notes26),
      updated_at: new Date().toISOString(),
    },
    { onConflict: "report_date,shift" }
  );
  console.log("✓ Dia 26 (noturno) atualizado com sucesso!");

  // ----------------------------------------------------
  // DIA 27
  // ----------------------------------------------------
  console.log("\n--- Sincronizando Dia 27/10/2026 ---");
  const occs27 = allOccs.filter((o: any) => o.data === "2026-10-27");
  console.log(`Carregadas ${occs27.length} ocorrências oficiais de 27/10:`);
  for (const o of occs27) {
    console.log(`  [${o.horario}] ${o.municipio} - ${o.natureza} (focos: ${o.focos})`);
  }

  const map27 = new Map<string, { urb: number; flor: number; focos: number; total_periodo: number }>();
  for (const occ of occs27) {
    const mun = canonicalMunicipio(occ.municipio);
    const cur = map27.get(mun) || { urb: 0, flor: 0, focos: 0, total_periodo: 0 };
    const nat = String(occ.natureza || "").toLowerCase();
    if (nat.includes("apoio") && !nat.includes("incêndio") && !nat.includes("fogo")) continue;
    
    if (isFlorestalAmbiental(occ.natureza)) cur.flor += 1;
    else cur.urb += 1;
    cur.focos += Math.max(1, Number(occ.focos) || 1);
    cur.total_periodo += 1;
    map27.set(mun, cur);
  }

  const incendios27 = ensureAllMunicipios(
    Array.from(map27.entries()).map(([mun, vals]) => ({ mun, ...vals })),
    (mun) => ({ mun, urb: 0, flor: 0, focos: 0, total_periodo: 0 })
  );

  const harmonized27 = harmonizeMunicipalitySections(
    donor25.efetivo,
    donor25.recursos,
    incendios27,
    (mun) => ({ mun, cbmam: 0, ord: 0, seg: 0, brig: 0 }),
    (mun) => ({ mun, viaturas: 0, aeronaves: 0, embarcacoes: 0 }),
    (mun) => ({ mun, urb: 0, flor: 0, focos: 0, total_periodo: 0 })
  );

  const notes27 = {
    header: {
      titulo: "Relatório Diário — Sala de Situação",
      periodo: "27/10/2026 · 24h (18:30-07:00)",
      proximoPeriodo: "28/10/2026 · 24h (18:30-07:00)",
      reuniaoPlanejamento: "27/10/2026 – 8H15",
      reuniaoBriefing: "27/10/2026 – 8H30",
      comandante: "CEL QOBM BORGES",
      chefeCapital: "CEL QOBM MENEZES",
      chefeInterior: "CEL QOBM MONTEIRO",
      coordSituacao: "CEL QOBM FERREIRA",
      coordenador: "CEL QOBM CRISTIANO BRAZ FERREIRA",
      subcomandante: "Subcomandante-Geral do CBMAM",
    },
    occurrences: occs27,
  };

  await supabase.from("daily_reports").upsert(
    {
      report_date: "2026-10-27",
      shift: "noturno",
      efetivo: harmonized27.efetivo,
      recursos: harmonized27.recursos,
      incendios: harmonized27.incendios,
      outras: donor25.outras,
      notes: JSON.stringify(notes27),
      updated_at: new Date().toISOString(),
    },
    { onConflict: "report_date,shift" }
  );
  console.log("✓ Dia 27 (noturno) atualizado com sucesso!");

  // Também criar/atualizar o parcial de 27 com os mesmos dados de base se desejado
  await supabase.from("daily_reports").upsert(
    {
      report_date: "2026-10-27",
      shift: "parcial",
      efetivo: harmonized27.efetivo,
      recursos: harmonized27.recursos,
      incendios: harmonized27.incendios,
      outras: donor25.outras,
      notes: JSON.stringify({
        ...notes27,
        header: {
          ...notes27.header,
          periodo: "27/10/2026 · Parcial (07:00-18:30)",
        },
      }),
      updated_at: new Date().toISOString(),
    },
    { onConflict: "report_date,shift" }
  );
  console.log("✓ Dia 27 (parcial) atualizado com sucesso!");

  console.log("\nSoma final dia 27:");
  let totalUrb27 = 0, totalFlor27 = 0, totalFocos27 = 0, totalInc27 = 0;
  for (const r of harmonized27.incendios) {
    totalUrb27 += r.urb;
    totalFlor27 += r.flor;
    totalFocos27 += r.focos;
    totalInc27 += r.total_periodo;
  }
  console.log(`  Urbanos: ${totalUrb27} | Florestais: ${totalFlor27} | Focos: ${totalFocos27} | Total Incêndios: ${totalInc27}`);
}

alignDays26And27().catch(console.error);
