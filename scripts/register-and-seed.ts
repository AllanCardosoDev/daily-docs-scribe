import { createClient } from "@supabase/supabase-js";
import * as XLSX from "xlsx";
import { parseDailyReportSheet, parseFileName } from "../src/lib/drive-import.server";
import { manausFirst } from "../src/lib/municipio-order";
import fs from "fs";
import path from "path";

function loadEnv() {
  const envPath = path.resolve(process.cwd(), ".env");
  if (fs.existsSync(envPath)) {
    const content = fs.readFileSync(envPath, "utf-8");
    for (const line of content.split("\n")) {
      const trimmed = line.trim();
      if (!trimmed || trimmed.startsWith("#")) continue;
      const [key, ...valParts] = trimmed.split("=");
      if (key && valParts.length > 0) {
        process.env[key.trim()] = valParts.join("=").trim().replace(/^["']|["']$/g, "");
      }
    }
  }
}

loadEnv();

async function main() {
  const filePath = path.resolve(process.cwd(), "02.08.2026 - Relatório Diário Amazonas + Verde -24h.xlsx");
  const fileName = path.basename(filePath);
  console.log(`\n📄 Lendo planilha local: ${fileName}...`);

  const { reportDate, shift } = parseFileName(fileName);
  if (!reportDate) throw new Error("Data inválida no arquivo");

  console.log(`📅 Data: ${reportDate} | Turno: ${shift}`);

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

  const url = process.env.VITE_CUSTOM_SUPABASE_URL || process.env.VITE_SUPABASE_URL || "https://zeyxclvokbllixyezgoe.supabase.co";
  const key = process.env.VITE_CUSTOM_SUPABASE_PUBLISHABLE_KEY || process.env.VITE_SUPABASE_PUBLISHABLE_KEY || "sb_publishable_B608rXzlGxV4b0yk-6XaBw_riQTnj7y";

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

  const testEmail = "operador.cbmam@am.gov.br";
  const testPassword = "CbmamPassword2026!";

  console.log(`🔑 Autenticando com e-mail: ${testEmail}...`);
  let { data: authData, error: authErr } = await client.auth.signInWithPassword({
    email: testEmail,
    password: testPassword,
  });

  if (authErr && authErr.message.includes("Invalid login credentials")) {
    console.log("   Criando nova conta de operador...");
    const { data: signUpData, error: signUpErr } = await client.auth.signUp({
      email: testEmail,
      password: testPassword,
      options: { data: { display_name: "Operador CBMAM" } },
    });
    if (signUpErr) console.error("   Erro no signup:", signUpErr.message);
    else authData = signUpData as any;
  }

  const token = authData?.session?.access_token;
  const userId = authData?.user?.id;

  if (token) {
    console.log(`✅ Autenticado com sucesso! User ID: ${userId}`);
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
  } else {
    console.log("⚠️ Continuando sem token de sessão (tentando inserção pública)...");
  }

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

  const { data: existing } = await client
    .from("daily_reports")
    .select("id")
    .eq("report_date", reportDate)
    .eq("shift", shift)
    .maybeSingle();

  if (existing) {
    const { error } = await client.from("daily_reports").update(payload).eq("id", existing.id);
    if (error) throw new Error(`Erro ao atualizar: ${error.message}`);
    console.log(`🎉 Relatório do dia ${reportDate} (${shift}) ATUALIZADO no Supabase com SUCESSO! ID: ${existing.id}`);
  } else {
    const { error } = await client.from("daily_reports").insert(payload);
    if (error) throw new Error(`Erro ao inserir: ${error.message}`);
    console.log(`🎉 Relatório do dia ${reportDate} (${shift}) INSERIDO no Supabase com SUCESSO!`);
  }
}

main().catch((err) => {
  console.error("❌ Erro no processo:", err.message);
  process.exit(1);
});
