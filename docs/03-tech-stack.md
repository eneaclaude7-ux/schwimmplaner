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
- **Vertragspartner:** Vor Phase 2 klären, wer Vertragspartner für Hosting und Zahlungen ist.
