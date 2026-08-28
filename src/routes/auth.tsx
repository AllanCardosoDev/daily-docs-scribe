import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useState, type FormEvent } from "react";
import { supabase } from "@/integrations/backend/client";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { toast } from "sonner";
import { Flame, Database, ShieldCheck } from "lucide-react";
import { AuthBrandSide } from "@/components/auth/AuthBrandSide";
import { AuthCredentialsForm } from "@/components/auth/AuthCredentialsForm";
import { ForgotPasswordDialog } from "@/components/auth/ForgotPasswordDialog";
import { Badge } from "@/components/ui/badge";

/** Aceita apenas caminhos internos, evitando redirecionamento aberto. */
function safePath(value: unknown): string {
  const raw = typeof value === "string" ? value : "";
  if (!raw.startsWith("/") || raw.startsWith("//")) return "/dashboard";
  if (raw === "/" || raw.startsWith("/auth") || raw.startsWith("/reset-password")) return "/dashboard";
  return raw;
}

export const Route = createFileRoute("/auth")({
  ssr: false,
  validateSearch: (search: Record<string, unknown>): { redirect?: string } => ({
    redirect: safePath(search.redirect) || undefined,
  }),
  head: () => ({
    meta: [
      { title: "Entrar · CBMAM Amazonas + Verde" },
      { name: "description", content: "Acesse o painel operacional do CBMAM." },
      { name: "robots", content: "noindex" },
    ],
  }),
  component: AuthPage,
});

export function AuthPage() {
  const navigate = useNavigate();
  const { redirect: redirectTo } = Route.useSearch();
  const [loading, setLoading] = useState(false);
  const [email, setEmail] = useState("allancardoso.dev@gmail.com");
  const [password, setPassword] = useState("");
  const [name, setName] = useState("");
  const [forgotPasswordOpen, setForgotPasswordOpen] = useState(false);

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => {
      if (data.session?.user) {
        navigate({ to: redirectTo || "/dashboard", replace: true });
      }
    });
  }, [navigate, redirectTo]);

  const goToDashboard = () => navigate({ to: redirectTo || "/dashboard", replace: true });

  const handleLogin = async (e: FormEvent) => {
    e.preventDefault();
    if (loading) return;
    const targetEmail = email.trim();
    if (!targetEmail || !password) {
      toast.error("Preencha o e-mail e a senha.");
      return;
    }

    setLoading(true);
    try {
      const { data, error } = await supabase.auth.signInWithPassword({
        email: targetEmail,
        password: password,
      });

      if (error) {
        toast.error(error.message || "Credenciais inválidas. Verifique seu e-mail e senha.");
        setLoading(false);
        return;
      }

      toast.success(`Bem-vindo, ${data.user?.email}!`);
      goToDashboard();
    } catch (err: any) {
      toast.error(err?.message || "Erro de conexão com o banco de dados.");
    } finally {
      setLoading(false);
    }
  };

  const handleSignup = async (e: FormEvent) => {
    e.preventDefault();
    if (loading) return;
    setLoading(true);
    try {
      const { data, error } = await supabase.auth.signUp({
        email: email.trim(),
        password,
        options: {
          emailRedirectTo: `${window.location.origin}/dashboard`,
          data: { display_name: name },
        },
      });

      if (error) {
        toast.error(error.message);
        setLoading(false);
        return;
      }

      if (data.session) {
        toast.success("Cadastro criado! Redirecionando...");
        goToDashboard();
      } else {
        toast.success("Cadastro criado! Confirme seu e-mail para entrar.");
      }
    } catch (err: any) {
      toast.error(err?.message || "Erro no cadastro.");
    } finally {
      setLoading(false);
    }
  };

  const handleGoogle = async () => {
    setLoading(true);
    try {
      const { error } = await supabase.auth.signInWithOAuth({
        provider: "google",
        options: { redirectTo: `${window.location.origin}/auth` },
      });
      if (error) {
        toast.error("Não foi possível iniciar o login com Google.");
        console.error(error);
      }
    } finally {
      setLoading(false);
    }
  };

  return (
    <main className="min-h-dvh flex bg-background">
      <AuthBrandSide />

      <section
        aria-label="Formulário de acesso"
        className="flex-1 flex flex-col items-center justify-center p-4 sm:p-8 md:p-12"
      >
        <Card className="w-full max-w-md border-border shadow-elevated animate-fade-in-up">
          <CardHeader className="space-y-2 text-center sm:text-left">
            <div className="flex items-center justify-between">
              <div className="w-12 h-12 rounded-2xl bg-gradient-brand flex items-center justify-center shadow-elevated ring-4 ring-emerald-500/10">
                <Flame className="w-6 h-6 text-white" aria-hidden="true" />
              </div>
              <Badge variant="outline" className="text-[11px] gap-1 bg-emerald-50 text-emerald-700 border-emerald-200 dark:bg-emerald-950/40 dark:text-emerald-400 dark:border-emerald-800">
                <ShieldCheck className="w-3 h-3 text-emerald-600" />
                Base Oficial (792 Relatórios)
              </Badge>
            </div>

            <CardTitle className="font-display text-2xl tracking-tight">
              Acesso ao Sistema
            </CardTitle>
            <CardDescription className="text-sm">
              Entre com suas credenciais oficiais do CBMAM.
            </CardDescription>
          </CardHeader>

          <CardContent>
            <AuthCredentialsForm
              loading={loading}
              email={email}
              password={password}
              name={name}
              onEmailChange={setEmail}
              onPasswordChange={setPassword}
              onNameChange={setName}
              onLoginSubmit={handleLogin}
              onSignupSubmit={handleSignup}
              onGoogleClick={handleGoogle}
              onForgotPassword={() => setForgotPasswordOpen(true)}
            />
          </CardContent>
        </Card>
      </section>

      <ForgotPasswordDialog
        open={forgotPasswordOpen}
        onOpenChange={setForgotPasswordOpen}
        defaultEmail={email}
      />
    </main>
  );
}
