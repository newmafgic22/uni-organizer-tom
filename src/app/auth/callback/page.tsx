"use client";
import { createBrowserClient } from "@supabase/ssr";
import { useEffect, useState } from "react";

/** Landet hier nach Klick auf den Login-Link. Uebernimmt die Sitzung aus der URL und leitet weiter. */
export default function Callback() {
  const [text, setText] = useState("Einloggen …");
  useEffect(() => {
    const supabase = createBrowserClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!);
    (async () => {
      const hash = new URLSearchParams(window.location.hash.slice(1));
      const query = new URLSearchParams(window.location.search);
      if (hash.get("error") || query.get("error")) {
        window.location.replace("/login?status=abgelaufen");
        return;
      }
      const access_token = hash.get("access_token");
      const refresh_token = hash.get("refresh_token");
      const code = query.get("code");
      let fehler = null;
      if (access_token && refresh_token) {
        fehler = (await supabase.auth.setSession({ access_token, refresh_token })).error;
      } else if (code) {
        fehler = (await supabase.auth.exchangeCodeForSession(code)).error;
      } else {
        fehler = new Error("kein Token");
      }
      if (fehler) {
        setText("Login fehlgeschlagen.");
        window.location.replace("/login?status=abgelaufen");
        return;
      }
      window.location.replace("/");
    })();
  }, []);
  return <main className="flex min-h-dvh items-center justify-center text-zinc-500">{text}</main>;
}
