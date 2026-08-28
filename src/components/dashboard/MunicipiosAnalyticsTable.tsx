import { memo, useState, useMemo } from "react";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  CardDescription,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  ArrowUpDown,
  Download,
  Flame,
  ShieldAlert,
  Users,
  Truck,
  TrendingUp,
  MapPin,
  CheckCircle2,
} from "lucide-react";
import { NF } from "@/lib/formatters";

export interface MunicipioRowData {
  municipio: string;
  calha?: string;
  incendiosFlorestais: number;
  incendiosUrbanos: number;
  totalIncendios: number;
  efetivoTotal: number;
  viaturasTotal: number;
  outrasOcorrencias: number;
  severidade: "critico" | "alto" | "moderado" | "estavel";
}

interface Props {
  rows: MunicipioRowData[];
  onSelectMunicipio?: (m: string) => void;
}

type SortField =
  | "municipio"
  | "incendiosFlorestais"
  | "incendiosUrbanos"
  | "totalIncendios"
  | "efetivoTotal"
  | "viaturasTotal"
  | "outrasOcorrencias";

export const MunicipiosAnalyticsTable = memo(function MunicipiosAnalyticsTable({
  rows,
  onSelectMunicipio,
}: Props) {
  const [sortField, setSortField] = useState<SortField>("totalIncendios");
  const [sortAsc, setSortAsc] = useState(false);

  const handleSort = (field: SortField) => {
    if (sortField === field) {
      setSortAsc(!sortAsc);
    } else {
      setSortField(field);
      setSortAsc(false);
    }
  };

  const sortedRows = useMemo(() => {
    return [...rows].sort((a, b) => {
      let valA = a[sortField];
      let valB = b[sortField];

      if (typeof valA === "string" && typeof valB === "string") {
        return sortAsc
          ? valA.localeCompare(valB, "pt-BR")
          : valB.localeCompare(valA, "pt-BR");
      }

      const numA = Number(valA) || 0;
      const numB = Number(valB) || 0;
      return sortAsc ? numA - numB : numB - numA;
    });
  }, [rows, sortField, sortAsc]);

  const maxFires = useMemo(() => {
    return Math.max(...rows.map((r) => r.totalIncendios), 1);
  }, [rows]);

  const totals = useMemo(() => {
    return rows.reduce(
      (acc, r) => ({
        florestal: acc.florestal + r.incendiosFlorestais,
        urbano: acc.urbano + r.incendiosUrbanos,
        total: acc.total + r.totalIncendios,
        efetivo: acc.efetivo + r.efetivoTotal,
        viaturas: acc.viaturas + r.viaturasTotal,
        outras: acc.outras + r.outrasOcorrencias,
      }),
      { florestal: 0, urbano: 0, total: 0, efetivo: 0, viaturas: 0, outras: 0 }
    );
  }, [rows]);

  const exportCsv = () => {
    const headers = [
      "Município",
      "Calha/Região",
      "Incêndios Florestais",
      "Incêndios Urbanos",
      "Total Incêndios",
      "Efetivo Mobilizado",
      "Viaturas/Recursos",
      "Outras Ocorrências",
      "Nível de Criticidade",
    ];

    const lines = sortedRows.map((r) => [
      `"${r.municipio}"`,
      `"${r.calha ?? "—"}"`,
      r.incendiosFlorestais,
      r.incendiosUrbanos,
      r.totalIncendios,
      r.efetivoTotal,
      r.viaturasTotal,
      r.outrasOcorrencias,
      `"${r.severidade.toUpperCase()}"`,
    ]);

    const csvContent =
      "data:text/csv;charset=utf-8,\uFEFF" +
      [headers.join(";"), ...lines.map((l) => l.join(";"))].join("\n");

    const encodedUri = encodeURI(csvContent);
    const link = document.createElement("a");
    link.setAttribute("href", encodedUri);
    link.setAttribute("download", `relatorio_analitico_municipios_${Date.now()}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  return (
    <Card className="border-border shadow-sm overflow-hidden bg-card">
      <CardHeader className="p-4 sm:p-5 border-b border-border flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <CardTitle className="text-base font-bold text-foreground flex items-center gap-2">
            <MapPin className="w-4 h-4 text-emerald-600" />
            Matriz Analítica Municipal Detalhada ({rows.length} Municípios)
          </CardTitle>
          <CardDescription className="text-xs">
            Desempenho operacional comparativo por município com ordenação dinâmica
          </CardDescription>
        </div>

        <Button
          variant="outline"
          size="sm"
          onClick={exportCsv}
          className="h-8 text-xs font-medium flex items-center gap-1.5 self-start sm:self-auto"
        >
          <Download className="w-3.5 h-3.5" />
          Exportar Tabela (CSV)
        </Button>
      </CardHeader>

      <CardContent className="p-0 overflow-x-auto">
        <table className="w-full text-xs text-left border-collapse">
          <thead>
            <tr className="bg-muted/60 text-muted-foreground border-b border-border select-none">
              <th
                onClick={() => handleSort("municipio")}
                className="py-3 px-4 font-semibold cursor-pointer hover:text-foreground transition-colors"
              >
                <div className="flex items-center gap-1">
                  Município
                  <ArrowUpDown className="w-3 h-3" />
                </div>
              </th>

              <th
                onClick={() => handleSort("incendiosFlorestais")}
                className="py-3 px-3 font-semibold text-right cursor-pointer hover:text-foreground transition-colors"
              >
                <div className="flex items-center justify-end gap-1">
                  <Flame className="w-3 h-3 text-rose-500" />
                  Florestal
                  <ArrowUpDown className="w-3 h-3" />
                </div>
              </th>

              <th
                onClick={() => handleSort("incendiosUrbanos")}
                className="py-3 px-3 font-semibold text-right cursor-pointer hover:text-foreground transition-colors"
              >
                <div className="flex items-center justify-end gap-1">
                  <Flame className="w-3 h-3 text-amber-500" />
                  Urbano
                  <ArrowUpDown className="w-3 h-3" />
                </div>
              </th>

              <th
                onClick={() => handleSort("totalIncendios")}
                className="py-3 px-4 font-semibold text-right cursor-pointer hover:text-foreground transition-colors"
              >
                <div className="flex items-center justify-end gap-1">
                  Total Incêndios
                  <ArrowUpDown className="w-3 h-3" />
                </div>
              </th>

              <th
                onClick={() => handleSort("efetivoTotal")}
                className="py-3 px-3 font-semibold text-right cursor-pointer hover:text-foreground transition-colors"
              >
                <div className="flex items-center justify-end gap-1">
                  <Users className="w-3 h-3 text-emerald-500" />
                  Efetivo
                  <ArrowUpDown className="w-3 h-3" />
                </div>
              </th>

              <th
                onClick={() => handleSort("viaturasTotal")}
                className="py-3 px-3 font-semibold text-right cursor-pointer hover:text-foreground transition-colors"
              >
                <div className="flex items-center justify-end gap-1">
                  <Truck className="w-3 h-3 text-blue-500" />
                  Viaturas
                  <ArrowUpDown className="w-3 h-3" />
                </div>
              </th>

              <th
                onClick={() => handleSort("outrasOcorrencias")}
                className="py-3 px-3 font-semibold text-right cursor-pointer hover:text-foreground transition-colors"
              >
                <div className="flex items-center justify-end gap-1">
                  Outras Ocorr.
                  <ArrowUpDown className="w-3 h-3" />
                </div>
              </th>

              <th className="py-3 px-4 font-semibold text-center">Criticidade</th>
            </tr>
          </thead>

          <tbody className="divide-y divide-border/60">
            {sortedRows.length === 0 ? (
              <tr>
                <td colSpan={8} className="text-center py-8 text-muted-foreground">
                  Nenhum município encontrado com os filtros selecionados.
                </td>
              </tr>
            ) : (
              sortedRows.map((r, idx) => {
                const percentOfMax = (r.totalIncendios / maxFires) * 100;
                return (
                  <tr
                    key={r.municipio}
                    className="hover:bg-muted/40 transition-colors group cursor-pointer"
                    onClick={() => onSelectMunicipio?.(r.municipio)}
                  >
                    <td className="py-2.5 px-4 font-medium text-foreground">
                      <div className="flex items-center gap-2">
                        <span className="text-[10px] font-mono text-muted-foreground w-5">
                          #{idx + 1}
                        </span>
                        <div>
                          <p className="font-semibold text-sm group-hover:text-emerald-600 transition-colors">
                            {r.municipio}
                          </p>
                          {r.calha && (
                            <span className="text-[10px] text-muted-foreground">
                              {r.calha}
                            </span>
                          )}
                        </div>
                      </div>
                    </td>

                    <td className="py-2.5 px-3 text-right font-mono text-foreground font-semibold">
                      {NF.format(r.incendiosFlorestais)}
                    </td>

                    <td className="py-2.5 px-3 text-right font-mono text-foreground font-semibold">
                      {NF.format(r.incendiosUrbanos)}
                    </td>

                    <td className="py-2.5 px-4 text-right">
                      <div className="flex flex-col items-end">
                        <span className="font-mono font-bold text-sm text-foreground">
                          {NF.format(r.totalIncendios)}
                        </span>
                        <div className="w-20 h-1.5 bg-muted rounded-full overflow-hidden mt-1">
                          <div
                            className={`h-full rounded-full ${
                              r.severidade === "critico"
                                ? "bg-rose-500"
                                : r.severidade === "alto"
                                ? "bg-amber-500"
                                : r.severidade === "moderado"
                                ? "bg-yellow-500"
                                : "bg-emerald-500"
                            }`}
                            style={{ width: `${percentOfMax}%` }}
                          />
                        </div>
                      </div>
                    </td>

                    <td className="py-2.5 px-3 text-right font-mono text-foreground">
                      {NF.format(r.efetivoTotal)}
                    </td>

                    <td className="py-2.5 px-3 text-right font-mono text-foreground">
                      {NF.format(r.viaturasTotal)}
                    </td>

                    <td className="py-2.5 px-3 text-right font-mono text-foreground">
                      {NF.format(r.outrasOcorrencias)}
                    </td>

                    <td className="py-2.5 px-4 text-center">
                      <Badge
                        variant="outline"
                        className={`text-[10px] uppercase font-bold px-2 py-0.5 ${
                          r.severidade === "critico"
                            ? "border-rose-300 bg-rose-50 text-rose-700 dark:bg-rose-950/40 dark:border-rose-800 dark:text-rose-400"
                            : r.severidade === "alto"
                            ? "border-amber-300 bg-amber-50 text-amber-700 dark:bg-amber-950/40 dark:border-amber-800 dark:text-amber-400"
                            : r.severidade === "moderado"
                            ? "border-yellow-300 bg-yellow-50 text-yellow-700 dark:bg-yellow-950/40 dark:border-yellow-800 dark:text-yellow-400"
                            : "border-emerald-300 bg-emerald-50 text-emerald-700 dark:bg-emerald-950/40 dark:border-emerald-800 dark:text-emerald-400"
                        }`}
                      >
                        {r.severidade}
                      </Badge>
                    </td>
                  </tr>
                );
              })
            )}
          </tbody>

          {sortedRows.length > 0 && (
            <tfoot>
              <tr className="bg-muted/80 font-bold text-foreground border-t-2 border-border text-xs">
                <td className="py-3 px-4 uppercase tracking-wider">
                  Total Consolidado ({sortedRows.length} mun.)
                </td>
                <td className="py-3 px-3 text-right font-mono font-bold text-rose-600">
                  {NF.format(totals.florestal)}
                </td>
                <td className="py-3 px-3 text-right font-mono font-bold text-amber-600">
                  {NF.format(totals.urbano)}
                </td>
                <td className="py-3 px-4 text-right font-mono font-bold text-sm text-foreground">
                  {NF.format(totals.total)}
                </td>
                <td className="py-3 px-3 text-right font-mono text-emerald-600">
                  {NF.format(totals.efetivo)}
                </td>
                <td className="py-3 px-3 text-right font-mono text-blue-600">
                  {NF.format(totals.viaturas)}
                </td>
                <td className="py-3 px-3 text-right font-mono text-purple-600">
                  {NF.format(totals.outras)}
                </td>
                <td className="py-3 px-4 text-center">
                  <Badge variant="secondary" className="text-[10px]">
                    100% OPERAÇÃO
                  </Badge>
                </td>
              </tr>
            </tfoot>
          )}
        </table>
      </CardContent>
    </Card>
  );
});
