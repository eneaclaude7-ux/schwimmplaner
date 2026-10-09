# Design-Brief Schwimmplaner

Stand: 2026-10-09. Abgeleitet aus README, docs/ und den Entscheiden in Phase 1.

## 1. Product purpose

Plant die Wettkampfsaison eines Nachwuchsschwimmers (Kalender, Meldeschluss, Zielzeiten) und zeigt nach jedem Rennen, was er daraus lernt: Abweichung vom Ziel, Bestzeit, Saisonbestzeit und Zwischenzeiten.

## 2. Primary user

Ein Nachwuchsschwimmer im Regionalkader (etwa 12 bis 18 Jahre), der am Wettkampftag in der Halle auf dem Handy Zielzeiten nachschaut und Endzeiten erfasst und zu Hause am Laptop die Saison auswertet; Eltern und Trainer schauen gelegentlich mit.

## 3. Principles (in Konfliktreihenfolge)

1. **Die Daten bleiben auf dem Gerät.** Kein Server, kein Konto, kein Tracking, nichts von fremden Servern. Eine Funktion, die Daten hinausschicken müsste, gibt es in dieser Phase nicht. Beispiel: Lenex wird im Browser gelesen, Name und Verein werden verworfen.
2. **Kurz- und Langbahn sind zwei Welten.** Keine Zahl, kein Diagramm und keine Bestzeit mischt 25-m- und 50-m-Bahn. Jede Auswertung ist nach Bahnlänge getrennt, auch wenn das eine Ansicht mehr kostet.
3. **Gebaut für die Halle.** Handy, nasse Finger, schlechter Empfang. Offline zuerst, Trefferflächen mindestens 24 px, Zeiten nur mit Ziffern eintippbar (10920 = 1:09.20), keine Funktion, die nur mit Maus geht.
4. **Was als Nächstes kommt vor dem, was war.** Die Startseite ist der Kalender mit dem nächsten Meldeschluss, nicht eine Resultatliste. Resultate sind Material zum Lernen, kein Archiv.
5. **Warnen statt verbieten.** Unplausible Zwischenzeiten oder Laps, die nicht aufgehen, lösen eine Warnung aus, nie eine Sperre. Der Schwimmer kennt sein Rennen besser als die Plausibilitätsprüfung. Unlesbare Eingaben werden dagegen abgelehnt.

## 4. Success metric

Nach dem Rennen ist die Endzeit auf dem Handy in unter 30 Sekunden erfasst, und die App zeigt sofort die Abweichung vom Ziel und ob es eine Bestzeit war. Vor einem Wettkampf sieht man ohne Suchen den nächsten Meldeschluss.

## 5. Out of scope

- Keine Resultatdatenbank, keine Ranglisten, keine Zeiten anderer Schwimmer.
- Kein Scraping und keine Übernahme von Plattformdaten ohne Erlaubnis; Daten kommen nur aus eigener Eingabe und eigenen Lenex-Dateien.
- Kein Konto, kein Sync, kein Server (Phase 1).
- Keine sozialen Funktionen: kein Teilen, keine Kommentare, kein Vergleich mit anderen.
- Kein Trainingstagebuch; die App deckt Wettkämpfe ab, nicht das Training.

## 6. Learned constraints

- **2026-10-08** — Der Kalender ist ein echtes Monatsraster im Stil von Notion (Balken über mehrere Tage, Farbe nach Bahnlänge), die Liste nur die zweite Ansicht. _Why:_ Eine reine Liste las sich nicht als Kalender; Planen heisst Wochen und Abstände sehen.
