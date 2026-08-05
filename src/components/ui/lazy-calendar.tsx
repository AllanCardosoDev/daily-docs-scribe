import { Suspense, lazy, type ComponentProps } from "react";
import type { Calendar as CalendarType } from "./calendar";

/**
 * Calendário carregado sob demanda.
 *
 * `react-day-picker` pesa ~135 kB e só é necessário quando o usuário abre o
 * seletor de data. Mantê-lo fora do pacote da rota reduz o JavaScript inicial
 * do painel e acelera o primeiro carregamento.
 */
const CalendarLazy = lazy(() => import("./calendar").then((m) => ({ default: m.Calendar })));

type CalendarProps = ComponentProps<typeof CalendarType>;

export function LazyCalendar(props: CalendarProps) {
  return (
    <Suspense
      fallback={
        <div
          aria-hidden="true"
          className="h-[19rem] w-[17.5rem] animate-pulse rounded-md bg-muted/50 p-3"
        />
      }
    >
      <CalendarLazy {...props} />
    </Suspense>
  );
}
