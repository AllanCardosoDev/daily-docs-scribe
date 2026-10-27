/**
 * Importador inteligente de planilhas de ocorrências CBMAM.
 * Server-only.
 *
 * Suporta arquivos CSV e XLSX/XLS (CAD-Ocorrências ou diários).
 * Regra obrigatória: SOMENTE INCÊNDIOS.
 * Deduplicação estrita: nunca duplica ocorrências existentes.
 */
import * as XLSX from "xlsx";
import { canonicalMunicipio } from "./municipio-order";
import {
  addOccurrences,
  type StoredOccurrence,
} from "./occurrences-store.server";

export interface ImportSpreadsheetResult {
  success: boolean;
  totalRows: number;
  fireRows: number;
  insertedCount: number;
  duplicatesSkipped: number;
  datesAffected: string[];
  latestDate?: string;
  shift?: string;
  isDailyReport?: boolean;
  dailyReport?: {
    reportDate: string;
    shift: string;
    counts: {
      efetivo: number;
      recursos: number;
      incendios: number;
      outras: number;
    };
  };
  message: string;
  sampleImported?: {
    municipio: string;
    natureza: string;
    data: string;
    endereco: string;
  }[];
}

// State-machine CSV parser para arquivos grandes com quebras de linha entre aspas
function parseCSV(text: string): string[][] {
  const rows: string[][] = [];
  let currentRow: string[] = [];
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

const MONTH_MAP: Record<string, string> = {
  jan: "01", fev: "02", mar: "03", abr: "04", mai: "05", jun: "06",
  jul: "07", ago: "08", set: "09", out: "10", nov: "11", dez: "12",
  oct: "10", dec: "12", feb: "02", apr: "04", may: "05", aug: "08", sep: "09",
};

function parseDateAny(rawStr: string): { iso: string; br: string; time: string } | null {
  if (!rawStr || rawStr === "-" || rawStr === "null") return null;
  const s = rawStr.trim();

  // Ex: "2026-10-25" ou "2026-10-25 14:30:00" ou "2026-10-25T14:30:00Z"
  const isoMatch = s.match(/^(\d{4})-(\d{2})-(\d{2})(?:[T\s](\d{2}):(\d{2}))?/);
  if (isoMatch) {
    const [, y, m, d, hh, mm] = isoMatch;
    return {
      iso: `${y}-${m}-${d}`,
      br: `${d}/${m}/${y}`,
      time: hh && mm ? `${hh}:${mm}` : "—",
    };
  }

  // Ex: "25/10/2026" ou "25/10/2026 14:30"
  const brMatch = s.match(/^(\d{2})\/(\d{2})\/(\d{4})(?:[\s](\d{2}):(\d{2}))?/);
  if (brMatch) {
    const [, d, m, y, hh, mm] = brMatch;
    return {
      iso: `${y}-${m}-${d}`,
      br: `${d}/${m}/${y}`,
      time: hh && mm ? `${hh}:${mm}` : "—",
    };
  }

  // Ex: "Oct 25, 2026 @ 19:56:00.000" ou "25 de Outubro de 2026"
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

function isStrictFireNature(natureza: string, tipo: string, narrativa: string): boolean {
  const combined = `${natureza} ${tipo} ${narrativa}`.toLowerCase();

  // Testes de sistema e registros inativos devem ser sempre descartados
  if (
    combined.includes("teste de sistema") ||
    combined.includes("treinamento interno") ||
    combined.includes("simulado de mesa") ||
    combined.includes("registro cancelado") ||
    combined.includes("sem alteracao") ||
    combined.includes("trote")
  ) {
    return false;
  }

  // Se for explicitamente salvamento/aph/animal sem incêndio, descartar
  if (
    (combined.includes("salvamento") || combined.includes("aph") || combined.includes("resgate de animal") || combined.includes("acidente de trânsito")) &&
    !combined.includes("incêndio") &&
    !combined.includes("fogo") &&
    !combined.includes("queimada")
  ) {
    return false;
  }

  // Somente naturezas que contenham termos relacionados a incêndios/queimadas
  const firePatterns = [
    "incêndio",
    "incendio",
    "fogo",
    "queimada",
    "vegetação",
    "vegetacao",
    "florestal",
    "lixo",
    "entulho",
    "residência",
    "residencia",
    "comercial",
    "edificação",
    "edificacao",
    "veículo",
    "veiculo",
    "embarcação",
    "embarcacao",
    "indústria",
    "industria",
    "pastagem",
    "mata",
    "palha",
  ];

  return firePatterns.some((pattern) => combined.includes(pattern));
}

function cleanStr(val: unknown): string {
  if (val == null) return "";
  const s = String(val).trim();
  return s === "-" || s === "null" || s === "undefined" ? "" : s;
}

function cleanNum(val: unknown): number {
  if (val == null) return 0;
  if (typeof val === "number") return isNaN(val) ? 0 : val;
  const s = String(val).replace(/[^0-9.-]/g, "").trim();
  const n = parseFloat(s);
  return isNaN(n) ? 0 : n;
}

export async function processSpreadsheetBuffer(
  buffer: Buffer,
  fileName: string,
  supabaseClient?: any,
): Promise<ImportSpreadsheetResult> {
  const ext = fileName.toLowerCase().split(".").pop() || "";
  let rawRows: any[][] = [];

  if (ext === "csv" || ext === "txt") {
    const text = buffer.toString("utf-8");
    rawRows = parseCSV(text);
  } else {
    // XLSX ou XLS
    const workbook = XLSX.read(buffer, { type: "buffer" });
    const sheetName =
      workbook.SheetNames.find((n) =>
        /^relatorio/i.test(n.normalize("NFD").replace(/\p{Diacritic}/gu, "")),
      ) ?? workbook.SheetNames[0];
    if (!sheetName) {
      return {
        success: false,
        totalRows: 0,
        fireRows: 0,
        insertedCount: 0,
        duplicatesSkipped: 0,
        datesAffected: [],
        message: "A planilha fornecida está vazia ou não contém abas válidas.",
      };
    }
    const worksheet = workbook.Sheets[sheetName];
    rawRows = XLSX.utils.sheet_to_json(worksheet, { header: 1, raw: true, defval: null }) as any[][];
  }

  if (rawRows.length < 2) {
    return {
      success: false,
      totalRows: rawRows.length,
      fireRows: 0,
      insertedCount: 0,
      duplicatesSkipped: 0,
      datesAffected: [],
      message: "O arquivo possui menos de 2 linhas e não contém dados suficientes.",
    };
  }

  // Detectar se é uma planilha de Relatório Diário Oficial (com seções Efetivo, Incêndios, Recursos, etc.)
  const isDailyReport = rawRows.some((r) =>
    (r ?? []).some((c) => {
      const str = String(c ?? "").normalize("NFD").replace(/\p{Diacritic}/gu, "").toUpperCase();
      return (
        str.includes("SALA DE SITUACAO") ||
        (str.includes("EFETIVO") && r.some((x: any) => String(x ?? "").toUpperCase().includes("MUNICIPIO"))) ||
        str.includes("AMAZONAS + VERDE") ||
        (str.includes("RELATORIO DIARIO") && !str.includes("CAD"))
      );
    }),
  );

  if (isDailyReport) {
    try {
      const { parseDailyReportSheet, parseFileName } = await import("./drive-import.server");
      const { manausFirst, harmonizeMunicipalitySections } = await import("./municipio-order");

      let fileInfo = parseFileName(fileName);
      let reportDate = fileInfo.reportDate;
      let shift = fileInfo.shift;

      if (!reportDate) {
        for (let i = 0; i < Math.min(25, rawRows.length); i++) {
          const rowText = (rawRows[i] ?? []).map((x) => String(x ?? "")).join(" ");
          const dMatch = rowText.match(/(\d{2})[.\-/](\d{2})[.\-/](\d{4})/);
          if (dMatch) {
            reportDate = `${dMatch[3]}-${dMatch[2]}-${dMatch[1]}`;
            if (rowText.toLowerCase().includes("parcial")) shift = "parcial";
            break;
          }
        }
      }

      if (reportDate) {
        const parsed = parseDailyReportSheet(rawRows);
        const harmonized = harmonizeMunicipalitySections(
          parsed.efetivo as any,
          parsed.recursos as any,
          parsed.incendios as any,
          (mun) => ({ mun, ord: 0, cbmam: 0, seg: 0, brig: 0 }),
          (mun) => ({ mun, viaturas: 0, aeronaves: 0, embarcacoes: 0 }),
          (mun) => ({ mun, urb: 0, flor: 0, focos: 0, total_periodo: 0 }),
        );

        const notesJson = JSON.stringify({
          header: parsed.header,
          incendios_acumulado: manausFirst(parsed.incendios_acumulado),
        });

        const payload: Record<string, any> = {
          report_date: reportDate,
          shift,
          efetivo: manausFirst(harmonized.efetivo) as any,
          recursos: manausFirst(harmonized.recursos) as any,
          incendios: manausFirst(harmonized.incendios) as any,
          outras: manausFirst(parsed.outras) as any,
          notes: notesJson,
        };

        const db = supabaseClient;
        if (db) {
          const { data: existing } = await db
            .from("daily_reports")
            .select("id")
            .eq("report_date", reportDate)
            .eq("shift", shift)
            .maybeSingle();

          if (existing) {
            await db.from("daily_reports").update(payload).eq("id", existing.id);
          } else {
            await db.from("daily_reports").insert(payload);
          }
        }

        const dateBr = reportDate.split("-").reverse().join("/");
        return {
          success: true,
          isDailyReport: true,
          totalRows: rawRows.length,
          fireRows: harmonized.incendios.length,
          insertedCount: harmonized.incendios.length,
          duplicatesSkipped: 0,
          datesAffected: [reportDate],
          latestDate: reportDate,
          shift,
          dailyReport: {
            reportDate,
            shift,
            counts: {
              efetivo: harmonized.efetivo.length,
              recursos: harmonized.recursos.length,
              incendios: harmonized.incendios.length,
              outras: parsed.outras.length,
            },
          },
          message: `Relatório Diário Oficial (${shift === "parcial" ? "Parcial" : "24 Horas"}) de ${dateBr} importado e salvo com sucesso no banco de dados! (${harmonized.efetivo.length} municípios em Efetivo, ${harmonized.incendios.length} em Incêndios, ${harmonized.recursos.length} em Recursos).`,
          sampleImported: harmonized.incendios.slice(0, 3).map((r) => ({
            municipio: r.mun,
            natureza: `Incêndios: ${r.urb} urbano(s) · ${r.flor} florestal(is) · ${r.focos} foco(s)`,
            data: dateBr,
            endereco: r.mun,
          })),
        };
      }
    } catch (reportErr) {
      console.warn("[occurrences-import] Processamento como Relatório Diário retornou:", reportErr);
    }
  }

  // Mapear cabeçalho
  const header = rawRows[0].map((c) => String(c ?? "").trim().toLowerCase());
  const colIndex = (keys: string[]) => {
    return header.findIndex((h) => keys.some((k) => h.includes(k.toLowerCase())));
  };

  const idxId = colIndex(["_id", "id", "código", "codigo"]);
  const idxProtocolo = colIndex(["protocolo", "número", "numero", "nº"]);
  const idxDataFato = colIndex(["data fato", "data do fato", "datafato"]);
  const idxDataHoraFato = colIndex(["data/hora fato", "data/hora do fato", "data hora fato"]);
  const idxDataReg = colIndex(["data registro", "data do registro", "data/hora registro"]);
  const idxDataGeneric = colIndex(["data", "dia"]);
  const idxHora = colIndex(["hora", "horário", "horario"]);
  const idxMunicipio = colIndex(["município", "municipio", "cidade"]);
  const idxBairro = colIndex(["bairro"]);
  const idxEndereco = colIndex(["endereço", "endereco", "logradouro", "rua"]);
  const idxNatureza = colIndex(["natureza", "evento", "ocorrência"]);
  const idxTipo = colIndex(["tipo"]);
  const idxFocos = colIndex(["foco", "focos"]);
  const idxArea = colIndex(["área", "area"]);
  const idxAgua = colIndex(["água", "agua", "litros"]);
  const idxLat = colIndex(["latitude", "lat"]);
  const idxLon = colIndex(["longitude", "lon", "lng"]);
  const idxCoords = colIndex(["coordenadas", "localização", "coordenada"]);
  const idxUnidade = colIndex(["unidade", "batalhão", "batalhao", "cia"]);
  const idxEquipes = colIndex(["equipe", "equipes", "efetivo", "guarnição", "guarnicao"]);
  const idxNarrativa = colIndex(["narrativa", "histórico", "historico", "relato", "descrição", "descricao"]);

  const totalRows = rawRows.length - 1;
  const fireOccurrences: StoredOccurrence[] = [];

  for (let i = 1; i < rawRows.length; i++) {
    const row = rawRows[i];
    if (!row || row.length === 0 || row.every((c) => !c)) continue;

    const rawNatureza = cleanStr(idxNatureza >= 0 ? row[idxNatureza] : "");
    const rawTipo = cleanStr(idxTipo >= 0 ? row[idxTipo] : "");
    const rawNarrativa = cleanStr(idxNarrativa >= 0 ? row[idxNarrativa] : "");

    // Filtro obrigatório: SOMENTE INCÊNDIOS
    if (!isStrictFireNature(rawNatureza, rawTipo, rawNarrativa)) {
      continue;
    }

    // Identificação de Data
    const rawDateCandidates = [
      idxDataHoraFato >= 0 ? row[idxDataHoraFato] : "",
      idxDataFato >= 0 ? row[idxDataFato] : "",
      idxDataReg >= 0 ? row[idxDataReg] : "",
      idxDataGeneric >= 0 ? row[idxDataGeneric] : "",
    ];

    let parsedDate: { iso: string; br: string; time: string } | null = null;
    for (const cand of rawDateCandidates) {
      if (cand && String(cand).trim() !== "-") {
        parsedDate = parseDateAny(String(cand));
        if (parsedDate) break;
      }
    }

    if (!parsedDate) continue;

    let timeStr = parsedDate.time;
    if ((!timeStr || timeStr === "—") && idxHora >= 0) {
      const hCand = cleanStr(row[idxHora]);
      if (hCand && hCand.includes(":")) timeStr = hCand.slice(0, 5);
    }

    const munRaw = cleanStr(idxMunicipio >= 0 ? row[idxMunicipio] : "Manaus");
    const municipio = canonicalMunicipio(munRaw || "Manaus");

    const bairro = cleanStr(idxBairro >= 0 ? row[idxBairro] : "");
    const endereco = cleanStr(idxEndereco >= 0 ? row[idxEndereco] : (bairro ? `${bairro}, ${municipio}` : municipio));

    const focos = Math.max(1, cleanNum(idxFocos >= 0 ? row[idxFocos] : 1));
    const area = cleanNum(idxArea >= 0 ? row[idxArea] : 0);
    const agua = cleanNum(idxAgua >= 0 ? row[idxAgua] : 0);

    let coordenadas = "";
    if (idxCoords >= 0 && row[idxCoords]) {
      coordenadas = cleanStr(row[idxCoords]);
    } else if (idxLat >= 0 && idxLon >= 0 && row[idxLat] && row[idxLon]) {
      coordenadas = `${cleanStr(row[idxLat])}, ${cleanStr(row[idxLon])}`;
    }

    const protocolo = cleanStr(idxProtocolo >= 0 ? row[idxProtocolo] : "");
    const id = cleanStr(idxId >= 0 ? row[idxId] : (protocolo ? `CAD-${protocolo}` : `occ-${Date.now()}-${i}`));

    const fullNatureza = rawNatureza || rawTipo || "Incêndio em Vegetação";

    fireOccurrences.push({
      id,
      protocolo: protocolo || "—",
      data: parsedDate.iso,
      dataBr: parsedDate.br,
      horario: timeStr || "—",
      municipio,
      bairro: bairro || undefined,
      endereco: endereco || "—",
      natureza: fullNatureza,
      focos,
      area,
      agua,
      coordenadas: coordenadas || undefined,
      unidade: cleanStr(idxUnidade >= 0 ? row[idxUnidade] : "") || undefined,
      equipes: cleanStr(idxEquipes >= 0 ? row[idxEquipes] : "") || undefined,
      narrativa: rawNarrativa || undefined,
    });
  }

  // Inserção no repositório com não-duplicação
  const addResult = addOccurrences(fireOccurrences);

  // Se houver cliente Supabase configurado, grava também na tabela de ocorrências
  if (supabaseClient && addResult.insertedCount > 0) {
    try {
      const recordsToInsert = fireOccurrences.map((occ) => ({
        id: occ.id,
        protocolo: occ.protocolo,
        data_fato: occ.data,
        horario: occ.horario,
        municipio: occ.municipio,
        bairro: occ.bairro,
        endereco: occ.endereco,
        natureza: occ.natureza,
        focos: occ.focos,
        area: occ.area,
        agua: occ.agua,
        coordenadas: occ.coordenadas,
        equipes: occ.equipes,
        narrativa: occ.narrativa,
      }));

      // Em lotes de 100 para segurança de payload
      for (let i = 0; i < recordsToInsert.length; i += 100) {
        const batch = recordsToInsert.slice(i, i + 100);
        await supabaseClient
          .from("occurrences")
          .upsert(batch, { onConflict: "id", ignoreDuplicates: true });
      }
    } catch (err) {
      console.warn("[occurrences-import] Aviso: inserção no Supabase retornou:", err);
    }
  }

  const latestDate =
    addResult.datesAffected.length > 0
      ? addResult.datesAffected[addResult.datesAffected.length - 1]
      : undefined;

  const sampleImported = fireOccurrences.slice(0, 3).map((o) => ({
    municipio: o.municipio,
    natureza: o.natureza,
    data: o.dataBr,
    endereco: o.endereco,
  }));

  return {
    success: true,
    totalRows,
    fireRows: fireOccurrences.length,
    insertedCount: addResult.insertedCount,
    duplicatesSkipped: addResult.duplicatesSkipped,
    datesAffected: addResult.datesAffected,
    latestDate,
    sampleImported,
    message:
      addResult.insertedCount > 0
        ? `Importação concluída com sucesso! Foram adicionadas ${addResult.insertedCount} novas ocorrências de incêndio (${addResult.duplicatesSkipped} já existentes foram ignoradas).`
        : `Nenhuma nova ocorrência necessária: todas as ${fireOccurrences.length} ocorrências de incêndio da planilha já constam no banco de dados.`,
  };
}
