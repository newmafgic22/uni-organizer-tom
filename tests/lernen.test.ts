import { test } from "node:test";
import assert from "node:assert/strict";
import { klausurFuer, pruefeListe } from "../src/lib/lernen.ts";
import type { Termin } from "../src/lib/ical.ts";

const k = (titel: string, tag: string): Termin => ({
  id: titel, titel, start: new Date(tag), ende: new Date(tag), ganztags: false, quelle: "portal2",
});
const klausuren = [
  k("30001-ERZ-BA-0-P BW 1: Einführung in die Bildungspsychologie", "2026-12-17T10:00:00Z"),
  k("Grundlagen der Wirtschaftspädagogik", "2026-12-21T11:00:00Z"),
];

test("Klausur passt zum Kursnamen", () => {
  assert.equal(klausurFuer("BW 1: Einführung in die Bildungspsychologie [V] [1. PG] (HWS 2026)", klausuren)?.titel, klausuren[0].titel);
  assert.equal(klausurFuer("Grundlagen der Wirtschaftspädagogik [Ü] (HWS 2026)", klausuren)?.titel, klausuren[1].titel);
  assert.equal(klausurFuer("Analysis [V] (HWS 2026)", klausuren), undefined);
  assert.equal(klausurFuer("Grundlagen der Volkswirtschaftslehre [V] (HWS 2026)", klausuren), undefined);
});

test("pruefeListe filtert kaputte Einträge und normalisiert AFB", () => {
  const l = pruefeListe<{ frage: string; antwort: string; afb: number }>(
    [{ frage: "a", antwort: "b", afb: "3" }, { frage: "x" }, { frage: "c", antwort: "d", afb: 7 }],
    ["frage", "antwort"],
  );
  assert.deepEqual(l.map((e) => e.afb), [3, 1]);
});
