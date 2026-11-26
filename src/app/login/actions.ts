"use server";
import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { isAllowedEmail } from "@/lib/allowed";

export async function sendeLink(form: FormData) {
  const email = String(form.get("email") ?? "").trim();
  // Fremde E-Mails bekommen dieselbe Antwort, damit man nicht raten kann, wer Zugang hat.
  if (!isAllowedEmail(email)) redirect("/login?status=gesendet");
  const h = await headers();
  const origin = h.get("origin") ?? `https://${h.get("host")}`;
  const supabase = await createClient();
  const { error } = await supabase.auth.signInWithOtp({
    email,
    options: { emailRedirectTo: `${origin}/auth/callback` },
  });
  redirect(error ? "/login?status=fehler" : "/login?status=gesendet");
}

export async function abmelden() {
  const supabase = await createClient();
  await supabase.auth.signOut();
  redirect("/login");
}
