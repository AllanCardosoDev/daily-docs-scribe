import { Flame } from "lucide-react";

/** Institutional footer for the operational dashboard. */
export function DashboardFooter() {
  const year = new Date().getFullYear();
  return (
    <footer className="mt-8 border-t border-border bg-card/40 backdrop-blur-sm">
      <div className="w-full max-w-[98%] mx-auto px-3 sm:px-4 md:px-6 py-5 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 text-xs text-muted-foreground">
        <div className="flex items-center gap-2 min-w-0">
          <span className="grid place-items-center w-7 h-7 rounded-lg bg-gradient-brand text-white shrink-0">
            <Flame className="w-3.5 h-3.5" aria-hidden="true" />
          </span>
          <div className="min-w-0">
            <div className="font-semibold text-foreground">
              CBMAM · Comando Integrado — Amazonas + Verde
            </div>
            <div className="truncate">
              Painel operacional oficial · Dados sincronizados em tempo real
            </div>
          </div>
        </div>
        <div className="text-[11px] uppercase tracking-[0.14em] font-semibold">
          © {year} · Corpo de Bombeiros Militar do Amazonas
        </div>
      </div>
    </footer>
  );
}
