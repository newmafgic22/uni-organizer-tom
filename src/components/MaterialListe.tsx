import { fmtGroesse, icon, natSort, type Material } from "@/lib/material";

export function MaterialListe({ dateien, kursNamen }: { dateien: Material[]; kursNamen?: Record<string, string> }) {
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
          {k.replace(/ › $/, "") && <h2 className="mb-2 text-sm font-semibold text-zinc-500">{k.replace(/ › $/, "")}</h2>}
          <ul className="divide-y divide-zinc-200 dark:divide-zinc-800">
            {gruppen
              .get(k)!
              .sort((a, b) => natSort(a.dateiname, b.dateiname))
              .map((d) => (
                <li key={d.id} className="flex items-center gap-3 py-2">
                  <span aria-hidden>{icon(d.dateiname)}</span>
                  <a href={`/api/datei/${d.id}`} target="_blank" className="flex-1 break-words hover:underline">
                    {d.dateiname.replace(/ \(Lernmodul\)\.txt$/, " (Lernmodul)")}
                  </a>
                  <span className="whitespace-nowrap text-xs text-zinc-500">{fmtGroesse(d.groesse)}</span>
                  <a href={`/api/datei/${d.id}?download`} className="text-xs text-sky-600" title="Herunterladen">
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

export function Suche({ q, ziel }: { q: string; ziel: string }) {
  return (
    <form action={ziel} className="flex gap-2">
      <input
        name="q"
        defaultValue={q}
        placeholder="In Dateinamen und Inhalten suchen …"
        className="w-full rounded-lg border border-zinc-300 bg-transparent px-3 py-2 dark:border-zinc-700"
      />
      <button className="rounded-lg bg-sky-600 px-4 py-2 font-medium text-white hover:bg-sky-700">Suchen</button>
    </form>
  );
}
