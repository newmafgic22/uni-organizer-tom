// Lernlauf: holt Themen aus der App, lässt Claude Code Lernmaterial schreiben und lädt es hoch.
// Läuft stündlich in GitHub Actions. Macht so viele Themen, bis das Abo-Limit erreicht ist.
import { spawnSync } from "node:child_process";
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";

const APP = process.env.APP_URL ?? "https://uni-organizer-tom-ufyt.vercel.app";
const MAX_THEMEN = Number(process.env.MAX_THEMEN ?? 8);
const ENDE = Date.now() + Number(process.env.MAX_MINUTEN ?? 50) * 60_000;
const MODUS = process.env.MODUS ?? "alle";
const PROMPT = readFileSync(new URL("./prompt.md", import.meta.url), "utf8");

async function oidc() {
  const url = process.env.ACTIONS_ID_TOKEN_REQUEST_URL;
  const tok = process.env.ACTIONS_ID_TOKEN_REQUEST_TOKEN;
  if (!url || !tok) throw new Error("Kein OIDC (permissions: id-token: write fehlt?)");
  const r = await fetch(`${url}&audience=uni-organizer-lernlauf`, { headers: { Authorization: `bearer ${tok}` } });
  return (await r.json()).value;
}

async function app(body) {
  const r = await fetch(`${APP}/api/lernlauf`, {
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
    ["-p", prompt, "--allowedTools", "Read,Write,Edit", "--max-turns", "30", "--output-format", "json"],
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
  const { themen } = await app({ aktion: "holen", anzahl: 1, modus: MODUS });
  if (!themen?.length) {
    console.log("Warteschlange leer.");
    break;
  }
  const t = themen[0];
  console.log(`\n▶ ${t.kurs} – ${t.titel} (${t.text.length} Zeichen)`);
  const dir = join(process.cwd(), "arbeit", t.id);
  mkdirSync(dir, { recursive: true });
  writeFileSync(join(dir, "material.txt"), t.text);
  const prompt = PROMPT.replaceAll("{{KURS}}", t.kurs).replaceAll("{{TITEL}}", t.titel);
  const c = claude(prompt, dir);
  if (c.limit) {
    console.log("Abo-Limit erreicht, nächster Versuch in einer Stunde.");
    await app({ aktion: "fehler", id: t.id, meldung: "Limit erreicht, wird später fortgesetzt", limit: true });
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
    await app({ aktion: "fehler", id: t.id, meldung: e.message });
  }
}
console.log(`\n${erledigt} Thema/Themen erledigt.`);
