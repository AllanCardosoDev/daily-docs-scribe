import * as XLSX from "xlsx";
import type { PainelDoFogoOverviewResponse } from "./painel-do-fogo.types";
import { fmtDateStamp } from "./formatters";

export function exportFocosXlsx(data: PainelDoFogoOverviewResponse) {
  const wb = XLSX.utils.book_new();

  // Aba 1: Resumo Executivo e Ranking de Municípios
  const resumoRows = [
    ["PAINEL DO FOGO — CENSIPAM / SIPAM — MONITORAMENTO AMAZONAS"],
    ["Data de Referência:", data.data_referencia],
    ["Janela de Monitoramento:", `Últimas ${data.horas_filtro} horas`],
    ["Total de Focos no Amazonas:", data.total_focos_am],
    ["Total de Eventos de Fogo Ativos:", data.total_eventos_am],
    ["Eventos Ativos em Combate:", data.eventos_ativos_am],
    ["Eventos em Observação:", data.eventos_observacao_am],
    ["Área Total Afetada (ha):", data.area_total_afetada_ha],
    ["Área Total Afetada (km²):", data.area_total_afetada_km2],
    ["FRP Média (MW):", data.frp_media],
    ["FRP Máxima (MW):", data.frp_maxima],
    [],
    ["RANKING DE MUNICÍPIOS DO AMAZONAS COM FOCOS & EVENTOS DE FOGO"],
    ["Posição", "Município", "Focos de Calor", "Eventos de Fogo", "Área Afetada (ha)", "Persistência Máx (dias)"],
    ...data.ranking_municipios
      .filter((m) => m.focos > 0 || m.eventos > 0)
      .map((m, idx) => [idx + 1, m.nome, m.focos, m.eventos, m.area_ha, m.persistencia_max]),
  ];
  const wsResumo = XLSX.utils.aoa_to_sheet(resumoRows);
  XLSX.utils.book_append_sheet(wb, wsResumo, "Resumo Executivo");

  // Aba 2: Eventos de Fogo Ativos no Amazonas
  const eventosHeaders = [
    "ID Evento",
    "Status",
    "Município(s)",
    "Área Total (ha)",
    "Persistência (dias)",
    "Latitude",
    "Longitude",
    "Domínio Territorial",
    "Terra Indígena",
    "Unidade de Conservação",
    "Projeto Assentamento",
    "Data Inicial",
    "Última Visão Satélite",
  ];
  const eventosData = data.eventos.map((e) => [
    e.id_evento,
    e.status_evento,
    e.municipio || "Não informado",
    e.area_total_evento,
    e.persistencia_dias,
    e.latitude,
    e.longitude,
    e.dominio || "—",
    e.terra_indigena || "—",
    e.unidade_conservacao || "—",
    e.projeto_assentamento || "—",
    e.dt_minima ? new Date(e.dt_minima).toLocaleString("pt-BR") : "—",
    e.dt_ultima_visao ? new Date(e.dt_ultima_visao).toLocaleString("pt-BR") : "—",
  ]);
  const wsEventos = XLSX.utils.aoa_to_sheet([eventosHeaders, ...eventosData]);
  XLSX.utils.book_append_sheet(wb, wsEventos, "Eventos de Fogo");

  // Aba 3: Focos de Calor Detalhados (CENSIPAM + FIRMS)
  const focosHeaders = [
    "ID Foco",
    "Data Aquisição",
    "Horário UTC",
    "Satélite",
    "Município Próximo",
    "Latitude",
    "Longitude",
    "FRP (MW)",
    "Temp Brilho TI4 (K)",
    "Temp Brilho TI5 (K)",
    "Período",
    "Confiança",
  ];
  const focosData = data.focos.map((f) => [
    f.id,
    f.acq_date,
    f.acq_time,
    f.satelite || f.satellite,
    f.municipio_prox || "Amazonas",
    f.geom?.coordinates?.[1] ?? "",
    f.geom?.coordinates?.[0] ?? "",
    f.frp ?? 0,
    f.bright_ti4 ?? 0,
    f.bright_ti5 ?? 0,
    f.daynight === "D" ? "Diurno" : "Noturno",
    f.confidence ?? "—",
  ]);
  const wsFocos = XLSX.utils.aoa_to_sheet([focosHeaders, ...focosData]);
  XLSX.utils.book_append_sheet(wb, wsFocos, "Focos de Calor");

  // Aba 4: Áreas Protegidas (UCs e TIs)
  const areasHeaders = ["Tipo", "Área Protegida", "Qtd Eventos Ativos", "Área Estimada (ha)"];
  const areasData = [
    ...data.ucs_afetadas.map((u) => ["Unidade de Conservação (UC)", u.nome, u.eventos_count, u.area_ha]),
    ...data.tis_afetadas.map((t) => ["Terra Indígena (TI)", t.nome, t.eventos_count, t.area_ha]),
  ];
  const wsAreas = XLSX.utils.aoa_to_sheet([areasHeaders, ...areasData]);
  XLSX.utils.book_append_sheet(wb, wsAreas, "Áreas Protegidas");

  const fileName = `Painel_do_Fogo_CENSIPAM_Amazonas_${fmtDateStamp()}_${data.horas_filtro}h.xlsx`;
  XLSX.writeFile(wb, fileName);
}
