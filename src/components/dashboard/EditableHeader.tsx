import { memo, useEffect, useState, type ReactNode } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { FileText, CalendarClock, Shield } from "lucide-react";
import type { SheetsHeader } from "@/lib/sheets.types";
import { useAutosave } from "@/hooks/use-autosave";
import { SaveStatusBadge } from "./SaveStatusBadge";

interface Props {
  header: SheetsHeader;
  editable: boolean;
  onSave: (h: SheetsHeader) => Promise<void>;
}

interface FieldConfig {
  key: keyof SheetsHeader;
  label: string;
  placeholder: string;
  full?: boolean;
}

interface FieldGroup {
  id: string;
  title: string;
  subtitle: string;
  icon: ReactNode;
  fields: FieldConfig[];
}

const GROUPS: FieldGroup[] = [
  {
    id: "identificacao",
    title: "Identificação",
    subtitle: "Dados gerais do documento",
    icon: <FileText className="w-4 h-4" aria-hidden="true" />,
    fields: [
      { key: "titulo", label: "Título", placeholder: "Relatório de Ocorrências", full: true },
      { key: "periodo", label: "Período Operacional", placeholder: "Ex.: 06/JUL/2026 – 8H00" },
      {
        key: "proximoPeriodo",
        label: "Próximo Período Operacional",
        placeholder: "Ex.: 07/JUL/2026 – 8H00",
      },
    ],
  },
  {
    id: "cronograma",
    title: "Cronograma",
    subtitle: "Reuniões e coordenação",
    icon: <CalendarClock className="w-4 h-4" aria-hidden="true" />,
    fields: [
      {
        key: "reuniaoPlanejamento",
        label: "Reunião de Planejamento",
        placeholder: "Ex.: 06/JUL/2026 – 8H15",
      },
      {
        key: "reuniaoBriefing",
        label: "Reunião de Briefing",
        placeholder: "Ex.: 06/JUL/2026 – 8H30",
      },
      {
        key: "coordSituacao",
        label: "Coordenador da Sala de Situação",
        placeholder: "Ex.: TC QOBM FERREIRA",
      },
      {
        key: "coordenador",
        label: "Coordenador da Operação",
        placeholder: "Coordenador Amazonas + Verde",
      },
    ],
  },
  {
    id: "comando",
    title: "Cadeia de Comando",
    subtitle: "Oficiais responsáveis",
    icon: <Shield className="w-4 h-4" aria-hidden="true" />,
    fields: [
      { key: "comandante", label: "Comandante do Incidente", placeholder: "Ex.: CEL QOBM BORGES" },
      {
        key: "chefeCapital",
        label: "Chefe de Operações Capital",
        placeholder: "Ex.: CEL QOBM MENEZES",
      },
      {
        key: "chefeInterior",
        label: "Chefe de Operações Interior",
        placeholder: "Ex.: CEL QOBM MONTEIRO",
      },
      {
        key: "subcomandante",
        label: "Subcomandante-Geral",
        placeholder: "Subcomandante-Geral do CBMAM",
      },
    ],
  },
];

export const EditableHeader = memo(function EditableHeader({ header, editable, onSave }: Props) {
  const [local, setLocal] = useState<SheetsHeader>(header ?? {});
  const { status, errorMessage, scheduleSave, isDirtyRef } = useAutosave<SheetsHeader>({
    onSave,
  });

  useEffect(() => {
    if (!isDirtyRef.current) setLocal(header ?? {});
  }, [header, isDirtyRef]);

  const updateField = (key: keyof SheetsHeader, value: string) => {
    const next = { ...local, [key]: value };
    setLocal(next);
    scheduleSave(next);
  };

  return (
    <Card className="border-slate-200/80 overflow-hidden animate-fade-in-soft">
      <CardHeader className="pb-3 flex-row items-center justify-between space-y-0 gap-2 bg-gradient-brand-soft border-b border-slate-200/60">
        <div className="min-w-0">
          <CardTitle className="text-sm sm:text-base font-semibold tracking-tight">
            Informações do relatório
          </CardTitle>
          <p className="text-[11px] text-slate-500 mt-0.5">
            Documento oficial — os campos abaixo compõem o cabeçalho do relatório exportado.
          </p>
        </div>
        {editable && (
          <SaveStatusBadge status={status} errorMessage={errorMessage} errorMaxWidth="220px" />
        )}
      </CardHeader>
      <CardContent className="p-4 sm:p-5 space-y-5">
        {GROUPS.map((group) => (
          <fieldset key={group.id} className="space-y-3">
            <legend className="flex items-center gap-2 mb-1">
              <span className="grid place-items-center w-7 h-7 rounded-lg bg-emerald-50 text-emerald-700 ring-1 ring-emerald-100">
                {group.icon}
              </span>
              <span className="font-display text-sm font-semibold text-slate-800">
                {group.title}
              </span>
              <span className="text-[11px] text-slate-500 hidden sm:inline">
                · {group.subtitle}
              </span>
            </legend>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              {group.fields.map((f) => (
                <div key={f.key} className={f.full ? "sm:col-span-2" : ""}>
                  <HeaderField
                    config={f}
                    value={(local[f.key] as string) ?? ""}
                    editable={editable}
                    onChange={(v) => updateField(f.key, v)}
                  />
                </div>
              ))}
            </div>
          </fieldset>
        ))}
      </CardContent>
    </Card>
  );
});

function HeaderField({
  config,
  value,
  editable,
  onChange,
}: {
  config: FieldConfig;
  value: string;
  editable: boolean;
  onChange: (v: string) => void;
}) {
  return (
    <div className="space-y-1">
      <Label className="text-[11px] uppercase tracking-wide font-semibold text-slate-500">
        {config.label}
      </Label>
      {editable ? (
        <Input
          value={value}
          placeholder={config.placeholder}
          onChange={(e) => onChange(e.target.value)}
          className="h-10 transition-colors focus-visible:ring-emerald-500/40"
        />
      ) : (
        <div className="h-10 flex items-center px-3 rounded-md border border-slate-200 bg-slate-50/70 text-sm text-slate-700">
          {value || <span className="text-slate-400">—</span>}
        </div>
      )}
    </div>
  );
}
