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
import { AlertCircle } from "lucide-react";
import { NF } from "@/lib/formatters";
import { useAutosave } from "@/hooks/use-autosave";
import { SaveStatusBadge } from "./SaveStatusBadge";

export interface Column {
  key: string;
  label: string;
  numeric?: boolean;
  editable?: boolean;
}

type Row = Record<string, any>;

interface Props {
  title: string;
  columns: Column[];
  rows: readonly Row[];
  emptyMessage?: string;
  editable?: boolean;
  onRowsChange?: (rows: Row[]) => Promise<void> | void;
  className?: string;
}

export const DataTable = memo(function DataTable({
  title,
  columns,
  rows,
  emptyMessage = "Sem dados.",
  editable = false,
  onRowsChange,
  className,
}: Props) {
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
            aria-label={`${local.length} linhas`}
          >
            {NF.format(local.length)}
          </span>
        </div>
        {editable && <SaveStatusBadge status={status} errorMessage={errorMessage} />}
      </CardHeader>
      <CardContent className="p-0">
        <div className="overflow-x-auto overscroll-x-contain [-webkit-overflow-scrolling:touch]">
          <Table className="w-full">
            <TableHeader>
              <TableRow className="bg-muted/40 hover:bg-muted/40">
                {columns.map((c, idx) => {
                  const widthCls =
                    idx === 0
                      ? "min-w-[160px]"
                      : c.numeric
                        ? "min-w-[92px]"
                        : "min-w-[140px]";
                  return (
                    <TableHead
                      key={c.key}
                      className={`whitespace-nowrap text-[11px] uppercase tracking-wide font-bold text-foreground p-1 ${widthCls}`}
                    >
                      <div
                        className={`h-9 w-full flex items-center px-3 ${
                          c.numeric ? "justify-end text-right" : "justify-start"
                        }`}
                      >
                        {c.label}
                      </div>
                    </TableHead>
                  );
                })}
              </TableRow>
            </TableHeader>
            <TableBody>
              {local.length === 0 ? (
                <EmptyRow colSpan={columns.length} message={emptyMessage} />
              ) : (
                <>
                  {local.map((row, i) => {
                    // Calculate row total if 'total' column exists and is not editable
                    const rowWithTotal = { ...row };
                    const totalCol = columns.find((c) => c.key === "total" && !c.editable);
                    if (totalCol) {
                      rowWithTotal.total = columns
                        .filter(
                          (c) =>
                            c.numeric &&
                            c.key !== "total" &&
                            c.key !== "total_periodo" &&
                            c.key !== "focos",
                        )
                        .reduce((sum, c) => sum + (Number(row[c.key]) || 0), 0);
                    }

                    return (
                      <TableRow
                        key={i}
                        className={`transition-colors hover:bg-primary/5 ${
                          i % 2 === 1 ? "bg-muted/30" : ""
                        }`}
                      >
                        {columns.map((c, idx) => (
                          <DataCell
                            key={c.key}
                            column={c}
                            isFirst={idx === 0}
                            value={rowWithTotal[c.key]}
                            editable={!!editable && !!c.editable}
                            onChange={(v) => updateCell(i, c.key, v, c.numeric)}
                          />
                        ))}
                      </TableRow>
                    );
                  })}
                  {/* Footer Total Row */}
                  <TableRow className="bg-muted/70 font-bold border-t-2 border-border/80">
                    {columns.map((c, idx) => {
                      const isFirst = idx === 0;
                      const widthCls = isFirst
                        ? "min-w-[160px]"
                        : c.numeric
                          ? "min-w-[92px]"
                          : "min-w-[140px]";

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
                            // Sum of row totals
                            return (
                              acc +
                              columns
                                .filter(
                                  (col) =>
                                    col.numeric &&
                                    col.key !== "total" &&
                                    col.key !== "total_periodo" &&
                                    col.key !== "focos",
                                )
                                .reduce((s, col) => s + (Number(row[col.key]) || 0), 0)
                            );
                          }
                          return acc + (Number(row[c.key]) || 0);
                        }, 0);
                        return (
                          <TableCell key={c.key} className={`p-1 align-middle ${widthCls}`}>
                            <div className="h-9 w-full flex items-center justify-end px-3 text-right tabular-nums font-bold text-foreground">
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
                  </TableRow>
                </>
              )}
            </TableBody>
          </Table>
        </div>
      </CardContent>
    </Card>
  );
});

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
  const widthCls = isFirst ? "min-w-[160px]" : column.numeric ? "min-w-[92px]" : "min-w-[140px]";

  if (editable) {
    return (
      <TableCell className={`p-1 align-middle ${widthCls}`}>
        <Input
          type={column.numeric ? "number" : "text"}
          inputMode={column.numeric ? "numeric" : undefined}
          value={(value as string | number | undefined) ?? ""}
          onChange={(e) => onChange(e.target.value)}
          className={`h-9 w-full bg-transparent border-transparent hover:border-border focus:border-ring transition-colors px-3 ${
            column.numeric
              ? "text-right tabular-nums font-normal text-foreground [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
              : "font-bold text-foreground"
          }`}
          aria-label={column.label}
        />
      </TableCell>
    );
  }
  return (
    <TableCell className={`p-1 align-middle ${widthCls}`}>
      <div
        className={`h-9 w-full flex items-center px-3 ${
          column.numeric
            ? "justify-end text-right tabular-nums font-normal whitespace-nowrap"
            : "justify-start break-words whitespace-normal leading-snug font-bold text-foreground"
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
