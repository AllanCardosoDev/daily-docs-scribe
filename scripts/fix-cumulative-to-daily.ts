import { createClient } from "@supabase/supabase-js";

const supabase = createClient(
  "https://zeyxclvokbllixyezgoe.supabase.co",
  "sb_publishable_B608rXzlGxV4b0yk-6XaBw_riQTnj7y"
);

async function convertCumulativeToDaily() {
  console.log("📡 Autenticando no Supabase...");
  await supabase.auth.signInWithPassword({
    email: "salacbmam@gmail.com",
    password: "9p&8jA_))rF$e6C",
  });

  console.log("🔍 Buscando relatórios diários em ordem cronológica...");
  const { data: rows, error } = await supabase
    .from("daily_reports")
    .select("id, report_date, shift, incendios")
    .order("report_date", { ascending: true })
    .order("shift", { ascending: true });

  if (error || !rows) {
    console.error("Erro ao buscar relatórios:", error);
    process.exit(1);
  }

  console.log(`Encontrados ${rows.length} relatórios.`);

  // Guardamos o último acumulado conhecido por município
  const prevCumulativeMap = new Map<string, { urb: number; flor: number; focos: number }>();

  let updatedCount = 0;

  for (const row of rows) {
    const rawIncendios = (row.incendios as any[]) ?? [];
    if (!Array.isArray(rawIncendios) || rawIncendios.length === 0) continue;

    const dailyIncendios: any[] = [];
    let isCumulativeDetected = false;

    for (const item of rawIncendios) {
      const mun = item.mun || item.municipio;
      if (!mun) continue;

      const rawUrb = Number(item.urb) || 0;
      const rawFlor = Number(item.flor) || 0;
      const rawFocos = Number(item.focos) || 0;

      // Se qualquer valor numérico for maior que 30, é um acumulado do ano
      if (rawUrb > 30 || rawFlor > 30 || rawFocos > 100) {
        isCumulativeDetected = true;
      }

      const key = mun.trim().toLowerCase();
      const prev = prevCumulativeMap.get(key) ?? { urb: 0, flor: 0, focos: 0 };

      // Se os valores brutos forem acumulados (maiores que prev ou > 30), calculamos o delta do dia
      let dailyUrb = rawUrb;
      let dailyFlor = rawFlor;
      let dailyFocos = rawFocos;

      if (rawUrb > 30 || rawUrb >= prev.urb) {
        dailyUrb = prev.urb > 0 ? Math.max(0, rawUrb - prev.urb) : (rawUrb > 30 ? 0 : rawUrb);
      }
      if (rawFlor > 30 || rawFlor >= prev.flor) {
        dailyFlor = prev.flor > 0 ? Math.max(0, rawFlor - prev.flor) : (rawFlor > 30 ? 0 : rawFlor);
      }
      if (rawFocos > 100 || rawFocos >= prev.focos) {
        dailyFocos = prev.focos > 0 ? Math.max(0, rawFocos - prev.focos) : (rawFocos > 100 ? 0 : rawFocos);
      }

      // Atualiza o mapa de acumulado anterior com o valor bruto acumulado deste dia
      prevCumulativeMap.set(key, {
        urb: Math.max(prev.urb, rawUrb),
        flor: Math.max(prev.flor, rawFlor),
        focos: Math.max(prev.focos, rawFocos),
      });

      dailyIncendios.push({
        mun,
        urb: dailyUrb,
        flor: dailyFlor,
        focos: dailyFocos,
        total_periodo: dailyUrb + dailyFlor,
      });
    }

    if (isCumulativeDetected) {
      const { error: updateErr } = await supabase
        .from("daily_reports")
        .update({ incendios: dailyIncendios as any })
        .eq("id", row.id);

      if (updateErr) {
        console.error(`Erro ao atualizar id ${row.id}:`, updateErr.message);
      } else {
        updatedCount++;
      }
    }
  }

  console.log(`✅ Ajuste de ocorrências diárias concluído! ${updatedCount} relatórios sanitizados.`);
}

convertCumulativeToDaily().catch(console.error);
