import Link from "next/link";
import { Nav } from "@/components/Nav";
import { requireUser } from "@/lib/supabase/server";
import { STATUS_TEXT } from "@/lib/lernen";
import { natSort } from "@/lib/material";
import { ladeWiederholen } from "@/lib/wiederholen";
import { fmtDatum } from "@/lib/zeit";
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
    const k = t.courses?.name ?? "Sonstiges";
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
      <main className="mx-auto max-w-3xl px-4 py-6 flex flex-col gap-4">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <h1 className="text-2xl font-semibold">Lernen</h1>
          <Link href="/lernen/wiederholen" className="rounded-md bg-sky-600 px-3 py-1.5 text-sm font-medium text-white">
            🔁 Heute wiederholen
          </Link>
          {schwach > 0 && (
            <Link href="/lernen/wiederholen?schwach=1" className="rounded-md border border-red-500 px-3 py-1.5 text-sm text-red-600">
              Schwächen üben ({schwach})
            </Link>
          )}
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
          <p className="text-sm text-zinc-500">
            {wartend} Thema/Themen in der Warteschlange. Der Lernlauf schaut jede Stunde nach und macht weiter, sobald dein Claude-Limit es zulässt.
            Reihenfolge: vorgezogene zuerst, dann nach Klausurtermin.
          </p>
        )}
        {reihen.map(([kurs, liste]) => (
          <section key={kurs} className="karte">
            <div className="flex flex-wrap items-baseline justify-between gap-2">
              <h2 className="font-semibold">{kurs}</h2>
              {liste.some((t) => t.status === "fertig") && (
                <span className="flex gap-3 text-sm">
                  <Link href={`/lernen/wiederholen?neu=1&kurs=${liste[0].course_id}`} className="text-sky-600">
                    Kurs üben
                  </Link>
                  <Link href={`/lernen/probeklausur?kurs=${liste[0].course_id}`} className="text-sky-600">
                    Probeklausur
                  </Link>
                  <Link href={`/lernen/kurs/${liste[0].course_id}/druck`} className="text-sky-600">
                    Lernzettel (PDF)
                  </Link>
                </span>
              )}
            </div>
            {liste[0]?.klausur_am && (
              <p className="mb-2 text-xs text-zinc-500">Klausur: {fmtDatum(new Date(liste[0].klausur_am))}</p>
            )}
            <ul className="divide-y divide-zinc-200 dark:divide-zinc-800">
              {liste
                .sort((a, b) => natSort(a.titel, b.titel))
                .map((t) => (
                  <li key={t.id} className="flex flex-wrap items-center gap-2 py-2">
                    <Link href={`/lernen/${t.id}`} className="flex-1 hover:underline">
                      {t.titel}
                    </Link>
                    {t.status === "fertig" && stand[t.id] && (
                      <span className="flex items-center gap-1.5 text-xs text-zinc-500" title={`${stand[t.id].geuebt} von ${stand[t.id].n} Fragen geübt`}>
                        <span className="h-1.5 w-16 overflow-hidden rounded-full bg-zinc-200 dark:bg-zinc-800">
                          <span
                            className="block h-full bg-emerald-500"
                            style={{ width: `${Math.round((stand[t.id].sitzt / stand[t.id].n) * 100)}%` }}
                          />
                        </span>
                        {stand[t.id].sitzt}/{stand[t.id].n} sitzen
                      </span>
                    )}
                    <span
                      className={`rounded-md px-2 py-0.5 text-xs ${
                        t.status === "fertig"
                          ? "bg-emerald-100 text-emerald-800 dark:bg-emerald-900 dark:text-emerald-100"
                          : t.status === "fehler"
                            ? "bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-100"
                            : "bg-zinc-100 dark:bg-zinc-800"
                      }`}
                      title={t.fehler ?? undefined}
                    >
                      {t.sofort && t.status === "wartet" ? "vorgezogen" : STATUS_TEXT[t.status]}
                    </span>
                    {t.status === "wartet" && !t.sofort && (
                      <form action={sofortBearbeiten}>
                        <input type="hidden" name="id" value={t.id} />
                        <button className="text-xs text-sky-600 underline">als Nächstes</button>
                      </form>
                    )}
                    {t.status === "fehler" && (
                      <form action={nochmal}>
                        <input type="hidden" name="id" value={t.id} />
                        <button className="text-xs text-sky-600 underline">nochmal versuchen</button>
                      </form>
                    )}
                  </li>
                ))}
            </ul>
          </section>
        ))}
      </main>
    </>
  );
}
