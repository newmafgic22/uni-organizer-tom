"use client";
import { useEffect, useMemo, useState, type ReactNode } from "react";
import { antwortSpeichern } from "@/app/lernen/actions";

export type Karte = {
  frage: string;
  antwort: string;
  afb: number;
  optionen?: { text: string; richtig: boolean; erklaerung?: string }[];
  /** beim Wiederholen über mehrere Themen: Herkunft der Karte */
  themaId?: string;
  nr?: number;
  thema?: string;
};

const AFB = ["", "AFB I", "AFB II", "AFB III"];

export function Abfrage({
  themaId,
  karten,
  ende,
  zeitMin,
  bestehen,
}: {
  themaId?: string;
  karten: Karte[];
  ende?: ReactNode;
  /** Probeklausur: Zeitlimit in Minuten */
  zeitMin?: number;
  /** Probeklausur: Bestehensgrenze in Prozent */
  bestehen?: number;
}) {
  const probe = zeitMin !== undefined;
  const [startZeit] = useState(() => Date.now());
  const [rest, setRest] = useState(zeitMin ? zeitMin * 60 : 0);
  const [filter, setFilter] = useState(0);
  const [mischen, setMischen] = useState(false);
  const [pos, setPos] = useState(0);
  const [offen, setOffen] = useState(false);
  const [ergebnis, setErgebnis] = useState<Record<number, string>>({});
  const [nurMc, setNurMc] = useState(false);
  const [gewaehlt, setGewaehlt] = useState<number[]>([]);
  const [nichtGespeichert, setNichtGespeichert] = useState(0);
  const mcAnzahl = karten.filter((x) => x.optionen).length;

  const liste = useMemo(() => {
    const l = karten.map((k, i) => ({ ...k, nr: k.nr ?? i, idx: i })).filter((k) => (!filter || k.afb === filter) && (!nurMc || k.optionen));
    if (mischen) l.sort(() => Math.random() - 0.5);
    return l;
  }, [karten, filter, mischen, nurMc]);
  const k = liste[pos];
  const fertig = pos >= liste.length;
  useEffect(() => {
    if (!probe || fertig) return;
    const id = setInterval(() => {
      const r = Math.max(0, Math.round((zeitMin! * 60_000 - (Date.now() - startZeit)) / 1000));
      setRest(r);
      if (r === 0) setPos(liste.length); // Zeit um → Abgabe
    }, 1000);
    return () => clearInterval(id);
  }, [probe, fertig, zeitMin, startZeit, liste.length]);
  const punkte = liste.reduce((s, x) => s + (ergebnis[x.idx] === "richtig" ? 1 : ergebnis[x.idx] === "teilweise" ? 0.5 : 0), 0);
  const prozent = liste.length ? Math.round((punkte / liste.length) * 100) : 0;
  const proThema = new Map<string, { p: number; n: number }>();
  for (const x of liste) {
    if (!x.thema) continue;
    const t = proThema.get(x.thema) ?? { p: 0, n: 0 };
    t.n++;
    t.p += ergebnis[x.idx] === "richtig" ? 1 : ergebnis[x.idx] === "teilweise" ? 0.5 : 0;
    proThema.set(x.thema, t);
  }
  const werte = Object.values(ergebnis);

  function bewerten(b: string) {
    if (!k) return;
    setErgebnis((e) => ({ ...e, [k.idx]: b }));
    const tid = k.themaId ?? themaId;
    if (tid)
      antwortSpeichern(tid, "katalog", k.nr, k.afb, b)
        .then((r) => !r?.ok && setNichtGespeichert((n) => n + 1))
        .catch(() => setNichtGespeichert((n) => n + 1));
    setOffen(false);
    setGewaehlt([]);
    setPos((p) => p + 1);
  }

  /** MC automatisch bewerten: alles richtig angekreuzt → gewusst, mehr Treffer als Fehler → teilweise */
  function mcBewertung() {
    if (!k?.optionen) return "falsch";
    let fehler = 0;
    k.optionen.forEach((o, i) => {
      if (o.richtig !== gewaehlt.includes(i)) fehler++;
    });
    return fehler === 0 ? "richtig" : fehler === 1 ? "teilweise" : "falsch";
  }

  const knopf = (aktiv: boolean) =>
    `rounded-md px-3 py-1 text-sm ${aktiv ? "bg-sky-600 text-white" : "bg-zinc-100 dark:bg-zinc-800"}`;

  return (
    <div className="flex flex-col gap-3">
      {nichtGespeichert > 0 && (
        <p className="rounded-md border border-amber-400 bg-amber-50 px-3 py-2 text-sm text-amber-900 dark:border-amber-700 dark:bg-amber-950 dark:text-amber-200">
          {nichtGespeichert} Antwort(en) konnten nicht gespeichert werden (Internet weg?). Einfach weitermachen, die Frage kommt dann später nochmal.
        </p>
      )}
      {probe && !fertig && (
        <div className={`sticky top-14 z-10 self-end rounded-md px-3 py-1 text-sm font-semibold tabular-nums ${rest < 300 ? "bg-red-600 text-white" : "bg-zinc-100 dark:bg-zinc-800"}`}>
          ⏱ {Math.floor(rest / 60)}:{String(rest % 60).padStart(2, "0")}
        </div>
      )}
      <div className={`flex flex-wrap gap-2 ${probe ? "hidden" : ""}`}>
        {[0, 1, 2, 3].map((f) => (
          <button key={f} className={knopf(filter === f)} onClick={() => (setFilter(f), setPos(0), setOffen(false), setGewaehlt([]))}>
            {f ? AFB[f] : "Alle"} ({f ? karten.filter((x) => x.afb === f).length : karten.length})
          </button>
        ))}
        <button className={knopf(mischen)} onClick={() => (setMischen(!mischen), setPos(0), setOffen(false))}>
          🔀 Mischen
        </button>
        {mcAnzahl > 0 && (
          <button className={knopf(nurMc)} onClick={() => (setNurMc(!nurMc), setPos(0), setOffen(false), setGewaehlt([]))}>
            ☑ Nur Multiple Choice ({mcAnzahl})
          </button>
        )}
      </div>

      {fertig ? (
        <div className="karte flex flex-col items-start gap-2">
          {probe ? (
            <>
              <p className="text-lg font-semibold">
                {prozent} % · {bestehen !== undefined ? (prozent >= bestehen ? "✅ bestanden" : "❌ noch nicht bestanden") : ""}
              </p>
              <p className="text-sm text-zinc-500">
                {punkte} von {liste.length} Punkten (teilweise = halber Punkt){bestehen !== undefined ? `, bestanden ab ${bestehen} %` : ""}.
                {Object.keys(ergebnis).length < liste.length ? ` ${liste.length - Object.keys(ergebnis).length} Fragen nicht mehr geschafft.` : ""}
              </p>
              {proThema.size > 0 && (
                <ul className="w-full text-sm">
                  {[...proThema]
                    .sort((a, b) => a[1].p / a[1].n - b[1].p / b[1].n)
                    .map(([t, x]) => (
                      <li key={t} className="flex justify-between gap-2 border-b border-zinc-200 py-1 dark:border-zinc-800">
                        <span className="truncate">{t}</span>
                        <span className={`tabular-nums ${x.p / x.n < 0.5 ? "text-red-600" : "text-emerald-600"}`}>
                          {Math.round((x.p / x.n) * 100)} %
                        </span>
                      </li>
                    ))}
                </ul>
              )}
            </>
          ) : (
            <p className="font-semibold">Durch! 🎉</p>
          )}
          <p className="text-sm">
            {werte.filter((w) => w === "richtig").length} gewusst · {werte.filter((w) => w === "teilweise").length} teilweise ·{" "}
            {werte.filter((w) => w === "falsch").length} nicht gewusst
          </p>
          {ende ?? (
            <button className={knopf(true)} onClick={() => (setPos(0), setErgebnis({}))}>
              Nochmal
            </button>
          )}
        </div>
      ) : (
        <div className="karte flex flex-col gap-3">
          <div className="flex justify-between text-xs text-zinc-500">
            <span>
              Frage {pos + 1} von {liste.length}
            </span>
            <span>
              {k.thema ? `${k.thema} · ` : ""}
              {AFB[k.afb]}
            </span>
          </div>
          <p className="text-lg font-medium whitespace-pre-line">{k.frage}</p>
          {k.optionen && (
            <div className="flex flex-col gap-2">
              {!offen && <p className="text-xs text-zinc-500">Alle richtigen Aussagen ankreuzen (eine oder mehrere).</p>}
              {k.optionen.map((o, i) => {
                const an = gewaehlt.includes(i);
                const farbe = !offen
                  ? an
                    ? "border-sky-600 bg-sky-50 dark:bg-sky-950"
                    : "border-zinc-300 dark:border-zinc-700"
                  : o.richtig
                    ? "border-emerald-600 bg-emerald-50 dark:bg-emerald-950"
                    : an
                      ? "border-red-600 bg-red-50 dark:bg-red-950"
                      : "border-zinc-300 opacity-70 dark:border-zinc-700";
                return (
                  <button
                    key={i}
                    disabled={offen}
                    onClick={() => setGewaehlt((g) => (an ? g.filter((x) => x !== i) : [...g, i]))}
                    className={`rounded-lg border p-3 text-left ${farbe}`}
                  >
                    <span className="font-medium">
                      {an ? "☑" : "☐"} {o.text}
                    </span>
                    {offen && o.erklaerung && <span className="mt-1 block text-sm text-zinc-600 dark:text-zinc-400">{o.erklaerung}</span>}
                  </button>
                );
              })}
            </div>
          )}
          {offen && k.optionen ? (
            <div className="flex flex-col items-start gap-2">
              <p className="text-sm font-medium">
                {{ richtig: "✓ Alles richtig!", teilweise: "~ Fast, eine Aussage falsch eingeschätzt", falsch: "✗ Noch nicht" }[mcBewertung()]}
              </p>
              <p className="whitespace-pre-line rounded-lg bg-zinc-50 p-3 text-sm dark:bg-zinc-900">{k.antwort}</p>
              <button className="rounded-md bg-sky-600 px-4 py-2 text-white" onClick={() => bewerten(mcBewertung())}>
                Weiter →
              </button>
            </div>
          ) : offen ? (
            <>
              <p className="whitespace-pre-line rounded-lg bg-zinc-50 p-3 dark:bg-zinc-900">{k.antwort}</p>
              <div className="flex flex-wrap gap-2">
                <button className="rounded-md bg-emerald-600 px-3 py-1.5 text-sm text-white" onClick={() => bewerten("richtig")}>
                  ✓ Gewusst
                </button>
                <button className="rounded-md bg-amber-500 px-3 py-1.5 text-sm text-white" onClick={() => bewerten("teilweise")}>
                  ~ Teilweise
                </button>
                <button className="rounded-md bg-red-600 px-3 py-1.5 text-sm text-white" onClick={() => bewerten("falsch")}>
                  ✗ Nicht gewusst
                </button>
              </div>
            </>
          ) : (
            <button className="self-start rounded-md bg-sky-600 px-4 py-2 text-white" onClick={() => setOffen(true)}>
              {k.optionen ? "Prüfen" : "Antwort zeigen"}
            </button>
          )}
        </div>
      )}
    </div>
  );
}
