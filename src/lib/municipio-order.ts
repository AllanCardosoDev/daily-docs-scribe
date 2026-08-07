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
 * Funde linhas com o mesmo município (somando valores numéricos)
 * e garante ordenação institucional com Manaus em primeiro lugar.
 */
export function deduplicateAndOrderMunicipios<T extends Record<string, any>>(rows: T[]): T[] {
  if (!Array.isArray(rows) || rows.length === 0) return [];
  const map = new Map<string, T>();

  for (const r of rows) {
    const rawMun = r?.mun ?? r?.municipio;
    if (!rawMun) continue;
    const mun = canonicalMunicipio(rawMun);
    const key = mun.toLowerCase();

    const existing = map.get(key);
    if (!existing) {
      const copy = { ...r, mun };
      if ("municipio" in copy) delete (copy as any).municipio;
      map.set(key, copy);
    } else {
      for (const [k, v] of Object.entries(r)) {
        if (k === "mun" || k === "municipio") continue;
        const num1 = Number((existing as any)[k]) || 0;
        const num2 = Number(v) || 0;
        (existing as any)[k] = num1 + num2;
      }
    }
  }

  const result = Array.from(map.values());
  const manaus = result.filter((r) => isManaus(r?.mun));
  const rest = result.filter((r) => !isManaus(r?.mun));
  return [...manaus, ...rest];
}

/**
 * Mantém a ordem institucional (Manaus no topo) e elimina qualquer duplicidade somando os valores.
 */
export function manausFirst<T extends Record<string, any>>(rows: T[]): T[] {
  return deduplicateAndOrderMunicipios(rows);
}

/** Reordena e desduplica todas as seções municipais de um SheetsData, com Manaus no topo. */
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
    if (Array.isArray(out[s])) out[s] = deduplicateAndOrderMunicipios(out[s]);
  }
  return out as T;
}
