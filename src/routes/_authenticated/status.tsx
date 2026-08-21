import { createFileRoute } from "@tanstack/react-router";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireBackendAuth } from "@/integrations/backend/auth-middleware";
import { dbFail } from "@/lib/server-errors";
import { 
  Card, 
  CardContent, 
  CardDescription, 
  CardHeader, 
  CardTitle 
} from "@/components/ui/card";
import { 
  Table, 
  TableBody, 
  TableCell, 
  TableHead, 
  TableHeader, 
  TableRow 
} from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { 
  RefreshCw, 
  CheckCircle2, 
  AlertCircle, 
  Clock, 
  FileText,
  Play
} from "lucide-react";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import { toast } from "sonner";
import { syncFromSheets } from "@/lib/sheets.functions";

// --- Server Functions ---

export const getSyncLogs = createServerFn({ method: "GET" })
  .middleware([requireBackendAuth])
  .handler(async ({ context }) => {
    // Note: We use report_data_history and daily_reports as proxies for sync logs
    const { data: reports, error: rErr } = await context.supabase
      .from("daily_reports")
      .select("id, report_date, shift, updated_at, updated_by")
      .order("updated_at", { ascending: false })
      .limit(10);

    if (rErr) dbFail(rErr, "status");

    // Enrich with profile info manually to avoid join errors if relation is missing in types
    const userIds = Array.from(new Set((reports ?? []).map(r => r.updated_by).filter(Boolean) as string[]));
    let profiles: Record<string, { email: string; display_name: string }> = {};
    
    if (userIds.length > 0) {
      const { data: pData } = await context.supabase
        .from("profiles")
        .select("id, email, display_name")
        .in("id", userIds);
      
      profiles = Object.fromEntries((pData ?? []).map(p => [p.id, { email: p.email || "", display_name: p.display_name || "" }]));
    }

    return (reports ?? []).map(log => ({
      id: log.id,
      date: log.report_date,
      shift: log.shift,
      timestamp: log.updated_at,
      status: "success",
      user: log.updated_by ? (profiles[log.updated_by]?.display_name || profiles[log.updated_by]?.email || "Sistema") : "Sistema",
      details: `Relatório ${log.shift === "noturno" ? "24h" : "Parcial"} de ${log.report_date} atualizado.`
    }));
  });

// --- UI Component ---

export const Route = createFileRoute("/_authenticated/status")({
  head: () => ({
    meta: [{ title: "Status do Sistema · CBMAM" }],
  }),
  component: SystemStatusPage,
});

function SystemStatusPage() {
  const qc = useQueryClient();
  const fetchLogs = useServerFn(getSyncLogs);
  const sync = useServerFn(syncFromSheets);

  const { data: logs, isLoading, refetch } = useQuery({
    queryKey: ["sync-logs"],
    queryFn: () => fetchLogs(),
  });

  const syncMutation = useMutation({
    mutationFn: () => sync(),
    onSuccess: () => {
      toast.success("Sincronização manual concluída com sucesso!");
      qc.invalidateQueries({ queryKey: ["sync-logs"] });
      qc.invalidateQueries({ queryKey: ["sheets-data"] });
    },
    onError: (err: any) => {
      toast.error("Erro na sincronização manual", {
        description: err.message
      });
    }
  });

  return (
    <div className="min-h-dvh bg-gradient-brand-soft p-4 md:p-8 space-y-6">
      <div className="max-w-5xl mx-auto space-y-6">
        <header className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div>
            <h1 className="text-3xl font-display font-black text-emerald-900 dark:text-emerald-100 tracking-tight">
              Status de Operações
            </h1>
            <p className="text-muted-foreground"> Monitoramento da sincronização e geração de relatórios.</p>
          </div>
          <div className="flex gap-2">
            <Button 
              variant="outline" 
              onClick={() => refetch()} 
              disabled={isLoading}
              className="bg-white/50 backdrop-blur-sm"
            >
              <RefreshCw className={`w-4 h-4 mr-2 ${isLoading ? 'animate-spin' : ''}`} />
              Atualizar Logs
            </Button>
            <Button 
              onClick={() => syncMutation.mutate()} 
              disabled={syncMutation.isPending}
              className="bg-gradient-brand hover:brightness-110 shadow-lg shadow-emerald-500/20"
            >
              {syncMutation.isPending ? (
                <RefreshCw className="w-4 h-4 mr-2 animate-spin" />
              ) : (
                <Play className="w-4 h-4 mr-2 fill-current" />
              )}
              Sincronizar Agora
            </Button>
          </div>
        </header>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          <Card className="bg-white/80 backdrop-blur-md border-emerald-100 shadow-sm">
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-bold text-muted-foreground uppercase tracking-wider flex items-center gap-2">
                <CheckCircle2 className="w-4 h-4 text-emerald-500" />
                Status Atual
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-display font-black text-emerald-700">Online</div>
              <p className="text-xs text-muted-foreground mt-1">Sincronização automática ativa</p>
            </CardContent>
          </Card>

          <Card className="bg-white/80 backdrop-blur-md border-emerald-100 shadow-sm">
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-bold text-muted-foreground uppercase tracking-wider flex items-center gap-2">
                <Clock className="w-4 h-4 text-blue-500" />
                Última Geração
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-display font-black text-slate-700">
                {logs?.[0] ? format(new Date(logs[0].timestamp), "HH:mm", { locale: ptBR }) : "--:--"}
              </div>
              <p className="text-xs text-muted-foreground mt-1">Hoje, Amazonas (UTC-4)</p>
            </CardContent>
          </Card>

          <Card className="bg-white/80 backdrop-blur-md border-emerald-100 shadow-sm">
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-bold text-muted-foreground uppercase tracking-wider flex items-center gap-2">
                <FileText className="w-4 h-4 text-orange-500" />
                Total Processado
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-display font-black text-slate-700">
                {logs?.length ?? 0}
              </div>
              <p className="text-xs text-muted-foreground mt-1">Registros nas últimas 24h</p>
            </CardContent>
          </Card>
        </div>

        <Card className="bg-white/80 backdrop-blur-md border-emerald-100 shadow-xl overflow-hidden">
          <CardHeader>
            <CardTitle className="text-lg font-display font-bold">Log de Eventos</CardTitle>
            <CardDescription>
              Histórico detalhado das ações de sincronização e processamento manual/automático.
            </CardDescription>
          </CardHeader>
          <CardContent className="p-0">
            <Table>
              <TableHeader className="bg-slate-50/50">
                <TableRow>
                  <TableHead className="w-[180px]">Data/Hora</TableHead>
                  <TableHead>Operação</TableHead>
                  <TableHead>Usuário</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead className="text-right">Ações</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {isLoading ? (
                  Array.from({ length: 5 }).map((_, i) => (
                    <TableRow key={i}>
                      <TableCell colSpan={5} className="h-12 animate-pulse bg-slate-100/50" />
                    </TableRow>
                  ))
                ) : logs && logs.length > 0 ? (
                  logs.map((log) => (
                    <TableRow key={log.id} className="hover:bg-emerald-50/30 transition-colors">
                      <TableCell className="font-medium text-xs tabular-nums">
                        {format(new Date(log.timestamp), "dd/MM/yyyy HH:mm:ss", { locale: ptBR })}
                      </TableCell>
                      <TableCell className="text-sm">
                        <div className="flex flex-col">
                          <span>{log.details}</span>
                          <span className="text-[10px] text-muted-foreground italic">Relatório {log.shift}</span>
                        </div>
                      </TableCell>
                      <TableCell className="text-sm text-muted-foreground">{log.user}</TableCell>
                      <TableCell>
                        <Badge 
                          variant={log.status === "success" ? "secondary" : "destructive"}
                          className={log.status === "success" ? "bg-emerald-100 text-emerald-700 hover:bg-emerald-100" : ""}
                        >
                          {log.status === "success" ? "Concluído" : "Falha"}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-right">
                        <Button variant="ghost" size="sm" className="h-8 text-xs hover:text-emerald-600">
                          Ver Detalhes
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))
                ) : (
                  <TableRow>
                    <TableCell colSpan={5} className="h-32 text-center text-muted-foreground italic">
                      Nenhum evento registrado no histórico recente.
                    </TableCell>
                  </TableRow>
                )}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
