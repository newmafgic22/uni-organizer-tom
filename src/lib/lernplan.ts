// Lernplan bis zur Klausur: verteilt die Themen eines Kurses auf die Tage vor der Klausur
// und legt Lernblöcke in freie Zeitfenster (keine Überschneidung mit Vorlesungen/Terminen).
// Die letzten 2 Tage vor jeder Klausur sind Gesamtwiederholung. Rein berechnet, nichts gespeichert.
import { istKlausur, type Termin } from "@/lib/ical";
import { anzeigeName, klausurFuer, kurzTitel } from "@/lib/lernen";
import { natSort } from "@/lib/material";
import { ladeWiederholen, type Status } from "@/lib/wiederholen";
import { plusTage, tagKey, tagStart } from "@/lib/zeit";

export type PlanKurs = { id: string; name: string; klausur: Date; themen: { id: string; titel: string }[] };

const BLOCK_MIN = 90;
const FENSTER = [10, 22]; // Lernblöcke zwischen 10 und 22 Uhr (Berlin)
const MAX_BLOCKS_TAG = 3;

const kurz = (name: string) => anzeigeName(name);

export function baueLernplan(kurse: PlanKurs[], belegt: Termin[], jetzt = new Date(), app = ""): Termin[] {
  const heute = tagKey(jetzt);
  const plan: Termin[] = [];
  const belegtAlle = [...belegt.filter((t) => !t.ganztags)];
  // An Klausurtagen wird nichts anderes eingeplant
  const klausurTage = new Set(kurse.map((k) => tagKey(k.klausur)));
  // Kurse mit der nächsten Klausur zuerst einplanen, damit sie die besten Zeiten bekommen
  for (const k of [...kurse].sort((a, b) => a.klausur.getTime() - b.klausur.getTime())) {
    const klausurTag = tagKey(k.klausur);
    const tage: string[] = [];
    for (let d = heute; d < klausurTag; d = plusTage(d, 1)) if (!klausurTage.has(d)) tage.push(d);
    if (!tage.length) continue;
    const wdhTage = tage.length > 4 ? tage.slice(-2) : tage.slice(-1);
    const lernTage = tage.slice(0, tage.length - wdhTage.length);
    // Themen gleichmäßig über die Lerntage verteilen; an Tagen ohne neues Thema kurz wiederholen
    const proTagListe = new Map<string, PlanKurs["themen"]>();
    k.themen.forEach((t, j) => {
      const tag = lernTage[Math.floor((j * lernTage.length) / Math.max(k.themen.length, 1))] ?? lernTage[lernTage.length - 1];
      if (!tag) return;
      if (!proTagListe.has(tag)) proTagListe.set(tag, []);
      proTagListe.get(tag)!.push(t);
    });
    const tagesPlan: { tag: string; titel: string; beschreibung: string; dauer: number }[] = [];
    for (const tag of lernTage) {
      const teil = proTagListe.get(tag);
      if (teil?.length) {
        tagesPlan.push({
          tag,
          titel: `📚 ${kurz(k.name)}: ${teil.map((t) => kurzTitel(t.titel)).join(" + ")}`,
          beschreibung: `Zusammenfassung lesen, dann Abfragekatalog.\n${teil.map((t) => `${app}/lernen/${t.id}`).join("\n")}\nDanach: ${app}/lernen/wiederholen`,
          dauer: BLOCK_MIN * Math.min(teil.length, 2),
        });
      } else {
        tagesPlan.push({
          tag,
          titel: `🔁 ${kurz(k.name)}: fällige Fragen wiederholen`,
          beschreibung: `${app}/lernen/wiederholen?kurs=${k.id}`,
          dauer: 45,
        });
      }
    }
    for (const tag of wdhTage) {
      tagesPlan.push({
        tag,
        titel: `🔁 ${kurz(k.name)}: Gesamtwiederholung`,
        beschreibung: `Alle fälligen Fragen + Multiple Choice, schwache Themen nochmal lesen.\n${app}/lernen/wiederholen?kurs=${k.id}`,
        dauer: BLOCK_MIN * 2,
      });
    }
    for (const p of tagesPlan) {
      const slot = freierSlot(p.tag, p.dauer, belegtAlle, plan, jetzt);
      if (!slot) continue;
      const t: Termin = {
        id: `lernplan-${k.id}-${p.tag}`,
        titel: p.titel,
        start: slot,
        ende: new Date(slot.getTime() + p.dauer * 60_000),
        ganztags: false,
        beschreibung: p.beschreibung,
        kategorie: "Lernplan",
        quelle: "lernplan",
      };
      plan.push(t);
    }
  }
  return plan.sort((a, b) => a.start.getTime() - b.start.getTime());
}

/** Erstes freies Zeitfenster am Tag (halbstündliches Raster), mit 15 min Puffer zu anderen Terminen. */
function freierSlot(tag: string, dauer: number, belegt: Termin[], plan: Termin[], jetzt: Date): Date | null {
  const start0 = tagStart(tag).getTime();
  if (plan.filter((p) => tagKey(p.start) === tag).length >= MAX_BLOCKS_TAG) return null;
  const puffer = 15 * 60_000;
  const alle = [...belegt, ...plan];
  for (let min = FENSTER[0] * 60; min + dauer <= FENSTER[1] * 60; min += 30) {
    const s = start0 + min * 60_000;
    const e = s + dauer * 60_000;
    if (s < jetzt.getTime()) continue;
    if (alle.some((t) => t.start.getTime() < e + puffer && t.ende.getTime() > s - puffer)) continue;
    return new Date(s);
  }
  // heute schon zu spät oder alles voll → abends nach 22 Uhr (Tom lernt auch nachts)
  const s = Math.max(start0 + FENSTER[1] * 60 * 60_000, jetzt.getTime() + 30 * 60_000);
  const e = s + dauer * 60_000;
  if (tagKey(new Date(s)) !== tag || alle.some((t) => t.start.getTime() < e && t.ende.getTime() > s)) return null;
  return new Date(Math.ceil(s / 1_800_000) * 1_800_000);
}

type Db = { from: (t: string) => any }; // eslint-disable-line @typescript-eslint/no-explicit-any

/** Lernplan aus den Lernthemen (alle Kurse mit Klausurtermin) und den Terminen berechnen. */
export async function ladeLernplan(db: Db, termine: Termin[], userId?: string, jetzt = new Date(), vorhanden?: Status[]) {
  let q = db.from("lernthemen").select("id, titel, course_id, status, courses(name)").neq("status", "fehler");
  if (userId) q = q.eq("user_id", userId);
  const { data } = await q;
  // Themen, deren Katalog schon zur Hälfte geübt ist, gelten als durchgearbeitet
  const status = vorhanden ?? (await ladeWiederholen(db, undefined, userId)).status;
  const proThema = new Map<string, { n: number; geuebt: number }>();
  for (const s of status) {
    const x = proThema.get(s.thema_id) ?? { n: 0, geuebt: 0 };
    x.n++;
    if (!s.neu) x.geuebt++;
    proThema.set(s.thema_id, x);
  }
  const erledigt = new Set([...proThema].filter(([, x]) => x.geuebt * 2 >= x.n).map(([id]) => id));
  const klausuren = termine.filter(istKlausur);
  const kurse = new Map<string, PlanKurs>();
  for (const t of (data ?? []) as { id: string; titel: string; course_id: string; courses: { name: string } | null }[]) {
    const name = t.courses?.name ?? "";
    if (erledigt.has(t.id)) continue; // schon durchgearbeitet → nur noch über „Wiederholen“
    const k = klausurFuer(name, klausuren);
    if (!k || k.start.getTime() < jetzt.getTime()) continue;
    if (!kurse.has(t.course_id)) kurse.set(t.course_id, { id: t.course_id, name, klausur: k.start, themen: [] });
    kurse.get(t.course_id)!.themen.push({ id: t.id, titel: t.titel });
  }
  for (const k of kurse.values()) k.themen.sort((a, b) => natSort(a.titel, b.titel));
  const app = process.env.NEXT_PUBLIC_APP_URL ?? "https://uni-organizer-tom-ufyt.vercel.app";
  return baueLernplan([...kurse.values()], termine, jetzt, app);
}
