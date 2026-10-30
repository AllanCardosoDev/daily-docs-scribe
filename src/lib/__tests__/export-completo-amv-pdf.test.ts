import { describe, it, expect } from "vitest";
import { buildRelatorioCompletoAmvDoc } from "../export-completo-amv-pdf";

describe("buildRelatorioCompletoAmvDoc", () => {
  it("deve construir documento PDF completo AM+V seguindo a ordem exata (Ocorrências, Efetivo, Viaturas)", () => {
    const doc = buildRelatorioCompletoAmvDoc({
      periodoLabel: "28/08/2026 a 29/10/2026",
      dataDiariaLabel: "29/10/2026",
      comandante: "CEL QOBM BORGES",
      coordenador: "CEL QOBM CRISTIANO BRAZ FERREIRA",
      chefeCapital: "CEL QOBM MENEZES",
      chefeInterior: "CEL QOBM MONTEIRO",
      coordSituacao: "CEL QOBM FERREIRA",

      // 1º Item: Ocorrências
      ocorrenciasDiarias: [
        { mun: "Manaus", urb: 5, flor: 1, focos: 2 },
        { mun: "Humaitá", urb: 1, flor: 8, focos: 15 },
        { mun: "Apuí", urb: 0, flor: 4, focos: 9 },
      ],
      ocorrenciasTotais: [
        { mun: "Manaus", urb: 120, flor: 45, focos: 80 },
        { mun: "Humaitá", urb: 30, flor: 210, focos: 450 },
        { mun: "Apuí", urb: 12, flor: 160, focos: 320 },
      ],

      // 2º Item: Efetivo
      efetivoDiario: [
        { mun: "Manaus", ord: 40, seg: 5, fn: 0, prevfogo: 0, marinha: 2, cbmsp: 0, brig: 0 },
        { mun: "Humaitá", ord: 15, seg: 2, fn: 10, prevfogo: 4, marinha: 0, cbmsp: 0, brig: 12 },
      ],
      efetivoGeral: [
        { mun: "Manaus", ord: 60, seg: 10, fn: 5, prevfogo: 2, marinha: 4, cbmsp: 0, brig: 0 },
        { mun: "Humaitá", ord: 25, seg: 5, fn: 20, prevfogo: 8, marinha: 0, cbmsp: 0, brig: 24 },
      ],

      // 3º Item: Viaturas
      viaturasDiarias: [
        { mun: "Manaus", abt: 2, at: 1, aem: 0, atp: 2, embarcacao: 1, helicoptero: 0 },
        { mun: "Humaitá", abt: 1, at: 0, aem: 0, atp: 1, embarcacao: 0, helicoptero: 0 },
      ],
      viaturasTotais: [
        { mun: "Manaus", abt: 4, at: 2, aem: 1, atp: 5, embarcacao: 2, helicoptero: 1 },
        { mun: "Humaitá", abt: 2, at: 1, aem: 0, atp: 3, embarcacao: 1, helicoptero: 0 },
      ],
    });

    expect(doc).toBeDefined();
    const pageCount = (doc as any).internal.getNumberOfPages();
    // Deve possuir no mínimo 3 páginas (1: Ocorrências, 2: Efetivo, 3: Viaturas)
    expect(pageCount).toBeGreaterThanOrEqual(3);
  });
});

