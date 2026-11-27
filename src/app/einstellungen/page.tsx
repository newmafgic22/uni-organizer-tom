import { headers } from "next/headers";
import { Nav } from "@/components/Nav";
import { Kopieren } from "@/components/Kopieren";
import { ladeQuellen } from "@/lib/daten";
import { requireUser } from "@/lib/supabase/server";
import { abmelden } from "@/app/login/actions";
import { feedNeu, quelleHinzufuegen, quelleLoeschen, syncNeu } from "./actions";

export const dynamic = "force-dynamic";

export default async function Einstellungen() {
  const { supabase, user } = await requireUser();
  const quellen = await ladeQuellen(supabase);
  let { data: settings } = await supabase.from("user_settings").select("feed_token, sync_token").maybeSingle();
  if (!settings && user) {
    const ins = await supabase.from("user_settings").insert({ user_id: user.id }).select("feed_token, sync_token").single();
    settings = ins.data;
  }
  const h = await headers();
  const host = h.get("host");
  const feed = settings ? `https://${host}/api/feed/${settings.feed_token}` : "";

  const input = "eingabe";
  return (
    <>
      <Nav />
      <main className="mx-auto max-w-3xl px-4 py-6 sm:px-6 lg:py-10 flex flex-col gap-4 sm:gap-5">
        <h1 className="seitentitel">Einstellungen</h1>

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
            <button className="knopf">Hinzufügen</button>
          </form>
        </section>

        <section className="karte flex flex-col gap-3">
          <h2 className="font-semibold">Abo-Kalender für iCloud</h2>
          <p className="text-sm text-zinc-500">
            Enthält deine <b>Lernblöcke</b> (mit Erinnerung 10 min vorher) und ILIAS-Fristen. Vorlesungen und Klausuren sind nicht drin, die hast du
            schon im Uni-Kalender, so ist nichts doppelt.
          </p>
          <ol className="list-decimal pl-5 text-sm text-zinc-500">
            <li>Link unten kopieren und dir aufs iPhone schicken (oder direkt auf dem iPhone hier öffnen).</li>
            <li>iPhone: <b>Einstellungen → Apps → Kalender → Kalender-Accounts → Account hinzufügen → Andere → Kalenderabo hinzufügen</b>, Link einfügen.</li>
            <li>Bei „Account“ <b>iCloud</b> wählen (dann ist er auch auf iPad und PC), Name „Uni-App Lernplan“, <b>„Hinweise entfernen“ ausschalten</b>, damit die Erinnerungen kommen.</li>
          </ol>
          <p className="text-xs text-zinc-500">Alles inkl. Vorlesungen: Link mit <code>?alles=1</code> am Ende.</p>
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

        <section className="karte flex flex-col gap-3">
          <h2 className="font-semibold">PC-Sync (ILIAS-Dateien)</h2>
          <p className="text-sm text-zinc-500">
            Diesen Schlüssel fragt das Sync-Skript beim Einrichten ab (<code>python ilias_sync.py --einrichten</code>). Wie ein Passwort behandeln.
          </p>
          {settings?.sync_token && (
            <div className="flex gap-2">
              <input readOnly value={settings.sync_token} className={`${input} font-mono text-xs`} />
              <Kopieren text={settings.sync_token} />
            </div>
          )}
          <form action={syncNeu}>
            <button className="text-sm text-zinc-500 underline">Neuen Schlüssel erzeugen (Skript muss dann neu eingerichtet werden)</button>
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
