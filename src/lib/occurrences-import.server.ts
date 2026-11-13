/**
 * Importador inteligente de planilhas de ocorrências CBMAM.
 * Server-only.
 *
 * Suporta arquivos CSV e XLSX/XLS (CAD-Ocorrências ou Relatórios Diários Oficiais).
 * Regra obrigatória: SOMENTE INCÊNDIOS (classificação institucional CBMAM).
 * Deduplicação estrita: nunca duplica ocorrências existentes.
 * Persistência garantida: grava e sincroniza diretamente no Banco de Dados Supabase (daily_reports.notes.occurrences e daily_reports.incendios).
 */
import * as XLSX from "xlsx";
import { canonicalMunicipio, isNonMunicipioTroop, harmonizeMunicipalitySections, manausFirst } from "./municipio-order";
import { isIncendio, isFlorestalAmbiental } from "./fire-classification";
import {
  addOccurrences,
  makeOccurrenceKey,
  type StoredOccurrence,
} from "./occurrences-store.server";

export interface ImportSpreadsheetResult {
  success: boolean;
  totalRows: number;
  fireRows: number;
  insertedCount: number;
  updatedCount?: number;
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
export function parseCSV(text: string): string[][] {
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

export function parseDateAny(rawStr: string): { iso: string; br: string; time: string } | null {
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

  // Ex: "Oct 25, 2026 @ 19:56:00.000" ou "Nov 12, 2026 @ 17:05:00.000" ou "25 de Outubro de 2026"
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

export function isStrictFireNature(natureza: string, tipo: string, narrativa: string): boolean {
  if (isIncendio(natureza)) return true;
  if (isIncendio(tipo)) return true;

  const combined = `${natureza} ${tipo} ${narrativa}`.toLowerCase();
  // Se contiver menção explícita de teste, trote, simulado ou ação preventiva, descarta
  if (
    combined.includes("teste de sistema") ||
    combined.includes("treinamento interno") ||
    combined.includes("simulado de mesa") ||
    combined.includes("registro cancelado") ||
    combined.includes("sem alteracao") ||
    combined.includes("trote") ||
    combined.includes("acao preventiva") ||
    combined.includes("acoes de prevencao") ||
    combined.includes("orientacao preventiva") ||
    combined.includes("vistoria") ||
    combined.includes("monitoramento")
  ) {
    return false;
  }

  return false;
}

function cleanStr(val: unknown): string {
  if (val == null) return "";
  const s = String(val).trim();
  return s === "-" || s === "null" || s === "undefined" ? "" : s;
}

function cleanNum(val: unknown): number {
  if (val == null) return 0;
  if (typeof val === "number") return isNaN(val) ? 0 : Math.abs(val);
  const s = String(val).trim();
  if (!s || s === "-" || s === "null" || s === "undefined") return 0;
  // Se contém caracteres alfabéticos (ex: UUID, hash ou identificador), NUNCA é um número!
  if (/[a-zA-Z]/.test(s)) return 0;
  const cleaned = s.replace(/[^0-9.,-]/g, "").replace(",", ".");
  const n = parseFloat(cleaned);
  return isNaN(n) ? 0 : Math.abs(n);
}

/**
 * Salva e sincroniza ocorrências processadas no banco de dados Supabase e no repositório de memória.
 */
export async function saveParsedOccurrencesToDb(
  fireOccurrences: StoredOccurrence[],
  supabaseClient?: any,
): Promise<ImportSpreadsheetResult> {
  const allFileDates = Array.from(new Set(fireOccurrences.map((f) => f.data).filter(Boolean))).sort();
  const latestDate = allFileDates.length > 0 ? allFileDates[allFileDates.length - 1] : undefined;

  // Inserção no repositório em memória
  const addResult = addOccurrences(fireOccurrences);

  // Sincronização direta e persistente na tabela daily_reports no Supabase
  if (supabaseClient && allFileDates.length > 0) {
    try {
      const { fetchOperationalDonor } = await import("./sheets-fallback.server");

      for (const d of allFileDates) {
        const dayFileOccs = fireOccurrences.filter((occ) => occ.data === d);
        if (dayFileOccs.length === 0) continue;

        // Busca o relatório existente no Supabase para a data
        const { data: existingReport, error: fetchErr } = await supabaseClient
          .from("daily_reports")
          .select("id, shift, efetivo, recursos, incendios, outras, notes")
          .eq("report_date", d)
          .eq("shift", "noturno")
          .maybeSingle();

        if (fetchErr) {
          console.warn(`[occurrences-import] Erro ao consultar daily_reports para ${d}:`, fetchErr.message);
        }

        // Recupera ocorrências que já constavam no notes
        let existingOccs: StoredOccurrence[] = [];
        let prevNotesObj: Record<string, any> = {};
        if (existingReport?.notes) {
          try {
            prevNotesObj = typeof existingReport.notes === "string" ? JSON.parse(existingReport.notes) : existingReport.notes;
            if (Array.isArray(prevNotesObj.occurrences)) {
              existingOccs = prevNotesObj.occurrences;
            }
          } catch {}
        }

        // Combina as ocorrências sem duplicidade (priorizando dados mais recentes/completos)
        const occMap = new Map<string, StoredOccurrence>();
        for (const occ of existingOccs) {
          occMap.set(makeOccurrenceKey(occ), occ);
        }
        for (const occ of dayFileOccs) {
          occMap.set(makeOccurrenceKey(occ), occ);
        }
        const mergedDayOccs = Array.from(occMap.values());

        // Agrupa por município e totaliza ocorrências urbanas, florestais e focos
        const muniFires = new Map<string, { urb: number; flor: number; focos: number }>();
        for (const occ of mergedDayOccs) {
          const mun = canonicalMunicipio(occ.municipio);
          const cur = muniFires.get(mun) || { urb: 0, flor: 0, focos: 0 };
          if (isFlorestalAmbiental(occ.natureza)) {
            cur.flor += 1;
          } else {
            cur.urb += 1;
          }
          cur.focos += Math.max(1, occ.focos || 1);
          muniFires.set(mun, cur);
        }

        const targetIncendiosList = Array.from(muniFires.entries()).map(([mun, vals]) => ({
          mun,
          urb: vals.urb,
          flor: vals.flor,
          focos: vals.focos,
          total_periodo: vals.urb + vals.flor,
        }));

        if (existingReport) {
          const incMap = new Map<string, any>();
          for (const r of existingReport.incendios || []) {
            if (r?.mun && !isNonMunicipioTroop(r.mun)) incMap.set(canonicalMunicipio(r.mun), { ...r });
          }
          for (const item of targetIncendiosList) {
            const ex = incMap.get(item.mun);
            if (ex) {
              ex.urb = item.urb;
              ex.flor = item.flor;
              ex.focos = item.focos;
              ex.total_periodo = item.urb + item.flor;
            } else {
              incMap.set(item.mun, item);
            }
          }

          const updatedInc = Array.from(incMap.values());
          const cleanEf = (existingReport.efetivo || []).filter((r: any) => !isNonMunicipioTroop(r?.mun ?? r?.municipio));
          const cleanRec = (existingReport.recursos || []).filter((r: any) => !isNonMunicipioTroop(r?.mun ?? r?.municipio));
          const harmonized = harmonizeMunicipalitySections(
            cleanEf,
            cleanRec,
            updatedInc,
            (mun) => ({ mun, ord: 0, cbmam: 0, seg: 0, brig: 0 }),
            (mun) => ({ mun, viaturas: 0, aeronaves: 0, embarcacoes: 0 }),
            (mun) => ({ mun, urb: 0, flor: 0, focos: 0, total_periodo: 0 }),
          );

          const mergedNotes = {
            ...prevNotesObj,
            occurrences: mergedDayOccs,
          };

          const { error: updErr } = await supabaseClient
            .from("daily_reports")
            .update({
              efetivo: harmonized.efetivo,
              recursos: harmonized.recursos,
              incendios: harmonized.incendios,
              notes: JSON.stringify(mergedNotes),
              updated_at: new Date().toISOString(),
            })
            .eq("id", existingReport.id);

          if (updErr) {
            console.error(`[occurrences-import] Erro ao atualizar daily_reports de ${d}:`, updErr.message);
          }
        } else {
          // Cria novo registro com template de efetivo/recursos
          const donor = await fetchOperationalDonor(supabaseClient, d);
          const harmonized = harmonizeMunicipalitySections(
            (donor?.efetivo || []).filter((r: any) => !isNonMunicipioTroop(r?.mun ?? r?.municipio)),
            (donor?.recursos || []).filter((r: any) => !isNonMunicipioTroop(r?.mun ?? r?.municipio)),
            targetIncendiosList,
            (mun) => ({ mun, ord: 0, cbmam: 0, seg: 0, brig: 0 }),
            (mun) => ({ mun, viaturas: 0, aeronaves: 0, embarcacoes: 0 }),
            (mun) => ({ mun, urb: 0, flor: 0, focos: 0, total_periodo: 0 }),
          );

          const { error: insErr } = await supabaseClient.from("daily_reports").insert({
            report_date: d,
            shift: "noturno",
            efetivo: harmonized.efetivo,
            recursos: harmonized.recursos,
            incendios: harmonized.incendios,
            outras: donor?.outras || [],
            notes: JSON.stringify({ occurrences: mergedDayOccs }),
            version: 1,
          });

          if (insErr) {
            console.error(`[occurrences-import] Erro ao inserir daily_reports de ${d}:`, insErr.message);
          }
        }
      }
    } catch (syncErr) {
      console.error("[occurrences-import] Falha na sincronização com Supabase daily_reports:", syncErr);
    }
  }

  return {
    success: true,
    totalRows: fireOccurrences.length,
    fireRows: fireOccurrences.length,
    insertedCount: addResult.insertedCount,
    updatedCount: addResult.updatedCount,
    duplicatesSkipped: addResult.duplicatesSkipped,
    datesAffected: allFileDates,
    latestDate,
    message: `Planilha de ocorrências processada com sucesso! ${fireOccurrences.length} ocorrência(s) de incêndio verificada(s), sendo ${addResult.insertedCount} nova(s) e ${addResult.updatedCount || 0} atualizada(s). Todas gravadas e sincronizadas no Banco de Dados.`,
    sampleImported: fireOccurrences.slice(0, 5).map((occ) => ({
      municipio: occ.municipio,
      natureza: occ.natureza,
      data: occ.dataBr,
      endereco: occ.endereco,
    })),
  };
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

    // Prioridade 1: Aba com nome exato "RELATORIO" ou "RELATÓRIO"
    let sheetName = workbook.SheetNames.find((n) =>
      /^relat[oó]rio$/i.test(n.normalize("NFD").replace(/\p{Diacritic}/gu, "").trim()),
    );
    // Prioridade 2: Aba que contenha "relatorio" mas NÃO termine com dígito (evita RELATORIO1, RELATORIO2)
    if (!sheetName) {
      sheetName = workbook.SheetNames.find((n) =>
        /^relat[oó]rio[^\d]*$/i.test(n.normalize("NFD").replace(/\p{Diacritic}/gu, "").trim()),
      );
    }
    // Prioridade 3: Qualquer aba que contenha "relatorio"
    if (!sheetName) {
      sheetName = workbook.SheetNames.find((n) =>
        /relat[oó]rio/i.test(n.normalize("NFD").replace(/\p{Diacritic}/gu, "")),
      );
    }
    if (!sheetName) sheetName = workbook.SheetNames[0];

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

  // Identificação robusta de arquivo CAD vs Relatório Diário Oficial
  // 1. Ocorrências CAD têm colunas características nas primeiras 5 linhas
  const headerPreview = (rawRows.slice(0, 5) || [])
    .flatMap((r) =>
      (r || []).map((c) =>
        String(c ?? "")
          .toLowerCase()
          .normalize("NFD")
          .replace(/[\u0300-\u036f]/g, "")
          .replace(/[^a-z0-9]/g, ""),
      ),
    );

  const isCAD = headerPreview.some((h) =>
    [
      "nrprotocolo",
      "protocolo",
      "datahoraregistroutc",
      "naturezainicialdescricao",
      "naturezasfinais",
      "relatosrelato",
      "membrosequipes",
      "uuidocorrenciaprincipal",
      "coordenadas",
    ].includes(h),
  );

  // 2. Relatório Diário Oficial só é detectado nas primeiras 15 linhas e NÃO pode ser CAD
  const topRows = rawRows.slice(0, 15);
  const isDailyReport =
    !isCAD &&
    topRows.some((r) =>
      (r ?? []).some((c) => {
        const str = String(c ?? "").normalize("NFD").replace(/\p{Diacritic}/gu, "").toUpperCase();
        return (
          (str.includes("SALA DE SITUACAO") ||
            str.includes("RELATORIO DIARIO") ||
            str.includes("RELATORIO DE OCORRENCIAS")) &&
          topRows.some((subRow) =>
            subRow.some((subC: any) => {
              const subStr = String(subC ?? "").normalize("NFD").replace(/\p{Diacritic}/gu, "").toUpperCase();
              return subStr.includes("EFETIVO") || subStr.includes("INCENDIOS") || subStr.includes("RECURSOS");
            }),
          )
        );
      }),
    );

  if (isDailyReport) {
    try {
      const { parseDailyReportSheet, parseFileName } = await import("./drive-import.server");

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
            .select("id, notes")
            .eq("report_date", reportDate)
            .eq("shift", shift)
            .maybeSingle();

          if (existing) {
            let mergedNotes = {
              header: parsed.header,
              incendios_acumulado: manausFirst(parsed.incendios_acumulado),
            };
            if (existing.notes) {
              try {
                const prev = typeof existing.notes === "string" ? JSON.parse(existing.notes) : existing.notes;
                if (prev && typeof prev === "object") {
                  mergedNotes = { ...prev, ...mergedNotes };
                }
              } catch {}
            }
            payload.notes = JSON.stringify(mergedNotes);
            const { error: updErr } = await db.from("daily_reports").update(payload).eq("id", existing.id);
            if (updErr) {
              console.error("[occurrences-import] Erro ao atualizar daily_reports oficial:", updErr);
              throw updErr;
            }
          } else {
            const { error: insErr } = await db.from("daily_reports").insert(payload);
            if (insErr) {
              console.error("[occurrences-import] Erro ao inserir daily_reports oficial:", insErr);
              throw insErr;
            }
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

  // Mapear cabeçalho com normalização profunda (ignora maiúsculas, pontuação, acentos e espaços)
  const normKey = (s: unknown) =>
    String(s ?? "")
      .toLowerCase()
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "")
      .replace(/[^a-z0-9]/g, "");

  // Procura a linha de cabeçalho real (se rawRows[0] tiver menos de 3 colunas válidas, testa as próximas linhas)
  let headerRowIndex = 0;
  for (let r = 0; r < Math.min(6, rawRows.length); r++) {
    const validCells = (rawRows[r] || []).filter((c) => String(c ?? "").trim().length > 1);
    if (validCells.length >= 3) {
      headerRowIndex = r;
      break;
    }
  }

  const header = rawRows[headerRowIndex].map(normKey);
  const colIndex = (keys: string[]) => {
    const normalizedKeys = keys.map(normKey);
    // 1. Busca correspondência exata primeiro
    const exact = header.findIndex((h) => normalizedKeys.includes(h));
    if (exact >= 0) return exact;
    // 2. Busca por substring apenas se a chave procurada tiver 4+ caracteres
    return header.findIndex((h) =>
      normalizedKeys.some((k) => k.length >= 4 && h.includes(k)),
    );
  };

  const idxId = colIndex(["id", "uuid", "codigo", "cid", "_id"]);
  const idxProtocolo = colIndex(["nrprotocolo", "protocolo", "numero", "nº"]);
  const idxDataHoraFato = colIndex(["datahorafato", "data/hora fato", "data/hora do fato", "data hora fato", "datahoradofato"]);
  const idxDataFato = colIndex(["datafato", "data fato", "data do fato"]);
  const idxDataFinalizacao = colIndex(["datahorafinalizacaobrt", "datahorafinalizacao", "data finalizacao"]);
  const idxDataReg = colIndex(["datahoraregistroutc", "data registro", "data do registro", "data/hora registro"]);
  const idxDataGeneric = colIndex(["data", "dia"]);
  const idxHora = colIndex(["hora", "horário", "horario"]);
  const idxMunicipio = colIndex(["nomemunicipio", "municipio", "cidade"]);
  const idxBairro = colIndex(["bairro"]);
  const idxEndereco = colIndex(["logradouro", "endereco", "endereço", "rua"]);
  const idxNaturezaFinal = colIndex([
    "naturezafinalizacaoobjectnomenaturezafinal",
    "naturezasfinais",
  ]);
  const idxNaturezaInicial = colIndex([
    "naturezainicialdescricao",
    "natureza",
    "evento",
    "ocorrência",
    "ocorrencia",
  ]);
  const idxTipo = colIndex(["naturezafinalizacaoobjectnomegruponatureza", "tipo"]);
  const idxFocos = colIndex([
    "gruposadicionaisdadosincendioflorestalvegetacaodadosincendioflorestalvegetacaonumerofocoscombatidos",
    "numerofocoscombatidos",
    "focoscombatidos",
    "focos",
    "foco",
    "focosdecalor",
    "quantidadedefocos",
  ]);
  const idxArea = colIndex([
    "gruposadicionaisdadosincendioflorestalvegetacaodadosincendioflorestalvegetacaoareaqueimadacombatidaha",
    "areaqueimadacombatidaha",
    "areaqueimada",
    "areacombatida",
    "areaatingida",
    "areaha",
    "aream2",
    "area",
    "área",
  ]);
  const idxAgua = colIndex(["litrosdeagua", "litrosdeaguaestimados", "litrosagua", "litros", "água", "agua"]);
  const idxLat = colIndex(["latitude", "lat"]);
  const idxLon = colIndex(["longitude", "lon", "lng", "long"]);
  const idxCoords = colIndex(["coordenadas", "coordenada", "localização", "localizacao", "coords", "latlon", "latlong"]);
  const idxUnidade = colIndex(["filtronomeunidadeservico", "unidade", "batalhão", "batalhao", "cia"]);
  const idxRegiao = colIndex(["regiaoatuacaodescricao", "regiao", "região"]);
  const idxEquipes = colIndex(["membrosequipes", "equipe", "equipes", "efetivo", "guarnição", "guarnicao"]);
  const idxNarrativa = colIndex(["narrativa", "histórico", "historico", "descrição", "descricao"]);
  const idxRelato = colIndex(["relatosrelato", "relatos", "relato"]);

  const totalRows = rawRows.length - 1;
  const fireOccurrences: StoredOccurrence[] = [];

  for (let i = headerRowIndex + 1; i < rawRows.length; i++) {
    const row = rawRows[i];
    if (!row || row.length === 0 || row.every((c) => !c)) continue;

    const rawNatFinal = cleanStr(idxNaturezaFinal >= 0 ? row[idxNaturezaFinal] : "");
    const rawNatInicial = cleanStr(idxNaturezaInicial >= 0 ? row[idxNaturezaInicial] : "");
    // Regra institucional: Natureza final prevalece e a inicial é usada quando a final está vazia
    const rawNatureza = rawNatFinal || rawNatInicial || "";
    const rawTipo = cleanStr(idxTipo >= 0 ? row[idxTipo] : "");
    const rawNarrativa = cleanStr(idxNarrativa >= 0 ? row[idxNarrativa] : "");
    const rawRelato = cleanStr(idxRelato >= 0 ? row[idxRelato] : "");

    // Filtro obrigatório: SOMENTE INCÊNDIOS
    if (!isStrictFireNature(rawNatureza, rawTipo, `${rawNarrativa} ${rawRelato}`)) {
      continue;
    }

    // Identificação de Data & Hora (Prioridade: dataHoraFato local)
    const rawDateCandidates = [
      idxDataHoraFato >= 0 ? row[idxDataHoraFato] : "",
      idxDataFato >= 0 ? row[idxDataFato] : "",
      idxDataFinalizacao >= 0 ? row[idxDataFinalizacao] : "",
      idxDataGeneric >= 0 ? row[idxDataGeneric] : "",
      idxDataReg >= 0 ? row[idxDataReg] : "",
    ];

    let parsedDate: { iso: string; br: string; time: string } | null = null;
    for (const cand of rawDateCandidates) {
      if (cand && String(cand).trim() !== "-" && String(cand).trim() !== "null") {
        parsedDate = parseDateAny(String(cand));
        if (parsedDate) break;
      }
    }

    if (!parsedDate) continue;

    let timeStr = parsedDate.time;
    // Se a hora estiver zerada ou não detectada, tenta o campo específico de dataHoraFato ou hora
    if ((!timeStr || timeStr === "—" || timeStr === "00:00") && idxDataHoraFato >= 0) {
      const pFato = parseDateAny(String(row[idxDataHoraFato]));
      if (pFato && pFato.time && pFato.time !== "—" && pFato.time !== "00:00") {
        timeStr = pFato.time;
      }
    }
    if ((!timeStr || timeStr === "—" || timeStr === "00:00") && idxHora >= 0) {
      const hCand = cleanStr(row[idxHora]);
      if (hCand && hCand.includes(":")) timeStr = hCand.slice(0, 5);
    }

    let munRaw = cleanStr(idxMunicipio >= 0 ? row[idxMunicipio] : "");
    // Validação estrita do município: NUNCA permitir UUIDs, hashes ou tropas externas
    const isBadMun =
      !munRaw ||
      munRaw.length > 35 ||
      /^[0-9a-f]{8}-[0-9a-f]{4}/i.test(munRaw) ||
      /^[0-9a-f-]{10,}$/i.test(munRaw) ||
      isNonMunicipioTroop(munRaw);

    if (isBadMun) {
      // Tenta recuperar da região de atuação, unidade ou narrativa/relato
      const regTxt = cleanStr(idxRegiao >= 0 ? row[idxRegiao] : "");
      const uniTxt = cleanStr(idxUnidade >= 0 ? row[idxUnidade] : "");
      const fallbackPool = `${regTxt} ${uniTxt} ${rawNarrativa} ${rawRelato}`.toLowerCase();

      const { STANDARD_OPERATIONAL_MUNICIPIOS } = await import("./sheets-fallback.server");
      const foundMun = STANDARD_OPERATIONAL_MUNICIPIOS.find((m) =>
        fallbackPool.includes(m.toLowerCase()),
      );
      munRaw = foundMun || "Manaus";
    }

    const municipio = canonicalMunicipio(munRaw);

    const bairro = cleanStr(idxBairro >= 0 ? row[idxBairro] : "");
    let endereco = cleanStr(idxEndereco >= 0 ? row[idxEndereco] : "");
    // Limpa UUIDs acidentais que possam constar em campos de endereço
    if (/^[0-9a-f-]{15,}$/i.test(endereco)) {
      endereco = "";
    } else {
      endereco = endereco.replace(/[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/gi, "").trim();
      endereco = endereco.replace(/,\s*,/g, ",").replace(/,\s*$/, "").trim();
    }
    if (!endereco) {
      endereco = bairro ? `${bairro}, ${municipio}` : municipio;
    }

    let focos = cleanNum(idxFocos >= 0 ? row[idxFocos] : 0);
    let area = cleanNum(idxArea >= 0 ? row[idxArea] : 0);
    let agua = cleanNum(idxAgua >= 0 ? row[idxAgua] : 0);

    // Se focos, área ou água estiverem vazios/zerados na coluna, busca na narrativa ou relatos
    const combinedContext = `${rawNarrativa} ${rawRelato}`;
    if (focos <= 0) {
      const fMatch = combinedContext.match(/(?:apresentando|com|total(?:izando)?\s*de|havia|foram\s*(?:extintos\s*e\s*)?identificados|extintos)?\s*(\d+)\s*focos?/i);
      if (fMatch) {
        focos = parseInt(fMatch[1], 10);
      } else {
        focos = 1;
      }
    }
    if (area <= 0) {
      const aMatch = combinedContext.match(/(?:área|area)(?:\s*(?:queimada|afetada|atingida))?[^0-9]{0,25}([\d.,]+)\s*(m²|m2|ha|hectares?|metros)/i);
      if (aMatch) {
        const unit = aMatch[2].toLowerCase();
        let val = parseFloat(aMatch[1].replace(/\./g, "").replace(",", "."));
        if (!isNaN(val)) {
          if (unit.includes("ha") || unit.includes("hectare")) val = val * 10000;
          area = val;
        }
      }
    }
    if (agua <= 0) {
      const wMatch = combinedContext.match(/(?:gastos?|utilizad[oa]s?|uso\s*de|com)?\s*([\d.,]+)\s*(?:mil\s*)?(?:litros|l)\s*(?:de\s*água|de\s*agua)?/i);
      if (wMatch) {
        let val = parseFloat(wMatch[1].replace(/\./g, "").replace(",", "."));
        if (!isNaN(val) && val !== 193) {
          if (wMatch[0].toLowerCase().includes("mil") && val < 1000) val = val * 1000;
          agua = val;
        }
      }
    }

    let coordenadas = "";
    if (idxCoords >= 0 && row[idxCoords]) {
      coordenadas = cleanStr(row[idxCoords]);
    } else if (idxLat >= 0 && idxLon >= 0 && row[idxLat] && row[idxLon]) {
      const latVal = cleanStr(row[idxLat]).replace(",", ".");
      const lonVal = cleanStr(row[idxLon]).replace(",", ".");
      coordenadas = `${latVal}, ${lonVal}`;
    }

    if (!coordenadas) {
      const textBlock = `${rawNarrativa} ${rawRelato} ${endereco}`;
      const coordMatch = textBlock.match(/(-?\d{1,2}[.,]\d{4,8})\s*[,;\s]\s*(-?\d{1,2}[.,]\d{4,8})/);
      if (coordMatch) {
        coordenadas = `${coordMatch[1].replace(",", ".")}, ${coordMatch[2].replace(",", ".")}`;
      }
    }

    if (coordenadas) {
      coordenadas = coordenadas.trim().replace(/;/g, ",");
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

  // Persiste no banco de dados e no store
  return saveParsedOccurrencesToDb(fireOccurrences, supabaseClient);
}
