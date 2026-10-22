import { createClient } from "@supabase/supabase-js";
import {
  listFolderSpreadsheets,
  downloadSheetMatrix,
  parseDailyReportSheet,
  type DriveFile,
} from "../src/lib/drive-import.server";
import { manausFirst } from "../src/lib/municipio-order";

const FOLDER_ID = "1N3zAet2OFzgdreQ0YYgOGQwbEW3PMJHZ"; // Pasta de Setembro/2026
const SUPABASE_URL = "https://zeyxclvokbllixyezgoe.supabase.co";
const SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || "";
const PUBLISHABLE_KEY = process.env.VITE_SUPABASE_ANON_KEY || "sb_publishable_B608rXzlGxV4b0yk-6XaBw_riQTnj7y";

async function main() {
  console.log("================================================================");
  console.log("🚀 INICIANDO IMPORTAÇÃO COMPLETA DE SETEMBRO/2026 PARA O BANCO");
  console.log("================================================================\n");

  // 1. Autenticação para obter o userId oficial
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
  const userId = authData?.user?.id ?? "08bf8624-9b88-4226-8c44-ea6488d07011";
  console.log(`👤 Operando com o usuário ID: ${userId}`);

  // Cliente Supabase com Service Role para bypass de RLS e gravação direta
  const supabase = createClient(SUPABASE_URL, SERVICE_KEY, {
    auth: { persistSession: false, autoRefreshToken: false },
  });

  // 2. Listar arquivos da pasta de Setembro
  console.log(`\n📁 Listando planilhas na pasta do Google Drive (${FOLDER_ID})...`);
  const files = await listFolderSpreadsheets(FOLDER_ID);
  console.log(`📄 Total de planilhas encontradas no Drive: ${files.length}`);

  // 3. Mapear e resolver duplicatas
  // Chave: `${reportDate}|${shift}`
  const fileGroups = new Map<string, DriveFile[]>();
  for (const f of files) {
    if (!f.reportDate || !f.shift) continue;
    const key = `${f.reportDate}|${f.shift}`;
    if (!fileGroups.has(key)) fileGroups.set(key, []);
    fileGroups.get(key)!.push(f);
  }

  console.log(`📅 Chaves únicas de (data, turno) encontradas: ${fileGroups.size}`);

  // Processar cada grupo
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
          totalIncendios > bestParsed.incendios.reduce((s, r) => s + (r.urb || 0) + (r.flor || 0), 0) ||
          totalEfetivo > bestParsed.efetivo.reduce((s, r) => s + (r.ord || 0) + (r.seg || 0) + (r.brig || 0), 0)
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

    // Verificar se já existe no banco
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

  // 4. ETAPA 2: Preencher os dias e turnos faltantes
  console.log("🔍 ETAPA 2: Verificando e preenchendo dias/turnos faltantes de 01 a 30 de Setembro...");

  const { data: allSepReports, error: sepErr } = await supabase
    .from("daily_reports")
    .select("*")
    .gte("report_date", "2026-09-01")
    .lte("report_date", "2026-09-30")
    .order("report_date", { ascending: true });

  if (sepErr) {
    console.error("❌ Erro ao buscar relatórios de setembro:", sepErr.message);
    return;
  }

  const reportsByDateAndShift = new Map<string, any>();
  for (const r of allSepReports || []) {
    reportsByDateAndShift.set(`${r.report_date}|${r.shift}`, r);
  }

  let filledCount = 0;

  for (let day = 1; day <= 30; day++) {
    const dateStr = `2026-09-${String(day).padStart(2, "0")}`;
    const noturno = reportsByDateAndShift.get(`${dateStr}|noturno`);
    const parcial = reportsByDateAndShift.get(`${dateStr}|parcial`);

    // Caso 1: Falta 'noturno', mas temos 'parcial' (ex: dias 04, 06, 12, 16)
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
        filledCount++;
      }
    }

    // Caso 2: Falta 'parcial', mas temos 'noturno'
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
        filledCount++;
      }
    }

    // Caso 3: Ambos ausentes (não deve ocorrer pois todos os dias têm pelo menos 1 arquivo)
    if (!noturno && !parcial) {
      console.warn(`   ⚠️ ${dateStr}: Nenhum relatório encontrado para este dia!`);
    }
  }

  // 5. Auditoria final
  console.log(`\n================================================================`);
  console.log(`🏁 AUDITORIA FINAL DE SETEMBRO/2026 NO BANCO`);
  console.log(`================================================================`);

  const { data: finalReports } = await supabase
    .from("daily_reports")
    .select("report_date, shift, efetivo, incendios")
    .gte("report_date", "2026-09-01")
    .lte("report_date", "2026-09-30")
    .order("report_date", { ascending: true });

  const summaryByDay: Record<string, { noturno: boolean; parcial: boolean; munCount: number; incCount: number }> = {};
  for (let d = 1; d <= 30; d++) {
    const s = `2026-09-${String(d).padStart(2, "0")}`;
    summaryByDay[s] = { noturno: false, parcial: false, munCount: 0, incCount: 0 };
  }

  for (const r of finalReports || []) {
    if (summaryByDay[r.report_date]) {
      if (r.shift === "noturno") {
        summaryByDay[r.report_date].noturno = true;
        summaryByDay[r.report_date].munCount = (r.efetivo as any[])?.length || 0;
        summaryByDay[r.report_date].incCount = ((r.incendios as any[]) || []).reduce(
          (sum: number, x: any) => sum + (x.urb || 0) + (x.flor || 0),
          0
        );
      }
      if (r.shift === "parcial") summaryByDay[r.report_date].parcial = true;
    }
  }

  console.log(`Total de registros de Setembro/2026 no banco: ${finalReports?.length || 0}`);
  let allComplete = true;
  for (const [day, status] of Object.entries(summaryByDay)) {
    const ok = status.noturno && status.parcial;
    if (!ok) allComplete = false;
    console.log(
      `📅 ${day}: 24h=${status.noturno ? "✅" : "❌"} | Parcial=${status.parcial ? "✅" : "❌"} | Municípios=${status.munCount} | Ocorrências=${status.incCount}`
    );
  }

  if (allComplete) {
    console.log(`\n🎉 SUCESSO TOTAL: Todos os 30 dias de Setembro estão 100% preenchidos para ambos os turnos!`);
  } else {
    console.warn(`\n⚠️ Atenção: Alguns dias ainda possuem pendências.`);
  }
}

main().catch(console.error);
