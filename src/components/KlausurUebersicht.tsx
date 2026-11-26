import Link from "next/link";
import type { Termin } from "@/lib/ical";
import { fmtDatum, fmtZeit } from "@/lib/zeit";

export type KlausurStand = {
  klausur: Termin;
  kursId: string | null;
  themenFertig: number;
  themenGesamt: number;
  sitzt: number;
  fragen: number;
};

function tageBis(d: Date) {
  return Math.ceil((d.getTime() - Date.now()) / 86_400_000);
}

/** Startseiten-Karte: alle anstehenden Klausuren mit Countdown und Lernstand. */
export function KlausurUebersicht({ liste }: { liste: KlausurStand[] }) {
  if (!liste.length)
    return (
      <p className="mt-2 text-sm text-zinc-500">
        Noch keine Klausur gefunden. Portal2-Termine erscheinen hier automatisch, sonst kannst du das Datum beim Kurs unter Material eintragen.
      </p>
    );
  const [erste, ...rest] = liste;
  const t = tageBis(erste.klausur.start);
  return (
    <div className="mt-2 flex flex-col gap-3">
      <div>
        <div className="text-4xl font-bold tabular-nums">
          {t} <span className="text-base font-normal text-zinc-500">{t === 1 ? "Tag" : "Tage"}</span>
        </div>
        <div className="mt-1 font-medium">{erste.klausur.titel}</div>
        <div className="text-sm text-zinc-500">
          {fmtDatum(erste.klausur.start)}
          {erste.klausur.ganztags ? "" : `, ${fmtZeit(erste.klausur.start)} Uhr`}
          {erste.klausur.ort ? ` · ${erste.klausur.ort}` : ""}
        </div>
        <Fortschritt s={erste} />
      </div>
      {rest.length > 0 && (
        <ul className="flex flex-col gap-2 border-t border-zinc-200 pt-3 text-sm dark:border-zinc-800">
          {rest.slice(0, 6).map((s) => (
            <li key={s.klausur.id}>
              <div className="flex justify-between gap-2">
                <span className="truncate">{s.klausur.titel.replace(/^Klausur\s+/, "")}</span>
                <span className="shrink-0 tabular-nums text-zinc-500">
                  {fmtDatum(s.klausur.start).replace(/^\w+\., /, "")} · {tageBis(s.klausur.start)} T
                </span>
              </div>
              <Fortschritt s={s} klein />
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

function Fortschritt({ s, klein = false }: { s: KlausurStand; klein?: boolean }) {
  if (!s.kursId || !s.themenGesamt) return null;
  const pSitzt = s.fragen ? Math.round((s.sitzt / s.fragen) * 100) : 0;
  const pFertig = Math.round((s.themenFertig / s.themenGesamt) * 100);
  return (
    <Link href={`/lernen/wiederholen?neu=1&kurs=${s.kursId}`} className={`block ${klein ? "mt-1" : "mt-3"}`} title="Kurs üben">
      <div className={`relative overflow-hidden rounded-full bg-zinc-200 dark:bg-zinc-800 ${klein ? "h-1.5" : "h-2"}`}>
        {/* hell: Lernmaterial fertig, kräftig: Fragen sitzen */}
        <span className="absolute inset-y-0 left-0 bg-emerald-200 dark:bg-emerald-900" style={{ width: `${pFertig}%` }} />
        <span className="absolute inset-y-0 left-0 bg-emerald-500" style={{ width: `${(pSitzt * pFertig) / 100}%` }} />
      </div>
      <div className="mt-0.5 text-xs text-zinc-500">
        {s.themenFertig < s.themenGesamt ? `${s.themenFertig}/${s.themenGesamt} Themen bereit · ` : ""}
        {s.sitzt}/{s.fragen} Fragen sitzen
      </div>
    </Link>
  );
}
