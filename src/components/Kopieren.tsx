"use client";
import { useState } from "react";

export function Kopieren({ text }: { text: string }) {
  const [ok, setOk] = useState(false);
  return (
    <button
      type="button"
      onClick={async () => {
        await navigator.clipboard.writeText(text);
        setOk(true);
        setTimeout(() => setOk(false), 1500);
      }}
      className="rounded-lg bg-sky-600 px-3 py-2 text-sm font-medium text-white hover:bg-sky-700 whitespace-nowrap"
    >
      {ok ? "Kopiert ✓" : "Kopieren"}
    </button>
  );
}
