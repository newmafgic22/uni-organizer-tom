import { NextResponse, type NextRequest } from "next/server";
import { createRemoteJWKSet, jwtVerify } from "jose";
import { createAdminClient } from "@/lib/supabase/server";
import { ladeTermine } from "@/lib/daten";
import { istKlausur } from "@/lib/ical";
import { autorJahr, istHauptdatei, klausurFuer, pruefeListe, vorlesungsNr, wirdZitiert, type Aufgabe, type KatalogFrage } from "@/lib/lernen";

// Schnittstelle für den Lernlauf (GitHub Actions).
// Anmeldung ohne gespeichertes Geheimnis: GitHub stellt jedem Lauf ein signiertes OIDC-Token aus.
// Wir akzeptieren nur Tokens aus Toms Repo, vom main-Branch.

const ISSUER = "https://token.actions.githubusercontent.com";
const JWKS = createRemoteJWKSet(new URL(`${ISSUER}/.well-known/jwks`));
const REPO = process.env.LERNLAUF_REPO ?? "newmafgic22/uni-organizer-tom";
const AUDIENCE = "uni-organizer-lernlauf";

async function erlaubt(req: NextRequest) {
  const token = (req.headers.get("authorization") ?? "").replace(/^Bearer\s+/i, "");
  if (!token) return false;
  try {
    const { payload } = await jwtVerify(token, JWKS, { issuer: ISSUER, audience: AUDIENCE });
    return payload.repository === REPO && payload.ref === "refs/heads/main";
  } catch {
    return false;
  }
}

export async function POST(req: NextRequest) {
  if (!(await erlaubt(req))) return NextResponse.json({ fehler: "nicht erlaubt" }, { status: 401 });
  const db = createAdminClient();
  const body = await req.json().catch(() => null);

  // Endgültig fehlgeschlagene Themen nach 6 Stunden noch einmal versuchen (oft war es nur ein Aussetzer)
  await db
    .from("lernthemen")
    .update({ status: "wartet", versuche: 0 })
    .eq("status", "fehler")
    .lt("gestartet_at", new Date(Date.now() - 6 * 3600_000).toISOString());

  if (body?.aktion === "anzahl") {
    await klausurTermineAktualisieren(db).catch(() => {});
    const { count } = await db.from("lernthemen").select("id", { count: "exact", head: true }).eq("status", "wartet").lt("versuche", 3);
    return NextResponse.json({ anzahl: count ?? 0 });
  }

  if (body?.aktion === "holen") {
    // Hängengebliebene Läufe wieder freigeben (Läufe laufen nie parallel, ein Thema dauert max. 25 min)
    await db
      .from("lernthemen")
      .update({ status: "wartet" })
      .eq("status", "laeuft")
      .lt("gestartet_at", new Date(Date.now() - 30 * 60_000).toISOString());

    const nurSofort = body.modus === "sofort";
    const anzahl = Math.min(Math.max(Number(body.anzahl) || 1, 1), 5);
    let q = db
      .from("lernthemen")
      .select("id, titel, material_id, course_id, versuche, courses(name, klausur_info)")
      .eq("status", "wartet")
      .lt("versuche", 3)
      .order("sofort", { ascending: false })
      // strikt in Klausur-Reihenfolge, innerhalb eines Kurses nach Vorlesungsnummer
      .order("klausur_am", { ascending: true, nullsFirst: false })
      .order("course_id", { ascending: true })
      .order("titel", { ascending: true })
      .limit(anzahl);
    if (nurSofort) q = q.eq("sofort", true);
    const { data: themen, error } = await q;
    if (error) return NextResponse.json({ fehler: error.message }, { status: 500 });

    const aufgaben = [];
    for (const t of themen ?? []) {
      const { data: m } = await db.from("materials").select("inhalt, dateiname, ordner").eq("id", t.material_id).single();
      await db
        .from("lernthemen")
        .update({ status: "laeuft", gestartet_at: new Date().toISOString(), versuche: t.versuche + 1, fehler: null })
        .eq("id", t.id);
      const c = t.courses as unknown as { name: string; klausur_info: string | null } | null;
      const zusatz = await zusatzMaterial(db, t.course_id, t.material_id, m?.dateiname ?? "", m?.inhalt ?? "");
      aufgaben.push({
        id: t.id,
        titel: t.titel,
        kurs: c?.name ?? "",
        klausur_info: c?.klausur_info ?? "",
        dateiname: m?.dateiname,
        text: m?.inhalt ?? "",
        zusatz,
      });
    }
    return NextResponse.json({ themen: aufgaben });
  }

  if (body?.aktion === "ergebnis") {
    try {
      const zusammenfassung = String(body.zusammenfassung ?? "").trim();
      if (zusammenfassung.length < 200) throw new Error("Zusammenfassung fehlt oder ist zu kurz");
      const katalog = pruefeListe<KatalogFrage>(body.katalog, ["frage", "antwort"]);
      const aufgaben = pruefeListe<Aufgabe>(body.aufgaben, ["aufgabe", "loesung"]);
      if (katalog.length < 5) throw new Error("zu wenige Katalogfragen");
      const { error } = await db
        .from("lernthemen")
        .update({ status: "fertig", zusammenfassung, katalog, aufgaben, fertig_at: new Date().toISOString(), sofort: false, fehler: null })
        .eq("id", String(body.id));
      if (error) throw new Error(error.message);
      return NextResponse.json({ ok: true });
    } catch (e) {
      return NextResponse.json({ fehler: e instanceof Error ? e.message : String(e) }, { status: 400 });
    }
  }

  if (body?.aktion === "fehler") {
    const { data: t } = await db.from("lernthemen").select("versuche").eq("id", String(body.id)).single();
    const endgueltig = (t?.versuche ?? 0) >= 3;
    await db
      .from("lernthemen")
      .update({
        status: endgueltig ? "fehler" : "wartet",
        fehler: String(body.meldung ?? "").slice(0, 1000),
        // Bei Abo-Limit nicht als Versuch zählen
        ...(body.limit ? { versuche: Math.max((t?.versuche ?? 1) - 1, 0) } : {}),
      })
      .eq("id", String(body.id));
    return NextResponse.json({ ok: true });
  }

  return NextResponse.json({ fehler: "unbekannte aktion" }, { status: 400 });
}

const MAX_ZUSATZ = 120_000;
const MAX_PDF = 3;

/**
 * Literatur zur Vorlesung und Altklausuren des Kurses.
 * Literatur passt, wenn sie dieselbe Vorlesungsnummer hat oder die Vorlesung sie zitiert (Autor + Jahr im Folientext).
 * Literatur ohne Text (eingescannt) geht als PDF-Link mit, Claude liest das PDF dann selbst.
 */
async function zusatzMaterial(
  db: ReturnType<typeof createAdminClient>,
  kursId: string,
  materialId: string,
  dateiname: string,
  vorlesung: string,
) {
  const nr = vorlesungsNr(dateiname);
  const { data: alle } = await db
    .from("materials")
    .select("id, ordner, dateiname, hat_text, storage_path, groesse")
    .eq("course_id", kursId)
    .limit(1000);
  const altklausur = (x: { ordner: string | null; dateiname: string }) => /klausur|exam|probeklausur/i.test(`${x.ordner ?? ""} ${x.dateiname}`);
  const autoren = (alle ?? []).map((x) => autorJahr(x.dateiname)?.autor).filter(Boolean);
  const eindeutig = (d: string) => autoren.filter((a) => a === autorJahr(d)?.autor).length === 1;
  const passend = (alle ?? []).filter((x) => {
    if (x.id === materialId || !/\.pdf$|\.txt$|\.pptx$/i.test(x.dateiname)) return false;
    if (altklausur(x)) return !!x.hat_text;
    if (istHauptdatei(x.dateiname)) return false;
    return (nr !== null && vorlesungsNr(x.dateiname) === nr) || wirdZitiert(x.dateiname, vorlesung, eindeutig(x.dateiname));
  });
  // Literatur zuerst, dann Altklausuren
  passend.sort((a, b) => Number(altklausur(a)) - Number(altklausur(b)));
  const ergebnis: { art: string; dateiname: string; text?: string; pdf_url?: string }[] = [];
  let platz = MAX_ZUSATZ;
  let pdfs = 0;
  for (const x of passend.slice(0, 10)) {
    if (x.hat_text) {
      if (platz < 2000) continue;
      const { data } = await db.from("materials").select("inhalt").eq("id", x.id).single();
      const text = (data?.inhalt ?? "").slice(0, Math.min(platz, 60_000));
      platz -= text.length;
      ergebnis.push({ art: altklausur(x) ? "altklausur" : "literatur", dateiname: x.dateiname, text });
    } else if (pdfs < MAX_PDF && /\.pdf$/i.test(x.dateiname) && (x.groesse ?? 0) < 25_000_000) {
      const { data } = await db.storage.from("materialien").createSignedUrl(x.storage_path, 3600);
      if (!data?.signedUrl) continue;
      pdfs++;
      ergebnis.push({ art: "literatur", dateiname: x.dateiname, pdf_url: data.signedUrl });
    }
  }
  return ergebnis;
}

/** Klausurtermine der wartenden Themen aus Portal2 auffrischen, damit die Reihenfolge stimmt, wenn sich ein Termin ändert. */
async function klausurTermineAktualisieren(db: ReturnType<typeof createAdminClient>) {
  const { data } = await db.from("lernthemen").select("user_id, course_id, courses(name)").eq("status", "wartet");
  const kurse = new Map<string, { user_id: string; course_id: string; name: string }>();
  for (const t of data ?? []) kurse.set(t.course_id, { user_id: t.user_id, course_id: t.course_id, name: (t.courses as unknown as { name: string } | null)?.name ?? "" });
  const nutzer = [...new Set([...kurse.values()].map((k) => k.user_id))];
  for (const u of nutzer) {
    const jetzt = new Date();
    const { termine } = await ladeTermine(db, jetzt, new Date(jetzt.getTime() + 200 * 86400_000), u);
    const klausuren = termine.filter(istKlausur);
    for (const k of [...kurse.values()].filter((x) => x.user_id === u)) {
      const datum = klausurFuer(k.name, klausuren)?.start.toISOString() ?? null;
      // nur setzen, wenn Portal2 einen Termin kennt (sonst bleibt ein manuell gesetzter Termin stehen)
      if (datum) await db.from("lernthemen").update({ klausur_am: datum }).eq("course_id", k.course_id).eq("status", "wartet");
    }
  }
}
