import Link from "next/link";
import { Nav } from "@/components/Nav";
import { MaterialListe, Suche } from "@/components/MaterialListe";
import { requireUser } from "@/lib/supabase/server";
import { natSort, type Material } from "@/lib/material";
import { anzeigeName } from "@/lib/lernen";
import { fmtDatum, fmtZeit } from "@/lib/zeit";
import { kursSichtbarkeit } from "./actions";
import { kursFarbe } from "@/lib/farben";

export const dynamic = "force-dynamic";

export default async function MaterialSeite({ searchParams }: { searchParams: Promise<{ q?: string; alle?: string }> }) {
  const { q = "", alle } = await searchParams;
  const { supabase } = await requireUser();
  const { data: kurse } = await supabase.from("courses").select("id, name, ausgeblendet, zuletzt_sync");
  const { data: zahlen } = await supabase.from("materials").select("course_id");
  const anzahl: Record<string, number> = {};
  (zahlen ?? []).forEach((m) => (anzahl[m.course_id] = (anzahl[m.course_id] ?? 0) + 1));
  const kursNamen = Object.fromEntries((kurse ?? []).map((k) => [k.id, anzeigeName(k.name)]));

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

  const sichtbar = (kurse ?? []).filter((k) => alle || !k.ausgeblendet).sort((a, b) => natSort(anzeigeName(a.name), anzeigeName(b.name)));
  const liste = sichtbar.filter((k) => anzahl[k.id]);
  const leer = sichtbar.filter((k) => !anzahl[k.id]);
  // Gleiche Anzeigenamen (z. B. Vorlesung + Übung) → Originalname dazuschreiben, damit man sie unterscheiden kann
  const namenZahl: Record<string, number> = {};
  sichtbar.forEach((k) => (namenZahl[anzeigeName(k.name)] = (namenZahl[anzeigeName(k.name)] ?? 0) + 1));
  const zusatz = (name: string) => (namenZahl[anzeigeName(name)] > 1 ? ` · ${name}` : "");
  const versteckt = (kurse ?? []).filter((k) => k.ausgeblendet).length;
  const letzter = (kurse ?? []).map((k) => k.zuletzt_sync).filter(Boolean).sort().pop();

  return (
    <>
      <Nav />
      <main className="mx-auto max-w-5xl px-4 py-6 sm:px-6 lg:py-10 flex flex-col gap-4 sm:gap-5">
        <h1 className="seitentitel">Material</h1>
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
            <ul className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
              {liste.map((k) => (
                <li key={k.id} className="karte karte-link flex items-center gap-3">
                  <span className="grid h-10 w-10 shrink-0 place-items-center rounded-xl text-sm font-bold text-white" style={{ background: kursFarbe(anzeigeName(k.name)) }} aria-hidden>
                    {anzeigeName(k.name).replace(/^(Grundlagen der|Einführung in die)\s+/i, "").charAt(0)}
                  </span>
                  <Link href={`/material/${k.id}`} className={`min-w-0 flex-1 ${k.ausgeblendet ? "text-zinc-400" : ""}`}>
                    <span className="font-semibold leading-snug">{anzeigeName(k.name)}</span>
                    <span className="block truncate text-xs text-zinc-500" title={k.name}>
                      {anzahl[k.id] ?? 0} Dateien{zusatz(k.name)}
                    </span>
                  </Link>
                  <Sichtbarkeit id={k.id} aus={k.ausgeblendet} />
                </li>
              ))}
            </ul>
            {leer.length > 0 && (
              <details className="text-sm">
                <summary className="cursor-pointer text-zinc-500">{leer.length} Kurse ohne Dateien</summary>
                <ul className="mt-2 flex flex-col divide-y divide-zinc-200 rounded-2xl border border-zinc-200 bg-white px-4 dark:divide-zinc-800 dark:border-zinc-800 dark:bg-zinc-900">
                  {leer.map((k) => (
                    <li key={k.id} className="flex items-center gap-3 py-2">
                      <Link href={`/material/${k.id}`} className="min-w-0 flex-1 truncate" title={k.name}>
                        {anzeigeName(k.name)}
                        <span className="text-xs text-zinc-500">{zusatz(k.name)}</span>
                      </Link>
                      <Sichtbarkeit id={k.id} aus={k.ausgeblendet} />
                    </li>
                  ))}
                </ul>
              </details>
            )}
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

function Sichtbarkeit({ id, aus }: { id: string; aus: boolean }) {
  return (
    <form action={kursSichtbarkeit}>
      <input type="hidden" name="id" value={id} />
      <input type="hidden" name="ausblenden" value={aus ? "0" : "1"} />
      <button className="text-xs text-zinc-500 underline">{aus ? "einblenden" : "ausblenden"}</button>
    </form>
  );
}
