import * as XLSX from "xlsx";
import fs from "fs";
import path from "path";

async function main() {
  const filePath = path.resolve(process.cwd(), "02.08.2026 - Relatório Diário Amazonas + Verde -24h.xlsx");
  const buf = fs.readFileSync(filePath);
  const wb = XLSX.read(buf, { type: "buffer" });

  console.log("=== ABAS DA PLANILHA ===");
  console.log(wb.SheetNames);

  // Inspeciona aba RELATORIO
  const sheetName = wb.SheetNames.find(n => /relatorio/i.test(n)) || wb.SheetNames[0];
  const ws = wb.Sheets[sheetName];
  const matrix: any[][] = XLSX.utils.sheet_to_json(ws, { header: 1, raw: true, defval: null });

  console.log(`\nAba principal: "${sheetName}", Total de linhas: ${matrix.length}`);

  // Seções específicas
  const sections: Array<{ title: string; line: number }> = [];
  for (let r = 0; r < matrix.length; r++) {
    const row = matrix[r] || [];
    const rowStr = row.map(c => String(c ?? "")).filter(s => s.trim() !== "").join(" | ").toUpperCase();
    if (!rowStr) continue;

    if (rowStr.includes("CORPO DE BOMBEIROS") || rowStr.includes("COMANDANTE")) {
      sections.push({ title: "CABEÇALHO / COMANDO", line: r + 1 });
    } else if (rowStr.includes("EFETIVO") && !sections.some(s => s.title === "EFETIVO")) {
      sections.push({ title: "EFETIVO", line: r + 1 });
    } else if (rowStr.includes("RECURSOS") && !sections.some(s => s.title === "RECURSOS")) {
      sections.push({ title: "RECURSOS", line: r + 1 });
    } else if (rowStr.includes("INCÊNDIOS") || rowStr.includes("INCENDIOS")) {
      sections.push({ title: rowStr.slice(0, 50), line: r + 1 });
    } else if (rowStr.includes("OUTRAS OCORRÊNCIAS") || rowStr.includes("OUTRAS OCORRENCIAS")) {
      sections.push({ title: rowStr.slice(0, 50), line: r + 1 });
    }
  }

  console.log("\n=== SEÇÕES DETECTADAS ===");
  console.table(sections);
}

main().catch(console.error);
