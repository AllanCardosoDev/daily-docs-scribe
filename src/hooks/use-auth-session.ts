import { useCallback } from "react";
import { useNavigate } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/backend/client";
import { queryKeys } from "@/lib/query-keys";

/**
 * Reads the current user's email from the local Supabase session (no network).
 * Cached indefinitely — invalidated by the sign-out helper.
 */
export function useAuthEmail() {
  return useQuery({
    queryKey: queryKeys.authEmail,
    queryFn: async () => (await supabase.auth.getSession()).data.session?.user.email ?? "",
    staleTime: Infinity,
  });
}

/**
 * Sign-out helper following the documented four-step hygiene:
 * cancel in-flight queries → clear cache → sign out → replace history.
 */
export function useSignOut() {
  const navigate = useNavigate();
  const queryClient = useQueryClient();

  return useCallback(async () => {
    await queryClient.cancelQueries();
    queryClient.clear();
    await supabase.auth.signOut();
    navigate({ to: "/auth", replace: true });
  }, [navigate, queryClient]);
}
