"use server";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { requireUser } from "@/lib/supabase/server";
import { ladeTermine } from "@/lib/daten";
import { istKlausur } from "@/lib/ical";
import { klausurFuer } from "@/lib/lernen";

export async function themaAnlegen(form: FormData) {
  const { supabase, user } = await requireUser();
  if (!user) return;
  const materialId = String(form.get("material_id"));
  const { data: m } = await supabase
    .from("materials")
    .select("id, course_id, dateiname, courses(name)")
    .eq("id", materialId)
    .single();
  if (!m) return;
  const kursname = (m.courses as unknown as { name: string } | null)?.name ?? "";
  let klausurAm: string | null = null;
  try {
    const jetzt = new Date();
    const { termine } = await ladeTermine(supabase, jetzt, new Date(jetzt.getTime() + 200 * 86400_000));
    klausurAm = klausurFuer(kursname, termine.filter(istKlausur))?.start.toISOString() ?? null;
  } catch {
    // ohne Klausurdatum geht es auch
  }
  const titel = m.dateiname.replace(/\.[a-z0-9]+$/i, "").replace(/ \(Lernmodul\)$/, "").replace(/_/g, " ");
  await supabase
    .from("lernthemen")
    .upsert(
      { user_id: user.id, material_id: m.id, course_id: m.course_id, titel, klausur_am: klausurAm },
      { onConflict: "user_id,material_id", ignoreDuplicates: true },
    );
  revalidatePath("/", "layout");
}

export async function sofortBearbeiten(form: FormData) {
  const { supabase } = await requireUser();
  const { count } = await supabase.from("lernthemen").select("id", { count: "exact", head: true }).eq("sofort", true).eq("status", "wartet");
  if ((count ?? 0) >= 2) redirect("/lernen?hinweis=sofort-voll");
  await supabase.from("lernthemen").update({ sofort: true }).eq("id", String(form.get("id"))).eq("status", "wartet");
  revalidatePath("/lernen");
}

export async function nochmal(form: FormData) {
  const { supabase } = await requireUser();
  await supabase.from("lernthemen").update({ status: "wartet", versuche: 0, fehler: null }).eq("id", String(form.get("id")));
  revalidatePath("/lernen");
}

export async function themaLoeschen(form: FormData) {
  const { supabase } = await requireUser();
  await supabase.from("lernthemen").delete().eq("id", String(form.get("id")));
  revalidatePath("/", "layout");
  redirect("/lernen");
}

export async function antwortSpeichern(themaId: string, art: "katalog" | "aufgabe", nr: number, afb: number, bewertung: string) {
  const { supabase, user } = await requireUser();
  if (!user || !["richtig", "teilweise", "falsch"].includes(bewertung)) return;
  await supabase.from("antworten").insert({ user_id: user.id, thema_id: themaId, art, nr, afb, bewertung });
}
