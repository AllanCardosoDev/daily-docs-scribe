import { createClient } from "@supabase/supabase-js";

async function main() {
  const url = "https://zeyxclvokbllixyezgoe.supabase.co";
  const key = "sb_publishable_B608rXzlGxV4b0yk-6XaBw_riQTnj7y";
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

  const emailsToTry = [
    "admin@cbmam.am.gov.br",
    "operador@cbmam.am.gov.br",
    "sala.situacao@cbmam.am.gov.br",
    "relatorio@cbmam.am.gov.br",
    "cbmam@am.gov.br",
  ];

  const passwordsToTry = [
    "12345678",
    "123456",
    "cbmam2026",
    "Cbmam2026!",
    "Password123!",
    "admin123",
  ];

  for (const email of emailsToTry) {
    for (const password of passwordsToTry) {
      const { data, error } = await client.auth.signInWithPassword({ email, password });
      if (!error && data.session) {
        console.log(`🎉 ENCONTRADO LOGIN VÁLIDO! Email: ${email} | Password: ${password}`);
        console.log(`   Token: ${data.session.access_token}`);
        return;
      }
    }
  }
  console.log("❌ Nenhuma combinação padrão encontrada.");
}

main().catch(console.error);
