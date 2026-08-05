/**
 * Server-side error handling.
 *
 * Raw PostgREST/Postgres errors expose schema names, policy names and internal
 * SQL details. They are logged on the server and replaced by a safe, generic
 * message before crossing the RPC boundary to the browser.
 */

type DbError = { message?: string; code?: string; details?: string } | null | undefined;

/**
 * Log the real database error and throw a user-safe one.
 *
 * @param error   the error returned by supabase-js
 * @param context short label used only in server logs (never sent to client)
 * @param userMessage message shown to the user
 */
export function dbFail(
  error: DbError,
  context: string,
  userMessage = "Não foi possível concluir a operação. Tente novamente.",
): never {
  console.error(`[db:${context}]`, {
    code: error?.code,
    message: error?.message,
    details: error?.details,
  });

  // Permission errors get a clearer, still non-revealing message.
  if (error?.code === "42501" || error?.message?.toLowerCase().includes("row-level security")) {
    throw new Error("Você não tem permissão para executar esta ação.");
  }

  throw new Error(userMessage);
}
