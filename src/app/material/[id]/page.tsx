import Link from "next/link";
import { notFound } from "next/navigation";
import { Nav } from "@/components/Nav";
import { MaterialListe, Suche } from "@/components/MaterialListe";
import { requireUser } from "@/lib/supabase/server";

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
  const { data: kurs } = await supabase.from("courses").select("id, name").eq("id", id).maybeSingle();
  if (!kurs) notFound();
  let abfrage = supabase.from("materials").select("id, course_id, ordner, dateiname, groesse, updated_at").eq("course_id", id);
  if (q.trim()) abfrage = abfrage.textSearch("such", q, { config: "german", type: "websearch" });
  const { data } = await abfrage.limit(1000);

  return (
    <>
      <Nav />
      <main className="mx-auto max-w-3xl px-4 py-6 flex flex-col gap-4">
        <Link href="/material" className="text-sm text-zinc-500">← Alle Kurse</Link>
        <h1 className="text-2xl font-semibold">{kurs.name}</h1>
        <Suche q={q} ziel={`/material/${id}`} />
        {q.trim() && <p className="text-sm text-zinc-500">{data?.length ?? 0} Treffer für „{q}“</p>}
        <MaterialListe dateien={data ?? []} />
      </main>
    </>
  );
}
