import { describe, it, expect } from "vitest";
import {
  DEFAULT_EFETIVO_COLUMNS,
  sanitizeEfetivoColumns,
  resolveEfetivoColumns,
} from "../dashboard-columns";

describe("Efetivo Columns Deduplication", () => {
  it("DEFAULT_EFETIVO_COLUMNS não deve conter colunas repetidas", () => {
    const keys = DEFAULT_EFETIVO_COLUMNS.map((c) => c.key);
    const labels = DEFAULT_EFETIVO_COLUMNS.map((c) => c.label);

    // Chaves únicas
    expect(new Set(keys).size).toBe(keys.length);
    // Labels únicos
    expect(new Set(labels).size).toBe(labels.length);

    // Não deve conter 'sec' (apenas 'seg')
    expect(keys).not.toContain("sec");
    expect(keys).toContain("seg");

    // Não deve conter 'brig' duplicando 'brig_mun' e 'brig_semas'
    expect(keys).not.toContain("brig");
    expect(keys).toContain("brig_mun");
    expect(keys).toContain("brig_semas");
  });

  it("sanitizeEfetivoColumns deve remover colunas repetidas e metadados", () => {
    const dirtyCols = [
      { key: "mun", label: "Município" },
      { key: "cbmam", label: "CBMAM", numeric: true },
      { key: "ord", label: "CBMAM (Ordinário)", numeric: true },
      { key: "servico", label: "Serviço", numeric: true },
      { key: "sec", label: "SEC", numeric: true },
      { key: "seg", label: "SEG", numeric: true },
      { key: "brig_mun", label: "Brig. Mun", numeric: true },
      { key: "brig_semas", label: "Brig. SEMA", numeric: true },
      { key: "brig", label: "Brig. Total", numeric: true },
      { key: "tipo", label: "Tipo", numeric: true },
      { key: "_custom", label: "Custom", numeric: true },
      { key: "total", label: "Total", numeric: true },
    ];

    const cleaned = sanitizeEfetivoColumns(dirtyCols as any);
    const cleanedKeys = cleaned.map((c) => c.key);

    expect(cleanedKeys).toContain("mun");
    expect(cleanedKeys).toContain("cbmam");
    expect(cleanedKeys).toContain("seg");
    expect(cleanedKeys).toContain("brig_mun");
    expect(cleanedKeys).toContain("brig_semas");
    expect(cleanedKeys).toContain("total");

    // Proibidas / repetidas
    expect(cleanedKeys).not.toContain("ord");
    expect(cleanedKeys).not.toContain("servico");
    expect(cleanedKeys).not.toContain("sec");
    expect(cleanedKeys).not.toContain("brig");
    expect(cleanedKeys).not.toContain("tipo");
    expect(cleanedKeys).not.toContain("_custom");
  });

  it("resolveEfetivoColumns não deve gerar colunas duplicadas a partir de linhas com campos internos", () => {
    const sampleRows = [
      {
        mun: "Manaus",
        ord: 406,
        servico: 406,
        serv_ord: 406,
        cbmam: 406,
        seg: 41,
        sec: 0,
        brig: 0,
        brig_mun: 0,
        brig_semas: 0,
        tipo: "capital",
        _custom: true,
      },
    ];

    const resolved = resolveEfetivoColumns(sampleRows);
    const resolvedKeys = resolved.map((c) => c.key);

    expect(resolvedKeys).toContain("cbmam");
    expect(resolvedKeys).toContain("seg");
    expect(resolvedKeys).not.toContain("ord");
    expect(resolvedKeys).not.toContain("servico");
    expect(resolvedKeys).not.toContain("serv_ord");
    expect(resolvedKeys).not.toContain("sec");
    expect(resolvedKeys).not.toContain("brig");
    expect(resolvedKeys).not.toContain("tipo");
    expect(resolvedKeys).not.toContain("_custom");
  });
});
