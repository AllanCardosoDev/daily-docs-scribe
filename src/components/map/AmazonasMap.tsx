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
  { id: "manaus", name: "Manaus", x: -60.03, y: 3.11, size: 0.4 },
  { id: "itacoatiara", name: "Itacoatiara", x: -58.44, y: 3.14, size: 0.28 },
  { id: "manacapuru", name: "Manacapuru", x: -60.62, y: 3.30, size: 0.28 },
  { id: "iranduba", name: "Iranduba", x: -60.18, y: 3.28, size: 0.24 },
  { id: "parintins", name: "Parintins", x: -56.73, y: 2.63, size: 0.32 },
  { id: "tefe", name: "Tefé", x: -64.79, y: 3.35, size: 0.28 },
  { id: "tabatinga", name: "Tabatinga", x: -69.93, y: 4.23, size: 0.28 },
  { id: "humaita", name: "Humaitá", x: -63.03, y: 7.50, size: 0.28 },
  { id: "labrea", name: "Lábrea", x: -64.79, y: 7.25, size: 0.26 },
  { id: "apui", name: "Apuí", x: -59.89, y: 7.19, size: 0.26 },
  { id: "boca-do-acre", name: "Boca do Acre", x: -67.39, y: 8.75, size: 0.24 },
  { id: "sao-gabriel-da-cachoeira", name: "São Gabriel da Cachoeira", x: -67.08, y: 0.13, size: 0.35 },
  { id: "presidente-figueiredo", name: "Presidente Figueiredo", x: -60.02, y: 2.03, size: 0.26 },
  { id: "coari", name: "Coari", x: -63.14, y: 4.08, size: 0.26 },
  { id: "eirunepe", name: "Eirunepé", x: -69.87, y: 6.66, size: 0.24 },
  { id: "maues", name: "Maués", x: -57.71, y: 3.38, size: 0.26 },
  { id: "barcelos", name: "Barcelos", x: -62.92, y: 0.97, size: 0.28 },
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
        {/* Contorno real do Amazonas */}
        <path
          d="M-581474,-73432l-336,1615l-1544,1953l-992,776l-472,1274l545,1652l1606,1406l4061,8749l5104,10989l3941,8432l423,963l1037,2293l422,901l3658,7864l-624,249l753,1531l1854,954l1051,1562l-1297,-293l-1855,-1197l-1132,367l-585,-373l-935,-361l-819,385l131,1626l-1111,-44l-1694,979l-541,1356l-1761,855l-948,-399l-2347,1562l-865,-144l-375,917l-2476,1064l-390,656l329,1603l-675,730l-1228,-1348l-1015,1020l-591,-169l-1122,1191l-53,1364l-2295,1746l-714,1048l106,1709l-1450,944l56,2695l-311,670l-5,2745h-3679h-1702h-6044l-1896,-3852l-1667,-4291l828,-1677l-1863,-622l-384,-888l-1329,-184l-929,393l-532,1583l-1184,1424l-2895,480l-109,-620l-2241,-928l-775,-997l-452,-2236l379,-842l-859,-2393l97,-933l808,-386l636,-1456l-1303,1309l-1930,675l-419,-205l-567,57l-1209,2537l-1080,1044l-1336,614l-1367,1555l-1144,614l236,775l1296,-209l703,700l-317,878l1298,2223l-595,260l65,1258l-782,742l-61,934l-834,780l-434,1323l63,1717l-723,646l-196,2315l753,1017l203,1816l-289,1278l-495,-25l-1189,3544l-963,914l-690,617l767,1087l253,2338l-1353,826l-1852,-17l-1138,1464l-1388,-67l-957,575l-256,-650l-1642,-145l-2678,-1642l-1458,231l-864,-606l-33,-2547l-2609,-2400l-739,-411l25,1319l-1558,-1100l-375,-794l-1731,-1066l-591,477l-1286,-470l-706,-1166l-1329,101l-99,-1745l-1641,-189l-1139,-2417l-975,-411l-509,728l911,1208l-853,1665l-1538,-93l-1860,-1083l-390,-818l-1867,-650l-619,361l-1035,-445l-20,189l-5384,4752l-2313,-633l159,2757l-251,2900l-597,1162l-1210,269l-1112,3683l-1326,-737l-979,-1466l-1596,74l-1619,-2004l-1462,706l-532,835l-1026,-581l-236,-994l1101,-957l-12345,-20l-1431,474l-1194,-589l-1920,-104l-8,-6298l1440,404l-9,-433l3816,134l762,-419l1056,-1627l-475,-1369l719,-1029l-2341,-299l-1312,1209l-1471,-1075l-589,357l-1365,-721l-2230,-290l1,-4938l-110,-2551l1342,-1447l783,-143l2338,-1677l468,-1263l-621,-1099l990,-1723l1057,-784l233,-1440l-313,-2429l-1837,-10529l-2242,-12464l-1131,-5827l-947,-1045l-874,918l-676,-740l-1075,1092l147,869l-2289,226l-942,-561l-1427,347l-1060,-946l-730,-1299l-3285,-13l48,-402l-2406,-139l-1146,-903l-1619,442l-1363,-460l-325,-783l-2945,-1714l-1301,-273l-424,-932l-1825,-818l-2900,-1789l170,-1378l-937,-1987l20,-1565l-1892,-2088l-992,-2815l1413,-2651l-1041,-1678l-1415,-171l-2883,-1672l-1118,-1798l278,-806l-748,-893l634,-229l8379,-3030l3155,-1143l4153,-486l2241,-262l5637,-655l2932,-340l5733,-661l4602,-527l2533,-2160l3574,-3054l2313,-1979l2917,-2499l2741,-2351l4273,-1934l2431,-1099l4599,-2082l1909,-314l5,-2l1905,-834l3247,-1421l2009,1531l1088,313l1082,1331l-165,936l2353,-275l2033,212l1452,-1169l951,-330l506,1117l913,376l1560,-448l-81,1469l467,-279l1231,760l586,-154l689,-1678l894,447l1338,1818l-202,957l1321,1390l1967,-309l322,281l2555,595l121,-676l1695,514l-13,2021l1076,494l1123,1343l-500,809l291,1472l733,424l796,-444l426,1253l1268,1783l6,531l7546,6l1743,-1170l373,-1362l931,-549l434,-1007l530,450l1047,-588l-53,-951l766,-1455l206,633l805,-148l634,-2111l939,20l409,-730l872,98l665,1302l1232,448l1302,-1108l11629,21l12928,-67l6855,46l1135,865l-1089,88l478,1086l-283,1053l1029,1664l285,2346l-918,2611l841,559l919,1506l-109,1624l760,1024l-103,129Z"
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
