/**
 * Client-side CSV Parser & Normalizer para grandes arquivos de ocorrências CAD do CBMAM.
 * Permite que arquivos de até 50MB sejam processados no navegador e enviados em lotes seguros,
 * contornando os limites de payload (4.5MB) de funções serverless na nuvem.
 */
import { canonicalMunicipio, isNonMunicipioTroop } from "./municipio-order";
import { isIncendio } from "./fire-classification";
import type { StoredOccurrence } from "./occurrences-store.server";

const MONTH_MAP: Record<string, string> = {
  jan: "01", fev: "02", mar: "03", abr: "04", mai: "05", jun: "06",
  jul: "07", ago: "08", set: "09", out: "10", nov: "11", dez: "12",
  oct: "10", dec: "12", feb: "02", apr: "04", may: "05", aug: "08", sep: "09",
};

export function parseDateClient(rawStr: string): { iso: string; br: string; time: string } | null {
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

  // Ex: "Oct 25, 2026 @ 19:56:00.000" ou "Nov 12, 2026 @ 17:05:00.000"
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
  if (/[a-zA-Z]/.test(s)) return 0;
  const cleaned = s.replace(/[^0-9.,-]/g, "").replace(",", ".");
  const n = parseFloat(cleaned);
  return isNaN(n) ? 0 : Math.abs(n);
}

export function parseCSVClient(text: string): string[][] {
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

export function extractFireOccurrencesFromCsv(csvText: string): StoredOccurrence[] {
  const rawRows = parseCSVClient(csvText);
  if (rawRows.length < 2) return [];

  const normKey = (s: unknown) =>
    String(s ?? "")
      .toLowerCase()
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "")
      .replace(/[^a-z0-9]/g, "");

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
    const exact = header.findIndex((h) => normalizedKeys.includes(h));
    if (exact >= 0) return exact;
    return header.findIndex((h) =>
      normalizedKeys.some((k) => k.length >= 4 && h.includes(k)),
    );
  };

  const idxId = colIndex(["id", "uuid", "codigo", "cid", "_id"]);
  const idxProtocolo = colIndex(["nrprotocolo", "protocolo", "numero", "nº"]);
  const idxDataHoraFato = colIndex(["datahorafato", "data/hora fato", "data/hora do fato", "data hora fato"]);
  const idxDataFato = colIndex(["datafato", "data fato", "data do fato"]);
  const idxDataFinalizacao = colIndex(["datahorafinalizacaobrt", "datahorafinalizacao"]);
  const idxDataReg = colIndex(["datahoraregistroutc", "data registro", "data/hora registro"]);
  const idxDataGeneric = colIndex(["data", "dia"]);
  const idxHora = colIndex(["hora", "horário", "horario"]);
  const idxMunicipio = colIndex(["nomemunicipio", "municipio", "cidade"]);
  const idxBairro = colIndex(["bairro"]);
  const idxEndereco = colIndex(["logradouro", "endereco", "endereço", "rua"]);
  const idxNaturezaFinal = colIndex(["naturezafinalizacaoobjectnomenaturezafinal", "naturezasfinais"]);
  const idxNaturezaInicial = colIndex(["naturezainicialdescricao", "natureza", "evento", "ocorrência", "ocorrencia"]);
  const idxTipo = colIndex(["naturezafinalizacaoobjectnomegruponatureza", "tipo"]);
  const idxFocos = colIndex([
    "gruposadicionaisdadosincendioflorestalvegetacaodadosincendioflorestalvegetacaonumerofocoscombatidos",
    "numerofocoscombatidos",
    "focoscombatidos",
    "focos",
  ]);
  const idxArea = colIndex([
    "gruposadicionaisdadosincendioflorestalvegetacaodadosincendioflorestalvegetacaoareaqueimadacombatidaha",
    "areaqueimadacombatidaha",
    "areaqueimada",
    "areacombatida",
    "aream2",
    "area",
  ]);
  const idxAgua = colIndex(["litrosdeagua", "litrosagua", "litros", "água", "agua"]);
  const idxCoords = colIndex(["coordenadas", "coordenada", "localização", "coords"]);
  const idxLat = colIndex(["latitude", "lat"]);
  const idxLon = colIndex(["longitude", "lon", "lng"]);
  const idxUnidade = colIndex(["filtronomeunidadeservico", "unidade", "batalhão", "batalhao"]);
  const idxNarrativa = colIndex(["narrativa", "histórico", "historico", "descrição", "descricao"]);
  const idxRelato = colIndex(["relatosrelato", "relatos", "relato"]);

  const fireOccurrences: StoredOccurrence[] = [];

  for (let i = headerRowIndex + 1; i < rawRows.length; i++) {
    const row = rawRows[i];
    if (!row || row.length === 0 || row.every((c) => !c)) continue;

    const rawNatFinal = cleanStr(idxNaturezaFinal >= 0 ? row[idxNaturezaFinal] : "");
    const rawNatInicial = cleanStr(idxNaturezaInicial >= 0 ? row[idxNaturezaInicial] : "");
    const rawNatureza = rawNatFinal || rawNatInicial || "";
    const rawTipo = cleanStr(idxTipo >= 0 ? row[idxTipo] : "");
    const rawNarrativa = cleanStr(idxNarrativa >= 0 ? row[idxNarrativa] : "");
    const rawRelato = cleanStr(idxRelato >= 0 ? row[idxRelato] : "");

    if (!isIncendio(rawNatureza) && !isIncendio(rawTipo)) {
      continue;
    }

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
        parsedDate = parseDateClient(String(cand));
        if (parsedDate) break;
      }
    }

    if (!parsedDate) continue;

    let timeStr = parsedDate.time;
    if ((!timeStr || timeStr === "—" || timeStr === "00:00") && idxDataHoraFato >= 0) {
      const pFato = parseDateClient(String(row[idxDataHoraFato]));
      if (pFato && pFato.time && pFato.time !== "—" && pFato.time !== "00:00") {
        timeStr = pFato.time;
      }
    }
    if ((!timeStr || timeStr === "—" || timeStr === "00:00") && idxHora >= 0) {
      const hCand = cleanStr(row[idxHora]);
      if (hCand && hCand.includes(":")) timeStr = hCand.slice(0, 5);
    }

    let munRaw = cleanStr(idxMunicipio >= 0 ? row[idxMunicipio] : "");
    if (
      !munRaw ||
      munRaw.length > 35 ||
      /^[0-9a-f]{8}-[0-9a-f]{4}/i.test(munRaw) ||
      /^[0-9a-f-]{10,}$/i.test(munRaw) ||
      isNonMunicipioTroop(munRaw)
    ) {
      munRaw = "Manaus";
    }

    const municipio = canonicalMunicipio(munRaw);
    const bairro = cleanStr(idxBairro >= 0 ? row[idxBairro] : "");
    let endereco = cleanStr(idxEndereco >= 0 ? row[idxEndereco] : "");
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

    const combinedContext = `${rawNarrativa} ${rawRelato}`;
    if (focos <= 0) {
      const fMatch = combinedContext.match(/(?:apresentando|com|total(?:izando)?\s*de|havia)?\s*(\d+)\s*focos?/i);
      focos = fMatch ? parseInt(fMatch[1], 10) : 1;
    }
    if (area <= 0) {
      const aMatch = combinedContext.match(/(?:área|area)(?:\s*(?:queimada|afetada))?[^0-9]{0,25}([\d.,]+)\s*(m²|m2|ha|hectares?|metros)/i);
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
      const wMatch = combinedContext.match(/(?:gastos?|utilizad[oa]s?|uso\s*de)?\s*([\d.,]+)\s*(?:mil\s*)?(?:litros|l)/i);
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
      coordenadas = `${cleanStr(row[idxLat]).replace(",", ".")}, ${cleanStr(row[idxLon]).replace(",", ".")}`;
    }

    const protocolo = cleanStr(idxProtocolo >= 0 ? row[idxProtocolo] : "");
    const id = cleanStr(idxId >= 0 ? row[idxId] : (protocolo ? `CAD-${protocolo}` : `occ-${Date.now()}-${i}`));

    fireOccurrences.push({
      id,
      protocolo: protocolo || "—",
      data: parsedDate.iso,
      dataBr: parsedDate.br,
      horario: timeStr || "—",
      municipio,
      bairro: bairro || undefined,
      endereco: endereco || "—",
      natureza: rawNatureza || rawTipo || "Incêndio em Vegetação",
      focos,
      area,
      agua,
      coordenadas: coordenadas || undefined,
      unidade: cleanStr(idxUnidade >= 0 ? row[idxUnidade] : "") || undefined,
      narrativa: rawNarrativa ? rawNarrativa.slice(0, 300) : undefined,
    });
  }

  return fireOccurrences;
}
