import { decrypt } from "@/lib/crypto";
import { holeAlle, istKlausur, type Quelle, type Termin } from "@/lib/ical";
import { klausurFuer } from "@/lib/lernen";
import { tagStart, plusTage } from "@/lib/zeit";
import type { SupabaseClient } from "@supabase/supabase-js";

export type QuelleZeile = { id: string; name: string; kind: Quelle; url_encrypted: string };

export async function ladeQuellen(supabase: SupabaseClient, userId?: string) {
  let q = supabase.from("calendar_sources").select("id,name,kind,url_encrypted").order("created_at");
  if (userId) q = q.eq("user_id", userId);
  const { data, error } = await q;
  if (error) throw new Error(error.message);
  return (data ?? []) as QuelleZeile[];
}

export async function ladeTermine(supabase: SupabaseClient, von: Date, bis: Date, userId?: string) {
  const quellen = await ladeQuellen(supabase, userId);
  const entschl = quellen.map((q) => ({ name: q.name, kind: q.kind, url: decrypt(q.url_encrypted) }));
  const [r, manuell] = await Promise.all([holeAlle(entschl, von, bis), ladeManuelleKlausuren(supabase, userId)]);
  // Von Hand eingetragene Klausuren nur, wenn Portal2 für den Kurs keinen Termin liefert
  const portal = r.termine.filter(istKlausur);
  const extra = manuell.filter((k) => k.start >= von && k.start < bis && !klausurFuer(k.titel, portal));
  const termine = [...r.termine, ...extra].sort((a, b) => a.start.getTime() - b.start.getTime());
  return { ...r, termine, anzahlQuellen: quellen.length };
}

async function ladeManuelleKlausuren(supabase: SupabaseClient, userId?: string): Promise<Termin[]> {
  let q = supabase.from("courses").select("name, klausur_datum").not("klausur_datum", "is", null);
  if (userId) q = q.eq("user_id", userId);
  const { data } = await q;
  const gesehen = new Set<string>();
  const out: Termin[] = [];
  for (const k of (data ?? []) as { name: string; klausur_datum: string }[]) {
    const titel = k.name.replace(/\s*[\[(].*$/, "").trim();
    if (gesehen.has(titel + k.klausur_datum)) continue; // V und Übungsgruppe teilen sich die Klausur
    gesehen.add(titel + k.klausur_datum);
    out.push({
      id: `klausur-${titel}-${k.klausur_datum}`,
      titel: `Klausur ${titel}`,
      start: tagStart(k.klausur_datum),
      ende: tagStart(plusTage(k.klausur_datum, 1)),
      ganztags: true,
      kategorie: "Prüfung",
      quelle: "sonstig",
    });
  }
  return out;
}
