import { useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";
import { MapPin, Plus, Settings2, Trash2, Loader2 } from "lucide-react";
import { listMunicipios, createMunicipio, deleteMunicipio } from "@/lib/municipios.functions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";

/**
 * Seletor de município + gestão do cadastro (admin).
 * `onAdd` insere o município escolhido em todas as seções do registro.
 */
export function MunicipioPicker({
  isAdmin,
  disabled,
  existing,
  onAdd,
}: {
  isAdmin: boolean;
  disabled?: boolean;
  existing: string[];
  onAdd: (name: string) => void;
}) {
  const [selected, setSelected] = useState<string>("");
  const listFn = useServerFn(listMunicipios);

  const q = useQuery({
    queryKey: ["municipios"],
    queryFn: () => listFn(),
    staleTime: 60_000,
  });

  const options = useMemo(
    () => (q.data ?? []).filter((m) => m.active).map((m) => m.name),
    [q.data],
  );
  const taken = useMemo(() => new Set(existing.map((n) => n.trim().toLowerCase())), [existing]);

  return (
    <div className="flex flex-col sm:flex-row sm:flex-wrap sm:items-end gap-2">
      <div className="w-full sm:w-auto sm:min-w-[14rem] sm:flex-1 sm:max-w-sm">
        <Label>Município</Label>
        <Select value={selected} onValueChange={setSelected} disabled={disabled}>
          <SelectTrigger className="mt-1">
            <SelectValue placeholder={q.isLoading ? "Carregando…" : "Selecione…"} />
          </SelectTrigger>
          <SelectContent className="max-h-72">
            {options.length === 0 ? (
              <div className="px-3 py-2 text-sm text-muted-foreground">
                Nenhum município cadastrado.
              </div>
            ) : (
              options.map((name) => (
                <SelectItem key={name} value={name}>
                  <span className="flex items-center gap-2">
                    {name}
                    {taken.has(name.trim().toLowerCase()) && (
                      <Badge variant="secondary" className="text-[10px]">
                        já incluso
                      </Badge>
                    )}
                  </span>
                </SelectItem>
              ))
            )}
          </SelectContent>
        </Select>
      </div>

      <Button
        type="button"
        variant="outline"
        className="h-10 w-full gap-1.5 sm:w-auto"
        disabled={disabled || !selected}
        onClick={() => {
          onAdd(selected);
          setSelected("");
        }}
      >
        <Plus className="w-4 h-4" /> Incluir no registro
      </Button>

      {isAdmin && <MunicipiosManagerDialog />}
    </div>
  );
}

/** CRUD do cadastro de municípios — somente administradores. */
function MunicipiosManagerDialog() {
  const [open, setOpen] = useState(false);
  const [name, setName] = useState("");
  const qc = useQueryClient();

  const listFn = useServerFn(listMunicipios);
  const createFn = useServerFn(createMunicipio);
  const deleteFn = useServerFn(deleteMunicipio);

  const q = useQuery({
    queryKey: ["municipios"],
    queryFn: () => listFn(),
    enabled: open,
  });

  const invalidate = () => qc.invalidateQueries({ queryKey: ["municipios"] });

  const create = useMutation({
    mutationFn: (value: string) => createFn({ data: { name: value } }),
    onSuccess: () => {
      toast.success("Município cadastrado.");
      setName("");
      invalidate();
    },
    onError: (e: any) => toast.error("Não foi possível cadastrar", { description: e?.message }),
  });

  const remove = useMutation({
    mutationFn: (id: string) => deleteFn({ data: { id } }),
    onSuccess: () => {
      toast.success("Município removido.");
      invalidate();
    },
    onError: (e: any) => toast.error("Não foi possível remover", { description: e?.message }),
  });

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant="outline" className="h-10 gap-2">
          <Settings2 className="w-4 h-4" aria-hidden="true" />
          Municípios
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-lg max-h-[85dvh] flex flex-col overflow-hidden">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <MapPin className="w-4 h-4 text-primary" aria-hidden="true" />
            Cadastro de municípios
          </DialogTitle>
          <DialogDescription>
            Exclusivo do administrador. Os municípios cadastrados ficam disponíveis para
            preenchimento em todas as seções do registro diário.
          </DialogDescription>
        </DialogHeader>

        <form
          className="flex flex-col gap-2 sm:flex-row sm:items-end"
          onSubmit={(e) => {
            e.preventDefault();
            const value = name.trim();
            if (value.length < 2) {
              toast.error("Informe o nome do município.");
              return;
            }
            create.mutate(value);
          }}
        >
          <div className="flex-1">
            <Label htmlFor="novo-municipio">Novo município</Label>
            <Input
              id="novo-municipio"
              value={name}
              maxLength={120}
              onChange={(e) => setName(e.target.value)}
              placeholder="Ex.: Manaus"
              className="mt-1"
            />
          </div>
          <Button
            type="submit"
            disabled={create.isPending}
            className="gap-1.5 w-full sm:w-auto shrink-0"
          >
            <Plus className="w-4 h-4" />
            {create.isPending ? "Salvando…" : "Adicionar"}
          </Button>
        </form>

        <div className="flex-1 overflow-y-auto -mx-4 sm:-mx-6 px-4 sm:px-6 mt-2">
          {q.isLoading && (
            <div className="flex items-center justify-center py-8 text-sm text-muted-foreground">
              <Loader2 className="w-4 h-4 mr-2 animate-spin" /> Carregando…
            </div>
          )}
          {q.data && q.data.length === 0 && (
            <p className="py-8 text-center text-sm text-muted-foreground">
              Nenhum município cadastrado ainda.
            </p>
          )}
          <ul className="divide-y divide-border">
            {q.data?.map((m) => (
              <li key={m.id} className="flex items-center gap-2 py-2 min-w-0">
                <MapPin className="w-3.5 h-3.5 shrink-0 text-muted-foreground" aria-hidden="true" />
                <span className="text-sm font-medium truncate">{m.name}</span>
                <Button
                  size="icon"
                  variant="ghost"
                  className="ml-auto"
                  aria-label={`Remover ${m.name}`}
                  disabled={remove.isPending}
                  onClick={() => remove.mutate(m.id)}
                >
                  <Trash2 className="w-4 h-4 text-red-600" />
                </Button>
              </li>
            ))}
          </ul>
        </div>
      </DialogContent>
    </Dialog>
  );
}
