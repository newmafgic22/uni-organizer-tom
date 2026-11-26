import { test } from "node:test";
import assert from "node:assert/strict";
import { bewerteObjekt, bewerteUrl, findeLinks, zusammenfassen } from "../src/lib/links.ts";

const folie = `Ihr Lernen mit CoTutor - Registrierung Erstmaliges „ Einschreibung“ bei CoTutor über folgenden Link:
https://bildungspsychologie.cotutor.de/einschreiben „Einschreibeschlüssel“ für die Veranstaltung
Künftig: Link zur Login-Seite: https://bildungspsychologie.cotutor.de/
Audience Response Frage https://uni - mannheim.coactum.de 042616
Hier gehts zur Studie: https://sosci.sowi.uni - mannheim.de/ankommen_im_studium/
Fragen an sophie.muelbe@uni-mannheim.de oder www.sowi.uni-mannheim.de/muenzer/team/.`;

test("Links aus Folientext, auch mit Leerzeichen um Bindestriche", () => {
  const l = findeLinks(folie);
  assert.ok(l.includes("https://bildungspsychologie.cotutor.de/einschreiben"));
  assert.ok(l.includes("https://bildungspsychologie.cotutor.de"));
  assert.ok(l.includes("https://uni-mannheim.coactum.de"));
  assert.ok(l.includes("https://sosci.sowi.uni-mannheim.de/ankommen_im_studium/"));
  assert.ok(l.includes("https://www.sowi.uni-mannheim.de/muenzer/team/"));
  assert.ok(!l.some((x) => x.includes("muelbe")), "Mailadressen sind keine Links");
});

test("CoTutor wird hervorgehoben, Umfragen/Live-Abstimmung nicht", () => {
  assert.deepEqual(bewerteUrl("https://bildungspsychologie.cotutor.de"), { kategorie: "lerntool", wichtig: true, name: "CoTutor" });
  assert.equal(bewerteUrl("https://uni-mannheim.coactum.de")?.wichtig, false);
  assert.equal(bewerteUrl("https://sosci.sowi.uni-mannheim.de/x/")?.kategorie, "studie");
  assert.equal(bewerteUrl("https://uni-mannheim.sona-systems.com/")?.kategorie, "studie");
  assert.equal(bewerteUrl("https://ilias.uni-mannheim.de/goto.php/crs/1"), null);
});

test("Gleiches Tool mehrfach erwähnt -> ein Eintrag", () => {
  const f = zusammenfassen(findeLinks(folie + "\n" + folie));
  const cot = f.filter((x) => x.titel === "CoTutor");
  assert.equal(cot.length, 1);
  assert.equal(cot[0].url, "https://bildungspsychologie.cotutor.de");
});

test("ILIAS-Objekte", () => {
  assert.equal(bewerteObjekt("tst", "Probeklausur", null)?.wichtig, true);
  assert.equal(bewerteObjekt("exc", "Übungsblatt 3", null)?.kategorie, "uebung");
  assert.equal(bewerteObjekt("webr", "Evaluation Übung GWP PG 1", "https://evasys.uni-mannheim.de/x")?.kategorie, "studie");
  assert.equal(bewerteObjekt("webr", "Hier geht es zur Zoom-Konzeptsprechstunde", "https://uni-mannheim.zoom-x.de/j/1")?.kategorie, "meeting");
  assert.equal(bewerteObjekt("webr", "Videos zur Vorlesung", "https://example.org/videos")?.kategorie, "video");
  assert.equal(bewerteObjekt("frm", "Forum", null), null);
});
