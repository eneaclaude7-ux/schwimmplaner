import { Dexie, type EntityTable } from 'dexie';
import type { Athlete, Competition, Race, Season } from './model';

/** Einstellungen der App auf diesem Gerät, zum Beispiel wann das letzte Backup war */
export interface Meta {
	key: 'lastBackup';
	/** ISO-Zeitstempel */
	value: string;
}

// Lokale Datenbank im Browser (IndexedDB). Nichts davon verlässt das Gerät.
export const db = new Dexie('schwimmplaner') as Dexie & {
	athletes: EntityTable<Athlete, 'id'>;
	competitions: EntityTable<Competition, 'id'>;
	races: EntityTable<Race, 'id'>;
	seasons: EntityTable<Season, 'id'>;
	meta: EntityTable<Meta, 'key'>;
};

// Indiziert sind nur Felder, nach denen gesucht oder sortiert wird.
// Ein neues Feld braucht keine neue Version, ein neuer Index schon.
db.version(1).stores({
	athletes: 'id',
	competitions: 'id, startDate',
	races: 'id, athleteId, competitionId, date',
	seasons: 'id, startDate'
});

// Version 2: Tabelle für Einstellungen. Die übrigen Tabellen bleiben unverändert erhalten.
db.version(2).stores({
	meta: 'key'
});
