"use client";
import { useMemo, useState } from "react";
import { antwortSpeichern } from "@/app/lernen/actions";

type Karte = { frage: string; antwort: string; afb: number };

const AFB = ["", "AFB I", "AFB II", "AFB III"];

export function Abfrage({ themaId, karten }: { themaId: string; karten: Karte[] }) {
  const [filter, setFilter] = useState(0);
  const [mischen, setMischen] = useState(false);
  const [pos, setPos] = useState(0);
  const [offen, setOffen] = useState(false);
  const [ergebnis, setErgebnis] = useState<Record<number, string>>({});

  const liste = useMemo(() => {
    const l = karten.map((k, nr) => ({ ...k, nr })).filter((k) => !filter || k.afb === filter);
    if (mischen) l.sort(() => Math.random() - 0.5);
    return l;
  }, [karten, filter, mischen]);
  const k = liste[pos];
  const fertig = pos >= liste.length;
  const werte = Object.values(ergebnis);

  function bewerten(b: string) {
    if (!k) return;
    setErgebnis((e) => ({ ...e, [k.nr]: b }));
    antwortSpeichern(themaId, "katalog", k.nr, k.afb, b);
    setOffen(false);
    setPos((p) => p + 1);
  }

  const knopf = (aktiv: boolean) =>
    `rounded-md px-3 py-1 text-sm ${aktiv ? "bg-sky-600 text-white" : "bg-zinc-100 dark:bg-zinc-800"}`;

  return (
    <div className="flex flex-col gap-3">
      <div className="flex flex-wrap gap-2">
        {[0, 1, 2, 3].map((f) => (
          <button key={f} className={knopf(filter === f)} onClick={() => (setFilter(f), setPos(0), setOffen(false))}>
            {f ? AFB[f] : "Alle"} ({f ? karten.filter((x) => x.afb === f).length : karten.length})
          </button>
        ))}
        <button className={knopf(mischen)} onClick={() => (setMischen(!mischen), setPos(0), setOffen(false))}>
          🔀 Mischen
        </button>
      </div>

      {fertig ? (
        <div className="karte flex flex-col items-start gap-2">
          <p className="font-semibold">Durch! 🎉</p>
          <p className="text-sm">
            {werte.filter((w) => w === "richtig").length} gewusst · {werte.filter((w) => w === "teilweise").length} teilweise ·{" "}
            {werte.filter((w) => w === "falsch").length} nicht gewusst
          </p>
          <button className={knopf(true)} onClick={() => (setPos(0), setErgebnis({}))}>
            Nochmal
          </button>
        </div>
      ) : (
        <div className="karte flex flex-col gap-3">
          <div className="flex justify-between text-xs text-zinc-500">
            <span>
              Frage {pos + 1} von {liste.length}
            </span>
            <span>{AFB[k.afb]}</span>
          </div>
          <p className="text-lg font-medium whitespace-pre-line">{k.frage}</p>
          {offen ? (
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
              Antwort zeigen
            </button>
          )}
        </div>
      )}
    </div>
  );
}
