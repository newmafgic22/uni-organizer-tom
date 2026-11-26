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
  const [r, manuell, angemeldet] = await Promise.all([
    holeAlle(entschl, von, bis),
    ladeManuelleKlausuren(supabase, userId),
    ladeAngemeldetePruefungen(supabase, userId),
  ]);
  // Reihenfolge: Portal2-Kalender, dann Prüfungsanmeldungen aus Portal2 (Sync), dann von Hand eingetragene Termine
  const portal = r.termine.filter(istKlausur);
  const ausAnmeldung = angemeldet.filter((k) => k.start >= von && k.start < bis && !klausurFuer(k.titel.replace(/^Klausur /, ""), portal));
  const bekannt = [...portal, ...ausAnmeldung];
  const vonHand = manuell.filter((k) => k.start >= von && k.start < bis && !klausurFuer(k.titel, bekannt));
  const termine = [...r.termine, ...ausAnmeldung, ...vonHand].sort((a, b) => a.start.getTime() - b.start.getTime());
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

/** Prüfungsanmeldungen, die das Sync-Skript aus Portal2 gelesen hat (mit Uhrzeit, Raum und Prüfungsform). */
async function ladeAngemeldetePruefungen(supabase: SupabaseClient, userId?: string): Promise<Termin[]> {
  let q = supabase.from("pruefungen").select("nummer, titel, beginn, ende, raum, form").eq("angemeldet", true).not("beginn", "is", null);
  if (userId) q = q.eq("user_id", userId);
  const { data, error } = await q;
  if (error) return []; // Tabelle fehlt noch o. Ä.: ohne Anmeldungen weitermachen
  return ((data ?? []) as { nummer: string; titel: string; beginn: string; ende: string | null; raum: string | null; form: string | null }[]).map((p) => {
    const start = new Date(p.beginn);
    const titel = p.titel.replace(/^VL\s+/, "").replace(/\s+[A-Z]?\s*\(KL\)$/, "").trim();
    return {
      id: `pruefung-${p.nummer}`,
      titel: `Klausur ${titel}`,
      start,
      ende: p.ende ? new Date(p.ende) : new Date(start.getTime() + 90 * 60000),
      ganztags: false,
      ort: p.raum ?? undefined,
      beschreibung: p.form ? `Prüfungsform: ${p.form}` : undefined,
      kategorie: "Prüfung",
      quelle: "sonstig",
    };
  });
}
