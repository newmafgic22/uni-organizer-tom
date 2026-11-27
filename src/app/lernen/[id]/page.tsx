import Link from "next/link";
import { notFound } from "next/navigation";
import { Nav } from "@/components/Nav";
import { Abfrage } from "@/components/Abfrage";
import { requireUser } from "@/lib/supabase/server";
import { markdown } from "@/lib/markdown";
import { STATUS_TEXT, anzeigeName, kurzTitel, type Aufgabe, type KatalogFrage } from "@/lib/lernen";
import { themaLoeschen } from "../actions";
import { kursFarbe } from "@/lib/farben";

export const dynamic = "force-dynamic";

const TABS = [
  ["zusammenfassung", "Zusammenfassung"],
  ["katalog", "Abfragekatalog"],
  ["aufgaben", "Übungsaufgaben"],
] as const;
const AFB = ["", "AFB I", "AFB II", "AFB III"];

export default async function Thema({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ tab?: string }>;
}) {
  const { id } = await params;
  const { tab = "zusammenfassung" } = await searchParams;
  const { supabase } = await requireUser();
  const { data: t } = await supabase
    .from("lernthemen")
    .select("id, titel, status, fehler, zusammenfassung, katalog, aufgaben, material_id, courses(name)")
    .eq("id", id)
    .maybeSingle();
  if (!t) notFound();
  const kursRoh = (t.courses as unknown as { name: string } | null)?.name;
  const kurs = kursRoh ? anzeigeName(kursRoh) : undefined;
  const katalog = (t.katalog ?? []) as KatalogFrage[];
  const aufgaben = (t.aufgaben ?? []) as Aufgabe[];

  return (
    <>
      <Nav />
      <main className="mx-auto max-w-3xl px-4 py-6 sm:px-6 lg:py-10 flex flex-col gap-4 sm:gap-5">
        <Link href="/lernen" className="text-sm font-medium text-zinc-500 hover:text-zinc-900 dark:hover:text-zinc-100">← Alle Themen</Link>
        <div>
          {kurs && (
            <p className="flex items-center gap-2 text-sm font-medium text-zinc-500">
              <span className="h-2.5 w-2.5 rounded-full" style={{ background: kursFarbe(kurs) }} aria-hidden />
              {kurs}
            </p>
          )}
          <h1 className="seitentitel">{kurzTitel(t.titel)}</h1>
          <p className="mt-3 flex flex-wrap gap-2">
            <a href={`/api/datei/${t.material_id}`} target="_blank" className="knopf-2 !py-1.5">Original öffnen</a>
            {t.status === "fertig" && (
              <Link href={`/lernen/${t.id}/druck`} className="knopf-2 !py-1.5">Als PDF</Link>
            )}
          </p>
        </div>

        {t.status !== "fertig" ? (
          <div className="karte flex flex-col gap-2">
            <p>Status: {STATUS_TEXT[t.status]}</p>
            {t.fehler && <p className="text-sm text-zinc-500">{t.fehler}</p>}
            <p className="text-sm text-zinc-500">Der Lernlauf schaut jede Stunde nach. Du musst nichts tun.</p>
          </div>
        ) : (
          <>
            <nav className="sticky top-2 z-10 grid grid-cols-3 gap-1 rounded-2xl border border-zinc-200 bg-white/90 p-1 shadow-sm backdrop-blur-xl sm:top-16 lg:top-3 dark:border-zinc-800 dark:bg-zinc-900/90">
              {TABS.map(([k, label]) => (
                <Link
                  key={k}
                  href={`?tab=${k}`}
                  className={`rounded-xl px-2 py-2 text-center text-sm transition-colors ${tab === k ? "bg-accent-600 font-semibold text-white shadow-sm dark:bg-accent-500" : "text-zinc-600 hover:bg-zinc-100 dark:text-zinc-400 dark:hover:bg-zinc-800"}`}
                >
                  {label}
                </Link>
              ))}
            </nav>
            {tab === "zusammenfassung" && (
              <article className="prosa karte" dangerouslySetInnerHTML={{ __html: markdown(t.zusammenfassung ?? "") }} />
            )}
            {tab === "katalog" && <Abfrage themaId={t.id} karten={katalog} />}
            {tab === "aufgaben" && (
              <ol className="flex flex-col gap-3">
                {aufgaben.map((a, i) => (
                  <li key={i} className="karte flex flex-col gap-2">
                    <div className="flex justify-between text-xs text-zinc-500">
                      <span>Aufgabe {i + 1}</span>
                      <span className="chip">{AFB[a.afb]}</span>
                    </div>
                    <p className="whitespace-pre-line font-medium leading-relaxed">{a.aufgabe}</p>
                    <details>
                      <summary className="cursor-pointer text-sm font-medium text-accent-600 dark:text-accent-400">Lösung anzeigen</summary>
                      <p className="mt-2 whitespace-pre-line rounded-xl border-l-4 border-accent-400 bg-zinc-50 p-4 dark:bg-zinc-800/60">{a.loesung}</p>
                    </details>
                  </li>
                ))}
              </ol>
            )}
          </>
        )}
        <form action={themaLoeschen} className="mt-6">
          <input type="hidden" name="id" value={t.id} />
          <button className="text-xs text-zinc-400 underline">Thema entfernen</button>
        </form>
      </main>
    </>
  );
}
