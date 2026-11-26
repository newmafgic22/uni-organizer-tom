// Lernlauf: holt Themen aus der App, lässt Claude Code Lernmaterial schreiben und lädt es hoch.
// Läuft in GitHub Actions und stößt sich selbst wieder an, solange etwas in der Warteschlange ist. Macht so viele Themen, bis das Abo-Limit erreicht ist.
import { spawnSync } from "node:child_process";
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";

const APP = process.env.APP_URL ?? "https://uni-organizer-tom-ufyt.vercel.app";
const MAX_THEMEN = Number(process.env.MAX_THEMEN ?? 40);
const ENDE = Date.now() + Number(process.env.MAX_MINUTEN ?? 50) * 60_000;

/** fetch mit Wiederholung: kurze Netzwerkaussetzer sollen keinen Lauf abbrechen */
async function holeMitRetry(url, opt = {}, versuche = 5) {
  for (let i = 1; ; i++) {
    try {
      const r = await fetch(url, opt);
      if (r.status >= 500 && i < versuche) throw new Error(`HTTP ${r.status}`);
      return r;
    } catch (e) {
      if (i >= versuche) throw e;
      console.log(`  (Netzwerkfehler: ${e.message}, neuer Versuch ${i + 1}/${versuche})`);
      await new Promise((ok) => setTimeout(ok, 2000 * i * i));
    }
  }
}
const MODUS = process.env.MODUS ?? "alle";
const PROMPT = readFileSync(new URL("./prompt.md", import.meta.url), "utf8");

async function oidc() {
  const url = process.env.ACTIONS_ID_TOKEN_REQUEST_URL;
  const tok = process.env.ACTIONS_ID_TOKEN_REQUEST_TOKEN;
  if (!url || !tok) throw new Error("Kein OIDC (permissions: id-token: write fehlt?)");
  const r = await holeMitRetry(`${url}&audience=uni-organizer-lernlauf`, { headers: { Authorization: `bearer ${tok}` } });
  return (await r.json()).value;
}

async function app(body) {
  const r = await holeMitRetry(`${APP}/api/lernlauf`, {
    method: "POST",
    headers: { "content-type": "application/json", authorization: `Bearer ${await oidc()}` },
    body: JSON.stringify(body),
  });
  const j = await r.json().catch(() => ({}));
  if (!r.ok) throw new Error(`App ${r.status}: ${j.fehler ?? ""}`);
  return j;
}

function claude(prompt, cwd) {
  const r = spawnSync(
    "claude",
    ["-p", prompt, "--allowedTools", "Read,Write,Edit", "--max-turns", "60", "--output-format", "json"],
    { cwd, encoding: "utf8", timeout: 25 * 60_000, maxBuffer: 50 * 1024 * 1024 },
  );
  const out = `${r.stdout ?? ""}\n${r.stderr ?? ""}`;
  let info = {};
  try {
    info = JSON.parse(r.stdout);
  } catch {}
  const limit = /usage limit|rate limit|limit reached|reset at|credit balance|429/i.test(out) && !existsSync(join(cwd, "katalog.json"));
  return { ok: r.status === 0 && !info.is_error, limit, out: out.slice(-1500), kosten: info.total_cost_usd };
}

function leseJson(datei) {
  let t = readFileSync(datei, "utf8").trim();
  t = t.replace(/^```(?:json)?\s*|\s*```$/g, "");
  return JSON.parse(t);
}

if (process.argv.includes("--pruefen")) {
  const { anzahl } = await app({ aktion: "anzahl" });
  console.log(`${anzahl} Thema/Themen in der Warteschlange.`);
  if (process.env.GITHUB_OUTPUT) writeFileSync(process.env.GITHUB_OUTPUT, `anzahl=${anzahl}\n`, { flag: "a" });
  process.exit(0);
}

let erledigt = 0;
while (erledigt < MAX_THEMEN && Date.now() < ENDE) {
  let themen;
  try {
    ({ themen } = await app({ aktion: "holen", anzahl: 1, modus: MODUS }));
  } catch (e) {
    console.log("App nicht erreichbar:", e.message);
    break;
  }
  if (!themen?.length) {
    console.log("Warteschlange leer.");
    break;
  }
  const t = themen[0];
  console.log(`\n▶ ${t.kurs} – ${t.titel} (${t.text.length} Zeichen, ${t.zusatz?.length ?? 0} Zusatzdateien)`);
  const dir = join(process.cwd(), "arbeit", t.id);
  mkdirSync(dir, { recursive: true });
  writeFileSync(join(dir, "material.txt"), t.text);
  writeFileSync(join(dir, "klausur.txt"), t.klausur_info?.trim() || "Keine besonderen Infos zur Klausur bekannt.");
  const zusatz = [];
  for (const [i, z] of (t.zusatz ?? []).entries()) {
    const art = z.art === "altklausur" ? "Altklausur" : "Literatur zur Vorlesung";
    if (z.pdf_url) {
      const r = await holeMitRetry(z.pdf_url).catch(() => null);
      if (!r?.ok) continue;
      const datei = `${z.art}_${i + 1}.pdf`;
      writeFileSync(join(dir, datei), Buffer.from(await r.arrayBuffer()));
      zusatz.push(`- \`${datei}\` (${art}, eingescanntes PDF, mit dem Read-Tool seitenweise lesen): ${z.dateiname}`);
    } else {
      const datei = `${z.art}_${i + 1}.txt`;
      writeFileSync(join(dir, datei), `Datei: ${z.dateiname}\n\n${z.text}`);
      zusatz.push(`- \`${datei}\` (${art}): ${z.dateiname}`);
    }
  }
  const prompt = PROMPT.replaceAll("{{KURS}}", t.kurs)
    .replaceAll("{{TITEL}}", t.titel)
    .replaceAll("{{ZUSATZ}}", zusatz.length ? zusatz.join("\n") : "- (keine)");
  const c = claude(prompt, dir);
  if (c.limit) {
    console.log("Abo-Limit erreicht, nächster Versuch in etwa 30 Minuten.");
    if (process.env.GITHUB_OUTPUT) writeFileSync(process.env.GITHUB_OUTPUT, "limit=ja\n", { flag: "a" });
    await app({ aktion: "fehler", id: t.id, meldung: "Limit erreicht, wird später fortgesetzt", limit: true }).catch(() => {});
    break;
  }
  try {
    if (!c.ok) throw new Error("Claude-Fehler: " + c.out);
    await app({
      aktion: "ergebnis",
      id: t.id,
      zusammenfassung: readFileSync(join(dir, "zusammenfassung.md"), "utf8"),
      katalog: leseJson(join(dir, "katalog.json")),
      aufgaben: leseJson(join(dir, "aufgaben.json")),
    });
    erledigt++;
    console.log(`✓ fertig${c.kosten ? ` (entspricht ${c.kosten.toFixed(2)} $ API-Preis)` : ""}`);
  } catch (e) {
    console.log("✗", e.message);
    await app({ aktion: "fehler", id: t.id, meldung: e.message }).catch((x) => console.log("  Fehler konnte nicht gemeldet werden:", x.message));
  }
}
console.log(`\n${erledigt} Thema/Themen erledigt.`);
