import { describe, it, expect } from "vitest";
import { buildSheetsPdfDoc } from "../export-pdf";
import type { SheetsData } from "../sheets.types";

describe("buildSheetsPdfDoc (Relatório Oficial com Página 1 Executiva)", () => {
  const mockData: SheetsData = {
    header: {
      titulo: "RELATÓRIO DIÁRIO — SALA DE SITUAÇÃO",
      periodo: "12/11/2026 — 24H",
      operador: "2º SGT QCPBM NARA",
      responsavel: "2º SGT QCPBM NARA",
    },
    efetivo: [
      { mun: "Manaus", serv_ord: 350, fn: 9, cbmsp: 25, total: 384 },
      { mun: "Apuí", serv_ord: 5, opamv: 2, inc1: 3, inc3: 2, fn: 4, brig_semas: 15, total: 31 },
      { mun: "Autazes", serv_ord: 5, opamv: 2, inc1: 5, inc2: 3, prevfogo: 38, brig_mun: 13, brig_semas: 6, total: 72 },
    ],
    recursos: [
      { mun: "Manaus", abt: 8, at: 4, ar: 6, ur: 5, embarcacao: 4, total: 27 },
      { mun: "Humaitá", abt: 2, at: 1, pipa: 1, ar: 2, total: 6 },
    ],
    incendios_diario: [
      { mun: "Manaus", urb: 5, flor: 1, focos: 0, total: 6 },
      { mun: "Autazes", urb: 0, flor: 2, focos: 3, total: 2 },
    ],
    incendios_acumulado: [
      { mun: "Manaus", urb: 270, flor: 180, focos: 340, sat: 5, area: 38000 },
      { mun: "Autazes", urb: 9, flor: 15, focos: 43, sat: 22, area: 8500 },
    ],
    occurrences: [
      {
        data: "12/11/2026",
        municipio: "Manaus",
        horario: "14:30",
        natureza: "Incêndio em Vegetação",
        endereco: "Tarumã",
        focos: 1,
        area: 500,
        agua: 2000,
        equipes: "ABT-29",
      },
    ],
  };

  it("deve gerar o PDF com a Página 1 sendo o Sumário Executivo e páginas subsequentes detalhadas", () => {
    const doc = buildSheetsPdfDoc(mockData, new Date(2026, 10, 12));
    const totalPages = (doc as any).internal.getNumberOfPages();

    // Deve conter no mínimo 5 páginas (P1: Executivo, P2: Efetivo, P3: Recursos, P4: Incêndios, P5: CAD)
    expect(totalPages).toBeGreaterThanOrEqual(5);
  });
});
