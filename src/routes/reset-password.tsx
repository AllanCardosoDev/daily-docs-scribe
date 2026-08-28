import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useState, type FormEvent } from "react";
import { supabase } from "@/integrations/backend/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { toast } from "sonner";
import { KeyRound, Loader2, Mail, ShieldCheck, ArrowLeft, CheckCircle2 } from "lucide-react";

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
  const [hasSession, setHasSession] = useState(false);
  const [email, setEmail] = useState("");
  const [code, setCode] = useState("");
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [success, setSuccess] = useState(false);

  useEffect(() => {
    // 1. Verifica se já temos sessão ativa (ex: usuário veio de link direto)
    supabase.auth.getSession().then(({ data }) => {
      if (data.session) {
        setHasSession(true);
        if (data.session.user.email) setEmail(data.session.user.email);
      }
    });

    const { data: sub } = supabase.auth.onAuthStateChange((_event, session) => {
      if (session) {
        setHasSession(true);
        if (session.user.email) setEmail(session.user.email);
      }
    });

    return () => {
      sub.subscription.unsubscribe();
    };
  }, []);

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    if (loading) return;

    if (password.length < 6) {
      toast.error("A senha deve ter no mínimo 6 caracteres.");
      return;
    }
    if (password !== confirm) {
      toast.error("As senhas digitadas não coincidem.");
      return;
    }

    setLoading(true);
    try {
      if (hasSession) {
        // Usuário já está autenticado via link de recuperação
        const { error } = await supabase.auth.updateUser({ password });
        if (error) {
          toast.error(error.message);
          setLoading(false);
          return;
        }
      } else {
        // Validação via código OTP + e-mail
        if (!email.trim()) {
          toast.error("Informe seu endereço de e-mail.");
          setLoading(false);
          return;
        }
        if (!code.trim()) {
          toast.error("Informe o código de 6 dígitos recebido por e-mail.");
          setLoading(false);
          return;
        }

        const { error: verifyErr } = await supabase.auth.verifyOtp({
          email: email.trim(),
          token: code.trim(),
          type: "recovery",
        });

        if (verifyErr) {
          toast.error(verifyErr.message || "Código inválido ou expirado.");
          setLoading(false);
          return;
        }

        const { error: upErr } = await supabase.auth.updateUser({ password });
        if (upErr) {
          toast.error(upErr.message);
          setLoading(false);
          return;
        }
      }

      setSuccess(true);
      toast.success("Senha redefinida com sucesso! Redirecionando...");
      setTimeout(() => {
        navigate({ to: "/painel", replace: true });
      }, 1500);
    } catch (err: any) {
      toast.error(err?.message || "Erro ao redefinir a senha.");
    } finally {
      setLoading(false);
    }
  };

  const handleRequestNewCode = async () => {
    if (!email.trim()) {
      toast.error("Digite seu e-mail no campo correspondente para reenviar.");
      return;
    }
    setLoading(true);
    try {
      const { error } = await supabase.auth.resetPasswordForEmail(email.trim(), {
        redirectTo: `${window.location.origin}/reset-password`,
      });
      if (error) toast.error(error.message);
      else toast.success("Novo código enviado para seu e-mail.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <main className="min-h-dvh flex items-center justify-center bg-muted/40 px-4 py-10">
      <Card className="w-full max-w-md shadow-elevated border-border animate-fade-in-up">
        <CardHeader className="text-center space-y-2">
          <div className="mx-auto w-14 h-14 rounded-2xl bg-gradient-brand flex items-center justify-center shadow-elevated ring-4 ring-white">
            <KeyRound className="w-7 h-7 text-white" aria-hidden="true" />
          </div>
          <CardTitle className="font-display text-2xl tracking-tight">Redefinir senha</CardTitle>
          <CardDescription className="text-sm">
            {hasSession
              ? "Crie uma nova senha segura para acessar o painel operacional."
              : "Informe seu e-mail, o código de 6 dígitos recebido e sua nova senha."}
          </CardDescription>
        </CardHeader>

        <CardContent>
          {success ? (
            <div className="space-y-4 py-3">
              <div className="flex items-center gap-3 p-4 rounded-xl bg-emerald-500/10 border border-emerald-500/20 text-emerald-700 dark:text-emerald-400 text-sm">
                <CheckCircle2 className="w-6 h-6 flex-shrink-0" />
                <div>
                  <p className="font-semibold text-base">Senha alterada com sucesso!</p>
                  <p className="mt-0.5 text-xs opacity-90">Entrando no painel operacional...</p>
                </div>
              </div>
            </div>
          ) : (
            <form onSubmit={handleSubmit} className="space-y-4">
              {!hasSession && (
                <>
                  <div className="space-y-1.5">
                    <Label htmlFor="res-email">E-mail</Label>
                    <div className="relative">
                      <Mail className="w-4 h-4 absolute left-3 top-3.5 text-muted-foreground" />
                      <Input
                        id="res-email"
                        type="email"
                        placeholder="seu-email@exemplo.com"
                        className="pl-9 h-11"
                        value={email}
                        onChange={(e) => setEmail(e.target.value)}
                        required
                      />
                    </div>
                  </div>

                  <div className="space-y-1.5">
                    <div className="flex items-center justify-between">
                      <Label htmlFor="res-code">Código de 6 dígitos recebido por e-mail</Label>
                      <button
                        type="button"
                        onClick={handleRequestNewCode}
                        className="text-xs text-primary hover:underline"
                      >
                        Reenviar
                      </button>
                    </div>
                    <div className="relative">
                      <ShieldCheck className="w-4 h-4 absolute left-3 top-3.5 text-muted-foreground" />
                      <Input
                        id="res-code"
                        type="text"
                        placeholder="Ex: 123456"
                        className="pl-9 h-11 font-mono tracking-widest"
                        value={code}
                        onChange={(e) => setCode(e.target.value)}
                        required
                      />
                    </div>
                  </div>
                </>
              )}

              <div className="space-y-1.5">
                <Label htmlFor="new-pass">Nova senha</Label>
                <Input
                  id="new-pass"
                  type="password"
                  autoComplete="new-password"
                  placeholder="Mínimo 6 caracteres"
                  minLength={6}
                  className="h-11"
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
                  placeholder="Repita a nova senha"
                  minLength={6}
                  className="h-11"
                  value={confirm}
                  onChange={(e) => setConfirm(e.target.value)}
                  required
                />
              </div>

              <Button type="submit" className="w-full h-11 hover-lift mt-2" disabled={loading}>
                {loading && <Loader2 className="w-4 h-4 mr-2 animate-spin" />} Salvar nova senha
              </Button>

              <div className="text-center pt-2">
                <button
                  type="button"
                  onClick={() => navigate({ to: "/auth", replace: true })}
                  className="text-xs text-muted-foreground hover:text-foreground flex items-center justify-center gap-1 mx-auto"
                >
                  <ArrowLeft className="w-3.5 h-3.5" /> Voltar para o login
                </button>
              </div>
            </form>
          )}
        </CardContent>
      </Card>
    </main>
  );
}
