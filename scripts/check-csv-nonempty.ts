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
        efetivo: fields[1].trim(),
        recursos: fields[2].trim(),
        incendios: fields[3].trim(),
        outras: fields[4].trim(),
        shift: fields[7].trim(),
      });
    }
  }
  return rows;
}

const parsed = parseCSV(content);
console.log("Total rows:", parsed.length);

const nonEf = parsed.filter(r => r.efetivo !== "[]" && r.efetivo !== "");
const nonRec = parsed.filter(r => r.recursos !== "[]" && r.recursos !== "");
const nonInc = parsed.filter(r => r.incendios !== "[]" && r.incendios !== "");
const nonOut = parsed.filter(r => r.outras !== "[]" && r.outras !== "");

console.log("Linhas com Efetivo preenchido:", nonEf.length);
console.log("Linhas com Recursos preenchidos:", nonRec.length);
console.log("Linhas com Incêndios preenchidos:", nonInc.length);
console.log("Linhas com Outras Ocorrências preenchidas:", nonOut.length);

if (nonEf.length > 0) console.log("Amostra Efetivo:", nonEf[0]);
if (nonRec.length > 0) console.log("Amostra Recursos:", nonRec[0]);
if (nonOut.length > 0) console.log("Amostra Outras:", nonOut[0]);
