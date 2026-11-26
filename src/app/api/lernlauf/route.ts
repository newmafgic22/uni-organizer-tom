import { NextResponse, type NextRequest } from "next/server";
import { createRemoteJWKSet, jwtVerify } from "jose";
import { createAdminClient } from "@/lib/supabase/server";
import { istHauptdatei, pruefeListe, vorlesungsNr, type Aufgabe, type KatalogFrage } from "@/lib/lernen";

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

  if (body?.aktion === "anzahl") {
    const { count } = await db.from("lernthemen").select("id", { count: "exact", head: true }).eq("status", "wartet").lt("versuche", 3);
    return NextResponse.json({ anzahl: count ?? 0 });
  }

  if (body?.aktion === "holen") {
    // Hängengebliebene Läufe (älter als 2 h) wieder freigeben
    await db
      .from("lernthemen")
      .update({ status: "wartet" })
      .eq("status", "laeuft")
      .lt("gestartet_at", new Date(Date.now() - 2 * 3600_000).toISOString());

    const nurSofort = body.modus === "sofort";
    const anzahl = Math.min(Math.max(Number(body.anzahl) || 1, 1), 5);
    let q = db
      .from("lernthemen")
      .select("id, titel, material_id, course_id, versuche, courses(name, klausur_info)")
      .eq("status", "wartet")
      .lt("versuche", 3)
      .order("sofort", { ascending: false })
      .order("klausur_am", { ascending: true, nullsFirst: false })
      .order("created_at", { ascending: true })
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
      const zusatz = await zusatzMaterial(db, t.course_id, t.material_id, m?.dateiname ?? "");
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

/** Literatur zur gleichen Vorlesung (gleiche Nummer, keine Folien) und Altklausuren des Kurses. */
async function zusatzMaterial(db: ReturnType<typeof createAdminClient>, kursId: string, materialId: string, dateiname: string) {
  const nr = vorlesungsNr(dateiname);
  const { data: alle } = await db
    .from("materials")
    .select("id, ordner, dateiname, hat_text")
    .eq("course_id", kursId)
    .eq("hat_text", true)
    .limit(1000);
  const altklausur = (x: { ordner: string | null; dateiname: string }) => /klausur|exam|probeklausur/i.test(`${x.ordner ?? ""} ${x.dateiname}`);
  const passend = (alle ?? []).filter(
    (x) => x.id !== materialId && ((nr !== null && vorlesungsNr(x.dateiname) === nr && !istHauptdatei(x.dateiname)) || altklausur(x)),
  );
  // Literatur zuerst, dann Altklausuren
  passend.sort((a, b) => Number(altklausur(a)) - Number(altklausur(b)));
  const ergebnis: { art: string; dateiname: string; text: string }[] = [];
  let platz = MAX_ZUSATZ;
  for (const x of passend.slice(0, 8)) {
    if (platz < 2000) break;
    const { data } = await db.from("materials").select("inhalt").eq("id", x.id).single();
    const text = (data?.inhalt ?? "").slice(0, Math.min(platz, 60_000));
    platz -= text.length;
    ergebnis.push({ art: altklausur(x) ? "altklausur" : "literatur", dateiname: x.dateiname, text });
  }
  return ergebnis;
}
