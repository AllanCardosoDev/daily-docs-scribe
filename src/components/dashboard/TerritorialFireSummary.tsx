import { useState, useMemo, useRef, useEffect } from "react";
import { Building2, Landmark, MapPin, Flame, TreePine, ChevronDown, ChevronUp } from "lucide-react";
import type { AnnualYearSummary } from "@/lib/annual-reports.functions";
import { NF } from "@/lib/formatters";
import { cn } from "@/lib/utils";

interface TerritorialFireSummaryProps {
  annualData?: AnnualYearSummary[];
  className?: string;
}

const MONTHS_COL1 = [
  { value: 1, label: "Janeiro" },
  { value: 3, label: "Março" },
  { value: 5, label: "Maio" },
  { value: 7, label: "Julho" },
  { value: 9, label: "Setembro" },
  { value: 11, label: "Novembro" },
];

const MONTHS_COL2 = [
  { value: 2, label: "Fevereiro" },
  { value: 4, label: "Abril" },
  { value: 6, label: "Junho" },
  { value: 8, label: "Agosto" },
  { value: 10, label: "Outubro" },
  { value: 12, label: "Dezembro" },
];

const ALL_MONTHS = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12];

interface MonthMultiSelectDropdownProps {
  selectedMonths: number[];
  onChange: (months: number[]) => void;
  colorScheme?: "sky" | "purple" | "amber";
}

export function MonthMultiSelectDropdown({
  selectedMonths,
  onChange,
  colorScheme = "sky",
}: MonthMultiSelectDropdownProps) {
  const [isOpen, setIsOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    }
    if (isOpen) {
      document.addEventListener("mousedown", handleClickOutside);
    }
    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
    };
  }, [isOpen]);

  const toggleMonth = (monthVal: number) => {
    if (selectedMonths.includes(monthVal)) {
      onChange(selectedMonths.filter((m) => m !== monthVal));
    } else {
      onChange([...selectedMonths, monthVal].sort((a, b) => a - b));
    }
  };

  const handleSelectAll = (e: React.MouseEvent) => {
    e.stopPropagation();
    onChange(ALL_MONTHS);
  };

  const handleClearAll = (e: React.MouseEvent) => {
    e.stopPropagation();
    onChange([]);
  };

  const ringFocusClass =
    colorScheme === "purple"
      ? "focus:ring-purple-500"
      : colorScheme === "amber"
      ? "focus:ring-amber-500"
      : "focus:ring-sky-500";

  return (
    <div className="relative w-full" ref={dropdownRef}>
      <button
        type="button"
        onClick={() => setIsOpen(!isOpen)}
        className={cn(
          "w-full h-9 rounded-lg border border-input bg-background hover:bg-muted/50 text-foreground px-3 text-xs flex items-center justify-between font-medium shadow-sm transition-all focus:outline-none focus:ring-2",
          ringFocusClass,
          isOpen && "ring-2 ring-primary border-primary"
        )}
      >
        <span className="truncate">
          {selectedMonths.length === 0
            ? "Nenhum mês selecionado"
            : `${selectedMonths.length} mês(es) selecionado(s)`}
        </span>
        {isOpen ? (
          <ChevronUp className="w-3.5 h-3.5 text-muted-foreground shrink-0 ml-1.5" />
        ) : (
          <ChevronDown className="w-3.5 h-3.5 text-muted-foreground shrink-0 ml-1.5" />
        )}
      </button>

      {isOpen && (
        <div className="absolute left-0 right-0 top-full mt-1.5 z-50 rounded-xl bg-popover text-popover-foreground border border-border shadow-2xl p-3.5 min-w-[280px] animate-in fade-in zoom-in-95 duration-100">
          {/* Ações Selecionar Todos / Limpar */}
          <div className="flex items-center justify-between pb-2.5 mb-2.5 border-b border-border text-xs">
            <button
              type="button"
              onClick={handleSelectAll}
              className="text-primary hover:underline font-bold transition-colors"
            >
              Selecionar todos
            </button>
            <button
              type="button"
              onClick={handleClearAll}
              className="text-primary hover:underline font-bold transition-colors"
            >
              Limpar
            </button>
          </div>

          {/* Grid de 2 Colunas de Meses */}
          <div className="grid grid-cols-2 gap-x-3 gap-y-1.5 text-xs">
            {/* Coluna 1 (Ímpares) */}
            <div className="space-y-1.5">
              {MONTHS_COL1.map((m) => {
                const checked = selectedMonths.includes(m.value);
                return (
                  <label
                    key={m.value}
                    className="flex items-center gap-2 cursor-pointer py-1.5 px-2 rounded-lg hover:bg-accent hover:text-accent-foreground transition-colors select-none text-foreground text-xs font-medium"
                  >
                    <input
                      type="checkbox"
                      checked={checked}
                      onChange={() => toggleMonth(m.value)}
                      className="rounded border-input text-primary focus:ring-primary h-3.5 w-3.5 accent-primary cursor-pointer"
                    />
                    <span>{m.label}</span>
                  </label>
                );
              })}
            </div>

            {/* Coluna 2 (Pares) */}
            <div className="space-y-1.5">
              {MONTHS_COL2.map((m) => {
                const checked = selectedMonths.includes(m.value);
                return (
                  <label
                    key={m.value}
                    className="flex items-center gap-2 cursor-pointer py-1.5 px-2 rounded-lg hover:bg-accent hover:text-accent-foreground transition-colors select-none text-foreground text-xs font-medium"
                  >
                    <input
                      type="checkbox"
                      checked={checked}
                      onChange={() => toggleMonth(m.value)}
                      className="rounded border-input text-primary focus:ring-primary h-3.5 w-3.5 accent-primary cursor-pointer"
                    />
                    <span>{m.label}</span>
                  </label>
                );
              })}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

interface TerritorialCardConfig {
  id: "manaus" | "interior" | "amazonas";
  title: string;
  icon: typeof Building2;
  borderColor: string;
  badgeBg: string;
  badgeText: string;
}

const CARDS_CONFIG: TerritorialCardConfig[] = [
  {
    id: "manaus",
    title: "Manaus",
    icon: Building2,
    borderColor: "border-sky-500/30 hover:border-sky-500/60",
    badgeBg: "bg-sky-500/15 border border-sky-500/30",
    badgeText: "text-sky-600 dark:text-sky-400",
  },
  {
    id: "interior",
    title: "Interior",
    icon: Landmark,
    borderColor: "border-purple-500/30 hover:border-purple-500/60",
    badgeBg: "bg-purple-500/15 border border-purple-500/30",
    badgeText: "text-purple-600 dark:text-purple-400",
  },
  {
    id: "amazonas",
    title: "Amazonas",
    icon: MapPin,
    borderColor: "border-amber-500/30 hover:border-amber-500/60",
    badgeBg: "bg-amber-500/15 border border-amber-500/30",
    badgeText: "text-amber-600 dark:text-amber-400",
  },
];

export function TerritorialFireSummary({ annualData, className }: TerritorialFireSummaryProps) {
  // Anos disponíveis
  const availableYears = useMemo(() => {
    if (!annualData || annualData.length === 0) return [2026, 2025, 2024, 2023];
    return annualData.map((d) => d.year).sort((a, b) => b - a);
  }, [annualData]);

  // Filtros individuais por card: inicializa com 2026 e mês 8 (Agosto, com dados ativos)
  const [yearManaus, setYearManaus] = useState<number>(2026);
  const [monthsManaus, setMonthsManaus] = useState<number[]>([8]);

  const [yearInterior, setYearInterior] = useState<number>(2026);
  const [monthsInterior, setMonthsInterior] = useState<number[]>([8]);

  const [yearAmazonas, setYearAmazonas] = useState<number>(2026);
  const [monthsAmazonas, setMonthsAmazonas] = useState<number[]>([8]);

  // Cálculo dos totais para Manaus
  const statsManaus = useMemo(() => {
    if (!annualData) return { urb: 0, flor: 0 };
    const yearObj = annualData.find((y) => y.year === yearManaus);
    if (!yearObj || !yearObj.monthly) {
      const list = yearObj?.incendios?.rows ?? [];
      const mRow = list.find((r) => r.mun.toLowerCase() === "manaus");
      return { urb: mRow?.urb ?? 0, flor: mRow?.flor ?? 0 };
    }

    let urb = 0;
    let flor = 0;
    for (const m of monthsManaus) {
      const mObj = yearObj.monthly[m];
      if (mObj?.manaus) {
        urb += mObj.manaus.urb || 0;
        flor += mObj.manaus.flor || 0;
      }
    }
    return { urb, flor };
  }, [annualData, yearManaus, monthsManaus]);

  // Cálculo dos totais para Interior
  const statsInterior = useMemo(() => {
    if (!annualData) return { urb: 0, flor: 0 };
    const yearObj = annualData.find((y) => y.year === yearInterior);
    if (!yearObj || !yearObj.monthly) {
      const list = yearObj?.incendios?.rows ?? [];
      const interiorRows = list.filter((r) => r.mun.toLowerCase() !== "manaus");
      return {
        urb: interiorRows.reduce((acc, r) => acc + (r.urb || 0), 0),
        flor: interiorRows.reduce((acc, r) => acc + (r.flor || 0), 0),
      };
    }

    let urb = 0;
    let flor = 0;
    for (const m of monthsInterior) {
      const mObj = yearObj.monthly[m];
      if (mObj?.interior) {
        urb += mObj.interior.urb || 0;
        flor += mObj.interior.flor || 0;
      }
    }
    return { urb, flor };
  }, [annualData, yearInterior, monthsInterior]);

  // Cálculo dos totais para Amazonas
  const statsAmazonas = useMemo(() => {
    if (!annualData) return { urb: 0, flor: 0 };
    const yearObj = annualData.find((y) => y.year === yearAmazonas);
    if (!yearObj || !yearObj.monthly) {
      return {
        urb: yearObj?.incendios?.totals?.urb ?? 0,
        flor: yearObj?.incendios?.totals?.flor ?? 0,
      };
    }

    let urb = 0;
    let flor = 0;
    for (const m of monthsAmazonas) {
      const mObj = yearObj.monthly[m];
      if (mObj?.amazonas) {
        urb += mObj.amazonas.urb || 0;
        flor += mObj.amazonas.flor || 0;
      }
    }
    return { urb, flor };
  }, [annualData, yearAmazonas, monthsAmazonas]);

  return (
    <section className={cn("space-y-3.5", className)}>
      {/* Título e Subtítulo da Seção */}
      <div className="space-y-1">
        <h2 className="text-base sm:text-lg font-bold text-foreground tracking-tight">
          Resumo territorial de incêndios
        </h2>
        <p className="text-xs text-muted-foreground">
          Cada card possui filtros próprios de ano e meses; os totais respeitam as fontes selecionadas acima.
        </p>
      </div>

      {/* Grid de 3 Cards Territoriais */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {/* CARD 1: MANAUS */}
        <div
          className={cn(
            "rounded-2xl bg-card border p-4 sm:p-5 shadow-sm space-y-4 hover:shadow-md transition-all",
            CARDS_CONFIG[0].borderColor
          )}
        >
          {/* Cabeçalho do Card */}
          <div className="flex items-center gap-2.5">
            <div className={cn("p-2 rounded-xl shrink-0", CARDS_CONFIG[0].badgeBg, CARDS_CONFIG[0].badgeText)}>
              <Building2 className="w-5 h-5" />
            </div>
            <h3 className="font-bold text-base text-foreground tracking-tight">Manaus</h3>
          </div>

          {/* Subcards de Estatísticas lado a lado */}
          <div className="grid grid-cols-2 gap-3">
            {/* Incêndios Urbanos */}
            <div className="rounded-xl bg-amber-500/10 dark:bg-amber-950/30 border border-amber-500/25 p-3.5 flex flex-col justify-between min-h-[95px] shadow-sm">
              <div className="flex items-start justify-between">
                <span className="text-3xl font-black text-amber-600 dark:text-amber-400 tabular-nums leading-none">
                  {NF.format(statsManaus.urb)}
                </span>
                <Flame className="w-4 h-4 text-amber-600 dark:text-amber-400" />
              </div>
              <span className="text-xs font-semibold text-foreground/80 mt-2">
                Incêndios urbanos
              </span>
            </div>

            {/* Incêndios Florestais */}
            <div className="rounded-xl bg-emerald-500/10 dark:bg-emerald-950/30 border border-emerald-500/25 p-3.5 flex flex-col justify-between min-h-[95px] shadow-sm">
              <div className="flex items-start justify-between">
                <span className="text-3xl font-black text-emerald-600 dark:text-emerald-400 tabular-nums leading-none">
                  {NF.format(statsManaus.flor)}
                </span>
                <TreePine className="w-4 h-4 text-emerald-600 dark:text-emerald-400" />
              </div>
              <span className="text-xs font-semibold text-foreground/80 mt-2">
                Incêndios florestais
              </span>
            </div>
          </div>

          {/* Controles de Filtro: Ano e Meses */}
          <div className="space-y-2.5 pt-1">
            <div>
              <label className="text-xs font-semibold text-muted-foreground block mb-1">
                Ano
              </label>
              <select
                value={yearManaus}
                onChange={(e) => setYearManaus(Number(e.target.value))}
                className="w-full h-9 rounded-lg border border-input bg-background text-foreground px-3 text-xs font-semibold shadow-sm focus:outline-none focus:ring-2 focus:ring-sky-500/40 cursor-pointer"
              >
                {availableYears.map((y) => (
                  <option key={y} value={y}>
                    {y}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="text-xs font-semibold text-muted-foreground block mb-1">
                Meses
              </label>
              <MonthMultiSelectDropdown
                selectedMonths={monthsManaus}
                onChange={setMonthsManaus}
                colorScheme="sky"
              />
            </div>
          </div>
        </div>

        {/* CARD 2: INTERIOR */}
        <div
          className={cn(
            "rounded-2xl bg-card border p-4 sm:p-5 shadow-sm space-y-4 hover:shadow-md transition-all",
            CARDS_CONFIG[1].borderColor
          )}
        >
          {/* Cabeçalho do Card */}
          <div className="flex items-center gap-2.5">
            <div className={cn("p-2 rounded-xl shrink-0", CARDS_CONFIG[1].badgeBg, CARDS_CONFIG[1].badgeText)}>
              <Landmark className="w-5 h-5" />
            </div>
            <h3 className="font-bold text-base text-foreground tracking-tight">Interior</h3>
          </div>

          {/* Subcards de Estatísticas lado a lado */}
          <div className="grid grid-cols-2 gap-3">
            {/* Incêndios Urbanos */}
            <div className="rounded-xl bg-amber-500/10 dark:bg-amber-950/30 border border-amber-500/25 p-3.5 flex flex-col justify-between min-h-[95px] shadow-sm">
              <div className="flex items-start justify-between">
                <span className="text-3xl font-black text-amber-600 dark:text-amber-400 tabular-nums leading-none">
                  {NF.format(statsInterior.urb)}
                </span>
                <Flame className="w-4 h-4 text-amber-600 dark:text-amber-400" />
              </div>
              <span className="text-xs font-semibold text-foreground/80 mt-2">
                Incêndios urbanos
              </span>
            </div>

            {/* Incêndios Florestais */}
            <div className="rounded-xl bg-emerald-500/10 dark:bg-emerald-950/30 border border-emerald-500/25 p-3.5 flex flex-col justify-between min-h-[95px] shadow-sm">
              <div className="flex items-start justify-between">
                <span className="text-3xl font-black text-emerald-600 dark:text-emerald-400 tabular-nums leading-none">
                  {NF.format(statsInterior.flor)}
                </span>
                <TreePine className="w-4 h-4 text-emerald-600 dark:text-emerald-400" />
              </div>
              <span className="text-xs font-semibold text-foreground/80 mt-2">
                Incêndios florestais
              </span>
            </div>
          </div>

          {/* Controles de Filtro: Ano e Meses */}
          <div className="space-y-2.5 pt-1">
            <div>
              <label className="text-xs font-semibold text-muted-foreground block mb-1">
                Ano
              </label>
              <select
                value={yearInterior}
                onChange={(e) => setYearInterior(Number(e.target.value))}
                className="w-full h-9 rounded-lg border border-input bg-background text-foreground px-3 text-xs font-semibold shadow-sm focus:outline-none focus:ring-2 focus:ring-purple-500/40 cursor-pointer"
              >
                {availableYears.map((y) => (
                  <option key={y} value={y}>
                    {y}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="text-xs font-semibold text-muted-foreground block mb-1">
                Meses
              </label>
              <MonthMultiSelectDropdown
                selectedMonths={monthsInterior}
                onChange={setMonthsInterior}
                colorScheme="purple"
              />
            </div>
          </div>
        </div>

        {/* CARD 3: AMAZONAS */}
        <div
          className={cn(
            "rounded-2xl bg-card border p-4 sm:p-5 shadow-sm space-y-4 hover:shadow-md transition-all",
            CARDS_CONFIG[2].borderColor
          )}
        >
          {/* Cabeçalho do Card */}
          <div className="flex items-center gap-2.5">
            <div className={cn("p-2 rounded-xl shrink-0", CARDS_CONFIG[2].badgeBg, CARDS_CONFIG[2].badgeText)}>
              <MapPin className="w-5 h-5" />
            </div>
            <h3 className="font-bold text-base text-foreground tracking-tight">Amazonas</h3>
          </div>

          {/* Subcards de Estatísticas lado a lado */}
          <div className="grid grid-cols-2 gap-3">
            {/* Incêndios Urbanos */}
            <div className="rounded-xl bg-amber-500/10 dark:bg-amber-950/30 border border-amber-500/25 p-3.5 flex flex-col justify-between min-h-[95px] shadow-sm">
              <div className="flex items-start justify-between">
                <span className="text-3xl font-black text-amber-600 dark:text-amber-400 tabular-nums leading-none">
                  {NF.format(statsAmazonas.urb)}
                </span>
                <Flame className="w-4 h-4 text-amber-600 dark:text-amber-400" />
              </div>
              <span className="text-xs font-semibold text-foreground/80 mt-2">
                Incêndios urbanos
              </span>
            </div>

            {/* Incêndios Florestais */}
            <div className="rounded-xl bg-emerald-500/10 dark:bg-emerald-950/30 border border-emerald-500/25 p-3.5 flex flex-col justify-between min-h-[95px] shadow-sm">
              <div className="flex items-start justify-between">
                <span className="text-3xl font-black text-emerald-600 dark:text-emerald-400 tabular-nums leading-none">
                  {NF.format(statsAmazonas.flor)}
                </span>
                <TreePine className="w-4 h-4 text-emerald-600 dark:text-emerald-400" />
              </div>
              <span className="text-xs font-semibold text-foreground/80 mt-2">
                Incêndios florestais
              </span>
            </div>
          </div>

          {/* Controles de Filtro: Ano e Meses */}
          <div className="space-y-2.5 pt-1">
            <div>
              <label className="text-xs font-semibold text-muted-foreground block mb-1">
                Ano
              </label>
              <select
                value={yearAmazonas}
                onChange={(e) => setYearAmazonas(Number(e.target.value))}
                className="w-full h-9 rounded-lg border border-input bg-background text-foreground px-3 text-xs font-semibold shadow-sm focus:outline-none focus:ring-2 focus:ring-amber-500/40 cursor-pointer"
              >
                {availableYears.map((y) => (
                  <option key={y} value={y}>
                    {y}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="text-xs font-semibold text-muted-foreground block mb-1">
                Meses
              </label>
              <MonthMultiSelectDropdown
                selectedMonths={monthsAmazonas}
                onChange={setMonthsAmazonas}
                colorScheme="amber"
              />
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
