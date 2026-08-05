import { describe, it, expect } from "vitest";
import { validateForExport, formatIssues } from "../report-validation";
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
});
