"use server";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { isAllowedEmail } from "@/lib/allowed";

export async function sendeCode(form: FormData) {
  const email = String(form.get("email") ?? "").trim();
  const ziel = `/login?schritt=code&email=${encodeURIComponent(email)}`;
  // Fremde E-Mails bekommen dieselbe Antwort, damit man nicht raten kann, wer Zugang hat.
  if (!isAllowedEmail(email)) redirect(ziel);
  const supabase = await createClient();
  const { error } = await supabase.auth.signInWithOtp({ email, options: { shouldCreateUser: true } });
  if (error) {
    console.error("signInWithOtp:", error.status, error.message);
    const grund = error.status === 429 ? "limit" : "fehler";
    redirect(`/login?status=${grund}&email=${encodeURIComponent(email)}`);
  }
  redirect(ziel);
}

export async function pruefeCode(form: FormData) {
  const email = String(form.get("email") ?? "").trim();
  const token = String(form.get("code") ?? "").replace(/\s/g, "");
  if (!isAllowedEmail(email)) redirect(`/login?schritt=code&status=falsch&email=${encodeURIComponent(email)}`);
  const supabase = await createClient();
  const { error } = await supabase.auth.verifyOtp({ email, token, type: "email" });
  if (error) {
    console.error("verifyOtp:", error.status, error.message);
    redirect(`/login?schritt=code&status=falsch&email=${encodeURIComponent(email)}`);
  }
  redirect("/");
}

export async function abmelden() {
  const supabase = await createClient();
  await supabase.auth.signOut();
  redirect("/login");
}
