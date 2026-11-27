import Link from "next/link";
import type { Status } from "@/lib/wiederholen";

/** Karte für die Startseite: wie viele Fragen heute dran sind. */
export function WiederholenKarte({ status }: { status: Status[] }) {
  const faellig = status.filter((s) => s.faellig).length;
  const neu = status.filter((s) => s.neu).length;
  if (!status.length) return null;
  return (
    <section className="karte flex flex-col">
      <h2 className="abschnitt">Heute wiederholen</h2>
      <div className="mt-2 flex items-baseline gap-2">
        <span className="text-5xl font-bold tracking-tight tabular-nums">{faellig}</span>
        <span className="text-zinc-500">{faellig === 1 ? "Frage fällig" : "Fragen fällig"}</span>
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
