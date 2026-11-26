"use client";
import Link from "next/link";
import { usePathname } from "next/navigation";

const LINKS = [
  ["/", "Start"],
  ["/kalender", "Kalender"],
  ["/material", "Material"],
  ["/lernen", "Lernen"],
  ["/einstellungen", "Einstellungen"],
] as const;

export function Nav() {
  const pfad = usePathname() ?? "/";
  const aktiv = (href: string) => (href === "/" ? pfad === "/" : pfad === href || pfad.startsWith(`${href}/`));
  return (
    <header className="sticky top-0 z-10 border-b border-zinc-200 bg-white/90 backdrop-blur dark:border-zinc-800 dark:bg-zinc-950/90 pt-[env(safe-area-inset-top)] print:hidden">
      <nav className="mx-auto flex max-w-5xl items-center gap-1 px-4 h-12 overflow-x-auto">
        <Link href="/" className="mr-3 flex items-center gap-1.5 font-semibold whitespace-nowrap">
          <span className="grid h-6 w-6 place-items-center rounded-md bg-sky-600 text-xs font-bold text-white">U</span>
          <span className="hidden sm:inline">Uni-Organizer</span>
        </Link>
        {LINKS.map(([href, label]) => (
          <Link
            key={href}
            href={href}
            aria-current={aktiv(href) ? "page" : undefined}
            className={`rounded-md px-3 py-1.5 text-sm whitespace-nowrap transition-colors ${
              aktiv(href)
                ? "bg-sky-50 font-medium text-sky-700 dark:bg-sky-950 dark:text-sky-300"
                : "text-zinc-600 hover:bg-zinc-100 dark:text-zinc-400 dark:hover:bg-zinc-800"
            }`}
          >
            {label}
          </Link>
        ))}
      </nav>
    </header>
  );
}
