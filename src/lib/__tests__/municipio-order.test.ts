import { describe, it, expect } from "vitest";
import {
  isManaus,
  compareMunicipios,
  sortByMunicipio,
  manausFirst,
  manausFirstSheets,
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
});
