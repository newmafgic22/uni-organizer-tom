"use client";
import Link from "next/link";
import { usePathname } from "next/navigation";

// Einfache Strich-Icons (24×24)
const ICON: Record<string, string> = {
  "/": "M3 11.5 12 4l9 7.5M5.5 9.5V20h13V9.5",
  "/kalender": "M4 6.5h16V20H4zM4 10.5h16M8.5 3.5v5M15.5 3.5v5",
  "/material": "M3.5 6.5h6l2 2h9V19h-17z",
  "/lernen": "M12 6.5C10 5 7 4.5 3.5 5v13c3.5-.5 6.5 0 8.5 1.5 2-1.5 5-2 8.5-1.5V5C17 4.5 14 5 12 6.5zM12 6.5v13",
  "/einstellungen": "M12 15a3 3 0 1 0 0-6 3 3 0 0 0 0 6zM19.4 13a7.6 7.6 0 0 0 0-2l2-1.6-2-3.4-2.4 1a7.6 7.6 0 0 0-1.7-1L15 3.5h-4l-.3 2.5a7.6 7.6 0 0 0-1.7 1l-2.4-1-2 3.4 2 1.6a7.6 7.6 0 0 0 0 2l-2 1.6 2 3.4 2.4-1a7.6 7.6 0 0 0 1.7 1l.3 2.5h4l.3-2.5a7.6 7.6 0 0 0 1.7-1l2.4 1 2-3.4z",
  "/lernen/wiederholen": "M4 12a8 8 0 0 1 14-5.3M20 4v4h-4M20 12a8 8 0 0 1-14 5.3M4 20v-4h4",
};

const LINKS = [
  ["/", "Start"],
  ["/kalender", "Kalender"],
  ["/lernen", "Lernen"],
  ["/material", "Material"],
  ["/einstellungen", "Einstellungen"],
] as const;

export function Icon({ name, className = "" }: { name: string; className?: string }) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round" className={className} aria-hidden>
      <path d={ICON[name]} />
    </svg>
  );
}

function Logo() {
  return (
    <span className="grid h-8 w-8 shrink-0 place-items-center rounded-xl bg-gradient-to-br from-accent-500 to-violet-500 text-sm font-bold text-white shadow-sm">
      U
    </span>
  );
}

export function Nav() {
  const pfad = usePathname() ?? "/";
  const aktiv = (href: string) => (href === "/" ? pfad === "/" : pfad === href || pfad.startsWith(`${href}/`));
  return (
    <>
      {/* PC / iPad quer: Seitenleiste links */}
      <aside className="seitenleiste fixed inset-y-0 left-0 z-20 hidden w-60 flex-col gap-1 border-r border-zinc-200/80 bg-white/70 px-3 py-5 backdrop-blur-xl lg:flex dark:border-zinc-800 dark:bg-zinc-900/60 print:hidden">
        <Link href="/" className="mb-6 flex items-center gap-2.5 px-2 font-semibold tracking-tight">
          <Logo />
          <span>Uni-Organizer</span>
        </Link>
        {LINKS.map(([href, label]) => (
          <Link
            key={href}
            href={href}
            aria-current={aktiv(href) ? "page" : undefined}
            className={`flex items-center gap-3 rounded-xl px-3 py-2 text-sm transition-colors ${
              aktiv(href)
                ? "bg-accent-50 font-semibold text-accent-700 dark:bg-accent-500/15 dark:text-accent-300"
                : "text-zinc-600 hover:bg-zinc-100 hover:text-zinc-900 dark:text-zinc-400 dark:hover:bg-zinc-800 dark:hover:text-zinc-100"
            }`}
          >
            <Icon name={href} className="h-5 w-5" />
            {label}
          </Link>
        ))}
        <Link href="/lernen/wiederholen" className="knopf mt-auto">
          <Icon name="/lernen/wiederholen" className="h-4 w-4" />
          Heute wiederholen
        </Link>
      </aside>

      {/* iPad hoch / kleines Fenster: Leiste oben */}
      <header className="sticky top-0 z-20 hidden border-b border-zinc-200/80 bg-white/80 pt-[env(safe-area-inset-top)] backdrop-blur-xl sm:block lg:hidden dark:border-zinc-800 dark:bg-zinc-950/80 print:hidden">
        <nav className="mx-auto flex h-14 max-w-5xl items-center gap-1 px-4">
          <Link href="/" className="mr-3 flex items-center gap-2 font-semibold tracking-tight">
            <Logo />
            <span className="hidden md:inline">Uni-Organizer</span>
          </Link>
          {LINKS.map(([href, label]) => (
            <Link
              key={href}
              href={href}
              aria-current={aktiv(href) ? "page" : undefined}
              className={`flex items-center gap-1.5 rounded-xl px-3 py-1.5 text-sm whitespace-nowrap transition-colors ${
                aktiv(href)
                  ? "bg-accent-50 font-semibold text-accent-700 dark:bg-accent-500/15 dark:text-accent-300"
                  : "text-zinc-600 hover:bg-zinc-100 dark:text-zinc-400 dark:hover:bg-zinc-800"
              }`}
            >
              <Icon name={href} className="h-4 w-4" />
              {label}
            </Link>
          ))}
        </nav>
      </header>

      {/* Handy: Leiste unten, gut mit dem Daumen erreichbar */}
      <nav className="seitenleiste fixed inset-x-0 bottom-0 z-20 grid grid-cols-5 border-t border-zinc-200/80 bg-white/85 pb-[env(safe-area-inset-bottom)] backdrop-blur-xl sm:hidden dark:border-zinc-800 dark:bg-zinc-950/85 print:hidden">
        {LINKS.map(([href, label]) => (
          <Link
            key={href}
            href={href}
            aria-current={aktiv(href) ? "page" : undefined}
            className={`flex flex-col items-center gap-1 pt-2 pb-1.5 text-[10px] font-medium tracking-tight ${
              aktiv(href) ? "text-accent-600 dark:text-accent-400" : "text-zinc-500"
            }`}
          >
            <span className={`grid h-7 w-12 place-items-center rounded-full transition-colors ${aktiv(href) ? "bg-accent-100 dark:bg-accent-500/20" : ""}`}>
              <Icon name={href} className="h-5 w-5" />
            </span>
            {label}
          </Link>
        ))}
      </nav>
      {/* Handy: Abstand oben für die Statusleiste (Home-Bildschirm-App) */}
      <div className="h-[env(safe-area-inset-top)] sm:hidden print:hidden" />
    </>
  );
}
