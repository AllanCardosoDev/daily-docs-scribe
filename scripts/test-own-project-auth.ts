import { createClient } from "@supabase/supabase-js";
import * as XLSX from "xlsx";
import { parseDailyReportSheet, parseFileName } from "../src/lib/drive-import.server";
import { manausFirst } from "../src/lib/municipio-order";
import fs from "fs";
import path from "path";

async function main() {
  const url = "https://zeyxclvokbllixyezgoe.supabase.co";
  const key = "sb_publishable_B608rXzlGxV4b0yk-6XaBw_riQTnj7y";

  console.log(`\n🔍 Conectando ao Supabase Oficial CBMAM (${url})...`);
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

  const email = "admin.cbmam@gmail.com";
  const password = "AdminPassword2026!";

  console.log(`🔑 Tentando Login com: ${email}...`);
  let { data: authData, error: signInErr } = await client.auth.signInWithPassword({ email, password });

  if (signInErr) {
    console.log(`   Sign in falhou: ${signInErr.message}. Tentando cadastro...`);
    const { data: signUpData, error: signUpErr } = await client.auth.signUp({
      email,
      password,
      options: { data: { display_name: "Administrador CBMAM" } },
    });
    if (signUpErr) {
      console.error(`   ❌ SignUp erro: ${signUpErr.message}`);
    } else {
      console.log(`   ✅ SignUp SUCESSO! User: ${signUpData.user?.id} | Session: ${!!signUpData.session}`);
      authData = signUpData as any;
    }
  }

  const token = authData?.session?.access_token;
  const userId = authData?.user?.id;

  if (token) {
    console.log(`🎉 Sessão obtida com SUCESSO! Token recebido.`);
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
  }

  // Lendo o arquivo 02.08.2026.xlsx
  const filePath = path.resolve(process.cwd(), "02.08.2026 - Relatório Diário Amazonas + Verde -24h.xlsx");
  const fileName = path.basename(filePath);
  const { reportDate, shift } = parseFileName(fileName);

  if (!reportDate) throw new Error("Data inválida no arquivo");
  console.log(`\n📄 Lendo planilha: ${fileName} (${reportDate} - ${shift})...`);

  const fileBuf = fs.readFileSync(filePath);
  const wb = XLSX.read(fileBuf, { type: "buffer" });
  const sheetName =
    wb.SheetNames.find((n) =>
      /^relatorio/i.test(n.normalize("NFD").replace(/\p{Diacritic}/gu, "")),
    ) ?? wb.SheetNames[0];

  const ws = wb.Sheets[sheetName];
  const matrix = XLSX.utils.sheet_to_json<any[]>(ws, { header: 1, raw: true, defval: null });
  const parsed = parseDailyReportSheet(matrix);

  console.log(`📊 Efetivo: ${parsed.efetivo.length} | Recursos: ${parsed.recursos.length} | Incêndios: ${parsed.incendios.length} | Outras: ${parsed.outras.length}`);

  const payload = {
    report_date: reportDate,
    shift: shift,
    efetivo: manausFirst(parsed.efetivo),
    recursos: manausFirst(parsed.recursos),
    incendios: manausFirst(parsed.incendios),
    outras: manausFirst(parsed.outras),
    created_by: userId ?? null,
    updated_by: userId ?? null,
  };

  const { data: existing, error: readErr } = await client
    .from("daily_reports")
    .select("id")
    .eq("report_date", reportDate)
    .eq("shift", shift)
    .maybeSingle();

  if (readErr) {
    console.error(`❌ Erro ao consultar daily_reports: ${readErr.message}`);
    return;
  }

  if (existing) {
    const { error: updateErr } = await client.from("daily_reports").update(payload).eq("id", existing.id);
    if (updateErr) console.error(`❌ Erro ao atualizar: ${updateErr.message}`);
    else console.log(`🚀 RELATÓRIO DO DIA ${reportDate} (${shift}) ATUALIZADO COM SUCESSO! ID: ${existing.id}`);
  } else {
    const { error: insertErr } = await client.from("daily_reports").insert(payload);
    if (insertErr) console.error(`❌ Erro ao inserir: ${insertErr.message}`);
    else console.log(`🚀 RELATÓRIO DO DIA ${reportDate} (${shift}) INSERIDO NO SUPABASE COM SUCESSO!`);
  }
}

main().catch(console.error);
