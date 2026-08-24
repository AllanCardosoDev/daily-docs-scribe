import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect } from "react";

export const Route = createFileRoute("/")({
  ssr: false,
  head: () => ({
    meta: [
      { title: "CBMAM · Acesso ao painel" },
      { name: "description", content: "Redirecionando para o painel operacional do CBMAM." },
      { property: "og:title", content: "CBMAM · Acesso ao painel" },
      {
        property: "og:description",
        content: "Redirecionando para o painel operacional do CBMAM.",
      },
      { name: "robots", content: "noindex" },
    ],
  }),
  component: IndexRedirect,
});

function IndexRedirect() {
  const navigate = useNavigate();

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const { supabase } = await import("@/integrations/backend/client");
      const { data } = await supabase.auth.getSession();
      if (cancelled) return;
      navigate({ to: data.session?.user ? "/painel" : "/auth", replace: true });
    })();
    return () => {
      cancelled = true;
    };
  }, [navigate]);

  return (
    <div className="flex min-h-dvh items-center justify-center bg-background p-6">
      <div className="flex flex-col items-center gap-4 max-w-sm text-center">
        <div className="h-8 w-8 animate-spin rounded-full border-2 border-primary border-t-transparent" />
        <p className="text-sm text-muted-foreground whitespace-pre-line">
          Sincronizando com o Comando Integrado…{"\n"}
          Processando comparativos e totais acumulados.{"\n"}
          Implemente estados de carregamento, erro e vazio com textos configuráveis na interface do meu documento diário.
        </p>
      </div>
    </div>
  );
}
