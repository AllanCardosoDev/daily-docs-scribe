import { createClient } from "@supabase/supabase-js";
import { DEFAULT_DRIVE_FOLDER_ID } from "../src/lib/drive-config";
import { listFolderSpreadsheets, downloadSheetMatrix, parseDailyReportSheet } from "../src/lib/drive-import.server";
import { manausFirst } from "../src/lib/municipio-order";

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
  console.log(`✅ Autenticado como ${email} (ID: ${userId})`);

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
    DEFAULT_DRIVE_FOLDER_ID, // Root folder: 1u5dYjHeg4FnRl0HDwKJPKWxyE3sEN5RY
    "1dhogH-8J8RpID6NNU-dbY58xInDkyyX5", // Junho
    "1k-zx56jOzlIfMuKir_0K388c5mQF-MjM", // Julho
    "1C77k-tUwxQXsKTyQ6VRByNa7yEmk9HZT", // Agosto
  ];

  console.log("\n🔍 Buscando planilhas em todas as pastas do Google Drive...");
  const allFilesMap = new Map<string, any>();

  for (const folderId of folderIds) {
    try {
      const files = await listFolderSpreadsheets(folderId);
      console.log(`📁 Pasta ${folderId}: Encontrados ${files.length} arquivos.`);
      for (const f of files) {
        if (f.reportDate && f.shift && !allFilesMap.has(f.id)) {
          allFilesMap.set(f.id, f);
        }
      }
    } catch (e) {
      console.log(`⚠️ Erro ao varrer pasta ${folderId}: ${(e as Error).message}`);
    }
  }

  const uniqueFiles = Array.from(allFilesMap.values());
  console.log(`\n📊 Total de planilhas únicas encontradas: ${uniqueFiles.length}`);

  let successCount = 0;
  let failCount = 0;
  let skipCount = 0;

  for (let i = 0; i < uniqueFiles.length; i++) {
    const file = uniqueFiles[i];
    console.log(`[${i + 1}/${uniqueFiles.length}] Processando: ${file.name} (${file.reportDate} - ${file.shift})...`);

    try {
      const matrix = await downloadSheetMatrix(file.id);
      const parsed = parseDailyReportSheet(matrix);

      const payload = {
        report_date: file.reportDate!,
        shift: file.shift!,
        efetivo: manausFirst(parsed.efetivo),
        recursos: manausFirst(parsed.recursos),
        incendios: manausFirst(parsed.incendios),
        outras: manausFirst(parsed.outras),
        updated_by: userId,
      };

      const { data: existing } = await supabase
        .from("daily_reports")
        .select("id, efetivo, recursos, incendios, outras")
        .eq("report_date", file.reportDate)
        .eq("shift", file.shift)
        .maybeSingle();

      if (existing) {
        const same =
          JSON.stringify([existing.efetivo, existing.recursos, existing.incendios, existing.outras]) ===
          JSON.stringify([payload.efetivo, payload.recursos, payload.incendios, payload.outras]);
        if (same) {
          console.log(`   ⏩ Sem alterações (já sincronizado).`);
          skipCount++;
          continue;
        }
        const { error: updateErr } = await supabase.from("daily_reports").update(payload).eq("id", existing.id);
        if (updateErr) throw new Error(updateErr.message);
        console.log(`   ✅ Atualizado com SUCESSO!`);
      } else {
        const { error: insertErr } = await supabase.from("daily_reports").insert({ ...payload, created_by: userId });
        if (insertErr) throw new Error(insertErr.message);
        console.log(`   🎉 Inserido com SUCESSO!`);
      }
      successCount++;
    } catch (e) {
      console.error(`   ❌ Falha: ${(e as Error).message}`);
      failCount++;
    }
  }

  console.log(`\n==================================================`);
  console.log(`🎉 SINCRONIZAÇÃO COMPLETA DO GOOGLE DRIVE CONCLUÍDA!`);
  console.log(`   - Atualizados/Inseridos: ${successCount}`);
  console.log(`   - Ignorados (sem alterações): ${skipCount}`);
  console.log(`   - Falhas: ${failCount}`);
}

main().catch(console.error);
