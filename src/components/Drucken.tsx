"use client";
export function Drucken() {
  return (
    <button onClick={() => window.print()} className="rounded-lg bg-sky-600 px-4 py-2 font-medium text-white print:hidden">
      Als PDF speichern / drucken
    </button>
  );
}
