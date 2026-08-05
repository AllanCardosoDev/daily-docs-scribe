import { createClient } from "@supabase/supabase-js";

async function main() {
  const url = "https://uyvheasqiscwtbqtnvxh.supabase.co";
  const key = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InV5dmhlYXNxaXNjd3RicXRudnhoIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODM1MjIyMTYsImV4cCI6MjA5OTA5ODIxNn0.enQh_RgCy_Xm309tkIvxefZbd0Y7BJvjtA4X-wWi_Ns";
  const email = "salacbmam@gmail.com";
  const pass = "9p&8jA_))rF$e6C";

  let client = createClient(url, key, { auth: { persistSession: false, autoRefreshToken: false } });
  const { data: authData } = await client.auth.signInWithPassword({ email, password: pass });
  const token = authData?.session?.access_token;
  const userId = authData?.user?.id;

  console.log(`User ID: ${userId}`);

  const authedClient = createClient(url, key, {
    auth: { persistSession: false, autoRefreshToken: false },
    global: { headers: { Authorization: `Bearer ${token}` } },
  });

  const { data: roles, error: rolesErr } = await authedClient.from("user_roles").select("*");
  console.log("User roles atuais:", roles, "Erro:", rolesErr?.message);

  const { error: insertRoleErr } = await authedClient.from("user_roles").insert({
    user_id: userId,
    role: "admin",
  });
  console.log("Inserção em user_roles resultado:", insertRoleErr?.message || "SUCESSO!");
}

main().catch(console.error);
