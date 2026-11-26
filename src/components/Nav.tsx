"use client";
import Link from "next/link";
import { usePathname } from "next/navigation";

// Einfache Strich-Icons (24×24), damit auf dem Handy eine Leiste unten mit Symbolen reicht
const ICON: Record<string, string> = {
  "/": "M3 11.5 12 4l9 7.5M5.5 9.5V20h13V9.5",
  "/kalender": "M4 6.5h16V20H4zM4 10.5h16M8.5 3.5v5M15.5 3.5v5",
  "/material": "M3.5 6.5h6l2 2h9V19h-17z",
  "/lernen": "M12 6.5C10 5 7 4.5 3.5 5v13c3.5-.5 6.5 0 8.5 1.5 2-1.5 5-2 8.5-1.5V5C17 4.5 14 5 12 6.5zM12 6.5v13",
  "/einstellungen": "M12 15a3 3 0 1 0 0-6 3 3 0 0 0 0 6zM19.4 13a7.6 7.6 0 0 0 0-2l2-1.6-2-3.4-2.4 1a7.6 7.6 0 0 0-1.7-1L15 3.5h-4l-.3 2.5a7.6 7.6 0 0 0-1.7 1l-2.4-1-2 3.4 2 1.6a7.6 7.6 0 0 0 0 2l-2 1.6 2 3.4 2.4-1a7.6 7.6 0 0 0 1.7 1l.3 2.5h4l.3-2.5a7.6 7.6 0 0 0 1.7-1l2.4 1 2-3.4z",
};

const LINKS = [
  ["/", "Start"],
  ["/kalender", "Kalender"],
  ["/material", "Material"],
  ["/lernen", "Lernen"],
  ["/einstellungen", "Einstellungen"],
] as const;

function Icon({ href, className = "" }: { href: string; className?: string }) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.7} strokeLinecap="round" strokeLinejoin="round" className={className} aria-hidden>
      <path d={ICON[href]} />
    </svg>
  );
}

export function Nav() {
  const pfad = usePathname() ?? "/";
  const aktiv = (href: string) => (href === "/" ? pfad === "/" : pfad === href || pfad.startsWith(`${href}/`));
  return (
    <>
      <header className="sticky top-0 z-10 border-b border-zinc-200 bg-white/90 backdrop-blur dark:border-zinc-800 dark:bg-zinc-950/90 pt-[env(safe-area-inset-top)] print:hidden">
        <nav className="mx-auto flex max-w-5xl items-center gap-1 px-4 h-12">
          <Link href="/" className="mr-3 flex items-center gap-1.5 font-semibold whitespace-nowrap">
            <span className="grid h-6 w-6 place-items-center rounded-md bg-sky-600 text-xs font-bold text-white">U</span>
            <span>Uni-Organizer</span>
          </Link>
          {/* ab Tablet-Breite: Links oben */}
          {LINKS.map(([href, label]) => (
            <Link
              key={href}
              href={href}
              aria-current={aktiv(href) ? "page" : undefined}
              className={`hidden sm:flex items-center gap-1.5 rounded-md px-3 py-1.5 text-sm whitespace-nowrap transition-colors ${
                aktiv(href)
                  ? "bg-sky-50 font-medium text-sky-700 dark:bg-sky-950 dark:text-sky-300"
                  : "text-zinc-600 hover:bg-zinc-100 dark:text-zinc-400 dark:hover:bg-zinc-800"
              }`}
            >
              <Icon href={href} className="hidden h-4 w-4 md:block" />
              {label}
            </Link>
          ))}
        </nav>
      </header>
      {/* Handy: Leiste unten, gut mit dem Daumen erreichbar */}
      <nav className="fixed inset-x-0 bottom-0 z-10 grid grid-cols-5 border-t border-zinc-200 bg-white/95 pb-[env(safe-area-inset-bottom)] backdrop-blur dark:border-zinc-800 dark:bg-zinc-950/95 sm:hidden print:hidden">
        {LINKS.map(([href, label]) => (
          <Link
            key={href}
            href={href}
            aria-current={aktiv(href) ? "page" : undefined}
            className={`flex flex-col items-center gap-0.5 py-2 text-[10px] tracking-tight ${aktiv(href) ? "font-medium text-sky-600 dark:text-sky-400" : "text-zinc-500"}`}
          >
            <Icon href={href} className="h-6 w-6" />
            {label}
          </Link>
        ))}
      </nav>
    </>
  );
}
