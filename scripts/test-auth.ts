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

async function main() {
  const url = process.env.VITE_CUSTOM_SUPABASE_URL || process.env.VITE_SUPABASE_URL || "https://zeyxclvokbllixyezgoe.supabase.co";
  const key = process.env.VITE_CUSTOM_SUPABASE_PUBLISHABLE_KEY || process.env.VITE_SUPABASE_PUBLISHABLE_KEY || "sb_publishable_B608rXzlGxV4b0yk-6XaBw_riQTnj7y";

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

  console.log("🔍 Testando registro/login de usuário no Supabase...");
  // tenta login com admin
  const { data: signInData, error: signInErr } = await client.auth.signInWithPassword({
    email: "admin@cbmam.am.gov.br",
    password: "Password123!",
  });

  if (signInErr) {
    console.log("   Sign in error:", signInErr.message);
  } else {
    console.log("   ✅ Sign in SUCESSO! Token:", signInData.session?.access_token);
  }
}

main().catch(console.error);
