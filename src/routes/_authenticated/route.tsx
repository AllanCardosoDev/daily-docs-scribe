import { createFileRoute, Outlet, redirect } from "@tanstack/react-router";
import { supabase } from "@/integrations/backend/client";
import { useDriveAutoSync } from "@/hooks/use-drive-sync";

export const Route = createFileRoute("/_authenticated")({
  ssr: false,
  beforeLoad: async ({ location }) => {
    // A sessão vive apenas no navegador: no SSR/prerender não há o que checar.
    // Verificar no servidor gera HTML divergente (tela branca por hydration error).
    if (typeof window === "undefined") return;

    // getSession lê do armazenamento local e renova o token quando necessário.
    const { data } = await supabase.auth.getSession();
    if (!data.session?.user) {
      throw redirect({
        to: "/auth",
        search: { redirect: location.href },
        replace: true,
      });
    }
  },

  component: AuthenticatedLayout,
});

function AuthenticatedLayout() {
  // Mantém os registros sempre espelhando as planilhas do Google Drive.
  useDriveAutoSync();
  return <Outlet />;
}
