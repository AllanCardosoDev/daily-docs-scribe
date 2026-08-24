import { memo, useMemo, type ReactNode } from "react";
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  PieChart,
  Pie,
  Cell,
  Legend,
} from "recharts";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Flame, ShieldAlert, Users, Activity } from "lucide-react";
import type { SheetsData } from "@/lib/sheets.types";
import { NF } from "@/lib/formatters";
import { cn } from "@/lib/utils";
import type { ComparisonResult } from "@/lib/comparison";
import { TrendingUp, TrendingDown, Minus } from "lucide-react";

interface Props {
  data: SheetsData;
  comparisonData?: ComparisonResult;
  isComparisonLoading?: boolean;
}

const COLORS = ["#10b981", "#3b82f6", "#f59e0b", "#ef4444", "#8b5cf6", "#ec4899", "#06b6d4"];

export const DashboardAnalytics = memo(function DashboardAnalytics({ 
  data, 
  comparisonData,
  isComparisonLoading 
}: Props) {
  const incendiosData = useMemo(() => {
    return (data.incendios_diario ?? [])
      .map((r) => ({
        name: r.mun,
        urbano: Number(r.urb) || 0,
        florestal: Number(r.flor) || 0,
        total: (Number(r.urb) || 0) + (Number(r.flor) || 0),
      }))
      .filter((r) => r.total > 0)
      .sort((a, b) => b.total - a.total)
      .slice(0, 8);
  }, [data.incendios_diario]);

  const ocorrenciasDist = useMemo(() => {
    const list = data.outras_diarias ?? [];
    const totals = {
      salvamento: list.reduce((acc, r) => acc + (Number(r.salvamento) || 0), 0),
      acidentes: list.reduce((acc, acc2) => acc + (Number(acc2.acidentes) || 0), 0),
      aph: list.reduce((acc, r) => acc + (Number(r.aph) || 0), 0),
      prevencao: list.reduce((acc, r) => acc + (Number(r.prevencao) || 0), 0),
      servicos: list.reduce((acc, r) => acc + (Number(r.servicos) || 0), 0),
    };

    return [
      { name: "Salvamento", value: totals.salvamento },
      { name: "Acidentes", value: totals.acidentes },
      { name: "APH", value: totals.aph },
      { name: "Prevenção", value: totals.prevencao },
      { name: "Serviços", value: totals.servicos },
    ].filter((d) => d.value > 0);
  }, [data.outras_diarias]);

  const efetivoTotal = useMemo(() => {
    const list = data.efetivo ?? [];
    return [
      { name: "S. Ordinário", value: list.reduce((acc, r) => acc + (Number(r.ord) || 0), 0) },
      { name: "SEG", value: list.reduce((acc, r) => acc + (Number(r.seg) || 0), 0) },
      { name: "Brigadistas", value: list.reduce((acc, r) => acc + (Number(r.brig) || 0), 0) },
    ].filter((d) => d.value > 0);
  }, [data.efetivo]);

  const hasData = incendiosData.length > 0 || ocorrenciasDist.length > 0;

  if (!hasData) {
    return (
      <Card className="border-dashed border-2 bg-muted/20">
        <CardContent className="flex flex-col items-center justify-center py-12 text-center space-y-3">
          <Activity className="w-12 h-12 text-muted-foreground/50" />
          <div className="space-y-1">
            <h3 className="font-semibold text-lg">Sem dados analíticos</h3>
            <p className="text-sm text-muted-foreground">
              Não há ocorrências registradas no período selecionado para gerar visualizações.
            </p>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <KpiCard 
          label="Incêndios Totais" 
          value={incendiosData.reduce((acc, r) => acc + r.total, 0)} 
          subValue="Registrados no período"
          icon={<Flame className="w-5 h-5" />}
          color="bg-red-500"
        />
        <KpiCard 
          label="Ocorrências Diversas" 
          value={ocorrenciasDist.reduce((acc, r) => acc + r.value, 0)} 
          subValue="Salvamento, APH, etc."
          icon={<ShieldAlert className="w-5 h-5" />}
          color="bg-blue-500"
        />
        <KpiCard 
          label="Efetivo Total" 
          value={efetivoTotal.reduce((acc, r) => acc + r.value, 0)} 
          subValue="Militares e brigadistas"
          icon={<Users className="w-5 h-5" />}
          color="bg-emerald-500"
        />
        <KpiCard 
          label="Área Afetada" 
          value={data.incendios_acumulado?.reduce((acc, r) => acc + (Number(r.area) || 0), 0) ?? 0} 
          subValue="Metros quadrados estimados"
          icon={<Activity className="w-5 h-5" />}
          color="bg-amber-500"
          isArea
        />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <Card className="shadow-elevated border-border/50 overflow-hidden">
          <CardHeader className="pb-2 border-b bg-muted/30">
            <div className="flex items-center gap-2">
              <Flame className="w-5 h-5 text-red-500" />
              <CardTitle className="text-lg">Distribuição de Incêndios</CardTitle>
            </div>
            <CardDescription>Top municípios com maior incidência (Urbano vs Florestal)</CardDescription>
          </CardHeader>
          <CardContent className="pt-6">
            <div className="h-[300px] w-full">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={incendiosData} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="rgba(0,0,0,0.05)" />
                  <XAxis 
                    dataKey="name" 
                    fontSize={10} 
                    tickLine={false} 
                    axisLine={false}
                    interval={0}
                    tick={{ fill: 'currentColor', opacity: 0.7 }}
                  />
                  <YAxis fontSize={10} tickLine={false} axisLine={false} tick={{ fill: 'currentColor', opacity: 0.7 }} />
                  <Tooltip 
                    cursor={{ fill: 'rgba(0,0,0,0.02)' }}
                    contentStyle={{ 
                      borderRadius: '8px', 
                      border: '1px solid #e2e8f0',
                      boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)'
                    }}
                  />
                  <Legend iconType="circle" wrapperStyle={{ fontSize: '10px', paddingTop: '10px' }} />
                  <Bar dataKey="urbano" name="Urbano" fill="#ef4444" radius={[4, 4, 0, 0]} barSize={20} />
                  <Bar dataKey="florestal" name="Florestal" fill="#f97316" radius={[4, 4, 0, 0]} barSize={20} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </CardContent>
        </Card>

        <Card className="shadow-elevated border-border/50 overflow-hidden">
          <CardHeader className="pb-2 border-b bg-muted/30">
            <div className="flex items-center gap-2">
              <ShieldAlert className="w-5 h-5 text-blue-500" />
              <CardTitle className="text-lg">Tipologia de Ocorrências</CardTitle>
            </div>
            <CardDescription>Percentual por categoria de atendimento</CardDescription>
          </CardHeader>
          <CardContent className="pt-6">
            <div className="h-[300px] w-full">
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie
                    data={ocorrenciasDist}
                    cx="50%"
                    cy="50%"
                    innerRadius={60}
                    outerRadius={80}
                    paddingAngle={5}
                    dataKey="value"
                    label={({ name, percent }) => `${name} ${(percent * 100).toFixed(0)}%`}
                    labelLine={false}
                  >
                    {ocorrenciasDist.map((entry, index) => (
                      <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                    ))}
                  </Pie>
                  <Tooltip 
                    contentStyle={{ 
                      borderRadius: '8px', 
                      border: '1px solid #e2e8f0'
                    }}
                  />
                  <Legend verticalAlign="bottom" height={36} iconType="circle" wrapperStyle={{ fontSize: '10px' }} />
                </PieChart>
              </ResponsiveContainer>
            </div>
          </CardContent>
        </Card>

        <Card className="shadow-elevated border-border/50 overflow-hidden lg:col-span-2">
          <CardHeader className="pb-2 border-b bg-muted/30">
            <div className="flex items-center gap-2">
              <Users className="w-5 h-5 text-emerald-600" />
              <CardTitle className="text-lg">Mobilização de Efetivo</CardTitle>
            </div>
            <CardDescription>Comparativo de força de trabalho empenhada</CardDescription>
          </CardHeader>
          <CardContent className="pt-6">
            <div className="h-[250px] w-full">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart layout="vertical" data={efetivoTotal} margin={{ top: 5, right: 30, left: 40, bottom: 5 }}>
                  <CartesianGrid strokeDasharray="3 3" horizontal={false} stroke="rgba(0,0,0,0.05)" />
                  <XAxis type="number" hide />
                  <YAxis 
                    dataKey="name" 
                    type="category" 
                    fontSize={11} 
                    tickLine={false} 
                    axisLine={false}
                    width={90}
                  />
                  <Tooltip 
                    cursor={{ fill: 'rgba(0,0,0,0.02)' }}
                    contentStyle={{ borderRadius: '8px' }}
                  />
                  <Bar dataKey="value" name="Militares/Brigadistas" fill="#10b981" radius={[0, 4, 4, 0]} barSize={30} label={{ position: 'right', fontSize: 11, fontWeight: 'bold' }} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
});

function KpiCard({ 
  label, 
  value, 
  subValue, 
  icon, 
  color, 
  isArea,
  delta,
  isLoading
}: { 
  label: string; 
  value: number; 
  subValue: string; 
  icon: ReactNode; 
  color: string;
  isArea?: boolean;
  delta?: { absolute: number; percentage: number; trend: "up" | "down" | "neutral" };
  isLoading?: boolean;
}) {
  return (
    <Card className="shadow-sm border-border/50 relative overflow-hidden group">
      <div className={`absolute top-0 right-0 w-24 h-24 -mr-8 -mt-8 rounded-full ${color} opacity-5 group-hover:opacity-10 transition-opacity`} />
      <CardContent className="p-5">
        <div className="flex items-center gap-3 mb-3">
          <div className={`p-2 rounded-lg ${color.replace('bg-', 'bg-')}/10 ${color.replace('bg-', 'text-')}`}>
            {icon}
          </div>
          <span className="text-xs font-bold uppercase tracking-wider text-muted-foreground">{label}</span>
        </div>
        <div className="space-y-1">
          <div className="flex items-end gap-2">
            <div className="text-2xl font-bold tracking-tight">
              {isArea ? NF.format(value) + ' m²' : NF.format(value)}
            </div>
            {isLoading ? (
              <div className="h-4 w-4 animate-spin rounded-full border-2 border-primary border-t-transparent mb-1" />
            ) : delta && delta.trend !== 'neutral' ? (
              <div className={cn(
                "flex items-center text-[10px] font-bold mb-1 px-1.5 py-0.5 rounded-full",
                delta.trend === 'up' ? "bg-red-100 text-red-700" : "bg-emerald-100 text-emerald-700"
              )}>
                {delta.trend === 'up' ? <TrendingUp className="w-3 h-3 mr-0.5" /> : <TrendingDown className="w-3 h-3 mr-0.5" />}
                {Math.abs(delta.percentage).toFixed(1)}%
              </div>
            ) : null}
          </div>
          <div className="text-[10px] text-muted-foreground font-medium">{subValue}</div>
        </div>
      </CardContent>
    </Card>
  );
}
