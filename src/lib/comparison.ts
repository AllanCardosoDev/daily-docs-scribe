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
    outras: {
      salvamento: ComparisonDelta;
      acidentes: ComparisonDelta;
      aph: ComparisonDelta;
      prevencao: ComparisonDelta;
      servicos: ComparisonDelta;
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

  const outrasA = {
    salvamento: sum(dataA.outras_diarias, ["salvamento"]),
    acidentes: sum(dataA.outras_diarias, ["acidentes"]),
    aph: sum(dataA.outras_diarias, ["aph"]),
    prevencao: sum(dataA.outras_diarias, ["prevencao"]),
    servicos: sum(dataA.outras_diarias, ["servicos"]),
    total: sum(dataA.outras_diarias, ["salvamento", "acidentes", "aph", "prevencao", "servicos"])
  };

  const outrasB = {
    salvamento: sum(dataB.outras_diarias, ["salvamento"]),
    acidentes: sum(dataB.outras_diarias, ["acidentes"]),
    aph: sum(dataB.outras_diarias, ["aph"]),
    prevencao: sum(dataB.outras_diarias, ["prevencao"]),
    servicos: sum(dataB.outras_diarias, ["servicos"]),
    total: sum(dataB.outras_diarias, ["salvamento", "acidentes", "aph", "prevencao", "servicos"])
  };

  const efetivoA = sum(dataA.efetivo, ["ord", "seg", "brig"]);
  const efetivoB = sum(dataB.efetivo, ["ord", "seg", "brig"]);

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
      outras: {
        salvamento: calcDelta(outrasA.salvamento, outrasB.salvamento),
        acidentes: calcDelta(outrasA.acidentes, outrasB.acidentes),
        aph: calcDelta(outrasA.aph, outrasB.aph),
        prevencao: calcDelta(outrasA.prevencao, outrasB.prevencao),
        servicos: calcDelta(outrasA.servicos, outrasB.servicos),
        total: calcDelta(outrasA.total, outrasB.total),
      },
      efetivo: {
        total: calcDelta(efetivoA, efetivoB)
      }
    }
  };
}
