import { describe, it, expect } from "vitest";
import { validateForExport, formatIssues, sanitizeSheetsData } from "../report-validation";
import type { SheetsData } from "../sheets.types";

describe("report-validation", () => {
  const validHeader = {
    titulo: "Operação Amazonas + Verde",
    periodo: "01/08/2026 a 02/08/2026",
    comandante: "Cel. Silva",
    coordenador: "Maj. Souza",
  };

  it("deve aprovar exportação com dados válidos e sem valores negativos", () => {
    const validData: Partial<SheetsData> = {
      header: validHeader,
      efetivo: [{ mun: "Manaus", ord: 10, seg: 5, brig: 0 }],
      incendios_diario: [{ mun: "Manaus", urb: 1, flor: 2, focos: 0 }],
    };

    const result = validateForExport(validData as SheetsData);
    expect(result.ok).toBe(true);
    expect(result.issues).toHaveLength(0);
  });

  it("deve reprovar exportação se faltarem campos obrigatórios no cabeçalho", () => {
    const invalidData: Partial<SheetsData> = {
      header: {
        titulo: "Operação Amazonas + Verde",
        // período, comandante e coordenador ausentes
      },
    };

    const result = validateForExport(invalidData as SheetsData);
    expect(result.ok).toBe(false);
    expect(result.issues.length).toBeGreaterThanOrEqual(3);
    const fields = result.issues.map((i) => i.field);
    expect(fields).toContain("periodo");
    expect(fields).toContain("comandante");
    expect(fields).toContain("coordenador");
  });

  it("deve apontar erro se existirem células com valores negativos", () => {
    const dataWithNegatives: Partial<SheetsData> = {
      header: validHeader,
      efetivo: [{ mun: "Manaus", ord: -5, seg: 5, brig: 0 }],
      incendios_diario: [{ mun: "Manaus", urb: 1, flor: -2, focos: 0 }],
    };

    const result = validateForExport(dataWithNegatives as SheetsData);
    expect(result.ok).toBe(false);
    const dataIssue = result.issues.find((i) => i.field === "dados");
    expect(dataIssue).toBeDefined();
    expect(dataIssue?.message).toContain("2 célula(s) com valor negativo");
  });

  it("formatIssues deve formatar lista de erros adequadamente", () => {
    const issues = [
      { field: "periodo", label: "Período Operacional", message: "Obrigatório" },
      { field: "comandante", label: "Comandante do Incidente", message: "Obrigatório" },
    ];

    const formatted = formatIssues(issues);
    expect(formatted).toContain("• Período Operacional: Obrigatório");
    expect(formatted).toContain("• Comandante do Incidente: Obrigatório");
  });

  it("sanitizeSheetsData deve autocorrige valores negativos para valores absolutos válidos", () => {
    const rawDataWithNegatives: SheetsData = {
      header: validHeader,
      efetivo: [{ mun: "Manaus", ord: -5, seg: 5, brig: 0 }],
      incendios_diario: [{ mun: "Manaus", urb: 1, flor: -2, focos: 0 }],
      incendios_acumulado: [{ mun: "Manaus", urb: 10, flor: 5, focos: -20, sat: 0, area: -500 }],
      outras_diarias: [],
      occurrences: [
        {
          id: "test-neg-1",
          data: "2026-10-14",
          horario: "10:00",
          municipio: "Parintins",
          natureza: "Incêndio Florestal",
          focos: -20,
          area: -4000,
          agua: -15000,
        },
      ],
      recursos: [],
    };

    const sanitized = sanitizeSheetsData(rawDataWithNegatives);
    expect(sanitized.efetivo[0].ord).toBe(5);
    expect(sanitized.incendios_diario[0].flor).toBe(2);
    expect(sanitized.incendios_acumulado[0].focos).toBe(20);
    expect(sanitized.incendios_acumulado[0].area).toBe(500);
    expect(sanitized.occurrences[0].focos).toBe(20);
    expect(sanitized.occurrences[0].area).toBe(4000);
    expect(sanitized.occurrences[0].agua).toBe(15000);

    const validationResult = validateForExport(sanitized);
    expect(validationResult.ok).toBe(true);
    expect(validationResult.issues).toHaveLength(0);
  });
});
