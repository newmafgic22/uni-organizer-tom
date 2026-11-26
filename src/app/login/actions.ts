"use server";
import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { createClient as createPlainClient } from "@supabase/supabase-js";
import { createClient } from "@/lib/supabase/server";
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

export async function abmelden() {
  const supabase = await createClient();
  await supabase.auth.signOut();
  redirect("/login");
}
