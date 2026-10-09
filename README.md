# Schwimmplaner (Arbeitstitel)

Eine Web-App, mit der Nachwuchsschwimmer, Eltern und Trainer Wettkämpfe planen und Rennen auswerten.

**Positionierung:** Resultat-Plattformen zeigen, was war. Diese App zeigt, was als Nächstes kommt und was man aus einem Rennen lernt. Sie ist keine Resultatdatenbank.

**Stand:** Phase 1, alle 7 Etappen fertig. Wettkämpfe, Läufe und Saisons lassen sich erfassen, sichern und löschen. Die Seite "Auswertung" zeigt Bestzeit, Saisonbestzeit und Verbesserungen, getrennt nach Kurz- und Langbahn. Pro Strecke zeigt ein Liniendiagramm die Entwicklung. Zu jedem Lauf lassen sich Zwischenzeiten erfassen, mit Lap-Zeiten, Anteilen, Positive/Negative Split und Diagramm; zwei Rennen derselben Strecke lassen sich Abschnitt für Abschnitt vergleichen. Die App ist installierbar und läuft offline. Neu: Resultate aus einer Lenex-Datei einlesen (Seite "Daten"), siehe [Lenex-Import](#lenex-import).

**App:** <https://eneaclaude7-ux.github.io/schwimmplaner/>

**Lizenz:** Keine. Der Code ist zum Lesen öffentlich, alle Rechte bleiben vorbehalten.

## MVP

- [x] 1. Wettkampfkalender: Name, Datum, Ort, Meldeschluss, Bahnlänge. Monatsansicht wie in Notion (Balken über mehrere Tage, Farbe nach Bahnlänge, Meldeschluss gestrichelt) und Liste
- [x] 2. Läufe pro Wettkampf: Disziplin, Strecke, Zielzeit, Resultat
- [x] 3. Automatisch berechnet: Abweichung vom Ziel, persönliche Bestzeit, Saisonbestzeit
- [x] 4. Entwicklung pro Strecke als Liniendiagramm, mit markierter Bestzeit
- [x] 5. Verbesserung zur letzten Zeit, zur Bestzeit und seit Saisonstart (Sekunden und Prozent)
- [x] 6. Filter nach Bahnlänge; Kurz- und Langbahn werden nie gemischt
- [x] 7. Splits: Erfassung, Lap-Zeiten, Positive/Negative Split, Anteile, Diagramm, Vergleich zweier Rennen, Plausibilitätsprüfung

Reihenfolge der Etappen:

1. ✓ Wettkämpfe und Läufe erfassen, Saisons, Backup, alles löschen (MVP 1, 2)
2. ✓ GitHub Pages, installierbar, offline, Hinweis bei neuer Version
3. ✓ Abweichung, Bestzeit, Saisonbestzeit, Verbesserung, Filter nach Bahnlänge, CSV-Export (MVP 3, 5, 6)
4. ✓ Splits erfassen und auswerten (MVP 7, Teil)
5. ✓ Entwicklungsdiagramm pro Strecke mit Tabelle als Alternative (MVP 4)
6. ✓ Split-Diagramm und Vergleich zweier Rennen (MVP 7, Rest)
7. ✓ Datenschutzseite (Entwurf), Seite "Lizenzen", Check auf Barrierefreiheit

**Version 2** (erst nach einer Saison eigener Nutzung): Abstand zu Qualifikationslimiten, Saisonplanung mit Taper, Kosten- und Reiseplanung, Kurzreflexion nach dem Rennen.

## Rahmenbedingungen

- Web-App mit PWA (installierbar, eine Codebasis, kein App Store). Eine native App gibt es erst, wenn Nutzer danach fragen.
- Offline-fähig, weil Hallen oft schlechten Empfang haben.
- Nutzer sind oft minderjährig, Resultate sind Personendaten.
- Datenquelle: kein Scraping. Die Daten kommen aus manueller Eingabe und aus dem Lenex-Datei-Import. Eine offizielle Anfrage läuft. Siehe [docs/01-datenquellen-bericht.md](docs/01-datenquellen-bericht.md).

## Tech-Stack

TypeScript, SvelteKit 3 (statisch), Dexie.js (IndexedDB), eigener Service Worker, fflate (ZIP entpacken für Lenex), Vitest. Phase 1 ist local-first: alle Daten bleiben im Browser des Geräts.

Details und Begründung: [docs/03-tech-stack.md](docs/03-tech-stack.md). Das Datenmodell steht in [docs/04-datenmodell.md](docs/04-datenmodell.md).

## Entwickeln

```bash
npm install          # Abhängigkeiten installieren
npm run dev          # Entwicklungsserver auf http://localhost:5173
npm test             # Tests einmal ausführen
npm run check        # Typprüfung
npm run build        # Produktions-Build nach build/
npm run preview      # Build lokal ansehen (mit Service Worker)
node scripts/generate-icons.mjs   # App-Icons neu erzeugen
```

Der Service Worker läuft nur im Build (`npm run build` und dann `npm run preview`), nicht mit `npm run dev`.

## Projektstruktur

```
src/lib/model.ts            Typen des Datenmodells, Labels, erlaubte Distanzen
src/lib/db.ts               lokale Datenbank (Dexie)
src/lib/time.ts             Zeiten einlesen und formatieren (Hundertstel), mit Tests
src/lib/lenex.ts            Lenex-Datei lesen, auf das Datenmodell abbilden, Duplikate erkennen
src/lib/fixtures/           selbst geschriebene Beispiel-LEF für die Tests (erfundene Personen)
src/lib/storage.ts          dauerhaften Speicher beim Browser anfragen
src/service-worker/         Offline-Cache der App-Dateien
src/routes/                 Seiten
static/                     Manifest, Icons, robots.txt
docs/                       Berichte und Entscheide
```

## Compliance-Status (Privacy by Design)

Stand: 8.10.2026. Keine Rechtsberatung. Alles mit **von Anwalt klären** muss vor dem Livegang geprüft werden.

| #   | Punkt                            | Status                   | Umsetzung                                                                                                                                                                                                                                                                                                                                                                                   |
| --- | -------------------------------- | ------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 1   | Datensparsamkeit                 | umgesetzt (Phase 1)      | Kein Server, kein Tracking. Das Datenmodell enthält keinen Jahrgang, kein Geschlecht und keinen Verein. Der Lenex-Import liest die Datei nur im Browser und speichert nur die Läufe des gewählten Athleten, ohne Name, Jahrgang und Verein; alle anderen Teilnehmenden werden verworfen. Liste aller Drittanbieter mit dem, was sie senden: [docs/03-tech-stack.md](docs/03-tech-stack.md). |
| 2   | Löschen und Export               | umgesetzt (Phase 1)      | Seite "Daten": Knopf "Alle Daten löschen", Backup als JSON herunterladen und wieder einlesen. Die Datei wird beim Einlesen Feld für Feld geprüft. In Phase 2 kommt "Konto löschen" dazu. Dazu kommen alle Läufe als CSV für Excel, mit Schutz gegen Formeln in Wettkampfnamen.                                                                                                              |
| 3   | Altersabfrage, Eltern            | Phase 2                  | Phase 1 hat keine Konten, darum gibt es nichts abzufragen. Mehr dazu unten.                                                                                                                                                                                                                                                                                                                 |
| 4   | Datenschutz, Nutzungsbedingungen | Entwurf                  | Seite "Datenschutz" in der App, klar als Entwurf markiert. Es fehlen Name und Kontakt des Verantwortlichen (Art. 19 nDSG) und die Nutzungsbedingungen. **Von Anwalt klären.**                                                                                                                                                                                                               |
| 5   | Cookies und Tracking             | umgesetzt (Phase 1)      | Keine Cookies, kein Analytics, keine Embeds. Die Schrift Barlow Semi Condensed wird mit der App ausgeliefert, nichts wird extern geladen. Lokal gespeichert werden nur die eigenen Daten (IndexedDB) und die App-Dateien (Service-Worker-Cache), beides gehört zur Funktion. Gehört trotzdem in die Datenschutzerklärung (Art. 45c FMG). **Von Anwalt klären**, ob dieser Hinweis genügt.   |
| 6   | Barrierefreiheit (WCAG AA)       | geprüft, ein Punkt offen | `lang="de-CH"`, Skip-Link, sichtbarer Fokus, Labels für alle Felder, Tabelle zu jedem Diagramm, Diagramme mit Pfeiltasten bedienbar. Am 8.10.2026 mit axe-core 4.10 (WCAG 2.2 AA und Best Practices) auf allen Seiten ohne Befund, auch in Handybreite; Tab-Reihenfolge von Hand geprüft. Offen: Test mit einem echten Screenreader (VoiceOver auf dem iPhone, NVDA unter Windows).         |
| 7   | Impressum                        | offen                    | Mehr dazu unten.                                                                                                                                                                                                                                                                                                                                                                            |
| 8   | Keine Dark Patterns              | Grundsatz                | Gleichwertige Knöpfe für Ja und Nein, keine versteckten Kosten. Die Preise werden in Phase 2 klar ausgewiesen.                                                                                                                                                                                                                                                                              |
| 9   | KI-Funktionen                    | keine                    | Vor jeder KI-Funktion kommt eine Rückfrage. Dann braucht es eine klare Kennzeichnung (EU AI Act, Art. 50).                                                                                                                                                                                                                                                                                  |
| 10  | Lizenzen                         | umgesetzt                | Eigenes Logo und eigene Icons ([scripts/generate-icons.mjs](scripts/generate-icons.mjs)), Schrift Barlow Semi Condensed (OFL-1.1, über @fontsource mitgeliefert). Seite "Lizenzen" mit den vollständigen Lizenztexten aller Bibliotheken im ausgelieferten Code, inklusive NOTICE von Dexie (Apache-2.0). Erzeugt mit `npm run licenses`; nach jeder neuen Abhängigkeit neu laufen lassen.  |

### Zu Punkt 3: Alter und Eltern-Zustimmung

- **DSGVO Art. 8:** Beruht die Bearbeitung auf einer Einwilligung, braucht es bei Kindern unter 16 die Zustimmung der Eltern. Die Länder dürfen die Grenze bis auf 13 senken, zum Beispiel Deutschland 16, Österreich 14, Frankreich 15. Das heisst: Die Altersgrenze hängt vom Land des Nutzers ab.
- **nDSG:** Es gibt keine feste Altersgrenze. Massgebend ist die Urteilsfähigkeit (Art. 16 ZGB), die im Einzelfall beurteilt wird.
- **Kostenpflichtiges Abo:** Minderjährige brauchen die Zustimmung der Eltern, um Verpflichtungen einzugehen (Art. 19 ZGB). Bezahlen muss also in der Regel ein Elternteil.
- **Von Anwalt klären:**
  - Welche Rechtsgrundlage gilt (Vertrag oder Einwilligung)?
  - Welche Altersgrenze gilt pro Land?
  - Genügt eine Bestätigung per E-Mail an die Eltern als Nachweis?

### Zu Punkt 7: Impressum

- **Schweiz:** Wer online Waren oder Dienstleistungen anbietet, muss Identität, Postadresse und E-Mail klar angeben (Art. 3 Abs. 1 lit. s UWG). Spätestens mit dem kostenpflichtigen Angebot ist das Pflicht.
- **Datenschutz:** Unabhängig davon verlangt Art. 19 nDSG Identität und Kontakt des Verantwortlichen in der Datenschutzerklärung.
- **Von Anwalt klären:**
  - Pflichten nach EU-Recht, wenn sich die App an EU-Nutzer richtet (z. B. das deutsche Digitale-Dienste-Gesetz).
  - Wer rechtlich als Anbieter auftritt (Privatperson oder Firma).

## Lenex-Import

Seite "Daten", Abschnitt "Resultate einlesen (Lenex)". Code: [src/lib/lenex.ts](src/lib/lenex.ts).

1. Datei wählen: `.lef` (XML) oder `.lxf` (dasselbe als ZIP, entpackt mit fflate). Die Datei wird nur im Browser gelesen, nichts wird hochgeladen.
2. Athlet wählen: Die Datei enthält alle Teilnehmenden. Name, Jahrgang und Verein stehen nur in der Auswahlliste und werden nicht gespeichert. Nach dem Speichern oder Abbrechen verwirft die App den ganzen Dateiinhalt.
3. Vorschau prüfen und bestätigen.

**Abbildung auf das Datenmodell:**

| Lenex                                                 | Schwimmplaner                                                       |
| ----------------------------------------------------- | ------------------------------------------------------------------- |
| `MEET` name, city                                     | Wettkampf: Name, Ort                                                |
| erstes und letztes `SESSION` date                     | Startdatum, Enddatum                                                |
| `MEET` deadline                                       | Meldeschluss                                                        |
| `MEET` course (sonst der des ersten Abschnitts)       | Bahnlänge, nur `SCM` und `LCM`                                      |
| `RESULT` über eventid zu `SWIMSTYLE` stroke, distance | Lauf: Lage, Strecke; Tag = Datum des Abschnitts                     |
| `RESULT` swimtime                                     | Endzeit (Hundertstel), nur bei einem geschwommenen Lauf             |
| `RESULT` status leer oder `EXH`                       | geschwommen                                                         |
| `DSQ` / `DNS`, `SICK`, `WDR` / `DNF`                  | disqualifiziert / nicht angetreten / aufgegeben, ohne Endzeit       |
| `SPLIT` distance, swimtime                            | Zwischenzeiten, kumuliert wie in Lenex; ein Split im Ziel fällt weg |

**Nicht übernommen** (die Vorschau nennt jeweils den Grund): Staffeln, Technik-Läufe, Strecken, die es im Schwimmplaner nicht gibt (z. B. 25 m), Läufe in einem Abschnitt mit anderer Bahnlänge, Yards und andere Becken, Meldungen (`ENTRY`) ohne Resultat.

**Duplikate:** Gibt es schon einen Wettkampf mit gleichem Namen (ohne Gross/klein und Leerzeichen) und gleichem Startdatum, wird kein zweiter angelegt; die Läufe kommen dorthin. Ein Lauf mit gleicher Lage, Strecke, gleichem Status und gleicher Endzeit gilt als schon erfasst, darum lässt sich eine Datei auch zweimal einlesen. Ein geplanter Lauf derselben Strecke bekommt Resultat und Zwischenzeiten, die Zielzeit bleibt. Dauert der Wettkampf in der Datei länger als erfasst, wird das Enddatum verschoben. Gespeichert wird in einer Transaktion: alles oder nichts.

**Getestet** ist der Import mit einer selbst geschriebenen Beispieldatei ([src/lib/fixtures/beispiel.lef](src/lib/fixtures/beispiel.lef)). Echte Dateien von Dritten kommen nicht ins öffentliche Repo. Offen: mit 3 bis 5 echten Lenex-Dateien eigener Wettkämpfe lokal prüfen (siehe [docs/01-datenquellen-bericht.md](docs/01-datenquellen-bericht.md), Abschnitt 5).

## Bekannte Grenzen von Phase 1

- **Kein Sync:** Die Daten sind nur auf einem Gerät. Der Sync zwischen Geräten kommt in Phase 2.
- **Datenverlust möglich:** Ohne Installation auf dem Homescreen darf Safari die Daten nach 7 Tagen ohne Besuch löschen. Darum: installieren und regelmässig exportieren.
- **Nicht in Suchmaschinen:** `static/robots.txt` sperrt Suchmaschinen, solange die App nur für den Eigengebrauch ist.
