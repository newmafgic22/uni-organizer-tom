import ICAL from "ical.js";

export type Quelle = "ilias" | "portal2" | "sonstig";

export type Termin = {
  id: string;
  titel: string;
  start: Date;
  ende: Date;
  ganztags: boolean;
  ort?: string;
  beschreibung?: string;
  kategorie?: string;
  quelle: Quelle;
};

export const TZ = "Europe/Berlin";

/** Holt einen iCal-Link und gibt alle Termine im Zeitraum zurueck (Wiederholungen aufgeloest). */
export async function holeTermine(url: string, quelle: Quelle, von: Date, bis: Date): Promise<Termin[]> {
  const res = await fetch(url, {
    headers: { "User-Agent": "uni-organizer-tom/1.0" },
    next: { revalidate: 1800 }, // 30 min Cache, schont ILIAS/Portal2
  });
  if (!res.ok) throw new Error(`${quelle}: HTTP ${res.status}`);
  const text = await res.text();
  if (!text.includes("BEGIN:VCALENDAR")) throw new Error(`${quelle}: Antwort ist kein Kalender (Link pruefen)`);
  return parseTermine(text, quelle, von, bis);
}

export function parseTermine(text: string, quelle: Quelle, von: Date, bis: Date): Termin[] {
  const root = new ICAL.Component(ICAL.parse(text));
  for (const tz of root.getAllSubcomponents("vtimezone")) {
    ICAL.TimezoneService.register(tz);
  }
  const vevents = root.getAllSubcomponents("vevent");
  const ausnahmen = new Map<string, ICAL.Event[]>();
  const basis: ICAL.Event[] = [];
  for (const v of vevents) {
    const ev = new ICAL.Event(v);
    if (v.hasProperty("recurrence-id")) {
      const l = ausnahmen.get(ev.uid) ?? [];
      l.push(ev);
      ausnahmen.set(ev.uid, l);
    } else {
      basis.push(ev);
    }
  }

  const out: Termin[] = [];
  const add = (ev: ICAL.Event, s: ICAL.Time, e: ICAL.Time | null, key: string) => {
    const start = s.toJSDate();
    const ganztags = s.isDate;
    let ende = e ? e.toJSDate() : new Date(start.getTime() + (ganztags ? 86400000 : 3600000));
    if (ende <= start) ende = new Date(start.getTime() + (ganztags ? 86400000 : 0));
    if (ende < von || start > bis) return;
    const kat = ev.component.getFirstPropertyValue("categories");
    out.push({
      id: `${quelle}:${key}`,
      titel: (ev.summary || "(ohne Titel)").trim().replace(/^[\w-]+-P\s+/, ""),
      kategorie: typeof kat === "string" ? kat : undefined,
      start,
      ende,
      ganztags,
      ort: ev.location?.trim() || undefined,
      beschreibung: ev.description?.trim() || undefined,
      quelle,
    });
  };

  for (const ev of basis) {
    for (const ex of ausnahmen.get(ev.uid) ?? []) ev.relateException(ex);
    if (!ev.isRecurring()) {
      add(ev, ev.startDate, ev.endDate, ev.uid || String(out.length));
      continue;
    }
    const it = ev.iterator();
    let next: ICAL.Time | null;
    let n = 0;
    while ((next = it.next()) && n++ < 1000) {
      if (next.toJSDate() > bis) break;
      const d = ev.getOccurrenceDetails(next);
      add(d.item, d.startDate, d.endDate, `${ev.uid}:${next.toString()}`);
    }
  }
  return out.sort((a, b) => a.start.getTime() - b.start.getTime());
}

/** Termine aus mehreren Quellen; Fehler einer Quelle stoppen nicht die anderen. */
export async function holeAlle(
  quellen: { url: string; kind: Quelle; name: string }[],
  von: Date,
  bis: Date,
) {
  const fehler: string[] = [];
  const listen = await Promise.all(
    quellen.map((q) =>
      holeTermine(q.url, q.kind, von, bis).catch((e) => {
        fehler.push(`${q.name}: ${e instanceof Error ? e.message : String(e)}`);
        return [] as Termin[];
      }),
    ),
  );
  const termine = listen.flat().sort((a, b) => a.start.getTime() - b.start.getTime());
  return { termine, fehler };
}

const KLAUSUR = /klausur|pr(ü|ue)fung|exam/i;
/** Portal2 markiert Pruefungen ueber CATEGORIES ("Fachabschl. Prüfung", "Prüfungsleistung") */
export const istKlausur = (t: Termin) => KLAUSUR.test(t.kategorie ?? "") || KLAUSUR.test(t.titel);

// ---------- Export (Abo-Kalender) ----------

function esc(s: string) {
  return s.replace(/\\/g, "\\\\").replace(/;/g, "\;").replace(/,/g, "\\,").replace(/\r?\n/g, "\\n");
}
function utc(d: Date) {
  return d.toISOString().replace(/[-:]/g, "").replace(/\.\d{3}/, "");
}
function datum(d: Date) {
  // Ganztags: Datum in Berliner Zeit
  const p = new Intl.DateTimeFormat("en-CA", { timeZone: TZ, year: "numeric", month: "2-digit", day: "2-digit" }).format(d);
  return p.replace(/-/g, "");
}
function fold(line: string) {
  const out: string[] = [];
  let rest = line;
  while (rest.length > 74) {
    out.push(rest.slice(0, 74));
    rest = " " + rest.slice(74);
  }
  out.push(rest);
  return out.join("\r\n");
}

export function baueIcs(termine: Termin[], name = "Uni-App"): string {
  const now = utc(new Date());
  const lines = [
    "BEGIN:VCALENDAR",
    "VERSION:2.0",
    "PRODID:-//Uni-Organizer Tom//DE",
    "CALSCALE:GREGORIAN",
    "METHOD:PUBLISH",
    `X-WR-CALNAME:${esc(name)}`,
    `X-WR-TIMEZONE:${TZ}`,
    "REFRESH-INTERVAL;VALUE=DURATION:PT1H",
    "X-PUBLISHED-TTL:PT1H",
  ];
  for (const t of termine) {
    lines.push(
      "BEGIN:VEVENT",
      `UID:${esc(t.id.replace(/[^\w:.@-]/g, "_"))}@uni-organizer-tom`,
      `DTSTAMP:${now}`,
      ...(t.ganztags
        ? [`DTSTART;VALUE=DATE:${datum(t.start)}`, `DTEND;VALUE=DATE:${datum(t.ende)}`]
        : [`DTSTART:${utc(t.start)}`, `DTEND:${utc(t.ende)}`]),
      `SUMMARY:${esc((istKlausur(t) ? "📝 " : "") + t.titel)}`,
      ...(t.ort ? [`LOCATION:${esc(t.ort)}`] : []),
      ...(t.beschreibung ? [`DESCRIPTION:${esc(t.beschreibung)}`] : []),
      `CATEGORIES:${esc(t.kategorie ?? (t.quelle === "ilias" ? "ILIAS" : t.quelle === "portal2" ? "Portal2" : "Sonstig"))}`,
      "END:VEVENT",
    );
  }
  lines.push("END:VCALENDAR");
  return lines.map(fold).join("\r\n") + "\r\n";
}
