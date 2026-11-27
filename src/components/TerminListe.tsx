import { istKlausur, type Termin } from "@/lib/ical";
import { kurz, kursFarbeBekannt } from "@/lib/farben";
import { fmtTag, fmtZeit, tagKey } from "@/lib/zeit";
import { anzeigeName } from "@/lib/lernen";

const FARBE: Record<string, string> = {
  ilias: "#0ea5e9",
  portal2: "#10b981",
  sonstig: "#9aa2b1",
  lernplan: "#8b5cf6",
};

export function TerminZeile({ t }: { t: Termin }) {
  const titel = kurz(t.quelle === "portal2" || t.quelle === "ilias" || t.kategorie === "Prüfung" ? anzeigeName(t.titel) : t.titel).replace(/^\p{Extended_Pictographic}\uFE0F?\s*/u, "");
  const farbe = kursFarbeBekannt(t.titel) ?? FARBE[t.quelle];
  const link = t.quelle === "lernplan" ? t.beschreibung?.match(/https?:\/\/\S+/)?.[0].replace(/^https?:\/\/[^/]+/, "") : undefined;
  return (
    <li className="flex gap-3 py-2.5">
      <span className="w-1 shrink-0 self-stretch rounded-full" style={{ background: farbe }} aria-hidden />
      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-2 text-xs text-zinc-500 tabular-nums dark:text-zinc-400">
          <span>{t.ganztags ? "ganztags" : `${fmtZeit(t.start)} – ${fmtZeit(t.ende)}`}</span>
          {t.quelle === "lernplan" && <span className="chip !px-1.5 !py-0 text-[10px]">Lernblock</span>}
          {istKlausur(t) && <span className="chip !bg-red-100 !px-1.5 !py-0 text-[10px] !text-red-700 dark:!bg-red-500/15 dark:!text-red-300">Klausur</span>}
        </div>
        {link ? (
          <a href={link} className="mt-0.5 block font-medium leading-snug break-words hover:underline">
            {titel}
          </a>
        ) : (
          <div className="mt-0.5 font-medium leading-snug break-words">{titel}</div>
        )}
        {t.ort && <div className="truncate text-xs text-zinc-500 dark:text-zinc-400" title={t.ort}>{t.ort.split(/[,(]/)[0]}</div>}
      </div>
    </li>
  );
}

export function TerminListe({ termine, leer = "Keine Termine." }: { termine: Termin[]; leer?: string }) {
  if (termine.length === 0) return <p className="text-sm text-zinc-500 py-2">{leer}</p>;
  return (
    <ul className="divide-y divide-zinc-100 dark:divide-zinc-800">
      {termine.map((t) => (
        <TerminZeile key={t.id} t={t} />
      ))}
    </ul>
  );
}

/** Termine nach Tagen gruppiert, mit Tagesüberschrift */
export function TerminTage({ termine, leer = "Keine Termine." }: { termine: Termin[]; leer?: string }) {
  if (termine.length === 0) return <p className="text-sm text-zinc-500 py-2">{leer}</p>;
  const tage = new Map<string, Termin[]>();
  for (const t of termine) {
    const k = tagKey(t.start);
    if (!tage.has(k)) tage.set(k, []);
    tage.get(k)!.push(t);
  }
  return (
    <div className="flex flex-col gap-3">
      {[...tage].map(([k, liste]) => (
        <div key={k}>
          <h3 className="mt-2 text-sm font-semibold text-zinc-700 dark:text-zinc-300">{fmtTag(k)}</h3>
          <TerminListe termine={liste} />
        </div>
      ))}
    </div>
  );
}

export function Fehler({ fehler }: { fehler: string[] }) {
  if (!fehler.length) return null;
  return (
    <div className="rounded-2xl border border-amber-300 bg-amber-50 p-4 text-sm text-amber-900 dark:border-amber-700 dark:bg-amber-950 dark:text-amber-200">
      <b>Ein Kalender konnte nicht geladen werden:</b>
      <ul className="list-disc pl-5">{fehler.map((f) => <li key={f}>{f}</li>)}</ul>
    </div>
  );
}

export function Legende() {
  return (
    <div className="hidden flex-wrap gap-3 text-xs text-zinc-500 sm:flex">
      <span className="flex items-center gap-1.5"><span className="h-2 w-2 rounded-full bg-sky-500" />ILIAS</span>
      <span className="flex items-center gap-1.5"><span className="h-2 w-2 rounded-full bg-emerald-500" />Portal2</span>
      <span className="flex items-center gap-1.5"><span className="h-2 w-2 rounded-full bg-violet-500" />Lernplan</span>
      <span className="hidden items-center gap-1.5 sm:flex"><span className="h-2 w-2 rounded-full bg-gradient-to-r from-amber-500 via-pink-500 to-blue-500" />Kursfarbe</span>
    </div>
  );
}
