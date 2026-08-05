import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useState, type FormEvent } from "react";
import { supabase } from "@/integrations/backend/client";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { toast } from "sonner";
import { Flame } from "lucide-react";
import { AuthBrandSide } from "@/components/auth/AuthBrandSide";
import { AuthCredentialsForm } from "@/components/auth/AuthCredentialsForm";

/** Aceita apenas caminhos internos, evitando redirecionamento aberto. */
function safePath(value: unknown): string {
  const raw = typeof value === "string" ? value : "";
  if (!raw.startsWith("/") || raw.startsWith("//")) return "/painel";
  if (raw === "/" || raw.startsWith("/auth") || raw.startsWith("/reset-password")) return "/painel";
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

function AuthPage() {
  const navigate = useNavigate();
  const { redirect: redirectTo } = Route.useSearch();
  const [loading, setLoading] = useState(false);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [name, setName] = useState("");

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => {
      if (data.session?.user) navigate({ to: redirectTo, replace: true });
    });
  }, [navigate, redirectTo]);

  const goToPainel = () => navigate({ to: redirectTo, replace: true });

  const handleLogin = async (e: FormEvent) => {
    e.preventDefault();
    if (loading) return;
    setLoading(true);
    const { error } = await supabase.auth.signInWithPassword({ email, password });
    setLoading(false);
    if (error) {
      setPassword("");
      toast.error(error.message);
      return;
    }
    toast.success("Login realizado");
    goToPainel();
  };

  const handleSignup = async (e: FormEvent) => {
    e.preventDefault();
    if (loading) return;
    setLoading(true);
    const { data, error } = await supabase.auth.signUp({
      email,
      password,
      options: {
        emailRedirectTo: `${window.location.origin}/painel`,
        data: { display_name: name },
      },
    });
    setLoading(false);
    if (error) {
      setPassword("");
      toast.error(error.message);
      return;
    }
    if (data.session) {
      toast.success("Cadastro criado! Redirecionando...");
      goToPainel();
    } else {
      toast.success("Cadastro criado! Confirme seu e-mail para entrar.");
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
        setLoading(false);
        toast.error(error.message ?? "Falha ao autenticar com Google");
        return;
      }
      // O navegador é redirecionado para o Google; libera o botão se algo travar.
      window.setTimeout(() => setLoading(false), 8000);
    } catch (e) {
      setLoading(false);
      toast.error((e as Error)?.message ?? "Falha ao autenticar com Google");
    }
  };
  /** Envia o e-mail de redefinição de senha para o endereço informado. */
  const handleForgotPassword = async () => {
    const target = email.trim();
    if (!target) {
      toast.error("Informe seu e-mail no campo acima para redefinir a senha.");
      return;
    }
    setLoading(true);
    const { error } = await supabase.auth.resetPasswordForEmail(target, {
      redirectTo: `${window.location.origin}/reset-password`,
    });
    setLoading(false);
    if (error) {
      toast.error(error.message);
      return;
    }
    toast.success("Enviamos um link de redefinição para o seu e-mail.");
  };

  return (
    <div className="min-h-dvh grid lg:grid-cols-2 bg-muted/40">
      <AuthBrandSide />

      <section className="flex items-center justify-center px-4 py-8 sm:py-12">
        <Card className="w-full max-w-md shadow-elevated border-border animate-fade-in-up">
          <CardHeader className="text-center space-y-2 px-4 sm:px-6 pt-6">
            <div className="mx-auto w-14 h-14 sm:w-16 sm:h-16 rounded-2xl bg-gradient-brand flex items-center justify-center shadow-elevated ring-4 ring-white lg:hidden">
              <Flame className="w-7 h-7 sm:w-8 sm:h-8 text-white" aria-hidden="true" />
            </div>
            <CardTitle className="font-display text-xl sm:text-2xl tracking-tight">
              Acesse o painel
            </CardTitle>
            <CardDescription className="text-xs sm:text-sm">
              Entre com sua conta institucional para continuar
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
              onForgotPassword={handleForgotPassword}
            />
          </CardContent>
        </Card>
      </section>
    </div>
  );
}
