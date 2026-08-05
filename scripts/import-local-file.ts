import * as XLSX from "xlsx";
import { createClient } from "@supabase/supabase-js";
import { parseDailyReportSheet, parseFileName } from "../src/lib/drive-import.server";
import { manausFirst } from "../src/lib/municipio-order";
import fs from "fs";
import path from "path";

function loadEnv() {
  const envPaths = [
    path.resolve(process.cwd(), ".env"),
    path.resolve(process.cwd(), ".env.local"),
  ];
  for (const envPath of envPaths) {
    if (fs.existsSync(envPath)) {
      const content = fs.readFileSync(envPath, "utf-8");
      for (const line of content.split("\n")) {
        const trimmed = line.trim();
        if (!trimmed || trimmed.startsWith("#")) continue;
        const [key, ...valParts] = trimmed.split("=");
        if (key && valParts.length > 0 && !process.env[key.trim()]) {
          process.env[key.trim()] = valParts.join("=").trim().replace(/^["']|["']$/g, "");
        }
      }
    }
  }
}

loadEnv();

async function importFile(filePath: string) {
  const fileName = path.basename(filePath);
  console.log(`\n📄 Processando arquivo local: ${fileName}...`);

  const { reportDate, shift } = parseFileName(fileName);
  if (!reportDate) {
    console.error(`❌ Não foi possível extrair a data do nome do arquivo: ${fileName}`);
    return;
  }

  console.log(`📅 Data do Relatório: ${reportDate} | Turno: ${shift}`);

  const fileBuf = fs.readFileSync(filePath);
  const wb = XLSX.read(fileBuf, { type: "buffer" });
  const sheetName =
    wb.SheetNames.find((n) =>
      /^relatorio/i.test(n.normalize("NFD").replace(/\p{Diacritic}/gu, "")),
    ) ?? wb.SheetNames[0];

  const ws = wb.Sheets[sheetName];
  if (!ws) {
    console.error("❌ Aba de relatório não encontrada na planilha.");
    return;
  }

  const matrix = XLSX.utils.sheet_to_json<any[]>(ws, { header: 1, raw: true, defval: null });
  const parsed = parseDailyReportSheet(matrix);

  console.log(`📊 Dados extraídos com sucesso:`);
  console.log(`   - Efetivo: ${parsed.efetivo.length} municípios`);
  console.log(`   - Recursos: ${parsed.recursos.length} registros`);
  console.log(`   - Incêndios: ${parsed.incendios.length} registros`);
  console.log(`   - Outras Ocorrências: ${parsed.outras.length} registros`);

  const supabaseUrl =
    process.env.CUSTOM_SUPABASE_URL ||
    process.env.VITE_CUSTOM_SUPABASE_URL ||
    process.env.VITE_SUPABASE_URL ||
    process.env.SUPABASE_URL;

  const supabaseKey =
    process.env.CUSTOM_SUPABASE_SERVICE_ROLE_KEY ||
    process.env.SUPABASE_SERVICE_ROLE_KEY ||
    process.env.CUSTOM_SUPABASE_PUBLISHABLE_KEY ||
    process.env.VITE_CUSTOM_SUPABASE_PUBLISHABLE_KEY ||
    process.env.VITE_SUPABASE_PUBLISHABLE_KEY;

  if (!supabaseUrl || !supabaseKey) {
    console.error("❌ Erro: Variáveis do Supabase não encontradas no .env");
    process.exit(1);
  }

  const isNewKey = supabaseKey.startsWith("sb_");
  const supabase = createClient(supabaseUrl, supabaseKey, {
    auth: { persistSession: false, autoRefreshToken: false },
    global: {
      fetch: (input, init) => {
        const headers = new Headers(init?.headers);
        if (isNewKey) headers.delete("Authorization");
        headers.set("apikey", supabaseKey);
        return fetch(input as any, { ...init, headers });
      },
    },
  });

  const payload = {
    report_date: reportDate,
    shift: shift,
    efetivo: manausFirst(parsed.efetivo),
    recursos: manausFirst(parsed.recursos),
    incendios: manausFirst(parsed.incendios),
    outras: manausFirst(parsed.outras),
  };

  const { data: existing } = await supabase
    .from("daily_reports")
    .select("id")
    .eq("report_date", reportDate)
    .eq("shift", shift)
    .maybeSingle();

  if (existing) {
    const { error } = await supabase
      .from("daily_reports")
      .update(payload)
      .eq("id", existing.id);

    if (error) {
      console.error(`❌ Erro ao atualizar Supabase: ${error.message}`);
    } else {
      console.log(`✅ Relatório atualizado no Supabase com SUCESSO! (ID: ${existing.id})`);
    }
  } else {
    const { error } = await supabase.from("daily_reports").insert(payload);

    if (error) {
      console.error(`❌ Erro ao inserir no Supabase: ${error.message}`);
    } else {
      console.log(`✅ Novo relatório inserido no Supabase com SUCESSO!`);
    }
  }
}

const targetPath = process.argv[2] || path.resolve(process.cwd(), "02.08.2026 - Relatório Diário Amazonas + Verde -24h.xlsx");
importFile(targetPath).catch((err) => {
  console.error("❌ Erro inesperado:", err);
  process.exit(1);
});
