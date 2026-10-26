/**
 * Banco de Dados Oficial de Ocorrências (Incêndios) CBMAM.
 * Server-only.
 *
 * Fornece consultas rápidas em memória indexadas por data e município
 * a partir do banco de dados oficial de ocorrências de incêndio.
 */
import occurrencesData from "../data/occurrences.json";
import type { OccurrenceRow } from "./sheets.types";
import { canonicalMunicipio } from "./municipio-order";
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
  focos: number;
  area: number;
  agua: number;
  coordenadas?: string;
  unidade?: string;
  equipes?: string;
  narrativa?: string;
  relato?: string;
};

const allOccurrences: StoredOccurrence[] = [...(occurrencesData as StoredOccurrence[])];

export function makeOccurrenceKey(occ: Partial<StoredOccurrence>): string {
  if (occ.protocolo && occ.protocolo !== "-" && occ.protocolo.length > 3) {
    return `proto:${occ.protocolo.trim().toUpperCase()}`;
  }
  if (occ.id && occ.id.length > 5 && !occ.id.startsWith("occ-")) {
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
for (const item of allOccurrences) {
  if (!item.data) continue;
  const list = byDate.get(item.data);
  if (list) {
    list.push(item);
  } else {
    byDate.set(item.data, [item]);
  }
}

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
 * Insere novas ocorrências garantindo estritamente a não-duplicação.
 * Atualiza o índice em memória e persiste em disco.
 */
export function addOccurrences(newItems: StoredOccurrence[]): {
  insertedCount: number;
  duplicatesSkipped: number;
  datesAffected: string[];
} {
  const datesAffectedSet = new Set<string>();
  const toAdd: StoredOccurrence[] = [];
  let duplicatesSkipped = 0;

  for (const item of newItems) {
    const key = makeOccurrenceKey(item);
    if (existingKeys.has(key)) {
      duplicatesSkipped++;
      continue;
    }
    existingKeys.add(key);
    toAdd.push(item);
    if (item.data) datesAffectedSet.add(item.data);
  }

  if (toAdd.length > 0) {
    allOccurrences.unshift(...toAdd);
    for (const item of toAdd) {
      if (!item.data) continue;
      const list = byDate.get(item.data);
      if (list) {
        list.unshift(item);
      } else {
        byDate.set(item.data, [item]);
      }
    }

    try {
      const filePath = path.resolve(process.cwd(), "src/data/occurrences.json");
      fs.writeFileSync(filePath, JSON.stringify(allOccurrences, null, 2), "utf-8");
    } catch (err) {
      console.error("[occurrences-store] Erro ao persistir occurrences.json em disco:", err);
    }
  }

  return {
    insertedCount: toAdd.length,
    duplicatesSkipped,
    datesAffected: Array.from(datesAffectedSet).sort(),
  };
}

/**
 * Retorna as ocorrências de incêndio de uma data específica formatadas como OccurrenceRow.
 */
export function getOccurrencesForDate(dateIso: string): OccurrenceRow[] {
  const list = byDate.get(dateIso) ?? [];
  return list.map(toOccurrenceRow);
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
    if (item.data >= startIso && item.data <= endIso) {
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
  return allOccurrences.slice(0, limit).map(toOccurrenceRow);
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
  let list = allOccurrences;

  if (filters.date) {
    list = byDate.get(filters.date) ?? [];
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
    data: dateFormatted && dateFormatted !== "0" ? dateFormatted : "—",
    municipio: mun,
    horario: item.horario && item.horario !== "0" ? item.horario : "—",
    natureza: item.natureza && item.natureza !== "0" ? item.natureza : "Incêndio em Vegetação",
    focos: Number(item.focos) || 0,
    coordenadas: item.coordenadas && item.coordenadas !== "0" ? item.coordenadas : "—",
    endereco: end || "—",
    area: Number(item.area) || 0,
    agua: Number(item.agua) || 0,
  };
}
