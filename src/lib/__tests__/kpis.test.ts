import { describe, it, expect } from "vitest";
import { computeKpis } from "../kpis";
import type { SheetsData } from "../sheets.types";

describe("computeKpis", () => {
  it("deve calcular corretamente os KPIs quando os dados estiverem preenchidos", () => {
    const mockData: Partial<SheetsData> = {
      incendios_diario: [
        { mun: "Manaus", urb: 2, flor: 3, focos: 5 },
        { mun: "Apuí", urb: 1, flor: 0, focos: 4 },
      ],
      efetivo: [
        { mun: "Manaus", ord: 10, seg: 5, brig: 2 },
        { mun: "Apuí", ord: 8, seg: 2, brig: 1 },
      ],
      outras_diarias: [
        { mun: "Manaus", salvamento: 1, acidentes: 2, aph: 3, prevencao: 4, servicos: 5 },
      ],
      recursos: [
        { mun: "Manaus", abt: 2, at: 1, pipa: 3 }, // 6 recursos
      ],
    };

    const kpis = computeKpis(mockData as SheetsData);

    expect(kpis).toHaveLength(4);

    // Recursos em campo (2+1+3 = 6)
    expect(kpis[0].label).toBe("Recursos em campo");
    expect(kpis[0].value).toBe("6");

    // Efetivo empenhado (10+5+2 + 8+2+1 = 28)
    expect(kpis[1].label).toBe("Efetivo empenhado");
    expect(kpis[1].value).toBe("28");

    // Incêndios (do dia) (urb: 2+1=3, flor: 3+0=3 => 6)
    expect(kpis[2].label).toBe("Incêndios (do dia)");
    expect(kpis[2].value).toBe("6");

    // Outras ocorrências (do dia) (1+2+3+4+5 = 15)
    expect(kpis[3].label).toBe("Outras ocorrências (do dia)");
    expect(kpis[3].value).toBe("15");
  });

  it("deve retornar 0 para todos os KPIs quando a estrutura de dados for vazia", () => {
    const mockData: Partial<SheetsData> = {};

    const kpis = computeKpis(mockData as SheetsData);

    expect(kpis[0].value).toBe("0");
    expect(kpis[1].value).toBe("0");
    expect(kpis[2].value).toBe("0");
    expect(kpis[3].value).toBe("0");
  });
});
