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
  console.error("SUPABASE_SERVICE_ROLE_KEY não configurada");
  process.exit(1);
}

const adminClient = createClient(SUPABASE_URL, SERVICE_KEY, {
  auth: { persistSession: false, autoRefreshToken: false },
});

const TARGET_USERS = [
  {
    email: "amanndasilva02@gmail.com",
    nome: "Amannda Souza de Carvalho",
    posto: "2º SGT QCPBM",
    fone: "(92) 99112-7092",
    senha: "Cbmam@Amannda2026!",
  },
  {
    email: "elianelago29@gmail.com",
    nome: "Eliane dos Anjos do Lago",
    posto: "3º SGT QCPBM",
    fone: "(92) 98475-8121",
    senha: "Cbmam@Eliane2026!",
  },
  {
    email: "lucicleiabm@gmail.com",
    nome: "Lucicleia Cardoso de Araújo",
    posto: "2º SGT QCPBM",
    fone: "(92) 98241-6163",
    senha: "Cbmam@Lucicleia2026!",
  },
  {
    email: "fabrinacbmam@gmail.com",
    nome: "Fabrina Ribeiro Martins",
    posto: "3º SGT QCPBM",
    fone: "(92) 99393-4584",
    senha: "Cbmam@Fabrina2026!",
  },
  {
    email: "mortaguaodonto@gmail.com",
    nome: "Andressa Cecília de Souza Mortágua Barbosa",
    posto: "3º SGT QCPBM",
    fone: "(92) 99141-7990",
    senha: "Cbmam@Andressa2026!",
  },
  {
    email: "thalytaryanna@gmail.com",
    nome: "Ana Maria de Souza Guimarães",
    posto: "2º SGT QCPBM",
    fone: "(92) 99277-9045",
    senha: "Cbmam@AnaMaria2026!",
  },
  {
    email: "enf.naraadriana@gmail.com",
    nome: "NARA ADRIANA ANDRADE FIGUEIREDO DA SILVA",
    posto: "2º SGT QCPBM",
    fone: "(92) 98137-7639",
    senha: "Cbmam@Nara2026!",
  },
];

async function main() {
  console.log("=== CONFIGURANDO ACESSO OFICIAL DOS 6 SARGENTOS CBMAM ===");
  const results = [];

  const { data: allUsersData } = await adminClient.auth.admin.listUsers();
  const existingUsers = allUsersData?.users || [];

  for (const u of TARGET_USERS) {
    const displayName = `${u.posto} ${u.nome}`;
    let userObj = existingUsers.find((x) => x.email?.toLowerCase() === u.email.toLowerCase());

    if (!userObj) {
      console.log(`Criando usuário auth: ${u.email}`);
      const { data: created, error: createErr } = await adminClient.auth.admin.createUser({
        email: u.email,
        password: u.senha,
        email_confirm: true,
        user_metadata: {
          display_name: displayName,
          full_name: u.nome,
          rank: u.posto,
          phone: u.fone,
        },
      });
      if (createErr) {
        console.error(`Erro ao criar ${u.email}:`, createErr);
        continue;
      }
      userObj = created.user;
    } else {
      console.log(`Atualizando usuário existente: ${u.email} (${userObj.id})`);
      const { error: updErr } = await adminClient.auth.admin.updateUserById(userObj.id, {
        password: u.senha,
        email_confirm: true,
        user_metadata: {
          display_name: displayName,
          full_name: u.nome,
          rank: u.posto,
          phone: u.fone,
        },
      });
      if (updErr) {
        console.error(`Erro ao atualizar senha de ${u.email}:`, updErr);
      }
    }

    const userId = userObj.id;

    // Atualiza/Cria Profile
    const { error: profErr } = await adminClient.from("profiles").upsert(
      {
        id: userId,
        email: u.email,
        display_name: displayName,
        sinesp_rank: u.posto,
        sinesp_full_name: displayName,
      },
      { onConflict: "id" }
    );
    if (profErr) {
      console.error(`Erro ao atualizar profile ${u.email}:`, profErr);
    }

    // Role 'admin'
    const { data: roles } = await adminClient.from("user_roles").select("*").eq("user_id", userId);
    if (roles && roles.length > 0) {
      await adminClient.from("user_roles").update({ role: "admin" }).eq("user_id", userId);
    } else {
      await adminClient.from("user_roles").insert({ user_id: userId, role: "admin" });
    }

    // Gerar Link de Acesso / Redefinição
    let actionLink = "";
    try {
      const { data: linkData } = await adminClient.auth.admin.generateLink({
        type: "magiclink",
        email: u.email,
      });
      actionLink = linkData?.properties?.action_link || "";
    } catch (e) {
      // ignore
    }

    results.push({
      email: u.email,
      nome: u.nome,
      posto: u.posto,
      displayName,
      fone: u.fone,
      senha: u.senha,
      actionLink,
    });
  }

  console.log("\n=== RESULTADO FINAL ===");
  console.log(JSON.stringify(results, null, 2));
}

main().catch(console.error);
