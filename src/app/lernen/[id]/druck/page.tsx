import { notFound } from "next/navigation";
import { Drucken } from "@/components/Drucken";
import { requireUser } from "@/lib/supabase/server";
import { markdown } from "@/lib/markdown";
import type { Aufgabe, KatalogFrage } from "@/lib/lernen";

export const dynamic = "force-dynamic";
const AFB = ["", "I", "II", "III"];

export default async function Druck({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const { supabase } = await requireUser();
  const { data: t } = await supabase
    .from("lernthemen")
    .select("titel, zusammenfassung, katalog, aufgaben, courses(name)")
    .eq("id", id)
    .maybeSingle();
  if (!t) notFound();
  const kurs = (t.courses as unknown as { name: string } | null)?.name;
  const katalog = (t.katalog ?? []) as KatalogFrage[];
  const aufgaben = (t.aufgaben ?? []) as Aufgabe[];

  return (
    <main className="druck mx-auto max-w-3xl px-6 py-8 flex flex-col gap-6 bg-white text-black">
      <Drucken />
      <div>
        <p className="text-sm">{kurs}</p>
        <h1 className="text-2xl font-semibold">{t.titel}</h1>
      </div>
      <section>
        <h2 className="text-xl font-semibold mb-2">1. Zusammenfassung</h2>
        <div className="prosa" dangerouslySetInnerHTML={{ __html: markdown(t.zusammenfassung ?? "") }} />
      </section>
      <section className="seitenumbruch">
        <h2 className="text-xl font-semibold mb-2">2. Abfragekatalog</h2>
        <table className="w-full border-collapse text-sm">
          <thead>
            <tr>
              <th className="border p-1 text-left w-8">#</th>
              <th className="border p-1 text-left">Frage</th>
              <th className="border p-1 w-12">AFB</th>
              <th className="border p-1 text-left">Antwort</th>
            </tr>
          </thead>
          <tbody>
            {katalog.map((k, i) => (
              <tr key={i} className="align-top">
                <td className="border p-1">{i + 1}</td>
                <td className="border p-1 whitespace-pre-line">
                  {k.frage}
                  {k.optionen && (
                    <ul className="mt-1 list-none">
                      {k.optionen.map((o, j) => (
                        <li key={j}>☐ {String.fromCharCode(97 + j)}) {o.text}</li>
                      ))}
                    </ul>
                  )}
                </td>
                <td className="border p-1 text-center">{AFB[k.afb]}</td>
                <td className="border p-1 whitespace-pre-line">
                  {k.optionen && (
                    <b>
                      Richtig:{" "}
                      {k.optionen.map((o, j) => (o.richtig ? String.fromCharCode(97 + j) : null)).filter(Boolean).join(", ")}
                      {"\n"}
                    </b>
                  )}
                  {k.antwort}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </section>
      <section className="seitenumbruch">
        <h2 className="text-xl font-semibold mb-2">3. Übungsaufgaben</h2>
        <ol className="flex flex-col gap-4 list-decimal pl-5">
          {aufgaben.map((a, i) => (
            <li key={i} className="whitespace-pre-line">
              <span className="text-xs">(AFB {AFB[a.afb]})</span> {a.aufgabe}
            </li>
          ))}
        </ol>
        <h3 className="text-lg font-semibold mt-6 mb-2 seitenumbruch">Lösungen</h3>
        <ol className="flex flex-col gap-4 list-decimal pl-5">
          {aufgaben.map((a, i) => (
            <li key={i} className="whitespace-pre-line">{a.loesung}</li>
          ))}
        </ol>
      </section>
    </main>
  );
}
