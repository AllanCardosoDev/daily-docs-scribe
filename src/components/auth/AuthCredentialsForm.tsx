import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Loader2 } from "lucide-react";
import type { FormEvent } from "react";
import { GoogleLogo } from "./GoogleLogo";

export interface LoginValues {
  email: string;
  password: string;
}
export interface SignupValues extends LoginValues {
  name: string;
}

interface Props {
  loading: boolean;
  email: string;
  password: string;
  name: string;
  onEmailChange: (v: string) => void;
  onPasswordChange: (v: string) => void;
  onNameChange: (v: string) => void;
  onLoginSubmit: (e: FormEvent) => void;
  onSignupSubmit: (e: FormEvent) => void;
  onGoogleClick: () => void;
  onForgotPassword: () => void;
}

/**
 * Tabbed login / signup form + Google OAuth button.
 * Split from the auth route so the route stays focused on session wiring.
 */
export function AuthCredentialsForm({
  loading,
  email,
  password,
  name,
  onEmailChange,
  onPasswordChange,
  onNameChange,
  onLoginSubmit,
  onSignupSubmit,
  onGoogleClick,
  onForgotPassword,
}: Props) {
  return (
    <>
      <Tabs defaultValue="login">
        <TabsList className="grid w-full grid-cols-2">
          <TabsTrigger value="login">Entrar</TabsTrigger>
          <TabsTrigger value="signup">Cadastrar</TabsTrigger>
        </TabsList>

        <TabsContent value="login">
          <form onSubmit={onLoginSubmit} className="space-y-3 mt-4">
            <TextField
              id="l-email"
              label="E-mail"
              type="email"
              autoComplete="email"
              value={email}
              onChange={onEmailChange}
            />
            <TextField
              id="l-pass"
              label="Senha"
              type="password"
              autoComplete="current-password"
              minLength={6}
              value={password}
              onChange={onPasswordChange}
            />
            <div className="flex items-center justify-between pt-0.5">
              <button
                type="button"
                onClick={onForgotPassword}
                className="text-xs text-primary/90 hover:text-primary hover:underline font-medium flex items-center gap-1 transition-colors ml-auto py-1"
              >
                Esqueci minha senha por e-mail
              </button>
            </div>
            <Button type="submit" className="w-full h-11 hover-lift" disabled={loading}>
              {loading && <Loader2 className="w-4 h-4 mr-2 animate-spin" />} Entrar
            </Button>
          </form>
        </TabsContent>

        <TabsContent value="signup">
          <form onSubmit={onSignupSubmit} className="space-y-3 mt-4">
            <TextField
              id="s-name"
              label="Nome"
              autoComplete="name"
              value={name}
              onChange={onNameChange}
            />
            <TextField
              id="s-email"
              label="E-mail"
              type="email"
              autoComplete="email"
              value={email}
              onChange={onEmailChange}
            />
            <TextField
              id="s-pass"
              label="Senha"
              type="password"
              autoComplete="new-password"
              minLength={6}
              value={password}
              onChange={onPasswordChange}
            />
            <Button type="submit" className="w-full h-11 hover-lift" disabled={loading}>
              {loading && <Loader2 className="w-4 h-4 mr-2 animate-spin" />} Criar conta
            </Button>
            <p className="text-xs text-muted-foreground text-center">
              O primeiro usuário cadastrado vira administrador.
            </p>
          </form>
        </TabsContent>
      </Tabs>

      <div className="my-5 flex items-center gap-3">
        <div className="h-px bg-border flex-1" />
        <span className="text-[11px] uppercase tracking-wider text-muted-foreground">
          ou continue com
        </span>
        <div className="h-px bg-border flex-1" />
      </div>

      <Button variant="outline" className="w-full h-11" onClick={onGoogleClick} disabled={loading}>
        <GoogleLogo className="w-4 h-4 mr-2" />
        Continuar com Google
      </Button>

      <p className="mt-6 text-center text-[11px] text-muted-foreground">
        Ao continuar, você concorda com o uso operacional do sistema pelo CBMAM.
      </p>
    </>
  );
}

interface TextFieldProps {
  id: string;
  label: string;
  value: string;
  onChange: (v: string) => void;
  type?: string;
  autoComplete?: string;
  minLength?: number;
}

function TextField({ id, label, value, onChange, type, autoComplete, minLength }: TextFieldProps) {
  return (
    <div className="space-y-1.5">
      <Label htmlFor={id}>{label}</Label>
      <Input
        id={id}
        type={type}
        autoComplete={autoComplete}
        minLength={minLength}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        required
      />
    </div>
  );
}
