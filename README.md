# Uni-Organizer Tom

Private Web-App (PWA) für die Uni Mannheim: Kalender aus Portal2 und ILIAS, Klausuren, später Lernmaterial.

## Aufbau
- `src/` – Next.js-App (läuft auf Vercel), Login per E-Mail-Link über Supabase
- `supabase/migrations/` – Datenbank-Tabellen (im Supabase SQL Editor ausführen)
- `sync-test/` – Login-Test für ILIAS/Portal2 (läuft auf Toms PC)
- `tests/` – Tests für das Einlesen der Kalender (`npm test`)

## Umgebungsvariablen (Vercel → Settings → Environment Variables)
Siehe `.env.example`. `ENCRYPTION_KEY` erzeugen mit
`python -c "import os,base64;print(base64.b64encode(os.urandom(32)).decode())"`.

## Login
- Passwort-Login: erlaubte E-Mail + `APP_PASSWORT` (Vercel). Kein Mail-Limit.
- Alternativ Login-Link per Mail (Supabase Free: nur ca. 2 Mails pro Stunde).
- Nach Änderung einer Vercel-Variable muss neu deployt werden.

## Funktionen (Etappe 1)
- Dashboard: heute, Rest der Woche, nächste Klausur mit Countdown
- Kalender: Wochenansicht aus allen verbundenen iCal-Links
- Einstellungen: iCal-Links (verschlüsselt gespeichert), Abo-Link „Uni-App“ für iCloud
- PWA: auf iPad/iPhone über Teilen → „Zum Home-Bildschirm“
