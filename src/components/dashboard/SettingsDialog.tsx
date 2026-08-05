import { useState, useEffect } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { saveAppConfig } from "@/lib/sheets.functions";
import { queryKeys } from "@/lib/query-keys";
import { toast } from "sonner";

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  currentUrl: string;
}

export function SettingsDialog({ open, onOpenChange, currentUrl }: Props) {
  const [url, setUrl] = useState(currentUrl);
  const save = useServerFn(saveAppConfig);
  const qc = useQueryClient();

  useEffect(() => {
    setUrl(currentUrl);
  }, [currentUrl, open]);

  const mut = useMutation({
    mutationFn: (v: string) => save({ data: { apps_script_url: v } }),
    onSuccess: () => {
      toast.success("Configuração salva");
      qc.invalidateQueries({ queryKey: queryKeys.appConfig });
      qc.invalidateQueries({ queryKey: queryKeys.sheetsData });
      onOpenChange(false);
    },
    onError: (e: Error) => toast.error(e.message),
  });

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Configuração do Google Apps Script</DialogTitle>
          <DialogDescription>
            Cole aqui a URL do Web App (/exec) do seu Apps Script vinculado à planilha do Google
            Sheets.
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-2 py-2">
          <Label htmlFor="url">URL do Web App</Label>
          <Input
            id="url"
            placeholder="https://script.google.com/macros/s/.../exec"
            value={url}
            onChange={(e) => setUrl(e.target.value)}
          />
          <p className="text-xs text-muted-foreground">
            Você encontra a URL em Apps Script → Implantar → Gerenciar Implantações.
          </p>
        </div>
        <DialogFooter>
          <Button variant="ghost" onClick={() => onOpenChange(false)}>
            Cancelar
          </Button>
          <Button onClick={() => mut.mutate(url)} disabled={mut.isPending}>
            {mut.isPending ? "Salvando..." : "Salvar"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
