import fs from "fs";
import path from "path";
import { canonicalMunicipio, manausFirst, harmonizeMunicipalitySections } from "../src/lib/municipio-order.ts";
import { isFlorestalAmbiental } from "../src/lib/fire-classification.ts";
import { createClient } from "@supabase/supabase-js";

function ensureAllMunicipios(rows, defaultFactory) {
  const map = new Map();
  for (const r of rows) {
    const mun = canonicalMunicipio(r.mun || r.municipio);
    map.set(mun, { ...r, mun });
  }
  return manausFirst(Array.from(map.values()));
}

const csvPath = path.resolve("Demonstração · Ocorrências CBMAM.csv");

if (!fs.existsSync(csvPath)) {
  console.error(`Arquivo CSV não encontrado em ${csvPath}`);
  process.exit(1);
}

function parseCSV(text) {
  const rows = [];
  let currentRow = [];
  let currentField = "";
  let inQuotes = false;

  for (let i = 0; i < text.length; i++) {
    const char = text[i];
    const nextChar = text[i + 1];

    if (char === '"') {
      if (inQuotes && nextChar === '"') {
        currentField += '"';
        i++;
      } else {
        inQuotes = !inQuotes;
      }
    } else if (char === "," && !inQuotes) {
      currentRow.push(currentField);
      currentField = "";
    } else if ((char === "\r" || char === "\n") && !inQuotes) {
      if (char === "\r" && nextChar === "\n") {
        i++;
      }
      currentRow.push(currentField);
      if (currentRow.length > 1 || currentRow[0] !== "") {
        rows.push(currentRow);
      }
      currentRow = [];
      currentField = "";
    } else {
      currentField += char;
    }
  }

  if (currentField || currentRow.length > 0) {
    currentRow.push(currentField);
    rows.push(currentRow);
  }

  return rows;
}

const MONTH_MAP = {
  jan: "01", fev: "02", mar: "03", abr: "04", mai: "05", jun: "06",
  jul: "07", ago: "08", set: "09", out: "10", nov: "11", dez: "12",
  oct: "10", dec: "12", feb: "02", apr: "04", may: "05", aug: "08", sep: "09",
};

function parseDateAny(rawStr) {
  if (!rawStr || rawStr === "-" || rawStr === "null") return null;
  const s = rawStr.trim();

  // Ex: "2026-10-25" ou "2026-10-25 14:30:00"
  const isoMatch = s.match(/^(\d{4})-(\d{2})-(\d{2})(?:[T\s](\d{2}):(\d{2}))?/);
  if (isoMatch) {
    const [, y, m, d, hh, mm] = isoMatch;
    return {
      iso: `${y}-${m}-${d}`,
      br: `${d}/${m}/${y}`,
      time: hh && mm ? `${hh}:${mm}` : "—",
    };
  }

  // Ex: "25/10/2026"
  const brMatch = s.match(/^(\d{2})\/(\d{2})\/(\d{4})(?:[\s](\d{2}):(\d{2}))?/);
  if (brMatch) {
    const [, d, m, y, hh, mm] = brMatch;
    return {
      iso: `${y}-${m}-${d}`,
      br: `${d}/${m}/${y}`,
      time: hh && mm ? `${hh}:${mm}` : "—",
    };
  }

  // Ex: "Oct 27, 2026 @ 13:22:00.000"
  const usMatch = s.match(/([a-zA-Z]{3,})\s+(\d{1,2}),?\s+(\d{4})(?:\s*@\s*(\d{2}):(\d{2}))?/i);
  if (usMatch) {
    const [, monStr, dayStr, yrStr, hh, mm] = usMatch;
    const monKey = monStr.slice(0, 3).toLowerCase();
    const m = MONTH_MAP[monKey] || "01";
    const d = dayStr.padStart(2, "0");
    const y = yrStr;
    return {
      iso: `${y}-${m}-${d}`,
      br: `${d}/${m}/${y}`,
      time: hh && mm ? `${hh}:${mm}` : "—",
    };
  }

  return null;
}

function clean(v) {
  if (v == null) return "";
  const s = String(v).trim();
  return s === "-" || s === "null" || s === "undefined" ? "" : s;
}

function extractWaterLiters(text) {
  if (!text) return 0;
  const m = text.match(/([\d\.,]+)\s*(?:mil\s*)?(?:l|litros)\s*(?:d[eao]s?\s*)?(?:água|agua)?/i);
  if (m) {
    let raw = m[1].replace(/\./g, "").replace(",", ".");
    const val = parseFloat(raw);
    if (!isNaN(val) && val > 0 && val < 1000000) {
      if (/mil/i.test(m[0]) && val < 1000) return val * 1000;
      return val;
    }
  }
  return 0;
}

function extractFocos(text) {
  if (!text) return 0;
  const m = text.match(/(\d+)\s*focos?/i);
  if (m) {
    const val = parseInt(m[1], 10);
    if (!isNaN(val) && val > 0 && val < 1000) return val;
  }
  return 0;
}

function extractArea(text) {
  if (!text) return 0;
  const m = text.match(/([\d\.,]+)\s*(?:m²|m2|hectares?|ha)\b/i);
  if (m) {
    let raw = m[1].replace(/\./g, "").replace(",", ".");
    const val = parseFloat(raw);
    if (!isNaN(val) && val > 0) return val;
  }
  return 0;
}

function extractRelatoText(rawRelatos) {
  if (!rawRelatos) return "";
  if (rawRelatos.startsWith("{") || rawRelatos.startsWith("[")) {
    try {
      const parsed = JSON.parse(rawRelatos);
      if (Array.isArray(parsed?.relato)) {
        return parsed.relato.filter(Boolean).join("\n\n").trim();
      }
      if (typeof parsed?.relato === "string") {
        return parsed.relato.trim();
      }
      if (Array.isArray(parsed)) {
        return parsed.map((x) => (typeof x === "string" ? x : x?.relato || "")).filter(Boolean).join("\n\n").trim();
      }
    } catch {
      // fallback
    }
  }
  return rawRelatos.trim();
}

async function run() {
  console.log(`Lendo planilha CBMAM de ${csvPath}...`);
  const text = fs.readFileSync(csvPath, "utf-8");
  const rawRows = parseCSV(text);
  console.log(`Linhas totais parseadas do CSV: ${rawRows.length}`);

  const header = rawRows[0];
  const colMap = {};
  header.forEach((h, i) => {
    colMap[h.trim()] = i;
  });

  const parsedOccurrences = [];
  let skippedDates = 0;

  for (let i = 1; i < rawRows.length; i++) {
    const row = rawRows[i];
    if (!row || row.length === 0 || row.every((c) => !c)) continue;

    const id = clean(row[colMap["id"]]) || `occ-${i}`;
    const protocolo = clean(row[colMap["nrProtocolo"]]) || "—";

    const dateCandidates = [
      clean(row[colMap["dataHoraFato"]]),
      clean(row[colMap["dataFato"]]),
      clean(row[colMap["dataHoraRegistroUTC"]]),
    ];
    let parsedDate = null;
    for (const cand of dateCandidates) {
      if (cand) {
        parsedDate = parseDateAny(cand);
        if (parsedDate) break;
      }
    }

    if (!parsedDate) {
      skippedDates++;
      continue;
    }

    const munRaw = clean(row[colMap["nomeMunicipio"]]) || "Manaus";
    const municipio = canonicalMunicipio(munRaw);

    const bairro = clean(row[colMap["bairro"]]);
    const logradouro = clean(row[colMap["logradouro"]]);
    const endereco = logradouro || (bairro && bairro !== "Não Informado" ? `${bairro}, ${municipio}` : municipio);

    const coordenadas = clean(row[colMap["coordenadas"]]);

    const natFinal = clean(row[colMap["naturezaFinalizacaoObject.nomeNaturezaFinal"]]);
    const natInicial = clean(row[colMap["naturezaInicialDescricao"]]);
    const natFinais = clean(row[colMap["naturezasFinais"]]);
    const natureza = natFinal || natInicial || natFinais || "Incêndio";

    const grupoNatureza = clean(row[colMap["naturezaFinalizacaoObject.nomeGrupoNatureza"]]);
    const situacao = clean(row[colMap["situacaoDespachoDescricao"]]);
    const motivoFinalizacao = clean(row[colMap["motivoFinalizacaoDescricao"]]);

    const unidade = clean(row[colMap["filtroNomeUnidadeServico"]]) || clean(row[colMap["regiaoAtuacaoDescricao"]]);
    const equipes = clean(row[colMap["membrosEquipes"]]);
    const narrativa = clean(row[colMap["narrativa"]]);
    const relato = extractRelatoText(clean(row[colMap["relatos.relato"]]) || clean(row[colMap["relatos"]]));

    const combinedText = `${narrativa} ${relato}`;

    const colFocos = clean(row[colMap["gruposAdicionais.dados_incendio_florestal_vegetacao.dados_incendio_florestal_vegetacao.numeroFocosCombatidos"]]);
    let focos = colFocos ? parseFloat(colFocos.replace(",", ".")) : 0;
    if (!focos || isNaN(focos)) focos = extractFocos(combinedText);
    if (!focos || isNaN(focos)) focos = 1;

    const colArea = clean(row[colMap["gruposAdicionais.dados_incendio_florestal_vegetacao.dados_incendio_florestal_vegetacao.areaQueimadaCombatidaHa"]]);
    let area = colArea ? parseFloat(colArea.replace(",", ".")) : 0;
    if (!area || isNaN(area)) area = extractArea(combinedText);

    const agua = extractWaterLiters(combinedText);

    parsedOccurrences.push({
      id,
      protocolo,
      data: parsedDate.iso,
      dataBr: parsedDate.br,
      horario: parsedDate.time,
      municipio,
      bairro: bairro && bairro !== "Não Informado" ? bairro : undefined,
      endereco,
      natureza,
      grupoNatureza: grupoNatureza || undefined,
      situacao: situacao || undefined,
      motivoFinalizacao: motivoFinalizacao || undefined,
      focos,
      area,
      agua,
      coordenadas: coordenadas || undefined,
      unidade: unidade || undefined,
      equipes: equipes || undefined,
      narrativa: narrativa || undefined,
      relato: relato || undefined,
    });
  }

  console.log(`Ocorrências válidas extraídas da planilha: ${parsedOccurrences.length} (datas inválidas ignoradas: ${skippedDates})`);

  // Carregar occurrences.json atual para enriquecer e mesclar
  const jsonPath = path.resolve("src/data/occurrences.json");
  let existingOccurrences = [];
  if (fs.existsSync(jsonPath)) {
    try {
      existingOccurrences = JSON.parse(fs.readFileSync(jsonPath, "utf-8"));
    } catch (e) {
      console.warn("Aviso ao ler occurrences.json existente:", e.message);
    }
  }

  console.log(`Ocorrências pré-existentes em occurrences.json: ${existingOccurrences.length}`);

  // Chave única para deduplicação precisa
  function makeKey(occ) {
    if (occ.id && occ.id.length > 5 && !occ.id.startsWith("occ-") && !occ.id.startsWith("inc-")) {
      return `id:${occ.id.trim()}`;
    }
    if (occ.protocolo && occ.protocolo !== "-" && occ.protocolo !== "—" && occ.protocolo.length > 5) {
      return `proto:${occ.protocolo.trim().toUpperCase()}`;
    }
    const d = occ.data || "";
    const h = (occ.horario || "").slice(0, 5);
    const m = canonicalMunicipio(occ.municipio || "").toLowerCase();
    const e = (occ.endereco || "").toLowerCase().replace(/[^a-z0-9]/g, "").slice(0, 30);
    const n = (occ.natureza || "").toLowerCase().replace(/[^a-z0-9]/g, "").slice(0, 25);
    return `sig:${d}|${h}|${m}|${e}|${n}`;
  }

  const mergedMap = new Map();

  // Primeiro insere as já existentes
  for (const item of existingOccurrences) {
    const k = makeKey(item);
    mergedMap.set(k, { ...item });
  }

  let enrichedCount = 0;
  let newInsertedCount = 0;

  // Depois mescla todas as 8.854 do CSV atualizado, enriquecendo ou inserindo novas
  for (const parsed of parsedOccurrences) {
    const k = makeKey(parsed);
    const existing = mergedMap.get(k);
    if (existing) {
      // Enriquecer campos que estavam vazios ou incompletos
      let enriched = false;
      if (!existing.relato && parsed.relato) {
        existing.relato = parsed.relato;
        enriched = true;
      }
      if (!existing.narrativa && parsed.narrativa) {
        existing.narrativa = parsed.narrativa;
        enriched = true;
      }
      if (!existing.equipes && parsed.equipes) {
        existing.equipes = parsed.equipes;
        enriched = true;
      }
      if (!existing.unidade && parsed.unidade) {
        existing.unidade = parsed.unidade;
        enriched = true;
      }
      if (!existing.coordenadas && parsed.coordenadas) {
        existing.coordenadas = parsed.coordenadas;
        enriched = true;
      }
      if ((!existing.agua || existing.agua === 0) && parsed.agua > 0) {
        existing.agua = parsed.agua;
        enriched = true;
      }
      if ((!existing.focos || existing.focos === 0) && parsed.focos > 0) {
        existing.focos = parsed.focos;
        enriched = true;
      }
      if ((!existing.area || existing.area === 0) && parsed.area > 0) {
        existing.area = parsed.area;
        enriched = true;
      }
      if (!existing.grupoNatureza && parsed.grupoNatureza) {
        existing.grupoNatureza = parsed.grupoNatureza;
        enriched = true;
      }
      if (!existing.situacao && parsed.situacao) {
        existing.situacao = parsed.situacao;
        enriched = true;
      }
      if (!existing.motivoFinalizacao && parsed.motivoFinalizacao) {
        existing.motivoFinalizacao = parsed.motivoFinalizacao;
        enriched = true;
      }
      if (enriched) enrichedCount++;
    } else {
      mergedMap.set(k, parsed);
      newInsertedCount++;
    }
  }

  const finalOccurrences = Array.from(mergedMap.values());
  // Ordenar decrescente por data e horário
  finalOccurrences.sort((a, b) => b.data.localeCompare(a.data) || b.horario.localeCompare(a.horario));

  console.log(`Total final consolidado: ${finalOccurrences.length} ocorrências.`);
  console.log(`Novas ocorrências adicionadas: ${newInsertedCount}`);
  console.log(`Ocorrências existentes enriquecidas com relatos/água/equipes: ${enrichedCount}`);

  // Salvar no disco
  fs.writeFileSync(jsonPath, JSON.stringify(finalOccurrences, null, 2), "utf-8");
  const mb = (fs.statSync(jsonPath).size / 1024 / 1024).toFixed(2);
  console.log(`Salvo em ${jsonPath} (${mb} MB).`);

  // Análise de datas no dataset
  const dateCounts = new Map();
  for (const o of finalOccurrences) {
    dateCounts.set(o.data, (dateCounts.get(o.data) || 0) + 1);
  }
  const allDates = Array.from(dateCounts.keys()).sort();
  console.log(`Abrangência temporal: de ${allDates[0]} até ${allDates[allDates.length - 1]} (${allDates.length} dias distintos).`);
  console.log("Dias recentes com ocorrências:");
  for (const d of allDates.slice(-5)) {
    console.log(`  - ${d}: ${dateCounts.get(d)} ocorrências`);
  }

  // Sincronização com Supabase
  const url = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (url && key) {
    const supabase = createClient(url, key);
    console.log("\nSincronizando com Supabase...");

    // 1. Sincronizar dias recentes (ex: 2026-10-27, 2026-10-26, 2026-10-25) com daily_reports
    const recentDays = allDates.slice(-5);
    for (const d of recentDays) {
      const { data: existingReport } = await supabase
        .from("daily_reports")
        .select("id, report_date, shift, efetivo, recursos, incendios, outras, notes")
        .eq("report_date", d)
        .order("shift", { ascending: false })
        .limit(1)
        .maybeSingle();

      const dayOccs = finalOccurrences.filter((o) => o.data === d);
      console.log(`Verificando dia ${d} no Supabase: ${existingReport ? "já existe relatório" : "não existe relatório"}, com ${dayOccs.length} ocorrências.`);

      if (!existingReport) {
        // Obter efetivo e recursos do dia anterior mais recente
        const { data: donor } = await supabase
          .from("daily_reports")
          .select("efetivo, recursos, outras, notes")
          .lt("report_date", d)
          .order("report_date", { ascending: false })
          .limit(1)
          .maybeSingle();

        // Sintetizar incêndios diários das ocorrências oficiais CAD
        const munMap = new Map();
        for (const occ of dayOccs) {
          const mun = canonicalMunicipio(occ.municipio);
          const cur = munMap.get(mun) || { urb: 0, flor: 0, focos: 0, total_periodo: 0 };
          const isFlor = isFlorestalAmbiental(occ.natureza);
          if (isFlor) cur.flor += 1;
          else cur.urb += 1;
          cur.focos += Math.max(1, Number(occ.focos) || 1);
          cur.total_periodo += 1;
          munMap.set(mun, cur);
        }

        const incendiosSintetizados = ensureAllMunicipios(
          Array.from(munMap.entries()).map(([mun, vals]) => ({ mun, ...vals })),
          (mun) => ({ mun, urb: 0, flor: 0, focos: 0, total_periodo: 0 })
        );

        const harmonized = harmonizeMunicipalitySections(
          donor?.efetivo || [],
          donor?.recursos || [],
          incendiosSintetizados,
          (mun) => ({ mun, cbmam: 0, ord: 0, seg: 0, brig: 0 }),
          (mun) => ({ mun, viaturas: 0, aeronaves: 0, embarcacoes: 0 }),
          (mun) => ({ mun, urb: 0, flor: 0, focos: 0, total_periodo: 0 })
        );

        const dateParts = d.split("-");
        const dateBr = `${dateParts[2]}/${dateParts[1]}/${dateParts[0]}`;

        const notes = JSON.stringify({
          header: {
            titulo: "Relatório Diário — Sala de Situação",
            periodo: `${dateBr} · 24h (18:30–07:00)`,
            comandante: "CEL QOBM BORGES",
            chefeCapital: "CEL QOBM MENEZES",
            chefeInterior: "CEL QOBM MONTEIRO",
            coordSituacao: "CEL QOBM FERREIRA",
            coordenador: "CEL QOBM CRISTIANO BRAZ FERREIRA",
            subcomandante: "Subcomandante-Geral do CBMAM",
          },
          occurrences: dayOccs.map((o) => ({
            id: o.id,
            protocolo: o.protocolo,
            data: o.dataBr || dateBr,
            municipio: o.municipio,
            horario: o.horario,
            natureza: o.natureza,
            focos: o.focos,
            coordenadas: o.coordenadas || "—",
            endereco: o.endereco,
            area: o.area,
            agua: o.agua,
            bairro: o.bairro,
            grupoNatureza: o.grupoNatureza,
            situacao: o.situacao,
            motivoFinalizacao: o.motivoFinalizacao,
            unidade: o.unidade,
            equipes: o.equipes,
            narrativa: o.narrativa,
            relato: o.relato,
          })),
        });

        const newReport = {
          report_date: d,
          shift: "noturno",
          efetivo: harmonized.efetivo,
          recursos: harmonized.recursos,
          incendios: harmonized.incendios,
          outras: donor?.outras || [],
          notes,
        };

        const { error: insErr } = await supabase.from("daily_reports").insert(newReport);
        if (insErr) {
          console.error(`Erro ao inserir daily_report para ${d}:`, insErr.message);
        } else {
          console.log(`Relatório diário criado com sucesso no Supabase para ${d}!`);
        }
      } else {
        // Se já existe, atualizamos o envelope notes com as ocorrências enriquecidas
        try {
          let env = {};
          if (typeof existingReport.notes === "string" && existingReport.notes.startsWith("{")) {
            env = JSON.parse(existingReport.notes);
          }
          env.occurrences = dayOccs.map((o) => ({
            id: o.id,
            protocolo: o.protocolo,
            data: o.dataBr,
            municipio: o.municipio,
            horario: o.horario,
            natureza: o.natureza,
            focos: o.focos,
            coordenadas: o.coordenadas || "—",
            endereco: o.endereco,
            area: o.area,
            agua: o.agua,
            bairro: o.bairro,
            grupoNatureza: o.grupoNatureza,
            situacao: o.situacao,
            motivoFinalizacao: o.motivoFinalizacao,
            unidade: o.unidade,
            equipes: o.equipes,
            narrativa: o.narrativa,
            relato: o.relato,
          }));

          await supabase.from("daily_reports").update({ notes: JSON.stringify(env) }).eq("id", existingReport.id);
          console.log(`Relatório diário existente para ${d} atualizado com as ocorrências enriquecidas.`);
        } catch (updErr) {
          console.warn(`Aviso ao atualizar notes de ${d}:`, updErr.message);
        }
      }
    }
  }

  console.log("\nProcessamento concluído com sucesso total!");
}

run().catch((err) => {
  console.error("Falha ao processar:", err);
  process.exit(1);
});
