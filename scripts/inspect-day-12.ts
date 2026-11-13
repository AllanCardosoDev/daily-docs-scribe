import { createClient } from "@supabase/supabase-js";
import fs from "fs";
import path from "path";

const envPath = path.resolve(process.cwd(), ".env");
if (fs.existsSync(envPath)) {
  const content = fs.readFileSync(envPath, "utf-8");
  for (const line of content.split("\n")) {
    const match = line.match(/^\s*([\w.-]+)\s*=\s*(.*)?\s*$/);
    if (match) {
      let val = match[2] ? match[2].trim() : "";
      if (val.startsWith('"') && val.endsWith('"')) val = val.slice(1, -1);
      process.env[match[1]] = val;
    }
  }
}

const SUPABASE_URL = process.env.SUPABASE_URL || "https://zeyxclvokbllixyezgoe.supabase.co";
const SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

const adminClient = createClient(SUPABASE_URL, SERVICE_KEY!, {
  auth: { persistSession: false, autoRefreshToken: false },
});

async function main() {
  const { data: row } = await adminClient
    .from("daily_reports")
    .select("report_date, shift, efetivo")
    .eq("report_date", "2026-11-12")
    .eq("shift", "noturno")
    .single();

  console.log("Date:", row?.report_date);
  console.log("Total items in efetivo:", row?.efetivo?.length);
  for (const item of (row?.efetivo || []).slice(0, 10)) {
    console.log(item);
  }
}

main();
