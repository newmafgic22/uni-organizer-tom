import { TZ } from "@/lib/ical";

/** "YYYY-MM-DD" des Datums in Berliner Zeit */
export function tagKey(d: Date) {
  return new Intl.DateTimeFormat("en-CA", { timeZone: TZ, year: "numeric", month: "2-digit", day: "2-digit" }).format(d);
}

function offsetMin(d: Date) {
  const s = new Intl.DateTimeFormat("en-US", { timeZone: TZ, timeZoneName: "longOffset" }).format(d);
  const m = s.match(/GMT([+-])(\d{2}):(\d{2})/);
  return m ? (m[1] === "-" ? -1 : 1) * (Number(m[2]) * 60 + Number(m[3])) : 0;
}

/** Mitternacht (Berlin) des Tages key als Date */
export function tagStart(key: string) {
  const roh = new Date(`${key}T00:00:00Z`);
  return new Date(roh.getTime() - offsetMin(roh) * 60000);
}

export function plusTage(key: string, n: number) {
  const d = new Date(`${key}T12:00:00Z`);
  d.setUTCDate(d.getUTCDate() + n);
  return d.toISOString().slice(0, 10);
}

/** Montag der Woche (Berlin), optional verschoben um n Wochen */
export function wochenStart(heute = new Date(), n = 0) {
  const key = tagKey(heute);
  const wd = new Date(`${key}T12:00:00Z`).getUTCDay(); // 0 = So
  return plusTage(key, -((wd + 6) % 7) + 7 * n);
}

export const fmtZeit = (d: Date) =>
  new Intl.DateTimeFormat("de-DE", { timeZone: TZ, hour: "2-digit", minute: "2-digit" }).format(d);
export const fmtTag = (key: string) =>
  new Intl.DateTimeFormat("de-DE", { timeZone: "UTC", weekday: "long", day: "numeric", month: "long" }).format(
    new Date(`${key}T12:00:00Z`),
  );
export const fmtTagKurz = (key: string) =>
  new Intl.DateTimeFormat("de-DE", { timeZone: "UTC", weekday: "short", day: "2-digit", month: "2-digit" }).format(
    new Date(`${key}T12:00:00Z`),
  );
export const fmtDatum = (d: Date) =>
  new Intl.DateTimeFormat("de-DE", { timeZone: TZ, weekday: "short", day: "2-digit", month: "2-digit", year: "numeric" }).format(d);
