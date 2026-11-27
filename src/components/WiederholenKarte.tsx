import Link from "next/link";
import type { Status } from "@/lib/wiederholen";

/** Karte für die Startseite: wie viele Fragen heute dran sind. */
export function WiederholenKarte({ status }: { status: Status[] }) {
  const faellig = status.filter((s) => s.faellig).length;
  const neu = status.filter((s) => s.neu).length;
  const sicher = status.filter((s) => s.serie >= 1).length;
  if (!status.length) return null;
  const p = Math.round((sicher / status.length) * 100);
  return (
    <section className="karte flex flex-col">
      <h2 className="abschnitt">Heute wiederholen</h2>
      <div className="mt-2 flex items-baseline gap-2">
        <span className="text-5xl font-bold tracking-tight tabular-nums">{faellig}</span>
        <span className="text-zinc-500">{faellig === 1 ? "Frage fällig" : "Fragen fällig"}</span>
      </div>
      <div className="mt-3 grid grid-cols-2 gap-2 text-sm">
        <div className="rounded-xl bg-zinc-50 px-3 py-2 dark:bg-zinc-800/60">
          <div className="text-xs text-zinc-500">Neu</div>
          <div className="font-semibold tabular-nums">{neu}</div>
        </div>
        <div className="rounded-xl bg-zinc-50 px-3 py-2 dark:bg-zinc-800/60">
          <div className="text-xs text-zinc-500">Sitzen</div>
          <div className="font-semibold tabular-nums">
            {sicher} <span className="font-normal text-zinc-500">({p} %)</span>
          </div>
        </div>
      </div>
      <div className="mt-4 flex flex-wrap gap-2 sm:mt-auto sm:pt-4">
        {faellig > 0 && (
          <Link href="/lernen/wiederholen" className="knopf flex-1">
            Jetzt wiederholen
          </Link>
        )}
        {neu > 0 && (
          <Link href="/lernen/wiederholen?neu=1" className={`${faellig > 0 ? "knopf-2" : "knopf"} flex-1`}>
            Neue lernen
          </Link>
        )}
      </div>
    </section>
  );
}
