/**
 * Resolução da configuração de backend (Supabase) usada pelo navegador.
 *
 * Prioridade:
 *  1. Projeto Supabase PRÓPRIO do cliente  -> VITE_CUSTOM_SUPABASE_URL / VITE_CUSTOM_SUPABASE_PUBLISHABLE_KEY
 *  2. Backend gerenciado padrão            -> VITE_SUPABASE_URL / VITE_SUPABASE_PUBLISHABLE_KEY
 *
 * Basta definir as variáveis VITE_CUSTOM_* para apontar todo o app
 * (auth, banco, RLS, histórico) para o projeto do próprio cliente.
 */

import { OWN_PROJECT_PUBLISHABLE_KEY, OWN_PROJECT_URL } from "./own-project";

export type BackendMode = "custom" | "managed";

export interface BackendConfig {
  url: string;
  publishableKey: string;
  mode: BackendMode;
}

function firstNonEmpty(...values: Array<string | undefined>): string | undefined {
  for (const value of values) {
    if (typeof value === "string" && value.trim().length > 0) return value.trim();
  }
  return undefined;
}

/**
 * Projeto Supabase próprio do CBMAM (chave publicável — segura no navegador).
 * Usado como padrão caso as variáveis VITE_CUSTOM_* não estejam definidas.
 */

export function resolveBackendConfig(): BackendConfig {
  const env = import.meta.env as Record<string, string | undefined>;

  const customUrl = firstNonEmpty(env.VITE_CUSTOM_SUPABASE_URL, OWN_PROJECT_URL);
  const customKey = firstNonEmpty(
    env.VITE_CUSTOM_SUPABASE_PUBLISHABLE_KEY,
    OWN_PROJECT_PUBLISHABLE_KEY,
  );

  if (customUrl && customKey) {
    return { url: customUrl, publishableKey: customKey, mode: "custom" };
  }

  const url = firstNonEmpty(env.VITE_SUPABASE_URL);
  const publishableKey = firstNonEmpty(env.VITE_SUPABASE_PUBLISHABLE_KEY);

  if (!url || !publishableKey) {
    const missing = [!url && "URL", !publishableKey && "chave pública"].filter(Boolean).join(" e ");
    throw new Error(
      `Configuração de backend ausente (${missing}). Defina VITE_CUSTOM_SUPABASE_URL e VITE_CUSTOM_SUPABASE_PUBLISHABLE_KEY para usar seu próprio projeto Supabase.`,
    );
  }

  return { url, publishableKey, mode: "managed" };
}

/** Indica se o app está apontando para um projeto Supabase próprio do cliente. */
export function isCustomBackend(): boolean {
  try {
    return resolveBackendConfig().mode === "custom";
  } catch {
    return false;
  }
}
