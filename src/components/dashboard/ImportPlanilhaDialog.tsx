import React, { useState, useRef } from "react";
import { useQueryClient } from "@tanstack/react-query";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import {
  Upload,
  FileSpreadsheet,
  CheckCircle2,
  AlertCircle,
  Loader2,
  Flame,
  ShieldCheck,
  Calendar,
  Layers,
} from "lucide-react";
import { useServerFn } from "@tanstack/react-start";
import {
  importSpreadsheetOccurrences,
  importOccurrencesBatch,
} from "@/lib/occurrences-import.functions";
import type { ImportSpreadsheetResult } from "@/lib/occurrences-import.server";
import { extractFireOccurrencesFromCsv } from "@/lib/client-csv-parser";
import { toast } from "sonner";

interface Props {
  open?: boolean;
  onOpenChange?: (open: boolean) => void;
  triggerButton?: React.ReactNode;
  onSuccess?: (result: ImportSpreadsheetResult) => void;
}

export function ImportPlanilhaDialog({
  open: controlledOpen,
  onOpenChange: setControlledOpen,
  triggerButton,
  onSuccess,
}: Props) {
  const [uncontrolledOpen, setUncontrolledOpen] = useState(false);
  const isControlled = controlledOpen !== undefined;
  const open = isControlled ? controlledOpen : uncontrolledOpen;
  const setOpen = isControlled ? setControlledOpen! : setUncontrolledOpen;

  const [file, setFile] = useState<File | null>(null);
  const [isDragging, setIsDragging] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [progressText, setProgressText] = useState<string>("");
  const [result, setResult] = useState<ImportSpreadsheetResult | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const qc = useQueryClient();

  const importFn = useServerFn(importSpreadsheetOccurrences);
  const importBatchFn = useServerFn(importOccurrencesBatch);

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const selected = e.target.files?.[0];
    if (selected) {
      setFile(selected);
      setResult(null);
      setProgressText("");
    }
  };

  const handleDrop = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    setIsDragging(false);
    const dropped = e.dataTransfer.files?.[0];
    if (dropped) {
      const ext = dropped.name.toLowerCase().split(".").pop();
      if (ext === "csv" || ext === "xlsx" || ext === "xls" || ext === "txt") {
        setFile(dropped);
        setResult(null);
        setProgressText("");
      } else {
        toast.error("Formato inválido. Por favor, envie um arquivo .CSV ou .XLSX.");
      }
    }
  };

  const handleDragOver = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    setIsDragging(true);
  };

  const handleDragLeave = () => {
    setIsDragging(false);
  };

  const handleUpload = async () => {
    if (!file) return;

    try {
      setIsLoading(true);
      const ext = file.name.toLowerCase().split(".").pop() || "";
      const isCsv = ext === "csv" || ext === "txt";
      let finalResult: ImportSpreadsheetResult;

      // Se for um arquivo CSV grande (> 2MB), faz pré-processamento no navegador
      // para evitar estourar o limite de payload (4.5MB) de funções serverless na nuvem
      if (isCsv && file.size > 2 * 1024 * 1024) {
        setProgressText("Lendo e analisando ocorrências de incêndio na planilha...");
        const text = await file.text();
        const fireOccs = extractFireOccurrencesFromCsv(text);

        if (fireOccs.length === 0) {
          throw new Error("Nenhuma ocorrência de combate a incêndio válida foi encontrada no arquivo.");
        }

        const BATCH_SIZE = 1000;
        const totalBatches = Math.ceil(fireOccs.length / BATCH_SIZE);
        let accumulatedInserted = 0;
        let accumulatedUpdated = 0;
        let accumulatedSkipped = 0;
        const affectedDates = new Set<string>();
        let latestDate: string | undefined = undefined;

        for (let b = 0; b < totalBatches; b++) {
          const chunk = fireOccs.slice(b * BATCH_SIZE, (b + 1) * BATCH_SIZE);
          setProgressText(`Salvando no Banco de Dados (Lote ${b + 1} de ${totalBatches} — ${chunk.length} ocorrências)...`);

          const batchRes = await importBatchFn({
            data: {
              occurrences: chunk,
            },
          });

          accumulatedInserted += batchRes.insertedCount || 0;
          accumulatedUpdated += batchRes.updatedCount || 0;
          accumulatedSkipped += batchRes.duplicatesSkipped || 0;
          for (const d of batchRes.datesAffected || []) {
            affectedDates.add(d);
          }
          if (batchRes.latestDate) latestDate = batchRes.latestDate;
        }

        const sortedDates = Array.from(affectedDates).sort();
        finalResult = {
          success: true,
          totalRows: fireOccs.length,
          fireRows: fireOccs.length,
          insertedCount: accumulatedInserted,
          updatedCount: accumulatedUpdated,
          duplicatesSkipped: accumulatedSkipped,
          datesAffected: sortedDates,
          latestDate: latestDate || (sortedDates.length > 0 ? sortedDates[sortedDates.length - 1] : undefined),
          message: `Planilha CAD processada com sucesso! ${fireOccs.length} ocorrência(s) de incêndio verificadas: ${accumulatedInserted} nova(s) e ${accumulatedUpdated} atualizada(s). Todas gravadas e consolidadas no Banco de Dados.`,
          sampleImported: fireOccs.slice(0, 5).map((occ) => ({
            municipio: occ.municipio,
            natureza: occ.natureza,
            data: occ.dataBr,
            endereco: occ.endereco,
          })),
        };
      } else {
        // Envio direto (planilhas XLSX oficiais ou arquivos CSV compactos)
        setProgressText("Enviando e processando planilha no servidor...");
        const reader = new FileReader();
        const base64Promise = new Promise<string>((resolve, reject) => {
          reader.onload = () => {
            const res = reader.result as string;
            const base64 = res.split(",")[1];
            resolve(base64);
          };
          reader.onerror = reject;
        });
        reader.readAsDataURL(file);

        const base64Data = await base64Promise;

        finalResult = await importFn({
          data: {
            fileName: file.name,
            base64Data,
          },
        });
      }

      setResult(finalResult);

      if (finalResult.success) {
        await Promise.all([
          qc.invalidateQueries({ queryKey: ["daily-report"] }),
          qc.invalidateQueries({ queryKey: ["daily-reports"] }),
          qc.invalidateQueries({ queryKey: ["sheets-data"] }),
          qc.invalidateQueries({ queryKey: ["available-report-dates"] }),
        ]);

        if (finalResult.isDailyReport) {
          toast.success(finalResult.message);
        } else if (finalResult.insertedCount > 0 || (finalResult.updatedCount && finalResult.updatedCount > 0)) {
          const parts: string[] = [];
          if (finalResult.insertedCount > 0) parts.push(`${finalResult.insertedCount} nova(s)`);
          if (finalResult.updatedCount && finalResult.updatedCount > 0) parts.push(`${finalResult.updatedCount} atualizada(s)`);
          toast.success(`Sucesso! ${parts.join(" e ")} ocorrência(s) de incêndio salva(s) no banco.`);
        } else {
          toast.success(
            `Planilha sincronizada: todas as ocorrências de incêndio estão confirmadas no banco de dados.`,
          );
        }
        onSuccess?.(finalResult);
      } else {
        toast.error(finalResult.message || "Erro ao processar planilha.");
      }
    } catch (err: any) {
      console.error("Erro na importação:", err);
      toast.error(err?.message || "Falha ao importar planilha.");
    } finally {
      setIsLoading(false);
      setProgressText("");
    }
  };

  const resetState = () => {
    setFile(null);
    setResult(null);
    setIsLoading(false);
    setProgressText("");
    if (fileInputRef.current) fileInputRef.current.value = "";
  };

  return (
    <Dialog
      open={open}
      onOpenChange={(v) => {
        setOpen(v);
        if (!v) resetState();
      }}
    >
      {triggerButton ? (
        <DialogTrigger asChild>{triggerButton}</DialogTrigger>
      ) : (
        <DialogTrigger asChild>
          <Button
            variant="default"
            size="sm"
            className="h-9 text-xs font-semibold gap-1.5 bg-gradient-brand text-white shadow-sm hover:opacity-95"
          >
            <Upload className="w-3.5 h-3.5" />
            Importar Planilha
          </Button>
        </DialogTrigger>
      )}

      <DialogContent className="sm:max-w-[540px] max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="text-base sm:text-lg flex items-center gap-2 text-foreground font-bold">
            <div className="w-7 h-7 rounded-lg bg-red-500/10 text-red-600 flex items-center justify-center">
              <FileSpreadsheet className="w-4 h-4" />
            </div>
            Importar Planilha (Relatório Diário ou CAD)
          </DialogTitle>
          <DialogDescription className="text-xs text-muted-foreground pt-1">
            Envie a planilha oficial do <strong>Relatório Diário</strong> (<strong>.XLSX</strong>) ou a planilha de ocorrências CAD (<strong>CSV / XLSX</strong>).
            O sistema detecta o tipo de planilha automaticamente, filtra somente combates a incêndio, harmoniza os municípios e grava no banco de dados.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-2">
          {/* Zona de Drop */}
          <div
            onDrop={handleDrop}
            onDragOver={handleDragOver}
            onDragLeave={handleDragLeave}
            onClick={() => fileInputRef.current?.click()}
            className={`border-2 border-dashed rounded-xl p-6 text-center cursor-pointer transition-all duration-200 ${
              isDragging
                ? "border-primary bg-primary/5 scale-[0.99]"
                : file
                  ? "border-emerald-500/50 bg-emerald-500/5"
                  : "border-border hover:border-primary/50 hover:bg-muted/30"
            }`}
          >
            <input
              ref={fileInputRef}
              type="file"
              accept=".csv,.xlsx,.xls,.txt"
              className="hidden"
              onChange={handleFileChange}
            />

            <div className="flex flex-col items-center justify-center gap-2">
              <div
                className={`w-12 h-12 rounded-full flex items-center justify-center ${
                  file
                    ? "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400"
                    : "bg-muted text-muted-foreground"
                }`}
              >
                {file ? <CheckCircle2 className="w-6 h-6" /> : <Upload className="w-6 h-6" />}
              </div>

              {file ? (
                <div className="space-y-1">
                  <p className="text-sm font-semibold text-foreground truncate max-w-[340px]">
                    {file.name}
                  </p>
                  <p className="text-xs text-muted-foreground">
                    {(file.size / 1024 / 1024).toFixed(2)} MB • Clique para trocar de arquivo
                  </p>
                </div>
              ) : (
                <div className="space-y-1">
                  <p className="text-sm font-semibold text-foreground">
                    Arraste sua planilha aqui ou clique para selecionar
                  </p>
                  <p className="text-xs text-muted-foreground">
                    Formatos aceitos: <strong>.CSV</strong>, <strong>.XLSX</strong>, <strong>.XLS</strong>
                  </p>
                </div>
              )}
            </div>
          </div>

          {/* Feedback de Progresso */}
          {isLoading && (
            <div className="rounded-xl bg-amber-500/10 border border-amber-500/20 p-3.5 space-y-2 animate-pulse">
              <div className="flex items-center gap-2 text-xs font-semibold text-amber-700 dark:text-amber-400">
                <Loader2 className="w-4 h-4 animate-spin shrink-0" />
                <span>{progressText || "Processando e persistindo no banco de dados..."}</span>
              </div>
              <p className="text-[11px] text-muted-foreground pl-6">
                Por favor, aguarde enquanto os registros são gravados e os totais operacionais consolidados.
              </p>
            </div>
          )}

          {/* Feedback do Resultado */}
          {result && (
            <div
              className={`rounded-xl border p-4 space-y-3 ${
                result.success
                  ? "bg-emerald-500/5 border-emerald-500/30 text-emerald-950 dark:text-emerald-100"
                  : "bg-destructive/5 border-destructive/30 text-destructive dark:text-destructive-foreground"
              }`}
            >
              <div className="flex items-start gap-2.5">
                {result.success ? (
                  <CheckCircle2 className="w-5 h-5 text-emerald-600 dark:text-emerald-400 mt-0.5 shrink-0" />
                ) : (
                  <AlertCircle className="w-5 h-5 text-destructive mt-0.5 shrink-0" />
                )}
                <div className="space-y-1 flex-1">
                  <p className="text-sm font-bold">
                    {result.success ? "Importação Realizada com Sucesso" : "Falha na Importação"}
                  </p>
                  <p className="text-xs leading-relaxed opacity-90">{result.message}</p>
                </div>
              </div>

              {result.success && !result.isDailyReport ? (
                <div className="grid grid-cols-2 sm:grid-cols-5 gap-2 pt-2 border-t border-border/40">
                  <div className="p-2 rounded-lg bg-muted/40 text-center">
                    <span className="text-[10px] uppercase font-bold text-muted-foreground block">
                      Linhas Lidas
                    </span>
                    <span className="text-base font-extrabold text-foreground tabular-nums">
                      {result.totalRows}
                    </span>
                  </div>

                  <div className="p-2 rounded-lg bg-red-500/10 text-center">
                    <span className="text-[10px] uppercase font-bold text-red-600 dark:text-red-400 block">
                      Incêndios
                    </span>
                    <span className="text-base font-extrabold text-red-600 dark:text-red-400 tabular-nums">
                      {result.fireRows}
                    </span>
                  </div>

                  <div className="p-2 rounded-lg bg-emerald-500/10 text-center">
                    <span className="text-[10px] uppercase font-bold text-emerald-600 dark:text-emerald-400 block">
                      Novos Salvos
                    </span>
                    <span className="text-base font-extrabold text-emerald-600 dark:text-emerald-400 tabular-nums">
                      {result.insertedCount}
                    </span>
                  </div>

                  <div className="p-2 rounded-lg bg-blue-500/10 text-center">
                    <span className="text-[10px] uppercase font-bold text-blue-600 dark:text-blue-400 block">
                      Atualizados
                    </span>
                    <span className="text-base font-extrabold text-blue-600 dark:text-blue-400 tabular-nums">
                      {result.updatedCount || 0}
                    </span>
                  </div>

                  <div className="p-2 rounded-lg bg-muted/40 text-center col-span-2 sm:col-span-1">
                    <span className="text-[10px] uppercase font-bold text-muted-foreground block">
                      Inalterados
                    </span>
                    <span className="text-base font-extrabold text-muted-foreground tabular-nums">
                      {result.duplicatesSkipped}
                    </span>
                  </div>
                </div>
              ) : null}

              {result.datesAffected.length > 0 && (
                <div className="flex items-center gap-2 text-xs text-muted-foreground pt-1">
                  <Calendar className="w-3.5 h-3.5 text-primary" />
                  <span>
                    Datas afetadas:{" "}
                    <strong>
                      {result.datesAffected
                        .slice(0, 4)
                        .map((d) => d.split("-").reverse().join("/"))
                        .join(", ")}
                      {result.datesAffected.length > 4 ? ` (+${result.datesAffected.length - 4})` : ""}
                    </strong>
                  </span>
                </div>
              )}
            </div>
          )}

          {/* Dicas de segurança e sincronização */}
          <div className="rounded-xl bg-muted/30 p-3 border border-border/60 space-y-1.5 text-[11px] text-muted-foreground">
            <div className="flex items-center gap-1.5 font-semibold text-foreground">
              <ShieldCheck className="w-3.5 h-3.5 text-emerald-600" />
              Sincronização Inteligente e Atualização de Registros
            </div>
            <p>
              O sistema compara o protocolo oficial e assinatura de cada chamado.
              Se uma ocorrência já estiver registrada e algum valor tiver sido modificado na planilha
              (como <strong>área</strong>, focos, endereço ou água), o registro é <strong>atualizado automaticamente</strong>.
              Registros sem alterações permanecem intactos.
            </p>
          </div>
        </div>

        <DialogFooter className="flex flex-col sm:flex-row gap-2 pt-2">
          <Button
            type="button"
            variant="ghost"
            size="sm"
            onClick={() => setOpen(false)}
            disabled={isLoading}
            className="text-xs"
          >
            Fechar
          </Button>

          <Button
            type="button"
            variant="default"
            size="sm"
            onClick={handleUpload}
            disabled={!file || isLoading}
            className="text-xs font-bold gap-2 bg-gradient-brand text-white shadow-elevated"
          >
            {isLoading ? (
              <>
                <Loader2 className="w-3.5 h-3.5 animate-spin" />
                Processando Planilha...
              </>
            ) : (
              <>
                <Upload className="w-3.5 h-3.5" />
                Importar e Salvar no Banco
              </>
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
