/**
 * Leitura das planilhas oficiais publicadas em uma pasta pública do Google Drive.
 *
 * A pasta é lida pela visualização pública ("embeddedfolderview"), que não exige
 * OAuth — qualquer pessoa com o link enxerga a mesma listagem. Cada arquivo .xlsx
 * é baixado e convertido no formato usado pela tabela `daily_reports`.
 *
 * Server-only: nunca importar em código de navegador.
 */
import * as XLSX from "xlsx";
import type { ReportShift } from "./report-shift";
import { canonicalMunicipio } from "./municipio-order";

export type DriveFile = {
  id: string;
  name: string;
  reportDate: string | null;
  shift: ReportShift | null;
};

export type ParsedDailyReport = {
  efetivo: Array<{ mun: string; ord: number; seg: number; brig: number }>;
  recursos: Array<Record<string, any>>;
  incendios: Array<{ mun: string; urb: number; flor: number; focos: number; sat?: number; area?: number }>;
  outras: Array<{
    mun: string;
    salvamento: number;
    acidentes: number;
    aph: number;
    prevencao: number;
    servicos: number;
  }>;
};

const FOLDER_VIEW = "https://drive.google.com/embeddedfolderview?id=";
const DOWNLOAD = "https://drive.google.com/uc?export=download&id=";

/** "01.07.2026 - Relatório Diário Amazonas + Verde- 24h.xlsx" → data + turno. */
export function parseFileName(name: string): {
  reportDate: string | null;
  shift: ReportShift;
} {
  const d = name.match(/(\d{2})[.\-/](\d{2})[.\-/](\d{4})/);
  const reportDate = d ? `${d[3]}-${d[2]}-${d[1]}` : null;
  const lower = name.toLowerCase();
  const shift: ReportShift = lower.includes("parcial") ? "parcial" : "noturno";
  return { reportDate, shift };
}

const BROWSER_HEADERS = {
  "User-Agent":
    "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36",
  Accept: "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
};

/** Lista os .xlsx de uma pasta pública do Drive (incluindo subpastas), mais recentes primeiro. */
export async function listFolderSpreadsheets(
  folderId: string,
  depth = 0,
): Promise<DriveFile[]> {
  if (depth > 3) return [];
  try {
    const res = await fetch(`${FOLDER_VIEW}${encodeURIComponent(folderId)}#list`, {
      headers: BROWSER_HEADERS,
      redirect: "follow",
      signal: AbortSignal.timeout(15000),
    });
    if (!res.ok) throw new Error(`Não foi possível abrir a pasta (HTTP ${res.status}).`);
    const html = await res.text();

    const files: DriveFile[] = [];
    const subfolderIds: string[] = [];

    const re = /id="entry-([-_A-Za-z0-9]+)"[\s\S]*?flip-entry-title">([^<]+)</g;
    let m: RegExpExecArray | null;
    while ((m = re.exec(html))) {
      const entryId = m[1];
      const name = decodeEntities(m[2]).trim();

      if (/\.xlsx?$/i.test(name)) {
        files.push({ id: entryId, name, ...parseFileName(name) });
      } else if (!name.includes(".") && depth < 2) {
        subfolderIds.push(entryId);
      }
    }

    if (subfolderIds.length > 0 && depth < 2) {
      const subResults = await Promise.all(
        subfolderIds.map((subId) => listFolderSpreadsheets(subId, depth + 1)),
      );
      for (const subFiles of subResults) {
        files.push(...subFiles);
      }
    }

    const uniqueMap = new Map<string, DriveFile>();
    for (const f of files) {
      if (!uniqueMap.has(f.id)) uniqueMap.set(f.id, f);
    }

    return Array.from(uniqueMap.values()).sort(
      (a, b) =>
        (b.reportDate ?? "").localeCompare(a.reportDate ?? "") || a.name.localeCompare(b.name),
    );
  } catch (e) {
    if (depth > 0) return [];
    throw e;
  }
}

function decodeEntities(s: string) {
  return s
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'");
}

/** Baixa a planilha pública e devolve a matriz da aba de relatório. */
export async function downloadSheetMatrix(fileId: string): Promise<any[][]> {
  const res = await fetch(`${DOWNLOAD}${encodeURIComponent(fileId)}`, {
    headers: BROWSER_HEADERS,
    redirect: "follow",
    signal: AbortSignal.timeout(30000),
  });
  if (!res.ok) throw new Error(`Falha ao baixar a planilha (HTTP ${res.status}).`);
  const buf = new Uint8Array(await res.arrayBuffer());
  const wb = XLSX.read(buf, { type: "array" });
  const sheetName =
    wb.SheetNames.find((n) =>
      /^relatorio/i.test(n.normalize("NFD").replace(/\p{Diacritic}/gu, "")),
    ) ?? wb.SheetNames[0];
  const ws = wb.Sheets[sheetName];
  if (!ws) throw new Error("Planilha sem aba de relatório.");
  return XLSX.utils.sheet_to_json<any[]>(ws, { header: 1, raw: true, defval: null });
}

// ---------------- Parsing das seções ----------------

const norm = (v: any) =>
  String(v ?? "")
    .normalize("NFD")
    .replace(/\p{Diacritic}/gu, "")
    .replace(/\s+/g, " ")
    .trim()
    .toUpperCase();

const num = (v: any) => {
  if (v === null || v === undefined || v === "") return 0;
  const n = Number(String(v).replace(",", "."));
  return Number.isFinite(n) && n >= 0 ? n : 0;
};

/** Índice da linha cujo primeiro texto começa com o rótulo da seção. */
function findSection(rows: any[][], label: string, from = 0): number {
  const target = norm(label);
  for (let i = from; i < rows.length; i++) {
    const cell = (rows[i] ?? []).find((c) => String(c ?? "").trim() !== "");
    if (cell && norm(cell).startsWith(target)) return i;
  }
  return -1;
}

/**
 * Cada seção repete o mesmo bloco (MUNICÍPIO + colunas) lado a lado.
 * Devolve um bloco por coluna "MUNICÍPIO" encontrada na linha de cabeçalho.
 */
function headerBlocks(
  header: any[],
): Array<{ munCol: number; end: number; labels: Map<string, number> }> {
  const munCols: number[] = [];
  header.forEach((c, i) => {
    if (norm(c) === "MUNICIPIO" || norm(c) === "REGIAO") munCols.push(i);
  });
  return munCols.map((munCol, k) => {
    const end = k + 1 < munCols.length ? munCols[k + 1] - 1 : header.length;
    const labels = new Map<string, number>();
    for (let c = munCol + 1; c < end; c++) {
      const l = norm(header[c]);
      if (l && !labels.has(l)) labels.set(l, c);
    }
    return { munCol, end, labels };
  });
}

function pick(labels: Map<string, number>, ...names: string[]): number | undefined {
  for (const n of names) {
    const key = norm(n);
    for (const [label, col] of labels) if (label.startsWith(key)) return col;
  }
  return undefined;
}

/** Percorre as linhas de dados de um bloco até o fim da seção. */
function eachRow(
  rows: any[][],
  startRow: number,
  munCol: number,
  cb: (row: any[], mun: string) => void,
) {
  for (let i = startRow; i < rows.length; i++) {
    const row = rows[i] ?? [];
    const mun = String(row[munCol] ?? "").trim();
    const upper = norm(mun);
    if (!mun) {
      // Duas linhas vazias seguidas encerram o bloco.
      const next = String((rows[i + 1] ?? [])[munCol] ?? "").trim();
      if (!next) break;
      continue;
    }
    if (upper.startsWith("TOTAL")) break;
    cb(row, mun);
  }
}

/** Converte a aba RELATÓRIO no formato de `daily_reports`. */
export function parseDailyReportSheet(rows: any[][]): ParsedDailyReport {
  const out: ParsedDailyReport = { efetivo: [], recursos: [], incendios: [], outras: [] };

  // --- EFETIVO ---
  let efRow = -1;
  for (let i = 0; i < rows.length; i++) {
    const rowStr = (rows[i] || []).map((c) => String(c ?? "")).join(" | ");
    if (/EFETIVO/i.test(rowStr) && rows[i + 1]?.some((c) => /ORDIN[AÁ]RIO/i.test(String(c ?? "")))) {
      efRow = i;
      break;
    }
  }

  if (efRow >= 0) {
    const header = rows[efRow + 1] || [];
    const munCols: number[] = [];
    header.forEach((c, idx) => {
      if (norm(c) === "MUNICIPIO" || norm(c) === "BASES TEMPORARIAS") munCols.push(idx);
    });

    for (const munCol of munCols) {
      let ordCol = -1;
      let segCol = -1;
      let brigCol = -1;
      for (let c = munCol + 1; c < munCol + 5 && c < header.length; c++) {
        const h = norm(header[c]);
        if (h.includes("ORDINARIO")) ordCol = c;
        else if (h.includes("SEG")) segCol = c;
        else if (h.includes("BRIGADISTA")) brigCol = c;
      }

      for (let r = efRow + 2; r < rows.length; r++) {
        const row = rows[r] || [];
        const rawMun = String(row[munCol] ?? "").trim();
        if (!rawMun || /TOTAL/i.test(rawMun)) break;
        const mun = canonicalMunicipio(rawMun);
        out.efetivo.push({
          mun,
          ord: ordCol >= 0 ? num(row[ordCol]) : 0,
          seg: segCol >= 0 ? num(row[segCol]) : 0,
          brig: brigCol >= 0 ? num(row[brigCol]) : 0,
        });
      }
    }
  }

  // --- RECURSOS ---
  const recIdx = findSection(rows, "RECURSOS");
  if (recIdx >= 0) {
    const header = rows[recIdx + 1] ?? [];
    for (const b of headerBlocks(header)) {
      // Apenas o primeiro bloco com MUNICÍPIO (coluna 1) contém as viaturas por município.
      if (b.munCol > 5) continue;
      eachRow(rows, recIdx + 2, b.munCol, (row, mun) => {
        const extra: Record<string, number> = {};
        let viaturas = 0;
        let aeronaves = 0;
        let embarcacoes = 0;
        for (const [label, col] of b.labels) {
          if (/^(TOTAL|QTD|N°|Nº|SOMA)/.test(label)) continue;
          const v = num(row[col]);
          if (!v) continue;
          extra[label] = v;
          if (label.startsWith("EMBARCACAO") || label.startsWith("LANCHA")) embarcacoes += v;
          else if (label.startsWith("AERONAVE") || label.startsWith("HELICOPTERO")) aeronaves += v;
          else viaturas += v;
        }
        out.recursos.push({ mun: canonicalMunicipio(mun), viaturas, aeronaves, embarcacoes, ...extra });
      });
    }
  }

  // --- INCÊNDIOS (ocorrências DIÁRIAS do período - APENAS BLOCO 1) ---
  let incRow = -1;
  for (let i = 0; i < rows.length; i++) {
    const rowStr = (rows[i] || []).map((c) => String(c ?? "")).join(" | ");
    if (/INC[EÊ]NDIOS\s*-\s*OCORR[EÊ]NCIAS DI[AÁ]RIAS/i.test(rowStr)) {
      incRow = i;
      break;
    }
  }

  if (incRow >= 0) {
    const header = rows[incRow + 1] || [];
    let endTable1 = header.length;
    for (let c = 2; c < header.length; c++) {
      const h = norm(header[c]);
      if (h === "MUNICIPIO" || h === "N°" || h === "Nº" || h.startsWith("N")) {
        endTable1 = c;
        break;
      }
    }

    let munCol = 1;
    let urbCol = -1;
    let florCol = -1;
    let focosCol = -1;

    for (let c = 0; c < endTable1; c++) {
      const h = norm(header[c]);
      if (h === "MUNICIPIO") munCol = c;
      else if (h.includes("URBANO")) urbCol = c;
      else if (h.includes("FLORESTAL")) florCol = c;
      else if (h.includes("FOCOS")) focosCol = c;
    }

    for (let r = incRow + 2; r < rows.length; r++) {
      const row = rows[r] || [];
      const rawMun = String(row[munCol] ?? "").trim();
      if (!rawMun || /TOTAL/i.test(rawMun)) break;
      const mun = canonicalMunicipio(rawMun);
      const urb = urbCol >= 0 ? num(row[urbCol]) : 0;
      const flor = florCol >= 0 ? num(row[florCol]) : 0;
      const focos = focosCol >= 0 ? num(row[focosCol]) : 0;

      out.incendios.push({
        mun,
        urb,
        flor,
        focos,
        sat: 0,
        area: 0,
      });
    }
  }

  // --- OUTRAS OCORRÊNCIAS DIÁRIAS (APENAS BLOCO 1) ---
  let outRow = -1;
  for (let i = 0; i < rows.length; i++) {
    const rowStr = (rows[i] || []).map((c) => String(c ?? "")).join(" | ");
    if (/OUTRAS OCORR[EÊ]NCIAS DI[AÁ]RIAS/i.test(rowStr)) {
      outRow = i;
      break;
    }
  }

  if (outRow >= 0) {
    const header = rows[outRow + 1] || [];
    let endTable1 = header.length;
    for (let c = 2; c < header.length; c++) {
      const h = norm(header[c]);
      if (h.includes("REGIAO") || h.includes("TIPO DE OCORRENCIA")) {
        endTable1 = c;
        break;
      }
    }

    let munCol = 1;
    let salvCol = -1;
    let acidCol = -1;
    let aphCol = -1;
    let prevCol = -1;
    let servCol = -1;

    for (let c = 0; c < endTable1; c++) {
      const h = norm(header[c]);
      if (h === "MUNICIPIO") munCol = c;
      else if (h.includes("SALVAMENTO")) salvCol = c;
      else if (h.includes("ACIDENTES")) acidCol = c;
      else if (h.includes("APH")) aphCol = c;
      else if (h.includes("PREVENCAO")) prevCol = c;
      else if (h.includes("SERVICOS")) servCol = c;
    }

    for (let r = outRow + 2; r < rows.length; r++) {
      const row = rows[r] || [];
      const rawMun = String(row[munCol] ?? "").trim();
      if (!rawMun || /TOTAL/i.test(rawMun)) break;
      const mun = canonicalMunicipio(rawMun);
      const salv = salvCol >= 0 ? num(row[salvCol]) : 0;
      const acid = acidCol >= 0 ? num(row[acidCol]) : 0;
      const aph = aphCol >= 0 ? num(row[aphCol]) : 0;
      const prev = prevCol >= 0 ? num(row[prevCol]) : 0;
      const serv = servCol >= 0 ? num(row[servCol]) : 0;

      out.outras.push({
        mun,
        salvamento: salv,
        acidentes: acid,
        aph,
        prevencao: prev,
        servicos: serv,
      });
    }
  }

  // Consolidação final e canonicalização única
  const consolidate = <T extends Record<string, any>>(list: T[]) => {
    const map = new Map<string, T>();
    for (const row of list) {
      const rawMun = row.mun ?? row.municipio;
      if (!rawMun) continue;
      const mun = canonicalMunicipio(rawMun);
      const existing = map.get(mun);
      if (!existing) {
        map.set(mun, { ...row, mun });
      } else {
        for (const [k, v] of Object.entries(row)) {
          if (k === "mun" || k === "municipio") continue;
          (existing as any)[k] = num((existing as any)[k]) + num(v);
        }
      }
    }
    return Array.from(map.values());
  };

  out.efetivo = consolidate(out.efetivo);
  out.recursos = consolidate(out.recursos as Array<Record<string, any>>) as any;
  out.incendios = consolidate(out.incendios);
  out.outras = consolidate(out.outras);

  return out;
}
