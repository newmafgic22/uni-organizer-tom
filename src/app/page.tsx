import Link from "next/link";
import { Nav } from "@/components/Nav";
import { Fehler, Legende, TerminListe, TerminTage } from "@/components/TerminListe";
import { LerntoolKacheln, type LinkEintrag } from "@/components/LinkListe";
import { istKlausur } from "@/lib/ical";
import { ladeTermine } from "@/lib/daten";
import { requireUser } from "@/lib/supabase/server";
import { WiederholenKarte } from "@/components/WiederholenKarte";
import { KlausurHero, KlausurListe, type KlausurStand } from "@/components/KlausurUebersicht";
import { anzeigeName, klausurFuer } from "@/lib/lernen";
import { ladeWiederholen } from "@/lib/wiederholen";
import { ladeLernplan } from "@/lib/lernplan";
import { fmtTag, plusTage, tagKey, tagStart, wochenStart } from "@/lib/zeit";

export const dynamic = "force-dynamic";

export default async function Start() {
  const { supabase } = await requireUser();
  const heute = tagKey(new Date());
  const montag = wochenStart();
  const von = tagStart(heute);
  const bisWoche = tagStart(plusTage(montag, 7));
  const bisKlausur = tagStart(plusTage(heute, 180));
  // Alles Unabhängige parallel laden (jede Abfrage ist ein Netzwerk-Roundtrip)
  const [{ termine, fehler, anzahlQuellen }, { data: lk }, { data: kn }, { status: wiederholen, themen: fertigeThemen }, { data: lt }, { data: noten }] = await Promise.all([
    ladeTermine(supabase, von, bisKlausur),
    // Lerntools (z. B. CoTutor), Tests und Übungen, die der Sync gefunden hat
    supabase
      .from("links")
      .select("id, course_id, url, titel, kategorie, wichtig, gesehen, ausgeblendet, fundstelle, quelle")
      .eq("wichtig", true)
      .eq("ausgeblendet", false),
    supabase.from("courses").select("id, name"),
    ladeWiederholen(supabase),
    supabase.from("lernthemen").select("course_id, status"),
    supabase.from("pruefungen").select("nummer, titel, note, ects, status, freigabe").not("note", "is", null),
  ]);
  const lerntools: LinkEintrag[] = lk ?? [];
  const kursNamen = Object.fromEntries((kn ?? []).map((k) => [k.id, anzeigeName(k.name)]));
  const neuTools = lerntools.filter((l) => !l.gesehen).length;

  const plan = await ladeLernplan(supabase, termine, undefined, new Date(), wiederholen).catch(() => []);
  const mitPlan = [...termine, ...plan].sort((a, b) => a.start.getTime() - b.start.getTime());
  const heuteListe = mitPlan.filter((t) => t.start < tagStart(plusTage(heute, 1)) && t.ende > von);
  const restWoche = mitPlan.filter((t) => t.start >= tagStart(plusTage(heute, 1)) && t.start < bisWoche);
  const klausuren = termine.filter(istKlausur);
  // Lernstand je Klausur: passende Kurse (Vorlesung + Übungsgruppe) über den Namen finden
  const themaKurs = new Map(fertigeThemen.map((t) => [t.id, t.course_id]));
  const klausurStand: KlausurStand[] = klausuren.slice(0, 7).map((k) => {
    const ids = new Set((kn ?? []).filter((c) => klausurFuer(c.name, [k])).map((c) => c.id));
    const themen = (lt ?? []).filter((t) => ids.has(t.course_id));
    const fragen = wiederholen.filter((x) => ids.has(themaKurs.get(x.thema_id) ?? ""));
    const proKurs = new Map<string, number>();
    themen.forEach((t) => proKurs.set(t.course_id, (proKurs.get(t.course_id) ?? 0) + 1));
    const kursId = [...proKurs.entries()].sort((a, b) => b[1] - a[1])[0]?.[0] ?? null;
    return {
      klausur: { ...k, titel: anzeigeName(k.titel) },
      kursId,
      themenGesamt: themen.length,
      themenFertig: themen.filter((t) => t.status === "fertig").length,
      fragen: fragen.length,
      sitzt: fragen.filter((x) => x.serie >= 1).length,
    };
  });
  const schnitt = (noten ?? []).find((n) => /-K$/.test(n.nummer));
  const einzelnoten = (noten ?? []).filter((n) => /-P$/.test(n.nummer));

  const stunde = Number(new Intl.DateTimeFormat("de-DE", { hour: "numeric", hourCycle: "h23", timeZone: "Europe/Berlin" }).format(new Date()));
  const gruss = stunde < 5 ? "Gute Nacht" : stunde < 11 ? "Guten Morgen" : stunde < 18 ? "Hallo" : "Guten Abend";
  const [naechste, ...weitere] = klausurStand;

  return (
    <>
      <Nav />
      <main className="mx-auto max-w-6xl px-4 py-6 sm:px-6 lg:py-10 flex flex-col gap-4 sm:gap-5">
        <header className="mb-1">
          <p className="text-sm font-medium text-zinc-500">{fmtTag(heute)}</p>
          <h1 className="seitentitel">{gruss}, Tom</h1>
        </header>
        {anzahlQuellen === 0 && (
          <div className="karte">
            Noch keine Kalender verbunden. <Link className="text-accent-600 underline" href="/einstellungen">Jetzt ILIAS- und Portal2-Link eintragen</Link>
          </div>
        )}
        <Fehler fehler={fehler} />
        <div className="grid gap-4 sm:gap-5 lg:grid-cols-3">
          <div className="lg:col-span-2">
            <KlausurHero s={naechste} />
          </div>
          <WiederholenKarte status={wiederholen} />
        </div>
        <div className="grid gap-4 sm:gap-5 lg:grid-cols-3">
          <section className="karte lg:col-span-2">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <h2 className="abschnitt">Heute</h2>
              <Legende />
            </div>
            <TerminListe termine={heuteListe} leer="Heute steht nichts an." />
          </section>
          <section className="karte">
            <h2 className="abschnitt">Weitere Klausuren</h2>
            <KlausurListe liste={weitere} />
          </section>
        </div>
        {lerntools.length > 0 && (
          <section className="karte">
            <h2 className="abschnitt mb-3">
              Lerntools{neuTools > 0 ? ` · ${neuTools} neu` : ""}
            </h2>
            <LerntoolKacheln links={lerntools} kursNamen={kursNamen} />
          </section>
        )}
        {einzelnoten.length > 0 && (
          <section className="karte">
            <div className="flex flex-wrap items-baseline justify-between gap-2">
              <h2 className="abschnitt">Noten</h2>
              {schnitt && (
                <span className="text-sm text-zinc-500">
                  Schnitt <b className="text-zinc-900 dark:text-zinc-100">{Number(schnitt.note).toFixed(1).replace(".", ",")}</b> · {Number(schnitt.ects ?? 0)} ECTS
                </span>
              )}
            </div>
            <ul className="mt-2 divide-y divide-zinc-100 text-sm dark:divide-zinc-800">
              {einzelnoten.map((n) => (
                <li key={n.nummer} className="flex justify-between gap-2 py-2">
                  <span className="truncate">{anzeigeName(n.titel)}</span>
                  <span className="shrink-0 tabular-nums">
                    <b>{Number(n.note).toFixed(1).replace(".", ",")}</b>
                    <span className="text-zinc-500"> · {Number(n.ects ?? 0)} ECTS{n.status === "BE" ? " · bestanden" : ""}</span>
                  </span>
                </li>
              ))}
            </ul>
          </section>
        )}
        <section className="karte">
          <div className="flex items-center justify-between">
            <h2 className="abschnitt">Rest der Woche</h2>
            <Link href="/kalender" className="text-sm font-medium text-accent-600 dark:text-accent-400">Ganzer Kalender →</Link>
          </div>
          <TerminTage termine={restWoche} leer="Diese Woche nichts mehr." />
        </section>
      </main>
    </>
  );
}
