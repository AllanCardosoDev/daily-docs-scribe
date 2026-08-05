import amazonForest from "@/assets/amazon-forest.webp";

const STATS = [
  { k: "24/7", v: "Monitoramento" },
  { k: "62", v: "Municípios" },
  { k: "100%", v: "Auditável" },
] as const;

/** Left-side brand panel shown on the auth screen (desktop only). */
export function AuthBrandSide() {
  return (
    <aside className="relative hidden lg:flex flex-col justify-between p-10 xl:p-14 text-white bg-gradient-brand overflow-hidden">
      <img
        src={amazonForest}
        alt="Floresta amazônica vista do alto ao amanhecer"
        width={820}
        height={1230}
        loading="eager"
        fetchPriority="high"
        decoding="async"
        className="pointer-events-none absolute inset-0 w-full h-full object-cover"
      />
      <div
        aria-hidden="true"
        className="pointer-events-none absolute inset-0 bg-gradient-brand opacity-45 mix-blend-multiply"
      />
      <div
        aria-hidden="true"
        className="pointer-events-none absolute inset-0 bg-gradient-to-t from-black/70 via-black/25 to-transparent"
      />
      <div
        aria-hidden="true"
        className="pointer-events-none absolute inset-0 opacity-15"
        style={{
          backgroundImage:
            "radial-gradient(circle at 15% 15%, white 0, transparent 35%), radial-gradient(circle at 85% 85%, white 0, transparent 40%)",
        }}
      />
      <div
        aria-hidden="true"
        className="pointer-events-none absolute -bottom-24 -left-24 w-96 h-96 rounded-full border border-white/10"
      />
      <div
        aria-hidden="true"
        className="pointer-events-none absolute -top-32 -right-32 w-[28rem] h-[28rem] rounded-full border border-white/10"
      />

      <div className="relative flex items-center gap-2 text-[11px] uppercase tracking-[0.14em] font-semibold text-white/70">
        <span className="w-10 h-10 rounded-lg bg-white/10 border border-white/20 grid place-items-center">
          <img
            src="/icone-cbmam.png"
            alt="Brasão do Corpo de Bombeiros Militar do Amazonas"
            width={32}
            height={32}
            className="w-8 h-8 object-contain"
          />
        </span>
        CBMAM
      </div>

      <div className="relative space-y-4 max-w-md">
        <div className="inline-flex items-center gap-2 rounded-full bg-white/10 border border-white/15 px-3 py-1 text-[11px] uppercase tracking-wider">
          <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
          Operação Amazonas + Verde
        </div>
        <h2 className="font-display text-3xl xl:text-4xl font-bold tracking-tight leading-tight">
          Comando integrado para o combate a incêndios florestais.
        </h2>
        <p className="text-sm xl:text-base text-white/75 leading-relaxed">
          Painel operacional diário do Corpo de Bombeiros Militar do Amazonas — efetivo, recursos,
          incêndios e ocorrências em tempo real.
        </p>
      </div>

      <div className="relative grid grid-cols-3 gap-4 max-w-md">
        {STATS.map((s) => (
          <div
            key={s.v}
            className="rounded-xl border border-white/10 bg-white/5 backdrop-blur-sm p-3"
          >
            <div className="font-display text-xl font-bold">{s.k}</div>
            <div className="text-[11px] uppercase tracking-wider text-white/60">{s.v}</div>
          </div>
        ))}
      </div>
    </aside>
  );
}
