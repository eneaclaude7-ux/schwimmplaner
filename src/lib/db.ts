import { Dexie, type EntityTable } from 'dexie';
import type { Athlete, Competition, Race, Season } from './model';

// Lokale Datenbank im Browser (IndexedDB). Nichts davon verlässt das Gerät.
export const db = new Dexie('schwimmplaner') as Dexie & {
	athletes: EntityTable<Athlete, 'id'>;
	competitions: EntityTable<Competition, 'id'>;
	races: EntityTable<Race, 'id'>;
	seasons: EntityTable<Season, 'id'>;
};

// Indiziert sind nur Felder, nach denen gesucht oder sortiert wird.
// Ein neues Feld braucht keine neue Version, ein neuer Index schon.
db.version(1).stores({
	athletes: 'id',
	competitions: 'id, startDate',
	races: 'id, athleteId, competitionId, date',
	seasons: 'id, startDate'
});
