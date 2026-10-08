# Datenmodell MVP

## Überblick

```
Athlet 1 ──── n Lauf n ──── 1 Wettkampf
                 │
                 └── Splits (Liste im Lauf)
```

- **Gespeichert** werden vier Tabellen: `athletes`, `competitions`, `races` und `seasons`.
- **Ziel und Resultat** sind Felder im Lauf, keine eigenen Tabellen. Jeder Lauf hat genau ein Ziel und ein Resultat (1:1). Für eine 1:1-Beziehung braucht es keine eigene Tabelle.
- **Splits** sind eine Liste im Lauf. Sie gehören immer zu genau einem Lauf und werden nie einzeln gesucht.
- **Nicht gespeichert, sondern immer berechnet:** persönliche Bestzeit, Saisonbestzeit, Abweichung vom Ziel, Verbesserung in Sekunden und Prozent, Lap-Zeiten. Würde man diese Werte speichern, wären sie nach jeder Korrektur einer Zeit falsch.

## Typen

```ts
type Id = string; // crypto.randomUUID(): eindeutig auch über Geräte hinweg, wichtig für den Sync in Phase 2
type IsoDate = string; // 'YYYY-MM-DD', ohne Uhrzeit, also keine Zeitzonenprobleme
type Hs = number; // Zeit in Hundertstelsekunden als ganze Zahl: 1:09.20 = 6920

type Course = 'SCM' | 'LCM'; // Kurzbahn 25 m / Langbahn 50 m (Codes wie in Lenex)
type Stroke = 'FREE' | 'BACK' | 'BREAST' | 'FLY' | 'MEDLEY'; // Freistil, Rücken, Brust, Delfin, Lagen (Codes wie in Lenex)
type RaceStatus = 'planned' | 'finished' | 'dsq' | 'dns' | 'dnf';

interface Athlete {
	id: Id;
	name: string; // nur zur Anzeige, darf auch "Ich" sein
	createdAt: string; // ISO-Zeitstempel
	updatedAt: string;
}

interface Competition {
	id: Id;
	name: string;
	startDate: IsoDate;
	endDate?: IsoDate; // nur bei mehrtägigen Wettkämpfen
	location: string; // Ort / Bad
	entryDeadline?: IsoDate; // Meldeschluss
	course: Course; // gilt für alle Läufe dieses Wettkampfs
	createdAt: string;
	updatedAt: string;
}

interface Split {
	distance: number; // Meter ab Start, z. B. 50
	cumulative: Hs; // Zeit ab Start (kumuliert), wie in Lenex
}

interface Race {
	id: Id;
	athleteId: Id;
	competitionId: Id;
	date: IsoDate; // Tag des Starts, Standard ist das Startdatum des Wettkampfs
	stroke: Stroke;
	distance: number; // 50, 100, 200, 400, 800, 1500
	target?: Hs; // Zielzeit
	result?: Hs; // Endzeit, nur bei status 'finished'
	status: RaceStatus;
	splits: Split[]; // leer, wenn keine Zwischenzeiten vorhanden sind
	createdAt: string;
	updatedAt: string;
}

interface Season {
	id: Id;
	name: string; // z. B. "2026/27"
	startDate: IsoDate; // z. B. '2026-09-26'; die Saison endet, wenn die nächste beginnt
	createdAt: string;
	updatedAt: string;
}
```

## Die wichtigsten Entscheide

### 1. Zeiten als ganze Zahlen in Hundertstelsekunden

Kommazahlen rechnen im Computer ungenau (`0.1 + 0.2` ergibt `0.30000000000000004`). Ganze Zahlen rechnen exakt. Umgewandelt wird nur bei Eingabe und Anzeige: `"1:09.20"` wird zu `6920` und wieder zurück.

Beispiel: 1:10.40 auf 1:09.20 ergibt `6920 - 7040 = -120`, also −1.20 s. In Prozent: `-120 / 7040 = -1.7 %`.

### 2. Splits werden kumuliert gespeichert, Lap-Zeiten berechnet

Gespeichert wird zum Beispiel für 200 m Brust:

| distance | cumulative      |
| -------- | --------------- |
| 50       | 3420 (0:34.20)  |
| 100      | 7230 (1:12.30)  |
| 150      | 11090 (1:50.90) |

Endzeit `result` = 14980 (2:29.80).

Berechnet werden daraus die Laps 34.20 / 38.10 / 38.60 / 38.90, wobei die letzte Lap = Endzeit − letzter Split ist. Dazu kommt der Positive/Negative Split: erste Hälfte 72.30 gegen zweite Hälfte 77.50.

So funktioniert es auch in Lenex, deshalb klappt der Lenex-Import ohne Umrechnen (`src/lib/lenex.ts`, siehe README). Bei der Eingabe kannst du trotzdem Laps oder kumulierte Zeiten tippen, die App rechnet um.

Abstände der Zwischenzeiten: alle 25 m (nur Kurzbahn, dort ist eine Wende), alle 50 m oder alle 100 m (ab 400 m). Auf 50 m Langbahn gibt es keine Zwischenzeiten. Bei Zeiten ab Start dürfen Felder leer bleiben, der Abschnitt wird dann länger. Laps müssen vollständig sein, sonst lassen sie sich nicht aufsummieren. Positive/Negative Split braucht eine Zwischenzeit bei der halben Strecke. Code: `src/lib/splits.ts`.

**Plausibilitätsprüfung (Warnung, kein Verbot):**

- Die kumulierten Zeiten müssen steigen.
- Jede Split-Distanz muss kleiner als die Rennstrecke sein. Ausnahme: Ein Split bei der vollen Distanz muss gleich der Endzeit sein.
- Der letzte Split muss kleiner als die Endzeit sein.
- Bei Eingabe als Laps muss die Summe der Laps gleich der Endzeit sein.

### 3. Die Bahnlänge hängt am Wettkampf, nicht am Lauf

An einem Wettkampf schwimmt man nie Kurz- und Langbahn gemischt. Jede Auswertung gruppiert nach **Athlet + Lage + Distanz + Bahnlänge**. 100 Brust SCM und 100 Brust LCM sind darum technisch zwei verschiedene Strecken und können nie im selben Diagramm landen.

### 4. Alles wird im Speicher berechnet, keine komplizierten Abfragen

Eine Saison hat ein paar Dutzend bis wenige Hundert Läufe. Die App lädt alles und rechnet in TypeScript. Das ist einfach, schnell genug und gut testbar.

### 5. Erlaubte Kombinationen

| Lage                  | Distanzen                    |
| --------------------- | ---------------------------- |
| Freistil              | 50, 100, 200, 400, 800, 1500 |
| Rücken, Brust, Delfin | 50, 100, 200                 |
| Lagen                 | 100 (nur 25 m), 200, 400     |

### 6. Datensparsamkeit

Gespeichert werden kein Jahrgang, kein Geschlecht und kein Verein, denn das MVP braucht diese Angaben nicht. Sie kommen erst dazu, wenn eine Funktion sie braucht, zum Beispiel Qualifikationslimiten in Version 2.

## Dexie-Schema (Version 1)

```ts
db.version(1).stores({
	athletes: 'id',
	competitions: 'id, startDate',
	races: 'id, athleteId, competitionId, date',
	seasons: 'id, startDate'
});
```

Indizes gibt es nur für die Felder, nach denen sortiert oder gefiltert wird. Alles andere speichert Dexie trotzdem mit.

## Export

Eine JSON-Datei mit `{ schemaVersion: 1, exportedAt, athletes, competitions, races, seasons }`. Der Import liest dieselbe Datei wieder ein. Das ist zugleich das Backup und der Datenexport nach nDSG und DSGVO.

### 7. Saisons als eigene Tabelle

Der Saisonstart ist jedes Jahr ein anderes Datum (2026/27 begann am Samstag, 26.9.2026), darum ist er kein fixes Datum in den Einstellungen. Eine Saison hat nur ein Startdatum. Sie dauert bis zum Start der nächsten Saison. Ein Lauf gehört zu der Saison mit dem spätesten Startdatum, das nicht nach dem Lauftag liegt. Läufe vor der ersten erfassten Saison zählen für die persönliche Bestzeit, aber für keine Saisonbestzeit.
