import { test } from "node:test";
import assert from "node:assert/strict";
import { fragenStatus, sitzung } from "../src/lib/wiederholen.ts";

const jetzt = Date.parse("2026-11-26T12:00:00");
const thema = { id: "t", fertig_at: "2026-11-20T00:00:00Z", klausur_am: "2026-12-17T10:00:00Z", anzahl: 4 };
const a = (nr: number, bewertung: string, tag: string) => ({ thema_id: "t", nr, bewertung, created_at: tag });

test("Leitner: falsch heute, teilweise morgen, gewusst später", () => {
  const s = fragenStatus(
    [thema],
    [
      a(0, "falsch", "2026-11-26T10:00:00"),
      a(1, "teilweise", "2026-11-25T10:00:00"),
      a(2, "richtig", "2026-11-25T10:00:00"),
      a(2, "richtig", "2026-11-21T10:00:00"),
      a(1, "richtig", "2026-11-19T10:00:00"), // vor fertig_at → zählt nicht
    ],
    jetzt,
  );
  assert.deepEqual(s.map((x) => [x.nr, x.faellig, x.neu]), [[0, true, false], [1, true, false], [2, false, false], [3, false, true]]);
  assert.equal(s[2].serie, 2);
});

test("Sitzung: fällige zuerst, neue nur auf Wunsch", () => {
  const s = fragenStatus([thema], [a(0, "falsch", "2026-11-26T10:00:00")], jetzt);
  assert.equal(sitzung(s, false).length, 1);
  assert.equal(sitzung(s, true).length, 4);
  assert.equal(sitzung(s, true)[0].nr, 0);
});
