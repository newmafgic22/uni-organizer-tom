import Link from "next/link";
import { notFound } from "next/navigation";
import { Nav } from "@/components/Nav";
import { MaterialListe, Suche } from "@/components/MaterialListe";
import { requireUser } from "@/lib/supabase/server";
import { alleEinreihen, autoAus, klausurInfoSpeichern } from "@/app/lernen/actions";
import { lohntThema } from "@/lib/einreihen";

export const dynamic = "force-dynamic";

export default async function KursMaterial({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ q?: string }>;
}) {
  const { id } = await params;
  const { q = "" } = await searchParams;
  const { supabase } = await requireUser();
  const { data: kurs } = await supabase.from("courses").select("id, name, klausur_info, auto_einreihen").eq("id", id).maybeSingle();
  if (!kurs) notFound();
  let abfrage = supabase.from("materials").select("id, course_id, ordner, dateiname, groesse, updated_at, hat_text").eq("course_id", id);
  if (q.trim()) abfrage = abfrage.textSearch("such", q, { config: "german", type: "websearch" });
  const { data } = await abfrage.limit(1000);
  const { data: lt } = await supabase.from("lernthemen").select("id, status, material_id").eq("course_id", id);
  const themen = Object.fromEntries((lt ?? []).map((t) => [t.material_id, { id: t.id, status: t.status }]));
  const offen = q.trim() ? 0 : (data ?? []).filter((m) => lohntThema(m) && !themen[m.id]).length;

  return (
    <>
      <Nav />
      <main className="mx-auto max-w-3xl px-4 py-6 flex flex-col gap-4">
        <Link href="/material" className="text-sm text-zinc-500">← Alle Kurse</Link>
        <h1 className="text-2xl font-semibold">{kurs.name}</h1>
        <div className="karte flex flex-col gap-3">
          <div className="flex flex-wrap items-center gap-3">
            {offen > 0 || !kurs.auto_einreihen ? (
              <form action={alleEinreihen}>
                <input type="hidden" name="kurs_id" value={kurs.id} />
                <button className="rounded-md bg-sky-600 px-3 py-1.5 text-sm font-medium text-white">
                  {offen > 0 ? `Alle Vorlesungen einreihen (${offen})` : "Neue Vorlesungen automatisch einreihen"}
                </button>
              </form>
            ) : null}
            {kurs.auto_einreihen && (
              <form action={autoAus} className="flex items-center gap-2 text-sm text-zinc-500">
                <input type="hidden" name="kurs_id" value={kurs.id} />
                <span>✓ Neue Vorlesungen kommen automatisch dazu.</span>
                <button className="underline">aus</button>
              </form>
            )}
          </div>
          <details>
            <summary className="cursor-pointer text-sm font-medium">
              Infos zur Klausur {kurs.klausur_info ? "✓" : "(noch leer)"}
            </summary>
            <form action={klausurInfoSpeichern} className="mt-2 flex flex-col gap-2">
              <input type="hidden" name="kurs_id" value={kurs.id} />
              <textarea
                name="klausur_info"
                defaultValue={kurs.klausur_info ?? ""}
                rows={6}
                placeholder="z. B. 90 Minuten, Multiple Choice + offene Fragen, relevant sind Vorlesung und Lehrbuch Kap. 3–5 …"
                className="w-full rounded-lg border border-zinc-300 bg-transparent p-2 text-sm dark:border-zinc-700"
              />
              <p className="text-xs text-zinc-500">Claude richtet Zusammenfassungen und Fragen danach aus (gilt für neu erstellte Themen).</p>
              <button className="self-start rounded-md border border-sky-600 px-3 py-1 text-sm text-sky-600">Speichern</button>
            </form>
          </details>
        </div>
        <Suche q={q} ziel={`/material/${id}`} />
        {q.trim() && <p className="text-sm text-zinc-500">{data?.length ?? 0} Treffer für „{q}“</p>}
        <MaterialListe dateien={data ?? []} themen={themen} />
      </main>
    </>
  );
}
