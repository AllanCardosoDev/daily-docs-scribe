import { createClient } from "@supabase/supabase-js";
import fs from "fs";
import path from "path";
import { canonicalMunicipio } from "../src/lib/municipio-order";

const supabase = createClient(
  "https://zeyxclvokbllixyezgoe.supabase.co",
  "sb_publishable_B608rXzlGxV4b0yk-6XaBw_riQTnj7y"
);

function parseCSV(text: string) {
  const lines = text.split("\n").filter(l => l.trim().length > 0);
  const rows: any[] = [];
  for (let i = 1; i < lines.length; i++) {
    const line = lines[i];
    const fields: string[] = [];
    let field = "";
    let inQuotes = false;
    for (let j = 0; j < line.length; j++) {
      const char = line[j];
      if (char === '"' && line[j + 1] === '"') {
        field += '"';
        j++;
      } else if (char === '"') {
        inQuotes = !inQuotes;
      } else if (char === ',' && !inQuotes) {
        fields.push(field);
        field = "";
      } else {
        field += char;
      }
    }
    fields.push(field);
    if (fields.length >= 8) {
      rows.push({
        report_date: fields[0].trim(),
        efetivo_raw: fields[1].trim(),
        recursos_raw: fields[2].trim(),
        incendios_raw: fields[3].trim(),
        outras_raw: fields[4].trim(),
        notes: fields[5].trim(),
        version: Number(fields[6]) || 1,
        shift: fields[7].trim() || "noturno",
      });
    }
  }
  return rows;
}

async function batchImport() {
  console.log("📡 Autenticando no Supabase...");
  await supabase.auth.signInWithPassword({
    email: "salacbmam@gmail.com",
    password: "9p&8jA_))rF$e6C",
  });

  const csvPath = path.join(process.cwd(), "reports_2023_2026.csv");
  const content = fs.readFileSync(csvPath, "utf-8");
  const csvRows = parseCSV(content);

  console.log(`📊 Lidos ${csvRows.length} relatórios do CSV.`);

  // 1. Busca todos os relatórios existentes no Supabase
  const { data: dbRows, error: fetchErr } = await supabase
    .from("daily_reports")
    .select("id, report_date, shift, incendios");

  if (fetchErr) {
    console.error("Erro ao buscar dados do Supabase:", fetchErr);
    return;
  }

  const dbMap = new Map<string, any>();
  for (const r of dbRows ?? []) {
    dbMap.set(`${r.report_date}|${r.shift}`, r);
  }

  const toInsert: any[] = [];
  const toUpdate: any[] = [];

  for (const row of csvRows) {
    let rawIncendiosList: any[] = [];
    try {
      if (row.incendios_raw && row.incendios_raw !== "[]") {
        rawIncendiosList = JSON.parse(row.incendios_raw);
      }
    } catch (e) {}

    const incendiosFormantados = rawIncendiosList.map((item: any) => {
      const rawMun = item.municipio || item.mun || "";
      const mun = canonicalMunicipio(rawMun);
      const urb = Number(item.incendio_urbano ?? item.urb ?? 0) || 0;
      const flor = Number(item.incendio_florestal ?? item.flor ?? 0) || 0;
      const focos = Number(item.focos_combatidos ?? item.focos_atendidos ?? item.focos ?? 0) || 0;
      const sat = Number(item.focos_detectados ?? item.sat ?? 0) || 0;
      return {
        mun,
        urb,
        flor,
        focos,
        sat,
        area: Number(item.area) || 0,
        total_periodo: urb + flor,
      };
    });

    const key = `${row.report_date}|${row.shift}`;
    const existing = dbMap.get(key);

    if (existing) {
      const existingInc = (existing.incendios as any[]) ?? [];
      if (existingInc.length === 0 && incendiosFormantados.length > 0) {
        toUpdate.push({
          id: existing.id,
          incendios: incendiosFormantados,
          notes: row.notes || "Importado do histórico (2023-2026)",
        });
      }
    } else {
      toInsert.push({
        report_date: row.report_date,
        shift: row.shift,
        efetivo: [],
        recursos: [],
        incendios: incendiosFormantados,
        outras: [],
        notes: row.notes || "Pré-importação histórica (2023-2026)",
        version: row.version,
      });
    }
  }

  console.log(`🚀 Preparados: ${toInsert.length} para inserir e ${toUpdate.length} para atualizar.`);

  // Inserção em lotes de 50
  let insertedCount = 0;
  const chunkSize = 50;
  for (let i = 0; i < toInsert.length; i += chunkSize) {
    const chunk = toInsert.slice(i, i + chunkSize);
    const { error: insErr } = await supabase.from("daily_reports").insert(chunk);
    if (insErr) {
      console.error(`Erro ao inserir lote ${i}:`, insErr.message);
    } else {
      insertedCount += chunk.length;
    }
  }

  // Atualização em lotes
  let updatedCount = 0;
  for (const item of toUpdate) {
    const { error: upErr } = await supabase
      .from("daily_reports")
      .update({ incendios: item.incendios, notes: item.notes })
      .eq("id", item.id);
    if (!upErr) updatedCount++;
  }

  console.log(`\n🎉 IMPORTAÇÃO HISTÓRICA CONCLUÍDA COM SUCESSO!`);
  console.log(`  - Novos relatórios inseridos no Supabase: ${insertedCount}`);
  console.log(`  - Relatórios atualizados no Supabase: ${updatedCount}`);
}

batchImport().catch(console.error);
