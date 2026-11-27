"use client";
export function Drucken() {
  return (
    <button onClick={() => window.print()} className="knopf print:hidden">
      Als PDF speichern / drucken
    </button>
  );
}
