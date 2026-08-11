import { downloadSheetMatrix } from "../src/lib/drive-import.server";

async function test() {
  // Use a known file ID from drive
  const matrix = await downloadSheetMatrix("15wJ66y-e16r0t0R1q9H0o708kQx0f9y3");
  console.log("Matrix rows count:", matrix.length);
  for (let i = 0; i < Math.min(100, matrix.length); i++) {
    const row = matrix[i];
    if (!row) continue;
    const str = row.map(c => String(c ?? "").trim()).filter(Boolean).join(" | ");
    if (str.includes("INCENDIO") || str.includes("EFETIVO") || str.includes("RECURSOS") || str.includes("ACUMULADO") || str.includes("PERIODO")) {
      console.log(`Row ${i}:`, str.slice(0, 150));
    }
  }
}

test().catch(console.error);
