import { NextResponse, type NextRequest } from "next/server";
import { createAdminClient } from "@/lib/supabase/server";
import { ladeTermine } from "@/lib/daten";
import { istKlausur } from "@/lib/ical";
import { klausurFuer } from "@/lib/lernen";
import { lohntThema, themenAnlegen } from "@/lib/einreihen";

// Schnittstelle für das Sync-Skript auf Toms PC.
// Anmeldung per "Authorization: Bearer <sync_token>" (steht in den Einstellungen).

const MAX_TEXT = 200_000;
const UUID = /^[0-9a-f-]{36}$/i;

function sauber(name: string) {
  return name.normalize("NFKD").replace(/[^\w.\- ]+/g, "_").replace(/\s+/g, "_").slice(0, 120) || "datei";
}

export async function POST(req: NextRequest) {
  const token = (req.headers.get("authorization") ?? "").replace(/^Bearer\s+/i, "").trim();
  if (!UUID.test(token)) return NextResponse.json({ fehler: "Kein gültiger Sync-Schlüssel" }, { status: 401 });
  const db = createAdminClient();
  const { data: s } = await db.from("user_settings").select("user_id").eq("sync_token", token).maybeSingle();
  if (!s) return NextResponse.json({ fehler: "Sync-Schlüssel unbekannt" }, { status: 401 });
  const userId: string = s.user_id;

  const body = await req.json().catch(() => null);
  if (!body?.aktion) return NextResponse.json({ fehler: "aktion fehlt" }, { status: 400 });

  if (body.aktion === "start") {
    const kurse: { ref: string; name: string }[] = Array.isArray(body.kurse) ? body.kurse : [];
    if (kurse.length) {
      const { error } = await db.from("courses").upsert(
        kurse.map((k) => ({ user_id: userId, ilias_ref: String(k.ref), name: String(k.name).slice(0, 300) })),
        { onConflict: "user_id,ilias_ref" },
      );
      if (error) return NextResponse.json({ fehler: error.message }, { status: 500 });
    }
    const { data: alle } = await db.from("courses").select("id, ilias_ref, name, ausgeblendet").eq("user_id", userId);
    const { data: mats } = await db.from("materials").select("ilias_id, version").eq("user_id", userId);
    const dateien: Record<string, string> = {};
    (mats ?? []).forEach((m) => (dateien[m.ilias_id] = m.version));
    return NextResponse.json({ kurse: alle ?? [], dateien });
  }

  if (body.aktion === "upload") {
    const kursId = String(body.kurs_id ?? "");
    const { data: kurs } = await db.from("courses").select("id").eq("id", kursId).eq("user_id", userId).maybeSingle();
    if (!kurs) return NextResponse.json({ fehler: "Kurs unbekannt" }, { status: 404 });
    const path = `${userId}/${kursId}/${sauber(String(body.ilias_id))}_${Date.now()}_${sauber(String(body.dateiname ?? ""))}`;
    const { data, error } = await db.storage.from("materialien").createSignedUploadUrl(path);
    if (error || !data) return NextResponse.json({ fehler: error?.message ?? "Upload-Link fehlgeschlagen" }, { status: 500 });
    return NextResponse.json({ path, url: data.signedUrl });
  }

  if (body.aktion === "fertig") {
    const kursId = String(body.kurs_id ?? "");
    const path = String(body.path ?? "");
    if (!path.startsWith(`${userId}/${kursId}/`)) return NextResponse.json({ fehler: "Pfad passt nicht" }, { status: 400 });
    const iliasId = String(body.ilias_id);
    const { data: alt } = await db.from("materials").select("storage_path").eq("user_id", userId).eq("ilias_id", iliasId).maybeSingle();
    const { error } = await db.from("materials").upsert(
      {
        user_id: userId,
        course_id: kursId,
        ilias_id: iliasId,
        version: String(body.version ?? ""),
        ordner: String(body.ordner ?? "").slice(0, 500),
        dateiname: String(body.dateiname ?? "Datei").slice(0, 300),
        groesse: Number(body.groesse) || null,
        storage_path: path,
        inhalt: typeof body.inhalt === "string" ? body.inhalt.replace(/\u0000/g, "").slice(0, MAX_TEXT) : null,
        updated_at: new Date().toISOString(),
      },
      { onConflict: "user_id,ilias_id" },
    );
    if (error) return NextResponse.json({ fehler: error.message }, { status: 500 });
    if (alt?.storage_path && alt.storage_path !== path) await db.storage.from("materialien").remove([alt.storage_path]);
    return NextResponse.json({ ok: true });
  }

  if (body.aktion === "ende") {
    const ids: string[] = Array.isArray(body.kurs_ids) ? body.kurs_ids.map(String) : [];
    if (ids.length) await db.from("courses").update({ zuletzt_sync: new Date().toISOString() }).eq("user_id", userId).in("id", ids);
    const neu = await autoEinreihen(db, userId).catch(() => 0);
    return NextResponse.json({ ok: true, neu_eingereiht: neu });
  }

  return NextResponse.json({ fehler: "unbekannte aktion" }, { status: 400 });
}

/** Neue Vorlesungen in Kursen mit „Alle einreihen“ automatisch in die Warteschlange legen. */
async function autoEinreihen(db: ReturnType<typeof createAdminClient>, userId: string) {
  const { data: kurse } = await db.from("courses").select("id, name").eq("user_id", userId).eq("auto_einreihen", true);
  if (!kurse?.length) return 0;
  const jetzt = new Date();
  const klausuren = await ladeTermine(db, jetzt, new Date(jetzt.getTime() + 200 * 86400_000), userId)
    .then((r) => r.termine.filter(istKlausur))
    .catch(() => []);
  let n = 0;
  for (const k of kurse) {
    const { data: mats } = await db.from("materials").select("id, course_id, dateiname, hat_text").eq("course_id", k.id).limit(1000);
    const { data: lt } = await db.from("lernthemen").select("material_id").eq("course_id", k.id);
    const vorhanden = new Set((lt ?? []).map((t) => t.material_id));
    const offen = (mats ?? []).filter((m) => lohntThema(m) && !vorhanden.has(m.id));
    n += await themenAnlegen(db, userId, offen, klausurFuer(k.name, klausuren)?.start.toISOString() ?? null);
  }
  return n;
}
