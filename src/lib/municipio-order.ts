/**
 * Ordenação institucional de municípios.
 * Manaus é a capital e sede do Comando Integrado — deve aparecer sempre
 * na primeira linha de qualquer planilha, tabela ou relatório.
 */

const CANONICAL_MUNICIPIOS: Record<string, string> = {
  "boca de acre": "Boca do Acre",
  "boca do acre": "Boca do Acre",
  "uricurituba": "Urucurituba",
  "urucurituba": "Urucurituba",
  "careiro da varzea": "Careiro da Várzea",
  "careiro da várzea": "Careiro da Várzea",
  "benjamim constant": "Benjamin Constant",
  "benjamin constant": "Benjamin Constant",
  "sao gabriel da cachoeira": "São Gabriel da Cachoeira",
  "são gabriel da cachoeira": "São Gabriel da Cachoeira",
  "sao paulo de olivenca": "São Paulo de Olivença",
  "são paulo de olivença": "São Paulo de Olivença",
  "santo antonio do ica": "Santo Antônio do Içá",
  "santo antônio do içá": "Santo Antônio do Içá",
  "santa isabel do rio negro": "Santa Isabel do Rio Negro",
};

export function canonicalMunicipio(mun: unknown): string {
  const s = String(mun ?? "").trim();
  if (!s) return "—";
  const normKey = s
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase();
  return CANONICAL_MUNICIPIOS[normKey] || s;
}

const norm = (v: unknown) =>
  String(v ?? "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .trim()
    .toLowerCase();

export const isManaus = (mun: unknown) => norm(mun) === "manaus";

/** Comparador: Manaus primeiro, demais em ordem alfabética (pt-BR). */
export function compareMunicipios(a: unknown, b: unknown) {
  const ca = canonicalMunicipio(a);
  const cb = canonicalMunicipio(b);
  const am = isManaus(ca);
  const bm = isManaus(cb);
  if (am !== bm) return am ? -1 : 1;
  return ca.localeCompare(cb, "pt-BR");
}

/** Ordena alfabeticamente com Manaus no topo. */
export function sortByMunicipio<T extends { mun?: unknown }>(rows: T[]): T[] {
  return [...rows].sort((a, b) => compareMunicipios(a?.mun, b?.mun));
}

/**
 * Mantém a ordem original das linhas, apenas promovendo Manaus ao topo.
 * Usado onde a sequência de digitação deve ser preservada.
 */
export function manausFirst<T extends { mun?: unknown }>(rows: T[]): T[] {
  const manaus = rows.filter((r) => isManaus(r?.mun));
  if (!manaus.length) return rows;
  return [...manaus, ...rows.filter((r) => !isManaus(r?.mun))];
}

/** Reordena todas as seções municipais de um SheetsData, com Manaus no topo. */
export function manausFirstSheets<T extends Record<string, any>>(data: T): T {
  const sections = [
    "efetivo",
    "recursos",
    "incendios_diario",
    "incendios_acumulado",
    "outras_diarias",
    "occurrences",
  ] as const;
  const out: Record<string, any> = { ...data };
  for (const s of sections) {
    if (Array.isArray(out[s])) out[s] = manausFirst(out[s]);
  }
  return out as T;
}
