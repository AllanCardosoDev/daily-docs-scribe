import React, { useState, useMemo } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { X, MapPin, Flame, Users, Info, ArrowRight, Calendar, Clock, AlertTriangle, Search } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Input } from "@/components/ui/input";
import type { SheetsData } from "@/lib/sheets.types";

interface MapDetailsPanelProps {
  isOpen: boolean;
  onClose: () => void;
  municipioName: string | null;
  onMunicipioSelect: (name: string | null) => void;
  data: SheetsData;
}

export function MapDetailsPanel({ isOpen, onClose, municipioName, onMunicipioSelect, data }: MapDetailsPanelProps) {
  const [searchTerm, setSearchTerm] = useState("");
  
  const allMunicipios = useMemo(() => {
    const names = new Set<string>();
    data.incendios_diario?.forEach(r => r.mun && names.add(r.mun));
    data.efetivo?.forEach(r => r.mun && names.add(r.mun));
    data.outras_diarias?.forEach(r => r.mun && names.add(r.mun));
    data.recursos?.forEach(r => r.mun && names.add(r.mun));
    return Array.from(names).sort((a, b) => a.localeCompare(b));
  }, [data]);

  const filteredMunicipios = useMemo(() => {
    if (!searchTerm) return [];
    const term = searchTerm.toLowerCase();
    return allMunicipios.filter(m => m.toLowerCase().includes(term));
  }, [allMunicipios, searchTerm]);

  const details = useMemo(() => {
    if (!municipioName) return null;

    const normalize = (s: string) =>
      s
        .normalize("NFD")
        .replace(/[\u0300-\u036f]/g, "")
        .toLowerCase();
    const target = normalize(municipioName);

    const incendios = data.incendios_diario?.find((r) => normalize(r.mun || "") === target);
    const efetivo = data.efetivo?.find((r) => normalize(r.mun || "") === target);
    const outras = data.outras_diarias?.find((r) => normalize(r.mun || "") === target);
    const recursos = data.recursos?.find((r) => normalize(r.mun || "") === target);

    return {
      name: municipioName,
      incendios: {
        urb: Number(incendios?.urb || 0),
        flor: Number(incendios?.flor || 0),
        focos: Number(incendios?.focos || 0),
        total: Number(incendios?.urb || 0) + Number(incendios?.flor || 0),
      },
      efetivo: {
        ord: Number(efetivo?.ord || 0),
        seg: Number(efetivo?.seg || 0),
        brig: Number(efetivo?.brig || 0),
        total: Number(efetivo?.ord || 0) + Number(efetivo?.seg || 0) + Number(efetivo?.brig || 0),
      },
      outras: {
        salvamento: Number(outras?.salvamento || 0),
        acidentes: Number(outras?.acidentes || 0),
        aph: Number(outras?.aph || 0),
        prevencao: Number(outras?.prevencao || 0),
        servicos: Number(outras?.servicos || 0),
        total:
          Number(outras?.salvamento || 0) +
          Number(outras?.acidentes || 0) +
          Number(outras?.aph || 0) +
          Number(outras?.prevencao || 0) +
          Number(outras?.servicos || 0),
      },
      recursos: recursos ? Object.entries(recursos)
        .filter(([k, v]) => k !== "mun" && Number(v) > 0)
        .map(([k, v]) => ({ label: k.toUpperCase().replace(/_/g, " "), value: v })) : [],
    };
  }, [municipioName, data]);

  return (
    <AnimatePresence>
      {isOpen && details && (
        <>
          {/* Backdrop mobile */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={onClose}
            className="fixed inset-0 bg-black/20 backdrop-blur-sm z-40 lg:hidden"
          />

          <motion.div
            initial={{ x: "100%" }}
            animate={{ x: 0 }}
            exit={{ x: "100%" }}
            transition={{ type: "spring", damping: 25, stiffness: 200 }}
            className="fixed right-0 top-0 bottom-0 w-full sm:w-[450px] bg-background border-l border-border shadow-2xl z-50 flex flex-col"
          >
            <div className="p-6 border-b border-border bg-gradient-brand text-white flex items-center justify-between">
              <div>
                <div className="flex items-center gap-2 mb-1">
                  <MapPin className="w-5 h-5 text-emerald-200" />
                  <h2 className="text-xl font-display font-black tracking-tight">
                    {details.name}
                  </h2>
                </div>
                <div className="flex items-center gap-2 text-xs font-medium text-emerald-100/80">
                  <Calendar className="w-3 h-3" />
                  {data.isRange ? (
                    <span>Período: {data.startDate} à {data.endDate}</span>
                  ) : (
                    <span>Dados do Relatório Atual</span>
                  )}
                </div>
              </div>
              <Button
                variant="ghost"
                size="icon"
                onClick={onClose}
                className="text-white hover:bg-white/20 rounded-full h-10 w-10"
              >
                <X className="w-6 h-6" />
              </Button>
            </div>

            <div className="px-6 py-4 border-b border-border bg-muted/30">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                <Input
                  placeholder="Buscar município..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="pl-9 h-10 rounded-xl bg-background border-border"
                />
              </div>
              
              {searchTerm && filteredMunicipios.length > 0 && (
                <div className="mt-2 p-2 rounded-xl border border-border bg-background shadow-lg max-h-40 overflow-y-auto">
                  {filteredMunicipios.map(mun => (
                    <button
                      key={mun}
                      onClick={() => {
                        onMunicipioSelect(mun);
                        setSearchTerm("");
                      }}
                      className="w-full text-left px-3 py-2 text-sm hover:bg-muted rounded-lg transition-colors font-medium flex items-center justify-between"
                    >
                      {mun}
                      {municipioName === mun && <Badge variant="secondary" className="text-[10px]">Selecionado</Badge>}
                    </button>
                  ))}
                </div>
              )}
            </div>

            <ScrollArea className="flex-1">
              <div className="p-6 space-y-8">
                {/* Seção de Incêndios */}
                <section>
                  <div className="flex items-center justify-between mb-4">
                    <div className="flex items-center gap-2 text-red-600 dark:text-red-400">
                      <Flame className="w-5 h-5" />
                      <h3 className="font-display font-bold uppercase tracking-wider text-sm">Incêndios no Período</h3>
                    </div>
                    <Badge variant="destructive" className="font-black text-sm">
                      {details.incendios.total} OCORRÊNCIAS
                    </Badge>
                  </div>
                  <div className="grid grid-cols-3 gap-3">
                    <div className="p-4 rounded-2xl bg-red-50 dark:bg-red-950/20 border border-red-100 dark:border-red-900/30 text-center">
                      <div className="text-[10px] font-bold text-red-600/70 dark:text-red-400/50 uppercase mb-1">Urbanos</div>
                      <div className="text-2xl font-display font-black text-red-700 dark:text-red-300">{details.incendios.urb}</div>
                    </div>
                    <div className="p-4 rounded-2xl bg-orange-50 dark:bg-orange-950/20 border border-orange-100 dark:border-orange-900/30 text-center">
                      <div className="text-[10px] font-bold text-orange-600/70 dark:text-orange-400/50 uppercase mb-1">Florestais</div>
                      <div className="text-2xl font-display font-black text-orange-700 dark:text-orange-300">{details.incendios.flor}</div>
                    </div>
                    <div className="p-4 rounded-2xl bg-amber-50 dark:bg-amber-950/20 border border-amber-100 dark:border-amber-900/30 text-center">
                      <div className="text-[10px] font-bold text-amber-600/70 dark:text-amber-400/50 uppercase mb-1">Focos</div>
                      <div className="text-2xl font-display font-black text-amber-700 dark:text-amber-300">{details.incendios.focos}</div>
                    </div>
                  </div>
                </section>

                <Separator className="opacity-50" />

                {/* Seção de Efetivo */}
                <section>
                  <div className="flex items-center justify-between mb-4">
                    <div className="flex items-center gap-2 text-emerald-600 dark:text-emerald-400">
                      <Users className="w-5 h-5" />
                      <h3 className="font-display font-bold uppercase tracking-wider text-sm">Efetivo Operacional</h3>
                    </div>
                    <Badge className="bg-emerald-600 font-black text-sm">
                      {details.efetivo.total} MILITARES
                    </Badge>
                  </div>
                  <div className="space-y-3">
                    {[
                      { label: "Ord. Público", value: details.efetivo.ord, color: "bg-emerald-500" },
                      { label: "Seg. Presidencial", value: details.efetivo.seg, color: "bg-blue-500" },
                      { label: "Brigadistas", value: details.efetivo.brig, color: "bg-orange-500" }
                    ].map((item) => (
                      <div key={item.label} className="flex items-center justify-between p-3 rounded-xl bg-muted/50 border border-border/50">
                        <div className="flex items-center gap-3">
                          <div className={cn("w-2 h-2 rounded-full", item.color)} />
                          <span className="text-sm font-medium text-muted-foreground">{item.label}</span>
                        </div>
                        <span className="font-display font-bold text-foreground">{item.value}</span>
                      </div>
                    ))}
                  </div>
                </section>

                <Separator className="opacity-50" />

                {/* Seção de Ocorrências Diversas */}
                <section>
                  <div className="flex items-center justify-between mb-4">
                    <div className="flex items-center gap-2 text-blue-600 dark:text-blue-400">
                      <AlertTriangle className="w-5 h-5" />
                      <h3 className="font-display font-bold uppercase tracking-wider text-sm">Outras Naturezas</h3>
                    </div>
                    <Badge variant="outline" className="font-black text-sm border-blue-200 text-blue-600">
                      {details.outras.total} TOTAL
                    </Badge>
                  </div>
                  <div className="grid grid-cols-2 gap-2">
                    {[
                      { label: "Salvamento", val: details.outras.salvamento },
                      { label: "Acidentes", val: details.outras.acidentes },
                      { label: "APH", val: details.outras.aph },
                      { label: "Prevenção", val: details.outras.prevencao },
                      { label: "Serviços", val: details.outras.servicos }
                    ].map((occ) => (
                      <div key={occ.label} className="flex items-center justify-between p-2 px-3 rounded-lg bg-slate-50 dark:bg-slate-900 border border-slate-100 dark:border-slate-800">
                        <span className="text-[11px] font-bold text-slate-500 uppercase">{occ.label}</span>
                        <span className="text-sm font-display font-black text-slate-700 dark:text-slate-300">{occ.val}</span>
                      </div>
                    ))}
                  </div>
                </section>

                {/* Seção de Recursos (VTRs/Aeronaves) */}
                {details.recursos.length > 0 && (
                  <>
                    <Separator className="opacity-50" />
                    <section>
                      <div className="flex items-center gap-2 text-slate-600 dark:text-slate-400 mb-4">
                        <Clock className="w-5 h-5" />
                        <h3 className="font-display font-bold uppercase tracking-wider text-sm">Recursos Empregados</h3>
                      </div>
                      <div className="flex flex-wrap gap-2">
                        {details.recursos.map((rec) => (
                          <div key={rec.label} className="bg-white dark:bg-slate-900 border border-border shadow-sm rounded-full px-4 py-1.5 flex items-center gap-2">
                            <span className="text-[10px] font-bold text-muted-foreground uppercase">{rec.label}</span>
                            <span className="text-sm font-display font-black text-primary">{rec.value}</span>
                          </div>
                        ))}
                      </div>
                    </section>
                  </>
                )}
              </div>
            </ScrollArea>

            <div className="p-6 border-t border-border bg-slate-50 dark:bg-slate-900/50">
              <Button
                variant="outline"
                className="w-full h-12 rounded-2xl font-bold gap-2 border-emerald-200 text-emerald-700 hover:bg-emerald-50 dark:border-emerald-900/30 dark:text-emerald-400"
                onClick={onClose}
              >
                Retornar ao Mapa
                <ArrowRight className="w-4 h-4" />
              </Button>
            </div>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );
}

import { cn } from "@/lib/utils";
