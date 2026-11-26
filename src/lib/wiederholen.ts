// Wiederholen nach dem Leitner-Prinzip, berechnet aus den gespeicherten Antworten (keine eigene Tabelle nötig).
// Nicht gewusst → heute nochmal, teilweise → morgen, gewusst → 1, 3, 7, 14 Tage (je öfter in Folge gewusst).
// Vor der Klausur wird der Abstand gedeckelt, damit jede Frage bis zur Klausur mindestens noch einmal drankommt.

export type Antwort = { thema_id: string; nr: number; bewertung: string; created_at: string };
export type ThemaInfo = { id: string; fertig_at: string | null; klausur_am: string | null; anzahl: number };

const TAG = 86_400_000;
export const ABSTAENDE = [1, 3, 7, 14, 30];

export type Status = { thema_id: string; nr: number; faellig: boolean; neu: boolean; faellig_am: number; serie: number; klausur: number };

export function fragenStatus(themen: ThemaInfo[], antworten: Antwort[], jetzt = Date.now()): Status[] {
  const nachFrage = new Map<string, Antwort[]>();
  for (const a of antworten) {
    const key = `${a.thema_id}#${a.nr}`;
    if (!nachFrage.has(key)) nachFrage.set(key, []);
    nachFrage.get(key)!.push(a);
  }
  const heuteEnde = new Date(jetzt);
  heuteEnde.setHours(23, 59, 59, 999);
  const out: Status[] = [];
  for (const t of themen) {
    const ab = t.fertig_at ? Date.parse(t.fertig_at) : 0;
    const klausur = t.klausur_am ? Date.parse(t.klausur_am) : Infinity;
    for (let nr = 0; nr < t.anzahl; nr++) {
      // Antworten von vor einer Neuerstellung des Themas gehören zu anderen Fragen
      const liste = (nachFrage.get(`${t.id}#${nr}`) ?? [])
        .filter((a) => Date.parse(a.created_at) >= ab)
        .sort((a, b) => Date.parse(a.created_at) - Date.parse(b.created_at));
      if (!liste.length) {
        out.push({ thema_id: t.id, nr, faellig: false, neu: true, faellig_am: Infinity, serie: 0, klausur });
        continue;
      }
      const letzte = liste[liste.length - 1];
      const zeit = Date.parse(letzte.created_at);
      let serie = 0;
      for (let i = liste.length - 1; i >= 0 && liste[i].bewertung === "richtig"; i--) serie++;
      let tage = letzte.bewertung === "falsch" ? 0 : letzte.bewertung === "teilweise" ? 1 : ABSTAENDE[Math.min(serie - 1, ABSTAENDE.length - 1)];
      // vor der Klausur: höchstens die Hälfte der Restzeit warten
      if (Number.isFinite(klausur) && klausur > zeit) tage = Math.min(tage, Math.max(1, Math.floor((klausur - zeit) / TAG / 2)));
      const faellig_am = tage === 0 ? zeit : startTag(zeit) + tage * TAG;
      out.push({ thema_id: t.id, nr, faellig: faellig_am <= heuteEnde.getTime(), neu: false, faellig_am, serie, klausur });
    }
  }
  return out;
}

function startTag(ms: number) {
  const d = new Date(ms);
  d.setHours(0, 0, 0, 0);
  return d.getTime();
}

/** Reihenfolge für eine Sitzung: zuerst nächste Klausur, dann am längsten überfällig. */
export function sitzung(status: Status[], mitNeuen: boolean, max = 40) {
  const faellig = status.filter((s) => s.faellig).sort((a, b) => a.klausur - b.klausur || a.faellig_am - b.faellig_am);
  const neu = mitNeuen ? status.filter((s) => s.neu).sort((a, b) => a.klausur - b.klausur) : [];
  return [...faellig, ...neu].slice(0, max);
}

type Db = { from: (t: string) => any }; // eslint-disable-line @typescript-eslint/no-explicit-any

/** Lädt fertige Themen + Antworten und berechnet den Wiederhol-Status aller Katalogfragen. */
export async function ladeWiederholen(supabase: Db, kursId?: string, userId?: string) {
  let q = supabase.from("lernthemen").select("id, titel, fertig_at, klausur_am, katalog, course_id, courses(name)").eq("status", "fertig");
  if (kursId) q = q.eq("course_id", kursId);
  if (userId) q = q.eq("user_id", userId);
  const { data: themen } = await q;
  // Supabase liefert höchstens 1000 Zeilen pro Abfrage → seitenweise laden
  const antworten: Antwort[] = [];
  for (let von = 0; von < 50_000; von += 1000) {
    const { data } = await supabase
      .from("antworten")
      .select("thema_id, nr, bewertung, created_at")
      .eq("art", "katalog")
      .eq(userId ? "user_id" : "art", userId ?? "katalog")
      .order("created_at")
      .range(von, von + 999);
    antworten.push(...((data ?? []) as Antwort[]));
    if (!data || data.length < 1000) break;
  }
  const liste = (themen ?? []) as {
    id: string;
    titel: string;
    fertig_at: string | null;
    klausur_am: string | null;
    katalog: unknown[] | null;
    course_id: string;
    courses: { name: string } | null;
  }[];
  const status = fragenStatus(
    liste.map((t) => ({ id: t.id, fertig_at: t.fertig_at, klausur_am: t.klausur_am, anzahl: (t.katalog ?? []).length })),
    antworten,
  );
  return { themen: liste, status };
}
