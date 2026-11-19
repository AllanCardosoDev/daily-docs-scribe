import { useState } from "react";
import { Plus, MapPin, Building2, Tent, Check } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
  DialogFooter,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { canonicalMunicipio } from "@/lib/municipio-order";
import { cn } from "@/lib/utils";

const AMAZONAS_MUNICIPIOS = [
  "Manaus",
  "Alvarães",
  "Amaturá",
  "Anamã",
  "Anori",
  "Apuí",
  "Atalaia do Norte",
  "Autazes",
  "Barcelos",
  "Barreirinha",
  "Benjamin Constant",
  "Beruri",
  "Boa Vista do Ramos",
  "Boca do Acre",
  "Borba",
  "Caapiranga",
  "Canutama",
  "Carauari",
  "Careiro Castanho",
  "Careiro da Várzea",
  "Coari",
  "Codajás",
  "Eirunepé",
  "Envira",
  "Fonte Boa",
  "Guajará",
  "Humaitá",
  "Ipixuna",
  "Iranduba",
  "Itacoatiara",
  "Itamarati",
  "Itapiranga",
  "Japurá",
  "Juruá",
  "Jutaí",
  "Lábrea",
  "Manacapuru",
  "Manaquiri",
  "Manicoré",
  "Maraã",
  "Maués",
  "Nhamundá",
  "Novo Airão",
  "Novo Aripuanã",
  "Parintins",
  "Pauini",
  "Presidente Figueiredo",
  "Rio Preto da Eva",
  "Santa Isabel do Rio Negro",
  "Santo Antônio do Içá",
  "São Gabriel da Cachoeira",
  "São Paulo de Olivença",
  "São Sebastião do Uatumã",
  "Silves",
  "Tabatinga",
  "Tapauá",
  "Tefé",
  "Tonantins",
  "Uarini",
  "Urucará",
  "Urucurituba",
].sort((a, b) => a.localeCompare(b, "pt-BR"));

interface Props {
  existingMunicipios: string[];
  onAddMunicipio: (name: string, tipo: "interior" | "base") => Promise<void> | void;
  disabled?: boolean;
}

export function AddMunicipioDialog({ existingMunicipios, onAddMunicipio, disabled }: Props) {
  const [open, setOpen] = useState(false);
  const [tipo, setTipo] = useState<"interior" | "base">("interior");
  const [selectedMun, setSelectedMun] = useState<string>("");
  const [customMun, setCustomMun] = useState<string>("");
  const [isSubmitting, setIsSubmitting] = useState(false);

  const existingSet = new Set(
    existingMunicipios.map((m) => canonicalMunicipio(m).toLowerCase()),
  );

  const handleConfirm = async () => {
    const raw = customMun.trim() || selectedMun;
    if (!raw) return;

    const finalName = canonicalMunicipio(raw);
    setIsSubmitting(true);
    try {
      await onAddMunicipio(finalName, tipo);
      setSelectedMun("");
      setCustomMun("");
      setTipo("interior");
      setOpen(false);
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button
          variant="outline"
          size="default"
          disabled={disabled}
          className="h-11 sm:h-10 border-primary/30 hover:border-primary bg-background/80 hover:bg-primary/5 text-foreground gap-2 font-bold px-4 hover-lift"
        >
          <Plus className="w-4 h-4 text-primary shrink-0" />
          <span className="text-sm">Inserir Município / Base</span>
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-xl font-bold text-foreground">
            <MapPin className="w-5 h-5 text-primary" />
            Inserir no Relatório
          </DialogTitle>
          <DialogDescription className="text-sm text-muted-foreground">
            Escolha se é um <strong>Município Comum</strong> ou <strong>Base Temporária</strong> e selecione ou digite o nome.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-3">
          {/* Seletor de Tipo: Município Comum vs Base Temporária */}
          <div className="space-y-2">
            <Label className="text-xs uppercase tracking-wider font-bold text-muted-foreground">
              Classificação Operacional
            </Label>
            <div className="grid grid-cols-2 gap-2.5">
              <button
                type="button"
                onClick={() => setTipo("interior")}
                className={cn(
                  "p-3 rounded-xl border text-left transition-all cursor-pointer flex flex-col gap-1.5",
                  tipo === "interior"
                    ? "border-emerald-600 bg-emerald-500/10 text-emerald-950 dark:text-emerald-100 ring-2 ring-emerald-600/30 shadow-sm"
                    : "border-border hover:border-muted-foreground/30 bg-muted/30 text-muted-foreground",
                )}
              >
                <div className="flex items-center gap-2 font-bold text-xs">
                  <Building2 className={cn("w-4 h-4", tipo === "interior" ? "text-emerald-600 dark:text-emerald-400" : "text-muted-foreground")} />
                  <span>Município Comum</span>
                </div>
                <span className="text-[11px] leading-tight text-muted-foreground">
                  Pelotão ou posto polo no interior
                </span>
              </button>

              <button
                type="button"
                onClick={() => setTipo("base")}
                className={cn(
                  "p-3 rounded-xl border text-left transition-all cursor-pointer flex flex-col gap-1.5",
                  tipo === "base"
                    ? "border-orange-600 bg-orange-500/10 text-orange-950 dark:text-orange-100 ring-2 ring-orange-600/30 shadow-sm"
                    : "border-border hover:border-muted-foreground/30 bg-muted/30 text-muted-foreground",
                )}
              >
                <div className="flex items-center gap-2 font-bold text-xs">
                  <Tent className={cn("w-4 h-4", tipo === "base" ? "text-orange-600 dark:text-orange-400" : "text-muted-foreground")} />
                  <span>Base Temporária</span>
                </div>
                <span className="text-[11px] leading-tight text-muted-foreground">
                  Base avançada / posto de combate florestal
                </span>
              </button>
            </div>
          </div>

          <div className="space-y-2">
            <Label className="text-xs uppercase tracking-wider font-bold text-muted-foreground">
              Selecione da Lista do Amazonas
            </Label>
            <Select
              value={selectedMun}
              onValueChange={(val) => {
                setSelectedMun(val);
                setCustomMun("");
              }}
            >
              <SelectTrigger className="h-10">
                <SelectValue placeholder="Escolha um município..." />
              </SelectTrigger>
              <SelectContent className="max-h-60">
                {AMAZONAS_MUNICIPIOS.map((mun) => {
                  const isTaken = existingSet.has(mun.toLowerCase());
                  return (
                    <SelectItem key={mun} value={mun}>
                      <div className="flex items-center justify-between w-full gap-4">
                        <span>{mun}</span>
                        {isTaken && (
                          <span className="text-[10px] bg-muted text-muted-foreground px-1.5 py-0.5 rounded">
                            já incluso
                          </span>
                        )}
                      </div>
                    </SelectItem>
                  );
                })}
              </SelectContent>
            </Select>
          </div>

          <div className="relative flex items-center justify-center my-2">
            <div className="absolute inset-0 flex items-center">
              <span className="w-full border-t border-border" />
            </div>
            <span className="relative bg-background px-2 text-xs uppercase text-muted-foreground font-semibold">
              ou digite manualmente
            </span>
          </div>

          <div className="space-y-2">
            <Label className="text-xs uppercase tracking-wider font-bold text-muted-foreground">
              Nome da Localidade ou Base
            </Label>
            <Input
              placeholder={tipo === "base" ? "Ex: Base Barreirinha, Posto Km 53..." : "Ex: Barreirinha, Carauari..."}
              value={customMun}
              onChange={(e) => {
                setCustomMun(e.target.value);
                if (e.target.value) setSelectedMun("");
              }}
              className="h-10"
            />
          </div>
        </div>

        <DialogFooter className="gap-2 sm:gap-0">
          <Button
            type="button"
            variant="ghost"
            onClick={() => setOpen(false)}
            disabled={isSubmitting}
          >
            Cancelar
          </Button>
          <Button
            type="button"
            onClick={handleConfirm}
            disabled={(!selectedMun && !customMun.trim()) || isSubmitting}
            className="bg-primary text-primary-foreground font-bold gap-2 px-5"
          >
            <Check className="w-4 h-4" />
            {isSubmitting ? "Inserindo..." : `Inserir como ${tipo === "base" ? "Base" : "Município"}`}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
