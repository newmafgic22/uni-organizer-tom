import { test } from "node:test";
import assert from "node:assert/strict";
import { probeAuswahl } from "../src/lib/probeklausur.ts";

const f = (mc: boolean) => ({ frage: "?", antwort: "!", afb: 1 as const, ...(mc ? { optionen: [{ text: "a", richtig: true }, { text: "b", richtig: false }] } : {}) });
const themen = [
  { id: "a", titel: "A", katalog: [f(false), f(true), f(false), f(true)] },
  { id: "b", titel: "B", katalog: [f(false), f(false)] },
];

test("Probeklausur zieht reihum aus allen Themen", () => {
  const r = probeAuswahl(themen, "", 4);
  assert.equal(r.karten.length, 4);
  assert.equal(r.karten.filter((k) => k.themaId === "b").length, 2);
  assert.equal(r.minuten, 8);
});

test("MC-Klausur bevorzugt MC und nimmt die Zeit aus den Infos", () => {
  const r = probeAuswahl(themen, "Multiple Choice, 90 Minuten", 2);
  assert.ok(r.mcBevorzugt);
  assert.equal(r.karten.filter((k) => k.themaId === "a" && k.frage.optionen).length, 1);
  assert.equal(probeAuswahl(themen, "60 Minuten", 100).minuten, 12);
});

test("Offene Klausur mit MC nur ergänzend bevorzugt kein MC", () => {
  assert.equal(probeAuswahl(themen, "überwiegend offene Fragen, Multiple Choice nur ergänzend", 2).mcBevorzugt, false);
});
