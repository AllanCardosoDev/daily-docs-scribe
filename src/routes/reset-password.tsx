import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useState, type FormEvent } from "react";
import { supabase } from "@/integrations/backend/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { toast } from "sonner";
import { KeyRound, Loader2 } from "lucide-react";

export const Route = createFileRoute("/reset-password")({
  ssr: false,
  head: () => ({
    meta: [
      { title: "Redefinir senha · CBMAM Amazonas + Verde" },
      {
        name: "description",
        content: "Defina uma nova senha de acesso ao painel operacional do CBMAM.",
      },
      { property: "og:title", content: "Redefinir senha · CBMAM" },
      {
        property: "og:description",
        content: "Defina uma nova senha de acesso ao painel operacional do CBMAM.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
      { name: "robots", content: "noindex" },
    ],
  }),
  component: ResetPasswordPage,
});

function ResetPasswordPage() {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(false);
  const [ready, setReady] = useState(false);
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");

  // O link de recuperação cria uma sessão temporária de forma assíncrona
  // (o SDK ainda pode estar processando o hash da URL quando a página monta).
  // Por isso aguardamos o evento de auth antes de considerar o link inválido.
  useEffect(() => {
    let settled = false;
    let timeout: number | undefined;

    const accept = () => {
      if (settled) return;
      settled = true;
      window.clearTimeout(timeout);
      setReady(true);
    };

    const { data: sub } = supabase.auth.onAuthStateChange((_event, session) => {
      if (session) accept();
    });

    supabase.auth.getSession().then(({ data }) => {
      if (data.session) {
        accept();
        return;
      }
      timeout = window.setTimeout(() => {
        if (settled) return;
        settled = true;
        toast.error("Link inválido ou expirado. Solicite a redefinição novamente.");
        navigate({ to: "/auth", replace: true });
      }, 2500);
    });

    return () => {
      window.clearTimeout(timeout);
      sub.subscription.unsubscribe();
    };
  }, [navigate]);

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    if (loading) return;
    if (password.length < 8) {
      toast.error("A senha deve ter ao menos 8 caracteres.");
      return;
    }
    if (password !== confirm) {
      toast.error("As senhas não conferem.");
      return;
    }
    setLoading(true);
    const { error } = await supabase.auth.updateUser({ password });
    setLoading(false);
    if (error) {
      toast.error(error.message);
      return;
    }
    toast.success("Senha redefinida com sucesso.");
    navigate({ to: "/painel", replace: true });
  };

  return (
    <main className="min-h-dvh flex items-center justify-center bg-muted/40 px-4 py-10">
      <Card className="w-full max-w-md shadow-elevated border-border animate-fade-in-up">
        <CardHeader className="text-center space-y-2">
          <div className="mx-auto w-14 h-14 rounded-2xl bg-gradient-brand flex items-center justify-center shadow-elevated ring-4 ring-white">
            <KeyRound className="w-7 h-7 text-white" aria-hidden="true" />
          </div>
          <CardTitle className="font-display text-xl tracking-tight">Redefinir senha</CardTitle>
          <CardDescription className="text-sm">
            Escolha uma nova senha para acessar o painel.
          </CardDescription>
        </CardHeader>

        <CardContent>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="space-y-1.5">
              <Label htmlFor="new-pass">Nova senha</Label>
              <Input
                id="new-pass"
                type="password"
                autoComplete="new-password"
                minLength={8}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="confirm-pass">Confirmar nova senha</Label>
              <Input
                id="confirm-pass"
                type="password"
                autoComplete="new-password"
                minLength={8}
                value={confirm}
                onChange={(e) => setConfirm(e.target.value)}
                required
              />
            </div>
            <Button type="submit" className="w-full h-11 hover-lift" disabled={loading || !ready}>
              {loading && <Loader2 className="w-4 h-4 mr-2 animate-spin" />} Salvar nova senha
            </Button>
          </form>
        </CardContent>
      </Card>
    </main>
  );
}
