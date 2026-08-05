/** Shimmering skeleton shown while the initial dashboard payload loads. */
export function DashboardSkeleton() {
  return (
    <div className="space-y-6 animate-fade-in-soft" aria-busy="true" aria-live="polite">
      {/* Toolbar */}
      <div className="h-24 rounded-2xl animate-shimmer" />

      {/* KPIs */}
      <div className="grid grid-cols-1 xs:grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
        {Array.from({ length: 4 }).map((_, i) => (
          <div
            key={i}
            className="h-24 rounded-xl animate-shimmer"
            style={{ animationDelay: `${i * 80}ms` }}
          />
        ))}
      </div>

      {/* Header card */}
      <div className="h-56 rounded-xl animate-shimmer" />

      {/* Tables */}
      <div className="flex flex-col gap-6">
        {Array.from({ length: 4 }).map((_, i) => (
          <div
            key={i}
            className="h-64 rounded-xl animate-shimmer"
            style={{ animationDelay: `${i * 100}ms` }}
          />
        ))}
      </div>
      <div className="sr-only">Carregando dados do painel…</div>
    </div>
  );
}
