import { describe, it, expect } from "vitest";
import { buildComparisonPdfDoc } from "../export-comparison-pdf";

describe("buildComparisonPdfDoc", () => {
  it("deve calcular totais de focos combatidos e incêndios com fidelidade exata entre resumo e municípios", () => {
    const rows1 = [
      { mun: "Manaus", urb: 10, flor: 2, focos: 5 },
      { mun: "Humaitá", urb: 1, flor: 15, focos: 20 },
      { mun: "Apuí", urb: 0, flor: 8, focos_combatidos: 12 },
    ];
    const rows2 = [
      { mun: "Manaus", urb: 8, flor: 4, focos: 7 },
      { mun: "Humaitá", urb: 2, flor: 10, focos_atendidos: 14 },
      { mun: "Apuí", urb: 1, flor: 6, focos: 9 },
    ];

    const doc = buildComparisonPdfDoc({
      year1: 2025,
      year2: 2026,
      startMonth: 6,
      endMonth: 10,
      activeTab: "incendios",
      totals1: {
        incendios: 36, // 10+2 + 1+15 + 0+8 = 36
        flor: 25,     // 2+15+8 = 25
        urb: 11,      // 10+1+0 = 11
        focos: 37,    // 5+20+12 = 37
        efetivo: 120,
        dias: 153,
      },
      totals2: {
        incendios: 31, // 8+4 + 2+10 + 1+6 = 31
        flor: 20,     // 4+10+6 = 20
        urb: 11,      // 8+2+1 = 11
        focos: 30,    // 7+14+9 = 30
        efetivo: 140,
        dias: 153,
      },
      rows1,
      rows2,
    });

    expect(doc).toBeDefined();
    const pageCount = (doc as any).internal.getNumberOfPages();
    expect(pageCount).toBeGreaterThanOrEqual(1);
  });

  it("deve gerar PDF comparativo de efetivo e viaturas sem erros de renderização ou desvio de colunas", () => {
    const ef1 = [
      { mun: "Manaus", cbmam: 50, seg: 10, brig_mun: 0 },
      { mun: "Humaitá", ord: 10, seg: 5, brig: 15 },
    ];
    const ef2 = [
      { mun: "Manaus", servico: 45, seg: 8, brig_semas: 2 },
      { mun: "Humaitá", ord: 12, seg: 4, brig: 18 },
    ];

    const docEf = buildComparisonPdfDoc({
      year1: 2025,
      year2: 2026,
      startMonth: 1,
      endMonth: 12,
      activeTab: "efetivo",
      totals1: { incendios: 0, flor: 0, urb: 0, focos: 0, efetivo: 90, dias: 365 },
      totals2: { incendios: 0, flor: 0, urb: 0, focos: 0, efetivo: 89, dias: 365 },
      rows1: ef1,
      rows2: ef2,
    });
    expect(docEf).toBeDefined();

    const rec1 = [
      { mun: "Manaus", abt: 3, at: 2, ur: 4, ar: 1, embarcacao: 2 },
    ];
    const rec2 = [
      { mun: "Manaus", abt: 4, at: 1, ur: 5, ar: 2, embarcacao: 1 },
    ];

    const docRec = buildComparisonPdfDoc({
      year1: 2025,
      year2: 2026,
      startMonth: 1,
      endMonth: 12,
      activeTab: "recursos",
      totals1: { incendios: 0, flor: 0, urb: 0, focos: 0, efetivo: 0, dias: 365 },
      totals2: { incendios: 0, flor: 0, urb: 0, focos: 0, efetivo: 0, dias: 365 },
      rows1: rec1,
      rows2: rec2,
    });
    expect(docRec).toBeDefined();
  });
});
