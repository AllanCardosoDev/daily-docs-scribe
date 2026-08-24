import { memo } from "react";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
  DropdownMenuLabel,
  DropdownMenuSeparator,
} from "@/components/ui/dropdown-menu";
import {
  LogOut,
  Settings,
  ChevronRight,
  CalendarDays,
  ClipboardList,
  BarChart3,
  Flame,
} from "lucide-react";
import { Link } from "@tanstack/react-router";
import { useAuthEmail, useSignOut } from "@/hooks/use-auth-session";
import type { SheetsHeader } from "@/lib/sheets.types";

interface Props {
  header: SheetsHeader;
  configured: boolean;
  error?: string;
  isAdmin: boolean;
  onOpenSettings: () => void;
}

function connectionStatus(configured: boolean, error?: string) {
  if (!configured)
    return { dot: "bg-amber-400", label: "Aguardando configuração", tone: "text-amber-100" };
  if (error) return { dot: "bg-red-500", label: `Erro: ${error}`, tone: "text-red-100" };
  return { dot: "bg-emerald-400", label: "Conectado ao Google Sheets", tone: "text-emerald-100" };
}

export const DashboardHeader = memo(function DashboardHeader({
  header,
  configured,
  error,
  isAdmin,
  onOpenSettings,
}: Props) {
  const { data: email = "" } = useAuthEmail();
  const signOut = useSignOut();
  const status = connectionStatus(configured, error);
  const initial = (email || "U").slice(0, 1).toUpperCase();

  return (
    <header className="sticky top-0 z-40 bg-gradient-brand text-white shadow-elevated relative overflow-hidden">
      <div
        aria-hidden="true"
        className="pointer-events-none absolute inset-0 opacity-[0.08]"
        style={{
          backgroundImage:
            "radial-gradient(circle at 15% 0%, white 0, transparent 45%), radial-gradient(circle at 85% 100%, white 0, transparent 50%)",
        }}
      />
      <div
        aria-hidden="true"
        className="pointer-events-none absolute inset-x-0 bottom-0 h-px bg-white/15"
      />
      <div className="relative w-full max-w-[98%] mx-auto px-3 sm:px-4 md:px-6 py-3 md:py-4 grid grid-cols-[minmax(0,1fr)_auto] items-center gap-3 md:gap-4">
        <div className="flex min-w-0 items-center gap-3">
          <div className="shrink-0 relative w-10 h-10 sm:w-11 sm:h-11 rounded-xl bg-white/10 backdrop-blur-sm border border-white/20 shadow-inner ring-1 ring-inset ring-white/10 grid place-items-center">
            <img
              src="/icone-cbmam.png"
              alt="Brasão do Corpo de Bombeiros Militar do Amazonas"
              width={28}
              height={28}
              className="w-7 h-7 sm:w-8 sm:h-8 object-contain"
            />

            <span className="absolute -bottom-0.5 -right-0.5 w-3 h-3 rounded-full bg-emerald-400 ring-2 ring-[color:var(--brand-900)]" />
          </div>
          <div className="min-w-0">
            <div className="flex items-center gap-1.5 text-[10px] sm:text-[11px] uppercase tracking-[0.14em] text-white/60 font-semibold">
              <span>CBMAM</span>
              <ChevronRight className="w-3 h-3" aria-hidden="true" />
              <span className="truncate">Amazonas + Verde</span>
            </div>
            <h1 className="font-display text-base sm:text-lg md:text-xl font-bold tracking-tight truncate leading-tight">
              {header.titulo ?? "Painel Operacional Diário"}
            </h1>
            <p className="text-[11px] sm:text-xs text-white/70 truncate">
              {header.periodo ? `Período: ${header.periodo}` : "Situação em tempo real"}
              {header.coordenador ? ` · Coord.: ${header.coordenador}` : ""}
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2 sm:gap-3 shrink-0">
          <div
            className={`hidden sm:flex items-center gap-2 text-xs bg-white/10 backdrop-blur-sm border border-white/15 rounded-full py-1.5 px-3 transition-colors hover:bg-white/15 ${status.tone}`}
            title={status.label}
            role="status"
          >
            <span className={`relative w-2.5 h-2.5 rounded-full shrink-0 ${status.dot}`}>
              <span
                className={`absolute inset-0 rounded-full ${status.dot} opacity-75 animate-ping`}
              />
            </span>
            <span className="hidden md:inline truncate max-w-[220px] font-medium">
              {status.label}
            </span>
          </div>

          <div
            className={`sm:hidden flex items-center justify-center w-9 h-9 rounded-full bg-white/10 border border-white/15`}
            title={status.label}
            role="status"
            aria-label={status.label}
          >
            <span className={`w-2.5 h-2.5 rounded-full ${status.dot}`} />
          </div>

          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button
                variant="secondary"
                size="sm"
                className="gap-2 h-10 sm:h-9 min-w-10 px-1.5 sm:px-2.5 bg-white/95 hover:bg-white text-foreground shadow-sm"
                aria-label="Menu do usuário"
              >
                <span
                  className="w-7 h-7 rounded-full bg-gradient-brand text-white text-xs font-bold grid place-items-center"
                  aria-hidden="true"
                >
                  {initial}
                </span>
                <span className="hidden sm:inline max-w-[140px] truncate text-sm">
                  {email || "Usuário"}
                </span>
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-60">
              <DropdownMenuLabel className="flex items-center gap-2">
                <span className="w-8 h-8 rounded-full bg-gradient-brand text-white text-xs font-bold grid place-items-center">
                  {initial}
                </span>
                <div className="min-w-0">
                  <div className="text-xs text-muted-foreground">Conectado como</div>
                  <div className="truncate font-medium">{email || "Usuário"}</div>
                </div>
              </DropdownMenuLabel>
              <DropdownMenuSeparator />
              <DropdownMenuItem asChild>
                <Link to="/painel">
                  <BarChart3 className="w-4 h-4 mr-2" /> Dashboard
                </Link>
              </DropdownMenuItem>
              <DropdownMenuItem asChild>
                <Link to="/registro">
                  <ClipboardList className="w-4 h-4 mr-2" /> Registro diário
                </Link>
              </DropdownMenuItem>
              <DropdownMenuItem asChild>
                <Link to="/totais">
                  <BarChart3 className="w-4 h-4 mr-2" /> Totais acumulados
                </Link>
              </DropdownMenuItem>
              <DropdownMenuItem asChild>
                <Link to="/escala">
                  <CalendarDays className="w-4 h-4 mr-2" /> Escala da Sala de Situação
                </Link>
              </DropdownMenuItem>
              <DropdownMenuItem asChild>
                <a href="/grupo-adicional.html" target="_blank" rel="noopener noreferrer">
                  <Flame className="w-4 h-4 mr-2 text-emerald-700" /> Portal API Incêndios
                </a>
              </DropdownMenuItem>
              {isAdmin && (
                <DropdownMenuItem onClick={onOpenSettings}>
                  <Settings className="w-4 h-4 mr-2" /> Configurações
                </DropdownMenuItem>
              )}
              <DropdownMenuItem
                onClick={signOut}
                className="text-red-600 focus:text-red-700 focus:bg-red-50"
              >
                <LogOut className="w-4 h-4 mr-2" /> Sair
              </DropdownMenuItem>
              <DropdownMenuSeparator />
              <div className="px-2 py-1.5 text-[10px] uppercase tracking-wider text-muted-foreground">
                {isAdmin ? "Administrador" : "Operador"}
              </div>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </div>
    </header>
  );
});
