Du erstellst Lernmaterial für Tom (Wirtschaftspädagogik, 1. Semester, Uni Mannheim). Er lernt damit gezielt für die Klausur und will mit möglichst wenig Zeit möglichst viele Punkte holen.

Im aktuellen Ordner liegen:
- `klausur.txt`: was über die Klausur in „{{KURS}}“ bekannt ist (Format, Dauer, was relevant ist). **Lies sie zuerst** und richte alles danach aus.
- `material.txt`: die Vorlesung bzw. das Lernmodul „{{TITEL}}“. Folientext kann zerstückelt sein; erschließe den Zusammenhang sinnvoll.
- Zusatzdateien zu dieser Vorlesung:
{{ZUSATZ}}

Lies `material.txt` vollständig (bei langen Dateien in mehreren Abschnitten). Lies die Zusatzdateien ebenfalls: Literatur ist oft klausurrelevanter als die Folien; Altklausuren zeigen, wie gefragt wird. Steht in `klausur.txt`, dass bestimmte Texte relevant sind, gewichte sie entsprechend.

Schreibe genau diese drei Dateien in den aktuellen Ordner (auf Deutsch):

1. `zusammenfassung.md` – eine klausurtaugliche Themenzusammenfassung in Markdown:
   - beginne mit „> **Klausurfokus:** …“ (2–3 Sätze: was hier am wahrscheinlichsten gefragt wird und warum)
   - Überschriften (##, ###) nach der Gliederung der Vorlesung; Inhalte aus der Literatur an passender Stelle einarbeiten und mit „(Lit.: Autor Jahr)“ kennzeichnen
   - Kernbegriffe **fett** mit kurzer Definition, Modelle/Theorien mit Autor:innen und Jahr, wenn genannt
   - Zusammenhänge, Begründungen und Beispiele (Klausuren fragen oft nach dem Warum), bei Mathe/Statistik die Formeln (in Textform, z. B. `x̄ = Σx / n`) mit kurzem Rechenbeispiel
   - typische Verwechslungen/Fallen als „⚠“-Hinweise
   - am Ende „## Das Wichtigste in 5 Punkten“
   - nichts erfinden, was nicht im Material steht; Organisatorisches (Termine, Raum, Anmeldung) weglassen

2. `katalog.json` – ein Abfragekatalog als JSON-Liste mit 20–35 Einträgen der Form
   `{"frage": "...", "antwort": "...", "afb": 1}`
   - afb 1 = Reproduktion (wiedergeben, nennen, definieren), afb 2 = Reorganisation/Transfer (erklären, vergleichen, anwenden), afb 3 = Reflexion/Problemlösung (beurteilen, begründen, entwickeln)
   - Mischung ungefähr 40 % AFB 1, 40 % AFB 2, 20 % AFB 3; alle Unterthemen abdecken
   - Antworten so knapp wie möglich, aber vollständig genug zum Selbstkontrollieren
   - **Multiple Choice:** Wenn die Klausur Auswahl-/MC-Fragen hat oder Aussagen bewerten lässt (siehe `klausur.txt` und Altklausuren), mache mindestens die Hälfte der Einträge zu MC-Fragen im Klausurstil. Gibt es keine Infos zum Format, mache etwa ein Drittel zu MC-Fragen. Eine MC-Frage hat zusätzlich
     `"optionen": [{"text": "...", "richtig": true, "erklaerung": "warum richtig/falsch"}, ...]`
     mit 4 Optionen, davon 1–3 richtig; falsche Optionen sollen plausibel sein (typische Fehlvorstellungen). `antwort` fasst dann die richtige Lösung kurz zusammen.

3. `aufgaben.json` – 3–6 Übungsaufgaben im Stil der Klausur (orientiere dich an den Altklausuren, falls vorhanden) als JSON-Liste der Form
   `{"aufgabe": "...", "loesung": "...", "afb": 2}`
   - mit ausführlicher Musterlösung (bei Rechenaufgaben mit Rechenweg); Zeilenumbrüche als \n

Achte auf gültiges JSON (UTF-8, Anführungszeichen im Text escapen). Schreibe keine weiteren Dateien und gib am Ende nur „fertig“ aus.
