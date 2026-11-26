import type { Termin } from "@/lib/ical";
import { fmtZeit } from "@/lib/zeit";

const FARBE: Record<string, string> = {
  ilias: "bg-sky-500",
  portal2: "bg-emerald-500",
  sonstig: "bg-zinc-400",
  lernplan: "bg-violet-500",
};

export function TerminZeile({ t }: { t: Termin }) {
  return (
    <li className="flex gap-3 py-2">
      <span className={`mt-1.5 h-2.5 w-2.5 shrink-0 rounded-full ${FARBE[t.quelle]}`} aria-hidden />
      <div className="min-w-0">
        <div className="text-sm text-zinc-500 dark:text-zinc-400 tabular-nums">
          {t.ganztags ? "ganztags" : `${fmtZeit(t.start)} – ${fmtZeit(t.ende)}`}
        </div>
        {t.quelle === "lernplan" && t.beschreibung?.match(/https?:\/\/\S+/) ? (
          <a href={t.beschreibung.match(/https?:\/\/\S+/)![0].replace(/^https?:\/\/[^/]+/, "")} className="font-medium leading-snug break-words text-violet-700 hover:underline dark:text-violet-400">
            {t.titel}
          </a>
        ) : (
          <div className="font-medium leading-snug break-words">{t.titel}</div>
        )}
        {t.ort && <div className="text-sm text-zinc-500 dark:text-zinc-400 break-words">{t.ort}</div>}
      </div>
    </li>
  );
}

export function TerminListe({ termine, leer = "Keine Termine." }: { termine: Termin[]; leer?: string }) {
  if (termine.length === 0) return <p className="text-sm text-zinc-500 py-2">{leer}</p>;
  return (
    <ul className="divide-y divide-zinc-200 dark:divide-zinc-800">
      {termine.map((t) => (
        <TerminZeile key={t.id} t={t} />
      ))}
    </ul>
  );
}

export function Fehler({ fehler }: { fehler: string[] }) {
  if (!fehler.length) return null;
  return (
    <div className="rounded-lg border border-amber-300 bg-amber-50 p-3 text-sm text-amber-900 dark:border-amber-700 dark:bg-amber-950 dark:text-amber-200">
      <b>Ein Kalender konnte nicht geladen werden:</b>
      <ul className="list-disc pl-5">{fehler.map((f) => <li key={f}>{f}</li>)}</ul>
    </div>
  );
}

export function Legende() {
  return (
    <div className="flex gap-4 text-xs text-zinc-500">
      <span className="flex items-center gap-1.5"><span className="h-2 w-2 rounded-full bg-sky-500" />ILIAS</span>
      <span className="flex items-center gap-1.5"><span className="h-2 w-2 rounded-full bg-emerald-500" />Portal2</span>
      <span className="flex items-center gap-1.5"><span className="h-2 w-2 rounded-full bg-violet-500" />Lernplan</span>
    </div>
  );
}
