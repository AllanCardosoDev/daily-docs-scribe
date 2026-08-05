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

  const email = "salacbmam@gmail.com";
  const pass = "9p&8jA_))rF$e6C";

  console.log(`🔍 Testando login em zeyxclvokbllixyezgoe com ${email}...`);
  const { data, error } = await client.auth.signInWithPassword({ email, password: pass });

  if (error) {
    console.log(`❌ Login error: ${error.message}`);
  } else {
    console.log(`✅ Login SUCESSO no zeyxclvokbllixyezgoe! User ID: ${data.user?.id}`);
  }
}

main().catch(console.error);
