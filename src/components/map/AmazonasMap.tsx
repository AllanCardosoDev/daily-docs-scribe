import React, { useMemo, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { MapPin, Flame, Users, Info, X, ChevronRight, FileDown, FileText } from "lucide-react";
import { cn } from "@/lib/utils";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { MapDetailsPanel } from "./MapDetailsPanel";
import type { SheetsData } from "@/lib/sheets.types";

/**
 * Coordenadas simplificadas dos municípios do Amazonas para renderização SVG.
 * Esta é uma representação esquemática focada em interatividade.
 */
const MUNICIPIOS_GEO = [
  { id: "manaus", name: "Manaus", x: 620, y: 550, size: 28 },
  { id: "itacoatiara", name: "Itacoatiara", x: 690, y: 560, size: 18 },
  { id: "manacapuru", name: "Manacapuru", x: 580, y: 565, size: 18 },
  { id: "iranduba", name: "Iranduba", x: 605, y: 575, size: 15 },
  { id: "parintins", name: "Parintins", x: 800, y: 520, size: 20 },
  { id: "tefe", name: "Tefé", x: 420, y: 520, size: 18 },
  { id: "tabatinga", name: "Tabatinga", x: 100, y: 650, size: 18 },
  { id: "humaita", name: "Humaitá", x: 550, y: 850, size: 18 },
  { id: "labrea", name: "Lábrea", x: 420, y: 800, size: 16 },
  { id: "apui", name: "Apuí", x: 720, y: 820, size: 16 },
  { id: "boca-do-acre", name: "Boca do Acre", x: 280, y: 880, size: 15 },
  { id: "sao-gabriel-da-cachoeira", name: "São Gabriel da Cachoeira", x: 280, y: 200, size: 22 },
  { id: "presidente-figueiredo", name: "Presidente Figueiredo", x: 640, y: 470, size: 16 },
  { id: "coari", name: "Coari", x: 480, y: 620, size: 16 },
  { id: "eirunepe", name: "Eirunepé", x: 150, y: 820, size: 15 },
  { id: "maues", name: "Maués", x: 750, y: 600, size: 16 },
  { id: "barcelos", name: "Barcelos", x: 480, y: 350, size: 18 },
];

interface AmazonasMapProps {
  data: SheetsData;
  onExportPdf?: (name: string) => void;
  onExportCsv?: (name: string) => void;
}

export function AmazonasMap({ data, onExportPdf, onExportCsv }: AmazonasMapProps) {
  const [selectedMun, setSelectedMun] = useState<string | null>(null);
  const [panelOpen, setPanelOpen] = useState(false);

  const munData = useMemo(() => {
    if (!selectedMun) return null;
    
    const munName = MUNICIPIOS_GEO.find(m => m.id === selectedMun)?.name;
    if (!munName) return null;

    const normalize = (s: string) => s.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase();
    const target = normalize(munName);

    const incendios = data.incendios_diario?.find(r => normalize(r.mun || "") === target);
    const efetivo = data.efetivo?.find(r => normalize(r.mun || "") === target);
    const outras = data.outras_diarias?.find(r => normalize(r.mun || "") === target);

    return {
      name: munName,
      incendios: incendios ? (Number(incendios.urb || 0) + Number(incendios.flor || 0)) : 0,
      focos: incendios ? Number(incendios.focos || 0) : 0,
      efetivo: efetivo ? (Number(efetivo.ord || 0) + Number(efetivo.seg || 0) + Number(efetivo.brig || 0)) : 0,
      outras: outras ? (Number(outras.salvamento || 0) + Number(outras.acidentes || 0) + Number(outras.aph || 0) + Number(outras.prevencao || 0) + Number(outras.servicos || 0)) : 0,
    };
  }, [selectedMun, data]);

  return (
    <div className="relative w-full aspect-[4/3] max-h-[700px] bg-emerald-50/30 dark:bg-emerald-950/10 rounded-3xl border border-emerald-100 dark:border-emerald-900/30 overflow-hidden shadow-inner p-4">
      {/* Background Decorativo */}
      <div className="absolute inset-0 opacity-10 pointer-events-none">
        <svg width="100%" height="100%" viewBox="0 0 1000 1000">
          <path d="M0,500 Q250,450 500,500 T1000,500" fill="none" stroke="currentColor" strokeWidth="2" className="text-emerald-500" />
          <path d="M0,600 Q250,550 500,600 T1000,600" fill="none" stroke="currentColor" strokeWidth="2" className="text-emerald-500" />
        </svg>
      </div>

      <div className="absolute top-6 left-6 z-10 space-y-2">
        <div className="flex items-center gap-2 text-emerald-800 dark:text-emerald-300">
          <Info className="w-5 h-5" />
          <h3 className="font-display font-bold text-lg">Mapa Operacional do Amazonas</h3>
        </div>
        <p className="text-sm text-emerald-600/80 dark:text-emerald-400/60 max-w-[240px]">
          Selecione um município para visualizar as ocorrências em tempo real.
        </p>
      </div>

      {/* SVG do Mapa */}
      <svg
        viewBox="0 0 1000 1000"
        className="w-full h-full drop-shadow-2xl"
        preserveAspectRatio="xMidYMid meet"
      >
        {/* Contorno simplificado do Amazonas */}
        <path
          d="M150,150 L450,50 L750,120 L920,350 L960,550 L850,850 L650,920 L350,940 L120,850 L60,600 L120,350 Z"
          fill="none"
          stroke="currentColor"
          strokeWidth="4"
          strokeLinejoin="round"
          className="text-emerald-200 dark:text-emerald-800/40"
        />

        {/* Municípios Interativos */}
        {MUNICIPIOS_GEO.map((mun) => {
          const isSelected = selectedMun === mun.id;
          
          // Calcular a cor baseada em ocorrências
          const munName = mun.name;
          const normalize = (s: string) =>
            s
              .normalize("NFD")
              .replace(/[\u0300-\u036f]/g, "")
              .toLowerCase();
          const target = normalize(munName);

          // Buscar dados no range atual
          const incendios = data.incendios_diario?.find((r) => normalize(r.mun || "") === target);
          const hasIncendios =
            incendios && (Number(incendios.urb || 0) + Number(incendios.flor || 0)) > 0;
          const totalIncendios = incendios
            ? Number(incendios.urb || 0) + Number(incendios.flor || 0)
            : 0;

          return (
            <g
              key={mun.id}
              onClick={() => setSelectedMun(isSelected ? null : mun.id)}
              className="cursor-pointer group"
            >
              <motion.circle
                cx={mun.x}
                cy={mun.y}
                r={isSelected ? mun.size * 1.2 : mun.size}
                initial={{ scale: 0 }}
                animate={{ 
                  scale: 1,
                  fill: isSelected ? "#2f9755" : hasIncendios ? "#ef4444" : "#8dd2a2",
                  fillOpacity: isSelected ? 0.9 : hasIncendios ? Math.min(0.4 + totalIncendios * 0.1, 0.9) : 0.4,
                }}
                whileHover={{ scale: 1.1, fillOpacity: 0.8 }}
                className={cn(
                  "transition-all duration-300",
                  isSelected ? "stroke-white stroke-[3px]" : "stroke-emerald-400 stroke-1 dark:stroke-emerald-600/50"
                )}
              />
              
              <text
                x={mun.x}
                y={mun.y + mun.size + 15}
                textAnchor="middle"
                className={cn(
                  "text-[12px] font-bold select-none pointer-events-none transition-colors",
                  isSelected 
                    ? "fill-primary dark:fill-primary" 
                    : "fill-emerald-800/60 dark:fill-emerald-400/40 group-hover:fill-emerald-800 dark:group-hover:fill-emerald-200"
                )}
              >
                {mun.name}
              </text>
            </g>
          );
        })}
      </svg>

      {/* Popup de Informações */}
      <AnimatePresence>
        {selectedMun && munData && (
          <motion.div
            initial={{ opacity: 0, scale: 0.9, y: 20 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.9, y: 20 }}
            className="absolute bottom-6 left-6 right-6 md:left-auto md:w-80 z-20"
          >
            <Card className="bg-white/95 dark:bg-slate-900/95 backdrop-blur-md border-emerald-500/30 shadow-2xl overflow-hidden">
              <div className="bg-gradient-brand p-3 flex items-center justify-between">
                <div className="flex items-center gap-2 text-white">
                  <MapPin className="w-4 h-4" />
                  <span className="font-display font-bold text-sm">{munData.name}</span>
                </div>
                <Button 
                  variant="ghost" 
                  size="icon" 
                  className="w-6 h-6 text-white hover:bg-white/20 rounded-full"
                  onClick={() => setSelectedMun(null)}
                >
                  <X className="w-4 h-4" />
                </Button>
              </div>
              <CardContent className="p-4 space-y-4">
                <div className="grid grid-cols-2 gap-3">
                  <div className="p-2.5 rounded-xl bg-red-50 dark:bg-red-950/20 border border-red-100 dark:border-red-900/30">
                    <div className="flex items-center gap-1.5 text-red-600 dark:text-red-400 mb-1">
                      <Flame className="w-3.5 h-3.5" />
                      <span className="text-[10px] font-bold uppercase tracking-wider">Incêndios</span>
                    </div>
                    <div className="text-xl font-display font-black text-red-700 dark:text-red-300">
                      {munData.incendios}
                    </div>
                  </div>
                  
                  <div className="p-2.5 rounded-xl bg-emerald-50 dark:bg-emerald-950/20 border border-emerald-100 dark:border-emerald-900/30">
                    <div className="flex items-center gap-1.5 text-emerald-600 dark:text-emerald-400 mb-1">
                      <Users className="w-3.5 h-3.5" />
                      <span className="text-[10px] font-bold uppercase tracking-wider">Efetivo</span>
                    </div>
                    <div className="text-xl font-display font-black text-emerald-700 dark:text-emerald-300">
                      {munData.efetivo}
                    </div>
                  </div>
                </div>
                
                <div className="flex gap-2">
                  <Button 
                    className="flex-1 bg-gradient-brand hover:brightness-110 text-white font-bold text-xs h-9 rounded-lg transition-all gap-2"
                    onClick={() => setPanelOpen(true)}
                  >
                    Detalhes
                    <ChevronRight className="w-3 h-3" />
                  </Button>
                  
                  <Button
                    variant="outline"
                    size="icon"
                    className="h-9 w-9 border-red-200 text-red-600 hover:bg-red-50 rounded-lg"
                    title="Exportar PDF do município"
                    onClick={() => onExportPdf?.(munData.name)}
                  >
                    <FileText className="w-4 h-4" />
                  </Button>
                  
                  <Button
                    variant="outline"
                    size="icon"
                    className="h-9 w-9 border-emerald-200 text-emerald-600 hover:bg-emerald-50 rounded-lg"
                    title="Exportar CSV do município"
                    onClick={() => onExportCsv?.(munData.name)}
                  >
                    <FileDown className="w-4 h-4" />
                  </Button>
                </div>
              </CardContent>
            </Card>
          </motion.div>
        )}
      </AnimatePresence>

      <MapDetailsPanel 
        isOpen={panelOpen}
        onClose={() => setPanelOpen(false)}
        municipioName={selectedMun ? (MUNICIPIOS_GEO.find(m => m.id === selectedMun)?.name || selectedMun) : null}
        onMunicipioSelect={(name) => {
          if (!name) {
            setSelectedMun(null);
            return;
          }
          const geo = MUNICIPIOS_GEO.find(m => m.name.toLowerCase() === name.toLowerCase());
        setSelectedMun(geo ? geo.id : name);
        }}
        data={data}
        onExportPdf={onExportPdf}
        onExportCsv={onExportCsv}
      />
    </div>
  );
}
