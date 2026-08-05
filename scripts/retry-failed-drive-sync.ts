import { createClient } from "@supabase/supabase-js";
import { DEFAULT_DRIVE_FOLDER_ID } from "../src/lib/drive-config";
import { listFolderSpreadsheets, downloadSheetMatrix, parseDailyReportSheet } from "../src/lib/drive-import.server";
import { manausFirst } from "../src/lib/municipio-order";

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

async function main() {
  const url = "https://zeyxclvokbllixyezgoe.supabase.co";
  const key = "sb_publishable_B608rXzlGxV4b0yk-6XaBw_riQTnj7y";
  const isNewKey = key.startsWith("sb_");

  const email = "salacbmam@gmail.com";
  const pass = "9p&8jA_))rF$e6C";

  console.log(`\n📡 Autenticando no Supabase Oficial (${url})...`);
  const authClient = createClient(url, key, {
    auth: { persistSession: false, autoRefreshToken: false },
    global: {
      fetch: (input, init) => {
        const headers = new Headers(init?.headers);
        if (isNewKey) headers.delete("Authorization");
        headers.set("apikey", key);
        return fetch(input as any, { ...init, headers });
      },
    },
  });

  const { data: authData, error: authErr } = await authClient.auth.signInWithPassword({
    email,
    password: pass,
  });

  if (authErr || !authData.session) {
    console.error("❌ Falha na autenticação:", authErr?.message);
    process.exit(1);
  }

  const token = authData.session.access_token;
  const userId = authData.user.id;

  const supabase = createClient(url, key, {
    auth: { persistSession: false, autoRefreshToken: false },
    global: {
      headers: { Authorization: `Bearer ${token}` },
      fetch: (input, init) => {
        const headers = new Headers(init?.headers);
        if (isNewKey) headers.delete("Authorization");
        headers.set("apikey", key);
        headers.set("Authorization", `Bearer ${token}`);
        return fetch(input as any, { ...init, headers });
      },
    },
  });

  const folderIds = [
    DEFAULT_DRIVE_FOLDER_ID,
    "1dhogH-8J8RpID6NNU-dbY58xInDkyyX5", // Junho
    "1k-zx56jOzlIfMuKir_0K388c5mQF-MjM", // Julho
    "1C77k-tUwxQXsKTyQ6VRByNa7yEmk9HZT", // Agosto
  ];

  console.log("\n🔍 Buscando planilhas em todas as pastas do Google Drive...");
  const allFilesMap = new Map<string, any>();

  for (const folderId of folderIds) {
    try {
      const files = await listFolderSpreadsheets(folderId);
      for (const f of files) {
        if (f.reportDate && f.shift && !allFilesMap.has(f.id)) {
          allFilesMap.set(f.id, f);
        }
      }
    } catch (e) {
      console.log(`⚠️ Aviso na pasta ${folderId}: ${(e as Error).message}`);
    }
  }

  const uniqueFiles = Array.from(allFilesMap.values());
  console.log(`\n📊 Total de planilhas identificadas: ${uniqueFiles.length}`);

  let successCount = 0;
  let failCount = 0;

  for (let i = 0; i < uniqueFiles.length; i++) {
    const file = uniqueFiles[i];

    // Verifica se a planilha já está no banco antes de baixar
    const { data: existing } = await supabase
      .from("daily_reports")
      .select("id, updated_at")
      .eq("report_date", file.reportDate)
      .eq("shift", file.shift)
      .maybeSingle();

    if (existing) {
      // Se já existe e foi atualizada recentemente, pula o download
      console.log(`[${i + 1}/${uniqueFiles.length}] ⏩ Já cadastrado: ${file.name} (${file.reportDate} - ${file.shift})`);
      continue;
    }

    console.log(`[${i + 1}/${uniqueFiles.length}] 📥 Baixando e inserindo: ${file.name} (${file.reportDate} - ${file.shift})...`);

    let attempts = 0;
    let ok = false;
    while (attempts < 3 && !ok) {
      try {
        attempts++;
        const matrix = await downloadSheetMatrix(file.id);
        const parsed = parseDailyReportSheet(matrix);

        const payload = {
          report_date: file.reportDate!,
          shift: file.shift!,
          efetivo: manausFirst(parsed.efetivo),
          recursos: manausFirst(parsed.recursos),
          incendios: manausFirst(parsed.incendios),
          outras: manausFirst(parsed.outras),
          created_by: userId,
          updated_by: userId,
        };

        const { error: insertErr } = await supabase.from("daily_reports").insert(payload);
        if (insertErr) throw new Error(insertErr.message);

        console.log(`   🎉 SUCESSO! Inserido relatório do dia ${file.reportDate} (${file.shift})`);
        ok = true;
        successCount++;
      } catch (e) {
        console.error(`   ⚠️ Tentativa ${attempts} falhou: ${(e as Error).message}`);
        await sleep(2000);
      }
    }

    if (!ok) {
      failCount++;
      console.error(`   ❌ Não foi possível baixar ${file.name} após 3 tentativas.`);
    }

    await sleep(800);
  }

  console.log(`\n==================================================`);
  console.log(`🎉 PROCESSAMENTO DE REFINAMENTO CONCLUÍDO!`);
  console.log(`   - Inseridos com sucesso: ${successCount}`);
  console.log(`   - Falhas: ${failCount}`);
}

main().catch(console.error);
