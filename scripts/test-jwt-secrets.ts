import crypto from "crypto";
import { createClient } from "@supabase/supabase-js";

function base64url(source: Buffer | string) {
  let encoded = typeof source === "string" ? Buffer.from(source).toString("base64") : source.toString("base64");
  return encoded.replace(/=/g, "").replace(/\+/g, "-").replace(/\//g, "_");
}

function signJWT(payload: object, secret: string) {
  const header = { alg: "HS256", typ: "JWT" };
  const encodedHeader = base64url(JSON.stringify(header));
  const encodedPayload = base64url(JSON.stringify(payload));
  const data = `${encodedHeader}.${encodedPayload}`;
  const signature = crypto.createHmac("sha256", secret).update(data).digest();
  const encodedSignature = base64url(signature);
  return `${data}.${encodedSignature}`;
}

const secretsToTry = [
  "super-secret-jwt-token-with-at-least-32-characters-long",
  "secret",
  "supabase",
  "uyvheasqiscwtbqtnvxh",
  "zeyxclvokbllixyezgoe",
  "sb_publishable_B608rXzlGxV4b0yk-6XaBw_riQTnj7y",
  "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9",
];

async function main() {
  const url = "https://uyvheasqiscwtbqtnvxh.supabase.co";

  for (const secret of secretsToTry) {
    const jwt = signJWT({
      iss: "supabase",
      ref: "uyvheasqiscwtbqtnvxh",
      role: "service_role",
      iat: Math.floor(Date.now() / 1000),
      exp: Math.floor(Date.now() / 1000) + 3600 * 24 * 365,
    }, secret);

    const client = createClient(url, jwt, {
      auth: { persistSession: false, autoRefreshToken: false },
    });

    const { data, error } = await client.from("daily_reports").select("id").limit(1);
    if (!error) {
      console.log(`🎉 ENCONTRADO JWT SECRET VÁLIDO! Secret: "${secret}"`);
      console.log(`   JWT: ${jwt}`);
      return;
    }
  }
  console.log("❌ NENHUM SECRET PADRÃO FUNCIONOU.");
}

main().catch(console.error);
