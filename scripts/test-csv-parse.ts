import fs from "fs";
import path from "path";
import { canonicalMunicipio } from "../src/lib/municipio-order";

const csvPath = path.join(process.cwd(), "reports_2023_2026.csv");
const content = fs.readFileSync(csvPath, "utf-8");

// Simple CSV parser supporting quoted JSON strings
function parseCSV(text: string) {
  const lines = text.split("\n").filter(l => l.trim().length > 0);
  const header = lines[0].split(",");
  const rows: any[] = [];

  for (let i = 1; i < lines.length; i++) {
    const line = lines[i];
    // Match fields respecting double quotes
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
        efetivo_raw: fields[1],
        recursos_raw: fields[2],
        incendios_raw: fields[3],
        outras_raw: fields[4],
        notes: fields[5],
        version: fields[6],
        shift: fields[7].trim(),
      });
    }
  }
  return rows;
}

const parsed = parseCSV(content);
console.log(`Linhas totais lidas do CSV: ${parsed.length}`);

let count2023 = 0, count2024 = 0, count2025 = 0, count2026 = 0;
for (const r of parsed) {
  if (r.report_date.startsWith("2023")) count2023++;
  else if (r.report_date.startsWith("2024")) count2024++;
  else if (r.report_date.startsWith("2025")) count2025++;
  else if (r.report_date.startsWith("2026")) count2026++;
}

console.log(`Relatórios por ano:`);
console.log(`  2023: ${count2023}`);
console.log(`  2024: ${count2024}`);
console.log(`  2025: ${count2025}`);
console.log(`  2026: ${count2026}`);

// Amostra de incendios parseados
const firstWithInc = parsed.find(r => r.incendios_raw && r.incendios_raw !== "[]");
if (firstWithInc) {
  console.log("\nAmostra de incendios raw:", firstWithInc.incendios_raw.slice(0, 200));
  try {
    const json = JSON.parse(firstWithInc.incendios_raw);
    console.log("JSON parseado:", json);
  } catch (e: any) {
    console.error("Erro no JSON.parse:", e.message);
  }
}
