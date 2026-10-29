import { useState } from "react";
import { Plus, Users, Shield, Check } from "lucide-react";
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

const PRESET_EFETIVO_TYPES = [
  "Força Nacional",
  "Brigada Florestal Voluntária",
  "Defesa Civil Estadual",
  "Defesa Civil Municipal",
  "Exército Brasileiro",
  "Marinha do Brasil",
  "Força Aérea Brasileira",
  "ICMBio / IBAMA",
  "Posto Avançado Operacional",
];

interface Props {
  onAddOutroEfetivo: (name: string, ord?: number, seg?: number, brig?: number) => Promise<void> | void;
  disabled?: boolean;
}

export function AddOutroEfetivoDialog({ onAddOutroEfetivo, disabled }: Props) {
  const [open, setOpen] = useState(false);
  const [selectedPreset, setSelectedPreset] = useState<string>("");
  const [customName, setCustomName] = useState<string>("");
  const [ord, setOrd] = useState<number>(0);
  const [seg, setSeg] = useState<number>(0);
  const [brig, setBrig] = useState<number>(0);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleConfirm = async () => {
    const finalName = customName.trim() || selectedPreset;
    if (!finalName) return;

    setIsSubmitting(true);
    try {
      await onAddOutroEfetivo(finalName, ord, seg, brig);
      setSelectedPreset("");
      setCustomName("");
      setOrd(0);
      setSeg(0);
      setBrig(0);
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
          className="h-11 sm:h-10 border-emerald-500/30 hover:border-emerald-500 bg-background/80 hover:bg-emerald-50/10 text-foreground gap-2 font-bold px-4 hover-lift"
        >
          <Users className="w-4 h-4 text-emerald-600 dark:text-emerald-400 shrink-0" />
          <span className="text-sm">Inserir Outro Efetivo</span>
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-xl font-bold text-foreground">
            <Shield className="w-5 h-5 text-primary" />
            Inserir Outro Tipo de Efetivo
          </DialogTitle>
          <DialogDescription className="text-sm text-muted-foreground">
            Adicione tropas externas, contingentes interestaduais, brigadas ou postos de apoio ao relatório do dia.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-3">
          <div className="space-y-2">
            <Label className="text-xs uppercase tracking-wider font-bold text-muted-foreground">
              Sugestões / Modelos Frequentes
            </Label>
            <Select
              value={selectedPreset}
              onValueChange={(val) => {
                setSelectedPreset(val);
                setCustomName(val);
              }}
            >
              <SelectTrigger className="h-10">
                <SelectValue placeholder="Escolha um tipo sugerido..." />
              </SelectTrigger>
              <SelectContent className="max-h-60">
                {PRESET_EFETIVO_TYPES.map((type) => (
                  <SelectItem key={type} value={type}>
                    {type}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2">
            <Label htmlFor="custom-efetivo-name" className="text-xs uppercase tracking-wider font-bold text-muted-foreground">
              Nome / Identificação do Efetivo
            </Label>
            <Input
              id="custom-efetivo-name"
              placeholder="Ex: Força Nacional, Brigada Voluntária..."
              value={customName}
              onChange={(e) => setCustomName(e.target.value)}
              className="h-10 font-medium"
            />
          </div>

          <div className="grid grid-cols-3 gap-2.5 pt-1">
            <div className="space-y-1.5">
              <Label className="text-[11px] font-bold text-muted-foreground uppercase truncate block">
                Ordinário
              </Label>
              <Input
                type="number"
                min="0"
                value={ord === 0 ? "" : ord}
                placeholder="0"
                onChange={(e) => setOrd(Math.max(0, parseInt(e.target.value) || 0))}
                className="h-9 text-center font-bold"
              />
            </div>
            <div className="space-y-1.5">
              <Label className="text-[11px] font-bold text-muted-foreground uppercase truncate block">
                SEG
              </Label>
              <Input
                type="number"
                min="0"
                value={seg === 0 ? "" : seg}
                placeholder="0"
                onChange={(e) => setSeg(Math.max(0, parseInt(e.target.value) || 0))}
                className="h-9 text-center font-bold"
              />
            </div>
            <div className="space-y-1.5">
              <Label className="text-[11px] font-bold text-muted-foreground uppercase truncate block">
                Brigadistas
              </Label>
              <Input
                type="number"
                min="0"
                value={brig === 0 ? "" : brig}
                placeholder="0"
                onChange={(e) => setBrig(Math.max(0, parseInt(e.target.value) || 0))}
                className="h-9 text-center font-bold"
              />
            </div>
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
            disabled={isSubmitting || (!customName.trim() && !selectedPreset)}
            className="bg-gradient-brand text-white font-bold gap-2"
          >
            <Check className="w-4 h-4" />
            {isSubmitting ? "Inserindo..." : "Inserir no Relatório"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
