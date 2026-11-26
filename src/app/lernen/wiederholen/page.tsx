import Link from "next/link";
import { Nav } from "@/components/Nav";
import { Abfrage, type Karte } from "@/components/Abfrage";
import { requireUser } from "@/lib/supabase/server";
import type { KatalogFrage } from "@/lib/lernen";
import { ladeWiederholen, sitzung } from "@/lib/wiederholen";

export const dynamic = "force-dynamic";

export default async function Wiederholen({ searchParams }: { searchParams: Promise<{ neu?: string; kurs?: string }> }) {
  const { neu, kurs } = await searchParams;
  const { supabase } = await requireUser();
  const { themen, status } = await ladeWiederholen(supabase, kurs);
  const nachId = new Map(themen.map((t) => [t.id, t]));
  const auswahl = sitzung(status, neu === "1", 40);
  const karten: Karte[] = auswahl.map((s) => {
    const t = nachId.get(s.thema_id)!;
    const f = (t.katalog as KatalogFrage[])[s.nr];
    return { ...f, themaId: t.id, nr: s.nr, thema: t.titel.replace(/^(\d+)\s+\S+\s+HWS2026\s+/i, "$1 ").replace(/^GWP (\d+) HWS 2026 /, "$1 ") };
  });
  const faellig = status.filter((s) => s.faellig).length;
  const neue = status.filter((s) => s.neu).length;
  // in der Sitzung stehen die Karten in fester Reihenfolge (fällig nach Klausurnähe), Mischen ist trotzdem möglich

  return (
    <>
      <Nav />
      <main className="mx-auto max-w-3xl px-4 py-6 flex flex-col gap-4">
        <Link href="/lernen" className="text-sm text-zinc-500">← Lernen</Link>
        <h1 className="text-2xl font-semibold">{neu === "1" ? "Wiederholen + neue Fragen" : "Heute wiederholen"}</h1>
        <p className="text-sm text-zinc-500">
          {faellig} Fragen fällig · {neue} noch nie geübt. Nicht gewusst kommt heute nochmal, teilweise morgen, gewusst nach 1, 3, 7, 14 Tagen (vor der Klausur kürzer).
        </p>
        {karten.length ? (
          <Abfrage
            karten={karten}
            ende={
              <div className="flex flex-wrap gap-2">
                <a href={`/lernen/wiederholen?neu=${neu ?? ""}${kurs ? `&kurs=${kurs}` : ""}`} className="rounded-md bg-sky-600 px-3 py-1 text-sm text-white">
                  Weiter (neu laden)
                </a>
                {neu !== "1" && neue > 0 && (
                  <a href={`/lernen/wiederholen?neu=1${kurs ? `&kurs=${kurs}` : ""}`} className="rounded-md border border-sky-600 px-3 py-1 text-sm text-sky-600">
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
              <a href={`/lernen/wiederholen?neu=1${kurs ? `&kurs=${kurs}` : ""}`} className="rounded-md bg-sky-600 px-3 py-1.5 text-sm text-white">
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
