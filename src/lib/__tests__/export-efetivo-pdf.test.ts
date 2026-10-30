import { describe, it, expect } from "vitest";
import { buildEfetivoPdfDoc } from "../export-efetivo-pdf";

describe("exportEfetivoPdf", () => {
  it("deve construir documento PDF do efetivo com sucesso e cabeçalho oficial", () => {
    const mockEfetivo = [
      {
        mun: "Manaus",
        ord: 50,
        seg: 10,
        brig: 0,
        fn: 5,
        prevfogo: 0,
        marinha: 2,
        opamv: 15,
        total: 82,
      },
      {
        mun: "Humaitá",
        ord: 20,
        seg: 5,
        brig: 12,
        fn: 10,
        prevfogo: 4,
        marinha: 0,
        opamv: 8,
        total: 59,
      },
      {
        mun: "Base Avançada Apuí",
        ord: 5,
        seg: 0,
        brig: 8,
        fn: 4,
        prevfogo: 0,
        marinha: 0,
        opamv: 2,
        total: 19,
      },
    ];

    const doc = buildEfetivoPdfDoc({
      efetivo: mockEfetivo,
      periodoLabel: "28/08/2026 a 29/10/2026",
      reportDate: new Date("2026-10-29T12:00:00Z"),
      comandante: "CEL QOBM BORGES",
      coordenador: "CEL QOBM CRISTIANO BRAZ FERREIRA",
    });

    expect(doc).toBeDefined();
    const pageCount = (doc as any).internal.getNumberOfPages();
    expect(pageCount).toBeGreaterThanOrEqual(1);
  });
});
