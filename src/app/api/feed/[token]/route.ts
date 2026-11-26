import { baueIcs } from "@/lib/ical";
import { ladeTermine } from "@/lib/daten";
import { createAdminClient } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export async function GET(_req: Request, { params }: { params: Promise<{ token: string }> }) {
  const token = (await params).token.replace(/\.ics$/i, "");
  if (!UUID.test(token)) return new Response("Nicht gefunden", { status: 404 });
  const admin = createAdminClient();
  const { data } = await admin.from("user_settings").select("user_id").eq("feed_token", token).maybeSingle();
  if (!data) return new Response("Nicht gefunden", { status: 404 });

  const jetzt = Date.now();
  const von = new Date(jetzt - 30 * 86400000);
  const bis = new Date(jetzt + 240 * 86400000);
  const { termine } = await ladeTermine(admin, von, bis, data.user_id);
  return new Response(baueIcs(termine), {
    headers: {
      "Content-Type": "text/calendar; charset=utf-8",
      "Content-Disposition": 'inline; filename="uni-app.ics"',
      "Cache-Control": "private, max-age=900",
    },
  });
}
