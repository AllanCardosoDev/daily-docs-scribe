import { createClient } from "@supabase/supabase-js";
import { DEFAULT_DRIVE_FOLDER_ID, extractFolderId } from "../src/lib/drive-config";
import { listFolderSpreadsheets, downloadSheetMatrix, parseDailyReportSheet } from "../src/lib/drive-import.server";
import { manausFirst } from "../src/lib/municipio-order";

import fs from "fs";
import path from "path";

function loadEnv() {
  const envPaths = [
    path.resolve(process.cwd(), ".env"),
    path.resolve(process.cwd(), ".env.local"),
  ];
  for (const envPath of envPaths) {
    if (fs.existsSync(envPath)) {
      const content = fs.readFileSync(envPath, "utf-8");
      for (const line of content.split("\n")) {
        const trimmed = line.trim();
        if (!trimmed || trimmed.startsWith("#")) continue;
        const [key, ...valParts] = trimmed.split("=");
        if (key && valParts.length > 0 && !process.env[key.trim()]) {
          process.env[key.trim()] = valParts.join("=").trim().replace(/^["']|["']$/g, "");
        }
      }
    }
  }
}

loadEnv();

async function main() {
  const arg = process.argv[2];
  const folderId = extractFolderId(arg || DEFAULT_DRIVE_FOLDER_ID);

  const supabaseUrl =
    process.env.CUSTOM_SUPABASE_URL ||
    process.env.VITE_CUSTOM_SUPABASE_URL ||
    process.env.VITE_SUPABASE_URL ||
    process.env.SUPABASE_URL;

  const supabaseKey =
    process.env.CUSTOM_SUPABASE_SERVICE_ROLE_KEY ||
    process.env.SUPABASE_SERVICE_ROLE_KEY ||
    process.env.CUSTOM_SUPABASE_PUBLISHABLE_KEY ||
    process.env.VITE_CUSTOM_SUPABASE_PUBLISHABLE_KEY ||
    process.env.VITE_SUPABASE_PUBLISHABLE_KEY;

  if (!supabaseUrl || !supabaseKey) {
    console.error("❌ Erro: Variáveis do Supabase não encontradas no arquivo .env");
    console.error("Certifique-se de definir VITE_SUPABASE_URL e VITE_SUPABASE_PUBLISHABLE_KEY.");
    process.exit(1);
  }

  console.log(`📡 Conectando ao Supabase: ${supabaseUrl}`);
  console.log(`📁 ID da Pasta do Google Drive: ${folderId}`);

  const supabase = createClient(supabaseUrl, supabaseKey);

  console.log("🔍 Buscando planilhas no Google Drive...");
  const files = await listFolderSpreadsheets(folderId);

  if (!files.length) {
    console.log("⚠️ Nenhuma planilha .xlsx encontrada na pasta.");
    process.exit(0);
  }

  console.log(`📊 Encontradas ${files.length} planilhas no Google Drive.`);

  let successCount = 0;
  let failCount = 0;

  for (let i = 0; i < files.length; i++) {
    const file = files[i];
    console.log(`\n[${i + 1}/${files.length}] Processando: ${file.name}...`);

    if (!file.reportDate || !file.shift) {
      console.log(`   ⏩ Ignorando (nome fora do padrão de data/turno): ${file.name}`);
      continue;
    }

    try {
      const matrix = await downloadSheetMatrix(file.id);
      const parsed = parseDailyReportSheet(matrix);

      const payload = {
        report_date: file.reportDate,
        shift: file.shift,
        efetivo: manausFirst(parsed.efetivo),
        recursos: manausFirst(parsed.recursos),
        incendios: manausFirst(parsed.incendios),
        outras: manausFirst(parsed.outras),
      };

      const { data: existing } = await supabase
        .from("daily_reports")
        .select("id")
        .eq("report_date", file.reportDate)
        .eq("shift", file.shift)
        .maybeSingle();

      if (existing) {
        const { error } = await supabase.from("daily_reports").update(payload).eq("id", existing.id);
        if (error) throw error;
        console.log(`   ✅ Atualizado registro existente (${file.reportDate} - ${file.shift})`);
      } else {
        const { error } = await supabase.from("daily_reports").insert(payload);
        if (error) throw error;
        console.log(`   ✅ Inserido novo registro (${file.reportDate} - ${file.shift})`);
      }

      successCount++;
    } catch (err: any) {
      failCount++;
      console.error(`   ❌ Erro ao importar ${file.name}: ${err?.message || err}`);
    }
  }

  console.log("\n==========================================");
  console.log(`🎉 Processo concluído! Sucessos: ${successCount} | Falhas: ${failCount}`);
  console.log("==========================================");
}

main().catch((err) => {
  console.error("Erro fatal na execução do script:", err);
  process.exit(1);
});
