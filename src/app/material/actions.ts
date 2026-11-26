"use server";
import { revalidatePath } from "next/cache";
import { requireUser } from "@/lib/supabase/server";

export async function kursSichtbarkeit(form: FormData) {
  const { supabase } = await requireUser();
  await supabase
    .from("courses")
    .update({ ausgeblendet: form.get("ausblenden") === "1" })
    .eq("id", String(form.get("id")));
  revalidatePath("/material", "layout");
}
