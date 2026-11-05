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
 * Reads the current user's display name and rank from the profiles table.
 */
export function useAuthProfile() {
  return useQuery({
    queryKey: ["authProfileDetails"],
    queryFn: async () => {
      const session = (await supabase.auth.getSession()).data.session;
      const user = session?.user;
      if (!user) return null;
      const { data: prof } = await supabase
        .from("profiles")
        .select("display_name, sinesp_rank, sinesp_full_name, email")
        .eq("id", user.id)
        .maybeSingle();
      return {
        email: user.email ?? "",
        displayName:
          prof?.display_name ||
          (prof?.sinesp_rank && prof?.sinesp_full_name
            ? `${prof.sinesp_rank} ${prof.sinesp_full_name}`
            : "") ||
          user.user_metadata?.display_name ||
          user.user_metadata?.full_name ||
          user.email ||
          "Usuário",
      };
    },
    staleTime: 5 * 60 * 1000,
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
