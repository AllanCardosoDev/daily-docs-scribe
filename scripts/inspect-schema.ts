import { createClient } from "@supabase/supabase-js";

const supabase = createClient(
  "https://zeyxclvokbllixyezgoe.supabase.co",
  "sb_publishable_B608rXzlGxV4b0yk-6XaBw_riQTnj7y"
);

async function inspect() {
  await supabase.auth.signInWithPassword({
    email: "salacbmam@gmail.com",
    password: "9p&8jA_))rF$e6C",
  });

  const { data, error } = await supabase
    .from("daily_reports")
    .select("*")
    .limit(1);

  if (error) {
    console.error("Error:", error);
  } else if (data && data.length > 0) {
    console.log("Colunas existentes em daily_reports:", Object.keys(data[0]));
  }
}

inspect().catch(console.error);
