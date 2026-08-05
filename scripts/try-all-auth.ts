import { createClient } from "@supabase/supabase-js";

async function testProject(url: string, key: string, name: string) {
  console.log(`\n🔍 Testando Auth no ${name} (${url})...`);
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

  const email = `test.operator.${Date.now()}@cbmam.gov.br`;
  const password = "TestPassword2026!";

  const { data, error } = await client.auth.signUp({
    email,
    password,
  });

  if (error) {
    console.log(`   ❌ SignUp error: ${error.message}`);
  } else {
    console.log(`   ✅ SignUp resposta:`, {
      userId: data.user?.id,
      session: !!data.session,
      confirmed: data.user?.confirmed_at,
    });

    if (data.session?.access_token) {
      console.log(`   🎉 Session Token obtido!`);
      const authedClient = createClient(url, key, {
        auth: { persistSession: false, autoRefreshToken: false },
        global: {
          headers: { Authorization: `Bearer ${data.session.access_token}` },
          fetch: (input, init) => {
            const headers = new Headers(init?.headers);
            if (isNewKey) headers.delete("Authorization");
            headers.set("apikey", key);
            headers.set("Authorization", `Bearer ${data.session.access_token}`);
            return fetch(input as any, { ...init, headers });
          },
        },
      });

      const { error: insertErr } = await authedClient.from("daily_reports").insert({
        report_date: "2026-08-02",
        shift: "noturno",
        efetivo: [{ mun: "Manaus", ord: 1, seg: 0, brig: 0 }],
        recursos: [],
        incendios: [],
        outras: [],
      });

      if (insertErr) {
        console.log(`   ❌ Insert com autenticação falhou: ${insertErr.message}`);
      } else {
        console.log(`   🚀 Insert com autenticação SUCESSO!`);
      }
    }
  }
}

async function main() {
  await testProject(
    "https://uyvheasqiscwtbqtnvxh.supabase.co",
    "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InV5dmhlYXNxaXNjd3RicXRudnhoIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODM1MjIyMTYsImV4cCI6MjA5OTA5ODIxNn0.enQh_RgCy_Xm309tkIvxefZbd0Y7BJvjtA4X-wWi_Ns",
    "Projeto Managed (uyvheasqiscwtbqtnvxh)",
  );

  await testProject(
    "https://zeyxclvokbllixyezgoe.supabase.co",
    "sb_publishable_B608rXzlGxV4b0yk-6XaBw_riQTnj7y",
    "Projeto Oficial (zeyxclvokbllixyezgoe)",
  );
}

main().catch(console.error);
