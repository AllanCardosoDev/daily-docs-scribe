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
  const efIdx = findSection(rows, "EFETIVO");
  if (efIdx >= 0) {
    const header = rows[efIdx + 1] ?? [];
    for (const b of headerBlocks(header)) {
      const ord = pick(b.labels, "SERV. ORDINARIO", "SERV ORDINARIO", "ORDINARIO");
      const seg = pick(b.labels, "SEG");
      const brig = pick(b.labels, "BRIGADISTA");
      eachRow(rows, efIdx + 2, b.munCol, (row, mun) => {
        out.efetivo.push({
          mun,
          ord: ord === undefined ? 0 : num(row[ord]),
          seg: seg === undefined ? 0 : num(row[seg]),
          brig: brig === undefined ? 0 : num(row[brig]),
        });
      });
    }
  }

  // --- RECURSOS ---
  const recIdx = findSection(rows, "RECURSOS");
  if (recIdx >= 0) {
    const header = rows[recIdx + 1] ?? [];
    for (const b of headerBlocks(header)) {
      eachRow(rows, recIdx + 2, b.munCol, (row, mun) => {
        const extra: Record<string, number> = {};
        let viaturas = 0;
        let aeronaves = 0;
        let embarcacoes = 0;
        for (const [label, col] of b.labels) {
          // Colunas de resumo da própria planilha não são recursos.
          if (/^(TOTAL|QTD|N°|Nº|SOMA)/.test(label)) continue;
          const v = num(row[col]);
          if (!v) continue;
          extra[label] = v;
          if (label.startsWith("EMBARCACAO") || label.startsWith("LANCHA")) embarcacoes += v;
          else if (label.startsWith("AERONAVE") || label.startsWith("HELICOPTERO")) aeronaves += v;
          else viaturas += v;
        }
        out.recursos.push({ mun, viaturas, aeronaves, embarcacoes, ...extra });
      });
    }
  }

  // --- INCÊNDIOS (ocorrências do período) ---
  const incIdx = findSection(rows, "INCENDIOS");
  if (incIdx >= 0) {
    const header = rows[incIdx + 1] ?? [];
    for (const b of headerBlocks(header)) {
      const urb = pick(b.labels, "INCENDIO URBANO");
      const flor = pick(b.labels, "INCENDIO FLORESTAL");
      const focos = pick(b.labels, "FOCOS COMBATIDOS", "FOCOS");
      const sat = pick(b.labels, "FOCOS DETECTADOS SATELITE", "FOCOS DETECTADOS", "SATELITE");
      const area = pick(
        b.labels,
        "TOTAL DE AREA POR METROS",
        "TOTAL DE AREA",
        "AREA POR METROS",
        "AREA",
      );
      if (
        urb === undefined &&
        flor === undefined &&
        focos === undefined &&
        sat === undefined &&
        area === undefined
      )
        continue;
      eachRow(rows, incIdx + 2, b.munCol, (row, mun) => {
        const rawUrb = urb === undefined ? 0 : num(row[urb]);
        const rawFlor = flor === undefined ? 0 : num(row[flor]);
        const rawFocos = focos === undefined ? 0 : num(row[focos]);
        // Se a coluna lida for o acumulado anual (>30), registramos como 0 no diário
        const isCum = rawUrb > 30 || rawFlor > 30 || rawFocos > 100;
        out.incendios.push({
          mun,
          urb: isCum ? 0 : rawUrb,
          flor: isCum ? 0 : rawFlor,
          focos: isCum ? 0 : rawFocos,
          sat: sat === undefined ? 0 : num(row[sat]),
          area: area === undefined ? 0 : num(row[area]),
        });
      });
    }
  }

  // --- OCORRÊNCIAS (salvamento, acidentes, APH, prevenção, serviços) ---
  const outIdx = findSection(rows, "OUTRAS OCORRENCIAS");
  if (outIdx >= 0) {
    const header = rows[outIdx + 1] ?? [];
    for (const b of headerBlocks(header)) {
      const salvamento = pick(b.labels, "SALVAMENTO");
      const acidentes = pick(b.labels, "ACIDENTES");
      const aph = pick(b.labels, "APH");
      const prevencao = pick(b.labels, "ACAO DE PREVENCAO", "PREVENCAO");
      const servicos = pick(b.labels, "SERVICOS");
      eachRow(rows, outIdx + 2, b.munCol, (row, mun) => {
        out.outras.push({
          mun,
          salvamento: salvamento === undefined ? 0 : num(row[salvamento]),
          acidentes: acidentes === undefined ? 0 : num(row[acidentes]),
          aph: aph === undefined ? 0 : num(row[aph]),
          prevencao: prevencao === undefined ? 0 : num(row[prevencao]),
          servicos: servicos === undefined ? 0 : num(row[servicos]),
        });
      });
    }
  }

  // Consolida municípios duplicados (como Boca do Acre), somando seus valores.
  const consolidate = <T extends Record<string, any>>(list: T[]) => {
    const map = new Map<string, T>();
    for (const row of list) {
      const rawMun = row.mun ?? row.municipio;
      if (!rawMun) continue;
      const mun = canonicalMunicipio(rawMun);
      const existing = map.get(mun);
      if (!existing) {
        const copy = { ...row, mun };
        map.set(mun, copy);
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
