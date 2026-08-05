import { createMiddleware } from "@tanstack/react-start";
import { supabase } from "./client";

/**
 * Anexa o token do usuário às chamadas de server functions, usando o mesmo
 * cliente (backend gerenciado ou projeto Supabase próprio).
 */
export const attachBackendAuth = createMiddleware({ type: "function" }).client(async ({ next }) => {
  const { data } = await supabase.auth.getSession();
  const token = data.session?.access_token;
  return next({
    headers: token ? { Authorization: `Bearer ${token}` } : {},
  });
});
