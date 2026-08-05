/**
 * Configuração de backend do lado do servidor (server functions / SSR).
 *
 * Prioridade:
 *  1. Projeto Supabase PRÓPRIO -> CUSTOM_SUPABASE_URL / CUSTOM_SUPABASE_PUBLISHABLE_KEY
 *  2. Backend gerenciado       -> SUPABASE_URL / SUPABASE_PUBLISHABLE_KEY
 *
 * Deve ser lido SEMPRE dentro de handlers/middleware (nunca em escopo de módulo).
 */

import { OWN_PROJECT_PUBLISHABLE_KEY, OWN_PROJECT_URL } from "./own-project";

export interface ServerBackendConfig {
  url: string;
  publishableKey: string;
  mode: "custom" | "managed";
}

function firstNonEmpty(...values: Array<string | undefined>): string | undefined {
  for (const value of values) {
    if (typeof value === "string" && value.trim().length > 0) return value.trim();
  }
  return undefined;
}

export function resolveServerBackendConfig(): ServerBackendConfig {
  // Ordem de prioridade: variáveis de servidor -> variáveis VITE_* -> projeto
  // oficial do CBMAM embutido no código. Nunca lança erro: qualquer hospedagem
  // (Vercel, preview, self-host) aponta para o mesmo banco mesmo sem env vars.
  const url = firstNonEmpty(
    process.env.CUSTOM_SUPABASE_URL,
    process.env.VITE_CUSTOM_SUPABASE_URL,
    OWN_PROJECT_URL,
    process.env.SUPABASE_URL,
  );
  const publishableKey = firstNonEmpty(
    process.env.CUSTOM_SUPABASE_PUBLISHABLE_KEY,
    process.env.VITE_CUSTOM_SUPABASE_PUBLISHABLE_KEY,
    OWN_PROJECT_PUBLISHABLE_KEY,
    process.env.SUPABASE_PUBLISHABLE_KEY,
  );

  if (!url || !publishableKey) {
    throw new Error(
      "Configuração de backend ausente no servidor. Defina CUSTOM_SUPABASE_URL e CUSTOM_SUPABASE_PUBLISHABLE_KEY.",
    );
  }

  const usingOwnProject = url === OWN_PROJECT_URL || !!process.env.CUSTOM_SUPABASE_URL;
  return { url, publishableKey, mode: usingOwnProject ? "custom" : "managed" };
}
