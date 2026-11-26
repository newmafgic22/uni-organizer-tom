import Link from "next/link";
import { Nav } from "@/components/Nav";
import { MaterialListe, Suche } from "@/components/MaterialListe";
import { requireUser } from "@/lib/supabase/server";
import { natSort, type Material } from "@/lib/material";
import { fmtDatum, fmtZeit } from "@/lib/zeit";
import { kursSichtbarkeit } from "./actions";

export const dynamic = "force-dynamic";

export default async function MaterialSeite({ searchParams }: { searchParams: Promise<{ q?: string; alle?: string }> }) {
  const { q = "", alle } = await searchParams;
  const { supabase } = await requireUser();
  const { data: kurse } = await supabase.from("courses").select("id, name, ausgeblendet, zuletzt_sync");
  const { data: zahlen } = await supabase.from("materials").select("course_id");
  const anzahl: Record<string, number> = {};
  (zahlen ?? []).forEach((m) => (anzahl[m.course_id] = (anzahl[m.course_id] ?? 0) + 1));
  const kursNamen = Object.fromEntries((kurse ?? []).map((k) => [k.id, k.name]));

  let treffer: Material[] = [];
  if (q.trim()) {
    const { data } = await supabase
      .from("materials")
      .select("id, course_id, ordner, dateiname, groesse, updated_at, hat_text")
      .textSearch("such", q, { config: "german", type: "websearch" })
      .limit(100);
    treffer = data ?? [];
  }
  const { data: lt } = q.trim() ? await supabase.from("lernthemen").select("id, status, material_id") : { data: [] };
  const themen = Object.fromEntries((lt ?? []).map((t) => [t.material_id, { id: t.id, status: t.status }]));

  const liste = (kurse ?? []).filter((k) => alle || !k.ausgeblendet).sort((a, b) => natSort(a.name, b.name));
  const versteckt = (kurse ?? []).filter((k) => k.ausgeblendet).length;
  const letzter = (kurse ?? []).map((k) => k.zuletzt_sync).filter(Boolean).sort().pop();

  return (
    <>
      <Nav />
      <main className="mx-auto max-w-3xl px-4 py-6 flex flex-col gap-4">
        <h1 className="text-2xl font-semibold">Material</h1>
        <Suche q={q} ziel="/material" />

        {q.trim() ? (
          <>
            <p className="text-sm text-zinc-500">
              {treffer.length} Treffer für „{q}“ · <Link href="/material" className="underline">zurück</Link>
            </p>
            <MaterialListe dateien={treffer} kursNamen={kursNamen} themen={themen} />
          </>
        ) : (
          <>
            {!kurse?.length && (
              <p className="karte text-sm text-zinc-500">
                Noch keine Kurse. Sobald das Sync-Skript auf deinem PC einmal gelaufen ist, erscheinen hier deine ILIAS-Kurse.
              </p>
            )}
            <ul className="flex flex-col gap-2">
              {liste.map((k) => (
                <li key={k.id} className="karte flex items-center gap-3">
                  <Link href={`/material/${k.id}`} className={`flex-1 ${k.ausgeblendet ? "text-zinc-400" : ""}`}>
                    <span className="font-medium">{k.name}</span>
                    <span className="block text-xs text-zinc-500">{anzahl[k.id] ?? 0} Dateien</span>
                  </Link>
                  <form action={kursSichtbarkeit}>
                    <input type="hidden" name="id" value={k.id} />
                    <input type="hidden" name="ausblenden" value={k.ausgeblendet ? "0" : "1"} />
                    <button className="text-xs text-zinc-500 underline">{k.ausgeblendet ? "einblenden" : "ausblenden"}</button>
                  </form>
                </li>
              ))}
            </ul>
            <p className="text-xs text-zinc-500">
              {letzter ? `Letzter Sync: ${fmtDatum(new Date(letzter))}, ${fmtZeit(new Date(letzter))} Uhr. ` : ""}
              Ausgeblendete Kurse werden nicht mehr synchronisiert.{" "}
              {versteckt > 0 &&
                (alle ? (
                  <Link href="/material" className="underline">Ausgeblendete verstecken</Link>
                ) : (
                  <Link href="/material?alle=1" className="underline">{versteckt} ausgeblendete zeigen</Link>
                ))}
            </p>
          </>
        )}
      </main>
    </>
  );
}
