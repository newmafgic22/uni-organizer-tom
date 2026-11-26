import { Nav } from "@/components/Nav";

// Wird sofort angezeigt, während eine Seite auf dem Server lädt
export default function Laden() {
  return (
    <>
      <Nav />
    <main className="mx-auto max-w-5xl px-4 py-6 flex flex-col gap-4 animate-pulse" aria-busy="true" aria-label="Lädt">
      <div className="h-7 w-48 rounded-md bg-zinc-200 dark:bg-zinc-800" />
      <div className="grid gap-4 md:grid-cols-3">
        <div className="karte h-40" />
        <div className="karte h-40 md:col-span-2" />
      </div>
      <div className="karte h-24" />
      <div className="karte h-48" />
    </main>
    </>
  );
}
