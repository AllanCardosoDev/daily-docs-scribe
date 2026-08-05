/**
 * Pure diff helpers for the daily report audit trail.
 * Compares two snapshots of a daily report and lists field-level changes.
 */

export type AuditChange = {
  section: string;
  row: string;
  field: string;
  before: string;
  after: string;
  kind: "added" | "removed" | "changed";
};

type Snapshot = Record<string, any> | null | undefined;

const SECTIONS: { key: string; label: string; fields: Record<string, string> }[] = [
  {
    key: "efetivo",
    label: "Efetivo",
    fields: { ord: "Ordinário", seg: "Segurança", brig: "Brigadistas" },
  },
  {
    key: "recursos",
    label: "Recursos",
    fields: { viaturas: "Viaturas", aeronaves: "Aeronaves", embarcacoes: "Embarcações" },
  },
  {
    key: "incendios",
    label: "Incêndios",
    fields: { urb: "Urbanos", flor: "Florestais", focos: "Focos" },
  },
  {
    key: "outras",
    label: "Ocorrências",
    fields: {
      salvamento: "Salvamento",
      acidentes: "Acidentes",
      aph: "APH",
      prevencao: "Prevenção",
      servicos: "Serviços",
    },
  },
];

const str = (v: unknown) => (v === null || v === undefined || v === "" ? "0" : String(v));

function indexRows(rows: unknown): Map<string, any> {
  const map = new Map<string, any>();
  if (!Array.isArray(rows)) return map;
  rows.forEach((r: any, i) => {
    const key = String(r?.mun ?? "").trim() || `Linha ${i + 1}`;
    map.set(key, r ?? {});
  });
  return map;
}

/** Lists every field that differs between two report snapshots. */
export function diffDailyReport(prev: Snapshot, next: Snapshot): AuditChange[] {
  const changes: AuditChange[] = [];

  for (const section of SECTIONS) {
    const a = indexRows(prev?.[section.key]);
    const b = indexRows(next?.[section.key]);
    const keys = Array.from(new Set([...a.keys(), ...b.keys()]));

    for (const key of keys) {
      const rowA = a.get(key);
      const rowB = b.get(key);

      if (!rowA && rowB) {
        changes.push({
          section: section.label,
          row: key,
          field: "Município",
          before: "—",
          after: "linha adicionada",
          kind: "added",
        });
      } else if (rowA && !rowB) {
        changes.push({
          section: section.label,
          row: key,
          field: "Município",
          before: "linha existente",
          after: "removida",
          kind: "removed",
        });
        continue;
      }

      for (const [field, label] of Object.entries(section.fields)) {
        const before = str(rowA?.[field]);
        const after = str(rowB?.[field]);
        if (before !== after && !(!rowA && after === "0")) {
          changes.push({
            section: section.label,
            row: key,
            field: label,
            before,
            after,
            kind: rowA ? "changed" : "added",
          });
        }
      }
    }
  }

  const notesA = String(prev?.notes ?? "").trim();
  const notesB = String(next?.notes ?? "").trim();
  if (notesA !== notesB) {
    changes.push({
      section: "Observações",
      row: "Notas do serviço na sala",
      field: "Texto",
      before: notesA || "—",
      after: notesB || "—",
      kind: "changed",
    });
  }

  return changes;
}
