import { Nav } from "@/components/Nav";

// Wird sofort angezeigt, während eine Seite auf dem Server lädt
export default function Laden() {
  return (
    <>
      <Nav />
      <main className="mx-auto max-w-6xl px-4 py-6 sm:px-6 lg:py-10 flex flex-col gap-4 sm:gap-5 animate-pulse" aria-busy="true" aria-label="Lädt">
        <div className="h-4 w-32 rounded-md bg-zinc-200 dark:bg-zinc-800" />
        <div className="h-8 w-56 rounded-lg bg-zinc-200 dark:bg-zinc-800" />
        <div className="grid gap-4 sm:gap-5 lg:grid-cols-3">
          <div className="karte h-48 lg:col-span-2" />
          <div className="karte h-48" />
        </div>
        <div className="grid gap-4 sm:gap-5 lg:grid-cols-3">
          <div className="karte h-56 lg:col-span-2" />
          <div className="karte h-56" />
        </div>
      </main>
    </>
  );
}
