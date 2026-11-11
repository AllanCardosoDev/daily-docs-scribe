import { describe, it, expect } from "vitest";
import {
  isFlorestalAmbiental,
  isNonFireActivity,
  isIncendio,
  classifyFire,
} from "../fire-classification";

describe("fire-classification", () => {
  describe("Florestais", () => {
    it("deve classificar naturezas florestais e de vegetação como florestal", () => {
      expect(classifyFire("Incêndio Florestal")).toBe("florestal");
      expect(classifyFire("Incêndio Em Vegetação")).toBe("florestal");
      expect(classifyFire("INCÊNDIO EM LAVOURA, PASTAGEM, MATA OU FLORESTA")).toBe("florestal");
      expect(classifyFire("PROVOCAR INCÊNDIO EM FLORESTA OU EM DEMAIS FORMAS DE VEGETAÇÃO")).toBe("florestal");
    });

    it("deve classificar lixo, entulho e lixão como florestal conforme orientação", () => {
      expect(classifyFire("Incêndio Em Amontoado de Lixo/entulho")).toBe("florestal");
      expect(classifyFire("INCÊNDIO EM LIXÃO")).toBe("florestal");
      expect(classifyFire("FOGO EM LIXO")).toBe("florestal");
    });

    it("deve classificar registros combinados com vegetação/lixo como florestal", () => {
      expect(classifyFire("Incêndio Em Vegetação, Incêndio Florestal")).toBe("florestal");
      expect(classifyFire("Incêndio Em Amontoado de Lixo/entulho, Incêndio Em Vegetação")).toBe("florestal");
      expect(classifyFire("Incêndio Em Rede Elétrica, Incêndio Em Vegetação")).toBe("florestal");
      expect(classifyFire("Incêndio Em Residência, Incêndio Em Vegetação, Incêndio Florestal")).toBe("florestal");
    });
  });

  describe("Urbanos", () => {
    it("deve classificar residências, comércios e edificações como urbano", () => {
      expect(classifyFire("Incêndio Em Residência")).toBe("urbano");
      expect(classifyFire("INCÊNDIO EM CASA HABITADA OU DESTINADA A HABITAÇÃO")).toBe("urbano");
      expect(classifyFire("Incêndio Em Estabelecimento Comercial Ou Serviço")).toBe("urbano");
      expect(classifyFire("INCÊNDIO EM EDIFICAÇÃO")).toBe("urbano");
      expect(classifyFire("Incêndio Em Fábrica / Indústria")).toBe("urbano");
    });

    it("deve classificar rede elétrica e veículos como urbano", () => {
      expect(classifyFire("Incêndio Em Rede Elétrica")).toBe("urbano");
      expect(classifyFire("Incêndio Em Veículo")).toBe("urbano");
      expect(classifyFire("INCÊNDIO EM MEIO DE TRANSPORTE")).toBe("urbano");
      expect(classifyFire("INCÊNDIO EM EMBARCAÇÃO, AERONAVE, COMBOIO")).toBe("urbano");
    });

    it("deve classificar princípio de incêndio e incêndios genéricos sem vegetação/lixo como urbano", () => {
      expect(classifyFire("INCÊNDIO - OUTROS TIPOS DE INCÊNDIO")).toBe("urbano");
      expect(classifyFire("PRINCÍPIO DE INCÊNDIO")).toBe("urbano");
      expect(classifyFire("Incêndio")).toBe("urbano");
    });
  });

  describe("Exclusões obrigatórias (não-incêndio)", () => {
    it("deve excluir ações preventivas mesmo que mencionem incêndio florestal", () => {
      expect(isNonFireActivity("Ação Preventiva a Incêndio Florestal")).toBe(true);
      expect(isIncendio("Ação Preventiva a Incêndio Florestal")).toBe(false);
      expect(classifyFire("Ação Preventiva a Incêndio Florestal")).toBe("outros");

      expect(isNonFireActivity("Ações de Prevenção Contra Incêndio")).toBe(true);
      expect(isIncendio("Ações de Prevenção Contra Incêndio")).toBe(false);
      expect(classifyFire("Ações de Prevenção Contra Incêndio")).toBe("outros");

      expect(isNonFireActivity("Orientação Preventiva de Incêndio Florestal")).toBe(true);
      expect(isIncendio("Orientação Preventiva de Incêndio Florestal")).toBe(false);
      expect(classifyFire("Orientação Preventiva de Incêndio Florestal")).toBe("outros");

      expect(isNonFireActivity("Monitoramento de Incêndio Florestal")).toBe(true);
      expect(isIncendio("Monitoramento de Incêndio Florestal")).toBe(false);
      expect(classifyFire("Monitoramento de Incêndio Florestal")).toBe("outros");
    });

    it("deve excluir testes de sistema, simulados, trotes e finalizações por inatividade", () => {
      expect(isIncendio("Teste de Sistema")).toBe(false);
      expect(isIncendio("TESTE DE SISTEMA")).toBe(false);
      expect(isIncendio("Trote")).toBe(false);
      expect(isIncendio("Simulado de Evacuação")).toBe(false);
      expect(isIncendio("FINALIZAÇÃO AUTOMÁTICA POR TEMPO DE INATIVIDADE")).toBe(false);
      expect(classifyFire("FINALIZAÇÃO AUTOMÁTICA POR TEMPO DE INATIVIDADE")).toBe("outros");
    });

    it("deve excluir serviços técnicos e resgates que não sejam combate a fogo", () => {
      expect(isIncendio("Captura de Insetos / Abelhas / Similares")).toBe(false);
      expect(isIncendio("Corte de Árvore em Risco")).toBe(false);
      expect(isIncendio("Atendimento Pré-hospitalar - Clínico")).toBe(false);
      expect(isIncendio("Salvamento Terrestre")).toBe(false);
      expect(isIncendio("Apoio a Outros Órgãos")).toBe(false);
    });

    it("deve retornar 'outros' e false para valores nulos, vazios ou hífen", () => {
      expect(isIncendio(null)).toBe(false);
      expect(isIncendio(undefined)).toBe(false);
      expect(isIncendio("-")).toBe(false);
      expect(isIncendio("")).toBe(false);
      expect(classifyFire("-")).toBe("outros");
    });
  });
});
