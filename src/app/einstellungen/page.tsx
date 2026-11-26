import { headers } from "next/headers";
import { Nav } from "@/components/Nav";
import { Kopieren } from "@/components/Kopieren";
import { ladeQuellen } from "@/lib/daten";
import { requireUser } from "@/lib/supabase/server";
import { abmelden } from "@/app/login/actions";
import { feedNeu, quelleHinzufuegen, quelleLoeschen } from "./actions";

export const dynamic = "force-dynamic";

export default async function Einstellungen() {
  const { supabase, user } = await requireUser();
  const quellen = await ladeQuellen(supabase);
  let { data: settings } = await supabase.from("user_settings").select("feed_token").maybeSingle();
  if (!settings && user) {
    const ins = await supabase.from("user_settings").insert({ user_id: user.id }).select("feed_token").single();
    settings = ins.data;
  }
  const h = await headers();
  const host = h.get("host");
  const feed = settings ? `https://${host}/api/feed/${settings.feed_token}` : "";

  const input = "w-full rounded-lg border border-zinc-300 bg-transparent px-3 py-2 dark:border-zinc-700";
  return (
    <>
      <Nav />
      <main className="mx-auto max-w-3xl px-4 py-6 flex flex-col gap-4">
        <h1 className="text-2xl font-semibold">Einstellungen</h1>

        <section className="karte flex flex-col gap-3">
          <h2 className="font-semibold">Kalender-Quellen</h2>
          <p className="text-sm text-zinc-500">Die Links werden verschlüsselt gespeichert und nie wieder angezeigt.</p>
          <ul className="divide-y divide-zinc-200 dark:divide-zinc-800">
            {quellen.map((q) => (
              <li key={q.id} className="flex items-center justify-between py-2">
                <span>{q.name}</span>
                <form action={quelleLoeschen}>
                  <input type="hidden" name="id" value={q.id} />
                  <button className="text-sm text-red-600">Entfernen</button>
                </form>
              </li>
            ))}
            {quellen.length === 0 && <li className="py-2 text-sm text-zinc-500">Noch keine.</li>}
          </ul>
          <form action={quelleHinzufuegen} className="flex flex-col gap-2 sm:flex-row">
            <select name="kind" className={`${input} sm:w-40`}>
              <option value="portal2">Portal2</option>
              <option value="ilias">ILIAS</option>
              <option value="sonstig">Sonstiger</option>
            </select>
            <input name="url" type="url" required placeholder="https://… (iCal-Link)" className={input} />
            <button className="rounded-lg bg-sky-600 px-4 py-2 font-medium text-white hover:bg-sky-700">Hinzufügen</button>
          </form>
        </section>

        <section className="karte flex flex-col gap-3">
          <h2 className="font-semibold">Abo-Kalender für iCloud</h2>
          <p className="text-sm text-zinc-500">
            Diesen Link in iCloud abonnieren: auf <b>icloud.com/calendar</b> links unten auf <b>+</b> → <b>Kalenderabonnement hinzufügen</b>, Link einfügen,
            Name „Uni-App“. Danach taucht er auf iPhone und iPad automatisch auf (Aktualisierung je nach Gerät alle 15–60 min).
          </p>
          {feed && (
            <div className="flex gap-2">
              <input readOnly value={feed} className={`${input} font-mono text-xs`} />
              <Kopieren text={feed} />
            </div>
          )}
          <form action={feedNeu}>
            <button className="text-sm text-zinc-500 underline">Neuen Link erzeugen (alter funktioniert dann nicht mehr)</button>
          </form>
        </section>

        <section className="karte flex items-center justify-between">
          <span className="text-sm text-zinc-500">Angemeldet als {user?.email}</span>
          <form action={abmelden}>
            <button className="text-sm text-red-600">Abmelden</button>
          </form>
        </section>
      </main>
    </>
  );
}
