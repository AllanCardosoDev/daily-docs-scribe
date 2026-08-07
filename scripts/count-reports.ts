import { createClient } from "@supabase/supabase-js";

const supabase = createClient(
  "https://zeyxclvokbllixyezgoe.supabase.co",
  "sb_publishable_B608rXzlGxV4b0yk-6XaBw_riQTnj7y"
);

async function count() {
  await supabase.auth.signInWithPassword({
    email: "salacbmam@gmail.com",
    password: "9p&8jA_))rF$e6C",
  });

  const { count, error } = await supabase
    .from("daily_reports")
    .select("*", { count: "exact", head: true });

  console.log("Total de relatórios cadastrados no Supabase:", count);
}

count().catch(console.error);
