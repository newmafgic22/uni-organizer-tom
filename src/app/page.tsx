import Link from "next/link";
import { Nav } from "@/components/Nav";
import { Fehler, Legende, TerminListe } from "@/components/TerminListe";
import { LerntoolKacheln, type LinkEintrag } from "@/components/LinkListe";
import { istKlausur } from "@/lib/ical";
import { ladeTermine } from "@/lib/daten";
import { requireUser } from "@/lib/supabase/server";
import { WiederholenKarte } from "@/components/WiederholenKarte";
import { ladeWiederholen } from "@/lib/wiederholen";
import { fmtDatum, fmtTag, fmtZeit, plusTage, tagKey, tagStart, wochenStart } from "@/lib/zeit";

export const dynamic = "force-dynamic";

export default async function Start() {
  const { supabase } = await requireUser();
  const heute = tagKey(new Date());
  const montag = wochenStart();
  const von = tagStart(heute);
  const bisWoche = tagStart(plusTage(montag, 7));
  const bisKlausur = tagStart(plusTage(heute, 180));
  const { termine, fehler, anzahlQuellen } = await ladeTermine(supabase, von, bisKlausur);
  // Lerntools (z. B. CoTutor), Tests und Übungen, die der Sync gefunden hat
  const { data: lk } = await supabase
    .from("links")
    .select("id, course_id, url, titel, kategorie, wichtig, gesehen, ausgeblendet, fundstelle, quelle")
    .eq("wichtig", true)
    .eq("ausgeblendet", false);
  const lerntools: LinkEintrag[] = lk ?? [];
  const { data: kn } = lerntools.length ? await supabase.from("courses").select("id, name") : { data: [] };
  const kursNamen = Object.fromEntries((kn ?? []).map((k) => [k.id, k.name.replace(/\s*[\[(].*$/, "")]));
  const neuTools = lerntools.filter((l) => !l.gesehen).length;
  const { status: wiederholen } = await ladeWiederholen(supabase);

  const heuteListe = termine.filter((t) => t.start < tagStart(plusTage(heute, 1)) && t.ende > von);
  const restWoche = termine.filter((t) => t.start >= tagStart(plusTage(heute, 1)) && t.start < bisWoche);
  const klausuren = termine.filter(istKlausur);
  const naechste = klausuren[0];
  const tageBis = naechste ? Math.ceil((naechste.start.getTime() - Date.now()) / 86400000) : null;

  return (
    <>
      <Nav />
      <main className="mx-auto max-w-5xl px-4 py-6 flex flex-col gap-4">
        <h1 className="text-2xl font-semibold">{fmtTag(heute)}</h1>
        {anzahlQuellen === 0 && (
          <div className="karte">
            Noch keine Kalender verbunden. <Link className="text-sky-600 underline" href="/einstellungen">Jetzt ILIAS- und Portal2-Link eintragen</Link>
          </div>
        )}
        <Fehler fehler={fehler} />
        <div className="grid gap-4 md:grid-cols-3">
          <section className="karte md:col-span-1">
            <h2 className="text-sm font-semibold uppercase tracking-wide text-zinc-500">Nächste Klausur</h2>
            {naechste ? (
              <div className="mt-2">
                <div className="text-4xl font-bold tabular-nums">{tageBis} <span className="text-base font-normal text-zinc-500">{tageBis === 1 ? "Tag" : "Tage"}</span></div>
                <div className="mt-1 font-medium">{naechste.titel}</div>
                <div className="text-sm text-zinc-500">{fmtDatum(naechste.start)}, {fmtZeit(naechste.start)} Uhr{naechste.ort ? ` · ${naechste.ort}` : ""}</div>
                {klausuren.length > 1 && (
                  <ul className="mt-3 border-t border-zinc-200 pt-2 text-sm dark:border-zinc-800">
                    {klausuren.slice(1, 6).map((k) => (
                      <li key={k.id} className="flex justify-between gap-2 py-0.5">
                        <span className="truncate">{k.titel}</span>
                        <span className="shrink-0 tabular-nums text-zinc-500">{fmtDatum(k.start).replace(/^\w+\., /, "")}</span>
                      </li>
                    ))}
                  </ul>
                )}
              </div>
            ) : (
              <p className="mt-2 text-sm text-zinc-500">Noch keine Klausur im Kalender gefunden. Sobald Portal2 verbunden ist, erscheinen deine Prüfungstermine hier.</p>
            )}
          </section>
          <section className="karte md:col-span-2">
            <div className="flex items-center justify-between">
              <h2 className="text-sm font-semibold uppercase tracking-wide text-zinc-500">Heute</h2>
              <Legende />
            </div>
            <TerminListe termine={heuteListe} leer="Heute steht nichts an." />
          </section>
        </div>
        <WiederholenKarte status={wiederholen} />
        {lerntools.length > 0 && (
          <section className="karte">
            <h2 className="mb-2 text-sm font-semibold uppercase tracking-wide text-zinc-500">
              Lerntools{neuTools > 0 ? ` · ${neuTools} neu` : ""}
            </h2>
            <LerntoolKacheln links={lerntools} kursNamen={kursNamen} />
          </section>
        )}
        <section className="karte">
          <div className="flex items-center justify-between">
            <h2 className="text-sm font-semibold uppercase tracking-wide text-zinc-500">Rest der Woche</h2>
            <Link href="/kalender" className="text-sm text-sky-600">Ganzer Kalender →</Link>
          </div>
          <TerminListe termine={restWoche} leer="Diese Woche nichts mehr." />
        </section>
      </main>
    </>
  );
}
