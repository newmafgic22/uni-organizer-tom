import { pruefeCode, sendeCode } from "./actions";

type SP = { status?: string; schritt?: string; email?: string };

export default async function Login({ searchParams }: { searchParams: Promise<SP> }) {
  const { status, schritt, email = "" } = await searchParams;
  const input = "rounded-lg border border-zinc-300 bg-transparent px-3 py-2 dark:border-zinc-700";
  const knopf = "rounded-lg bg-sky-600 px-3 py-2 font-medium text-white hover:bg-sky-700";
  return (
    <main className="mx-auto flex min-h-dvh max-w-sm flex-col justify-center gap-6 px-4">
      <div>
        <h1 className="text-2xl font-semibold">Uni-Organizer</h1>
        <p className="text-zinc-500">Login mit Code per E-Mail, kein Passwort.</p>
      </div>
      {schritt === "code" ? (
        <form action={pruefeCode} className="karte flex flex-col gap-3">
          <p className="text-sm">Wir haben dir einen Code an <b>{email}</b> geschickt (Absender Supabase, evtl. im Spam).</p>
          <input type="hidden" name="email" value={email} />
          <label className="text-sm font-medium" htmlFor="code">Code aus der Mail</label>
          <input id="code" name="code" inputMode="numeric" autoComplete="one-time-code" required
            className={`${input} text-center text-2xl tracking-[0.4em] tabular-nums`} />
          <button className={knopf}>Einloggen</button>
          {status === "falsch" && <p className="text-sm text-red-600">Code falsch oder abgelaufen. Nochmal probieren oder neuen Code anfordern.</p>}
          <a href="/login" className="text-center text-sm text-zinc-500 underline">Neuen Code anfordern</a>
        </form>
      ) : (
        <form action={sendeCode} className="karte flex flex-col gap-3">
          <label className="text-sm font-medium" htmlFor="email">E-Mail</label>
          <input id="email" name="email" type="email" required autoComplete="email" defaultValue={email} className={input} />
          <button className={knopf}>Code schicken</button>
          {status === "limit" && <p className="text-sm text-red-600">Zu viele Mails in kurzer Zeit. Bitte ein paar Minuten warten. Hast du schon einen Code? <a className="underline" href={`/login?schritt=code&email=${encodeURIComponent(email)}`}>Hier eingeben</a></p>}
          {status === "fehler" && <p className="text-sm text-red-600">Das hat nicht geklappt. Stimmt die E-Mail?</p>}
        </form>
      )}
    </main>
  );
}
