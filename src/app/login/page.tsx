import { sendeLink } from "./actions";

export default async function Login({ searchParams }: { searchParams: Promise<{ status?: string }> }) {
  const { status } = await searchParams;
  return (
    <main className="mx-auto flex min-h-dvh max-w-sm flex-col justify-center gap-6 px-4">
      <div>
        <h1 className="text-2xl font-semibold">Uni-Organizer</h1>
        <p className="text-zinc-500">Login per E-Mail-Link, kein Passwort.</p>
      </div>
      {status === "gesendet" ? (
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
        </form>
      )}
    </main>
  );
}
