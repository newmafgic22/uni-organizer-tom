import Link from "next/link";
import { Nav } from "@/components/Nav";
import { Fehler, Legende, TerminListe } from "@/components/TerminListe";
import { ladeTermine } from "@/lib/daten";
import { requireUser } from "@/lib/supabase/server";
import { ladeLernplan } from "@/lib/lernplan";
import { fmtTagKurz, plusTage, tagKey, tagStart, wochenStart } from "@/lib/zeit";

export const dynamic = "force-dynamic";

export default async function Kalender({ searchParams }: { searchParams: Promise<{ w?: string }> }) {
  const { w } = await searchParams;
  const n = Number.parseInt(w ?? "0", 10) || 0;
  const montag = wochenStart(new Date(), n);
  const tage = Array.from({ length: 7 }, (_, i) => plusTage(montag, i));
  const { supabase } = await requireUser();
  const heute = tagKey(new Date());
  // Für den Lernplan braucht es alle Termine bis zur letzten Klausur, nicht nur diese Woche
  const von = tagStart(montag < heute ? montag : heute);
  const bis = tagStart(plusTage(montag < heute ? heute : montag, 70));
  const { termine: alle, fehler } = await ladeTermine(supabase, von, bis);
  const plan = await ladeLernplan(supabase, alle).catch(() => []);
  const wocheVon = tagStart(montag);
  const wocheBis = tagStart(plusTage(montag, 7));
  const termine = [...alle, ...plan]
    .filter((t) => t.start < wocheBis && t.ende > wocheVon)
    .sort((a, b) => a.start.getTime() - b.start.getTime());

  return (
    <>
      <Nav />
      <main className="mx-auto max-w-7xl px-4 py-6 sm:px-6 lg:py-10 flex flex-col gap-4">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div>
            <h1 className="seitentitel">Kalender</h1>
            <p className="mt-1 text-sm text-zinc-500">Woche ab {fmtTagKurz(montag)}</p>
          </div>
          <div className="flex items-center gap-1 rounded-xl border border-zinc-200 bg-white p-1 text-sm shadow-sm dark:border-zinc-700 dark:bg-zinc-900">
            <Link className="rounded-lg px-3 py-1.5 hover:bg-zinc-100 dark:hover:bg-zinc-800" href={`/kalender?w=${n - 1}`} aria-label="Woche zurück">←</Link>
            <Link className={`rounded-lg px-3 py-1.5 font-medium ${n === 0 ? "bg-accent-50 text-accent-700 dark:bg-accent-500/15 dark:text-accent-300" : "hover:bg-zinc-100 dark:hover:bg-zinc-800"}`} href="/kalender">Heute</Link>
            <Link className="rounded-lg px-3 py-1.5 hover:bg-zinc-100 dark:hover:bg-zinc-800" href={`/kalender?w=${n + 1}`} aria-label="Woche weiter">→</Link>
          </div>
        </div>
        <Legende />
        <Fehler fehler={fehler} />
        <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-7">
          {tage.map((k) => {
            const tagTermine = termine.filter((t) => t.start < tagStart(plusTage(k, 1)) && t.ende > tagStart(k));
            return (
              <section key={k} className={`karte xl:!p-3 ${k === heute ? "!border-accent-400 ring-4 ring-accent-500/10 dark:!border-accent-500/60" : ""} ${k < heute ? "opacity-60" : ""}`}>
                <h2 className={`flex items-center gap-2 text-sm font-semibold ${k === heute ? "text-accent-600 dark:text-accent-400" : ""}`}>
                  {fmtTagKurz(k)}
                  {k === heute && <span className="chip !bg-accent-100 !text-accent-700 dark:!bg-accent-500/20 dark:!text-accent-300">heute</span>}
                </h2>
                <TerminListe termine={tagTermine} leer="–" />
              </section>
            );
          })}
        </div>
      </main>
    </>
  );
}
