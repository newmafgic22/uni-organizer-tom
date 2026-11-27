import Link from "next/link";
import { Nav } from "@/components/Nav";
import { Abfrage, type Karte } from "@/components/Abfrage";
import { requireUser } from "@/lib/supabase/server";
import { kurzTitel, type KatalogFrage } from "@/lib/lernen";
import { ladeWiederholen, sitzung } from "@/lib/wiederholen";

export const dynamic = "force-dynamic";

export default async function Wiederholen({ searchParams }: { searchParams: Promise<{ neu?: string; kurs?: string; schwach?: string }> }) {
  const { neu, kurs, schwach } = await searchParams;
  const { supabase } = await requireUser();
  const { themen, status } = await ladeWiederholen(supabase, kurs, undefined, true);
  const nachId = new Map(themen.map((t) => [t.id, t]));
  // „Schwächen üben“: alle Fragen, die zuletzt nicht (ganz) gewusst wurden, egal ob schon fällig
  const auswahl =
    schwach === "1"
      ? status.filter((s) => !s.neu && s.serie === 0).sort((a, b) => a.klausur - b.klausur).slice(0, 40)
      : sitzung(status, neu === "1", 40);
  const karten: Karte[] = auswahl.map((s) => {
    const t = nachId.get(s.thema_id)!;
    const f = (t.katalog as KatalogFrage[])[s.nr];
    return { ...f, themaId: t.id, nr: s.nr, thema: kurzTitel(t.titel) };
  });
  const faellig = status.filter((s) => s.faellig).length;
  const neue = status.filter((s) => s.neu).length;
  // in der Sitzung stehen die Karten in fester Reihenfolge (fällig nach Klausurnähe), Mischen ist trotzdem möglich

  return (
    <>
      <Nav />
      <main className="mx-auto max-w-3xl px-4 py-6 sm:px-6 lg:py-10 flex flex-col gap-4 sm:gap-5">
        <Link href="/lernen" className="text-sm font-medium text-zinc-500 hover:text-zinc-900 dark:hover:text-zinc-100">← Lernen</Link>
        <h1 className="seitentitel">{schwach === "1" ? "Schwächen üben" : neu === "1" ? "Wiederholen + neue Fragen" : "Heute wiederholen"}</h1>
        <div className="flex flex-wrap items-center gap-2 text-sm">
          <span className="chip">{faellig} fällig</span>
          <span className="chip">{neue} noch nie geübt</span>
          <details className="w-full text-zinc-500">
            <summary className="cursor-pointer text-xs">Wie funktioniert das?</summary>
            <p className="mt-1 text-xs">Nicht gewusst kommt heute nochmal, teilweise morgen, gewusst nach 1, 3, 7, 14 Tagen (vor der Klausur kürzer).</p>
          </details>
        </div>
        {karten.length ? (
          <Abfrage
            karten={karten}
            ende={
              <div className="flex flex-wrap gap-2">
                <a href={`/lernen/wiederholen?neu=${neu ?? ""}${kurs ? `&kurs=${kurs}` : ""}`} className="knopf !py-1.5">
                  Weiter (neu laden)
                </a>
                {neu !== "1" && neue > 0 && (
                  <a href={`/lernen/wiederholen?neu=1${kurs ? `&kurs=${kurs}` : ""}`} className="knopf-2 !py-1.5">
                    Neue Fragen lernen ({neue})
                  </a>
                )}
              </div>
            }
          />
        ) : (
          <div className="karte flex flex-col items-start gap-2">
            <p className="font-medium">Heute ist nichts fällig. 🎉</p>
            {neue > 0 ? (
              <a href={`/lernen/wiederholen?neu=1${kurs ? `&kurs=${kurs}` : ""}`} className="knopf">
                {neue} neue Fragen lernen
              </a>
            ) : (
              <p className="text-sm text-zinc-500">Sobald Themen fertig sind, erscheinen ihre Fragen hier.</p>
            )}
          </div>
        )}
      </main>
    </>
  );
}
