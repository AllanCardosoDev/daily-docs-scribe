import { createClient } from "@supabase/supabase-js";
import {
  listFolderSpreadsheets,
  downloadSheetMatrix,
  parseDailyReportSheet,
  type DriveFile,
} from "../src/lib/drive-import.server";
import { manausFirst } from "../src/lib/municipio-order";

const FOLDER_ID = "1N71G18dgxO2yhA20LqXREcOfseTU8xz7"; // Pasta de Outubro/2026
const SUPABASE_URL = "https://zeyxclvokbllixyezgoe.supabase.co";
const SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || "";
const PUBLISHABLE_KEY = process.env.VITE_SUPABASE_ANON_KEY || "sb_publishable_B608rXzlGxV4b0yk-6XaBw_riQTnj7y";

async function main() {
  console.log("================================================================");
  console.log("🚀 INICIANDO IMPORTAÇÃO COMPLETA DE OUTUBRO/2026 PARA O BANCO");
  console.log("================================================================\n");

  const authClient = createClient(SUPABASE_URL, PUBLISHABLE_KEY, {
    auth: { persistSession: false, autoRefreshToken: false },
    global: {
      fetch: (input, init) => {
        const headers = new Headers(init?.headers);
        if (PUBLISHABLE_KEY.startsWith("sb_")) headers.delete("Authorization");
        headers.set("apikey", PUBLISHABLE_KEY);
        return fetch(input as any, { ...init, headers });
      },
    },
  });

  const { data: authData } = await authClient.auth.signInWithPassword({
    email: "salacbmam@gmail.com",
    password: "9p&8jA_))rF$e6C",
  });
  const userId = authData?.user?.id ?? "50ed7e9d-9214-4162-a92f-9f0d68124d03";
  console.log(`👤 Operando com o usuário ID: ${userId}`);

  const supabase = createClient(SUPABASE_URL, SERVICE_KEY, {
    auth: { persistSession: false, autoRefreshToken: false },
  });

  console.log(`\n📁 Listando planilhas na pasta do Google Drive (${FOLDER_ID})...`);
  const files = await listFolderSpreadsheets(FOLDER_ID);
  console.log(`📄 Total de planilhas encontradas no Drive para Outubro: ${files.length}`);

  const fileGroups = new Map<string, DriveFile[]>();
  for (const f of files) {
    if (!f.reportDate || !f.shift) continue;
    const key = `${f.reportDate}|${f.shift}`;
    if (!fileGroups.has(key)) fileGroups.set(key, []);
    fileGroups.get(key)!.push(f);
  }

  let importedCount = 0;
  let errorCount = 0;

  for (const [key, group] of fileGroups.entries()) {
    const [reportDate, shift] = key.split("|");
    console.log(`\n⏳ Processando [${reportDate} - ${shift.toUpperCase()}] (${group.length} arquivo(s))...`);

    let bestParsed: ReturnType<typeof parseDailyReportSheet> | null = null;
    let bestFileName = "";

    for (const f of group) {
      try {
        console.log(`   ⬇️ Baixando: "${f.name}"...`);
        const matrix = await downloadSheetMatrix(f.id);
        const parsed = parseDailyReportSheet(matrix);

        const totalIncendios = parsed.incendios.reduce((s, r) => s + (r.urb || 0) + (r.flor || 0), 0);
        const totalEfetivo = parsed.efetivo.reduce((s, r) => s + (r.ord || 0) + (r.seg || 0) + (r.brig || 0), 0);
        console.log(`   📊 Conteúdo lido: efetivo=${totalEfetivo}, ocorrências incêndio=${totalIncendios}`);

        if (
          !bestParsed ||
          totalIncendios > bestParsed.incendios.reduce((s, r) => s + (r.urb || 0) + (r.flor || 0), 0)
        ) {
          bestParsed = parsed;
          bestFileName = f.name;
        }
      } catch (err: any) {
        console.error(`   ❌ Erro ao baixar/parsear ${f.name}:`, err.message);
      }
    }

    if (!bestParsed) {
      console.error(`   ❌ Falha ao obter dados válidos para ${key}`);
      errorCount++;
      continue;
    }

    const payload = {
      report_date: reportDate,
      shift: shift,
      efetivo: manausFirst(bestParsed.efetivo),
      recursos: manausFirst(bestParsed.recursos),
      incendios: manausFirst(bestParsed.incendios),
      outras: manausFirst(bestParsed.outras),
      notes: `Importado da planilha oficial do Google Drive (${bestFileName})`,
      version: 1,
      updated_by: userId,
      created_by: userId,
      updated_at: new Date().toISOString(),
    };

    const { data: existing } = await supabase
      .from("daily_reports")
      .select("id")
      .eq("report_date", reportDate)
      .eq("shift", shift)
      .maybeSingle();

    if (existing) {
      const { error: upErr } = await supabase
        .from("daily_reports")
        .update(payload)
        .eq("id", existing.id);
      if (upErr) {
        console.error(`   ❌ Erro ao atualizar no banco: ${upErr.message}`);
        errorCount++;
      } else {
        console.log(`   ✅ Atualizado no banco (ID: ${existing.id})`);
        importedCount++;
      }
    } else {
      const { data: inserted, error: insErr } = await supabase
        .from("daily_reports")
        .insert({
          ...payload,
          created_at: new Date().toISOString(),
        })
        .select("id")
        .single();

      if (insErr) {
        console.error(`   ❌ Erro ao inserir no banco: ${insErr.message}`);
        errorCount++;
      } else {
        console.log(`   ✅ Inserido no banco (ID: ${inserted?.id})`);
        importedCount++;
      }
    }
  }

  console.log(`\n================================================================`);
  console.log(`📊 ETAPA 1 CONCLUÍDA: ${importedCount} relatórios importados (${errorCount} erros)`);
  console.log(`================================================================\n`);

  // ETAPA 2: Preencher turnos faltantes para os dias existentes de Outubro
  console.log("🔍 ETAPA 2: Verificando e preenchendo turnos faltantes em Outubro...");

  const { data: allOctReports, error: octErr } = await supabase
    .from("daily_reports")
    .select("*")
    .gte("report_date", "2026-10-01")
    .lte("report_date", "2026-10-31")
    .order("report_date", { ascending: true });

  if (octErr) {
    console.error("❌ Erro ao buscar relatórios de outubro:", octErr.message);
    return;
  }

  const reportsByDateAndShift = new Map<string, any>();
  const availableDates = new Set<string>();
  for (const r of allOctReports || []) {
    reportsByDateAndShift.set(`${r.report_date}|${r.shift}`, r);
    availableDates.add(r.report_date);
  }

  const sortedDates = Array.from(availableDates).sort();

  for (const dateStr of sortedDates) {
    const noturno = reportsByDateAndShift.get(`${dateStr}|noturno`);
    const parcial = reportsByDateAndShift.get(`${dateStr}|parcial`);

    if (!noturno && parcial) {
      console.log(`   🛠️ ${dateStr}: Ausente 'noturno'. Preenchendo com base no relatório 'parcial'...`);
      const payload = {
        report_date: dateStr,
        shift: "noturno",
        efetivo: parcial.efetivo,
        recursos: parcial.recursos,
        incendios: parcial.incendios,
        outras: parcial.outras,
        notes: `Preenchido automaticamente a partir do relatório Parcial (24h ausente na pasta oficial)`,
        version: 1,
        created_by: userId,
        updated_by: userId,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      };
      const { data: ins, error: err } = await supabase.from("daily_reports").insert(payload).select("id").single();
      if (err) {
        console.error(`      ❌ Erro ao preencher noturno de ${dateStr}:`, err.message);
      } else {
        console.log(`      ✅ Noturno de ${dateStr} preenchido com sucesso (ID: ${ins?.id})`);
        reportsByDateAndShift.set(`${dateStr}|noturno`, payload);
      }
    }

    if (!parcial && noturno) {
      console.log(`   🛠️ ${dateStr}: Ausente 'parcial'. Preenchendo com base no relatório 'noturno'...`);
      const payload = {
        report_date: dateStr,
        shift: "parcial",
        efetivo: noturno.efetivo,
        recursos: noturno.recursos,
        incendios: noturno.incendios,
        outras: noturno.outras,
        notes: `Preenchido automaticamente a partir do relatório 24h (Parcial ausente na pasta oficial)`,
        version: 1,
        created_by: userId,
        updated_by: userId,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      };
      const { data: ins, error: err } = await supabase.from("daily_reports").insert(payload).select("id").single();
      if (err) {
        console.error(`      ❌ Erro ao preencher parcial de ${dateStr}:`, err.message);
      } else {
        console.log(`      ✅ Parcial de ${dateStr} preenchido com sucesso (ID: ${ins?.id})`);
        reportsByDateAndShift.set(`${dateStr}|parcial`, payload);
      }
    }
  }

  // Auditoria Final
  console.log(`\n================================================================`);
  console.log(`🏁 AUDITORIA FINAL DE OUTUBRO/2026 NO BANCO`);
  console.log(`================================================================`);

  const { data: finalReports } = await supabase
    .from("daily_reports")
    .select("report_date, shift, efetivo, incendios, notes")
    .gte("report_date", "2026-10-01")
    .lte("report_date", "2026-10-31")
    .order("report_date", { ascending: true })
    .order("shift", { ascending: false });

  console.log(`Total de registros de Outubro/2026 no banco: ${finalReports?.length || 0}`);
  for (const r of finalReports || []) {
    const incs = (r.incendios as any[]) || [];
    const efs = (r.efetivo as any[]) || [];
    const totalInc = incs.reduce((s, x) => s + (x.urb || 0) + (x.flor || 0), 0);
    const totalEf = efs.reduce((s, x) => s + (x.ord || 0) + (x.seg || 0) + (x.brig || 0), 0);
    console.log(`📅 ${r.report_date} (${r.shift}): efetivo=${totalEf}, incêndios=${totalInc} | ${r.notes}`);
  }
}

main().catch(console.error);
