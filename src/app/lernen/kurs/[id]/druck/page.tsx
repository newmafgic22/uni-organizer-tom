import { notFound } from "next/navigation";
import { Drucken } from "@/components/Drucken";
import { requireUser } from "@/lib/supabase/server";
import { markdown } from "@/lib/markdown";
import { kurzTitel, type KatalogFrage } from "@/lib/lernen";
import { natSort } from "@/lib/material";

export const dynamic = "force-dynamic";
const AFB = ["", "I", "II", "III"];
const buchstabe = (j: number) => String.fromCharCode(97 + j);

/** Ein Lernzettel für den ganzen Kurs: alle fertigen Themen mit Zusammenfassung und Fragen (kompakt zum Ausdrucken). */
export default async function KursLernzettel({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ nur?: string }>;
}) {
  const { id } = await params;
  const { nur } = await searchParams;
  const { supabase } = await requireUser();
  const { data: kurs } = await supabase.from("courses").select("name").eq("id", id).maybeSingle();
  if (!kurs) notFound();
  const { data } = await supabase.from("lernthemen").select("id, titel, zusammenfassung, katalog").eq("course_id", id).eq("status", "fertig");
  const themen = (data ?? []).sort((a, b) => natSort(a.titel, b.titel));
  const mitZusammenfassung = nur !== "fragen";
  const mitFragen = nur !== "zusammenfassung";

  return (
    <main className="druck mx-auto max-w-3xl px-6 py-8 flex flex-col gap-6 bg-white text-black">
      <Drucken />
      <div>
        <p className="text-sm">Lernzettel</p>
        <h1 className="text-2xl font-semibold">{kurs.name}</h1>
        <p className="text-sm">
          {themen.length} Themen ·{" "}
          <a className="underline print:hidden" href="?nur=zusammenfassung">nur Zusammenfassungen</a>{" "}
          <a className="underline print:hidden" href="?nur=fragen">nur Fragen</a>{" "}
          <a className="underline print:hidden" href="?">alles</a>
        </p>
        <ol className="mt-3 list-decimal pl-5 text-sm">
          {themen.map((t) => (
            <li key={t.id}>{kurzTitel(t.titel)}</li>
          ))}
        </ol>
      </div>
      {themen.map((t, i) => {
        const katalog = (t.katalog ?? []) as KatalogFrage[];
        return (
          <section key={t.id} className={i > 0 || mitZusammenfassung ? "seitenumbruch" : ""}>
            <h2 className="text-xl font-semibold mb-2">{kurzTitel(t.titel)}</h2>
            {mitZusammenfassung && <div className="prosa" dangerouslySetInnerHTML={{ __html: markdown(t.zusammenfassung ?? "") }} />}
            {mitFragen && (
              <>
                <h3 className="mt-4 mb-1 font-semibold">Fragen</h3>
                <ol className="list-decimal pl-5 text-sm flex flex-col gap-2">
                  {katalog.map((k, j) => (
                    <li key={j} className="break-inside-avoid">
                      <span className="whitespace-pre-line">{k.frage}</span> <span className="text-xs">(AFB {AFB[k.afb]})</span>
                      {k.optionen && (
                        <ul className="list-none">
                          {k.optionen.map((o, x) => (
                            <li key={x}>
                              ☐ {buchstabe(x)}) {o.text}
                            </li>
                          ))}
                        </ul>
                      )}
                    </li>
                  ))}
                </ol>
                <h3 className="mt-4 mb-1 font-semibold">Lösungen</h3>
                <ol className="list-decimal pl-5 text-xs flex flex-col gap-1">
                  {katalog.map((k, j) => (
                    <li key={j} className="whitespace-pre-line break-inside-avoid">
                      {k.optionen && (
                        <b>
                          {k.optionen
                            .map((o, x) => (o.richtig ? buchstabe(x) : null))
                            .filter(Boolean)
                            .join(", ")}
                          {" – "}
                        </b>
                      )}
                      {k.antwort}
                    </li>
                  ))}
                </ol>
              </>
            )}
          </section>
        );
      })}
    </main>
  );
}
