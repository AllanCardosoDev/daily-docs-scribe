/**
 * Cliente Supabase do navegador com suporte a backend próprio.
 *
 * Todo o app importa daqui (`@/integrations/backend/client`) em vez do
 * cliente gerado, para que a troca de projeto Supabase seja feita apenas
 * por variáveis de ambiente, sem alterar código.
 */
import { createClient } from "@supabase/supabase-js";
import type { Database } from "@/integrations/supabase/types";
import { resolveBackendConfig } from "./config";

function isOpaqueApiKey(value: string): boolean {
  return value.startsWith("sb_publishable_") || value.startsWith("sb_secret_");
}

function createBackendFetch(apiKey: string): typeof fetch {
  return (input, init) => {
    const headers = new Headers(
      typeof Request !== "undefined" && input instanceof Request ? input.headers : undefined,
    );

    if (init?.headers) {
      new Headers(init.headers).forEach((value, key) => headers.set(key, value));
    }

    // Chaves novas do Supabase são opacas (não são JWT bearer).
    if (isOpaqueApiKey(apiKey) && headers.get("Authorization") === `Bearer ${apiKey}`) {
      headers.delete("Authorization");
    }

    headers.set("apikey", apiKey);
    return fetch(input, { ...init, headers });
  };
}

function createBackendClient() {
  const { url, publishableKey } = resolveBackendConfig();

  return createClient<Database>(url, publishableKey, {
    global: { fetch: createBackendFetch(publishableKey) },
    auth: {
      storage: typeof window !== "undefined" ? localStorage : undefined,
      persistSession: true,
      autoRefreshToken: true,
    },
  });
}

let _client: ReturnType<typeof createBackendClient> | undefined;

export const supabase = new Proxy({} as ReturnType<typeof createBackendClient>, {
  get(_, prop, receiver) {
    if (!_client) _client = createBackendClient();
    return Reflect.get(_client, prop, receiver);
  },
});
