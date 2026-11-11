/**
 * Classificação institucional de ocorrências de incêndio — Operação Amazonas + Verde.
 *
 * Harmoniza as contagens entre a Sala de Situação, SINESP e o CAD/CIODS do CBMAM.
 *
 * Regras Institucionais:
 *
 * 1. Florestais:
 *    - Incêndio florestal;
 *    - Incêndio em vegetação;
 *    - Incêndio em lavoura, pastagem, mata ou floresta;
 *    - Incêndio em amontoado de lixo/entulho, lixo ou lixão;
 *    - Registros combinados que incluam uma dessas naturezas (ex: lixo/entulho junto com vegetação).
 *
 * 2. Urbanos:
 *    - Entram as demais naturezas de combate a incêndio:
 *      * Residências e edificações: casas, edifícios, prédios públicos, escolas, hospitais;
 *      * Comércio e indústria: estabelecimentos comerciais/serviço, fábricas, estaleiros, oficinas;
 *      * Rede elétrica e fiação: fios de energia/telefonia danificados com fogo;
 *      * Veículos e transportes: carros, embarcações, aeronaves;
 *      * Depósitos, distribuidoras e postos de combustível;
 *      * Outros tipos de incêndio / incêndio genérico / princípio de incêndio sem vegetação/lixo.
 *
 * 3. Exclusões estritas (NÃO entram na contagem de incêndios):
 *    - Ações preventivas a incêndio florestal, ações de prevenção contra incêndio;
 *    - Vistorias, monitoramentos, orientações preventivas, policiamento;
 *    - Testes de sistema, simulados, treinamentos, trotes;
 *    - Finalizações automáticas por inatividade, falsos alarmes;
 *    - Serviços técnicos, resgates, APH, captura de animais e apoios sem registro de combate a incêndio.
 */

function norm(s?: string | null): string {
  if (!s) return "";
  return String(s)
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .trim();
}

/**
 * Identifica se a natureza é classificada como Incêndio Florestal / Ambiental
 * (vegetação, floresta, mata, pastagem, lavoura, lixo, entulho, lixão ou combinados).
 */
export function isFlorestalAmbiental(natRaw?: string | null): boolean {
  if (!natRaw) return false;
  const n = norm(natRaw);

  return (
    n.includes("florest") ||
    n.includes("vegeta") ||
    n.includes("mata") ||
    n.includes("pastag") ||
    n.includes("lavoura") ||
    n.includes("palha") ||
    n.includes("lixo") ||
    n.includes("entulho") ||
    n.includes("lixao") ||
    n.includes("queimada") ||
    n.includes("ambiental")
  );
}

/**
 * Identifica eventos não-incêndio (ações preventivas, testes, monitoramentos, etc.)
 * que devem ser excluídos da contagem de combate a incêndio ocorrido.
 */
export function isNonFireActivity(natRaw?: string | null): boolean {
  if (!natRaw) return true;
  const n = norm(natRaw);
  if (!n || n === "-" || n === "null" || n === "undefined") return true;

  // 1. Testes de sistema, trotes, simulados, treinamentos e finalizações automáticas
  if (
    n.includes("teste de sistema") ||
    n.includes("teste") ||
    n.includes("simulado") ||
    n.includes("treinamento") ||
    n.includes("trote") ||
    n.includes("finalizacao automatica") ||
    n.includes("falso alarme") ||
    n.includes("falso alarma")
  ) {
    return true;
  }

  // 2. Ações preventivas, orientações, vistorias e monitoramentos (mesmo que mencionem incêndio florestal)
  if (
    n.startsWith("acao preventiva") ||
    n.startsWith("acoes de prevencao") ||
    n.startsWith("orientacao preventiva") ||
    n.startsWith("monitoramento de") ||
    n.startsWith("monitoramento") ||
    n.startsWith("vistoria") ||
    n.startsWith("pericia") ||
    n.startsWith("policiamento") ||
    n.startsWith("prevencao")
  ) {
    return true;
  }

  // 3. Atividades de apoio, resgate, APH, captura de animais, vazamento sem incêndio
  if (
    n.startsWith("apoio") ||
    n.startsWith("salvamento") ||
    n.startsWith("atendimento pre-hospitalar") ||
    n.startsWith("emergencia medica") ||
    n.startsWith("sinistro de transito") ||
    n.startsWith("acidente") ||
    n.startsWith("captura") ||
    n.startsWith("animal") ||
    n.startsWith("vazamento") ||
    n.startsWith("corte de") ||
    n.startsWith("obstrucao") ||
    n.startsWith("queda de arvore") ||
    n.startsWith("servicos tecnicos") ||
    n.startsWith("comunicacao") ||
    n.startsWith("acionamento") ||
    n.startsWith("conflitos") ||
    n.startsWith("desaparecimento") ||
    n.startsWith("injuria") ||
    n.startsWith("abandono")
  ) {
    // Só seria considerado se houver indicação de incêndio real em registro combinado
    if (!n.includes("incendio") && !n.includes("fogo") && !isFlorestalAmbiental(natRaw)) {
      return true;
    }
  }

  return false;
}

/**
 * Valida se um registro corresponde a um combate efetivo a incêndio.
 */
export function isIncendio(natRaw?: string | null): boolean {
  if (!natRaw) return false;
  const n = norm(natRaw);
  if (!n || n === "-" || n === "null" || n === "undefined") return false;

  // Descartar preventivos, testes, simulados e não-incêndios
  if (isNonFireActivity(natRaw)) {
    return false;
  }

  return (
    n.includes("incendio") ||
    n.includes("fogo") ||
    n.includes("queimada") ||
    isFlorestalAmbiental(natRaw)
  );
}

/**
 * Classifica a ocorrência em 'florestal', 'urbano' ou 'outros' (para descarte).
 * Regra: se houver qualquer marcador florestal/rural/lixo/entulho, classifica como 'florestal'.
 * Demais incêndios válidos classificam como 'urbano'.
 */
export function classifyFire(natRaw?: string | null): "florestal" | "urbano" | "outros" {
  if (!isIncendio(natRaw)) return "outros";
  if (isFlorestalAmbiental(natRaw)) return "florestal";
  return "urbano";
}
