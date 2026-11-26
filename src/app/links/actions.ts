"use server";
import { revalidatePath } from "next/cache";
import { requireUser } from "@/lib/supabase/server";

export async function linkGesehen(form: FormData) {
  const { supabase } = await requireUser();
  await supabase.from("links").update({ gesehen: true, updated_at: new Date().toISOString() }).eq("id", String(form.get("id")));
  revalidatePath("/", "layout");
}

export async function linkSichtbarkeit(form: FormData) {
  const { supabase } = await requireUser();
  const aus = form.get("ausblenden") === "1";
  await supabase
    .from("links")
    .update({ ausgeblendet: aus, gesehen: true, updated_at: new Date().toISOString() })
    .eq("id", String(form.get("id")));
  revalidatePath("/", "layout");
}

/** Link selbst als wichtig markieren oder zurückstufen. */
export async function linkWichtig(form: FormData) {
  const { supabase } = await requireUser();
  await supabase
    .from("links")
    .update({ wichtig: form.get("wichtig") === "1", gesehen: true, updated_at: new Date().toISOString() })
    .eq("id", String(form.get("id")));
  revalidatePath("/", "layout");
}
