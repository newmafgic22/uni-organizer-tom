import { passwortLogin, sendeLink } from "./actions";

export default async function Login({ searchParams }: { searchParams: Promise<{ status?: string; modus?: string }> }) {
  const { status, modus } = await searchParams;
  const input = "rounded-lg border border-zinc-300 bg-transparent px-3 py-2 dark:border-zinc-700";
  const knopf = "rounded-lg bg-sky-600 px-3 py-2 font-medium text-white hover:bg-sky-700";
  return (
    <main className="mx-auto flex min-h-dvh max-w-sm flex-col justify-center gap-6 px-4">
      <div>
        <h1 className="text-2xl font-semibold">Uni-Organizer</h1>
        <p className="text-zinc-500">Login per E-Mail-Link, kein Passwort.</p>
      </div>
      {modus === "passwort" ? (
        <form action={passwortLogin} className="karte flex flex-col gap-3">
          <label className="text-sm font-medium" htmlFor="email">E-Mail</label>
          <input id="email" name="email" type="email" required autoComplete="username" className={input} />
          <label className="text-sm font-medium" htmlFor="passwort">Passwort</label>
          <input id="passwort" name="passwort" type="password" required autoComplete="current-password" className={input} />
          <button className={knopf}>Einloggen</button>
          {status === "falsch" && <p className="text-sm text-red-600">E-Mail oder Passwort falsch.</p>}
          {status === "fehler" && <p className="text-sm text-red-600">Login hat nicht geklappt, bitte nochmal.</p>}
          <a href="/login" className="text-center text-sm text-zinc-500 underline">Stattdessen Link per Mail</a>
        </form>
      ) : status === "gesendet" ? (
        <div className="karte">
          Link ist unterwegs. Öffne die Mail (Absender Supabase, evtl. im Spam) und tippe auf den Link. Das geht auf jedem Gerät, z. B. auch direkt auf dem iPad.
        </div>
      ) : (
        <form action={sendeLink} className="karte flex flex-col gap-3">
          <label className="text-sm font-medium" htmlFor="email">E-Mail</label>
          <input id="email" name="email" type="email" required autoComplete="email"
            className="rounded-lg border border-zinc-300 bg-transparent px-3 py-2 dark:border-zinc-700" />
          <button className="rounded-lg bg-sky-600 px-3 py-2 font-medium text-white hover:bg-sky-700">Login-Link schicken</button>
          {status === "limit" && <p className="text-sm text-red-600">Zu viele Mails in kurzer Zeit (Supabase-Limit). Bitte ca. eine Stunde warten oder den letzten Link benutzen.</p>}
          {status === "fehler" && <p className="text-sm text-red-600">Das hat nicht geklappt. Bitte nochmal versuchen.</p>}
          {status === "abgelaufen" && <p className="text-sm text-red-600">Der Link war schon benutzt oder abgelaufen. Fordere einen neuen an.</p>}
          <a href="/login?modus=passwort" className="text-center text-sm text-zinc-500 underline">Mit Passwort einloggen</a>
        </form>
      )}
    </main>
  );
}
