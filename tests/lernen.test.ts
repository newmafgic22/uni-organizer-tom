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

import { istHauptdatei, vorlesungsNr } from "../src/lib/lernen.ts";

test("Vorlesungsnummer und Hauptdatei", () => {
  assert.equal(vorlesungsNr("03 Bildungspsychologie_HWS2026_Informationsverarbeitung_I.pdf"), 3);
  assert.equal(vorlesungsNr("08_Bildungspsychologie_HWS2026_Inter-individuelle_Unterschiede II.pdf"), 8);
  assert.equal(vorlesungsNr("GWP_07_HWS_2026_CurrBed.pdf"), 7);
  assert.equal(vorlesungsNr("GWP_HWS26_Uebung_01.pdf"), null);
  assert.equal(vorlesungsNr("R E A D M E zur Vorlesung.pdf"), null);
  assert.equal(istHauptdatei("GWP_07_HWS_2026_CurrBed.pdf"), true);
  assert.equal(istHauptdatei("GWP_07_HWS_2026_Tramm & Reetz (2010).pdf"), false);
  assert.equal(istHauptdatei("GWP_07_HWS_2026_Curriculare Bedingungen Anhang 1_RLP-alt.pdf"), false);
  assert.equal(istHauptdatei("GWP_06_HWS_2026_Literatur_Mangelsdorf_2015.pdf"), false);
  assert.equal(istHauptdatei("GWP_10_HWS_2026_Lit_Aprea_2026_Finanzielle Muendigkeit entwickeln.pdf"), false);
  assert.equal(istHauptdatei("GWP_08_HWS_2026_Rausch&Schley(2015)-Lern- und Motivationspotenziale.pdf"), false);
  assert.equal(istHauptdatei("GWP_06_HWS_2026_Literatur_Shell-Jugendstudie 2024 Zusammenfassung.pdf"), false);
  assert.equal(istHauptdatei("12 Bildungspsychologie HSW2026 Kompetenzen von Lehrenden.pdf"), true);
  assert.equal(istHauptdatei("2026_Information_Versuchspersonenstunden.pdf"), false);
});
