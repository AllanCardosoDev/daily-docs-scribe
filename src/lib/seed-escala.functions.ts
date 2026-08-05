import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { supabaseAdmin } from "@/integrations/supabase/client.server";

export const seedEscala = createServerFn({ method: "POST" }).handler(async () => {
  const operators = [
    { rank: "SD", name: "ALLAN ARAUJO", phone: "61 98265-3309", active: true },
    { rank: "SGT", name: "LUCICLÉIA", phone: "98241-6163", active: true },
    { rank: "SD", name: "AELTON", phone: "993373591", active: true },
    { rank: "SGT", name: "FABRINA", phone: "99393-4584", active: true },
    { rank: "SGT", name: "ANA MARIA", phone: "99277-9045", active: true },
    { rank: "SGT", name: "SIMONE", phone: "984259853", active: true },
    { rank: "SGT", name: "AMANNDA", phone: "991127092", active: true },
    { rank: "SGT", name: "PASSOS", phone: "981851795", active: true },
    { rank: "SGT", name: "LAGO", phone: "994970872", active: true },
  ];

  const opMap: Record<string, string> = {};
  for (const op of operators) {
    const { data, error } = await supabaseAdmin
      .from("escala_operators")
      .upsert(op, { onConflict: "name" })
      .select("id")
      .single();

    if (error) {
      console.error(`Error upserting operator ${op.name}:`, error.message);
    } else if (data) {
      opMap[op.name] = data.id;
    }
  }

  const shiftsData: [string, string][] = [
    ["2026-06-29", "ALLAN ARAUJO"],
    ["2026-06-30", "LUCICLÉIA"],
    ["2026-07-01", "AELTON"],
    ["2026-07-02", "FABRINA"],
    ["2026-07-03", "ANA MARIA"],
    ["2026-07-04", "ANA MARIA"],
    ["2026-07-05", "ALLAN ARAUJO"],
    ["2026-07-06", "SIMONE"],
    ["2026-07-07", "AMANNDA"],
    ["2026-07-08", "AELTON"],
    ["2026-07-09", "PASSOS"],
    ["2026-07-10", "ALLAN ARAUJO"],
    ["2026-07-11", "ANA MARIA"],
    ["2026-07-12", "AELTON"],
    ["2026-07-13", "AMANNDA"],
    ["2026-07-14", "SIMONE"],
    ["2026-07-15", "FABRINA"],
    ["2026-07-16", "AMANNDA"],
    ["2026-07-17", "PASSOS"],
    ["2026-07-18", "FABRINA"],
    ["2026-07-19", "ANA MARIA"],
    ["2026-07-20", "ALLAN ARAUJO"],
    ["2026-07-21", "FABRINA"],
    ["2026-07-22", "AELTON"],
    ["2026-07-23", "PASSOS"],
    ["2026-07-24", "AMANNDA"],
    ["2026-07-25", "ANA MARIA"],
    ["2026-07-26", "ALLAN ARAUJO"],
    ["2026-07-27", "AMANNDA"],
    ["2026-07-28", "FABRINA"],
    ["2026-07-29", "ALLAN ARAUJO"],
    ["2026-07-30", "AMANNDA"],
    ["2026-07-31", "ALLAN ARAUJO"],
    ["2026-08-01", "FABRINA"],
    ["2026-08-02", "ALLAN ARAUJO"],
    ["2026-08-03", "ALLAN ARAUJO"],
    ["2026-08-04", "LAGO"],
    ["2026-08-05", "LUCICLÉIA"],
    ["2026-08-06", "FABRINA"],
    ["2026-08-07", "LUCICLÉIA"],
    ["2026-08-08", "LAGO"],
    ["2026-08-09", "LUCICLÉIA"],
  ];

  for (const [dateStr, name] of shiftsData) {
    if (opMap[name]) {
      const date = new Date(dateStr + "T12:00:00");
      const isWeekend = date.getDay() === 0 || date.getDay() === 6;
      const start = isWeekend ? "07:00:00" : "14:00:00";
      const end = "19:00:00";

      await supabaseAdmin.from("escala_shifts").upsert(
        {
          shift_date: dateStr,
          start_time: start,
          end_time: end,
          operator_id: opMap[name],
        },
        { onConflict: "shift_date,start_time" },
      );
    }
  }
  return { success: true };
});
