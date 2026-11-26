import Link from "next/link";
import { notFound } from "next/navigation";
import { Nav } from "@/components/Nav";
import { Abfrage, type Karte } from "@/components/Abfrage";
import { requireUser } from "@/lib/supabase/server";
import { anzeigeName, klausurFuer, kurzTitel, type KatalogFrage } from "@/lib/lernen";
import type { Termin } from "@/lib/ical";
import { probeAuswahl } from "@/lib/probeklausur";

export const dynamic = "force-dynamic";

export default async function Probeklausur({ searchParams }: { searchParams: Promise<{ kurs?: string; n?: string }> }) {
  const { kurs, n } = await searchParams;
  if (!kurs) notFound();
  const { supabase } = await requireUser();
  const { data: k } = await supabase.from("courses").select("id, name, klausur_info").eq("id", kurs).maybeSingle();
  if (!k) notFound();
  const { data } = await supabase.from("lernthemen").select("id, titel, katalog").eq("course_id", kurs).eq("status", "fertig");
  const themen = (data ?? []).map((t) => ({ id: t.id, titel: kurzTitel(t.titel), katalog: (t.katalog ?? []) as KatalogFrage[] }));
  // echte Klausurdauer aus der Portal2-Anmeldung (z. B. Quantitative Methoden: 45 Minuten) hat Vorrang
  const { data: pr } = await supabase.from("pruefungen").select("titel, beginn, ende").eq("angemeldet", true).not("ende", "is", null);
  const anm = (pr ?? []).find((p) => klausurFuer(k.name, [{ titel: p.titel } as Termin]));
  const dauer = anm ? Math.round((Date.parse(anm.ende) - Date.parse(anm.beginn)) / 60000) : 0;
  const info = (dauer > 0 ? `${dauer} Minuten. ` : "") + (k.klausur_info ?? "");
  const { karten, minuten, mcBevorzugt } = probeAuswahl(themen, info, Number(n) || 30);
  const liste: Karte[] = karten.map((x) => ({ ...x.frage, themaId: x.themaId, nr: x.nr, thema: x.thema }));

  return (
    <>
      <Nav />
      <main className="mx-auto max-w-3xl px-4 py-6 flex flex-col gap-4">
        <Link href="/lernen" className="text-sm text-zinc-500">← Lernen</Link>
        <h1 className="text-2xl font-semibold">Probeklausur</h1>
        <p className="text-sm text-zinc-500">
          {anzeigeName(k.name)} · {liste.length} Fragen aus {themen.length} Themen · {minuten} Minuten{mcBevorzugt ? " · vor allem Multiple Choice wie in der Klausur" : ""}.
          Offene Fragen bewertest du selbst ehrlich, MC wird automatisch bewertet. Bestanden ab 50 %.
        </p>
        {liste.length ? (
          <Abfrage
            karten={liste}
            zeitMin={minuten}
            bestehen={50}
            ende={
              <div className="flex flex-wrap gap-2">
                <a href={`/lernen/probeklausur?kurs=${k.id}`} className="rounded-md bg-sky-600 px-3 py-1 text-sm text-white">
                  Neue Probeklausur
                </a>
                <a href={`/lernen/wiederholen?kurs=${k.id}`} className="rounded-md border border-sky-600 px-3 py-1 text-sm text-sky-600">
                  Fehler wiederholen
                </a>
              </div>
            }
          />
        ) : (
          <p className="karte text-sm text-zinc-500">Für diesen Kurs ist noch kein Lernmaterial fertig.</p>
        )}
      </main>
    </>
  );
}
