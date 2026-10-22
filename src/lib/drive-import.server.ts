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
import type { SheetsHeader } from "./sheets.types";

export type DriveFile = {
  id: string;
  name: string;
  reportDate: string | null;
  shift: ReportShift | null;
};

export type ParsedDailyReport = {
  header: SheetsHeader;
  efetivo: Array<{
    mun: string;
    ord: number;
    seg: number;
    brig: number;
    servico: number;
    opamv: number;
    opam_ref: number;
    inc1: number;
    inc2: number;
    inc3: number;
    cbmsp: number;
    prevfogo: number;
    fn: number;
    brig_mun: number;
    brig_semas: number;
  }>;
  recursos: Array<Record<string, any>>;
  incendios: Array<{ mun: string; urb: number; flor: number; focos: number; sat?: number; area?: number }>;
  incendios_acumulado: Array<{ mun: string; urb: number; flor: number; focos: number; sat: number; area: number }>;
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
function assertFolderId(folderId: string) {
  if (!/^[-_A-Za-z0-9]+$/.test(folderId)) throw new Error("ID de pasta inválido.");
}

export async function listFolderSpreadsheets(
  folderId: string,
  depth = 0,
): Promise<DriveFile[]> {
  assertFolderId(folderId);
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

const MAX_DOWNLOAD_BYTES = 10 * 1024 * 1024;

function assertDownloadSize(res: Response, buf: ArrayBuffer) {
  const claimed = Number(res.headers.get("content-length") ?? 0);
  if (claimed > MAX_DOWNLOAD_BYTES) {
    throw new Error(`Planilha excede limite de ${MAX_DOWNLOAD_BYTES / (1024 * 1024)} MB.`);
  }
  if (buf.byteLength > MAX_DOWNLOAD_BYTES) {
    throw new Error(`Planilha excede limite de ${MAX_DOWNLOAD_BYTES / (1024 * 1024)} MB.`);
  }
  if (buf.byteLength === 0) throw new Error("Planilha vazia.");
}

/** Baixa a planilha pública e devolve a matriz da aba de relatório. */
export async function downloadSheetMatrix(fileId: string): Promise<any[][]> {
  if (!/^[-_A-Za-z0-9]+$/.test(fileId)) throw new Error("ID de arquivo inválido.");
  const res = await fetch(`${DOWNLOAD}${encodeURIComponent(fileId)}`, {
    headers: BROWSER_HEADERS,
    redirect: "follow",
    signal: AbortSignal.timeout(30000),
  });
  if (!res.ok) throw new Error(`Falha ao baixar a planilha (HTTP ${res.status}).`);
  const raw = await res.arrayBuffer();
  assertDownloadSize(res, raw);
  const buf = new Uint8Array(raw);
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
  const n = Number(String(v).replace(",", ".").replace(/\s/g, ""));
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
      const next = String((rows[i + 1] ?? [])[munCol] ?? "").trim();
      if (!next) break;
      continue;
    }
    if (upper.startsWith("TOTAL")) break;
    cb(row, mun);
  }
}

function parseHeader(rows: any[][]): SheetsHeader {
  const header: SheetsHeader = {};
  for (let i = 0; i < Math.min(10, rows.length); i++) {
    const row = rows[i] ?? [];
    const upper = norm(row.map((c) => String(c ?? "").trim()).join(" | "));
    // Period/date fields share row with officer names (e.g. col 6 = name, col 22 = period label)
    // For officer fields, take immediate next non-empty value. For period fields, join until "8H".
    const findOfficer = (labelRe: RegExp): string | null => {
      for (let c = 0; c < row.length; c++) {
        if (labelRe.test(norm(row[c]))) {
          for (let k = c + 1; k < row.length; k++) {
            const v = String(row[k] ?? "").trim();
            if (!v) continue;
            // Officer name is "CEL QOBM ..." / "TC QOBM ..." - single token before next label
            if (/^(CEL|TC)\s+QOBM/i.test(v)) return v;
            // fallback: first non-empty that is not a period fragment
            if (!/^\d+\s*\/\s*[A-Z]+/i.test(v)) return v;
          }
        }
      }
      return null;
    };
    const findPeriod = (labelRe: RegExp): string | null => {
      for (let c = 0; c < row.length; c++) {
        if (labelRe.test(norm(row[c]))) {
          const parts: string[] = [];
          for (let k = c + 1; k < row.length; k++) {
            const v = String(row[k] ?? "").trim();
            if (!v) continue;
            if (/^(DATA DE HOJE|NÃO MEXER|NAO MEXER)$/i.test(v)) break;
            if (/^\d{5}$/.test(v)) break;
            parts.push(v);
            if (parts.join(" ").includes("8H")) break;
          }
          if (parts.length) return parts.join(" ").replace(/\s+/g, " ").trim();
        }
      }
      return null;
    };
    const comandante = findOfficer(/COMANDANTE DO INCIDENTE/);
    if (comandante) header.comandante = comandante;
    const chefeCap = findOfficer(/CHEFE DE OPERA.*CAPITAL/);
    if (chefeCap) header.chefeCapital = chefeCap;
    const chefeInt = findOfficer(/CHEFE DE OPERA.*INTERIOR/);
    if (chefeInt) header.chefeInterior = chefeInt;
    const coord = findOfficer(/COORDENADOR DA SALA/);
    if (coord) header.coordSituacao = coord;
    if (upper.includes("PERIODO OPERACIONAL") && !upper.includes("PROXIMO")) {
      const v = findPeriod(/PERIODO OPERACIONAL/);
      if (v) header.periodo = v;
    }
    if (upper.includes("PROXIMO PERIODO")) {
      const v = findPeriod(/PROXIMO PERIODO/);
      if (v) header.proximoPeriodo = v;
    }
    if (upper.includes("REUNIAO DE PLANEJAMENTO")) {
      const v = findPeriod(/REUNIAO DE PLANEJAMENTO/);
      if (v) header.reuniaoPlanejamento = v;
    }
    if (upper.includes("REUNIAO DE BRIEFING")) {
      const v = findPeriod(/REUNIAO DE BRIEFING/);
      if (v) header.reuniaoBriefing = v;
    }
  }
  // Coordenador / subcomandante are at bottom signatures
  for (let i = rows.length - 1; i >= 0 && i > rows.length - 30; i--) {
    const row = rows[i] ?? [];
    for (const c of row) {
      const v = String(c ?? "").trim();
      if (/CRISTIANO BRAZ/i.test(v)) header.coordenador = "TC QOBM CRISTIANO BRAZ FERREIRA";
      if (/HELYANTHUS/i.test(v)) header.subcomandante = "CEL QOBM HELYANTHUS FRANK DA SILVA BORGES";
    }
  }
  return header;
}

function parseEfetivo(rows: any[][]): ParsedDailyReport["efetivo"] {
  let efRow = -1;
  for (let i = 0; i < rows.length; i++) {
    const rowStr = (rows[i] || []).map((c) => String(c ?? "")).join(" | ");
    // New layout has "EFETIVO" alone on row, next row has header with SERVIÇO or ORDINÁRIO
    if (/EFETIVO/i.test(rowStr) && i + 1 < rows.length) {
      const next = (rows[i + 1] || []).map((c) => norm(c)).join(" ");
      if (next.includes("SERVICO") || next.includes("ORDINARIO") || next.includes("MUNICIPIO")) {
        efRow = i;
        break;
      }
    }
  }
  if (efRow < 0) return [];

  const header = rows[efRow + 1] || [];
  // Find all MUNICÍPIO columns plus BASES TEMPORÁRIAS start
  const munCols: number[] = [];
  header.forEach((c, idx) => {
    const n = norm(c);
    if (n === "MUNICIPIO" || n === "BASES TEMPORARIAS") munCols.push(idx);
  });

  // Build label map per munCol block
  type BlockMap = {
    munCol: number;
    servico?: number;
    opamv?: number;
    opam_ref?: number;
    inc1?: number;
    inc2?: number;
    inc3?: number;
    cbmsp?: number;
    prevfogo?: number;
    fn?: number;
    brig_mun?: number;
    brig_semas?: number;
    seg?: number;
    ordLegacy?: number;
  };
  const blocks: BlockMap[] = munCols.map((munCol, k) => {
    const end = k + 1 < munCols.length ? munCols[k + 1] : header.length;
    const b: BlockMap = { munCol };
    for (let c = munCol + 1; c < end && c < header.length; c++) {
      const h = norm(header[c]);
      if (!h || h === "TOTAL" || h.startsWith("TOTAL GERAL")) continue;
      if (h === "SERVICO" || h === "SERV. ORDINARIO" || h === "SERVICO ORDINARIO" || h.includes("SERVICO") || h === "SERV") {
        if (b.servico === undefined) b.servico = c;
        if (b.ordLegacy === undefined) b.ordLegacy = c;
      } else if (h.includes("OPAMV")) b.opamv = c;
      else if (h.includes("OPAM REF")) b.opam_ref = c;
      else if (h.match(/^INC\s*1/) || h.includes("INC 1")) b.inc1 = c;
      else if (h.match(/^INC\s*2/) || h.includes("INC 2")) b.inc2 = c;
      else if (h.match(/^INC\s*3/) || h.includes("INC3") || h.includes("INC 3")) b.inc3 = c;
      else if (h.includes("CBMSP") || h.includes("CBMS P")) b.cbmsp = c;
      else if (h.includes("PREVFOGO")) b.prevfogo = c;
      else if (h === "FN") b.fn = c;
      else if (h.includes("BRIGADISTA MUN") || h.includes("BRIGADISTA MUNC")) b.brig_mun = c;
      else if (h.includes("BRIGADISTA SEMAS") || h.includes("BRIGADISTA SEMA")) b.brig_semas = c;
      else if (h === "SEG") b.seg = c;
      else if (h.includes("ORDINARIO") && b.ordLegacy === undefined) b.ordLegacy = c;
      else if (h.includes("BRIGADISTA") && b.brig_mun === undefined) b.brig_mun = c;
    }
    return b;
  });

  const out: ParsedDailyReport["efetivo"] = [];

  for (const b of blocks) {
    for (let r = efRow + 2; r < rows.length; r++) {
      const row = rows[r] || [];
      const rawMun = String(row[b.munCol] ?? "").trim();
      if (!rawMun) {
        const next = String((rows[r + 1] ?? [])[b.munCol] ?? "").trim();
        if (!next) break;
        // skip empty separator but continue scanning - check if next block row has RECURSOS
        if (/RECURSOS/i.test((rows[r] || []).join(" "))) break;
        continue;
      }
      if (/^(TOTAL|RECURSOS)/i.test(rawMun)) break;
      if (/^(CAPITAL|INTERIOR|MISSÃO|MISSAO)/i.test(rawMun)) break;

      const servico = b.servico !== undefined ? num(row[b.servico]) : b.ordLegacy !== undefined ? num(row[b.ordLegacy]) : 0;
      const opamv = b.opamv !== undefined ? num(row[b.opamv]) : 0;
      const opam_ref = b.opam_ref !== undefined ? num(row[b.opam_ref]) : 0;
      const inc1 = b.inc1 !== undefined ? num(row[b.inc1]) : 0;
      const inc2 = b.inc2 !== undefined ? num(row[b.inc2]) : 0;
      const inc3 = b.inc3 !== undefined ? num(row[b.inc3]) : 0;
      const cbmsp = b.cbmsp !== undefined ? num(row[b.cbmsp]) : 0;
      const prevfogo = b.prevfogo !== undefined ? num(row[b.prevfogo]) : 0;
      const fn = b.fn !== undefined ? num(row[b.fn]) : 0;
      const brig_mun = b.brig_mun !== undefined ? num(row[b.brig_mun]) : 0;
      const brig_semas = b.brig_semas !== undefined ? num(row[b.brig_semas]) : 0;
      const seg = b.seg !== undefined ? num(row[b.seg]) : 0;

      // Keep original name for bases temporárias - don't canonicalize aggressively for distinction
      // but still canonicalize for consistency
      const mun = canonicalMunicipio(rawMun);

      out.push({
        mun,
        ord: servico,
        seg,
        brig: brig_mun + brig_semas,
        servico,
        opamv,
        opam_ref,
        inc1,
        inc2,
        inc3,
        cbmsp,
        prevfogo,
        fn,
        brig_mun,
        brig_semas,
      });
    }
  }

  return out;
}

/** Converte a aba RELATÓRIO no formato de `daily_reports`. */
export function parseDailyReportSheet(rows: any[][]): ParsedDailyReport {
  const out: ParsedDailyReport = { header: parseHeader(rows), efetivo: [], recursos: [], incendios: [], incendios_acumulado: [], outras: [] };

  out.efetivo = parseEfetivo(rows);

  // --- RECURSOS ---
  const recIdx = findSection(rows, "RECURSOS");
  if (recIdx >= 0) {
    const header = rows[recIdx + 1] ?? [];
    for (const b of headerBlocks(header)) {
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
          else if (label.startsWith("AERONAVE") || label.startsWith("HELICOPTERO") || label.startsWith("AVIAO")) aeronaves += v;
          else viaturas += v;
        }
        out.recursos.push({ mun: canonicalMunicipio(mun), viaturas, aeronaves, embarcacoes, ...extra });
      });
    }
  }

  // --- INCÊNDIOS (3 blocos lado a lado) ---
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
    // Find all MUNICIPIO column positions in this multi-block header
    const munColsInc: number[] = [];
    header.forEach((c, idx) => {
      if (norm(c) === "MUNICIPIO") munColsInc.push(idx);
    });
    // Block boundaries: diárias = [0, munColsInc[1]), acumulado atual = [munColsInc[1], munColsInc[2]), anterior = [munColsInc[2], end)
    const blockEnds = munColsInc.map((_, k) => (k + 1 < munColsInc.length ? munColsInc[k + 1] : header.length));

    const parseIncBlock = (blockIdx: number, target: "diario" | "acumulado") => {
      if (blockIdx >= munColsInc.length) return;
      const munCol = munColsInc[blockIdx];
      const end = blockEnds[blockIdx];
      let urbCol = -1, florCol = -1, focosCol = -1, satCol = -1, areaCol = -1;
      for (let c = munCol + 1; c < end; c++) {
        const h = norm(header[c]);
        if (h.includes("URBANO")) urbCol = c;
        else if (h.includes("FLORESTAL")) florCol = c;
        else if (h.includes("FOCOS") && h.includes("SATELITE")) satCol = c;
        else if (h.includes("FOCOS") && satCol === -1 && focosCol === -1) focosCol = c;
        else if (h.includes("AREA")) areaCol = c;
        else if (h.includes("FOCOS") && focosCol === -1) focosCol = c;
      }
      // FOCOS combatidos vs sat: if both present, keep distinct
      for (let r = incRow + 2; r < rows.length; r++) {
        const row = rows[r] || [];
        const rawMun = String(row[munCol] ?? "").trim();
        if (!rawMun || /^(TOTAL|INCÊNDIOS|REGIÃO|CAPITAL|INTERIOR)/i.test(rawMun)) break;
        const mun = canonicalMunicipio(rawMun);
        const urb = urbCol >= 0 ? num(row[urbCol]) : 0;
        const flor = florCol >= 0 ? num(row[florCol]) : 0;
        const focos = focosCol >= 0 ? num(row[focosCol]) : 0;
        const sat = satCol >= 0 ? num(row[satCol]) : 0;
        const area = areaCol >= 0 ? num(row[areaCol]) : 0;
        if (target === "diario") out.incendios.push({ mun, urb, flor, focos, sat, area });
        else out.incendios_acumulado.push({ mun, urb, flor, focos, sat, area });
      }
    };

    parseIncBlock(0, "diario");
    parseIncBlock(1, "acumulado");
    // block 2 (anterior) ignored - not needed for current report
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
      if (!rawMun || /^(TOTAL|REGIÃO|CAPITAL|INTERIOR)/i.test(rawMun)) break;
      const mun = canonicalMunicipio(rawMun);
      const salv = salvCol >= 0 ? num(row[salvCol]) : 0;
      const acid = acidCol >= 0 ? num(row[acidCol]) : 0;
      const aph = aphCol >= 0 ? num(row[aphCol]) : 0;
      const prev = prevCol >= 0 ? num(row[prevCol]) : 0;
      const serv = servCol >= 0 ? num(row[servCol]) : 0;
      if (!rawMun) continue;
      // Skip empty outras rows (many municipios have no entry)
      if (salv === 0 && acid === 0 && aph === 0 && prev === 0 && serv === 0) continue;

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
  out.incendios_acumulado = consolidate(out.incendios_acumulado);
  out.outras = consolidate(out.outras);

  return out;
}
