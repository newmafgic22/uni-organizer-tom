// Lerntools & Links: erkennt Links in Material-Texten und ILIAS-Objekte und bewertet ihren Lernwert.
// Ziel: nur hervorheben, was beim Lernen wirklich hilft. Umfragen, Studien, Mails und
// mehrfach erwähnte gleiche Links sollen nicht nerven.

export type Kategorie =
  | "lerntool" // Übungs-/Tutorsystem, z. B. CoTutor
  | "test" // ILIAS-Test, Probeklausur, Selbsttest
  | "uebung" // ILIAS-Übung (Abgabe)
  | "lernmodul" // interaktives Lernmodul / externes Tool in ILIAS
  | "video"
  | "literatur"
  | "live" // Live-Abstimmung in der Vorlesung
  | "meeting" // Zoom & Co.
  | "studie" // Umfragen, Studien, VP-Stunden
  | "sonstiges";

export type Bewertung = { kategorie: Kategorie; wichtig: boolean; name: string | null };

export const KATEGORIE_TEXT: Record<Kategorie, string> = {
  lerntool: "Lerntool",
  test: "Test",
  uebung: "Übung",
  lernmodul: "Lernmodul",
  video: "Video",
  literatur: "Literatur",
  live: "Live-Abstimmung",
  meeting: "Online-Termin",
  studie: "Umfrage/Studie",
  sonstiges: "Link",
};

export const KATEGORIE_ICON: Record<Kategorie, string> = {
  lerntool: "🧩",
  test: "📝",
  uebung: "✍️",
  lernmodul: "📖",
  video: "🎬",
  literatur: "📚",
  live: "📊",
  meeting: "💻",
  studie: "📋",
  sonstiges: "🔗",
};

type Regel = { host: RegExp; kategorie: Kategorie; wichtig: boolean; name?: string };

// Bekannte Seiten. Reihenfolge zählt: erste passende Regel gewinnt.
const REGELN: Regel[] = [
  { host: /(^|\.)cotutor\.de$/, kategorie: "lerntool", wichtig: true, name: "CoTutor" },
  { host: /(^|\.)(learningapps\.org|quizlet\.com|h5p\.(org|com)|anki(web)?\.net|kahoot\.(it|com)|brilliant\.org|khanacademy\.org|geogebra\.org|wolframalpha\.com|desmos\.com)$/, kategorie: "lerntool", wichtig: true },
  { host: /(^|\.)(coactum\.de|pingo\.(upb|coactum)\.de|particify\.de|arsnova\.[a-z]+|mentimeter\.com|menti\.com|slido\.com|tweedback\.de)$/, kategorie: "live", wichtig: false, name: "Live-Abstimmung" },
  { host: /(^|\.)(sosci(survey)?\.[a-z.]+|soscisurvey\.de|sona-systems\.com|limesurvey\.[a-z.]+|unipark\.de|qualtrics\.com|survey(monkey)?\.[a-z.]+|forms\.(office|gle)\.com|forms\.gle|questionstar\.de|evasys[a-z0-9.-]*|umfrage[a-z0-9-]*\.[a-z.]+)$/, kategorie: "studie", wichtig: false },
  { host: /^sosci\./, kategorie: "studie", wichtig: false },
  { host: /(^|\.)(zoom\.us|zoom-x\.de|webex\.com|teams\.microsoft\.com|meet\.google\.com|bbb\.[a-z.]+|bigbluebutton\.[a-z.]+)$/, kategorie: "meeting", wichtig: false },
  { host: /(^|\.)(youtube\.com|youtu\.be|vimeo\.com|panopto\.[a-z.]+|ilias-videoportal\.[a-z.]+|opencast\.[a-z.]+)$/, kategorie: "video", wichtig: false },
  { host: /(^|\.)(doi\.org|springer\.com|link\.springer\.com|hogrefe\.(de|com)|wiley\.com|sciencedirect\.com|jstor\.org|researchgate\.net|scholar\.google\.[a-z.]+|primo[a-z0-9.-]*|bib\.uni-mannheim\.de|ub\.uni-mannheim\.de|nbn-resolving\.(de|org)|pedocs\.de|beck-online\.de|wiso-net\.de|destatis\.de|oecd\.org)$/, kategorie: "literatur", wichtig: false },
];

// Seiten, die nie gezeigt werden (Verwaltung, Impressum, Mail, Uni-Webseiten ohne Lernwert)
const IGNORIEREN = [
  /(^|\.)(ilias|portal2|idp)\.uni-mannheim\.de$/, // eigene Plattformen: kommen über den Sync bzw. sind keine Tools
  /(^|\.)creativecommons\.org$/,
  /(^|\.)(w3\.org|adobe\.com|microsoft\.com|apple\.com|google\.com)$/,
];

const LERN_WORT = /(tutor|quiz|train|uebung|übung|exercise|practice|lern|learn|selbsttest|probeklausur|flashcard|karteikart)/i;

export function bewerteUrl(url: string): Bewertung | null {
  let u: URL;
  try {
    u = new URL(url);
  } catch {
    return null;
  }
  if (u.protocol !== "https:" && u.protocol !== "http:") return null;
  const host = u.hostname.toLowerCase().replace(/^www\./, "");
  if (IGNORIEREN.some((r) => r.test(host))) return null;
  for (const r of REGELN) {
    if (r.host.test(host)) return { kategorie: r.kategorie, wichtig: r.wichtig, name: r.name ?? null };
  }
  // Uni-Webseiten (Lehrstuhl, Infos) sind meistens kein Lernwerkzeug
  if (/(^|\.)uni-mannheim\.de$/.test(host)) {
    return LERN_WORT.test(u.pathname) ? { kategorie: "lerntool", wichtig: false, name: null } : { kategorie: "sonstiges", wichtig: false, name: null };
  }
  // Unbekannte Seite: als Lerntool vermuten, wenn Adresse danach klingt, aber nicht hervorheben
  if (LERN_WORT.test(host + u.pathname)) return { kategorie: "lerntool", wichtig: false, name: null };
  return { kategorie: "sonstiges", wichtig: false, name: null };
}

const STUDIE_TITEL = /(evaluation|umfrage|befragung|studie|fragebogen|versuchsperson|vp-stunde)/i;
const MEETING_TITEL = /(zoom|sprechstunde|webex|meeting)/i;

/** Bewertung für ein ILIAS-Objekt: Ziel-URL zuerst, Titel kann sie überstimmen (z. B. "Evaluation ..."). */
export function bewerteObjekt(typ: string, titel: string, ziel: string | null): Bewertung | null {
  if (typ !== "tst" && typ !== "exc" && STUDIE_TITEL.test(titel)) return { kategorie: "studie", wichtig: false, name: null };
  const b = ziel ? bewerteUrl(ziel) : bewerteIliasTyp(typ, titel);
  if (b && b.kategorie === "sonstiges" && MEETING_TITEL.test(titel)) return { kategorie: "meeting", wichtig: false, name: null };
  if (b && b.kategorie === "sonstiges" && /video/i.test(titel)) return { kategorie: "video", wichtig: false, name: null };
  if (b && b.kategorie === "sonstiges" && LERN_WORT.test(titel)) return { kategorie: "lerntool", wichtig: false, name: null };
  return b;
}

/** ILIAS-Objekttyp (aus goto.php/<typ>/<id>) bewerten. null = ignorieren. */
export function bewerteIliasTyp(typ: string, titel: string): Bewertung | null {
  const t = titel.toLowerCase();
  switch (typ) {
    case "tst":
      return { kategorie: "test", wichtig: true, name: null };
    case "exc":
      return { kategorie: "uebung", wichtig: true, name: null };
    case "sahs":
    case "htlm":
    case "lti":
    case "xxco":
    case "cmix":
    case "copa":
    case "glo":
      return { kategorie: "lernmodul", wichtig: typ !== "copa" && typ !== "glo", name: null };
    case "xlvo":
      return { kategorie: "live", wichtig: false, name: null };
    case "svy":
    case "poll":
      return { kategorie: "studie", wichtig: false, name: null };
    case "mcst":
    case "xvid":
      return { kategorie: "video", wichtig: false, name: null };
    case "webr":
      // Weblink-Objekt: eigentliche Bewertung kommt über die Ziel-URL, hier nur Fallback
      return { kategorie: LERN_WORT.test(t) ? "lerntool" : "sonstiges", wichtig: false, name: null };
    default:
      return null; // Foren, Wikis, Blogs, Kalender ... (kein Lerntool im Sinn der App)
  }
}

/**
 * Findet Links in extrahiertem PDF-Text. Folien-Text hat oft Leerzeichen um Bindestriche
 * ("uni - mannheim.de") oder Zeilenumbrüche mitten im Link, das wird repariert.
 */
export function findeLinks(text: string): string[] {
  if (!text) return [];
  const t = text
    .replace(/­/g, "")
    .replace(/(\w) +- +(\w)/g, "$1-$2")
    .replace(/(https?:\/\/[^\s]*)\s*\n\s*(?=[\w/.-]*[./][\w/.-])/g, "$1");
  const out = new Set<string>();
  const re = /\b(?:https?:\/\/|www\.)[^\s<>"'„“”()\[\]{}]+/gi;
  for (const m of t.matchAll(re)) {
    let url = m[0].replace(/[.,;:!?…»«]+$/, "");
    if (!/^https?:/i.test(url)) url = "https://" + url;
    const n = normalisiere(url);
    if (n) out.add(n);
  }
  return [...out];
}

export function normalisiere(url: string): string | null {
  try {
    const u = new URL(url);
    u.hash = "";
    u.hostname = u.hostname.toLowerCase();
    if (!/\.[a-z]{2,}$/i.test(u.hostname)) return null;
    let s = u.toString();
    if (u.pathname === "/" && !u.search) s = s.replace(/\/$/, "");
    return s;
  } catch {
    return null;
  }
}

export type LinkFund = { url: string; titel: string | null; bewertung: Bewertung };

/**
 * Fasst Funde zusammen: Bei bekannten Tools (mit Namen) zählt nur ein Eintrag je Seite,
 * z. B. cotutor.de/einschreiben und cotutor.de -> ein Eintrag mit der Startseite.
 */
export function zusammenfassen(urls: string[]): LinkFund[] {
  const proHost = new Map<string, LinkFund>();
  const rest: LinkFund[] = [];
  for (const url of urls) {
    const b = bewerteUrl(url);
    if (!b) continue;
    if (b.name) {
      const h = new URL(url).hostname;
      const alt = proHost.get(h);
      const start = `${new URL(url).origin}`;
      if (!alt) proHost.set(h, { url: start, titel: b.name, bewertung: b });
      continue;
    }
    rest.push({ url, titel: null, bewertung: b });
  }
  return [...proHost.values(), ...rest];
}

export function anzeigeName(url: string, titel: string | null) {
  if (titel) return titel;
  try {
    const u = new URL(url);
    const pfad = u.pathname.replace(/\/$/, "");
    return u.hostname.replace(/^www\./, "") + (pfad && pfad.length < 40 ? pfad : pfad ? "/…" : "");
  } catch {
    return url;
  }
}
