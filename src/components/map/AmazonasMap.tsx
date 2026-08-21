import React, { useMemo, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { MapPin, Flame, Users, Info, X, ChevronRight, FileDown, FileText, Search } from "lucide-react";
import { cn } from "@/lib/utils";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { MapDetailsPanel } from "./MapDetailsPanel";
import type { SheetsData } from "@/lib/sheets.types";

/**
 * Coordenadas geográficas reais convertidas para o sistema 1000x1000 do SVG.
 * Baseado na malha oficial do IBGE para o estado do Amazonas.
 */
const MUNICIPIOS_GEO = [
  { id: "manaus", name: "Manaus", x: 777.9, y: 443.9, size: 28 },
  { id: "itacoatiara", name: "Itacoatiara", x: 867.7, y: 446.4, size: 18 },
  { id: "manacapuru", name: "Manacapuru", x: 744.6, y: 459.6, size: 18 },
  { id: "iranduba", name: "Iranduba", x: 769.5, y: 458.0, size: 15 },
  { id: "parintins", name: "Parintins", x: 964.3, y: 404.1, size: 20 },
  { id: "tefe", name: "Tefé", x: 509.0, y: 463.8, size: 18 },
  { id: "tabatinga", name: "Tabatinga", x: 218.7, y: 536.7, size: 18 },
  { id: "humaita", name: "Humaitá", x: 608.5, y: 807.8, size: 18 },
  { id: "labrea", name: "Lábrea", x: 509.0, y: 787.1, size: 16 },
  { id: "apui", name: "Apuí", x: 785.8, y: 782.1, size: 16 },
  { id: "boca-do-acre", name: "Boca do Acre", x: 362.2, y: 911.5, size: 15 },
  { id: "sao-gabriel-da-cachoeira", name: "São Gabriel da Cachoeira", x: 379.7, y: 196.8, size: 22 },
  { id: "presidente-figueiredo", name: "Presidente Figueiredo", x: 778.5, y: 354.3, size: 16 },
  { id: "coari", name: "Coari", x: 602.3, y: 524.3, size: 16 },
  { id: "eirunepe", name: "Eirunepé", x: 222.1, y: 738.2, size: 15 },
  { id: "maues", name: "Maués", x: 909.0, y: 466.3, size: 16 },
  { id: "barcelos", name: "Barcelos", x: 614.7, y: 266.5, size: 18 },
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
        {/* Contorno Real do Amazonas (IBGE) */}
        <path
          d="M884.3,794.8L882.4,781.4L873.7,765.2L868.0,758.8L865.4,748.3L868.5,734.6L877.5,722.9L900.5,650.4L929.3,559.3L951.6,489.4L954.0,481.4L959.8,462.4L962.2,454.9L982.9,389.7L979.3,387.6L983.6,374.9L994.1,367.0L1000.0,354.1L992.7,356.5L982.2,366.4L975.8,363.4L972.5,366.5L967.2,369.5L962.6,366.3L963.3,352.8L957.1,353.2L947.5,345.1L944.4,333.8L934.5,326.7L929.1,330.0L915.9,317.1L911.0,318.3L908.9,310.7L894.9,301.8L892.7,296.4L894.5,283.1L890.7,277.1L883.8,288.2L878.0,279.8L874.7,281.2L868.4,271.3L868.1,260.0L855.1,245.5L851.1,236.8L851.7,222.7L843.5,214.8L843.8,192.5L842.0,187.0L842.0,164.2L831.3,196.1L821.9,231.7L826.6,245.6L816.0,250.8L813.9,258.1L806.4,259.7L801.1,256.4L798.1,243.3L791.4,231.5L775.1,227.5L774.5,232.6L761.8,240.3L757.4,248.6L754.9,267.1L757.0,274.1L752.2,293.9L752.7,301.7L757.3,304.9L760.9,316.9L753.5,306.1L742.6,300.5L740.2,302.2L737.0,301.7L730.2,280.7L724.1,272.0L716.5,266.9L708.8,254.1L702.4,249.0L703.7,242.5L711.0,244.3L715.0,238.5L713.2,231.2L720.5,212.8L717.2,210.6L717.5,200.2L713.1,194.0L712.8,186.3L708.1,179.8L705.6,168.8L706.0,154.6L701.9,149.3L700.8,130.1L705.0,121.6L706.2,106.6L704.5,96.0L701.7,96.2L695.0,66.8L689.6,59.2L685.7,54.1L690.0,45.1L691.5,25.7L683.8,18.9L673.4,19.0L666.9,6.9L659.1,7.4L653.7,2.7L652.2,8.1L643.0,9.3L627.8,22.9L619.6,21.0L614.7,26.0L614.5,47.1L599.8,67.0L595.6,70.4L595.8,59.5L587.0,68.6L584.8,75.2L575.1,84.0L571.7,80.0L564.5,83.9L560.5,93.6L553.0,92.8L552.4,107.2L543.1,108.8L536.7,128.8L531.2,132.3L528.3,126.2L533.5,116.2L528.6,102.4L520.0,103.2L509.4,112.1L507.2,118.9L496.7,124.3L493.2,121.3L487.4,125.0L487.2,123.4L456.8,84.0L443.8,89.3L444.7,66.4L443.2,42.4L439.9,32.8L433.0,30.5L426.8,0.0L419.3,6.1L413.7,18.3L404.7,17.7L395.6,34.3L387.3,28.4L384.3,21.5L378.5,26.3L377.2,34.5L383.4,42.5L313.7,42.6L305.6,38.7L298.8,43.6L288.0,44.5L287.9,96.7L296.1,93.3L296.0,96.9L317.6,95.8L321.9,99.3L327.9,112.8L325.2,124.1L329.2,132.6L316.0,135.1L308.6,125.1L300.3,134.0L297.0,131.1L289.3,137.0L276.7,139.4L276.7,180.4L276.0,201.5L283.6,213.5L288.0,214.7L301.3,228.6L303.9,239.1L300.4,248.2L306.0,262.5L311.9,269.0L313.3,280.9L311.5,301.1L301.1,388.3L288.5,491.7L282.1,540.0L276.7,548.6L271.8,541.0L268.0,547.2L261.9,538.1L262.7,530.9L249.8,529.0L244.5,533.7L236.4,530.8L230.4,538.7L226.3,549.4L207.7,549.5L208.0,552.9L194.4,554.0L187.9,561.5L178.8,557.8L171.1,561.7L169.3,568.1L152.6,582.4L145.3,584.6L142.9,592.3L132.6,599.1L116.2,614.0L117.2,625.4L111.9,641.9L112.0,654.8L101.3,672.1L95.7,695.5L103.7,717.5L97.8,731.4L89.8,732.8L73.5,746.7L67.2,761.6L68.8,768.2L64.5,775.6L68.1,777.5L115.5,802.7L133.3,812.1L156.7,816.2L169.4,818.3L201.2,823.8L217.8,826.6L250.2,832.1L276.2,836.4L290.5,854.3L310.7,879.7L323.7,896.1L340.2,916.8L355.7,936.3L379.8,952.3L393.6,961.4L419.5,978.7L430.3,981.3L430.4,981.3L441.1,988.2L459.5,1000.0L470.8,987.3L477.0,984.7L483.1,973.7L482.1,965.9L495.4,968.2L506.9,966.4L515.1,976.1L520.5,978.9L523.3,969.6L528.5,966.5L537.3,970.2L536.9,958.0L539.5,960.3L546.4,954.0L549.8,955.3L553.6,969.2L558.7,965.5L566.3,950.4L565.1,942.5L572.6,931.0L583.7,933.6L585.5,931.2L599.9,926.3L600.6,931.9L610.2,927.6L610.1,910.9L616.2,906.8L622.5,895.6L619.7,888.9L621.4,876.7L625.5,873.2L630.0,876.9L632.4,866.5L639.6,851.7L639.6,847.3L682.2,847.3L692.1,857.0L694.2,868.3L699.4,872.8L701.9,881.2L704.9,877.4L710.8,882.3L710.5,890.2L714.8,902.3L716.0,897.0L720.5,898.2L724.1,915.7L729.4,915.6L731.7,921.6L736.7,920.8L740.4,910.0L747.4,906.3L754.7,915.5L820.4,915.3L893.5,915.9L932.2,915.5L938.6,908.3L932.4,907.6L935.1,898.6L933.5,889.9L939.3,876.1L941.0,856.6L935.8,835.0L940.5,830.3L945.7,817.8L945.1,804.4L949.4,795.9L948.8,794.8Z"
          fill="none"
          stroke="currentColor"
          strokeWidth="3"
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
