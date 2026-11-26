import type { SupabaseClient } from "@supabase/supabase-js";
import { istHauptdatei, istLernmodul } from "@/lib/lernen";

type M = { id: string; course_id: string; dateiname: string; hat_text: boolean | null };

export const themaTitel = (dateiname: string) =>
  dateiname.replace(/\.[a-z0-9]+$/i, "").replace(/ \(Lernmodul\)$/, "").replace(/_/g, " ");

/** Soll aus dieser Datei automatisch ein Lernthema werden? (Vorlesungsfolien oder Lernmodul mit Text) */
export const lohntThema = (m: { dateiname: string; hat_text: boolean | null }) =>
  !!m.hat_text && (istHauptdatei(m.dateiname) || istLernmodul(m.dateiname));

/** Legt Lernthemen für die Materialien an (vorhandene bleiben unverändert). Gibt die Anzahl zurück. */
export async function themenAnlegen(db: SupabaseClient, userId: string, materialien: M[], klausurAm: string | null) {
  const zeilen = materialien.map((m) => ({
    user_id: userId,
    material_id: m.id,
    course_id: m.course_id,
    titel: themaTitel(m.dateiname),
    klausur_am: klausurAm,
  }));
  if (!zeilen.length) return 0;
  const { error } = await db.from("lernthemen").upsert(zeilen, { onConflict: "user_id,material_id", ignoreDuplicates: true });
  if (error) throw new Error(error.message);
  return zeilen.length;
}
