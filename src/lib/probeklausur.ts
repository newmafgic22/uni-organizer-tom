import type { KatalogFrage } from "@/lib/lernen";

type Thema = { id: string; titel: string; katalog: KatalogFrage[] };
type Auswahl = { frage: KatalogFrage; themaId: string; nr: number; thema: string };

/** Zieht Fragen gleichmäßig aus allen Themen (reihum), bei MC-Klausuren bevorzugt MC-Fragen. */
export function probeAuswahl(themen: Thema[], klausurInfo: string, anzahl = 30, zufall = Math.random) {
  const mcBevorzugt = /multiple|\bmc\b|antwortoption|ankreuz|cotutor/i.test(klausurInfo) && !/überwiegend offen|nur ergänzend/i.test(klausurInfo);
  const toepfe = themen.map((t) => {
    const fragen = t.katalog.map((frage, nr) => ({ frage, themaId: t.id, nr, thema: t.titel }));
    mischen(fragen, zufall);
    if (mcBevorzugt) fragen.sort((a, b) => Number(!!b.frage.optionen) - Number(!!a.frage.optionen));
    return fragen;
  });
  const karten: Auswahl[] = [];
  for (let runde = 0; karten.length < anzahl; runde++) {
    let neu = false;
    for (const topf of toepfe) {
      if (karten.length >= anzahl) break;
      if (topf[runde]) {
        karten.push(topf[runde]);
        neu = true;
      }
    }
    if (!neu) break;
  }
  mischen(karten, zufall);
  // Zeit: aus den Klausur-Infos (z. B. „90 Minuten“), höchstens 2 min pro Frage (MC: 1,5 min)
  const echt = Number(klausurInfo.match(/(\d{2,3})\s*(?:min|Minuten)/i)?.[1] ?? 90);
  const proFrage = mcBevorzugt ? 1.5 : 2;
  const minuten = Math.max(5, Math.min(echt, Math.round(karten.length * proFrage)));
  return { karten, minuten, mcBevorzugt };
}

function mischen<T>(a: T[], zufall: () => number) {
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(zufall() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
}
