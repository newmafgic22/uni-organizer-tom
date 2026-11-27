import Link from "next/link";
import { fmtGroesse, icon, natSort, type Material } from "@/lib/material";
import { themaAnlegen } from "@/app/lernen/actions";

export type ThemaKurz = { id: string; status: string };

export function MaterialListe({
  dateien,
  kursNamen,
  themen = {},
}: {
  dateien: Material[];
  kursNamen?: Record<string, string>;
  themen?: Record<string, ThemaKurz>;
}) {
  const gruppen = new Map<string, Material[]>();
  for (const d of dateien) {
    const key = (kursNamen ? `${kursNamen[d.course_id] ?? ""} › ` : "") + (d.ordner || "");
    if (!gruppen.has(key)) gruppen.set(key, []);
    gruppen.get(key)!.push(d);
  }
  const keys = [...gruppen.keys()].sort(natSort);
  if (!dateien.length) return <p className="text-sm text-zinc-500">Nichts gefunden.</p>;
  return (
    <div className="flex flex-col gap-4">
      {keys.map((k) => (
        <section key={k} className="karte">
          {k.replace(/ › $/, "") && <h2 className="abschnitt mb-2">{k.replace(/ › $/, "")}</h2>}
          <ul className="divide-y divide-zinc-200 dark:divide-zinc-800">
            {gruppen
              .get(k)!
              .sort((a, b) => natSort(a.dateiname, b.dateiname))
              .map((d) => (
                <li key={d.id} className="flex flex-wrap items-center gap-x-3 gap-y-1 py-2 sm:flex-nowrap">
                  <span aria-hidden>{icon(d.dateiname)}</span>
                  <a href={`/api/datei/${d.id}`} target="_blank" className="min-w-0 flex-1 break-words hover:text-accent-600 dark:hover:text-accent-400">
                    {d.dateiname.replace(/ \(Lernmodul\)\.txt$/, " (Lernmodul)")}
                  </a>
                  <LernKnopf d={d} t={themen[d.id]} />
                  <span className="whitespace-nowrap text-xs text-zinc-500">{fmtGroesse(d.groesse)}</span>
                  <a href={`/api/datei/${d.id}?download`} className="text-xs text-accent-600" title="Herunterladen">
                    ⬇
                  </a>
                </li>
              ))}
          </ul>
        </section>
      ))}
    </div>
  );
}

function LernKnopf({ d, t }: { d: Material; t?: ThemaKurz }) {
  if (t) {
    const text = t.status === "fertig" ? "🧠 Lernen" : t.status === "fehler" ? "⚠ Fehler" : "⏳ in Arbeit";
    return (
      <Link href={`/lernen/${t.id}`} className="chip hover:bg-zinc-200 dark:hover:bg-zinc-700">
        {text}
      </Link>
    );
  }
  if (!d.hat_text) return null;
  return (
    <form action={themaAnlegen}>
      <input type="hidden" name="material_id" value={d.id} />
      <button className="chip !bg-accent-50 !text-accent-700 hover:!bg-accent-100 dark:!bg-accent-500/15 dark:!text-accent-300" title="Zusammenfassung, Abfragekatalog und Übungsaufgaben erstellen lassen">
        + Lernmaterial
      </button>
    </form>
  );
}

export function Suche({ q, ziel }: { q: string; ziel: string }) {
  return (
    <form action={ziel} className="flex gap-2">
      <input
        name="q"
        defaultValue={q}
        placeholder="In Dateinamen und Inhalten suchen …"
        className="eingabe"
      />
      <button className="knopf">Suchen</button>
    </form>
  );
}
