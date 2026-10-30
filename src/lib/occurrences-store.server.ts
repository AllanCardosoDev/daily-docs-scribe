/**
 * Banco de Dados Oficial de Ocorrências (Incêndios) CBMAM.
 * Server-only.
 *
 * Fornece consultas rápidas em memória indexadas por data e município
 * a partir do banco de dados oficial de ocorrências de incêndio.
 */
import occurrencesData from "../data/occurrences.json";
import type { OccurrenceRow } from "./sheets.types";
import { canonicalMunicipio, isNonMunicipioTroop } from "./municipio-order";
import { isIncendio } from "./fire-classification";
import fs from "fs";
import path from "path";

export type StoredOccurrence = {
  id: string;
  protocolo: string;
  data: string; // YYYY-MM-DD
  dataBr: string; // DD/MM/YYYY
  horario: string; // HH:mm
  municipio: string;
  bairro?: string;
  endereco: string;
  natureza: string;
  grupoNatureza?: string;
  situacao?: string;
  motivoFinalizacao?: string;
  focos: number;
  area: number;
  agua: number;
  coordenadas?: string;
  unidade?: string;
  equipes?: string;
  narrativa?: string;
  relato?: string;
};

// O banco de dados oficial da Operação Amazonas + Verde armazena exclusivamente
// ocorrências reais de combate a incêndio (florestal, ambiental e urbano)
// e descarta rigorosamente qualquer identificador corrompido ou tropa externa.
const allOccurrences: StoredOccurrence[] = (occurrencesData as StoredOccurrence[]).filter(
  (occ) =>
    isIncendio(occ.natureza) &&
    !isNonMunicipioTroop(occ.municipio) &&
    !/^[0-9a-f]{8}-[0-9a-f]{4}/i.test(occ.municipio) &&
    !/^[0-9a-f-]{15,}$/i.test(occ.municipio),
);

export function makeOccurrenceKey(occ: Partial<StoredOccurrence>): string {
  if (occ.protocolo && occ.protocolo !== "-" && occ.protocolo.length > 3) {
    return `proto:${occ.protocolo.trim().toUpperCase()}`;
  }
  if (occ.id && occ.id.length > 5 && !occ.id.startsWith("occ-") && !/^[0-9a-f-]{15,}$/i.test(occ.id)) {
    return `id:${occ.id.trim()}`;
  }
  const d = occ.data || "";
  const h = (occ.horario || "").slice(0, 5);
  const m = canonicalMunicipio(occ.municipio || "").toLowerCase();
  const e = (occ.endereco || "").toLowerCase().replace(/[^a-z0-9]/g, "").slice(0, 30);
  const n = (occ.natureza || "").toLowerCase().replace(/[^a-z0-9]/g, "").slice(0, 25);
  return `sig:${d}|${h}|${m}|${e}|${n}`;
}

const existingKeys = new Set<string>();
for (const item of allOccurrences) {
  existingKeys.add(makeOccurrenceKey(item));
}

// Índice por data YYYY-MM-DD para busca O(1)
const byDate = new Map<string, StoredOccurrence[]>();
function rebuildDateIndex() {
  byDate.clear();
  for (const item of allOccurrences) {
    if (!item.data) continue;
    const list = byDate.get(item.data);
    if (list) {
      list.push(item);
    } else {
      byDate.set(item.data, [item]);
    }
  }
}
rebuildDateIndex();

/**
 * Retorna todas as datas ordenadas (YYYY-MM-DD) disponíveis no banco de ocorrências.
 */
export function getAvailableDates(): string[] {
  return Array.from(byDate.keys()).sort();
}

/**
 * Retorna a data mais recente com ocorrências registradas.
 */
export function getLatestOccurrenceDate(): string | null {
  const dates = getAvailableDates();
  return dates.length > 0 ? dates[dates.length - 1] : null;
}

/**
 * Verifica se houve qualquer alteração ou retificação de dados entre o registro
 * já existente no banco e a nova linha importada (ex: área modificada, focos, água, etc.)
 */
function hasOccurrenceChanged(existing: StoredOccurrence, item: StoredOccurrence): boolean {
  // 1. Numéricos vitais: área queimada (se modificada, atualiza!), focos combatidos, água consumida
  if (item.area !== undefined && item.area !== null && Number(item.area) !== Number(existing.area)) {
    return true;
  }
  if (item.focos !== undefined && item.focos !== null && Number(item.focos) !== Number(existing.focos)) {
    return true;
  }
  if (item.agua !== undefined && item.agua !== null && Number(item.agua) !== Number(existing.agua)) {
    return true;
  }

  // 2. Município: retificação de nome ou saneamento de UUID / tropa inválida
  const existingHasBadMun = isNonMunicipioTroop(existing.municipio) || /^[0-9a-f-]{10,}$/i.test(existing.municipio);
  if (existingHasBadMun) return true;
  if (item.municipio && item.municipio !== existing.municipio && !isNonMunicipioTroop(item.municipio)) {
    return true;
  }

  // 3. Localização detalhada
  if (item.endereco && item.endereco !== "-" && item.endereco !== existing.endereco) {
    return true;
  }
  if (item.bairro && item.bairro !== "-" && item.bairro !== existing.bairro) {
    return true;
  }
  if (item.coordenadas && item.coordenadas !== "-" && item.coordenadas !== existing.coordenadas) {
    return true;
  }

  // 4. Detalhes operacionais: natureza, horário, viaturas, equipes, narrativa
  if (item.natureza && item.natureza !== existing.natureza) {
    return true;
  }
  if (item.horario && item.horario !== existing.horario) {
    return true;
  }
  if (item.unidade && item.unidade !== existing.unidade) {
    return true;
  }
  if (item.equipes && item.equipes !== existing.equipes) {
    return true;
  }
  if (item.narrativa && item.narrativa !== existing.narrativa) {
    return true;
  }
  if (item.relato && item.relato !== existing.relato) {
    return true;
  }

  return false;
}

export interface AddOccurrencesResult {
  insertedCount: number;
  updatedCount: number;
  duplicatesSkipped: number;
  datesAffected: string[];
}

/**
 * Insere novas ocorrências ou atualiza registros existentes que tiveram
 * valores modificados (área, focos, água, endereço, etc.).
 * Atualiza o índice em memória e persiste em disco.
 */
export function addOccurrences(newItems: StoredOccurrence[]): AddOccurrencesResult {
  const datesAffectedSet = new Set<string>();
  const toAdd: StoredOccurrence[] = [];
  let duplicatesSkipped = 0;
  let updatedCount = 0;

  for (const item of newItems) {
    if (!isIncendio(item.natureza)) continue;
    // Descarta estritamente se município for UUID ou tropa externa
    if (isNonMunicipioTroop(item.municipio)) continue;
    if (/^[0-9a-f]{8}-[0-9a-f]{4}/i.test(item.municipio) || /^[0-9a-f-]{15,}$/i.test(item.municipio)) {
      continue;
    }

    const key = makeOccurrenceKey(item);
    const existingIndex = allOccurrences.findIndex((ex) => {
      if (item.protocolo && item.protocolo !== "-" && ex.protocolo && ex.protocolo !== "-") {
        return ex.protocolo.trim().toUpperCase() === item.protocolo.trim().toUpperCase();
      }
      if (item.id && ex.id && !item.id.startsWith("occ-") && !ex.id.startsWith("occ-")) {
        return ex.id.trim() === item.id.trim();
      }
      return makeOccurrenceKey(ex) === key;
    });

    if (existingIndex >= 0) {
      const existing = allOccurrences[existingIndex];
      const hasChanged = hasOccurrenceChanged(existing, item);

      if (hasChanged) {
        allOccurrences[existingIndex] = {
          ...existing,
          ...item,
          id: existing.id || item.id,
          municipio: item.municipio || existing.municipio,
          area: Number(item.area) || 0,
          focos: Number(item.focos) || existing.focos || 1,
          agua: Number(item.agua) || 0,
        };
        updatedCount++;
        if (item.data) datesAffectedSet.add(item.data);
        if (existing.data) datesAffectedSet.add(existing.data);
      } else {
        duplicatesSkipped++;
      }
      continue;
    }

    existingKeys.add(key);
    toAdd.push(item);
    if (item.data) datesAffectedSet.add(item.data);
  }

  if (toAdd.length > 0 || updatedCount > 0) {
    if (toAdd.length > 0) {
      allOccurrences.unshift(...toAdd);
    }
    rebuildDateIndex();

    try {
      const filePath = path.resolve(process.cwd(), "src/data/occurrences.json");
      fs.writeFileSync(filePath, JSON.stringify(allOccurrences, null, 2), "utf-8");
    } catch (err) {
      console.error("[occurrences-store] Erro ao persistir occurrences.json em disco:", err);
    }
  }

  return {
    insertedCount: toAdd.length,
    updatedCount,
    duplicatesSkipped,
    datesAffected: Array.from(datesAffectedSet).sort(),
  };
}

/**
 * Retorna as ocorrências de incêndio de uma data específica formatadas como OccurrenceRow.
 */
export function getOccurrencesForDate(dateIso: string): OccurrenceRow[] {
  const list = byDate.get(dateIso) ?? [];
  return list.filter((occ) => isIncendio(occ.natureza)).map(toOccurrenceRow);
}

/**
 * Retorna as ocorrências de incêndio de um intervalo de datas formatadas como OccurrenceRow.
 */
export function getOccurrencesForRange(
  startIso: string,
  endIso: string,
  limit = 2000,
): OccurrenceRow[] {
  const result: OccurrenceRow[] = [];
  for (const item of allOccurrences) {
    if (item.data >= startIso && item.data <= endIso && isIncendio(item.natureza)) {
      result.push(toOccurrenceRow(item));
      if (result.length >= limit) break;
    }
  }
  return result;
}

/**
 * Retorna todas ou as N mais recentes ocorrências de incêndio.
 */
export function getRecentOccurrences(limit = 200): OccurrenceRow[] {
  return allOccurrences.filter((occ) => isIncendio(occ.natureza)).slice(0, limit).map(toOccurrenceRow);
}

/**
 * Busca flexível de ocorrências com filtros.
 */
export function searchOccurrences(filters: {
  municipio?: string;
  date?: string;
  startDate?: string;
  endDate?: string;
  query?: string;
  limit?: number;
  offset?: number;
}): { rows: StoredOccurrence[]; total: number } {
  let list = allOccurrences.filter((r) => isIncendio(r.natureza));

  if (filters.date) {
    list = (byDate.get(filters.date) ?? []).filter((r) => isIncendio(r.natureza));
  } else if (filters.startDate && filters.endDate) {
    list = list.filter((r) => r.data >= filters.startDate! && r.data <= filters.endDate!);
  }

  if (filters.municipio && filters.municipio !== "todos") {
    const target = canonicalMunicipio(filters.municipio).toLowerCase();
    list = list.filter((r) => canonicalMunicipio(r.municipio).toLowerCase() === target);
  }

  if (filters.query) {
    const q = filters.query.toLowerCase();
    list = list.filter(
      (r) =>
        r.natureza.toLowerCase().includes(q) ||
        r.municipio.toLowerCase().includes(q) ||
        r.endereco.toLowerCase().includes(q) ||
        r.protocolo.toLowerCase().includes(q),
    );
  }

  const total = list.length;
  const offset = filters.offset ?? 0;
  const limit = filters.limit ?? 200;
  const rows = list.slice(offset, offset + limit);

  return { rows, total };
}

function toOccurrenceRow(item: StoredOccurrence): OccurrenceRow {
  const rawMun = item.municipio || (item as any).mun;
  const mun = rawMun && String(rawMun).trim() !== "" ? canonicalMunicipio(rawMun) : "Manaus";
  const rawDate = item.dataBr || item.data || "";
  let dateFormatted = String(rawDate);
  if (/^\d{4}-\d{2}-\d{2}$/.test(dateFormatted)) {
    const [y, m, d] = dateFormatted.split("-");
    dateFormatted = `${d}/${m}/${y}`;
  }
  const end = item.endereco && item.endereco !== "—" && item.endereco !== "-" && item.endereco !== "0"
    ? item.endereco
    : item.bairro ? `${item.bairro}, ${mun}` : mun;

  return {
    id: item.id,
    protocolo: item.protocolo && item.protocolo !== "-" ? item.protocolo : undefined,
    data: dateFormatted && dateFormatted !== "0" ? dateFormatted : "—",
    municipio: mun,
    horario: item.horario && item.horario !== "0" ? item.horario : "—",
    natureza: item.natureza && item.natureza !== "0" ? item.natureza : "Incêndio em Vegetação",
    focos: Number(item.focos) || 0,
    coordenadas: item.coordenadas && item.coordenadas !== "0" ? item.coordenadas : "—",
    endereco: end || "—",
    area: Number(item.area) || 0,
    agua: Number(item.agua) || 0,
    bairro: item.bairro,
    grupoNatureza: item.grupoNatureza,
    situacao: item.situacao,
    motivoFinalizacao: item.motivoFinalizacao,
    unidade: item.unidade,
    equipes: item.equipes,
    narrativa: item.narrativa,
    relato: item.relato,
  };
}
