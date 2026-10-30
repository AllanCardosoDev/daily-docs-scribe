import { createClient } from "@supabase/supabase-js";
import fs from "fs";
import path from "path";

const envPath = path.resolve(process.cwd(), ".env");
if (fs.existsSync(envPath)) {
  const content = fs.readFileSync(envPath, "utf-8");
  for (const line of content.split("\n")) {
    const match = line.match(/^\s*([\w.-]+)\s*=\s*(.*)?\s*$/);
    if (match) {
      let val = match[2] ? match[2].trim() : "";
      if (val.startsWith('"') && val.endsWith('"')) val = val.slice(1, -1);
      process.env[match[1]] = val;
    }
  }
}

const SUPABASE_URL = process.env.SUPABASE_URL || "https://zeyxclvokbllixyezgoe.supabase.co";
const SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!SERVICE_KEY) {
  console.error("SUPABASE_SERVICE_ROLE_KEY não configurada no .env");
  process.exit(1);
}

const isNewKey = SERVICE_KEY.startsWith("sb_");

const adminClient = createClient(SUPABASE_URL, SERVICE_KEY, {
  auth: { persistSession: false, autoRefreshToken: false },
  global: {
    fetch: (input, init) => {
      const headers = new Headers(init?.headers);
      if (isNewKey) headers.delete("Authorization");
      headers.set("apikey", SERVICE_KEY);
      return fetch(input as any, { ...init, headers });
    },
  },
});

async function main() {
  const users = [
    { email: "eltonamaral@hotmail.com", password: "Cbmam@Amazonas2026!" },
    { email: "amanndasilva02@gmail.com", password: "Cbmam@Amazonas2026!" },
  ];

  for (const { email, password } of users) {
    const { data: userData, error: getErr } = await adminClient.auth.admin.listUsers();
    const user = userData?.users.find((u) => u.email?.toLowerCase() === email.toLowerCase());

    if (!user) {
      console.log(`Usuário não encontrado: ${email}`);
      continue;
    }

    // Atualiza a senha para a senha oficial padrão conhecida
    const { error: updateErr } = await adminClient.auth.admin.updateUserById(user.id, {
      password: password,
      email_confirm: true,
    });

    if (updateErr) {
      console.error(`Erro ao atualizar senha de ${email}:`, updateErr.message);
    } else {
      console.log(`✅ Senha definida com sucesso para ${email}!`);
    }

    // Garante role 'admin'
    const { data: roles } = await adminClient.from("user_roles").select("*").eq("user_id", user.id);
    if (roles && roles.length > 0) {
      await adminClient.from("user_roles").update({ role: "admin" }).eq("user_id", user.id);
      console.log(`✅ Role atualizada para 'admin' para ${email}.`);
    } else {
      await adminClient.from("user_roles").insert({ user_id: user.id, role: "admin" });
      console.log(`✅ Role 'admin' inserida para ${email}.`);
    }

    // Gera link de recuperação/primeiro acesso se desejarem trocar
    const { data: linkData, error: linkErr } = await adminClient.auth.admin.generateLink({
      type: "recovery",
      email: email,
    });

    if (!linkErr && linkData?.properties?.action_link) {
      console.log(`🔗 Link de acesso direto/redefinição para ${email}:`);
      console.log(`   ${linkData.properties.action_link}`);
    }
  }
}

main().catch(console.error);
