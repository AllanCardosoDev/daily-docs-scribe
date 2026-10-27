import { describe, it, expect } from "vitest";
import {
  isManaus,
  compareMunicipios,
  sortByMunicipio,
  manausFirst,
  manausFirstSheets,
  harmonizeMunicipalitySections,
} from "../municipio-order";

describe("municipio-order", () => {
  describe("isManaus", () => {
    it("deve identificar variações de Manaus corretamente", () => {
      expect(isManaus("Manaus")).toBe(true);
      expect(isManaus("manaus")).toBe(true);
      expect(isManaus("MANAUS")).toBe(true);
      expect(isManaus(" Manaus ")).toBe(true);
      expect(isManaus("Manáus")).toBe(true); // Com acento
    });

    it("deve retornar false para outros municípios", () => {
      expect(isManaus("Humaitá")).toBe(false);
      expect(isManaus("Parintins")).toBe(false);
      expect(isManaus(null)).toBe(false);
      expect(isManaus(undefined)).toBe(false);
    });
  });

  describe("compareMunicipios", () => {
    it("deve colocar Manaus sempre em primeiro", () => {
      expect(compareMunicipios("Manaus", "Apuí")).toBe(-1);
      expect(compareMunicipios("Humaitá", "Manaus")).toBe(1);
    });

    it("deve ordenar demais municípios em ordem alfabética (pt-BR)", () => {
      expect(compareMunicipios("Apuí", "Boca do Acre")).toBeLessThan(0);
      expect(compareMunicipios("Parintins", "Itacoatiara")).toBeGreaterThan(0);
    });
  });

  describe("sortByMunicipio", () => {
    it("deve ordenar array de objetos com Manaus no topo", () => {
      const input = [{ mun: "Parintins" }, { mun: "Apuí" }, { mun: "Manaus" }];
      const result = sortByMunicipio(input);
      expect(result).toEqual([{ mun: "Manaus" }, { mun: "Apuí" }, { mun: "Parintins" }]);
    });
  });

  describe("manausFirst", () => {
    it("deve mover Manaus para o topo mantendo a ordem relativa dos demais", () => {
      const input = [{ mun: "Tefé" }, { mun: "Humaitá" }, { mun: "Manaus" }, { mun: "Coari" }];
      const result = manausFirst(input);
      expect(result).toEqual([
        { mun: "Manaus" },
        { mun: "Tefé" },
        { mun: "Humaitá" },
        { mun: "Coari" },
      ]);
    });

    it("deve retornar a lista inalterada se Manaus não estiver presente", () => {
      const input = [{ mun: "Coari" }, { mun: "Tefé" }];
      expect(manausFirst(input)).toEqual(input);
    });
  });

  describe("manausFirstSheets", () => {
    it("deve aplicar manausFirst a todas as seções conhecidas de SheetsData", () => {
      const data = {
        efetivo: [{ mun: "Apuí" }, { mun: "Manaus" }],
        incendios_diario: [{ mun: "Tefé" }, { mun: "Manaus" }],
        outras: "valor_não_array",
      };

      const result = manausFirstSheets(data);
      expect(result.efetivo).toEqual([{ mun: "Manaus" }, { mun: "Apuí" }]);
      expect(result.incendios_diario).toEqual([{ mun: "Manaus" }, { mun: "Tefé" }]);
      expect(result.outras).toBe("valor_não_array");
    });
  });

  describe("harmonizeMunicipalitySections", () => {
    it("deve unificar e alinhar a lista de municípios exatamente igual entre efetivo, recursos e incêndios", () => {
      const efetivo = [{ mun: "Manaus", ord: 10 }, { mun: "Tefé", ord: 5 }];
      const recursos = [{ mun: "Manaus", viaturas: 3 }, { mun: "Iranduba", viaturas: 2 }];
      const incendios = [{ mun: "Iranduba", urb: 1 }, { mun: "Parintins", urb: 4 }];

      const harmonized = harmonizeMunicipalitySections(
        efetivo,
        recursos,
        incendios,
        (mun) => ({ mun, ord: 0 }),
        (mun) => ({ mun, viaturas: 0 }),
        (mun) => ({ mun, urb: 0 }),
      );

      const expectedMuns = ["Manaus", "Iranduba", "Parintins", "Tefé"];
      expect(harmonized.efetivo.map((r) => r.mun)).toEqual(expectedMuns);
      expect(harmonized.recursos.map((r) => r.mun)).toEqual(expectedMuns);
      expect(harmonized.incendios.map((r) => r.mun)).toEqual(expectedMuns);

      // Valores existentes preservados:
      expect(harmonized.efetivo.find((r) => r.mun === "Tefé")?.ord).toBe(5);
      expect(harmonized.recursos.find((r) => r.mun === "Iranduba")?.viaturas).toBe(2);
      expect(harmonized.incendios.find((r) => r.mun === "Parintins")?.urb).toBe(4);

      // Linhas faltantes preenchidas com defaults:
      expect(harmonized.efetivo.find((r) => r.mun === "Parintins")?.ord).toBe(0);
      expect(harmonized.recursos.find((r) => r.mun === "Tefé")?.viaturas).toBe(0);
      expect(harmonized.incendios.find((r) => r.mun === "Manaus")?.urb).toBe(0);
    });

    it("nunca deve incluir tropas externas como Militares São Paulo-SP em recursos ou incêndios", () => {
      const efetivo = [{ mun: "Manaus", ord: 10 }, { mun: "Militares São Paulo-SP", ord: 25 }];
      const recursos = [{ mun: "Manaus", viaturas: 2 }];
      const incendios = [{ mun: "Manaus", urb: 1 }];

      const harmonized = harmonizeMunicipalitySections(
        efetivo,
        recursos,
        incendios,
        (mun) => ({ mun, ord: 0 }),
        (mun) => ({ mun, viaturas: 0 }),
        (mun) => ({ mun, urb: 0 }),
      );

      expect(harmonized.recursos.some((r) => r.mun.includes("São Paulo-SP"))).toBe(false);
      expect(harmonized.incendios.some((r) => r.mun.includes("São Paulo-SP"))).toBe(false);
      expect(harmonized.recursos.map((r) => r.mun)).toEqual(["Manaus"]);
    });
  });
});
