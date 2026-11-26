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

import { autorJahr, wirdZitiert } from "../src/lib/lernen.ts";

test("autorJahr erkennt Literaturdateien", () => {
  assert.deepEqual(autorJahr("Fischer2002 Gemeinsame Wissenskonstruktion.pdf"), { autor: "Fischer", jahr: "2002" });
  assert.deepEqual(autorJahr("Bromme Haag_2008_Forschung zur Lehrerpersonlichkeit.pdf"), { autor: "Bromme", jahr: "2008" });
  assert.deepEqual(autorJahr("Krauss etal2008_Professionelles Wissen.pdf"), { autor: "Krauss", jahr: "2008" });
  assert.deepEqual(autorJahr("Lefrancois_2006_Psychologie des Lernens.pdf"), { autor: "Lefrancois", jahr: "2006" });
  assert.deepEqual(autorJahr("1992_Bourne-Ekstrand_Einfuehrung.pdf"), { autor: "Bourne", jahr: "1992" });
  assert.equal(autorJahr("Selbstreguliertes Lernen Skript.pdf"), null);
});

test("wirdZitiert findet Autor + Jahr im Folientext", () => {
  assert.equal(wirdZitiert("Nuckles2009_Lernen durch Lehren.pdf", "vgl. Nückles (2009), S. 3"), true);
  assert.equal(wirdZitiert("Gruber2008_Lernen.pdf", "Gruber, H. & Mandl, H. (2008). Lernen"), true);
  assert.equal(wirdZitiert("Gruber2009_Situiertes Lernen.pdf", "Gruber (2008)"), false);
});

test("wirdZitiert mit eindeutigem Autor akzeptiert andere Auflage", () => {
  assert.equal(wirdZitiert("1992_Bourne-Ekstrand_Statistik.pdf", "Bourne & Ekstrand (2005)"), false);
  assert.equal(wirdZitiert("1992_Bourne-Ekstrand_Statistik.pdf", "Bourne & Ekstrand (2005)", true), true);
});

import { kurzTitel, sehrKurzTitel } from "../src/lib/lernen.ts";
test("kurzTitel", () => {
  assert.equal(kurzTitel("02 Bildungspsychologie HWS2026 AuffassungenLernen SelbstreguliertesLernen"), "02 Auffassungen Lernen Selbstreguliertes Lernen");
  assert.equal(kurzTitel("11 Bildungspsychologie HSW2026 Unterrichtsqualitaet II"), "11 Unterrichtsqualitaet II");
  assert.equal(kurzTitel("GWP 07 HWS 2026 CurrBed"), "07 Curr Bed");
  assert.equal(kurzTitel("GVWL Vorlesung 05 (Teil 1) (Update 28.09.)"), "Vorlesung 05 (Teil 1)");
  assert.equal(kurzTitel("WiPäd Grundlagen"), "WiPäd Grundlagen");
  assert.equal(kurzTitel("GvwlHws2026Kapitel23VGRKomplett"), "Kapitel 23 VGR Komplett");
  assert.equal(kurzTitel("GvwlHws2026Einfuehrung"), "Einfuehrung");
  assert.equal(kurzTitel("Vorlesung 05 (Teil 1)"), "Vorlesung 05 (Teil 1)");
  assert.equal(kurzTitel("01 Analysis HWS 2026 Mengen"), "01 Mengen");
  assert.equal(sehrKurzTitel("GVWL Vorlesung 02 - Loesung und Erlaeuterungen zum Zahlenbeispiel"), "Vorlesung 02");
});

test("Organisatorisches ist kein Lernthema", () => {
  assert.equal(istHauptdatei("GWP_01_HWS_2026_Organisatorisches.pdf"), false);
  assert.equal(istHauptdatei("GWP_02_HWS_2026_Grundfragen.pdf"), true);
});

import { anzeigeName } from "../src/lib/lernen.ts";
test("anzeigeName macht Kursnamen verständlich", () => {
  assert.equal(anzeigeName("BW 1: Einführung in die Bildungspsychologie [V] [1. PG] (HWS 2026)"), "Bildungspsychologie");
  assert.equal(anzeigeName("CC 303 Quantitative Methoden VL [1. PG]"), "Quantitative Methoden");
  assert.equal(anzeigeName("Grundlagen der Volkswirtschaftslehre [V] (HWS 2026)"), "Grundlagen der Volkswirtschaftslehre");
  assert.equal(anzeigeName("ANG 169 B.Sc. WiPäd: FSK Englisch Level 2, Course C [3. PG]"), "Englisch Level 2");
  assert.equal(anzeigeName("Analysis [V] (HWS 2026)"), "Analysis");
  assert.equal(anzeigeName("Klausur CC 303 Quantitative Methoden VL"), "Klausur Quantitative Methoden");
  assert.equal(anzeigeName("Fachbereich Wirtschaftspädagogik"), "Fachbereich Wirtschaftspädagogik");
});
