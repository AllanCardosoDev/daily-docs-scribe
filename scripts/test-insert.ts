import { createClient } from "@supabase/supabase-js";
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

async function testTarget(url: string, key: string, label: string) {
  console.log(`\n🔍 Testando ${label}... (${url})`);
  const isNewKey = key.startsWith("sb_");
  const client = createClient(url, key, {
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

  const { data, error } = await client.from("daily_reports").select("id, report_date, shift").limit(1);
  if (error) {
    console.log(`   ❌ SELECT Error: ${error.message}`);
  } else {
    console.log(`   ✅ SELECT OK! Retornou ${data?.length} registros.`);
  }

  // Tenta um teste de upsert/insert na data 2026-08-02
  const testPayload = {
    report_date: "2026-08-02",
    shift: "noturno",
    efetivo: [{ mun: "Manaus", ord: 1, seg: 0, brig: 0 }],
    recursos: [],
    incendios: [],
    outras: [],
  };

  const { error: upsertErr } = await client.from("daily_reports").upsert(testPayload, { onConflict: "report_date,shift" });
  if (upsertErr) {
    console.log(`   ❌ UPSERT Error: ${upsertErr.message}`);
  } else {
    console.log(`   🎉 UPSERT SUCESSO no ${label}!`);
  }
}

async function main() {
  const url1 = process.env.SUPABASE_URL || "https://uyvheasqiscwtbqtnvxh.supabase.co";
  const key1 = process.env.SUPABASE_PUBLISHABLE_KEY || "";
  await testTarget(url1, key1, "Projeto Managed (uyvheasqiscwtbqtnvxh)");

  const url2 = "https://zeyxclvokbllixyezgoe.supabase.co";
  const key2 = "sb_publishable_B608rXzlGxV4b0yk-6XaBw_riQTnj7y";
  await testTarget(url2, key2, "Projeto Oficial CBMAM (zeyxclvokbllixyezgoe)");
}

main().catch(console.error);
