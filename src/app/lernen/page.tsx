import Link from "next/link";
import { Nav } from "@/components/Nav";
import { requireUser } from "@/lib/supabase/server";
import { STATUS_TEXT, anzeigeName, kurzTitel, sehrKurzTitel } from "@/lib/lernen";
import { natSort } from "@/lib/material";
import { ladeWiederholen } from "@/lib/wiederholen";
import { fmtDatum } from "@/lib/zeit";
import { kurz, kursFarbe } from "@/lib/farben";
import { sofortBearbeiten, nochmal } from "./actions";

export const dynamic = "force-dynamic";

type Zeile = {
  id: string;
  titel: string;
  status: string;
  sofort: boolean;
  klausur_am: string | null;
  fehler: string | null;
  course_id: string;
  courses: { name: string } | null;
};

export default async function Lernen({ searchParams }: { searchParams: Promise<{ hinweis?: string }> }) {
  const { hinweis } = await searchParams;
  const { supabase } = await requireUser();
  const { data } = await supabase
    .from("lernthemen")
    .select("id, titel, status, sofort, klausur_am, fehler, course_id, courses(name)")
    .order("created_at");
  const themen = (data ?? []) as unknown as Zeile[];
  // Lernstand je Thema: wie viele Fragen sitzen (zuletzt gewusst), wie viele geübt
  const { status } = await ladeWiederholen(supabase);
  const stand: Record<string, { sitzt: number; geuebt: number; n: number }> = {};
  for (const x of status) {
    const q = (stand[x.thema_id] ??= { sitzt: 0, geuebt: 0, n: 0 });
    q.n++;
    if (!x.neu) q.geuebt++;
    if (x.serie >= 1) q.sitzt++;
  }
  const schwach = status.filter((x) => !x.neu && x.serie === 0).length;

  const kurse = new Map<string, Zeile[]>();
  themen.forEach((t) => {
    const k = t.courses?.name ? anzeigeName(t.courses.name) : "Sonstiges";
    if (!kurse.has(k)) kurse.set(k, []);
    kurse.get(k)!.push(t);
  });
  const reihen = [...kurse.entries()].sort(([a, x], [b, y]) => {
    const ka = x.find((t) => t.klausur_am)?.klausur_am ?? "9999";
    const kb = y.find((t) => t.klausur_am)?.klausur_am ?? "9999";
    return ka.localeCompare(kb) || natSort(a, b);
  });
  const wartend = themen.filter((t) => t.status === "wartet").length;

  return (
    <>
      <Nav />
      <main className="mx-auto max-w-4xl px-4 py-6 sm:px-6 lg:py-10 flex flex-col gap-4 sm:gap-5">
        <div className="flex flex-wrap items-end justify-between gap-3">
          <div>
            <h1 className="seitentitel">Lernen</h1>

          </div>
          <div className="flex flex-wrap gap-2">
            {schwach > 0 && (
              <Link href="/lernen/wiederholen?schwach=1" className="knopf-2 !border-red-300 !text-red-600 dark:!border-red-500/40 dark:!text-red-400">
                Schwächen üben ({schwach})
              </Link>
            )}
            <Link href="/lernen/wiederholen" className="knopf">
              Heute wiederholen
            </Link>
          </div>
        </div>
        {hinweis === "sofort-voll" && (
          <p className="karte text-sm text-amber-600">Es sind schon 2 Themen vorgezogen. Warte, bis die fertig sind.</p>
        )}
        {!themen.length && (
          <p className="karte text-sm text-zinc-500">
            Noch keine Themen. Geh auf <Link href="/material" className="underline">Material</Link>, öffne einen Kurs und klick bei einer Vorlesung
            auf <b>+ Lernmaterial</b>. Claude erstellt daraus Zusammenfassung, Abfragekatalog und Übungsaufgaben.
          </p>
        )}
        {wartend > 0 && (
          <p className="flex items-start gap-2 rounded-2xl border border-accent-200 bg-accent-50 px-4 py-3 text-sm text-accent-900 dark:border-accent-500/30 dark:bg-accent-500/10 dark:text-accent-200">
            <span className="mt-1 h-2 w-2 shrink-0 animate-pulse rounded-full bg-accent-500" aria-hidden />
            <span>
              {wartend} {wartend === 1 ? "Thema" : "Themen"} in der Warteschlange. Der Lernlauf arbeitet sie nacheinander ab (vorgezogene zuerst, dann nach
              Klausurtermin) und macht nach einem Claude-Limit automatisch weiter.
            </span>
          </p>
        )}
        {reihen.map(([kurs, liste], i) => {
          const farbe = kursFarbe(kurs);
          const fertig = liste.filter((t) => t.status === "fertig");
          const summe = fertig.reduce((a, t) => ({ s: a.s + (stand[t.id]?.sitzt ?? 0), n: a.n + (stand[t.id]?.n ?? 0) }), { s: 0, n: 0 });
          const p = summe.n ? Math.round((summe.s / summe.n) * 100) : 0;
          const kid = liste[0].course_id;
          return (
            <details key={kurs} open={i === 0} className="karte group !p-0 overflow-hidden">
              <summary className="flex cursor-pointer list-none items-center gap-3 p-4 sm:p-5 [&::-webkit-details-marker]:hidden">
                <span className="grid h-10 w-10 shrink-0 place-items-center rounded-xl text-sm font-bold text-white" style={{ background: farbe }} aria-hidden>
                  {kurz(kurs).slice(0, 2)}
                </span>
                <div className="min-w-0 flex-1">
                  <h2 className="font-semibold leading-snug" title={kurs}>{kurz(kurs)}</h2>
                  <div className="mt-1.5 flex items-center gap-2">
                    <span className="balken h-1.5 w-full max-w-48">
                      <span className="absolute inset-y-0 left-0 rounded-full" style={{ width: `${p}%`, background: farbe }} />
                    </span>
                    <span className="text-xs text-zinc-500 tabular-nums">{p} %</span>
                  </div>
                </div>
                {liste[0]?.klausur_am && (
                  <span className="hidden text-sm text-zinc-500 sm:block" title={`Klausur ${fmtDatum(new Date(liste[0].klausur_am))}`}>
                    Klausur in <b className="text-zinc-800 dark:text-zinc-200">{Math.max(0, Math.ceil((new Date(liste[0].klausur_am).getTime() - Date.now()) / 86_400_000))}</b> Tagen
                  </span>
                )}
                <svg viewBox="0 0 20 20" className="h-5 w-5 shrink-0 text-zinc-400 transition-transform group-open:rotate-180" aria-hidden>
                  <path d="M5 8l5 5 5-5" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
                </svg>
              </summary>
              <div className="border-t border-zinc-100 px-4 pb-3 sm:px-5 dark:border-zinc-800">
                {fertig.length > 0 && (
                  <div className="flex flex-wrap gap-2 py-3">
                    <Link href={`/lernen/wiederholen?neu=1&kurs=${kid}`} className="knopf !py-1.5">
                      Kurs üben
                    </Link>
                    <Link href={`/lernen/probeklausur?kurs=${kid}`} className="knopf-2 !py-1.5">
                      Probeklausur
                    </Link>
                    <Link href={`/lernen/kurs/${kid}/druck`} className="knopf-2 !py-1.5">
                      Lernzettel (PDF)
                    </Link>
                  </div>
                )}
                <ul className="divide-y divide-zinc-100 dark:divide-zinc-800">
                  {liste
                    .sort((a, b) => natSort(a.titel, b.titel))
                    .map((t) => {
                      const q = stand[t.id];
                      const tp = q?.n ? Math.round((q.sitzt / q.n) * 100) : 0;
                      return (
                        <li key={t.id} className="flex flex-wrap items-center gap-x-3 gap-y-1 py-2.5">
                          <Link href={`/lernen/${t.id}`} className="min-w-0 flex-1 truncate hover:text-accent-600 dark:hover:text-accent-400" title={t.titel}>
                            <span className="font-medium">{kurz(sehrKurzTitel(t.titel))}</span>
                            {kurzTitel(t.titel) !== sehrKurzTitel(t.titel) && (
                              <span className="text-sm text-zinc-500"> · {kurzTitel(t.titel).slice(sehrKurzTitel(t.titel).length).replace(/^\s*[-–]\s*/, "")}</span>
                            )}
                          </Link>
                          {t.status === "fertig" && q && (
                            <span className="balken h-1.5 w-16 shrink-0 sm:w-24" title={`${q.sitzt} von ${q.n} Fragen sitzen`}>
                              <span className="absolute inset-y-0 left-0 rounded-full" style={{ width: `${tp}%`, background: farbe }} />
                            </span>
                          )}
                          {t.status !== "fertig" && (
                            <span
                              className={`chip ${
                                t.status === "fehler"
                                  ? "!bg-red-100 !text-red-700 dark:!bg-red-500/15 dark:!text-red-300"
                                  : t.status === "laeuft"
                                    ? "!bg-accent-100 !text-accent-700 dark:!bg-accent-500/15 dark:!text-accent-300"
                                    : ""
                              }`}
                              title={t.fehler ?? undefined}
                            >
                              {t.sofort && t.status === "wartet" ? "vorgezogen" : STATUS_TEXT[t.status]}
                            </span>
                          )}
                          {t.status === "wartet" && !t.sofort && (
                            <form action={sofortBearbeiten}>
                              <input type="hidden" name="id" value={t.id} />
                              <button className="text-xs font-medium text-accent-600 hover:underline dark:text-accent-400">als Nächstes</button>
                            </form>
                          )}
                          {t.status === "fehler" && (
                            <form action={nochmal}>
                              <input type="hidden" name="id" value={t.id} />
                              <button className="text-xs font-medium text-accent-600 hover:underline dark:text-accent-400">nochmal versuchen</button>
                            </form>
                          )}
                        </li>
                      );
                    })}
                </ul>
              </div>
            </details>
          );
        })}
      </main>
    </>
  );
}
