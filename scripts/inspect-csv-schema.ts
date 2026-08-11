import fs from "fs";
import path from "path";

const csvPath = path.join(process.cwd(), "reports_2023_2026.csv");
const content = fs.readFileSync(csvPath, "utf-8");

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
        date: fields[0].trim(),
        efetivo: fields[1],
        recursos: fields[2],
        incendios: fields[3],
        outras: fields[4],
        shift: fields[7].trim(),
      });
    }
  }
  return rows;
}

const parsed = parseCSV(content);

console.log("--- Amostras de Efetivo ---");
const ef = parsed.find(r => r.efetivo && r.efetivo !== "[]");
console.log(ef ? ef.efetivo.slice(0, 300) : "Nenhum ef encontrado");

console.log("\n--- Amostras de Recursos ---");
const rec = parsed.find(r => r.recursos && r.recursos !== "[]");
console.log(rec ? rec.recursos.slice(0, 300) : "Nenhum rec encontrado");

console.log("\n--- Amostras de Outras Ocorrências ---");
const out = parsed.find(r => r.outras && r.outras !== "[]");
console.log(out ? out.outras.slice(0, 300) : "Nenhuma outra encontrada");
