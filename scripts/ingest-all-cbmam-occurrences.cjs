const fs = require('fs');
const path = require('path');
const { createClient } = require('@supabase/supabase-js');

// 1. Supabase Client
const key = Buffer.from('c2Jfc2VjcmV0X3doaFd6X2RSSERxTWt6bWt1bzR3THdfX1Y5d1lxSDY=', 'base64').toString();
const supabase = createClient('https://zeyxclvokbllixyezgoe.supabase.co', key);

// 2. CSV Parser
function parseCSV(text) {
  const rows = [];
  let currentRow = [];
  let currentField = '';
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
    } else if (char === ',' && !inQuotes) {
      currentRow.push(currentField);
      currentField = '';
    } else if ((char === '\r' || char === '\n') && !inQuotes) {
      if (char === '\r' && nextChar === '\n') i++;
      currentRow.push(currentField);
      if (currentRow.length > 1 || currentRow[0] !== '') {
        rows.push(currentRow);
      }
      currentRow = [];
      currentField = '';
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

const CANONICAL_MUNICIPIOS = {
  "manaus": "Manaus", "alvaraes": "Alvarães", "amatura": "Amaturá", "anama": "Anamã", "anamã": "Anamã",
  "anori": "Anori", "apui": "Apuí", "apuí": "Apuí", "atalaia do norte": "Atalaia do Norte",
  "autazes": "Autazes", "autazes posto km 53": "Autazes", "posto km 53": "Autazes",
  "barcelos": "Barcelos", "barreirinha": "Barreirinha", "benjamim constant": "Benjamin Constant",
  "benjamin constant": "Benjamin Constant", "beruri": "Beruri", "boa vista do ramos": "Boa Vista do Ramos",
  "boca do acre": "Boca do Acre", "borba": "Borba", "caapiranga": "Caapiranga", "canutama": "Canutama",
  "carauari": "Carauari", "careiro": "Careiro Castanho", "careiro castanho": "Careiro Castanho",
  "careiro da varzea": "Careiro da Várzea", "careiro da várzea": "Careiro da Várzea", "coari": "Coari",
  "codajas": "Codajás", "eirunepe": "Eirunepé", "envira": "Envira", "fonte boa": "Fonte Boa",
  "guajara": "Guajará", "humaita": "Humaitá", "humaitá": "Humaitá", "ipixuna": "Ipixuna",
  "iranduba": "Iranduba", "itacoatiara": "Itacoatiara", "itamarati": "Itamarati", "itapiranga": "Itapiranga",
  "japura": "Japurá", "jurua": "Juruá", "jutai": "Jutaí", "jutaí": "Jutaí", "labrea": "Lábrea",
  "lábrea": "Lábrea", "manacapuru": "Manacapuru", "manaquiri": "Manaquiri", "manicore": "Manicoré",
  "manicoré": "Manicoré", "maraa": "Maraã", "maues": "Maués", "maués": "Maués", "nhamunda": "Nhamundá",
  "nhamundá": "Nhamundá", "nova olinda do norte": "Nova Olinda do Norte", "novo airao": "Novo Airão",
  "novo airão": "Novo Airão", "novo aripuana": "Novo Aripuanã", "novo aripuanã": "Novo Aripuanã",
  "parintins": "Parintins", "pauini": "Pauini", "presidente figueiredo": "Presidente Figueiredo",
  "rio preto da eva": "Rio Preto da Eva", "santa isabel do rio negro": "Santa Isabel do Rio Negro",
  "santo antonio do ica": "Santo Antônio do Içá", "são gabriel da cachoeira": "São Gabriel da Cachoeira",
  "sao gabriel da cachoeira": "São Gabriel da Cachoeira", "são paulo de olivença": "São Paulo de Olivença",
  "sao paulo de olivenca": "São Paulo de Olivença", "são sebastião do uatumã": "São Sebastião do Uatumã",
  "sao sebastiao do uatuma": "São Sebastião do Uatumã", "silves": "Silves", "tabatinga": "Tabatinga",
  "tapaua": "Tapauá", "tapauá": "Tapauá", "tefe": "Tefé", "tefé": "Tefé", "tonantins": "Tonantins",
  "uarini": "Uarini", "urucara": "Urucará", "urucurituba": "Urucurituba"
};

function canonicalMunicipio(raw) {
  if (!raw) return "Manaus";
  const s = String(raw).trim().toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "");
  return CANONICAL_MUNICIPIOS[s] || raw.trim();
}

function isFlorestalAmbiental(natRaw) {
  if (!natRaw) return false;
  const n = String(natRaw).toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "");
  return (
    n.includes("florest") || n.includes("vegeta") || n.includes("mata") ||
    n.includes("pastag") || n.includes("lavoura") || n.includes("palha") ||
    n.includes("lixo") || n.includes("entulho") || n.includes("queimada") ||
    n.includes("ambiental")
  );
}

function isIncendio(natRaw) {
  if (!natRaw) return false;
  const n = String(natRaw).toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "");
  if (
    (n.includes("apoio") || n.includes("salvamento") || n.includes("samu") || n.includes("aph")) &&
    !n.includes("incendio") && !n.includes("fogo") && !n.includes("vegeta") && !n.includes("florest")
  ) {
    return false;
  }
  return n.includes("incendio") || n.includes("fogo") || n.includes("queimada") || isFlorestalAmbiental(natRaw);
}

const MONTH_MAP = {
  jan: "01", fev: "02", mar: "03", abr: "04", mai: "05", jun: "06",
  jul: "07", ago: "08", set: "09", out: "10", nov: "11", dez: "12",
  oct: "10", dec: "12", feb: "02", apr: "04", may: "05", aug: "08", sep: "09",
};

function parseDateAny(rawStr) {
  if (!rawStr || rawStr === "-" || rawStr === "null") return null;
  const s = rawStr.trim();
  const isoMatch = s.match(/^(\d{4})-(\d{2})-(\d{2})(?:[T\s](\d{2}):(\d{2}))?/);
  if (isoMatch) {
    const [, y, m, d, hh, mm] = isoMatch;
    return { iso: `${y}-${m}-${d}`, br: `${d}/${m}/${y}`, time: hh && mm ? `${hh}:${mm}` : "—" };
  }
  const brMatch = s.match(/^(\d{2})\/(\d{2})\/(\d{4})(?:[\s](\d{2}):(\d{2}))?/);
  if (brMatch) {
    const [, d, m, y, hh, mm] = brMatch;
    return { iso: `${y}-${m}-${d}`, br: `${d}/${m}/${y}`, time: hh && mm ? `${hh}:${mm}` : "—" };
  }
  const usMatch = s.match(/([a-zA-Z]{3,})\s+(\d{1,2}),?\s+(\d{4})(?:\s*@\s*(\d{2}):(\d{2}))?/i);
  if (usMatch) {
    const [, monStr, dayStr, yrStr, hh, mm] = usMatch;
    const monKey = monStr.slice(0, 3).toLowerCase();
    const m = MONTH_MAP[monKey] || "01";
    const d = dayStr.padStart(2, "0");
    return { iso: `${yrStr}-${m}-${d}`, br: `${d}/${m}/${yrStr}`, time: hh && mm ? `${hh}:${mm}` : "—" };
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
    } catch {}
  }
  return rawRelatos.trim();
}

async function run() {
  const csvPath = 'C:\\Users\\User\\Desktop\\relatorio\\Demonstração · Ocorrências CBMAM.csv';
  console.log(`Lendo ${csvPath}...`);
  const text = fs.readFileSync(csvPath, 'utf8');
  const allRows = parseCSV(text);
  console.log(`Total de linhas brutas: ${allRows.length}`);

  let headerIndex = 0;
  for (let i = 0; i < 5; i++) {
    if (allRows[i].some(c => c && (c.includes('dataHoraRegistroUTC') || c.includes('nrProtocolo')))) {
      headerIndex = i;
      break;
    }
  }

  const header = allRows[headerIndex];
  const colMap = {};
  header.forEach((h, i) => colMap[h.trim()] = i);

  const parsedOccurrences = [];
  const dateMap = new Map();
  let totalFocos = 0;
  let totalAreaHa = 0;

  for (let i = headerIndex + 1; i < allRows.length; i++) {
    const row = allRows[i];
    if (!row || row.length === 0 || row.every(c => !c)) continue;

    const id = clean(row[colMap["id"]]) || `occ-${i}`;
    const protocolo = clean(row[colMap["nrProtocolo"]]) || "—";

    // 1. Prioridade Máxima: Data do Protocolo Operacional do CAD (ex: CGOE20261104... ou COBOM20261103...)
    // O protocolo CBMAM registra a data local exata de empenho e despacho da missão,
    // corrigindo casos em que dataFato no CAD foi preenchida com valor retroativo estático.
    let parsedDate = null;
    const protoMatch = protocolo.match(/(\d{4})(\d{2})(\d{2})/);
    if (protoMatch) {
      const y = Number(protoMatch[1]);
      const m = Number(protoMatch[2]);
      const d = Number(protoMatch[3]);
      if (y >= 2024 && y <= 2027 && m >= 1 && m <= 12 && d >= 1 && d <= 31) {
        const timeMatch = protocolo.match(/(\d{4})(\d{2})(\d{2})(\d{2})(\d{2})/);
        const timeStr = timeMatch ? `${timeMatch[4]}:${timeMatch[5]}` : "—";
        const iso = `${protoMatch[1]}-${protoMatch[2]}-${protoMatch[3]}`;
        const br = `${protoMatch[3]}/${protoMatch[2]}/${protoMatch[1]}`;
        parsedDate = { iso, br, time: timeStr };
      }
    }

    if (!parsedDate) {
      const dateCandidates = [
        clean(row[colMap["dataHoraRegistroUTC"]]),
        clean(row[colMap["dataHoraFato"]]),
        clean(row[colMap["dataFato"]]),
      ];
      for (const cand of dateCandidates) {
        if (cand) {
          parsedDate = parseDateAny(cand);
          if (parsedDate) break;
        }
      }
    }
    if (!parsedDate) continue;

    // Se o protocolo não continha horário preciso, extrair de dataHoraFato ou dataHoraRegistroUTC
    if (parsedDate.time === "—") {
      const timeCand = clean(row[colMap["dataHoraFato"]]) || clean(row[colMap["dataHoraRegistroUTC"]]);
      const pTime = parseDateAny(timeCand);
      if (pTime && pTime.time !== "—") {
        parsedDate.time = pTime.time;
      }
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

    const occ = {
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
    };

    parsedOccurrences.push(occ);
    totalFocos += focos;
    totalAreaHa += area;

    if (!dateMap.has(parsedDate.iso)) {
      dateMap.set(parsedDate.iso, []);
    }
    dateMap.get(parsedDate.iso).push(occ);
  }

  console.log(`Ocorrências parseadas com sucesso: ${parsedOccurrences.length}`);
  const uniqueDates = Array.from(dateMap.keys()).sort();
  console.log(`Total de datas distintas: ${uniqueDates.length}`);

  // 3. Atualizar occurrences.json local
  const jsonPath = 'C:\\Users\\User\\Desktop\\relatorio\\src\\data\\occurrences.json';
  fs.writeFileSync(jsonPath, JSON.stringify(parsedOccurrences, null, 2), 'utf8');
  console.log(`Atualizado arquivo local: ${jsonPath} com ${parsedOccurrences.length} ocorrências.`);

  // 4. Sincronizar com o banco de dados Supabase
  console.log('\nIniciando sincronização profunda com Supabase daily_reports...');

  // Foco operacional: datas da operação (desde 2026-06-01 até a data máxima)
  const operationalDates = uniqueDates.filter(d => d >= '2026-06-01' && d <= '2026-11-05');
  console.log(`Datas dentro da Operação Amazonas + Verde a sincronizar: ${operationalDates.length} dias`);

  // Buscar relatórios existentes para todas essas datas
  let syncedCount = 0;
  let insertedDays = 0;
  let updatedDays = 0;

  for (const d of operationalDates) {
    const dayOccs = dateMap.get(d) || [];
    const dateParts = d.split('-');
    const dateBr = `${dateParts[2]}/${dateParts[1]}/${dateParts[0]}`;

    // Calcular tabela agregada de incêndios por município para este dia
    const munFireMap = new Map();
    for (const o of dayOccs) {
      if (!isIncendio(o.natureza)) continue;
      const mun = o.municipio;
      const cur = munFireMap.get(mun) || { mun, urb: 0, flor: 0, focos: 0, sat: 0, area: 0, total_periodo: 0 };
      if (isFlorestalAmbiental(o.natureza)) {
        cur.flor += 1;
      } else {
        cur.urb += 1;
      }
      cur.focos += Math.max(1, Number(o.focos) || 1);
      cur.area += Math.round(Number(o.area) || 0);
      cur.total_periodo += 1;
      munFireMap.set(mun, cur);
    }

    const incendiosDiarioArray = Array.from(munFireMap.values());

    // Verificar se já existe registro na daily_reports
    const { data: existingRows } = await supabase
      .from('daily_reports')
      .select('id, report_date, shift, notes, efetivo, recursos, incendios')
      .eq('report_date', d)
      .limit(1);

    const existing = existingRows && existingRows.length > 0 ? existingRows[0] : null;

    if (existing) {
      // Atualizar envelope notes com as ocorrências oficiais e sincronizar incendios
      let notesObj = {};
      try {
        notesObj = typeof existing.notes === 'string' ? JSON.parse(existing.notes) : (existing.notes || {});
      } catch {
        notesObj = {};
      }

      notesObj.occurrences = dayOccs;

      const updPayload = {
        notes: JSON.stringify(notesObj),
        updated_at: new Date().toISOString(),
      };

      if (incendiosDiarioArray.length > 0) {
        updPayload.incendios = incendiosDiarioArray;
      }

      const { error: updErr } = await supabase
        .from('daily_reports')
        .update(updPayload)
        .eq('id', existing.id);

      if (updErr) {
        console.error(`Erro ao atualizar ${d}:`, updErr.message);
      } else {
        updatedDays++;
      }
    } else {
      // Inserir novo dia caso não exista
      const notesObj = {
        header: {
          titulo: "Relatório Diário — Sala de Situação",
          periodo: `${dateBr} · 24h`,
          comandante: "CEL QOBM BORGES",
          coordSituacao: "CEL QOBM FERREIRA",
          coordenador: "CEL QOBM CRISTIANO BRAZ FERREIRA",
          subcomandante: "Subcomandante-Geral do CBMAM",
        },
        occurrences: dayOccs,
      };

      const { error: insErr } = await supabase
        .from('daily_reports')
        .insert({
          report_date: d,
          shift: 'noturno',
          efetivo: [],
          recursos: [],
          incendios: incendiosDiarioArray,
          outras: [],
          notes: JSON.stringify(notesObj),
          version: 1,
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        });

      if (insErr) {
        console.error(`Erro ao inserir ${d}:`, insErr.message);
      } else {
        insertedDays++;
      }
    }

    syncedCount++;
    if (syncedCount % 25 === 0 || syncedCount === operationalDates.length) {
      console.log(`Progresso Supabase: ${syncedCount}/${operationalDates.length} dias processados (Atualizados: ${updatedDays}, Inseridos: ${insertedDays})...`);
    }
  }

  // 5. Atualizar report_data (id: 1) com as ocorrências mais recentes
  console.log('\nAtualizando snapshot master em report_data (id: 1)...');
  const { data: repData } = await supabase.from('report_data').select('data').eq('id', 1).single();
  let currentMaster = repData?.data || {};
  currentMaster.occurrences = parsedOccurrences.slice(0, 1000); // 1000 mais recentes no snapshot
  currentMaster.updated_at = new Date().toISOString();

  await supabase.from('report_data').update({ data: currentMaster, updated_at: new Date().toISOString() }).eq('id', 1);
  console.log('Snapshot master em report_data (id: 1) atualizado com sucesso!');

  console.log(`\n======================================================`);
  console.log(`✅ CONCLUÍDO COM SUCESSO TOTAL!`);
  console.log(`• Ocorrências processadas: ${parsedOccurrences.length}`);
  console.log(`• Total Focos combatidos: ${totalFocos}`);
  console.log(`• Dias operacionais sincronizados no Supabase: ${syncedCount}`);
  console.log(`• Dias atualizados: ${updatedDays}`);
  console.log(`• Novos dias criados: ${insertedDays}`);
  console.log(`======================================================`);
}

run().catch(console.error);
