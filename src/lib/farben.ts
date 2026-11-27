/** Feste Farbe je Kurs, damit man Kurse überall (Start, Lernen, Material, Kalender) auf einen Blick erkennt. */
const FEST: [RegExp, string][] = [
  [/volkswirt|vwl|ökonom/i, "#f59e0b"],
  [/bildungspsych|psycholog/i, "#ec4899"],
  [/analysis|mathe/i, "#3b82f6"],
  [/quantitativ|statistik|\bqm\b/i, "#14b8a6"],
  [/wirtschaftsp[äa]d|wipäd|berufs/i, "#8b5cf6"],
  [/english|englisch/i, "#ef4444"],
  [/finanz|accounting|rechnungswesen|cc 30/i, "#22c55e"],
];
const REST = ["#06b6d4", "#f97316", "#a855f7", "#84cc16", "#e11d48", "#0ea5e9"];

/** Farbe nur, wenn der Text klar zu einem bekannten Kurs passt (für Kalendereinträge). */
export function kursFarbeBekannt(text: string): string | undefined {
  return FEST.find(([re]) => re.test(text))?.[1];
}

/** Farbe für jeden Kursnamen (bekannte fest, sonst stabil aus dem Namen berechnet). */
export function kursFarbe(name: string): string {
  const fest = kursFarbeBekannt(name);
  if (fest) return fest;
  let h = 0;
  for (const c of name) h = (h * 31 + c.charCodeAt(0)) >>> 0;
  return REST[h % REST.length];
}

/** Kurze, geläufige Namen für lange Kursnamen (überall in Texten ersetzbar). */
const KURZ: [RegExp, string][] = [
  [/(?:Klausur\s+)?Grundlagen der Volkswirtschaftslehre/gi, "VWL"],
  [/(?:Einführung in die\s+)?Bildungspsychologie/gi, "Psychologie"],
  [/Grundlagen der Wirtschaftsp[äa]dagogik/gi, "WiPäd"],
  [/Quantitative Methoden/gi, "QM"],
  [/Finanzmathematik/gi, "Finanzmathe"],
];

/** "Grundlagen der Volkswirtschaftslehre: Vorlesung 01 + Vorlesung 02" → "VWL: VL 01 + VL 02" */
export function kurz(text: string): string {
  let s = text.replace(/^Klausur:?\s+/i, "");
  for (const [re, k] of KURZ) s = s.replace(re, k);
  return s
    .replace(/\bVorlesung\s+(\d)/g, "VL $1")
    .replace(/\bÜBUNG\b/g, "Übung")
    .replace(/\s+\|\s+Tutorium$/i, "")
    .trim();
}
