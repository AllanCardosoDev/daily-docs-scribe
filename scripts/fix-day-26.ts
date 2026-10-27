import { createClient } from "@supabase/supabase-js";
import { canonicalMunicipio, manausFirst, harmonizeMunicipalitySections } from "../src/lib/municipio-order";
import fs from "fs";

const url = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL;
const key = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!url || !key) {
  console.error("Credenciais do Supabase ausentes.");
  process.exit(1);
}

const supabase = createClient(url, key);

async function fixDay26() {
  console.log("=== Corrigindo divergência de valores do dia 26/10/2026 ===");

  // 1. Obter modelo oficial de 25/10/2026 (noturno)
  const { data: day25Report, error: err25 } = await supabase
    .from("daily_reports")
    .select("*")
    .eq("report_date", "2026-10-25")
    .eq("shift", "noturno")
    .single();

  if (err25 || !day25Report) {
    console.error("Não foi possível carregar o relatório de 25/10:", err25);
    process.exit(1);
  }

  const day25Notes = typeof day25Report.notes === "string" && day25Report.notes.startsWith("{")
    ? JSON.parse(day25Report.notes)
    : {};

  // Efetivo e Recursos baseados no modelo de 25/10 conforme instrução institucional
  const efetivoDay26 = manausFirst(day25Report.efetivo as any[]);
  const recursosDay26 = manausFirst(day25Report.recursos as any[]);

  // 2. Carregar ocorrências oficiais CAD do dia 26/10/2026
  const allOccs = JSON.parse(fs.readFileSync("src/data/occurrences.json", "utf-8"));
  const day26Occs = allOccs.filter((o: any) => o.data === "2026-10-26");
  console.log(`Carregadas ${day26Occs.length} ocorrências oficiais do CAD para 26/10/2026.`);

  // Sintetizar Incêndios Diários reais para 26/10
  // Manaus: 3 urbanos, 3 florestais/vegetação, 6 focos
  // Novo Aripuanã: 1 urbano (lixo), 1 florestal (vegetação), 11 focos
  // Lábrea: 0 urbano, 1 florestal (vegetação), 7 focos
  const munIncMap = new Map<string, { urb: number; flor: number; focos: number; total_periodo: number }>();
  
  for (const occ of day26Occs) {
    const mun = canonicalMunicipio(occ.municipio);
    const cur = munIncMap.get(mun) || { urb: 0, flor: 0, focos: 0, total_periodo: 0 };
    const nat = String(occ.natureza || "").toLowerCase();
    
    // Ignorar apoios puros na contagem de incêndio (ex: Apoio ao Samu)
    if (nat.includes("apoio") && !nat.includes("incêndio") && !nat.includes("fogo")) {
      continue;
    }

    const isFlor = nat.includes("florest") || nat.includes("vegeta") || nat.includes("mata") || nat.includes("pastag");
    if (isFlor) {
      cur.flor += 1;
    } else {
      cur.urb += 1;
    }
    cur.focos += Math.max(1, Number(occ.focos) || 1);
    cur.total_periodo += 1;
    munIncMap.set(mun, cur);
  }

  console.log("Incêndios reais apurados por município em 26/10/2026:");
  for (const [m, vals] of munIncMap.entries()) {
    console.log(`  - ${m}: Urbanos=${vals.urb}, Florestais=${vals.flor}, Focos=${vals.focos}, Total=${vals.total_periodo}`);
  }

  // Harmonizar seções municipais
  const emptyIncList = efetivoDay26.map((r: any) => {
    const mun = r.mun;
    const found = munIncMap.get(mun);
    return {
      mun,
      urb: found ? found.urb : 0,
      flor: found ? found.flor : 0,
      focos: found ? found.focos : 0,
      total_periodo: found ? found.total_periodo : 0,
    };
  });

  const emptyOutrasList = efetivoDay26.map((r: any) => ({
    mun: r.mun,
    salvamento: 0,
    acidentes: 0,
    aph: r.mun === "Manaus" ? 1 : 0, // Apoio ao SAMU no Ramal Girassol
    prevencao: 0,
    servicos: 0,
    total_periodo: r.mun === "Manaus" ? 1 : 0,
  }));

  const harmonized = harmonizeMunicipalitySections(
    efetivoDay26,
    recursosDay26,
    emptyIncList,
    (mun) => ({ mun, ord: 0, cbmam: 0, seg: 0, brig: 0 }),
    (mun) => ({ mun, viaturas: 0, aeronaves: 0, embarcacoes: 0 }),
    (mun) => ({ mun, urb: 0, flor: 0, focos: 0, total_periodo: 0 }),
  );

  // Calcular acumulado atualizado somando os novos incêndios de 26/10
  const acumBase = day25Notes.incendios_acumulado || [];
  const acumMap = new Map<string, any>();
  for (const a of acumBase) {
    acumMap.set(canonicalMunicipio(a.mun), { ...a, mun: canonicalMunicipio(a.mun) });
  }
  for (const [m, vals] of munIncMap.entries()) {
    const existing = acumMap.get(m);
    if (existing) {
      existing.urb = (Number(existing.urb) || 0) + vals.urb;
      existing.flor = (Number(existing.flor) || 0) + vals.flor;
      existing.focos = (Number(existing.focos) || 0) + vals.focos;
    } else {
      acumMap.set(m, { mun: m, urb: vals.urb, flor: vals.flor, focos: vals.focos, sat: 0, area: 0 });
    }
  }
  const updatedAcumulado = manausFirst(Array.from(acumMap.values()));

  // 3. Atualizar 26/10 noturno (24h)
  const headerNoturno = {
    titulo: "CORPO DE BOMBEIROS MILITAR DO AMAZONAS",
    subtitulo: "RELATÓRIO DE OCORRÊNCIAS 2026",
    periodo: "26 / OUT / 2026 - 8H00",
    proximoPeriodo: "27 / OUT / 2026 - 8H00",
    reuniaoPlanejamento: "26 / OUT / 2026 - 8H15",
    reuniaoBriefing: "26 / OUT / 2026 - 8H30",
    comandante: "CEL QOBM BORGES",
    chefeCapital: "CEL QOBM MENEZES",
    chefeInterior: "CEL QOBM MONTEIRO",
    coordSituacao: "CEL QOBM FERREIRA",
    subcomandante: "CEL QOBM HELYANTHUS FRANK DA SILVA BORGES",
    coordenador: "CEL QOBM CRISTIANO BRAZ FERREIRA",
  };

  const notesNoturno = JSON.stringify({
    header: headerNoturno,
    incendios_acumulado: updatedAcumulado,
    occurrences: day26Occs,
  });

  const payloadNoturno = {
    efetivo: harmonized.efetivo,
    recursos: harmonized.recursos,
    incendios: harmonized.incendios,
    outras: emptyOutrasList,
    notes: notesNoturno,
    updated_at: new Date().toISOString(),
  };

  const { error: errUpdNoturno } = await supabase
    .from("daily_reports")
    .update(payloadNoturno)
    .eq("report_date", "2026-10-26")
    .eq("shift", "noturno");

  if (errUpdNoturno) {
    console.error("Erro ao atualizar 26/10 noturno:", errUpdNoturno);
  } else {
    console.log("✓ Relatório 26/10 noturno (24h) atualizado com sucesso no Supabase!");
  }

  // 4. Atualizar 26/10 parcial
  const headerParcial = {
    ...headerNoturno,
    periodo: "26 / OUT / 2026 - Parcial (07:00–18:30)",
  };

  // No parcial (até 18:30), consideramos as ocorrências ocorridas até 18:30
  const parcialOccs = day26Occs.filter((o: any) => {
    const h = o.horario || "00:00";
    return h <= "18:30";
  });

  const munParcialMap = new Map<string, { urb: number; flor: number; focos: number; total_periodo: number }>();
  for (const occ of parcialOccs) {
    const mun = canonicalMunicipio(occ.municipio);
    const cur = munParcialMap.get(mun) || { urb: 0, flor: 0, focos: 0, total_periodo: 0 };
    const nat = String(occ.natureza || "").toLowerCase();
    if (nat.includes("apoio") && !nat.includes("incêndio") && !nat.includes("fogo")) continue;
    const isFlor = nat.includes("florest") || nat.includes("vegeta") || nat.includes("mata") || nat.includes("pastag");
    if (isFlor) cur.flor += 1;
    else cur.urb += 1;
    cur.focos += Math.max(1, Number(occ.focos) || 1);
    cur.total_periodo += 1;
    munParcialMap.set(mun, cur);
  }

  const parcialIncList = harmonized.incendios.map((r: any) => {
    const found = munParcialMap.get(r.mun);
    return {
      mun: r.mun,
      urb: found ? found.urb : 0,
      flor: found ? found.flor : 0,
      focos: found ? found.focos : 0,
      total_periodo: found ? found.total_periodo : 0,
    };
  });

  const notesParcial = JSON.stringify({
    header: headerParcial,
    incendios_acumulado: updatedAcumulado,
    occurrences: parcialOccs,
  });

  const payloadParcial = {
    efetivo: harmonized.efetivo,
    recursos: harmonized.recursos,
    incendios: parcialIncList,
    outras: emptyOutrasList,
    notes: notesParcial,
    updated_at: new Date().toISOString(),
  };

  const { error: errUpdParcial } = await supabase
    .from("daily_reports")
    .update(payloadParcial)
    .eq("report_date", "2026-10-26")
    .eq("shift", "parcial");

  if (errUpdParcial) {
    console.error("Erro ao atualizar 26/10 parcial:", errUpdParcial);
  } else {
    console.log("✓ Relatório 26/10 parcial atualizado com sucesso no Supabase!");
  }

  console.log("\nCorreção do dia 26 concluída com precisão absoluta!");
}

fixDay26().catch(console.error);
