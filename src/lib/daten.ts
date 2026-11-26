import { decrypt } from "@/lib/crypto";
import { holeAlle, type Quelle } from "@/lib/ical";
import type { SupabaseClient } from "@supabase/supabase-js";

export type QuelleZeile = { id: string; name: string; kind: Quelle; url_encrypted: string };

export async function ladeQuellen(supabase: SupabaseClient, userId?: string) {
  let q = supabase.from("calendar_sources").select("id,name,kind,url_encrypted").order("created_at");
  if (userId) q = q.eq("user_id", userId);
  const { data, error } = await q;
  if (error) throw new Error(error.message);
  return (data ?? []) as QuelleZeile[];
}

export async function ladeTermine(supabase: SupabaseClient, von: Date, bis: Date, userId?: string) {
  const quellen = await ladeQuellen(supabase, userId);
  const entschl = quellen.map((q) => ({ name: q.name, kind: q.kind, url: decrypt(q.url_encrypted) }));
  const r = await holeAlle(entschl, von, bis);
  return { ...r, anzahlQuellen: quellen.length };
}
