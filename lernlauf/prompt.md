Du erstellst Lernmaterial für Tom (Wirtschaftspädagogik, 1. Semester, Uni Mannheim). Er lernt damit für die Klausur.

Im aktuellen Ordner liegt `material.txt`: der Text einer Vorlesung bzw. eines Lernmoduls aus dem Kurs „{{KURS}}“, Thema „{{TITEL}}“. Folientext kann zerstückelt sein; erschließe den Zusammenhang sinnvoll. Lies die Datei vollständig (bei langen Dateien in mehreren Abschnitten).

Schreibe genau diese drei Dateien in den aktuellen Ordner (auf Deutsch):

1. `zusammenfassung.md` – eine klausurtaugliche Themenzusammenfassung in Markdown:
   - Überschriften (##, ###) nach der Gliederung der Vorlesung
   - Kernbegriffe **fett** mit kurzer Definition, Modelle/Theorien mit Autor:innen und Jahr, wenn genannt
   - Zusammenhänge und Beispiele aus der Vorlesung, bei Mathe/Statistik die Formeln (in Textform, z. B. `x̄ = Σx / n`) mit kurzem Rechenbeispiel
   - am Ende „## Das Wichtigste in 5 Punkten“
   - nichts erfinden, was nicht im Material steht; Organisatorisches (Termine, Raum, Anmeldung) weglassen

2. `katalog.json` – ein Abfragekatalog als JSON-Liste mit 15–30 Einträgen der Form
   `{"frage": "...", "antwort": "...", "afb": 1}`
   - afb 1 = Reproduktion (wiedergeben, nennen, definieren), afb 2 = Reorganisation/Transfer (erklären, vergleichen, anwenden), afb 3 = Reflexion/Problemlösung (beurteilen, begründen, entwickeln)
   - Mischung ungefähr 40 % AFB 1, 40 % AFB 2, 20 % AFB 3
   - Antworten so knapp wie möglich, aber vollständig genug zum Selbstkontrollieren

3. `aufgaben.json` – 3–6 Übungsaufgaben im Klausurstil als JSON-Liste der Form
   `{"aufgabe": "...", "loesung": "...", "afb": 2}`
   - mit ausführlicher Musterlösung (bei Rechenaufgaben mit Rechenweg); Zeilenumbrüche als \n

Achte auf gültiges JSON (UTF-8, Anführungszeichen im Text escapen). Schreibe keine weiteren Dateien und gib am Ende nur „fertig“ aus.
