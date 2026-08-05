import { useEffect, useState } from "react";
import { ArrowUp } from "lucide-react";
import { cn } from "@/lib/utils";

/** Floating "back to top" button — appears after the user scrolls past ~40vh. */
export function ScrollToTop() {
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    const onScroll = () => setVisible(window.scrollY > window.innerHeight * 0.4);
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  return (
    <button
      type="button"
      onClick={() => window.scrollTo({ top: 0, behavior: "smooth" })}
      aria-label="Voltar ao topo"
      className={cn(
        "fixed bottom-5 right-5 z-40 h-11 w-11 rounded-full",
        "bg-gradient-brand text-white shadow-elevated ring-1 ring-white/20",
        "grid place-items-center transition-all duration-300 ease-out",
        "hover:scale-105 active:scale-95",
        visible
          ? "opacity-100 translate-y-0 pointer-events-auto"
          : "opacity-0 translate-y-3 pointer-events-none",
      )}
    >
      <ArrowUp className="w-5 h-5" aria-hidden="true" />
    </button>
  );
}
