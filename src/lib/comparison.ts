import type { SheetsData } from "./sheets.types";

export interface ComparisonDelta {
  absolute: number;
  percentage: number;
  trend: "up" | "down" | "neutral";
}

export interface ComparisonResult {
  dataA: SheetsData;
  dataB: SheetsData;
  deltas: {
    incendios: {
      urb: ComparisonDelta;
      flor: ComparisonDelta;
      focos: ComparisonDelta;
      total: ComparisonDelta;
    };
    efetivo: {
      total: ComparisonDelta;
    };
    area: {
      total: ComparisonDelta;
    };
  };
}

function calcDelta(valA: number, valB: number): ComparisonDelta {
  const absolute = valB - valA;
  const percentage = valA === 0 ? (valB > 0 ? 100 : 0) : (absolute / valA) * 100;
  let trend: "up" | "down" | "neutral" = "neutral";
  if (absolute > 0) trend = "up";
  if (absolute < 0) trend = "down";
  
  return { absolute, percentage, trend };
}

export function calculateComparison(dataA: SheetsData, dataB: SheetsData): ComparisonResult {
  const sum = (list: any[], keys: string[]) => 
    list.reduce((acc, item) => acc + keys.reduce((s, k) => s + (Number(item[k]) || 0), 0), 0);

  const incA = {
    urb: sum(dataA.incendios_diario, ["urb"]),
    flor: sum(dataA.incendios_diario, ["flor"]),
    focos: sum(dataA.incendios_diario, ["focos"]),
    total: sum(dataA.incendios_diario, ["urb", "flor"])
  };

  const incB = {
    urb: sum(dataB.incendios_diario, ["urb"]),
    flor: sum(dataB.incendios_diario, ["flor"]),
    focos: sum(dataB.incendios_diario, ["focos"]),
    total: sum(dataB.incendios_diario, ["urb", "flor"])
  };

  const efetivoA = sum(dataA.efetivo, ["ord", "seg", "brig", "brig_semas"]);
  const efetivoB = sum(dataB.efetivo, ["ord", "seg", "brig", "brig_semas"]);

  const areaA = sum(dataA.incendios_acumulado ?? [], ["area"]);
  const areaB = sum(dataB.incendios_acumulado ?? [], ["area"]);

  return {
    dataA,
    dataB,
    deltas: {
      incendios: {
        urb: calcDelta(incA.urb, incB.urb),
        flor: calcDelta(incA.flor, incB.flor),
        focos: calcDelta(incA.focos, incB.focos),
        total: calcDelta(incA.total, incB.total),
      },
      efetivo: {
        total: calcDelta(efetivoA, efetivoB)
      },
      area: {
        total: calcDelta(areaA, areaB)
      }
    }
  };
}
