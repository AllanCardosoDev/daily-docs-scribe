import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireBackendAuth } from "@/integrations/backend/auth-middleware";
import type {
  PainelDoFogoEvento,
  PainelDoFogoFoco,
  PainelDoFogoPrioridade,
  PainelDoFogoDeteccao,
  PainelDoFogoCar,
  PainelDoFogoMunicipioIbge,
  PainelDoFogoOverviewResponse,
  RankingMunicipioFogo,
  AreaProtegidaFogo,
} from "./painel-do-fogo.types";

const CENSIPAM_BASE = "https://panorama.sipam.gov.br";

// Bounding Box Geográfico Oficial do Estado do Amazonas (EPSG:4674 - SIRGAS 2000)
export const AMAZONAS_BBOX = {
  minLat: -9.85,
  maxLat: 2.26,
  minLon: -73.80,
  maxLon: -56.09,
};

export function isInAmazonas(lon: number, lat: number): boolean {
  return (
    lat >= AMAZONAS_BBOX.minLat &&
    lat <= AMAZONAS_BBOX.maxLat &&
    lon >= AMAZONAS_BBOX.minLon &&
    lon <= AMAZONAS_BBOX.maxLon
  );
}

// Centroides geográficos dos 62 municípios do Amazonas para cálculo de proximidade e consolidação
export const AMAZONAS_MUNICIPALITY_CENTROIDS: Array<{ nome: string; lat: number; lon: number }> = [
  { nome: "Alvarães", lat: -3.6991, lon: -65.2442 },
  { nome: "Amaturá", lat: -3.4141, lon: -68.0044 },
  { nome: "Anamã", lat: -3.5216, lon: -61.931 },
  { nome: "Anori", lat: -4.1554, lon: -62.3412 },
  { nome: "Apuí", lat: -7.3205, lon: -59.8509 },
  { nome: "Atalaia do Norte", lat: -5.0298, lon: -71.8597 },
  { nome: "Autazes", lat: -3.8863, lon: -59.5761 },
  { nome: "Barcelos", lat: -0.2185, lon: -63.5358 },
  { nome: "Barreirinha", lat: -2.8582, lon: -57.2693 },
  { nome: "Benjamin Constant", lat: -4.7176, lon: -69.8533 },
  { nome: "Beruri", lat: -4.2641, lon: -61.6441 },
  { nome: "Boa Vista do Ramos", lat: -2.8718, lon: -57.5956 },
  { nome: "Boca do Acre", lat: -8.8475, lon: -67.4332 },
  { nome: "Borba", lat: -5.1098, lon: -60.0573 },
  { nome: "Caapiranga", lat: -3.4831, lon: -61.4285 },
  { nome: "Canutama", lat: -7.0398, lon: -64.4449 },
  { nome: "Carauari", lat: -5.0717, lon: -67.2475 },
  { nome: "Careiro", lat: -3.8617, lon: -60.2797 },
  { nome: "Careiro da Várzea", lat: -3.3768, lon: -59.9888 },
  { nome: "Coari", lat: -4.4069, lon: -63.7844 },
  { nome: "Codajás", lat: -3.8967, lon: -62.3276 },
  { nome: "Eirunepé", lat: -6.7441, lon: -69.9678 },
  { nome: "Envira", lat: -7.4947, lon: -70.1873 },
  { nome: "Fonte Boa", lat: -2.7163, lon: -66.1969 },
  { nome: "Guajará", lat: -7.5323, lon: -72.6713 },
  { nome: "Humaitá", lat: -7.5913, lon: -62.7766 },
  { nome: "Ipixuna", lat: -7.2144, lon: -71.4939 },
  { nome: "Iranduba", lat: -3.2798, lon: -60.4075 },
  { nome: "Itacoatiara", lat: -2.9972, lon: -58.7496 },
  { nome: "Itamarati", lat: -6.4172, lon: -68.3245 },
  { nome: "Itapiranga", lat: -2.6277, lon: -58.2618 },
  { nome: "Japurá", lat: -1.7247, lon: -67.7538 },
  { nome: "Juruá", lat: -3.5358, lon: -66.3986 },
  { nome: "Jutaí", lat: -3.9877, lon: -67.4321 },
  { nome: "Lábrea", lat: -7.6322, lon: -65.4194 },
  { nome: "Manacapuru", lat: -3.2435, lon: -60.8247 },
  { nome: "Manaquiri", lat: -3.7224, lon: -60.4287 },
  { nome: "Manaus", lat: -2.7967, lon: -60.4936 },
  { nome: "Manicoré", lat: -6.4421, lon: -61.5034 },
  { nome: "Maraã", lat: -2.0157, lon: -65.4988 },
  { nome: "Maués", lat: -4.3871, lon: -57.7785 },
  { nome: "Nhamundá", lat: -2.0369, lon: -57.1423 },
  { nome: "Nova Olinda do Norte", lat: -3.8821, lon: -59.0798 },
  { nome: "Novo Airão", lat: -2.3912, lon: -61.2785 },
  { nome: "Novo Aripuanã", lat: -5.7334, lon: -60.5218 },
  { nome: "Parintins", lat: -2.6398, lon: -56.7135 },
  { nome: "Pauini", lat: -7.7844, lon: -67.3195 },
  { nome: "Presidente Figueiredo", lat: -1.8214, lon: -60.0528 },
  { nome: "Rio Preto da Eva", lat: -2.6644, lon: -59.6385 },
  { nome: "Santa Isabel do Rio Negro", lat: -0.2741, lon: -65.1764 },
  { nome: "Santo Antônio do Içá", lat: -2.9348, lon: -68.7495 },
  { nome: "São Gabriel da Cachoeira", lat: 0.1258, lon: -67.2144 },
  { nome: "São Paulo de Olivença", lat: -3.6738, lon: -69.2144 },
  { nome: "São Sebastião do Uatumã", lat: -2.3789, lon: -58.2618 },
  { nome: "Silves", lat: -2.7389, lon: -58.4618 },
  { nome: "Tabatinga", lat: -4.1844, lon: -69.9385 },
  { nome: "Tapauá", lat: -5.8741, lon: -63.7844 },
  { nome: "Tefé", lat: -3.6338, lon: -64.7144 },
  { nome: "Tonantins", lat: -2.8738, lon: -67.7985 },
  { nome: "Uarini", lat: -3.1238, lon: -65.3444 },
  { nome: "Urucará", lat: -2.1489, lon: -57.8718 },
  { nome: "Urucurituba", lat: -2.9189, lon: -57.9818 },
];

export function findNearestAmazonasMunicipio(lat: number, lon: number): string {
  let nearest = "Amazonas";
  let minDist = Infinity;
  for (const m of AMAZONAS_MUNICIPALITY_CENTROIDS) {
    const dLat = lat - m.lat;
    const dLon = lon - m.lon;
    const distSq = dLat * dLat + dLon * dLon;
    if (distSq < minDist) {
      minDist = distSq;
      nearest = m.nome;
    }
  }
  return nearest;
}

// Cache em memória com TTL de 90 segundos para evitar sobrecarga na API pública do CENSIPAM
interface CacheEntry<T> {
  data: T;
  timestamp: number;
}
const cacheStore = new Map<string, CacheEntry<any>>();
const CACHE_TTL_MS = 90_000;

async function fetchWithTimeout(url: string, timeoutMs = 12000): Promise<any> {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const res = await fetch(url, {
      signal: controller.signal,
      headers: {
        Accept: "application/json",
        "User-Agent": "CBMAM-SalaDeSituacao/1.0",
      },
    });
    if (!res.ok) {
      throw new Error(`HTTP ${res.status}: ${res.statusText}`);
    }
    return await res.json();
  } finally {
    clearTimeout(timeoutId);
  }
}

// =============================================================================
// SERVER FUNCTION: Overview Completo de Focos e Eventos no Amazonas
// =============================================================================

export const getPainelDoFogoOverview = createServerFn({ method: "GET" })
  .middleware([requireBackendAuth])
  .validator((raw: unknown) =>
    z
      .object({
        data: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
        horas: z.number().int().min(1).max(168).default(24),
        municipio: z.string().optional(),
      })
      .parse(raw ?? {}),
  )
  .handler(async ({ data: input }) => {
    const cacheKey = `focos_am_${input.data || "latest"}_${input.horas}`;
    const cached = cacheStore.get(cacheKey);
    if (cached && Date.now() - cached.timestamp < CACHE_TTL_MS) {
      return cached.data as PainelDoFogoOverviewResponse;
    }

    const dataParam = input.data ? `&data=${input.data}` : "";
    const horasParam = `horas=${input.horas}`;

    // Dispara requisições paralelas para todos os endpoints relevantes da API do Painel do Fogo
    const [eventosRes, censipamRes, firmsRes, prioridadesRes, munIbgeRes] = await Promise.allSettled([
      fetchWithTimeout(`${CENSIPAM_BASE}/painel-do-fogo/api/v1/eventos?sigla_estado=AM`),
      fetchWithTimeout(`${CENSIPAM_BASE}/painel-do-fogo/api/v1/focos/censipam?${horasParam}${dataParam}`),
      fetchWithTimeout(`${CENSIPAM_BASE}/painel-do-fogo/api/v1/focos/firms?${horasParam}${dataParam}`),
      fetchWithTimeout(`${CENSIPAM_BASE}/painel-do-fogo/api/v1/eventos/prioridades?limite=250`),
      fetchWithTimeout(`${CENSIPAM_BASE}/painel-do-fogo/api/v1/ibge/estados/AM/municipios`),
    ]);

    const rawEventos: PainelDoFogoEvento[] = eventosRes.status === "fulfilled" && Array.isArray(eventosRes.value) ? eventosRes.value : [];
    const rawCensipam: PainelDoFogoFoco[] = censipamRes.status === "fulfilled" && Array.isArray(censipamRes.value) ? censipamRes.value : [];
    const rawFirms: PainelDoFogoFoco[] = firmsRes.status === "fulfilled" && Array.isArray(firmsRes.value) ? firmsRes.value : [];
    const rawPrioridades: PainelDoFogoPrioridade[] = prioridadesRes.status === "fulfilled" && Array.isArray(prioridadesRes.value) ? prioridadesRes.value : [];
    const rawMunIbge: PainelDoFogoMunicipioIbge[] = munIbgeRes.status === "fulfilled" && Array.isArray(munIbgeRes.value) ? munIbgeRes.value : [];

    // 1. Filtragem e Enriquecimento dos Focos de Calor (apenas dentro do território do Amazonas)
    const focosAM: PainelDoFogoFoco[] = [];
    const seenCoords = new Set<string>();

    for (const f of [...rawCensipam, ...rawFirms]) {
      const coords = f.geom?.coordinates;
      if (!coords || coords.length < 2) continue;
      const [lon, lat] = coords;
      if (!isInAmazonas(lon, lat)) continue;

      // Deduplicação espacial/temporal fina
      const key = `${lon.toFixed(3)}_${lat.toFixed(3)}_${f.acq_date || ""}_${f.acq_time || ""}`;
      if (seenCoords.has(key)) continue;
      seenCoords.add(key);

      const munProx = findNearestAmazonasMunicipio(lat, lon);
      focosAM.push({
        ...f,
        municipio_prox: munProx,
        satelite: f.satelite || f.satellite || "Sensor Orbital",
        daynight: f.daynight || (f.acq_time && Number(f.acq_time) >= 600 && Number(f.acq_time) <= 1800 ? "D" : "N"),
      });
    }

    // 2. Análise dos Eventos de Fogo Ativos no Amazonas
    let totalAreaHa = 0;
    let eventosAtivosCount = 0;
    let eventosObsCount = 0;
    const eventosIdsAM = new Set<number>();
    const dominioStats: Record<string, number> = {};
    const ucsMap = new Map<string, { eventos_count: number; area_ha: number }>();
    const tisMap = new Map<string, { eventos_count: number; area_ha: number }>();

    for (const e of rawEventos) {
      eventosIdsAM.add(e.id_evento);
      const area = Number(e.area_total_evento) || 0;
      totalAreaHa += area;

      if (e.status_evento === "Ativo") {
        eventosAtivosCount++;
      } else {
        eventosObsCount++;
      }

      // Domínios territoriais
      if (e.dominio) {
        const domList = e.dominio.split(",").map((s) => s.trim());
        for (const d of domList) {
          if (!d) continue;
          dominioStats[d] = (dominioStats[d] || 0) + 1;
        }
      }

      // Unidades de Conservação
      if (e.unidade_conservacao) {
        const ucs = e.unidade_conservacao.split(",").map((s) => s.trim());
        for (const uc of ucs) {
          if (!uc) continue;
          const cur = ucsMap.get(uc) || { eventos_count: 0, area_ha: 0 };
          cur.eventos_count++;
          cur.area_ha += area;
          ucsMap.set(uc, cur);
        }
      }

      // Terras Indígenas
      if (e.terra_indigena) {
        const tis = e.terra_indigena.split(",").map((s) => s.trim());
        for (const ti of tis) {
          if (!ti) continue;
          const cur = tisMap.get(ti) || { eventos_count: 0, area_ha: 0 };
          cur.eventos_count++;
          cur.area_ha += area;
          tisMap.set(ti, cur);
        }
      }
    }

    // 3. Prioridades de Acionamento vinculadas ao Amazonas
    const prioridadesAM: PainelDoFogoPrioridade[] = [];
    for (const p of rawPrioridades) {
      if (eventosIdsAM.has(p.id_evento) || isInAmazonas(p.longitude, p.latitude)) {
        const ev = rawEventos.find((e) => e.id_evento === p.id_evento);
        prioridadesAM.push({
          ...p,
          municipio: ev?.municipio || findNearestAmazonasMunicipio(p.latitude, p.longitude),
          status: ev?.status_evento || "Ativo",
        });
      }
    }

    // 4. Ranking de Municípios do Amazonas
    const munStatsMap = new Map<string, RankingMunicipioFogo>();
    for (const m of AMAZONAS_MUNICIPALITY_CENTROIDS) {
      munStatsMap.set(m.nome.toLowerCase(), {
        nome: m.nome,
        focos: 0,
        eventos: 0,
        area_ha: 0,
        persistencia_max: 0,
      });
    }

    // Contabiliza focos nos municípios
    for (const f of focosAM) {
      if (!f.municipio_prox) continue;
      const cur = munStatsMap.get(f.municipio_prox.toLowerCase());
      if (cur) {
        cur.focos++;
      }
    }

    // Contabiliza eventos nos municípios
    for (const e of rawEventos) {
      const rawMun = String(e.municipio || "");
      const munNames = rawMun.split(",").map((s) => s.trim().replace(/\s*-\s*[A-Z]{2}$/i, ""));
      const area = Number(e.area_total_evento) || 0;
      const pers = Number(e.persistencia_dias) || 0;

      for (const mName of munNames) {
        const cur = munStatsMap.get(mName.toLowerCase());
        if (cur) {
          cur.eventos++;
          cur.area_ha += area;
          cur.persistencia_max = Math.max(cur.persistencia_max, pers);
        }
      }
    }

    const rankingMunicipios = Array.from(munStatsMap.values()).sort((a, b) => {
      const scoreB = b.focos * 3 + b.eventos * 10 + b.area_ha;
      const scoreA = a.focos * 3 + a.eventos * 10 + a.area_ha;
      return scoreB - scoreA;
    });

    const maisCritico = rankingMunicipios[0] || {
      nome: "Amazonas",
      focos: focosAM.length,
      eventos: rawEventos.length,
      area_ha: totalAreaHa,
    };

    // 5. Distribuições por Satélite e Período (Diurno vs Noturno)
    const distribuicaoSatelites: Record<string, number> = {};
    let diurnoCount = 0;
    let noturnoCount = 0;
    let totalFrp = 0;
    let maxFrp = 0;

    for (const f of focosAM) {
      const sat = f.satelite || f.satellite || "Outro";
      distribuicaoSatelites[sat] = (distribuicaoSatelites[sat] || 0) + 1;

      if (f.daynight === "D") {
        diurnoCount++;
      } else {
        noturnoCount++;
      }

      const frpVal = Number(f.frp) || 0;
      if (frpVal > 0) {
        totalFrp += frpVal;
        if (frpVal > maxFrp) maxFrp = frpVal;
      }
    }

    const avgFrp = focosAM.length > 0 ? Number((totalFrp / focosAM.length).toFixed(1)) : 0;

    // 6. Áreas Protegidas estruturadas
    const ucsAfetadas: AreaProtegidaFogo[] = Array.from(ucsMap.entries())
      .map(([nome, val]) => ({ nome, eventos_count: val.eventos_count, area_ha: Number(val.area_ha.toFixed(1)), tipo: "UC" as const }))
      .sort((a, b) => b.eventos_count - a.eventos_count);

    const tisAfetadas: AreaProtegidaFogo[] = Array.from(tisMap.entries())
      .map(([nome, val]) => ({ nome, eventos_count: val.eventos_count, area_ha: Number(val.area_ha.toFixed(1)), tipo: "TI" as const }))
      .sort((a, b) => b.eventos_count - a.eventos_count);

    const response: PainelDoFogoOverviewResponse = {
      timestamp: new Date().toISOString(),
      data_referencia: input.data || new Date().toISOString().slice(0, 10),
      horas_filtro: input.horas,
      status_api: eventosRes.status === "fulfilled" ? "online" : "degraded",
      total_focos_am: focosAM.length,
      total_eventos_am: rawEventos.length,
      eventos_ativos_am: eventosAtivosCount,
      eventos_observacao_am: eventosObsCount,
      area_total_afetada_ha: Number(totalAreaHa.toFixed(1)),
      area_total_afetada_km2: Number((totalAreaHa / 100).toFixed(2)),
      municipio_mais_critico: maisCritico,
      ranking_municipios: rankingMunicipios,
      distribuicao_satelites: distribuicaoSatelites,
      distribuicao_periodo: { diurno: diurnoCount, noturno: noturnoCount },
      distribuicao_dominio: dominioStats,
      ucs_afetadas: ucsAfetadas,
      tis_afetadas: tisAfetadas,
      frp_media: avgFrp,
      frp_maxima: Number(maxFrp.toFixed(1)),
      eventos: rawEventos,
      focos: focosAM,
      prioridades_am: prioridadesAM,
      municipios_am: rawMunIbge.length > 0 ? rawMunIbge : AMAZONAS_MUNICIPALITY_CENTROIDS.map((c, i) => ({ nome: c.nome, estado: "AM", geocodigo: 1300000 + i })),
    };

    cacheStore.set(cacheKey, { data: response, timestamp: Date.now() });
    return response;
  });

// =============================================================================
// SERVER FUNCTION: Detalhes de um Evento de Fogo (Detecções, CARs e Evolução)
// =============================================================================

export const getPainelDoFogoEventoDetalhes = createServerFn({ method: "GET" })
  .middleware([requireBackendAuth])
  .validator((raw: unknown) =>
    z
      .object({
        id_evento: z.number().int().positive(),
      })
      .parse(raw),
  )
  .handler(async ({ data: input }) => {
    const id = input.id_evento;
    const [eventoRes, deteccoesRes, carsRes, evolucoesRes] = await Promise.allSettled([
      fetchWithTimeout(`${CENSIPAM_BASE}/painel-do-fogo/api/v1/eventos/${id}`),
      fetchWithTimeout(`${CENSIPAM_BASE}/painel-do-fogo/api/v1/eventos/${id}/deteccoes`),
      fetchWithTimeout(`${CENSIPAM_BASE}/painel-do-fogo/api/v1/eventos/${id}/cars`),
      fetchWithTimeout(`${CENSIPAM_BASE}/painel-do-fogo/api/v1/eventos/${id}/evolucoes`),
    ]);

    const evento: PainelDoFogoEvento | null = eventoRes.status === "fulfilled" ? eventoRes.value : null;
    const deteccoes: PainelDoFogoDeteccao[] = deteccoesRes.status === "fulfilled" && Array.isArray(deteccoesRes.value) ? deteccoesRes.value : [];
    const cars: PainelDoFogoCar[] = carsRes.status === "fulfilled" && Array.isArray(carsRes.value) ? carsRes.value : [];
    const evolucoes: string[] = evolucoesRes.status === "fulfilled" && Array.isArray(evolucoesRes.value) ? evolucoesRes.value : [];

    return {
      evento,
      deteccoes,
      cars,
      evolucoes,
    };
  });

