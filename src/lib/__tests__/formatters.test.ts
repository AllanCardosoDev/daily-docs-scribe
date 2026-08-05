import { describe, it, expect } from "vitest";
import { fmtDateStamp, NF } from "../formatters";

describe("formatters", () => {
  it("fmtDateStamp deve formatar data no padrão YYYYMMDD com padding correto", () => {
    const testDate = new Date(2026, 7, 3); // 3 de agosto de 2026 (mês 7 é agosto em JS 0-index)
    expect(fmtDateStamp(testDate)).toBe("20260803");
  });

  it("NF deve formatar números no padrão brasileiro pt-BR", () => {
    expect(NF.format(1000)).toBe("1.000");
    expect(NF.format(1234567)).toBe("1.234.567");
    expect(NF.format(0)).toBe("0");
  });
});
