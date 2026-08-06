import { useState } from "react";
import { Plus, MapPin, Building2, Check } from "lucide-react";
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
  "Careiro",
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
  onAddMunicipio: (name: string) => Promise<void> | void;
  disabled?: boolean;
}

export function AddMunicipioDialog({ existingMunicipios, onAddMunicipio, disabled }: Props) {
  const [open, setOpen] = useState(false);
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
      await onAddMunicipio(finalName);
      setSelectedMun("");
      setCustomMun("");
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
          <span className="text-sm">Inserir Município</span>
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-xl font-bold text-foreground">
            <MapPin className="w-5 h-5 text-primary" />
            Inserir Município no Relatório
          </DialogTitle>
          <DialogDescription className="text-sm text-muted-foreground">
            Selecione um município do Amazonas ou digite o nome para incluí-lo nas tabelas do relatório ativo.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-3">
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
              Nome do Município ou Setor
            </Label>
            <Input
              placeholder="Ex: Novo Aripuanã, Base Humaitá..."
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
            {isSubmitting ? "Inserindo..." : "Inserir no Relatório"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
