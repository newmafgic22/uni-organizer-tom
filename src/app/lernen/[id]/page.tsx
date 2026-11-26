import Link from "next/link";
import { notFound } from "next/navigation";
import { Nav } from "@/components/Nav";
import { Abfrage } from "@/components/Abfrage";
import { requireUser } from "@/lib/supabase/server";
import { markdown } from "@/lib/markdown";
import { STATUS_TEXT, anzeigeName, kurzTitel, type Aufgabe, type KatalogFrage } from "@/lib/lernen";
import { themaLoeschen } from "../actions";

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
      <main className="mx-auto max-w-3xl px-4 py-6 flex flex-col gap-4">
        <Link href="/lernen" className="text-sm text-zinc-500">← Alle Themen</Link>
        <div>
          <p className="text-sm text-zinc-500">{kurs}</p>
          <h1 className="text-2xl font-semibold">{kurzTitel(t.titel)}</h1>
          <p className="text-sm">
            <a href={`/api/datei/${t.material_id}`} target="_blank" className="text-sky-600 underline">Original öffnen</a>
            {t.status === "fertig" && (
              <>
                {" · "}
                <Link href={`/lernen/${t.id}/druck`} className="text-sky-600 underline">Als PDF</Link>
              </>
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
            <nav className="flex gap-1 border-b border-zinc-200 dark:border-zinc-800">
              {TABS.map(([k, label]) => (
                <Link
                  key={k}
                  href={`?tab=${k}`}
                  className={`px-3 py-2 text-sm ${tab === k ? "border-b-2 border-sky-600 font-medium" : "text-zinc-500"}`}
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
                      <span>{AFB[a.afb]}</span>
                    </div>
                    <p className="whitespace-pre-line">{a.aufgabe}</p>
                    <details>
                      <summary className="cursor-pointer text-sm text-sky-600">Lösung anzeigen</summary>
                      <p className="mt-2 whitespace-pre-line rounded-lg bg-zinc-50 p-3 dark:bg-zinc-900">{a.loesung}</p>
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
