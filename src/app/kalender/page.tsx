import Link from "next/link";
import { Nav } from "@/components/Nav";
import { Fehler, Legende, TerminListe } from "@/components/TerminListe";
import { ladeTermine } from "@/lib/daten";
import { requireUser } from "@/lib/supabase/server";
import { fmtTagKurz, plusTage, tagKey, tagStart, wochenStart } from "@/lib/zeit";

export const dynamic = "force-dynamic";

export default async function Kalender({ searchParams }: { searchParams: Promise<{ w?: string }> }) {
  const { w } = await searchParams;
  const n = Number.parseInt(w ?? "0", 10) || 0;
  const montag = wochenStart(new Date(), n);
  const tage = Array.from({ length: 7 }, (_, i) => plusTage(montag, i));
  const { supabase } = await requireUser();
  const { termine, fehler } = await ladeTermine(supabase, tagStart(montag), tagStart(plusTage(montag, 7)));
  const heute = tagKey(new Date());

  return (
    <>
      <Nav />
      <main className="mx-auto max-w-6xl px-4 py-6 flex flex-col gap-4">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <h1 className="text-2xl font-semibold">Woche ab {fmtTagKurz(montag)}</h1>
          <div className="flex items-center gap-2 text-sm">
            <Link className="rounded-md border border-zinc-300 px-3 py-1.5 dark:border-zinc-700" href={`/kalender?w=${n - 1}`}>← zurück</Link>
            <Link className="rounded-md border border-zinc-300 px-3 py-1.5 dark:border-zinc-700" href="/kalender">heute</Link>
            <Link className="rounded-md border border-zinc-300 px-3 py-1.5 dark:border-zinc-700" href={`/kalender?w=${n + 1}`}>weiter →</Link>
          </div>
        </div>
        <Legende />
        <Fehler fehler={fehler} />
        <div className="grid gap-3 md:grid-cols-7">
          {tage.map((k) => {
            const tagTermine = termine.filter((t) => t.start < tagStart(plusTage(k, 1)) && t.ende > tagStart(k));
            return (
              <section key={k} className={`karte md:p-3 ${k === heute ? "ring-2 ring-sky-500" : ""}`}>
                <h2 className="text-sm font-semibold">{fmtTagKurz(k)}</h2>
                <TerminListe termine={tagTermine} leer="–" />
              </section>
            );
          })}
        </div>
      </main>
    </>
  );
}
