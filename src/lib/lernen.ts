import type { Termin } from "@/lib/ical";

export type KatalogFrage = { frage: string; antwort: string; afb: 1 | 2 | 3 };
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
      return { ...(e as object), afb: afb === 2 || afb === 3 ? afb : 1 } as T;
    });
}
