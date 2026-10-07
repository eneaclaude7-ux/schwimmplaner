# Datenquellen-Bericht

Stand: 7.10.2026. Keine Rechtsberatung. Punkte mit "von Anwalt klären" sind offen.

## Kurzfazit

- **Scraping von Swimrankings ist nicht erlaubt.** Die robots.txt sperrt es, ein Login ist Pflicht und die Abrufe pro Konto werden überwacht. Dazu kommt ein Risiko nach UWG. Wir scrapen nicht.
- **Es gibt keine öffentliche API**, weder bei Swimrankings noch bei SplashMe oder Swiss Aquatics.
- **Bester automatischer Weg ohne Erlaubnis: Lenex-Datei-Import durch den Nutzer.** Lenex ist ein offenes Format und enthält Zwischenzeiten, wenn der Veranstalter sie misst.
- **Offizielle Anfrage parallel:** an Splash Software (Betreiber von Swimrankings) und an Swiss Aquatics. Die erste Mail an Swimrankings ist am 7.10.2026 rausgegangen.

## Korrekturen an den Annahmen im Projektplan

1. **SplashMe hat eine Website:** [splashme.app](https://splashme.app) mit Wettkampflisten pro Land, FAQ und AGB. Einen Export gibt es dort aber auch nicht.
2. **SplashMe ist keine eigene Datenquelle.** Die App zeigt Daten von swimrankings.net, das Login ist das Swimrankings-Konto, der Kontakt läuft über `splashme@swimrankings.net`. Betreiberin der App ist die Malupp GmbH in Utzenstorf.
3. **Swiss Swimming heisst heute Swiss Aquatics** ([swiss-aquatics.ch](https://www.swiss-aquatics.ch)). Der Verband hat keine eigene Resultatdatenbank und verlinkt für Kalender, Bestenliste und Resultate auf Swimrankings.
4. **Swimrankings, Splash Meet Manager, Splash Team Manager und das Lenex-Format stammen alle von derselben Person:** Christian Kaufmann, Splash Software GmbH. Für Datenfragen gibt es also im Kern einen einzigen Ansprechpartner.
5. **Es gibt schon Konkurrenz für "Analyse":** [swimstats.net](https://www.swimstats.net) ("swimming result analysis", von Roman Arnet und Kim Pochon) wird von Swiss Aquatics offiziell verlinkt. Dazu verkauft SplashMe Pro Resultatverlauf und Rankings. Die Positionierung "Planung + Analyse" muss sich davon klar abheben.

## 1. Swimrankings: robots.txt und AGB

### robots.txt

Abgerufen am 7.10.2026. Vollständige Kopie: [belege/swimrankings-robots-2026-10-07.txt](belege/swimrankings-robots-2026-10-07.txt). Die relevanten Stellen:

```
User-agent: *
Content-Signal: search=yes,ai-train=no,use=reference
Allow: /

User-agent: Claude-User
Disallow: /
User-agent: ChatGPT-User
Disallow: /
(... rund 60 weitere Bots und KI-Agenten, alle Disallow: /)

User-agent: Googlebot
Disallow: /*page=athleteDetail*
Disallow: /*page=entryDetail*
Disallow: /*page=rankingDetail*
Disallow: /*page=meetDetail*
Disallow: /*page=resultDetail*
Allow: /

User-agent: *
Disallow: /
```

Deutung:

- Der letzte Block (`User-agent: *` mit `Disallow: /`) sperrt alle Bots, die nicht namentlich genannt sind. Der erste `*`-Block mit `Allow: /` ist ein Cloudflare-Standardblock für "Content Signals". Formal widersprechen sich die beiden Blöcke, die Absicht des Betreibers ist aber eindeutig.
- Sogar Google darf die Detailseiten für Athleten, Wettkämpfe, Resultate und Ranglisten nicht crawlen. Genau diese Seiten bräuchte ein Scraper.
- KI-Agenten sind ausdrücklich gesperrt, auch `Claude-User`, also das Werkzeug, mit dem ich recherchiere.

### Zugangssperre seit März 2026

Laut einer Club-Mitteilung vom 30.3.2026 ([dcsc.poolq.net](https://dcsc.poolq.net/blog/swim-rankings-result-access)) hat Swimrankings wegen Bot-Angriffen (an manchen Tagen über 10'000 Zugriffe) Folgendes eingeführt:

- Login-Pflicht für die meisten Resultate (SplashMe-Konten funktionieren auch).
- Überwachung, wie viele Wettkämpfe und Athleten ein Konto innerhalb von 24 Stunden aufruft. Wer eine Schwelle überschreitet, muss sich per Mail melden.

### AGB

Die AGB liegen unter <https://www.swimrankings.net/index.php?page=terms>. **Ich habe sie nicht gelesen:** Die robots.txt sperrt mein Werkzeug ausdrücklich. Mit einer gefälschten Browser-Kennung hätte ich genau das getan, was die Seite verbietet.

**Offen:** Die AGB von Hand im Browser lesen (Abschnitte zu Nutzung, automatisiertem Zugriff und Weiterverwendung).

Indirekter Beleg: Die AGB von SplashMe verpflichten die Nutzer, die AGB von Swimrankings einzuhalten.

### Rechtliche Einordnung (Schweiz)

- **Art. 5 lit. c UWG:** Unlauter handelt, wer "das marktreife Arbeitsergebnis eines andern ohne angemessenen eigenen Aufwand durch technische Reproduktionsverfahren als solches übernimmt und verwertet". Kommerzielles Scraping einer Resultatdatenbank fällt ziemlich genau darunter.
- **EU:** Das Datenbankherstellerrecht (Richtlinie 96/9/EG) schützt Datenbanken, in die wesentlich investiert wurde. Es wird relevant, sobald ein EU-Bezug besteht. Von Anwalt klären, falls wir je in diese Richtung gehen.
- Dass es auf GitHub Scraping-Bibliotheken für Swimrankings gibt, macht Scraping nicht erlaubt.

**Ergebnis:** Scraping ist verboten (robots.txt), technisch gesperrt (Login und Limits) und rechtlich riskant (UWG). Es wird kein Scraper gebaut.

## 2. API, Export und Partnerschaften

| Quelle                        | Öffentliche API                                                                               | Export                                                                                       | Bemerkung                                                                          |
| ----------------------------- | --------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------- |
| Swimrankings                  | keine gefunden                                                                                | nur über Splash Meet Manager / Team Manager (kostenpflichtige Desktop-Software)              | live.swimrankings.net sperrt `.json`, `.php` und `.dat` in der robots.txt          |
| Splash Meet Manager           | "Live-Info-Server-API", nur für Live-Anzeigen während eines Wettkampfs, nicht für Archivdaten | Resultate als Lenex, SDIF oder DSV                                                           | läuft beim Veranstalter                                                            |
| Splash Team Manager (Vereine) | –                                                                                             | Import von Resultaten aus Swimrankings oder Lenex, Export als Lenex                          | Trainer und Vereine haben die Resultate ihrer Schwimmer also schon                 |
| Swiss Aquatics                | keine                                                                                         | Futura-Zwischenstand als Excel; Lenex-Datei bei Schweizer Meisterschaften (Meldebestätigung) | verweist für alles auf Swimrankings                                                |
| Ausschreibungen               | –                                                                                             | meist PDF, teils eine Lenex-Ausschreibungsdatei für den Team Manager                         | eine Lenex-Ausschreibung enthält Name, Ort, Bahnlänge, Meldeschluss und Abschnitte |

**Lenex** ist ein offenes XML-Format für Schwimmdaten (seit 1999, aktuell Version 3.0). Die Spezifikation ist frei verfügbar und für alle Entwickler kostenlos nutzbar ([wiki.swimrankings.net](https://wiki.swimrankings.net/index.php/swimrankings:Lenex)). Dateien enden auf `.lef` (XML) oder `.lxf` (gezipptes XML).

**Partnerschaften:** Ein öffentliches Partnerprogramm habe ich nicht gefunden. Es gibt aber einen Präzedenzfall: swimstats.net nennt Swiss Aquatics und zwei Personen als Daten-Experten. Zusammenarbeit mit Drittanbietern gibt es also offenbar. Wie sie geregelt ist, ist unbekannt. Das fragen wir in der Mail.

## 3. SplashMe

- Keinen Export (CSV/PDF) und keine API gefunden. Die einzige Teilen-Funktion macht aus einem Resultat ein Bild für Social Media.
- Die Daten kommen von Swimrankings, SplashMe ist also kein eigener Weg zu den Daten.

## 4. Splits (Zwischenzeiten)

- **Lenex unterstützt Splits:** Das Element `SPLIT` hat die Attribute `distance` und `swimtime`. Laut Spezifikation werden Splits "always saved continuously", also kumuliert gespeichert (zum Beispiel 50 m: 0:31.20, 100 m: 1:05.80) und nicht als einzelne Lap-Zeiten. Die App rechnet die Lap-Zeiten selbst aus. Die Endzeit steht im Resultat und nicht zwingend als letzter Split.
- **Splits sind nur vorhanden, wenn der Veranstalter elektronisch misst** und sie exportiert. Bei kleinen Wettkämpfen mit Handzeitnahme fehlen sie oft.
- Swimrankings und SplashMe zeigen laut App-Beschreibung Splits für viele Wettkämpfe. Selbst geprüft habe ich das nicht, weil der Zugriff gesperrt ist.
- **Folge:** Die manuelle Erfassung von Splits bleibt Pflicht. Der Lenex-Import ist der automatische Weg, wo Splits vorhanden sind.

## 5. Bewertung der Optionen

| Option                                 | Rechtliches Risiko                             | Stabilität                                              | Aufwand                       | Urteil                                 |
| -------------------------------------- | ---------------------------------------------- | ------------------------------------------------------- | ----------------------------- | -------------------------------------- |
| A: Swimrankings scrapen                | hoch                                           | schlecht (Login, Limits, Layoutänderungen, Kontosperre) | mittel bis hoch               | **nein**                               |
| B: Lenex-Datei-Import durch den Nutzer | tief, wenn nur eigene Daten gespeichert werden | sehr gut (etablierter Standard)                         | mittel (ZIP und XML einlesen) | **ja, nach dem MVP-Kern**              |
| C: Manuelle Eingabe                    | keines                                         | sehr gut                                                | tief                          | **ja, zuerst**                         |
| D: CSV-Import (eigene Vorlage)         | keines                                         | sehr gut                                                | tief                          | optional                               |
| E: Offizielle API oder Partnerschaft   | keines                                         | sehr gut                                                | unklar, Antwort ungewiss      | **anfragen, aber nicht darauf warten** |
| F: PDF-Resultatlisten auslesen         | tief                                           | schlecht (jedes Layout ist anders)                      | hoch                          | nein                                   |

**Offene Frage bei B:** Wie kommt ein normaler Nutzer an die Lenex-Resultatdatei? Ungeprüft ist: Websites von Veranstaltern und Livetiming-Seiten bieten teils einen Lenex-Download an, und Vereine haben die Dateien im Team Manager.

**Test:** 3 bis 5 Lenex-Dateien von eigenen Wettkämpfen sammeln (beim Trainer fragen oder auf der Website des Veranstalters suchen). Falls normale Nutzer nicht an solche Dateien kommen, ist B für Eltern und Schwimmer wertlos und nur für Trainer nützlich.

## 6. Vorgeschlagenes Vorgehen

1. MVP mit manueller Eingabe (C) bauen, inklusive Splits. Das braucht es sowieso als Rückfallebene.
2. Mails an Swimrankings und Swiss Aquatics senden.
3. Lenex-Dateien von eigenen Wettkämpfen sammeln und prüfen, ob Splits drin sind.
4. Lenex-Import (B) als erste Automatisierung bauen. Die Datei wird im Browser ausgelesen, nur die eigenen Resultate werden behalten.
5. Kein Scraping, auch nicht "nur für mich".

## 7. Personenbezogene Daten Dritter

- Resultate mit Name, Jahrgang und Verein sind Personendaten (Art. 5 lit. a nDSG, Art. 4 Nr. 1 DSGVO). Viele der betroffenen Personen sind Kinder, und die DSGVO verlangt für sie besonderen Schutz (Erwägungsgrund 38).
- **"Öffentlich im Internet" heisst nicht "frei verwendbar".** Art. 30 Abs. 3 nDSG hilft nur, wenn die betroffene Person ihre Daten selbst öffentlich gemacht hat. Hier hat der Veranstalter sie publiziert. Die DSGVO verlangt eine Interessenabwägung und eine Information der Betroffenen (Art. 14).
- **Eine Lenex-Resultatdatei enthält alle Teilnehmenden**, oft Hunderte Minderjährige. Wer die ganze Datei auf den Server lädt, bearbeitet Daten von Personen ohne Konto und ohne deren Wissen. Lösung: Die Datei wird im Browser ausgelesen, der Nutzer wählt seinen Athleten, nur dessen Resultate werden gespeichert. Der Rest wird verworfen und nie hochgeladen.
- **Im MVP gibt es nur eigene Daten.** Ein Vergleich mit Konkurrenten oder anderen Schwimmern gehört nicht ins MVP. Vor so einer Funktion: von Anwalt klären.
- **Trainer, die Daten ihrer Athleten erfassen:** Dann ist der Trainer oder der Verein Verantwortlicher und die App Auftragsbearbeiterin (Art. 9 nDSG, Art. 28 DSGVO). Dafür braucht es einen Auftragsbearbeitungsvertrag. Trainer-Funktionen gehören deshalb nicht ins MVP. Von Anwalt klären.

## Quellen

- robots.txt von Swimrankings: <https://www.swimrankings.net/robots.txt> (Kopie im Ordner `belege/`)
- Login-Pflicht bei Swimrankings: <https://dcsc.poolq.net/blog/swim-rankings-result-access>
- SplashMe AGB, Datenschutz und FAQ: <https://splashme.app/terms>, <https://splashme.app/privacy>, <https://splashme.app/de/faq>
- SplashMe im App Store: <https://apps.apple.com/us/app/swim-results-splashme/id584805809>
- Splash Software (Meet Manager, Team Manager, Kontakt): <https://splash-software.ch/de/>
- Lenex: <https://wiki.swimrankings.net/index.php/swimrankings:Lenex>, Spezifikation 3.0: <https://www.southeastswimming.org/wp-content/uploads/2015/07/Lenex_3.0_Technical_Documentation.pdf>
- Swiss Aquatics, Seite zu Swimrankings und Swimstats: <https://www.swiss-aquatics.ch/de/leistungssport/swimming/swimrankings-swimstats>
- Swiss Aquatics, Geschäftsstelle: <https://www.swiss-aquatics.ch/de/verband/organisation/geschaeftsstelle>
- Ausschreibung Swiss Summer Championships 2025 (Lenex-Datei): <https://www.swiss-aquatics.ch/wp-content/uploads/2025/05/Invitation-Swiss-Summer-Championships-2025.pdf>
- swimstats.net: <https://www.swimstats.net/about>
