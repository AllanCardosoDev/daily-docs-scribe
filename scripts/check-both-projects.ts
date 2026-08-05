import { createClient } from "@supabase/supabase-js";
import * as XLSX from "xlsx";
import { parseDailyReportSheet, parseFileName } from "../src/lib/drive-import.server";
import { manausFirst } from "../src/lib/municipio-order";
import fs from "fs";
import path from "path";

async function testProject(url: string, key: string, label: string) {
  console.log(`\n==================================================`);
  console.log(`🔍 Testando no ${label} (${url})...`);
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

  const email = "salacbmam@gmail.com";
  const pass = "9p&8jA_))rF$e6C";

  let { data: authData, error: signInErr } = await client.auth.signInWithPassword({
    email,
    password: pass,
  });

  if (signInErr) {
    console.log(`   SignIn falhou: ${signInErr.message}`);
    const { data: signUpData, error: signUpErr } = await client.auth.signUp({
      email,
      password: pass,
      options: { data: { display_name: "Sala CBMAM" } },
    });
    if (signUpErr) {
      console.log(`   SignUp falhou: ${signUpErr.message}`);
      return;
    }
    authData = signUpData as any;
  }

  const token = authData?.session?.access_token;
  const userId = authData?.user?.id;
  console.log(`   ✅ Login SUCESSO! User ID: ${userId}`);

  if (token) {
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

  // Verifica os papéis do usuário
  const { data: roles, error: rolesErr } = await client.from("user_roles").select("*");
  console.log(`   📋 Papéis em user_roles:`, roles, "Erro:", rolesErr?.message);

  // Lendo planilha 02.08.2026.xlsx
  const filePath = path.resolve(process.cwd(), "02.08.2026 - Relatório Diário Amazonas + Verde -24h.xlsx");
  const fileName = path.basename(filePath);
  const { reportDate, shift } = parseFileName(fileName);
  if (!reportDate) return;

  const fileBuf = fs.readFileSync(filePath);
  const wb = XLSX.read(fileBuf, { type: "buffer" });
  const sheetName =
    wb.SheetNames.find((n) =>
      /^relatorio/i.test(n.normalize("NFD").replace(/\p{Diacritic}/gu, "")),
    ) ?? wb.SheetNames[0];

  const ws = wb.Sheets[sheetName];
  const matrix = XLSX.utils.sheet_to_json<any[]>(ws, { header: 1, raw: true, defval: null });
  const parsed = parseDailyReportSheet(matrix);

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

  const { data: existing } = await client
    .from("daily_reports")
    .select("id")
    .eq("report_date", reportDate)
    .eq("shift", shift)
    .maybeSingle();

  if (existing) {
    const { error: updateErr } = await client.from("daily_reports").update(payload).eq("id", existing.id);
    if (updateErr) console.log(`   ❌ Update falhou: ${updateErr.message}`);
    else console.log(`   🎉 SUCCESS! Relatório ${reportDate} atualizado no ${label}!`);
  } else {
    const { error: insertErr } = await client.from("daily_reports").insert(payload);
    if (insertErr) console.log(`   ❌ Insert falhou: ${insertErr.message}`);
    else console.log(`   🎉 SUCCESS! Relatório ${reportDate} inserido no ${label}!`);
  }
}

async function main() {
  await testProject(
    "https://uyvheasqiscwtbqtnvxh.supabase.co",
    "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InV5dmhlYXNxaXNjd3RicXRudnhoIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODM1MjIyMTYsImV4cCI6MjA5OTA5ODIxNn0.enQh_RgCy_Xm309tkIvxefZbd0Y7BJvjtA4X-wWi_Ns",
    "Projeto Managed (uyvheasqiscwtbqtnvxh)"
  );

  await testProject(
    "https://zeyxclvokbllixyezgoe.supabase.co",
    "sb_publishable_B608rXzlGxV4b0yk-6XaBw_riQTnj7y",
    "Projeto Oficial CBMAM (zeyxclvokbllixyezgoe)"
  );
}

main().catch(console.error);
