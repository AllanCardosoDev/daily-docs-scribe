import { memo, useCallback, useEffect, useState } from "react";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { AlertCircle, Eye, SlidersHorizontal } from "lucide-react";
import { NF } from "@/lib/formatters";
import { useAutosave } from "@/hooks/use-autosave";
import { SaveStatusBadge } from "./SaveStatusBadge";
import { EfetivoColumnsDialog } from "./EfetivoColumnsDialog";
import { saveStoredEfetivoColumns } from "@/lib/dashboard-columns";

export interface Column {
  key: string;
  label: string;
  numeric?: boolean;
  editable?: boolean;
}

type Row = Record<string, any>;

function getColumnWidthCls(c: Column, isFirst: boolean): string {
  if (c.key === "endereco") return "min-w-[280px]";
  if (c.key === "natureza") return "min-w-[190px]";
  if (c.key === "municipio" || c.key === "mun") return "min-w-[280px] w-[280px]";
  if (c.key === "data") return "min-w-[110px]";
  if (c.key === "horario") return "min-w-[90px]";
  if (isFirst) return "min-w-[280px] w-[280px]";
  if (c.numeric) return "min-w-[92px]";
  return "min-w-[140px]";
}

interface Props {
  title: string;
  columns: Column[];
  rows: readonly Row[];
  badgeText?: string;
  emptyMessage?: string;
  editable?: boolean;
  allowManageColumns?: boolean;
  onColumnsChange?: (columns: Column[]) => void;
  onRowsChange?: (rows: Row[]) => Promise<void> | void;
  onRowClick?: (row: Row) => void;
  className?: string;
}

export const DataTable = memo(function DataTable({
  title,
  columns,
  rows,
  badgeText,
  emptyMessage = "Sem dados.",
  editable = false,
  allowManageColumns,
  onColumnsChange,
  onRowsChange,
  onRowClick,
  className,
}: Props) {
  const [activeColumns, setActiveColumns] = useState<Column[]>(() => [...columns]);
  const [manageColsOpen, setManageColsOpen] = useState(false);
  const isEfetivoTable = title.toLowerCase().includes("efetivo");
  const canManage = allowManageColumns ?? isEfetivoTable;

  useEffect(() => {
    setActiveColumns([...columns]);
  }, [columns]);

  const [local, setLocal] = useState<Row[]>(() => [...rows]);
  const { status, errorMessage, scheduleSave, isDirtyRef } = useAutosave<Row[]>({
    onSave: async (next) => {
      if (onRowsChange) await onRowsChange(next);
    },
  });

  // sync from props when server data refreshes, unless a local edit is pending
  useEffect(() => {
    if (!isDirtyRef.current) setLocal([...rows]);
  }, [rows, isDirtyRef]);

  const updateCell = useCallback(
    (rowIdx: number, key: string, value: string, numeric?: boolean) => {
      setLocal((prev) => {
        const next = prev.map((r, i) => {
          if (i !== rowIdx) return r;

          let nextVal: string | number = value;
          if (numeric) {
            const n = Number(value.replace(",", "."));
            nextVal = value === "" || !Number.isFinite(n) ? 0 : n;
          }

          const updatedRow = { ...r, [key]: nextVal };
          if (key === "cbmam") {
            updatedRow.ord = nextVal;
            updatedRow.servico = nextVal;
          } else if (key === "ord" || key === "servico") {
            updatedRow.cbmam = nextVal;
          }

          // Se a coluna 'total_periodo' existir e for um campo numérico sendo editado
          // que não seja o próprio total_periodo ou o 'total' (calculado)
          if (numeric && key !== "total_periodo" && key !== "total" && "total_periodo" in r) {
            const oldVal = Number(r[key]) || 0;
            const newVal = Number(nextVal) || 0;
            const diff = newVal - oldVal;
            const oldTotalPeriodo = Number(r.total_periodo) || 0;
            updatedRow.total_periodo = oldTotalPeriodo + diff;
          }

          return updatedRow;
        });
        if (onRowsChange) scheduleSave(next);
        return next;
      });
    },
    [scheduleSave, onRowsChange],
  );

  const handleColumnsSaved = useCallback(
    (newCols: Column[]) => {
      setActiveColumns(newCols);
      if (onColumnsChange) onColumnsChange(newCols);
      if (isEfetivoTable) saveStoredEfetivoColumns(newCols);

      setLocal((prev) => {
        const next = prev.map((r) => {
          const copy = { ...r };
          for (const c of newCols) {
            if (c.numeric && copy[c.key] === undefined) {
              copy[c.key] = 0;
            }
          }
          return copy;
        });
        if (onRowsChange) scheduleSave(next);
        return next;
      });
    },
    [isEfetivoTable, onColumnsChange, onRowsChange, scheduleSave],
  );

  return (
    <Card
      className={`card-interactive border-border overflow-hidden animate-fade-in-soft ${className ?? ""}`}
    >
      <CardHeader className="pb-3 flex-row items-center justify-between space-y-0 gap-2 bg-gradient-brand-soft border-b border-border/60">
        <div className="flex items-center gap-2 min-w-0">
          <CardTitle className="text-sm sm:text-base font-semibold tracking-tight truncate min-w-0">
            {title}
          </CardTitle>
          <span
            className="shrink-0 inline-flex items-center rounded-full bg-card/70 border border-border text-[10px] font-semibold text-muted-foreground px-2 py-0.5 tabular-nums"
            aria-label={badgeText ?? `${local.length} linhas`}
          >
            {badgeText ?? `${NF.format(local.length)} municípios`}
          </span>
        </div>
        <div className="flex items-center gap-2">
          {canManage && (
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => setManageColsOpen(true)}
              className="h-8 text-xs font-semibold gap-1.5 bg-card/90 shadow-xs hover:bg-muted"
              title="Personalizar colunas (mudar nome, inserir ou remover)"
            >
              <SlidersHorizontal className="w-3.5 h-3.5 text-primary" />
              <span>Personalizar Colunas</span>
            </Button>
          )}
          {editable && <SaveStatusBadge status={status} errorMessage={errorMessage} />}
        </div>
      </CardHeader>
      <CardContent className="p-0">
        <div className="overflow-x-auto overscroll-x-contain [-webkit-overflow-scrolling:touch]">
          <Table className="w-full">
            <TableHeader>
              <TableRow className="bg-muted/40 hover:bg-muted/40">
                {activeColumns.map((c, idx) => {
                  const widthCls = getColumnWidthCls(c, idx === 0);
                  return (
                    <TableHead
                      key={c.key}
                      className={`whitespace-nowrap text-[11px] uppercase tracking-wide font-bold text-foreground p-1 ${widthCls}`}
                    >
                      <div
                        className={`h-9 w-full flex items-center px-3 ${
                          c.numeric ? "justify-center text-center" : "justify-start"
                        }`}
                      >
                        {c.label}
                      </div>
                    </TableHead>
                  );
                })}
                {onRowClick && (
                  <TableHead className="w-[80px] text-center p-1 text-[11px] uppercase tracking-wide font-bold text-foreground">
                    <div className="h-9 w-full flex items-center justify-center">
                      Detalhes
                    </div>
                  </TableHead>
                )}
              </TableRow>
            </TableHeader>
            <TableBody>
              {local.length === 0 ? (
                <EmptyRow colSpan={activeColumns.length + (onRowClick ? 1 : 0)} message={emptyMessage} />
              ) : (
                <>
                  {local.map((row, i) => {
                    const rowWithTotal = { ...row };
                    const totalCol = activeColumns.find((c) => c.key === "total" && !c.editable);
                    if (totalCol) {
                      const numericKeys = activeColumns.filter((c) => c.numeric && c.key !== "total" && c.key !== "total_periodo" && c.key !== "focos").map((c) => c.key);
                      const isEfetivo = numericKeys.includes("cbmam") || numericKeys.includes("servico") || numericKeys.includes("opamv") || numericKeys.includes("ord");
                      if (isEfetivo) {
                        rowWithTotal.total = (Number(row.cbmam) || Number(row.servico) || Number(row.ord) || 0) + (Number(row.opamv) || 0) + (Number(row.opam_ref) || 0) + (Number(row.inc1) || 0) + (Number(row.inc2) || 0) + (Number(row.inc3) || 0) + (Number(row.cbmsp) || 0) + (Number(row.prevfogo) || 0) + (Number(row.fn) || 0) + (Number(row.seg) || 0) + (Number(row.marinha) || 0) + (Number(row.brig_mun) || Number(row.brig) || 0) + (Number(row.brig_semas) || 0);
                      } else {
                        rowWithTotal.total = numericKeys.reduce((sum, k) => sum + (Number(row[k]) || 0), 0);
                      }
                    }

                    return (
                      <TableRow
                        key={i}
                        onClick={() => onRowClick?.(rowWithTotal)}
                        className={`transition-colors ${
                          onRowClick ? "cursor-pointer hover:bg-primary/10" : "hover:bg-primary/5"
                        } ${i % 2 === 1 ? "bg-muted/30" : ""}`}
                      >
                        {activeColumns.map((c, idx) => (
                          <DataCell
                            key={c.key}
                            column={c}
                            isFirst={idx === 0}
                            value={rowWithTotal[c.key]}
                            editable={!!editable && !!c.editable}
                            onChange={(v) => updateCell(i, c.key, v, c.numeric)}
                          />
                        ))}
                        {onRowClick && (
                          <TableCell className="p-1 align-middle text-center w-[80px]">
                            <Button
                              type="button"
                              variant="ghost"
                              size="sm"
                              className="h-7 px-2 text-xs font-semibold text-primary hover:text-primary hover:bg-primary/15 gap-1"
                              onClick={(e) => {
                                e.stopPropagation();
                                onRowClick(rowWithTotal);
                              }}
                              title="Visualizar relato completo da ocorrência"
                            >
                              <Eye className="w-3.5 h-3.5" />
                              Ver
                            </Button>
                          </TableCell>
                        )}
                      </TableRow>
                    );
                  })}
                  {/* Footer Total Row */}
                  <TableRow className="bg-muted/70 font-bold border-t-2 border-border/80">
                    {activeColumns.map((c, idx) => {
                      const isFirst = idx === 0;
                      const widthCls = getColumnWidthCls(c, isFirst);

                      if (isFirst) {
                        return (
                          <TableCell key="total-label" className={`p-1 align-middle ${widthCls}`}>
                            <div className="h-9 w-full flex items-center px-3 font-bold text-foreground">
                              Total
                            </div>
                          </TableCell>
                        );
                      }
                      if (c.numeric) {
                        const sum = local.reduce((acc, row) => {
                          if (c.key === "total") {
                            const numericKeys = activeColumns.filter((col) => col.numeric && col.key !== "total" && col.key !== "total_periodo" && col.key !== "focos").map((col) => col.key);
                            const isEfetivo = numericKeys.includes("cbmam") || numericKeys.includes("servico") || numericKeys.includes("opamv") || numericKeys.includes("ord");
                            if (isEfetivo) {
                              return acc + (Number(row.cbmam) || Number(row.servico) || Number(row.ord) || 0) + (Number(row.opamv) || 0) + (Number(row.opam_ref) || 0) + (Number(row.inc1) || 0) + (Number(row.inc2) || 0) + (Number(row.inc3) || 0) + (Number(row.cbmsp) || 0) + (Number(row.prevfogo) || 0) + (Number(row.fn) || 0) + (Number(row.seg) || 0) + (Number(row.marinha) || 0) + (Number(row.brig_mun) || Number(row.brig) || 0) + (Number(row.brig_semas) || 0);
                            }
                            return acc + numericKeys.reduce((s, k) => s + (Number(row[k]) || 0), 0);
                          }
                          return acc + (Number(row[c.key]) || 0);
                        }, 0);
                        return (
                          <TableCell key={c.key} className={`p-1 align-middle ${widthCls}`}>
                            <div className="h-9 w-full flex items-center justify-center px-3 text-center tabular-nums font-bold text-foreground">
                              {NF.format(sum)}
                            </div>
                          </TableCell>
                        );
                      }
                      return (
                        <TableCell key={c.key} className={`p-1 align-middle ${widthCls}`}>
                          <div className="h-9 w-full" />
                        </TableCell>
                      );
                    })}
                    {onRowClick && (
                      <TableCell key="total-action" className="p-1 align-middle text-center w-[80px]">
                        <div className="h-9 w-full" />
                      </TableCell>
                    )}
                  </TableRow>
                </>
              )}
            </TableBody>
          </Table>
        </div>
      </CardContent>
      {canManage && (
        <EfetivoColumnsDialog
          open={manageColsOpen}
          onOpenChange={setManageColsOpen}
          columns={activeColumns}
          onSave={handleColumnsSaved}
        />
      )}
    </Card>
  );
});

const OCCURRENCE_KEYS = new Set([
  "urb",
  "flor",
  "focos",
  "salvamento",
  "acidentes",
  "aph",
  "prevencao",
  "servicos",
  "total_periodo",
]);

/** Single cell — read-only or editable — kept local to isolate rendering logic. */
function DataCell({
  column,
  value,
  editable,
  isFirst,
  onChange,
}: {
  column: Column;
  value: unknown;
  editable: boolean;
  isFirst: boolean;
  onChange: (next: string) => void;
}) {
  const widthCls = getColumnWidthCls(column, isFirst);

  if (editable) {
    const isNum = column.numeric;
    const numVal = isNum ? Number(value) || 0 : 0;
    const isRed = isNum && numVal > 0 && OCCURRENCE_KEYS.has(column.key);
    return (
      <TableCell className={`p-1 align-middle ${widthCls}`}>
        <Input
          type={column.numeric ? "number" : "text"}
          inputMode={column.numeric ? "numeric" : undefined}
          value={(value as string | number | undefined) ?? ""}
          onChange={(e) => onChange(e.target.value)}
          title={String(value ?? "")}
          className={`h-9 w-full border-transparent hover:border-border focus:border-ring transition-colors px-3 ${
            column.numeric
              ? `text-center tabular-nums [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none ${
                  isRed
                    ? "border-red-500/50 bg-red-50/30 dark:bg-red-950/20 text-red-600 dark:text-red-400 font-bold"
                    : "font-normal text-foreground bg-transparent"
                }`
              : "font-bold text-foreground bg-transparent whitespace-nowrap"
          }`}
          aria-label={column.label}
        />
      </TableCell>
    );
  }
  const isNum = column.numeric;
  const numVal = isNum ? Number(value) || 0 : 0;
  const isRed = isNum && numVal > 0 && OCCURRENCE_KEYS.has(column.key);
  return (
    <TableCell className={`p-1 align-middle ${widthCls}`}>
      <div
        title={String(value ?? "")}
        className={`h-9 w-full flex items-center px-3 ${
          column.numeric
            ? `justify-center text-center tabular-nums whitespace-nowrap ${
                isRed ? "text-red-600 dark:text-red-400 font-bold" : "font-normal text-foreground"
              }`
            : "justify-start whitespace-nowrap font-bold text-foreground"
        }`}
      >
        {column.numeric ? NF.format(Number(value) || 0) : String(value ?? "")}
      </div>
    </TableCell>
  );
}

function EmptyRow({ colSpan, message }: { colSpan: number; message: string }) {
  return (
    <TableRow>
      <TableCell colSpan={colSpan} className="text-center text-muted-foreground py-10">
        <div className="flex flex-col items-center gap-2 opacity-80">
          <div className="w-10 h-10 rounded-full bg-muted flex items-center justify-center">
            <AlertCircle className="w-5 h-5 text-muted-foreground/70" aria-hidden="true" />
          </div>
          <span className="text-sm">{message}</span>
        </div>
      </TableCell>
    </TableRow>
  );
}
