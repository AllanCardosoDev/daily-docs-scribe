import { useState, useEffect } from "react";
import type { Column } from "./DataTable";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Plus, Trash2, ArrowUp, ArrowDown, RotateCcw, Check, SlidersHorizontal } from "lucide-react";
import { toast } from "sonner";
import { DEFAULT_EFETIVO_COLUMNS } from "@/lib/dashboard-columns";

interface EfetivoColumnsDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  columns: Column[];
  onSave: (columns: Column[]) => void;
}

export function slugifyColumnKey(label: string): string {
  const clean = label
    .trim()
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]+/g, "_")
    .replace(/^_+|_+$/g, "");
  return clean || `col_${Date.now()}`;
}

export function EfetivoColumnsDialog({
  open,
  onOpenChange,
  columns,
  onSave,
}: EfetivoColumnsDialogProps) {
  const [list, setList] = useState<Column[]>([]);
  const [newLabel, setNewLabel] = useState("");

  useEffect(() => {
    if (open) {
      setList(columns && columns.length > 0 ? [...columns] : [...DEFAULT_EFETIVO_COLUMNS]);
      setNewLabel("");
    }
  }, [open, columns]);

  function handleLabelChange(index: number, newTitle: string) {
    setList((prev) => {
      const copy = [...prev];
      copy[index] = { ...copy[index], label: newTitle };
      return copy;
    });
  }

  function handleAddColumn() {
    const trimmed = newLabel.trim();
    if (!trimmed) {
      toast.error("Informe o nome da nova coluna.");
      return;
    }

    let key = slugifyColumnKey(trimmed);
    // Evita colisão de chaves
    if (list.some((c) => c.key === key)) {
      key = `${key}_${Date.now().toString().slice(-4)}`;
    }

    const newCol: Column = {
      key,
      label: trimmed,
      numeric: true,
      editable: true,
    };

    setList((prev) => {
      // Inserir antes da coluna "total" (se existir) ou no final
      const totalIdx = prev.findIndex((c) => c.key === "total");
      if (totalIdx >= 0) {
        return [...prev.slice(0, totalIdx), newCol, ...prev.slice(totalIdx)];
      }
      return [...prev, newCol];
    });

    setNewLabel("");
    toast.success(`Coluna "${trimmed}" adicionada!`);
  }

  function handleRemoveColumn(index: number) {
    const col = list[index];
    if (col.key === "mun" || col.key === "total") {
      toast.error(`A coluna "${col.label}" é obrigatória e não pode ser removida.`);
      return;
    }
    setList((prev) => prev.filter((_, i) => i !== index));
    toast.info(`Coluna "${col.label}" removida.`);
  }

  function handleMove(index: number, direction: "up" | "down") {
    const targetIdx = direction === "up" ? index - 1 : index + 1;
    if (targetIdx <= 0 || targetIdx >= list.length - 1) return; // não move para antes de 'mun' nem depois de 'total'

    setList((prev) => {
      const copy = [...prev];
      const temp = copy[index];
      copy[index] = copy[targetIdx];
      copy[targetIdx] = temp;
      return copy;
    });
  }

  function handleResetDefault() {
    setList([...DEFAULT_EFETIVO_COLUMNS]);
    toast.success("Colunas restauradas para o padrão oficial do CBMAM.");
  }

  function handleApply() {
    if (list.length === 0) {
      toast.error("A tabela deve conter ao menos uma coluna.");
      return;
    }
    onSave(list);
    onOpenChange(false);
    toast.success("Configuração de colunas do efetivo atualizada!");
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[90vh] flex flex-col p-0 overflow-hidden">
        <DialogHeader className="p-4 sm:p-6 pb-2 border-b border-border/60 bg-gradient-brand-soft">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-lg bg-primary/10 flex items-center justify-center text-primary">
              <SlidersHorizontal className="w-4 h-4" />
            </div>
            <div>
              <DialogTitle className="text-base sm:text-lg font-bold">
                Personalizar Colunas do Efetivo
              </DialogTitle>
              <DialogDescription className="text-xs text-muted-foreground">
                Altere os nomes das colunas, adicione novos postos/operações ou remova colunas desnecessárias.
              </DialogDescription>
            </div>
          </div>
        </DialogHeader>

        {/* Adicionar nova coluna */}
        <div className="p-4 sm:px-6 bg-muted/30 border-b border-border/60 flex flex-col sm:flex-row items-stretch sm:items-center gap-2">
          <div className="flex-1">
            <Label htmlFor="new-col-input" className="sr-only">
              Nome da nova coluna
            </Label>
            <Input
              id="new-col-input"
              placeholder="Nome da nova coluna (ex: Exército, OPAM 3, Marinha...)"
              value={newLabel}
              onChange={(e) => setNewLabel(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter") {
                  e.preventDefault();
                  handleAddColumn();
                }
              }}
              className="h-9 text-xs"
            />
          </div>
          <Button
            type="button"
            size="sm"
            onClick={handleAddColumn}
            className="h-9 px-4 gap-1.5 font-semibold shrink-0 bg-primary text-primary-foreground hover:bg-primary/90"
          >
            <Plus className="w-4 h-4" />
            Adicionar Coluna
          </Button>
        </div>

        {/* Lista de colunas */}
        <div className="flex-1 overflow-y-auto p-4 sm:px-6 space-y-2 divide-y divide-border/40">
          {list.map((col, idx) => {
            const isProtected = col.key === "mun" || col.key === "total";
            const canMoveUp = idx > 1 && col.key !== "total";
            const canMoveDown = idx < list.length - 2 && col.key !== "mun";

            return (
              <div
                key={col.key}
                className="pt-2 first:pt-0 flex items-center gap-2 sm:gap-3 group hover:bg-muted/20 p-1.5 rounded-md transition-colors"
              >
                <div className="w-6 text-center text-xs text-muted-foreground font-mono">
                  {idx + 1}
                </div>

                <div className="flex-1 min-w-0">
                  <Input
                    value={col.label}
                    onChange={(e) => handleLabelChange(idx, e.target.value)}
                    disabled={col.key === "mun" || col.key === "total"}
                    className="h-8 text-xs font-medium"
                    placeholder="Nome da coluna"
                  />
                </div>

                <div className="text-[10px] font-mono text-muted-foreground shrink-0 px-2 py-0.5 rounded bg-muted/60 border border-border/50 max-w-[100px] truncate hidden sm:inline-block">
                  {col.key}
                </div>

                <div className="flex items-center gap-1 shrink-0">
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon"
                    className="h-7 w-7 text-muted-foreground hover:text-foreground disabled:opacity-30"
                    disabled={!canMoveUp}
                    onClick={() => handleMove(idx, "up")}
                    title="Mover para cima"
                  >
                    <ArrowUp className="w-3.5 h-3.5" />
                  </Button>
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon"
                    className="h-7 w-7 text-muted-foreground hover:text-foreground disabled:opacity-30"
                    disabled={!canMoveDown}
                    onClick={() => handleMove(idx, "down")}
                    title="Mover para baixo"
                  >
                    <ArrowDown className="w-3.5 h-3.5" />
                  </Button>
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon"
                    className="h-7 w-7 text-destructive hover:bg-destructive/10 disabled:opacity-20"
                    disabled={isProtected}
                    onClick={() => handleRemoveColumn(idx)}
                    title={isProtected ? "Coluna obrigatória" : "Remover coluna"}
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </Button>
                </div>
              </div>
            );
          })}
        </div>

        <DialogFooter className="p-3 sm:px-6 bg-muted/20 border-t border-border/60 flex flex-row items-center justify-between gap-2">
          <Button
            type="button"
            variant="ghost"
            size="sm"
            onClick={handleResetDefault}
            className="text-xs text-muted-foreground hover:text-foreground gap-1.5"
          >
            <RotateCcw className="w-3.5 h-3.5" />
            Restaurar Padrão
          </Button>

          <div className="flex items-center gap-2">
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => onOpenChange(false)}
              className="text-xs"
            >
              Cancelar
            </Button>
            <Button
              type="button"
              size="sm"
              onClick={handleApply}
              className="text-xs font-semibold gap-1.5 bg-gradient-brand text-white shadow-xs hover:opacity-95"
            >
              <Check className="w-3.5 h-3.5" />
              Salvar Colunas
            </Button>
          </div>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
