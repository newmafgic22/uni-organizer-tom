"use server";
import { revalidatePath } from "next/cache";
import { encrypt } from "@/lib/crypto";
import { requireUser } from "@/lib/supabase/server";

export async function quelleHinzufuegen(form: FormData) {
  const { supabase, user } = await requireUser();
  if (!user) return;
  const kind = String(form.get("kind"));
  const url = String(form.get("url") ?? "").trim().replace(/&amp;/g, "&").replace(/^webcal:\/\//i, "https://");
  if (!/^https:\/\//i.test(url)) return;
  const name = kind === "ilias" ? "ILIAS" : kind === "portal2" ? "Portal2" : String(form.get("name") || "Kalender");
  await supabase.from("calendar_sources").insert({
    user_id: user.id,
    kind: ["ilias", "portal2"].includes(kind) ? kind : "sonstig",
    name,
    url_encrypted: encrypt(url),
  });
  revalidatePath("/", "layout");
}

export async function quelleLoeschen(form: FormData) {
  const { supabase } = await requireUser();
  await supabase.from("calendar_sources").delete().eq("id", String(form.get("id")));
  revalidatePath("/", "layout");
}

export async function feedNeu() {
  const { supabase, user } = await requireUser();
  if (!user) return;
  await supabase.from("user_settings").upsert({ user_id: user.id, feed_token: crypto.randomUUID() });
  revalidatePath("/einstellungen");
}
