import { useState, type FormEvent } from "react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { supabase } from "@/integrations/backend/client";
import { toast } from "sonner";
import { CheckCircle2, KeyRound, Loader2, Mail, ShieldCheck, ArrowLeft } from "lucide-react";
import { useNavigate } from "@tanstack/react-router";

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  defaultEmail?: string;
}

export function ForgotPasswordDialog({ open, onOpenChange, defaultEmail = "" }: Props) {
  const navigate = useNavigate();
  const [step, setStep] = useState<"request" | "verify">("request");
  const [email, setEmail] = useState(defaultEmail);
  const [code, setCode] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [success, setSuccess] = useState(false);

  // Solicita o envio do código OTP de 6 dígitos para o e-mail
  const handleRequestCode = async (e: FormEvent) => {
    e.preventDefault();
    const target = email.trim();
    if (!target) {
      toast.error("Por favor, digite seu endereço de e-mail.");
      return;
    }

    setLoading(true);
    try {
      const { error } = await supabase.auth.signInWithOtp({
        email: target,
        options: {
          shouldCreateUser: false,
        },
      });

      if (error) {
        // Se falhar (ex: usuário não encontrado), tenta fallback de recovery
        const { error: recError } = await supabase.auth.resetPasswordForEmail(target);
        if (recError) {
          toast.error(error.message || recError.message || "Erro ao solicitar código.");
          setLoading(false);
          return;
        }
      }

      toast.success("Código de 6 dígitos enviado! Verifique seu e-mail.");
      setStep("verify");
    } catch (err: any) {
      toast.error(err?.message || "Erro de conexão com o servidor.");
    } finally {
      setLoading(false);
    }
  };

  // Valida o código de 6 dígitos e salva a nova senha diretamente
  const handleVerifyAndReset = async (e: FormEvent) => {
    e.preventDefault();
    const targetEmail = email.trim();
    const targetCode = code.trim();

    if (!targetEmail) {
      toast.error("Informe seu e-mail.");
      return;
    }
    if (!targetCode) {
      toast.error("Informe o código de 6 dígitos recebido por e-mail.");
      return;
    }
    if (password.length < 6) {
      toast.error("A nova senha deve ter no mínimo 6 caracteres.");
      return;
    }
    if (password !== confirmPassword) {
      toast.error("As senhas digitadas não coincidem.");
      return;
    }

    setLoading(true);
    try {
      // 1. Tenta validar OTP com tipo 'email'
      let verifyRes = await supabase.auth.verifyOtp({
        email: targetEmail,
        token: targetCode,
        type: "email",
      });

      // Se falhar, tenta com tipo 'recovery'
      if (verifyRes.error) {
        verifyRes = await supabase.auth.verifyOtp({
          email: targetEmail,
          token: targetCode,
          type: "recovery",
        });
      }

      if (verifyRes.error) {
        toast.error(verifyRes.error.message || "Código inválido ou expirado. Verifique os 6 dígitos.");
        setLoading(false);
        return;
      }

      // 2. Atualiza a senha da conta com a nova senha escolhida
      const { error: updateError } = await supabase.auth.updateUser({
        password: password,
      });

      if (updateError) {
        toast.error(updateError.message || "Erro ao salvar a nova senha.");
        setLoading(false);
        return;
      }

      setSuccess(true);
      toast.success("Senha alterada com sucesso! Entrando...");
      setTimeout(() => {
        handleClose(false);
        navigate({ to: "/painel", replace: true });
      }, 1200);
    } catch (err: any) {
      toast.error(err?.message || "Erro ao redefinir a senha.");
    } finally {
      setLoading(false);
    }
  };

  const handleClose = (newOpen: boolean) => {
    if (!newOpen) {
      setTimeout(() => {
        setStep("request");
        setCode("");
        setPassword("");
        setConfirmPassword("");
        setSuccess(false);
      }, 300);
    }
    onOpenChange(newOpen);
  };

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader className="text-center sm:text-left space-y-2">
          <div className="mx-auto sm:mx-0 w-12 h-12 rounded-xl bg-primary/10 text-primary flex items-center justify-center mb-1">
            <KeyRound className="w-6 h-6" />
          </div>
          <DialogTitle className="text-xl font-display">
            {step === "request" ? "Código de Acesso por E-mail" : "Digite o Código e a Nova Senha"}
          </DialogTitle>
          <DialogDescription className="text-sm text-muted-foreground">
            {step === "request"
              ? "Informe seu e-mail para receber um código de 6 dígitos."
              : `Digite o código de 6 dígitos que enviamos para ${email} e crie sua nova senha.`}
          </DialogDescription>
        </DialogHeader>

        {success ? (
          <div className="space-y-4 py-3">
            <div className="flex items-center gap-3 p-4 rounded-xl bg-emerald-500/10 border border-emerald-500/20 text-emerald-700 dark:text-emerald-400 text-sm">
              <CheckCircle2 className="w-6 h-6 flex-shrink-0" />
              <div>
                <p className="font-semibold text-base">Senha alterada com sucesso!</p>
                <p className="mt-0.5 text-xs opacity-90">
                  Você já está autenticado. Redirecionando para o painel...
                </p>
              </div>
            </div>
          </div>
        ) : step === "request" ? (
          <form onSubmit={handleRequestCode} className="space-y-4 py-2">
            <div className="space-y-1.5">
              <Label htmlFor="reset-email">E-mail cadastrado</Label>
              <div className="relative">
                <Mail className="w-4 h-4 absolute left-3 top-3.5 text-muted-foreground" />
                <Input
                  id="reset-email"
                  type="email"
                  placeholder="seu-email@exemplo.com"
                  className="pl-9 h-11"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  autoFocus
                  required
                />
              </div>
            </div>

            <div className="flex flex-col-reverse sm:flex-row gap-2 pt-2">
              <Button
                type="button"
                variant="ghost"
                className="w-full sm:w-auto"
                onClick={() => handleClose(false)}
                disabled={loading}
              >
                Cancelar
              </Button>
              <Button type="submit" className="w-full sm:flex-1 h-11" disabled={loading}>
                {loading && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
                Enviar código de 6 dígitos
              </Button>
            </div>

            <div className="text-center pt-1">
              <button
                type="button"
                onClick={() => setStep("verify")}
                className="text-xs text-primary/80 hover:text-primary hover:underline"
              >
                Já tenho o código de 6 dígitos
              </button>
            </div>
          </form>
        ) : (
          <form onSubmit={handleVerifyAndReset} className="space-y-3.5 py-2">
            <div className="space-y-1.5">
              <Label htmlFor="verify-email">E-mail</Label>
              <Input
                id="verify-email"
                type="email"
                className="h-10"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
              />
            </div>

            <div className="space-y-1.5">
              <div className="flex items-center justify-between">
                <Label htmlFor="verify-code">Código de 6 dígitos</Label>
                <button
                  type="button"
                  onClick={handleRequestCode}
                  disabled={loading}
                  className="text-xs text-primary hover:underline"
                >
                  Reenviar código
                </button>
              </div>
              <div className="relative">
                <ShieldCheck className="w-4 h-4 absolute left-3 top-3 text-muted-foreground" />
                <Input
                  id="verify-code"
                  type="text"
                  placeholder="Ex: 123456"
                  maxLength={10}
                  className="pl-9 h-10 tracking-widest font-mono text-center sm:text-left"
                  value={code}
                  onChange={(e) => setCode(e.target.value)}
                  autoFocus
                  required
                />
              </div>
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="verify-pass">Nova senha</Label>
              <Input
                id="verify-pass"
                type="password"
                placeholder="Mínimo 6 caracteres"
                className="h-10"
                minLength={6}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
              />
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="verify-confirm">Confirmar nova senha</Label>
              <Input
                id="verify-confirm"
                type="password"
                placeholder="Repita a nova senha"
                className="h-10"
                minLength={6}
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                required
              />
            </div>

            <div className="flex flex-col-reverse sm:flex-row gap-2 pt-2">
              <Button
                type="button"
                variant="ghost"
                className="w-full sm:w-auto flex items-center gap-1"
                onClick={() => setStep("request")}
                disabled={loading}
              >
                <ArrowLeft className="w-4 h-4" /> Voltar
              </Button>
              <Button type="submit" className="w-full sm:flex-1 h-11 font-medium" disabled={loading}>
                {loading && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
                Salvar e Entrar
              </Button>
            </div>
          </form>
        )}
      </DialogContent>
    </Dialog>
  );
}
