import { readFileSync } from "node:fs";
import assert from "node:assert/strict";
import { test } from "node:test";
import { baueIcs, istKlausur, parseTermine } from "../src/lib/ical.ts";

const text = readFileSync(new URL("./fixture.ics", import.meta.url), "utf8");
const t = parseTermine(text, "portal2", new Date("2026-11-01T00:00:00Z"), new Date("2026-12-31T00:00:00Z"));

test("Wiederholung, EXDATE und Ausnahme", () => {
  const bw = t.filter((x) => x.titel.startsWith("BW 1") && !istKlausur(x));
  // Nov 5, 12, 19 (verlegt), Dez 3, 10 ; 26.11. faellt aus
  assert.deepEqual(bw.map((x) => x.start.toISOString()), [
    "2026-11-05T11:00:00.000Z", "2026-11-12T11:00:00.000Z", "2026-11-19T11:00:00.000Z",
    "2026-12-03T11:00:00.000Z", "2026-12-10T11:00:00.000Z",
  ]);
  assert.equal(bw[2].ort, "W 117 Hörsaal Schloss Westflügel");
});

test("Klausur erkannt, Modulcode entfernt", () => {
  const k = t.filter(istKlausur);
  assert.equal(k.length, 1);
  assert.equal(k[0].titel, "BW 1: Einführung in die Bildungspsychologie");
  assert.equal(k[0].start.toISOString(), "2026-12-17T10:00:00.000Z");
});

test("Export ist gueltiges iCal", () => {
  const ics = baueIcs(t);
  assert.match(ics, /^BEGIN:VCALENDAR\r\n/);
  assert.equal((ics.match(/BEGIN:VEVENT/g) ?? []).length, 6);
  assert.match(ics, /SUMMARY:📝 BW 1/);
  const wieder = parseTermine(ics, "sonstig", new Date("2026-11-01"), new Date("2026-12-31"));
  assert.equal(wieder.length, 6);
});
