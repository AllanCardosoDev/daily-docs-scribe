import { createClient } from "@supabase/supabase-js";
import * as XLSX from "xlsx";
import { parseDailyReportSheet, parseFileName } from "../src/lib/drive-import.server";
import { manausFirst } from "../src/lib/municipio-order";
import fs from "fs";
import path from "path";

async function runImportOnProject(url: string, key: string, label: string, email: string, pass: string) {
  console.log(`\n==================================================`);
  console.log(`🔍 Conectando ao ${label} (${url})...`);
  const isNewKey = key.startsWith("sb_");

  let client = createClient(url, key, {
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

  console.log(`🔑 Tentando login com: ${email}...`);
  let { data: authData, error: authErr } = await client.auth.signInWithPassword({
    email: email,
    password: pass,
  });

  if (authErr) {
    console.log(`   ⚠️ SignIn falhou: ${authErr.message}`);
    // Se não existir, tenta criar
    console.log(`   🔑 Tentando cadastrar conta...`);
    const { data: signUpData, error: signUpErr } = await client.auth.signUp({
      email: email,
      password: pass,
      options: { data: { display_name: "Sala CBMAM" } },
    });
    if (signUpErr) {
      console.error(`   ❌ SignUp falhou: ${signUpErr.message}`);
      return false;
    }
    authData = signUpData as any;
  }

  const token = authData?.session?.access_token;
  const userId = authData?.user?.id;

  if (!token) {
    console.error(`❌ Não foi possível obter o token de sessão.`);
    return false;
  }

  console.log(`✅ Login com SUCESSO! User ID: ${userId}`);

  // Recria o cliente com o Bearer token do usuário autenticado
  client = createClient(url, key, {
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

  // Lendo a planilha 02.08.2026.xlsx
  const filePath = path.resolve(process.cwd(), "02.08.2026 - Relatório Diário Amazonas + Verde -24h.xlsx");
  const fileName = path.basename(filePath);
  const { reportDate, shift } = parseFileName(fileName);

  if (!reportDate) throw new Error("Data inválida no nome do arquivo");
  console.log(`📄 Lendo planilha: ${fileName} (${reportDate} - ${shift})...`);

  const fileBuf = fs.readFileSync(filePath);
  const wb = XLSX.read(fileBuf, { type: "buffer" });
  const sheetName =
    wb.SheetNames.find((n) =>
      /^relatorio/i.test(n.normalize("NFD").replace(/\p{Diacritic}/gu, "")),
    ) ?? wb.SheetNames[0];

  const ws = wb.Sheets[sheetName];
  const matrix = XLSX.utils.sheet_to_json<any[]>(ws, { header: 1, raw: true, defval: null });
  const parsed = parseDailyReportSheet(matrix);

  console.log(`📊 Extração concluída: Efetivo: ${parsed.efetivo.length} | Recursos: ${parsed.recursos.length} | Incêndios: ${parsed.incendios.length} | Outras: ${parsed.outras.length}`);

  const payload = {
    report_date: reportDate,
    shift: shift,
    efetivo: manausFirst(parsed.efetivo),
    recursos: manausFirst(parsed.recursos),
    incendios: manausFirst(parsed.incendios),
    outras: manausFirst(parsed.outras),
    created_by: userId,
    updated_by: userId,
  };

  const { data: existing, error: readErr } = await client
    .from("daily_reports")
    .select("id")
    .eq("report_date", reportDate)
    .eq("shift", shift)
    .maybeSingle();

  if (readErr) {
    console.error(`❌ Erro ao verificar registro existente: ${readErr.message}`);
    return false;
  }

  if (existing) {
    const { error: updateErr } = await client.from("daily_reports").update(payload).eq("id", existing.id);
    if (updateErr) {
      console.error(`❌ Erro ao atualizar relatório: ${updateErr.message}`);
      return false;
    }
    console.log(`🎉 RELATÓRIO DO DIA ${reportDate} (${shift}) ATUALIZADO COM SUCESSO NO ${label}! ID: ${existing.id}`);
    return true;
  } else {
    const { error: insertErr } = await client.from("daily_reports").insert(payload);
    if (insertErr) {
      console.error(`❌ Erro ao inserir relatório: ${insertErr.message}`);
      return false;
    }
    console.log(`🎉 RELATÓRIO DO DIA ${reportDate} (${shift}) INSERIDO COM SUCESSO NO ${label}!`);
    return true;
  }
}

async function main() {
  const email = "salacbmam@gmail.com";
  const pass = "9p&8jA_))rF$e6C";

  // Testando em ambos os bancos configurados no projeto
  const res1 = await runImportOnProject(
    "https://zeyxclvokbllixyezgoe.supabase.co",
    "sb_publishable_B608rXzlGxV4b0yk-6XaBw_riQTnj7y",
    "Projeto Oficial CBMAM (zeyxclvokbllixyezgoe)",
    email,
    pass
  );

  const res2 = await runImportOnProject(
    "https://uyvheasqiscwtbqtnvxh.supabase.co",
    "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InV5dmhlYXNxaXNjd3RicXRudnhoIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODM1MjIyMTYsImV4cCI6MjA5OTA5ODIxNn0.enQh_RgCy_Xm309tkIvxefZbd0Y7BJvjtA4X-wWi_Ns",
    "Projeto Managed (uyvheasqiscwtbqtnvxh)",
    email,
    pass
  );

  if (res1 || res2) {
    console.log("\n==================================================");
    console.log("✅ IMPORTAÇÃO CONCLUÍDA COM SUCESSO!");
  } else {
    console.log("\n==================================================");
    console.log("❌ Falha ao importar em ambos os projetos.");
  }
}

main().catch(console.error);
