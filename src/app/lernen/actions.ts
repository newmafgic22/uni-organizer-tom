"use server";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { requireUser } from "@/lib/supabase/server";
import { ladeTermine } from "@/lib/daten";
import { istKlausur } from "@/lib/ical";
import { klausurFuer } from "@/lib/lernen";
import { lohntThema, themaTitel, themenAnlegen } from "@/lib/einreihen";

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
  const klausurAm = await klausurDatum(supabase, kursname);
  const titel = themaTitel(m.dateiname);
  await supabase
    .from("lernthemen")
    .upsert(
      { user_id: user.id, material_id: m.id, course_id: m.course_id, titel, klausur_am: klausurAm },
      { onConflict: "user_id,material_id", ignoreDuplicates: true },
    );
  revalidatePath("/", "layout");
}

async function klausurDatum(supabase: Awaited<ReturnType<typeof requireUser>>["supabase"], kursname: string) {
  try {
    const jetzt = new Date();
    const { termine } = await ladeTermine(supabase, jetzt, new Date(jetzt.getTime() + 200 * 86400_000));
    return klausurFuer(kursname, termine.filter(istKlausur))?.start.toISOString() ?? null;
  } catch {
    return null; // ohne Klausurdatum geht es auch
  }
}

/** Alle Vorlesungen eines Kurses einreihen und neue Vorlesungen künftig automatisch einreihen. */
export async function alleEinreihen(form: FormData) {
  const { supabase, user } = await requireUser();
  if (!user) return;
  const kursId = String(form.get("kurs_id"));
  const { data: kurs } = await supabase.from("courses").select("id, name").eq("id", kursId).single();
  if (!kurs) return;
  const { data: mats } = await supabase.from("materials").select("id, course_id, dateiname, hat_text").eq("course_id", kursId).limit(1000);
  await themenAnlegen(supabase, user.id, (mats ?? []).filter(lohntThema), await klausurDatum(supabase, kurs.name));
  await supabase.from("courses").update({ auto_einreihen: true }).eq("id", kursId);
  revalidatePath("/", "layout");
}

export async function autoAus(form: FormData) {
  const { supabase } = await requireUser();
  await supabase.from("courses").update({ auto_einreihen: false }).eq("id", String(form.get("kurs_id")));
  revalidatePath("/", "layout");
}

export async function klausurInfoSpeichern(form: FormData) {
  const { supabase } = await requireUser();
  const info = String(form.get("klausur_info") ?? "").trim().slice(0, 4000);
  await supabase.from("courses").update({ klausur_info: info || null }).eq("id", String(form.get("kurs_id")));
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
