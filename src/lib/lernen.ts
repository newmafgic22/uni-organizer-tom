import type { Termin } from "@/lib/ical";

export type Option = { text: string; richtig: boolean; erklaerung?: string };
export type KatalogFrage = { frage: string; antwort: string; afb: 1 | 2 | 3; optionen?: Option[] };
export type Aufgabe = { aufgabe: string; loesung: string; afb: 1 | 2 | 3 };

export const STATUS_TEXT: Record<string, string> = {
  wartet: "in der Warteschlange",
  laeuft: "wird gerade erstellt",
  fertig: "fertig",
  fehler: "Fehler",
};

function woerter(s: string) {
  return s
    .toLowerCase()
    .replace(/\[[^\]]*\]|\([^)]*\)/g, " ")
    .replace(/[^a-zäöüß0-9 ]+/g, " ")
    .split(/\s+/)
    .filter((w) => w.length > 2 && !["der", "die", "das", "und", "für", "von", "vl", "hws", "fss"].includes(w));
}

/** Findet die nächste Klausur, deren Titel zum Kursnamen passt (mind. 2/3 der Kurs-Wörter). */
export function klausurFuer(kursname: string, klausuren: Termin[]): Termin | undefined {
  const kw = woerter(kursname);
  if (!kw.length) return undefined;
  return klausuren.find((k) => {
    const tw = new Set(woerter(k.titel));
    const treffer = kw.filter((w) => tw.has(w)).length;
    return treffer >= Math.ceil((kw.length * 2) / 3);
  });
}

/** Liest Claude-Ausgaben tolerant ein und prüft die Struktur. */
export function pruefeListe<T extends { afb: number }>(x: unknown, felder: string[]): T[] {
  if (!Array.isArray(x)) throw new Error("keine Liste");
  return x
    .filter((e) => e && typeof e === "object" && felder.every((f) => typeof (e as Record<string, unknown>)[f] === "string"))
    .map((e) => {
      const afb = Number((e as Record<string, unknown>).afb);
      const optionen = pruefeOptionen((e as Record<string, unknown>).optionen);
      return { ...(e as object), afb: afb === 2 || afb === 3 ? afb : 1, optionen } as unknown as T;
    });
}

/** Vorlesungsnummer aus dem Dateinamen: "03 Bildungs…" → 3, "GWP_07_HWS…" → 7, "08_Bild…" → 8 */
export function vorlesungsNr(dateiname: string): number | null {
  const m = dateiname.match(/^(?:[A-Za-z]{2,5}_)?(\d{1,2})[ _.-]/);
  return m ? Number(m[1]) : null;
}

const NEBEN = /literatur|^.*_lit_|anhang|\(\d{4}\)|\d{4}\)|zusammenfassung/i;

/** Ist das die Hauptdatei einer Vorlesung (Folien) und nicht Literatur/Anhang? */
export function istHauptdatei(dateiname: string) {
  return vorlesungsNr(dateiname) !== null && !NEBEN.test(dateiname.replace(/^[^_ ]*[_ ]\d{1,2}[_ ]/, ""));
}

/** Lernmodule (z. B. CC 303) gelten immer als eigenes Thema. */
export const istLernmodul = (dateiname: string) => /\(Lernmodul\)\.txt$/.test(dateiname);

/** Optionen einer MC-Frage prüfen (mind. 2, Texte vorhanden). */
export function pruefeOptionen(x: unknown): Option[] | undefined {
  if (!Array.isArray(x)) return undefined;
  const o = x
    .filter((e) => e && typeof e === "object" && typeof (e as Record<string, unknown>).text === "string")
    .map((e) => {
      const r = e as Record<string, unknown>;
      return { text: String(r.text), richtig: r.richtig === true || r.richtig === "true", erklaerung: typeof r.erklaerung === "string" ? r.erklaerung : undefined };
    });
  return o.length >= 2 ? o : undefined;
}
