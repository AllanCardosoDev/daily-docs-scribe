import { memo, type ReactNode } from "react";
import { DataTable } from "@/components/dashboard/DataTable";
import { DASHBOARD_COLUMNS, OCCURRENCES_PREVIEW_LIMIT } from "@/lib/dashboard-columns";
import type { SheetsData } from "@/lib/sheets.types";
import type { SectionSavers } from "@/hooks/use-sheets";
import { manausFirstSheets } from "@/lib/municipio-order";
import { Flame, Users, ClipboardList } from "lucide-react";

interface Props {
  data: SheetsData;
  canEdit: boolean;
  savers: SectionSavers;
}

const NF = new Intl.NumberFormat("pt-BR");

function SectionHeader({
  index,
  title,
  subtitle,
  icon,
}: {
  index: string;
  title: string;
  subtitle: string;
  icon: ReactNode;
}) {
  return (
    <div className="flex items-center gap-3 pt-2">
      <span className="grid shrink-0 place-items-center w-9 h-9 rounded-xl bg-gradient-brand text-white shadow-elevated ring-1 ring-inset ring-white/20">
        {icon}
      </span>
      <div className="min-w-0">
        <div className="text-[10px] uppercase tracking-[0.16em] font-semibold text-primary/80">
          Seção {index}
        </div>
        <div className="flex items-baseline gap-2 min-w-0">
          <h3 className="font-display text-base sm:text-lg font-bold tracking-tight text-foreground truncate">
            {title}
          </h3>
          <span className="text-xs text-muted-foreground truncate hidden sm:inline">
            {subtitle}
          </span>
        </div>
      </div>
      <span
        aria-hidden="true"
        className="hidden md:block h-px flex-1 bg-linear-to-r from-border to-transparent"
      />
    </div>
  );
}

export const DashboardSections = memo(function DashboardSections({
  data: rawData,
  canEdit,
  savers,
}: Props) {
  // Manaus (capital) sempre na primeira linha de todas as tabelas.
  const data = manausFirstSheets(rawData);
  const occurrencesPreview = data.occurrences.slice(0, OCCURRENCES_PREVIEW_LIMIT);

  return (
    <div className="space-y-6 sm:space-y-8">
      <section className="space-y-3">
        <SectionHeader
          index="01"
          title="Recursos empregados"
          subtitle="Meios materiais em campo"
          icon={<Users className="w-4 h-4" aria-hidden="true" />}
        />
        <DataTable
          title="Recursos empregados"
          editable={canEdit}
          onRowsChange={savers.recursos}
          columns={DASHBOARD_COLUMNS.recursos}
          rows={data.recursos}
        />
      </section>

      <section className="space-y-3">
        <SectionHeader
          index="02"
          title="Efetivo por município"
          subtitle="Distribuição de militares e brigadistas"
          icon={<Users className="w-4 h-4" aria-hidden="true" />}
        />
        <DataTable
          title="Efetivo por município"
          editable={canEdit}
          onRowsChange={savers.efetivo}
          columns={DASHBOARD_COLUMNS.efetivo}
          rows={data.efetivo}
          emptyMessage="Buscando dados de Efetivo (Itapiranga)..."
        />
      </section>

      <section className="space-y-3">
        <SectionHeader
          index="03"
          title="Ocorrências diárias"
          subtitle="Incêndios e atendimentos diversos"
          icon={<Flame className="w-4 h-4" aria-hidden="true" />}
        />
        <div className="flex flex-col gap-6">
          <DataTable
            title="Incêndios do dia"
            editable={canEdit}
            onRowsChange={savers.incendios_diario}
            columns={DASHBOARD_COLUMNS.incendios_diario}
            rows={data.incendios_diario}
          />
          <DataTable
            title="Outras ocorrências"
            editable={canEdit}
            onRowsChange={savers.outras_diarias}
            columns={DASHBOARD_COLUMNS.outras_diarias}
            rows={data.outras_diarias}
          />
        </div>
      </section>

      <section className="space-y-3">
        <SectionHeader
          index="04"
          title="Ocorrências detalhadas"
          subtitle={`${NF.format(data.occurrences.length)} registro(s)`}
          icon={<ClipboardList className="w-4 h-4" aria-hidden="true" />}
        />
        <DataTable
          title="Últimas ocorrências"
          editable={canEdit}
          onRowsChange={savers.occurrences}
          columns={DASHBOARD_COLUMNS.occurrences}
          rows={occurrencesPreview}
          emptyMessage="Sem ocorrências registradas."
        />
        {data.occurrences.length > OCCURRENCES_PREVIEW_LIMIT && (
          <p className="text-xs text-muted-foreground text-center">
            Mostrando {OCCURRENCES_PREVIEW_LIMIT} de {NF.format(data.occurrences.length)}{" "}
            ocorrências.
          </p>
        )}
      </section>
    </div>
  );
});
