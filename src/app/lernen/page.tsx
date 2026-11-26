import Link from "next/link";
import { Nav } from "@/components/Nav";
import { requireUser } from "@/lib/supabase/server";
import { STATUS_TEXT } from "@/lib/lernen";
import { natSort } from "@/lib/material";
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
  katalog: unknown[] | null;
  courses: { name: string } | null;
};

export default async function Lernen({ searchParams }: { searchParams: Promise<{ hinweis?: string }> }) {
  const { hinweis } = await searchParams;
  const { supabase } = await requireUser();
  const { data } = await supabase
    .from("lernthemen")
    .select("id, titel, status, sofort, klausur_am, fehler, katalog, courses(name)")
    .order("created_at");
  const themen = (data ?? []) as unknown as Zeile[];
  const { data: antw } = await supabase.from("antworten").select("thema_id, bewertung");
  const quote: Record<string, { r: number; n: number }> = {};
  (antw ?? []).forEach((a) => {
    const q = (quote[a.thema_id] ??= { r: 0, n: 0 });
    q.n++;
    q.r += a.bewertung === "richtig" ? 1 : a.bewertung === "teilweise" ? 0.5 : 0;
  });

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
            <h2 className="font-semibold">{kurs}</h2>
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
                    {t.status === "fertig" && quote[t.id] && (
                      <span className="text-xs text-zinc-500">{Math.round((quote[t.id].r / quote[t.id].n) * 100)} % gewusst</span>
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
