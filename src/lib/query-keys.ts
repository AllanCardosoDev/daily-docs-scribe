/**
 * Centralised React Query keys.
 * Using a single source avoids typo-drift between fetch sites and invalidations.
 */
export const queryKeys = {
  appConfig: ["app-config"] as const,
  sheetsData: ["sheets-data"] as const,
  authEmail: ["auth-email"] as const,
};
