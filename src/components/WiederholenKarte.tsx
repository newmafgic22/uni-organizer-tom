import Link from "next/link";
import type { Status } from "@/lib/wiederholen";

/** Karte für die Startseite: wie viele Fragen heute dran sind. */
export function WiederholenKarte({ status }: { status: Status[] }) {
  const faellig = status.filter((s) => s.faellig).length;
  const neu = status.filter((s) => s.neu).length;
  const sicher = status.filter((s) => s.serie >= 2).length;
  if (!status.length) return null;
  return (
    <section className="karte flex flex-wrap items-center justify-between gap-3">
      <div>
        <h2 className="text-sm font-semibold uppercase tracking-wide text-zinc-500">Heute wiederholen</h2>
        <p className="mt-1">
          <span className="text-2xl font-bold tabular-nums">{faellig}</span> Fragen fällig
          <span className="text-sm text-zinc-500"> · {neu} neu · {sicher} von {status.length} sitzen</span>
        </p>
      </div>
      <div className="flex gap-2">
        {faellig > 0 && (
          <Link href="/lernen/wiederholen" className="rounded-md bg-sky-600 px-3 py-1.5 text-sm font-medium text-white">
            Jetzt wiederholen
          </Link>
        )}
        {neu > 0 && (
          <Link href="/lernen/wiederholen?neu=1" className="rounded-md border border-sky-600 px-3 py-1.5 text-sm text-sky-600">
            Neue lernen
          </Link>
        )}
      </div>
    </section>
  );
}
