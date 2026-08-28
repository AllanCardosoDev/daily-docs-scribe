import { memo, useMemo } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Calendar as CalendarIcon,
  RotateCcw,
  Sparkles,
  MapPin,
  Clock,
  Layers,
  Filter,
  FileSpreadsheet,
  FileText,
  RefreshCw,
  Search,
  X,
} from "lucide-react";
import { ReportShift } from "@/lib/report-shift";
import { canonicalMunicipio } from "@/lib/municipio-order";

export interface DashboardFilterState {
  reportDate: Date | null;
  endDate: Date | null;
  shift: ReportShift | "todos";
  selectedCalha: string;
  selectedMunicipio: string;
  searchQuery: string;
}

export const CALHAS_AMAZONAS: Record<string, string[]> = {
  "Capital e RMM": [
    "Manaus",
    "Iranduba",
    "Manacapuru",
    "Rio Preto da Eva",
    "Presidente Figueiredo",
    "Careiro",
    "Careiro da Várzea",
    "Autazes",
    "Novo Airão",
  ],
  "Sul do Amazonas": [
    "Humaitá",
    "Apuí",
    "Lábrea",
    "Boca do Acre",
    "Manicoré",
    "Novo Aripuanã",
    "Canutama",
  ],
  "Médio e Baixo Amazonas": [
    "Parintins",
    "Itacoatiara",
    "Borba",
    "Nhamundá",
    "Urucurituba",
  ],
  "Alto Solimões e Triângulo": [
    "Tabatinga",
    "Tefé",
    "Benjamin Constant",
    "São Paulo de Olivença",
    "Santo Antônio do Içá",
  ],
  "Rio Negro e Calhas Ocidentais": [
    "São Gabriel da Cachoeira",
    "Santa Isabel do Rio Negro",
  ],
};

interface Props {
  filters: DashboardFilterState;
  onChange: (updates: Partial<DashboardFilterState>) => void;
  onReset: () => void;
  availableMunicipios: string[];
  isRefreshing?: boolean;
  onRefresh?: () => void;
  onExportXlsx?: () => void;
  onExportPdf?: () => void;
}

export const DashboardFilterBar = memo(function DashboardFilterBar({
  filters,
  onChange,
  onReset,
  availableMunicipios,
  isRefreshing,
  onRefresh,
  onExportXlsx,
  onExportPdf,
}: Props) {
  // Lista ordenada de municípios únicos disponíveis
  const sortedMunicipios = useMemo(() => {
    const set = new Set<string>();
    availableMunicipios.forEach((m) => {
      const c = canonicalMunicipio(m);
      if (c && c !== "—") set.add(c);
    });
    return Array.from(set).sort((a, b) => a.localeCompare(b, "pt-BR"));
  }, [availableMunicipios]);

  // Aplica preset de data
  const applyPreset = (preset: "today" | "7d" | "15d" | "jul2026" | "aug2026" | "all") => {
    // Usamos a data mais recente dos relatórios ou a data final selecionada como âncora
    const anchor = filters.endDate ? new Date(filters.endDate) : new Date(2026, 7, 27);
    switch (preset) {
      case "today":
        onChange({ reportDate: anchor, endDate: anchor });
        break;
      case "7d": {
        const start = new Date(anchor);
        start.setDate(start.getDate() - 6);
        onChange({ reportDate: start, endDate: anchor });
        break;
      }
      case "15d": {
        const start = new Date(anchor);
        start.setDate(start.getDate() - 14);
        onChange({ reportDate: start, endDate: anchor });
        break;
      }
      case "jul2026":
        onChange({
          reportDate: new Date(2026, 6, 1),
          endDate: new Date(2026, 6, 31),
        });
        break;
      case "aug2026":
        onChange({
          reportDate: new Date(2026, 7, 1),
          endDate: new Date(2026, 7, 27),
        });
        break;
      case "all":
        onChange({
          reportDate: new Date(2026, 6, 1),
          endDate: new Date(2026, 7, 27),
        });
        break;
    }
  };

  const toInputDate = (d: Date | null) => {
    if (!d) return "";
    const y = d.getFullYear();
    const m = String(d.getMonth() + 1).padStart(2, "0");
    const day = String(d.getDate()).padStart(2, "0");
    return `${y}-${m}-${day}`;
  };

  const parseInputDate = (val: string) => {
    if (!val) return null;
    const [y, m, d] = val.split("-").map(Number);
    return new Date(y, m - 1, d);
  };

  const hasActiveFilters =
    filters.selectedCalha !== "todas" ||
    filters.selectedMunicipio !== "todos" ||
    filters.searchQuery.trim() !== "" ||
    filters.shift !== "todos";

  return (
    <div className="bg-card border border-border/80 rounded-2xl shadow-sm overflow-hidden p-4 sm:p-5 space-y-4">
      {/* Linha 1: Título do Painel de Filtros + Presets Rápidos + Ações */}
      <div className="flex flex-col lg:flex-row items-start lg:items-center justify-between gap-3 pb-3 border-b border-border/60">
        <div className="flex items-center gap-2">
          <div className="w-8 h-8 rounded-lg bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 flex items-center justify-center">
            <Filter className="w-4 h-4" />
          </div>
          <div>
            <h2 className="text-sm font-bold text-foreground uppercase tracking-wider">
              Painel de Filtros e Seleção Analítica
            </h2>
            <p className="text-xs text-muted-foreground">
              Selecione o intervalo de datas, mês, município ou calha operacional
            </p>
          </div>
        </div>

        {/* Presets Rápidos */}
        <div className="flex flex-wrap items-center gap-1.5 w-full lg:w-auto">
          <span className="text-xs font-semibold text-muted-foreground mr-1 flex items-center gap-1">
            <Sparkles className="w-3.5 h-3.5 text-amber-500" /> Presets:
          </span>
          <Button
            type="button"
            variant="outline"
            size="sm"
            className="h-7 text-xs font-medium px-2.5 rounded-lg hover:bg-emerald-50 hover:text-emerald-700 hover:border-emerald-200"
            onClick={() => applyPreset("today")}
          >
            Hoje
          </Button>
          <Button
            type="button"
            variant="outline"
            size="sm"
            className="h-7 text-xs font-medium px-2.5 rounded-lg hover:bg-emerald-50 hover:text-emerald-700 hover:border-emerald-200"
            onClick={() => applyPreset("7d")}
          >
            Últimos 7 dias
          </Button>
          <Button
            type="button"
            variant="outline"
            size="sm"
            className="h-7 text-xs font-medium px-2.5 rounded-lg hover:bg-emerald-50 hover:text-emerald-700 hover:border-emerald-200"
            onClick={() => applyPreset("15d")}
          >
            Últimos 15 dias
          </Button>
          <Button
            type="button"
            variant="outline"
            size="sm"
            className="h-7 text-xs font-medium px-2.5 rounded-lg hover:bg-emerald-50 hover:text-emerald-700 hover:border-emerald-200"
            onClick={() => applyPreset("jul2026")}
          >
            Julho / 2026
          </Button>
          <Button
            type="button"
            variant="outline"
            size="sm"
            className="h-7 text-xs font-medium px-2.5 rounded-lg hover:bg-emerald-50 hover:text-emerald-700 hover:border-emerald-200"
            onClick={() => applyPreset("aug2026")}
          >
            Agosto / 2026
          </Button>
          <Button
            type="button"
            variant="outline"
            size="sm"
            className="h-7 text-xs font-medium px-2.5 rounded-lg hover:bg-emerald-50 hover:text-emerald-700 hover:border-emerald-200"
            onClick={() => applyPreset("all")}
          >
            Geral Completo
          </Button>
        </div>
      </div>

      {/* Linha 2: Controles Multidimensionais */}
      <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3">
        {/* De (Data Início) */}
        <div className="space-y-1.5">
          <Label className="text-xs font-semibold text-muted-foreground flex items-center gap-1">
            <CalendarIcon className="w-3.5 h-3.5 text-emerald-600" /> Data Inicial (De)
          </Label>
          <Input
            type="date"
            className="h-9 text-xs"
            value={toInputDate(filters.reportDate)}
            onChange={(e) => {
              const d = parseInputDate(e.target.value);
              onChange({ reportDate: d });
            }}
          />
        </div>

        {/* Até (Data Fim) */}
        <div className="space-y-1.5">
          <Label className="text-xs font-semibold text-muted-foreground flex items-center gap-1">
            <CalendarIcon className="w-3.5 h-3.5 text-emerald-600" /> Data Final (Até)
          </Label>
          <Input
            type="date"
            className="h-9 text-xs"
            value={toInputDate(filters.endDate)}
            onChange={(e) => {
              const d = parseInputDate(e.target.value);
              onChange({ endDate: d });
            }}
          />
        </div>

        {/* Mês Rápido */}
        <div className="space-y-1.5">
          <Label className="text-xs font-semibold text-muted-foreground flex items-center gap-1">
            <CalendarIcon className="w-3.5 h-3.5 text-emerald-600" /> Seletor de Mês
          </Label>
          <Select
            onValueChange={(v) => {
              if (v === "jul") applyPreset("jul2026");
              else if (v === "aug") applyPreset("aug2026");
              else if (v === "all") applyPreset("all");
            }}
          >
            <SelectTrigger className="h-9 text-xs">
              <SelectValue placeholder="Escolher Mês" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="jul">Julho / 2026 (Mês Inteiro)</SelectItem>
              <SelectItem value="aug">Agosto / 2026 (Mês Inteiro)</SelectItem>
              <SelectItem value="all">Todo o Período (Consolidado)</SelectItem>
            </SelectContent>
          </Select>
        </div>

        {/* Turno */}
        <div className="space-y-1.5">
          <Label className="text-xs font-semibold text-muted-foreground flex items-center gap-1">
            <Clock className="w-3.5 h-3.5 text-emerald-600" /> Turno Operacional
          </Label>
          <Select
            value={filters.shift}
            onValueChange={(val: any) => onChange({ shift: val })}
          >
            <SelectTrigger className="h-9 text-xs">
              <SelectValue placeholder="Selecione o turno" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="todos">Todos os Turnos (Consolidado)</SelectItem>
              <SelectItem value="noturno">Noturno (18h30 - 07h00)</SelectItem>
              <SelectItem value="parcial">Parcial / Diurno</SelectItem>
            </SelectContent>
          </Select>
        </div>

        {/* Calha / Região */}
        <div className="space-y-1.5">
          <Label className="text-xs font-semibold text-muted-foreground flex items-center gap-1">
            <Layers className="w-3.5 h-3.5 text-emerald-600" /> Calha / Região
          </Label>
          <Select
            value={filters.selectedCalha}
            onValueChange={(val) =>
              onChange({
                selectedCalha: val,
                // Se escolheu uma calha, reseta o município para evitar conflitos
                selectedMunicipio: "todos",
              })
            }
          >
            <SelectTrigger className="h-9 text-xs">
              <SelectValue placeholder="Todas as calhas" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="todas">Todas as Calhas (Amazonas Inteiro)</SelectItem>
              {Object.keys(CALHAS_AMAZONAS).map((c) => (
                <SelectItem key={c} value={c}>
                  {c}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        {/* Município Específico */}
        <div className="space-y-1.5">
          <Label className="text-xs font-semibold text-muted-foreground flex items-center gap-1">
            <MapPin className="w-3.5 h-3.5 text-emerald-600" /> Município
          </Label>
          <Select
            value={filters.selectedMunicipio}
            onValueChange={(val) => onChange({ selectedMunicipio: val })}
          >
            <SelectTrigger className="h-9 text-xs">
              <SelectValue placeholder="Todos os municípios" />
            </SelectTrigger>
            <SelectContent className="max-h-60">
              <SelectItem value="todos">Todos os Municípios</SelectItem>
              {sortedMunicipios.map((m) => (
                <SelectItem key={m} value={m}>
                  {m}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>

      {/* Linha 3: Busca Rápida + Ações de Exportação e Atualização */}
      <div className="flex flex-col sm:flex-row items-center justify-between gap-3 pt-2">
        {/* Barra de Busca rápida */}
        <div className="relative w-full sm:w-80">
          <Search className="w-4 h-4 absolute left-3 top-2.5 text-muted-foreground" />
          <Input
            type="text"
            placeholder="Filtrar por nome de município..."
            className="pl-9 h-9 text-xs"
            value={filters.searchQuery}
            onChange={(e) => onChange({ searchQuery: e.target.value })}
          />
          {filters.searchQuery && (
            <button
              onClick={() => onChange({ searchQuery: "" })}
              className="absolute right-2.5 top-2.5 text-muted-foreground hover:text-foreground"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          )}
        </div>

        {/* Ações / Botões */}
        <div className="flex flex-wrap items-center gap-2 w-full sm:w-auto justify-end">
          {hasActiveFilters && (
            <Button
              type="button"
              variant="ghost"
              size="sm"
              className="h-9 text-xs text-muted-foreground hover:text-rose-600 flex items-center gap-1"
              onClick={onReset}
            >
              <RotateCcw className="w-3.5 h-3.5" /> Limpar Filtros
            </Button>
          )}

          {onRefresh && (
            <Button
              type="button"
              variant="outline"
              size="sm"
              className="h-9 text-xs flex items-center gap-1.5"
              onClick={onRefresh}
              disabled={isRefreshing}
            >
              <RefreshCw className={`w-3.5 h-3.5 ${isRefreshing ? "animate-spin" : ""}`} />
              Atualizar
            </Button>
          )}

          {onExportXlsx && (
            <Button
              type="button"
              variant="outline"
              size="sm"
              className="h-9 text-xs flex items-center gap-1.5 text-emerald-700 dark:text-emerald-400 border-emerald-300 dark:border-emerald-800 hover:bg-emerald-50 dark:hover:bg-emerald-950/40"
              onClick={onExportXlsx}
            >
              <FileSpreadsheet className="w-3.5 h-3.5 text-emerald-600" />
              Excel
            </Button>
          )}

          {onExportPdf && (
            <Button
              type="button"
              variant="outline"
              size="sm"
              className="h-9 text-xs flex items-center gap-1.5 text-rose-700 dark:text-rose-400 border-rose-300 dark:border-rose-800 hover:bg-rose-50 dark:hover:bg-rose-950/40"
              onClick={onExportPdf}
            >
              <FileText className="w-3.5 h-3.5 text-rose-600" />
              Relatório PDF
            </Button>
          )}
        </div>
      </div>
    </div>
  );
});
