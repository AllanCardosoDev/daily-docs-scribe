/**
 * Classificação institucional de ocorrências de incêndio.
 * Harmoniza as contagens entre a Sala de Situação e o painel de Incêndios Ambientais do SINESP.
 *
 * O SINESP categoriza como Incêndio Ambiental:
 * - Incêndio em Vegetação
 * - Incêndio Florestal
 * - Incêndio em Amontoado de Lixo / Entulho
 * - Queimadas em lavoura, pastagem, mata ou floresta
 *
 * Já as demais ocorrências de combate a fogo (rede elétrica, residência, comércio, veículos)
 * são classificadas como Incêndio Urbano.
 */

export function isFlorestalAmbiental(natRaw?: string | null): boolean {
  if (!natRaw) return false;
  const n = String(natRaw).toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "");

  return (
    n.includes("florest") ||
    n.includes("vegeta") ||
    n.includes("mata") ||
    n.includes("pastag") ||
    n.includes("lavoura") ||
    n.includes("palha") ||
    n.includes("lixo") ||
    n.includes("entulho") ||
    n.includes("queimada") ||
    n.includes("ambiental")
  );
}

export function isIncendio(natRaw?: string | null): boolean {
  if (!natRaw) return false;
  const n = String(natRaw).toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "");

  // Descartar apoios que não sejam combate a incêndio
  if (
    (n.includes("apoio") || n.includes("salvamento") || n.includes("samu") || n.includes("aph")) &&
    !n.includes("incendio") &&
    !n.includes("fogo") &&
    !n.includes("vegeta") &&
    !n.includes("florest")
  ) {
    return false;
  }

  return (
    n.includes("incendio") ||
    n.includes("fogo") ||
    n.includes("queimada") ||
    isFlorestalAmbiental(natRaw)
  );
}

export function classifyFire(natRaw?: string | null): "florestal" | "urbano" | "outros" {
  if (!isIncendio(natRaw)) return "outros";
  if (isFlorestalAmbiental(natRaw)) return "florestal";
  return "urbano";
}
