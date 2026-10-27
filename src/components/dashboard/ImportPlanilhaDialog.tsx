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
import { importSpreadsheetOccurrences } from "@/lib/occurrences-import.functions";
import type { ImportSpreadsheetResult } from "@/lib/occurrences-import.server";
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
  const [result, setResult] = useState<ImportSpreadsheetResult | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const qc = useQueryClient();

  const importFn = useServerFn(importSpreadsheetOccurrences);

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const selected = e.target.files?.[0];
    if (selected) {
      setFile(selected);
      setResult(null);
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

      // Leitura em Base64
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

      const res = await importFn({
        data: {
          fileName: file.name,
          base64Data,
        },
      });

      setResult(res);

      if (res.success) {
        await Promise.all([
          qc.invalidateQueries({ queryKey: ["daily-report"] }),
          qc.invalidateQueries({ queryKey: ["daily-reports"] }),
          qc.invalidateQueries({ queryKey: ["sheets-data"] }),
          qc.invalidateQueries({ queryKey: ["available-report-dates"] }),
        ]);

        if (res.isDailyReport) {
          toast.success(res.message);
        } else if (res.insertedCount > 0) {
          toast.success(
            `Sucesso! ${res.insertedCount} nova(s) ocorrência(s) de incêndio salva(s) no banco.`,
          );
        } else {
          toast.info(
            `Planilha processada: todas as ocorrências de incêndio já constam no banco de dados.`,
          );
        }
        onSuccess?.(res);
      } else {
        toast.error(res.message || "Erro ao processar planilha.");
      }
    } catch (err: any) {
      console.error("Erro na importação:", err);
      toast.error(err?.message || "Falha ao importar planilha.");
    } finally {
      setIsLoading(false);
    }
  };

  const resetState = () => {
    setFile(null);
    setResult(null);
    setIsLoading(false);
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
            O sistema detecta o tipo de planilha automaticamente, harmoniza os municípios e grava no banco de dados.
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
                className={`w-12 h-12 rounded-full flex items-center justify-center transition-colors ${
                  file ? "bg-emerald-500/15 text-emerald-600" : "bg-muted text-muted-foreground"
                }`}
              >
                {file ? <FileSpreadsheet className="w-6 h-6" /> : <Upload className="w-6 h-6" />}
              </div>

              {file ? (
                <div>
                  <p className="text-sm font-bold text-foreground truncate max-w-xs sm:max-w-md">
                    {file.name}
                  </p>
                  <p className="text-xs text-muted-foreground mt-0.5">
                    {(file.size / 1024 / 1024).toFixed(2)} MB · Clique para escolher outro
                  </p>
                </div>
              ) : (
                <div>
                  <p className="text-sm font-semibold text-foreground">
                    Arraste a planilha aqui ou clique para selecionar
                  </p>
                  <p className="text-xs text-muted-foreground mt-0.5">
                    Formatos aceitos: <strong>.CSV</strong>, <strong>.XLSX</strong> ou <strong>.XLS</strong>
                  </p>
                </div>
              )}
            </div>
          </div>

          {/* Resultado do processamento */}
          {result && (
            <div
              className={`p-4 rounded-xl border space-y-3 animate-fade-in ${
                result.success
                  ? "bg-card border-border shadow-sm"
                  : "bg-destructive/10 border-destructive/20 text-destructive"
              }`}
            >
              <div className="flex items-center gap-2">
                {result.success ? (
                  <CheckCircle2 className="w-5 h-5 text-emerald-600 shrink-0" />
                ) : (
                  <AlertCircle className="w-5 h-5 text-destructive shrink-0" />
                )}
                <span className="text-xs font-bold text-foreground">{result.message}</span>
              </div>

              {result.success && result.isDailyReport && result.dailyReport ? (
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 pt-1 border-t border-border/60">
                  <div className="p-2 rounded-lg bg-blue-500/10 text-center">
                    <span className="text-[10px] uppercase font-bold text-blue-600 dark:text-blue-400 block">
                      Efetivo
                    </span>
                    <span className="text-base font-extrabold text-blue-600 dark:text-blue-400 tabular-nums">
                      {result.dailyReport.counts.efetivo} mun.
                    </span>
                  </div>

                  <div className="p-2 rounded-lg bg-red-500/10 text-center">
                    <span className="text-[10px] uppercase font-bold text-red-600 dark:text-red-400 block">
                      Incêndios
                    </span>
                    <span className="text-base font-extrabold text-red-600 dark:text-red-400 tabular-nums">
                      {result.dailyReport.counts.incendios} mun.
                    </span>
                  </div>

                  <div className="p-2 rounded-lg bg-amber-500/10 text-center">
                    <span className="text-[10px] uppercase font-bold text-amber-600 dark:text-amber-400 block">
                      Recursos
                    </span>
                    <span className="text-base font-extrabold text-amber-600 dark:text-amber-400 tabular-nums">
                      {result.dailyReport.counts.recursos} mun.
                    </span>
                  </div>

                  <div className="p-2 rounded-lg bg-emerald-500/10 text-center">
                    <span className="text-[10px] uppercase font-bold text-emerald-600 dark:text-emerald-400 block">
                      Outras Ocorr.
                    </span>
                    <span className="text-base font-extrabold text-emerald-600 dark:text-emerald-400 tabular-nums">
                      {result.dailyReport.counts.outras} mun.
                    </span>
                  </div>
                </div>
              ) : result.success ? (
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 pt-1 border-t border-border/60">
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

                  <div className="p-2 rounded-lg bg-muted/40 text-center">
                    <span className="text-[10px] uppercase font-bold text-muted-foreground block">
                      Duplicados
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
                    Datas com novos registros:{" "}
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

          {/* Dicas de segurança e filtragem */}
          <div className="rounded-xl bg-muted/30 p-3 border border-border/60 space-y-1.5 text-[11px] text-muted-foreground">
            <div className="flex items-center gap-1.5 font-semibold text-foreground">
              <ShieldCheck className="w-3.5 h-3.5 text-emerald-600" />
              Proteção Automática contra Duplicação
            </div>
            <p>
              O sistema compara o protocolo oficial ou assinatura única de cada chamado.
              Se uma ocorrência já estiver no banco, ela é ignorada sem risco de registros duplicados.
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
