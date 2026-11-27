import Link from "next/link";
import type { Termin } from "@/lib/ical";
import { kurz, kursFarbe } from "@/lib/farben";
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
const ohneKlausur = (t: string) => t.replace(/^Klausur:?\s+/i, "");
const prozent = (s: KlausurStand) => (s.fragen ? Math.round((s.sitzt / s.fragen) * 100) : 0);

/** Große Karte für die nächste Klausur: Countdown, Lernstand, direkt üben. */
export function KlausurHero({ s }: { s?: KlausurStand }) {
  if (!s)
    return (
      <section className="karte">
        <h2 className="abschnitt">Nächste Klausur</h2>
        <p className="mt-2 text-sm text-zinc-500">
          Noch keine Klausur gefunden. Portal2-Termine erscheinen hier automatisch, sonst kannst du das Datum beim Kurs unter Material eintragen.
        </p>
      </section>
    );
  const t = tageBis(s.klausur.start);
  const farbe = kursFarbe(s.klausur.titel);
  const p = prozent(s);
  return (
    <section
      className="karte relative overflow-hidden"
      style={{ backgroundImage: `radial-gradient(120% 140% at 100% 0%, ${farbe}26, transparent 55%)` }}
    >
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div className="min-w-0">
          <h2 className="abschnitt">Nächste Klausur</h2>
          <div className="mt-2 flex items-baseline gap-2">
            <span className="text-5xl font-bold tracking-tight tabular-nums sm:text-6xl" style={{ color: farbe }}>
              {t}
            </span>
            <span className="text-lg text-zinc-500">{t === 1 ? "Tag" : "Tage"}</span>
          </div>
          <div className="mt-2 text-xl leading-snug font-semibold" title={ohneKlausur(s.klausur.titel)}>{kurz(s.klausur.titel)}</div>
          <div className="text-sm text-zinc-500">
            {fmtDatum(s.klausur.start)}
            {s.klausur.ganztags ? "" : `, ${fmtZeit(s.klausur.start)} Uhr`}
            {s.klausur.ort ? ` · ${s.klausur.ort}` : ""}
          </div>
        </div>
        {s.kursId && s.fragen > 0 && (
          <div className="flex gap-2">
            <Link href={`/lernen/wiederholen?neu=1&kurs=${s.kursId}`} className="knopf">
              Kurs üben
            </Link>
            <Link href={`/lernen/probeklausur?kurs=${s.kursId}`} className="knopf-2">
              Probeklausur
            </Link>
          </div>
        )}
      </div>
      <Fortschritt s={s} p={p} farbe={farbe} gross />
    </section>
  );
}

/** Liste der weiteren Klausuren mit Kursfarbe und Lernstand. */
export function KlausurListe({ liste }: { liste: KlausurStand[] }) {
  if (!liste.length) return <p className="mt-2 text-sm text-zinc-500">Keine weiteren Klausuren.</p>;
  return (
    <ul className="mt-3 flex flex-col gap-1">
      {liste.slice(0, 6).map((s) => {
        const farbe = kursFarbe(s.klausur.titel);
        const t = tageBis(s.klausur.start);
        const inhalt = (
          <>
            <div className="flex items-center gap-2.5">
              <span className="h-2.5 w-2.5 shrink-0 rounded-full" style={{ background: farbe }} aria-hidden />
              <span className="min-w-0 flex-1 truncate font-medium" title={ohneKlausur(s.klausur.titel)}>{kurz(s.klausur.titel)}</span>
              <span className="shrink-0 text-sm text-zinc-500 tabular-nums" title={fmtDatum(s.klausur.start)}>
                in <b className="font-semibold text-zinc-800 dark:text-zinc-200">{t}</b> Tagen
              </span>
            </div>
            <div className="mt-2 flex items-center gap-2 pl-5">
              <div className="flex-1">
                <Fortschritt s={s} p={prozent(s)} farbe={farbe} />
              </div>
              <span className="w-9 text-right text-xs text-zinc-500 tabular-nums">{s.kursId && s.themenGesamt ? `${prozent(s)} %` : ""}</span>
            </div>
          </>
        );
        return (
          <li key={s.klausur.id}>
            {s.kursId ? (
              <Link href={`/lernen/wiederholen?neu=1&kurs=${s.kursId}`} title="Kurs üben" className="block rounded-xl px-2 py-2 transition-colors hover:bg-zinc-50 dark:hover:bg-zinc-800/60">
                {inhalt}
              </Link>
            ) : (
              <div className="px-2 py-2">{inhalt}</div>
            )}
          </li>
        );
      })}
    </ul>
  );
}

function Fortschritt({ s, p, farbe, gross = false }: { s: KlausurStand; p: number; farbe: string; gross?: boolean }) {
  if (!s.kursId || !s.themenGesamt) return <div className={`${gross ? "mt-4" : ""} text-xs text-zinc-400`}>noch kein Lernmaterial</div>;
  return (
    <div className={gross ? "mt-5" : ""}>
      <span className={`balken ${gross ? "h-2.5" : "h-1.5"}`}>
        <span className="absolute inset-y-0 left-0 rounded-full" style={{ width: `${Math.max(p, s.sitzt ? 2 : 0)}%`, background: farbe }} />
      </span>
      {gross && (
        <div className="mt-1.5 flex justify-between gap-2 text-sm text-zinc-500">
          <span>gelernt</span>
          <span className="font-semibold tabular-nums text-zinc-700 dark:text-zinc-300">{p} %</span>
        </div>
      )}
    </div>
  );
}
