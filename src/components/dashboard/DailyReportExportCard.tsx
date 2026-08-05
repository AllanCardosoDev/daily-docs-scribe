import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";
import { FileText, FileSpreadsheet, Layers, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { listDailyReports } from "@/lib/daily-reports.functions";
import { exportDailyPdf, exportDailyXlsx, type DailyRowLike } from "@/lib/daily-export";
import { SHIFT_LABEL, type ReportShift } from "@/lib/report-shift";

/**
 * Bloco final da aba de registro: gera o relatório oficial do dia/turno
 * selecionado — apenas o que foi preenchido — ou o "completo", que soma o
 * acumulado de incêndios já registrado no ano até a data escolhida.
 */
export function DailyReportExportCard(props: {
  date: string;
  shift: ReportShift;
  row: DailyRowLike | null | undefined;
}) {
  const { date, shift, row } = props;
  const [loadingAcc, setLoadingAcc] = useState(false);
  const listFn = useServerFn(listDailyReports);

  const hasData =
    !!row &&
    [row.efetivo, row.recursos, row.incendios, row.outras].some(
      (l) => Array.isArray(l) && l.length > 0,
    );

  // Pré-carrega o acumulado do ano até a data (usado no relatório completo).
  const yearStart = `${date.slice(0, 4)}-01-01`;
  const accQuery = useQuery({
    queryKey: ["daily-reports", "acumulado", yearStart, date],
    queryFn: () => listFn({ data: { from: yearStart, to: date } }),
    enabled: false,
    staleTime: 60_000,
  });

  const guard = () => {
    if (hasData) return true;
    toast.error("Não há dados salvos neste relatório.", {
      description: "Preencha e salve o registro antes de gerar o documento.",
    });
    return false;
  };

  const gerarCompleto = async (kind: "pdf" | "xlsx") => {
    if (!guard()) return;
    setLoadingAcc(true);
    try {
      const res = await accQuery.refetch();
      const accumulated = (res.data ?? []) as Array<{ incendios?: any[] | null }>;
      const opts = { date, shift, row, accumulated };
      if (kind === "pdf") exportDailyPdf(opts);
      else exportDailyXlsx(opts);
      toast.success("Relatório completo gerado.");
    } catch (e: any) {
      toast.error("Falha ao gerar relatório completo", { description: e?.message });
    } finally {
      setLoadingAcc(false);
    }
  };

  return (
    <section className="rounded-xl bg-card shadow-elevated p-4 sm:p-5 space-y-4">
      <div>
        <h2 className="font-semibold text-base flex items-center gap-2">
          <FileText className="w-4 h-4 text-primary" />
          Gerar relatório
        </h2>
        <p className="text-xs text-muted-foreground mt-1">
          {SHIFT_LABEL[shift]} — {date.split("-").reverse().join("/")}
        </p>
      </div>

      <div className="space-y-3">
        <div>
          <p className="text-sm font-medium">Relatório do dia</p>
          <p className="text-xs text-muted-foreground mb-2">
            Somente as ocorrências lançadas neste registro, no padrão oficial CBMAM.
          </p>
          <div className="grid grid-cols-1 sm:flex gap-2">
            <Button
              variant="outline"
              size="sm"
              className="gap-2"
              onClick={() => guard() && exportDailyPdf({ date, shift, row })}
            >
              <FileText className="w-4 h-4" /> PDF do dia
            </Button>
            <Button
              variant="outline"
              size="sm"
              className="gap-2"
              onClick={() => guard() && exportDailyXlsx({ date, shift, row })}
            >
              <FileSpreadsheet className="w-4 h-4" /> Excel do dia
            </Button>
          </div>
        </div>

        <div className="pt-3 border-t border-border">
          <p className="text-sm font-medium">Diário completo (com acumulado)</p>
          <p className="text-xs text-muted-foreground mb-2">
            Inclui as seções do dia mais o consolidado de incêndios já registrado no ano até{" "}
            {date.split("-").reverse().join("/")}.
          </p>
          <div className="grid grid-cols-1 sm:flex gap-2">
            <Button
              size="sm"
              className="gap-2"
              disabled={loadingAcc}
              onClick={() => gerarCompleto("pdf")}
            >
              {loadingAcc ? (
                <Loader2 className="w-4 h-4 animate-spin" />
              ) : (
                <Layers className="w-4 h-4" />
              )}
              PDF completo
            </Button>
            <Button
              variant="secondary"
              size="sm"
              className="gap-2"
              disabled={loadingAcc}
              onClick={() => gerarCompleto("xlsx")}
            >
              <FileSpreadsheet className="w-4 h-4" /> Excel completo
            </Button>
          </div>
        </div>
      </div>
    </section>
  );
}
