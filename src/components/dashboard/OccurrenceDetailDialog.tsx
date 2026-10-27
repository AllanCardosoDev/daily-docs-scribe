import { memo } from "react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { NF } from "@/lib/formatters";
import type { OccurrenceRow } from "@/lib/sheets.types";
import {
  Flame,
  MapPin,
  Clock,
  Calendar,
  Truck,
  Users,
  Droplets,
  ExternalLink,
  FileText,
  ShieldAlert,
  Layers,
} from "lucide-react";

interface OccurrenceDetailDialogProps {
  occurrence: OccurrenceRow | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

function parseCoordinates(coordStr?: string): { lat: string; lon: string; url: string } | null {
  if (!coordStr || coordStr === "—" || coordStr === "-" || coordStr === "0") return null;

  // Formato WKT: POINT (-60.0058 -3.0885)
  const pointMatch = coordStr.match(/POINT\s*\(\s*([-\d.]+)\s+([-\d.]+)\s*\)/i);
  if (pointMatch) {
    const lon = pointMatch[1];
    const lat = pointMatch[2];
    return {
      lat,
      lon,
      url: `https://www.google.com/maps/search/?api=1&query=${lat},${lon}`,
    };
  }

  // Formato lat, lon
  const latLonMatch = coordStr.match(/([-\d.]+)\s*,\s*([-\d.]+)/);
  if (latLonMatch) {
    const lat = latLonMatch[1];
    const lon = latLonMatch[2];
    return {
      lat,
      lon,
      url: `https://www.google.com/maps/search/?api=1&query=${lat},${lon}`,
    };
  }

  return {
    lat: "",
    lon: "",
    url: `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(coordStr)}`,
  };
}

export const OccurrenceDetailDialog = memo(function OccurrenceDetailDialog({
  occurrence,
  open,
  onOpenChange,
}: OccurrenceDetailDialogProps) {
  if (!occurrence) return null;

  const mapInfo = parseCoordinates(occurrence.coordenadas);
  const isVegetacao =
    occurrence.natureza.toLowerCase().includes("vegeta") ||
    occurrence.natureza.toLowerCase().includes("florest") ||
    occurrence.natureza.toLowerCase().includes("mata");

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader className="space-y-2 border-b border-border/60 pb-3">
          <div className="flex flex-wrap items-center gap-2">
            <Badge variant="outline" className="font-mono text-xs bg-muted">
              {occurrence.protocolo || occurrence.id || "Ocorrência CAD"}
            </Badge>
            <Badge
              className={
                isVegetacao
                  ? "bg-amber-600/10 text-amber-600 dark:text-amber-400 border-amber-500/30"
                  : "bg-red-600/10 text-red-600 dark:text-red-400 border-red-500/30"
              }
            >
              <Flame className="w-3.5 h-3.5 mr-1" />
              {occurrence.natureza}
            </Badge>
            {occurrence.situacao && (
              <Badge variant="secondary" className="text-xs">
                {occurrence.situacao}
              </Badge>
            )}
          </div>
          <DialogTitle className="text-lg sm:text-xl font-bold flex items-center gap-2 text-foreground">
            Ocorrência em {occurrence.municipio}
          </DialogTitle>
          <DialogDescription className="text-xs text-muted-foreground flex flex-wrap items-center gap-3">
            <span className="flex items-center gap-1">
              <Calendar className="w-3.5 h-3.5 text-primary" />
              {occurrence.data}
            </span>
            <span className="flex items-center gap-1">
              <Clock className="w-3.5 h-3.5 text-primary" />
              {occurrence.horario}
            </span>
            {occurrence.motivoFinalizacao && (
              <span className="flex items-center gap-1">
                <ShieldAlert className="w-3.5 h-3.5 text-muted-foreground" />
                {occurrence.motivoFinalizacao}
              </span>
            )}
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-2 text-sm">
          {/* Card de Localização */}
          <div className="rounded-xl border border-border bg-muted/20 p-3.5 space-y-2">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2 font-bold text-foreground">
                <MapPin className="w-4 h-4 text-primary" />
                Localização & Endereço
              </div>
              {mapInfo?.url && (
                <Button
                  asChild
                  variant="outline"
                  size="sm"
                  className="h-7 text-xs gap-1.5 hover:bg-primary/10 hover:text-primary"
                >
                  <a href={mapInfo.url} target="_blank" rel="noopener noreferrer">
                    <ExternalLink className="w-3.5 h-3.5" />
                    Abrir no Mapa
                  </a>
                </Button>
              )}
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-xs">
              <div>
                <span className="text-muted-foreground">Município: </span>
                <strong className="text-foreground">{occurrence.municipio}</strong>
              </div>
              {occurrence.bairro && (
                <div>
                  <span className="text-muted-foreground">Bairro: </span>
                  <strong className="text-foreground">{occurrence.bairro}</strong>
                </div>
              )}
              <div className="sm:col-span-2">
                <span className="text-muted-foreground">Endereço / Logradouro: </span>
                <strong className="text-foreground">{occurrence.endereco}</strong>
              </div>
              {occurrence.coordenadas && occurrence.coordenadas !== "—" && (
                <div className="sm:col-span-2 font-mono text-[11px] text-muted-foreground bg-background/50 p-1.5 rounded border border-border/50">
                  Coordenadas: {occurrence.coordenadas}
                </div>
              )}
            </div>
          </div>

          {/* Indicadores Operacionais */}
          <div className="grid grid-cols-3 gap-2.5">
            <div className="p-3 rounded-xl border border-border bg-card text-center">
              <div className="text-xs text-muted-foreground mb-1 flex items-center justify-center gap-1">
                <Flame className="w-3.5 h-3.5 text-red-500" />
                Focos
              </div>
              <div className="text-lg font-bold text-foreground">
                {NF.format(occurrence.focos || 0)}
              </div>
            </div>
            <div className="p-3 rounded-xl border border-border bg-card text-center">
              <div className="text-xs text-muted-foreground mb-1 flex items-center justify-center gap-1">
                <Layers className="w-3.5 h-3.5 text-amber-500" />
                Área (m²)
              </div>
              <div className="text-lg font-bold text-foreground">
                {NF.format(occurrence.area || 0)}
              </div>
            </div>
            <div className="p-3 rounded-xl border border-border bg-card text-center">
              <div className="text-xs text-muted-foreground mb-1 flex items-center justify-center gap-1">
                <Droplets className="w-3.5 h-3.5 text-blue-500" />
                Água (Litros)
              </div>
              <div className="text-lg font-bold text-blue-600 dark:text-blue-400">
                {NF.format(occurrence.agua || 0)} L
              </div>
            </div>
          </div>

          {/* Viaturas e Equipes */}
          {(occurrence.unidade || occurrence.equipes) && (
            <div className="rounded-xl border border-border bg-card p-3.5 space-y-2">
              <div className="font-bold text-xs uppercase tracking-wider text-muted-foreground flex items-center gap-2">
                <Truck className="w-3.5 h-3.5 text-primary" />
                Recursos e Efetivo Empenhado
              </div>
              {occurrence.unidade && (
                <div className="text-xs">
                  <span className="text-muted-foreground">Viaturas / Unidades: </span>
                  <strong className="text-foreground">{occurrence.unidade}</strong>
                </div>
              )}
              {occurrence.equipes && (
                <div className="text-xs flex items-start gap-1.5 pt-1">
                  <Users className="w-3.5 h-3.5 text-primary shrink-0 mt-0.5" />
                  <div>
                    <span className="text-muted-foreground">Equipes / Militares: </span>
                    <span className="text-foreground">{occurrence.equipes}</span>
                  </div>
                </div>
              )}
            </div>
          )}

          {/* Narrativa da Ocorrência */}
          {occurrence.narrativa && (
            <div className="space-y-1.5">
              <div className="font-bold text-xs uppercase tracking-wider text-muted-foreground flex items-center gap-1.5">
                <FileText className="w-3.5 h-3.5 text-primary" />
                Narrativa da Solicitação
              </div>
              <div className="p-3 rounded-xl bg-muted/40 border border-border text-xs leading-relaxed text-foreground whitespace-pre-wrap">
                {occurrence.narrativa}
              </div>
            </div>
          )}

          {/* Relato Oficial do CAD */}
          {occurrence.relato && (
            <div className="space-y-1.5">
              <div className="font-bold text-xs uppercase tracking-wider text-muted-foreground flex items-center gap-1.5">
                <FileText className="w-3.5 h-3.5 text-primary" />
                Relato Oficial do CAD / Atendimento no Local
              </div>
              <div className="p-3 rounded-xl bg-primary/5 border border-primary/20 text-xs leading-relaxed text-foreground whitespace-pre-wrap font-sans">
                {occurrence.relato}
              </div>
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
});
