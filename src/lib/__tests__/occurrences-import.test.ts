import { describe, it, expect } from "vitest";
import { processSpreadsheetBuffer } from "../occurrences-import.server";
import { isNonMunicipioTroop, canonicalMunicipio } from "../municipio-order";
import fs from "fs";
import path from "path";

describe("occurrences-import", () => {
  it("deve identificar e rejeitar UUIDs e tropas externas como município", () => {
    expect(isNonMunicipioTroop("612efaa8-bfe4-4840-bbbc-07d573359d99")).toBe(true);
    expect(isNonMunicipioTroop("34686d6e-771c-4f9a-9c1a-db7ceefe8cf3")).toBe(true);
    expect(isNonMunicipioTroop("Militares São Paulo-SP")).toBe(true);
    expect(isNonMunicipioTroop("Militares de São Paulo")).toBe(true);
    expect(isNonMunicipioTroop("Manaus")).toBe(false);
    expect(isNonMunicipioTroop("Barcelos")).toBe(false);
    expect(isNonMunicipioTroop("São Paulo de Olivença")).toBe(false);
  });

  it("canonicalMunicipio deve converter UUID para Manaus em vez de mantê-lo", () => {
    expect(canonicalMunicipio("612efaa8-bfe4-4840-bbbc-07d573359d99")).toBe("Manaus");
    expect(canonicalMunicipio("34686d6e-771c-4f9a-9c1a-db7ceefe8cf3")).toBe("Manaus");
    expect(canonicalMunicipio("Barcelos")).toBe("Barcelos");
    expect(canonicalMunicipio("Borba")).toBe("Borba");
  });

  it("deve processar o CSV do CAD extraindo municípios e focos reais sem colisão com coluna id", async () => {
    const csvPath = "C:/Users/User/.gemini/antigravity/brain/0b02c0cc-4e5e-4f16-8fe9-e4f4f8114e49/.user_uploaded/media_1793294662761_7c3a5afe.csv";
    if (!fs.existsSync(csvPath)) return;

    const buffer = fs.readFileSync(csvPath);
    const result = await processSpreadsheetBuffer(buffer, "Demonstracao_Ocorrencias.csv");

    expect(result.success).toBe(true);
    expect(result.fireRows).toBe(5);

    const { getOccurrencesForDate } = await import("../occurrences-store.server");

    // Dia 29/10/2026 deve conter 3 ocorrências: Barcelos, Rio Preto da Eva e Manaus
    const occs29 = getOccurrencesForDate("2026-10-29");
    expect(occs29.length).toBe(3);
    const muns29 = occs29.map((o) => o.municipio);
    expect(muns29).toContain("Barcelos");
    expect(muns29).toContain("Rio Preto da Eva");
    expect(muns29).toContain("Manaus");

    const barcelos = occs29.find((o) => o.municipio === "Barcelos");
    expect(barcelos).toBeDefined();
    expect(barcelos?.focos).toBe(14);
    expect(barcelos?.area).toBe(4000);
    expect(barcelos?.agua).toBe(15000);

    // Dia 28/10/2026 deve conter 2 ocorrências: Borba e Manaus
    const occs28 = getOccurrencesForDate("2026-10-28");
    expect(occs28.length).toBe(2);
    const muns28 = occs28.map((o) => o.municipio);
    expect(muns28).toContain("Borba");
    expect(muns28).toContain("Manaus");

    const borba = occs28.find((o) => o.municipio === "Borba");
    expect(borba).toBeDefined();
    expect(borba?.focos).toBe(6);
    expect(borba?.area).toBe(60);

    // NENHUM município pode ser UUID ou tropa externa
    for (const occ of [...occs29, ...occs28]) {
      expect(occ.municipio).not.toMatch(/^[0-9a-f-]{10,}$/i);
      expect(isNonMunicipioTroop(occ.municipio)).toBe(false);
      expect(occ.focos).toBeLessThan(100); // Nunca números absurdos como 346866
      expect(occ.area).toBeLessThan(100000);
    }
  });
});
