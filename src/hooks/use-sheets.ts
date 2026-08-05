import { useMemo, useRef } from "react";
import { useQuery, useQueryClient, useMutation, keepPreviousData } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";
import {
  getSheetsData,
  getAppConfig,
  saveSheetsData,
  syncFromSheets as syncFromSheetsFn,
  CONFLICT_ERROR,
} from "@/lib/sheets.functions";
import { queryKeys } from "@/lib/query-keys";
import type { SheetsData, SheetsHeader } from "@/lib/sheets.types";
import type { EditableSection } from "@/lib/dashboard-columns";

export type SectionSaver = (rows: Array<Record<string, any>>) => Promise<void>;

type SavableListKey = EditableSection | "occurrences";

const SAVABLE_LIST_KEYS: SavableListKey[] = [
  "efetivo",
  "recursos",
  "incendios_diario",
  "incendios_acumulado",
  "outras_diarias",
  "occurrences",
];

export type SectionSavers = Record<SavableListKey, SectionSaver> & {
  header: (h: SheetsHeader) => Promise<void>;
};

export function useSheetsDashboard(reportDate?: Date | null) {
  const qc = useQueryClient();
  const getCfg = useServerFn(getAppConfig);
  const getData = useServerFn(getSheetsData);
  const saveFn = useServerFn(saveSheetsData);
  const syncFn = useServerFn(syncFromSheetsFn);

  // Latest known server version — used for optimistic locking on saves.
  const versionRef = useRef<number>(0);

  const configQuery = useQuery({
    queryKey: queryKeys.appConfig,
    queryFn: () => getCfg(),
    staleTime: 5 * 60_000,
  });

  const dateIso = reportDate?.toISOString().split("T")[0];
  const dataQuery = useQuery({
    queryKey: [...queryKeys.sheetsData, dateIso],
    queryFn: async () => {
      const res = await getData({ data: { reportDate: dateIso } });
      versionRef.current = res.version ?? 0;
      return res;
    },
    staleTime: 30_000,
    placeholderData: keepPreviousData,
  });

  const saveMutation = useMutation({
    mutationFn: async (patch: Partial<SheetsData>) => {
      return saveFn({
        data: {
          reportDate: dateIso,
          expectedVersion: versionRef.current,
          patch: patch as any,
        },
      });
    },
    onSuccess: (res) => {
      if (res?.version) versionRef.current = res.version;
      qc.invalidateQueries({ queryKey: queryKeys.sheetsData });
    },
    onError: (err: unknown) => {
      const msg = err instanceof Error ? err.message : String(err);
      if (msg.includes(CONFLICT_ERROR)) {
        toast.error("Conflito de edição detectado", {
          description:
            "Outro editor atualizou o relatório enquanto você editava. Atualize a página para ver a versão mais recente antes de continuar.",
          action: {
            label: "Atualizar agora",
            onClick: () => qc.invalidateQueries({ queryKey: queryKeys.sheetsData }),
          },
          duration: 10_000,
        });
      } else {
        toast.error("Falha ao salvar", { description: msg });
      }
    },
  });

  const canEdit = !!configQuery.data?.isEditor;

  const savers: SectionSavers = useMemo(() => {
    const assertEditable = () => {
      if (!canEdit) throw new Error("Sem permissão para editar.");
    };
    const listSaver =
      (key: SavableListKey): SectionSaver =>
      async (rows) => {
        assertEditable();
        await saveMutation.mutateAsync({ [key]: rows } as Partial<SheetsData>);
      };
    const listSavers = Object.fromEntries(
      SAVABLE_LIST_KEYS.map((k) => [k, listSaver(k)]),
    ) as Record<SavableListKey, SectionSaver>;

    return {
      ...listSavers,
      header: async (h) => {
        assertEditable();
        await saveMutation.mutateAsync({ header: h });
      },
    };
  }, [canEdit, saveMutation]);

  const refresh = () => qc.invalidateQueries({ queryKey: queryKeys.sheetsData });

  const syncMutation = useMutation({
    mutationFn: async () => syncFn(),
    onSuccess: (res: any) => {
      const total = Object.values(res?.counts ?? {}).reduce(
        (a: number, b: any) => a + Number(b ?? 0),
        0,
      );
      if (res?.version) versionRef.current = res.version;
      qc.invalidateQueries({ queryKey: queryKeys.sheetsData });
      toast.success("Dados sincronizados com o Google Sheets", {
        description: `${total} linha(s) importada(s) da planilha.`,
      });
    },
    onError: (err: unknown) => {
      toast.error("Falha na sincronização", {
        description: err instanceof Error ? err.message : String(err),
      });
    },
  });

  return {
    configQuery,
    dataQuery,
    savers,
    canEdit,
    refresh,
    syncFromSheets: () => syncMutation.mutate(),
    isSyncing: syncMutation.isPending,
  };
}
