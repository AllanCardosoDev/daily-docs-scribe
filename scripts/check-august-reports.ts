import { createClient } from "@supabase/supabase-js";

async function main() {
  const url = "https://zeyxclvokbllixyezgoe.supabase.co";
  const key = "sb_publishable_B608rXzlGxV4b0yk-6XaBw_riQTnj7y";
  const isNewKey = key.startsWith("sb_");

  const email = "salacbmam@gmail.com";
  const pass = "9p&8jA_))rF$e6C";

  const authClient = createClient(url, key, {
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

  const { data: authData } = await authClient.auth.signInWithPassword({ email, password: pass });
  const token = authData?.session?.access_token;

  const supabase = createClient(url, key, {
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

  const { data: reports, error } = await supabase
    .from("daily_reports")
    .select("id, report_date, shift, created_at")
    .order("report_date", { ascending: false });

  if (error) {
    console.error("Erro ao buscar relatórios:", error.message);
    return;
  }

  console.log(`📊 Total de relatórios no banco: ${reports.length}`);
  console.log("📅 Datas de Agosto (08/2026) no banco:");
  const augReports = reports.filter((r) => r.report_date.startsWith("2026-08"));
  console.log(augReports);

  console.log("\n📅 Todos os relatórios cadastrados:");
  console.log(reports.map(r => `${r.report_date} (${r.shift})`));
}

main().catch(console.error);
