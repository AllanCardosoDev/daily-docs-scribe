import { memo, useMemo } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { TrendingUp } from "lucide-react";
import type { SheetsData } from "@/lib/sheets.types";
import { computeKpis, type Kpi } from "@/lib/kpis";

export const KpiCards = memo(function KpiCards({ data }: { data: SheetsData }) {
  const items = useMemo(() => computeKpis(data), [data]);

  return (
    <div className="grid grid-cols-1 xs:grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
      {items.map((kpi, i) => (
        <KpiCard key={kpi.label} kpi={kpi} delayMs={i * 60} />
      ))}
    </div>
  );
});

function KpiCard({ kpi, delayMs }: { kpi: Kpi; delayMs: number }) {
  const { Icon } = kpi;
  return (
    <Card
      className="group relative overflow-hidden card-interactive animate-fade-in-up border-border bg-card"
      style={{ animationDelay: `${delayMs}ms` }}
    >
      <div
        aria-hidden="true"
        className="absolute inset-x-0 top-0 h-1"
        style={{ backgroundImage: kpi.accent }}
      />
      <div
        aria-hidden="true"
        className="absolute -right-6 -bottom-6 w-24 h-24 rounded-full opacity-[0.06] transition-opacity group-hover:opacity-[0.1]"
        style={{ backgroundImage: kpi.accent }}
      />
      <CardContent className="relative p-4 sm:p-5">
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <p className="text-[10px] sm:text-[11px] uppercase tracking-[0.14em] font-semibold text-muted-foreground truncate">
              {kpi.label}
            </p>
            <p className="mt-2 font-display text-2xl sm:text-3xl font-bold tabular-nums tracking-tight text-foreground truncate">
              {kpi.value}
            </p>
            <p className="mt-1 text-[11px] text-muted-foreground flex items-center gap-1 truncate">
              <TrendingUp className="w-3 h-3 text-muted-foreground/70" aria-hidden="true" />
              <span className="truncate">{kpi.hint}</span>
            </p>
          </div>
          <div
            className={`shrink-0 w-11 h-11 rounded-xl flex items-center justify-center ring-4 ${kpi.iconClass} ${kpi.ring}`}
            aria-hidden="true"
          >
            <Icon className="w-5 h-5" />
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
