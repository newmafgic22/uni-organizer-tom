import Link from "next/link";

export function Nav() {
  const links = [
    ["/", "Start"],
    ["/kalender", "Kalender"],
    ["/material", "Material"],
    ["/einstellungen", "Einstellungen"],
  ];
  return (
    <header className="sticky top-0 z-10 border-b border-zinc-200 bg-white/90 backdrop-blur dark:border-zinc-800 dark:bg-zinc-950/90 pt-[env(safe-area-inset-top)]">
      <nav className="mx-auto flex max-w-5xl items-center gap-1 px-4 h-12 overflow-x-auto">
        <span className="mr-3 font-semibold whitespace-nowrap">Uni-Organizer</span>
        {links.map(([href, label]) => (
          <Link key={href} href={href} className="rounded-md px-3 py-1.5 text-sm hover:bg-zinc-100 dark:hover:bg-zinc-800 whitespace-nowrap">
            {label}
          </Link>
        ))}
      </nav>
    </header>
  );
}
