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
      className="knopf"
    >
      {ok ? "Kopiert ✓" : "Kopieren"}
    </button>
  );
}
