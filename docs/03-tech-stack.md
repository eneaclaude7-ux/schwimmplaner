# Tech-Stack (festgelegt am 7.10.2026)

## Grundsatz: local-first

- **Phase 1 (MVP, eigene Nutzung):** Alle Daten bleiben im Browser auf dem Gerät. Es gibt keinen Server und keine Konten.
- **Phase 2 (öffentlich):** Dann kommen Serverteil, Konten, Sync zwischen Geräten, Altersabfrage und Eltern-Bestätigung dazu.

## Komponenten

| Teil             | Wahl                                                                             |
| ---------------- | -------------------------------------------------------------------------------- |
| Sprache          | TypeScript                                                                       |
| Framework        | SvelteKit (Svelte 5), in Phase 1 mit `adapter-static`                            |
| Lokale Datenbank | Dexie.js (IndexedDB)                                                             |
| PWA / Offline    | eigener Service Worker (in SvelteKit eingebaut) und Web-App-Manifest             |
| Diagramme        | eigene SVG-Komponenten mit d3-scale, dazu immer eine Tabelle als Textalternative |
| Lenex-Import     | XML-Parser des Browsers (DOMParser), fflate zum Entpacken von `.lxf`             |
| Tests            | Vitest, für den Lenex-Test mit jsdom als DOM-Umgebung                            |
| Hosting Phase 1  | GitHub Pages                                                                     |
| Phase 2          | Serverteil in SvelteKit; Datenbank und Schweizer Hoster werden dann entschieden  |

**Änderung beim Aufsetzen:** Statt @vite-pwa/sveltekit nutzen wir den Service Worker, den SvelteKit schon mitbringt. Das Plugin unterstützt SvelteKit 3 noch nicht. Die Lösung ohne Plugin ist ausserdem eine Abhängigkeit weniger und besser zu verstehen: [src/service-worker/index.ts](../src/service-worker/index.ts).

## Drittanbieter und was sie senden

| Bibliothek / Dienst    | Läuft wo                | Sendet Daten?                                                                                                                |
| ---------------------- | ----------------------- | ---------------------------------------------------------------------------------------------------------------------------- |
| Svelte / SvelteKit     | im Browser              | nein                                                                                                                         |
| Dexie.js               | im Browser              | nein, speichert nur lokal                                                                                                    |
| eigener Service Worker | im Browser              | nein, cached nur die App-Dateien                                                                                             |
| d3-scale               | im Browser              | nein                                                                                                                         |
| fflate                 | im Browser              | nein, entpackt nur die gewählte Lenex-Datei                                                                                  |
| GitHub Pages           | Server von GitHub (USA) | ja: Beim Abruf der Seite sieht GitHub technisch die IP-Adresse und muss sie verarbeiten. Gehört in die Datenschutzerklärung. |

Es gibt keine Tracking-SDKs, keine CDNs und keine externen Schriften. Alles wird mit der App ausgeliefert, auch die Schrift Barlow Semi Condensed (@fontsource, OFL-1.1).

## Bekannte Nachteile und Gegenmittel

- **Kein Sync:** Die Daten sind nur auf einem Gerät, der Sync kommt in Phase 2.
- **Speicher kann gelöscht werden:** Safari löscht die Daten einer Website nach 7 Tagen ohne Besuch, ausser die App ist auf dem Homescreen installiert. Gegenmittel:
  - als PWA installieren,
  - `navigator.storage.persist()` aufrufen (Browser um dauerhaften Speicher bitten),
  - Export und Import als JSON ab Tag 1.
  - Erinnerung ans Backup auf der Übersicht, sobald eine Änderung 7 Tage ungesichert ist.
- **Vertragspartner:** Vor Phase 2 klären, wer Vertragspartner für Hosting und Zahlungen ist.

## Entscheid: PWA statt Store-App (11.10.2026)

Geprüft wurde Expo (React Native) für eine App im App Store und bei Google Play. Ergebnis: Die App bleibt eine PWA.

- **Expo** hiesse die ganze Oberfläche neu schreiben, dazu Datenbank (IndexedDB zu SQLite), Diagramme und Teile des Lenex-Imports. Übernehmen liesse sich nur die Rechenlogik in TypeScript. Stark ist Expo beim Bauen ohne Mac (EAS Build in der Cloud).
- **Falls später doch eine Store-App:** Capacitor statt Expo. Capacitor verpackt die bestehende statische App fast unverändert. Für iOS braucht es einen Mac oder einen Cloud-Build.
- **Voraussetzungen für jeden Store:** Apple Developer Program 99 USD pro Jahr, Google Play 25 USD einmalig. Beide verlangen Volljährigkeit; bei Minderjährigen meldet sich ein Elternteil an. Apple lehnt reine Website-Hüllen ab (Richtlinie 4.2).
- **Wann neu prüfen:** wenn Nutzer nach einer Store-App fragen, frühestens nach einer Saison eigener Nutzung.
