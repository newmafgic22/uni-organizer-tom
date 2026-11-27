import { linkGesehen, linkSichtbarkeit, linkWichtig } from "@/app/links/actions";
import { anzeigeName, KATEGORIE_ICON, KATEGORIE_TEXT, type Kategorie } from "@/lib/links";

export type LinkEintrag = {
  id: string;
  course_id: string;
  url: string;
  titel: string | null;
  kategorie: string;
  wichtig: boolean;
  gesehen: boolean;
  ausgeblendet: boolean;
  fundstelle: string | null;
  quelle: string;
};

const kat = (k: string) => (k in KATEGORIE_TEXT ? (k as Kategorie) : "sonstiges");
const RANG: Kategorie[] = ["lerntool", "test", "uebung", "lernmodul", "video", "literatur", "live", "meeting", "sonstiges", "studie"];

function Kachel({ l, kurs }: { l: LinkEintrag; kurs?: string }) {
  const k = kat(l.kategorie);
  return (
    <li className="flex items-start gap-3 rounded-xl border border-zinc-200 p-3 transition-colors hover:bg-zinc-50 dark:border-zinc-800 dark:hover:bg-zinc-800/40">
      <span aria-hidden className="text-2xl leading-none">{KATEGORIE_ICON[k]}</span>
      <div className="min-w-0 flex-1">
        <div className="flex flex-wrap items-center gap-2">
          <a href={l.url} target="_blank" rel="noreferrer" className="font-medium hover:underline break-words">
            {anzeigeName(l.url, l.titel)}
          </a>
          {!l.gesehen && <span className="rounded bg-accent-600 px-1.5 py-0.5 text-[10px] font-semibold uppercase text-white">Neu</span>}
        </div>
        <div className="text-xs text-zinc-500 break-words">
          {KATEGORIE_TEXT[k]}
          {kurs ? ` · ${kurs}` : ""}

        </div>
      </div>
      <div className="flex shrink-0 flex-col items-end gap-1 text-xs">
        {!l.gesehen && (
          <form action={linkGesehen}>
            <input type="hidden" name="id" value={l.id} />
            <button className="text-accent-600 underline">gesehen</button>
          </form>
        )}
        <form action={linkWichtig}>
          <input type="hidden" name="id" value={l.id} />
          <input type="hidden" name="wichtig" value="0" />
          <button className="text-zinc-500 underline" title="Nicht mehr hervorheben">unwichtig</button>
        </form>
      </div>
    </li>
  );
}

/** Hervorgehobene Lerntools (Kurs-Seite und Startseite). */
export function LerntoolKacheln({ links, kursNamen }: { links: LinkEintrag[]; kursNamen?: Record<string, string> }) {
  const liste = links
    .filter((l) => l.wichtig && !l.ausgeblendet)
    .sort((a, b) => Number(a.gesehen) - Number(b.gesehen) || RANG.indexOf(kat(a.kategorie)) - RANG.indexOf(kat(b.kategorie)));
  if (!liste.length) return null;
  return (
    <ul className="grid gap-2 sm:grid-cols-2">
      {liste.map((l) => (
        <Kachel key={l.id} l={l} kurs={kursNamen?.[l.course_id]} />
      ))}
    </ul>
  );
}

/** Alle weiteren Links eines Kurses, eingeklappt und nach Art sortiert. Umfragen/Studien ganz unten. */
export function WeitereLinks({ links }: { links: LinkEintrag[] }) {
  const rest = links.filter((l) => !l.wichtig && !l.ausgeblendet);
  const aus = links.filter((l) => l.ausgeblendet);
  if (!rest.length && !aus.length) return null;
  const gruppen = RANG.map((k) => [k, rest.filter((l) => kat(l.kategorie) === k)] as const).filter(([, l]) => l.length);
  return (
    <details className="text-sm">
      <summary className="cursor-pointer text-zinc-500">Weitere Links ({rest.length})</summary>
      <div className="mt-2 flex flex-col gap-3">
        {gruppen.map(([k, l]) => (
          <div key={k}>
            <h3 className="text-xs font-semibold uppercase tracking-wide text-zinc-500">{KATEGORIE_ICON[k]} {KATEGORIE_TEXT[k]}</h3>
            <ul className="mt-1 flex flex-col gap-1">
              {l.map((x) => (
                <li key={x.id} className="flex flex-wrap items-center gap-x-2">
                  <a href={x.url} target="_blank" rel="noreferrer" className="min-w-0 break-all text-accent-600 hover:underline">
                    {anzeigeName(x.url, x.titel)}
                  </a>
                  {x.fundstelle && <span className="text-xs text-zinc-500">({x.fundstelle})</span>}
                  <form action={linkWichtig} className="inline">
                    <input type="hidden" name="id" value={x.id} />
                    <input type="hidden" name="wichtig" value="1" />
                    <button className="text-xs text-zinc-500 underline" title="Oben als Lerntool zeigen">hervorheben</button>
                  </form>
                  <form action={linkSichtbarkeit} className="inline">
                    <input type="hidden" name="id" value={x.id} />
                    <input type="hidden" name="ausblenden" value="1" />
                    <button className="text-xs text-zinc-500 underline">ausblenden</button>
                  </form>
                </li>
              ))}
            </ul>
          </div>
        ))}
        {aus.length > 0 && <p className="text-xs text-zinc-500">{aus.length} ausgeblendet.</p>}
      </div>
    </details>
  );
}
