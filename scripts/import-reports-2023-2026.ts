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

async function importCsvToSupabase() {
  console.log("📡 Autenticando no Supabase...");
  await supabase.auth.signInWithPassword({
    email: "salacbmam@gmail.com",
    password: "9p&8jA_))rF$e6C",
  });

  const csvPath = path.join(process.cwd(), "reports_2023_2026.csv");
  const content = fs.readFileSync(csvPath, "utf-8");
  const parsedRows = parseCSV(content);

  console.log(`📊 Lidos ${parsedRows.length} relatórios do CSV.`);

  let inserted = 0;
  let updated = 0;
  let errors = 0;

  for (const row of parsedRows) {
    let rawIncendiosList: any[] = [];
    try {
      if (row.incendios_raw && row.incendios_raw !== "[]") {
        rawIncendiosList = JSON.parse(row.incendios_raw);
      }
    } catch (e) {
      console.warn(`Aviso ao parsear JSON de incêndios em ${row.report_date}:`, e);
    }

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

    // Verifica se já existe relatório para a data e turno
    const { data: existing } = await supabase
      .from("daily_reports")
      .select("id, incendios")
      .eq("report_date", row.report_date)
      .eq("shift", row.shift)
      .maybeSingle();

    if (existing) {
      // Se já existe no Supabase, atualizamos os incêndios se estiver vazio no banco
      const existingInc = (existing.incendios as any[]) ?? [];
      if (existingInc.length === 0 && incendiosFormantados.length > 0) {
        const { error: upErr } = await supabase
          .from("daily_reports")
          .update({
            incendios: incendiosFormantados as any,
            notes: row.notes || "Importado do histórico (2023-2026)",
          })
          .eq("id", existing.id);
        if (upErr) {
          console.error(`Erro ao atualizar ${row.report_date}:`, upErr.message);
          errors++;
        } else {
          updated++;
        }
      }
    } else {
      // Se não existe, inserimos o relatório histórico
      const { error: insErr } = await supabase
        .from("daily_reports")
        .insert({
          report_date: row.report_date,
          shift: row.shift,
          efetivo: [],
          recursos: [],
          incendios: incendiosFormantados as any,
          outras: [],
          notes: row.notes || "Pré-importação histórica (2023-2026)",
          version: row.version,
        });

      if (insErr) {
        console.error(`Erro ao inserir ${row.report_date} (${row.shift}):`, insErr.message);
        errors++;
      } else {
        inserted++;
      }
    }
  }

  console.log(`\n✅ Importação Histórica Concluída!`);
  console.log(`  - Novos relatórios inseridos: ${inserted}`);
  console.log(`  - Relatórios existentes atualizados: ${updated}`);
  console.log(`  - Erros: ${errors}`);
}

importCsvToSupabase().catch(console.error);
