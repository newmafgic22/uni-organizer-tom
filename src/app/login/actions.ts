"use server";
import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { createClient as createPlainClient } from "@supabase/supabase-js";
import { timingSafeEqual } from "crypto";
import { createAdminClient, createClient } from "@/lib/supabase/server";
import { isAllowedEmail } from "@/lib/allowed";

export async function sendeLink(form: FormData) {
  const email = String(form.get("email") ?? "").trim();
  // Fremde E-Mails bekommen dieselbe Antwort, damit man nicht raten kann, wer Zugang hat.
  if (!isAllowedEmail(email)) redirect("/login?status=gesendet");
  const h = await headers();
  const origin = h.get("origin") ?? `https://${h.get("host")}`;
  // "implicit": der Link traegt die Sitzung selbst und funktioniert daher in jedem Browser
  // und auf jedem Geraet (PKCE ginge nur im Browser, der den Link angefordert hat).
  const supabase = createPlainClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!, {
    auth: { flowType: "implicit", persistSession: false, autoRefreshToken: false },
  });
  const { error } = await supabase.auth.signInWithOtp({
    email,
    options: { emailRedirectTo: `${origin}/auth/callback` },
  });
  if (error) {
    console.error("signInWithOtp:", error.status, error.message);
    redirect(`/login?status=${error.status === 429 ? "limit" : "fehler"}`);
  }
  redirect("/login?status=gesendet");
}

function gleich(a: string, b: string) {
  const x = Buffer.from(a);
  const y = Buffer.from(b);
  return x.length === y.length && timingSafeEqual(x, y);
}

/** Login mit eigenem Passwort (APP_PASSWORT bei Vercel), ohne Mail und ohne Mail-Limit. */
export async function passwortLogin(form: FormData) {
  const email = String(form.get("email") ?? "").trim().toLowerCase();
  const passwort = String(form.get("passwort") ?? "");
  const soll = process.env.APP_PASSWORT ?? "";
  if (soll.length < 8 || !isAllowedEmail(email) || !gleich(passwort, soll)) {
    await new Promise((r) => setTimeout(r, 1000)); // bremst Raten
    redirect("/login?modus=passwort&status=falsch");
  }
  const admin = createAdminClient();
  const { data, error } = await admin.auth.admin.generateLink({ type: "magiclink", email });
  if (error || !data.properties?.hashed_token) {
    console.error("generateLink:", error?.status, error?.message);
    redirect("/login?modus=passwort&status=fehler");
  }
  const supabase = await createClient();
  const v = await supabase.auth.verifyOtp({ token_hash: data.properties.hashed_token, type: "magiclink" });
  if (v.error) {
    console.error("verifyOtp:", v.error.status, v.error.message);
    redirect("/login?modus=passwort&status=fehler");
  }
  redirect("/");
}

export async function abmelden() {
  const supabase = await createClient();
  await supabase.auth.signOut();
  redirect("/login");
}
