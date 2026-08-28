import { Flame, Users, Shield, HardHat, Car, ClipboardList } from "lucide-react";
import type { SheetsData } from "./sheets.types";
import { NF } from "./formatters";

export interface Kpi {
  label: string;
  value: string;
  hint: string;
  Icon: any;
  accent: string;
  iconClass: string;
  ring: string;
}

export function computeKpis(data: SheetsData, isRange?: boolean): Kpi[] {
  const sum = (list: any[], key: string) =>
    list?.reduce((acc, r) => acc + (Number(r[key]) || 0), 0) ?? 0;

  const totalIncendios =
    sum(data.incendios_diario, "urb") +
    sum(data.incendios_diario, "flor");

  const totalEfetivo =
    sum(data.efetivo, "ord") + sum(data.efetivo, "seg") + sum(data.efetivo, "brig");

  const totalOcorrencias =
    sum(data.outras_diarias, "salvamento") +
    sum(data.outras_diarias, "acidentes") +
    sum(data.outras_diarias, "aph") +
    sum(data.outras_diarias, "prevencao") +
    sum(data.outras_diarias, "servicos");

  const totalRecursos =
    data.recursos?.reduce((acc, r) => {
      const keys = [
        "abt",
        "at",
        "aem",
        "atp",
        "ata",
        "abf",
        "atf",
        "abs",
        "pipa",
        "dosa",
        "crs",
        "ar",
        "ur",
        "gse",
        "mt",
        "ta",
        "quadriciclo",
        "embarcacao",
        "picape_fn",
        "picape_muni",
        "autoarp",
        "picape_esfron",
        "helicoptero",
        "aviao",
        "jetski",
      ];
      return acc + keys.reduce((s, k) => s + (Number(r[k]) || 0), 0);
    }, 0) ?? 0;

  const rangeActive = Boolean(isRange || (data as any)?.isRange);

  return [
    {
      label: "Recursos em campo",
      value: NF.format(totalRecursos),
      hint: rangeActive ? "Meios mobilizados no período" : "Meios materiais do dia",
      Icon: Car,
      accent: "linear-gradient(to bottom right, #3b82f6, #2563eb)",
      iconClass: "bg-blue-500/10 text-blue-600",
      ring: "ring-blue-500/10",
    },
    {
      label: "Efetivo empenhado",
      value: NF.format(totalEfetivo),
      hint: rangeActive ? "Efetivo mobilizado no período" : "Efetivo do dia",
      Icon: Users,
      accent: "linear-gradient(to bottom right, #10b981, #059669)",
      iconClass: "bg-emerald-500/10 text-emerald-600",
      ring: "ring-emerald-500/10",
    },
    {
      label: rangeActive ? "Incêndios (do período)" : "Incêndios (do dia)",
      value: NF.format(totalIncendios),
      hint: rangeActive ? "Total acumulado no período" : "Ocorrências registradas no dia",
      Icon: Flame,
      accent: "linear-gradient(to bottom right, #ef4444, #dc2626)",
      iconClass: "bg-red-500/10 text-red-600",
      ring: "ring-red-500/10",
    },
    {
      label: rangeActive ? "Outras ocorrências (do período)" : "Outras ocorrências (do dia)",
      value: NF.format(totalOcorrencias),
      hint: rangeActive ? "Salvamento, APH e serviços no período" : "Salvamento, APH e serviços no dia",
      Icon: ClipboardList,
      accent: "linear-gradient(to bottom right, #f59e0b, #d97706)",
      iconClass: "bg-amber-500/10 text-amber-600",
      ring: "ring-amber-500/10",
    },
  ];
}
