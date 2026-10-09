// Alle Schreibzugriffe auf die lokale Datenbank an einem Ort.
import { createBackup, type Backup } from './backup';
import { db } from './db';
import type { ImportPlan } from './lenex';
import type { Id, IsoDate, Race, Season, Split } from './model';
import type { CompetitionValue, RaceValue } from './validation';

function now(): string {
	return new Date().toISOString();
}

/** UUID v4. crypto.randomUUID gibt es nur über HTTPS, darum ein Ersatz für Tests im Heimnetz. */
function newId(): Id {
	if (typeof crypto.randomUUID === 'function') return crypto.randomUUID();
	const bytes = crypto.getRandomValues(new Uint8Array(16));
	bytes[6] = (bytes[6] & 0x0f) | 0x40;
	bytes[8] = (bytes[8] & 0x3f) | 0x80;
	const hex = [...bytes].map((b) => b.toString(16).padStart(2, '0')).join('');
	return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20)}`;
}

/** Im MVP gibt es genau einen Athleten. Er wird beim ersten Lauf angelegt. */
async function ensureAthlete(): Promise<Id> {
	const existing = await db.athletes.toCollection().first();
	if (existing) return existing.id;
	const id = newId();
	await db.athletes.add({ id, name: 'Ich', createdAt: now(), updatedAt: now() });
	return id;
}

export async function saveCompetition(value: CompetitionValue, id?: Id): Promise<Id> {
	return db.transaction('rw', db.competitions, db.races, async () => {
		const existing = id ? await db.competitions.get(id) : undefined;
		const saved = {
			...value,
			id: existing?.id ?? newId(),
			createdAt: existing?.createdAt ?? now(),
			updatedAt: now()
		};
		await db.competitions.put(saved);

		// Wurden die Daten des Wettkampfs geändert, rutschen Läufe ausserhalb auf den ersten Tag
		const lastDay = saved.endDate ?? saved.startDate;
		await db.races
			.where('competitionId')
			.equals(saved.id)
			.filter((race) => race.date < saved.startDate || race.date > lastDay)
			.modify({ date: saved.startDate, updatedAt: now() });
		return saved.id;
	});
}

export async function deleteCompetition(id: Id): Promise<void> {
	await db.transaction('rw', db.competitions, db.races, async () => {
		await db.races.where('competitionId').equals(id).delete();
		await db.competitions.delete(id);
	});
}

export async function saveRace(
	value: RaceValue & { splits: Split[] },
	competitionId: Id,
	id?: Id
): Promise<Id> {
	const existing = id ? await db.races.get(id) : undefined;
	const athleteId = existing?.athleteId ?? (await ensureAthlete());
	const saved = {
		...value,
		id: existing?.id ?? newId(),
		athleteId,
		competitionId,
		createdAt: existing?.createdAt ?? now(),
		updatedAt: now()
	};
	await db.races.put(saved);
	return saved.id;
}

export async function deleteRace(id: Id): Promise<void> {
	await db.races.delete(id);
}

/** Gelöschten Lauf zurückholen (Rückgängig), unverändert mit derselben ID */
export async function restoreRace(race: Race): Promise<void> {
	await db.races.put(race);
}

/** Speichert einen Lenex-Import (siehe planImport). Alles oder nichts (eine Transaktion). */
export async function saveImport(plan: ImportPlan): Promise<Id> {
	return db.transaction('rw', db.athletes, db.competitions, db.races, async () => {
		const athleteId = await ensureAthlete();
		const competitionId = plan.existing?.id ?? newId();
		if (!plan.existing) {
			await db.competitions.add({
				...plan.competition,
				id: competitionId,
				createdAt: now(),
				updatedAt: now()
			});
		} else if (plan.extendTo) {
			await db.competitions.update(competitionId, { endDate: plan.extendTo, updatedAt: now() });
		}

		for (const { race, action, existingId } of plan.races) {
			if (action === 'new') {
				await db.races.add({
					...race,
					id: newId(),
					athleteId,
					competitionId,
					createdAt: now(),
					updatedAt: now()
				});
			} else if (action === 'complete' && existingId) {
				// Die Zielzeit des geplanten Laufs bleibt
				const { date, status, result, splits } = race;
				await db.races.update(existingId, { date, status, result, splits, updatedAt: now() });
			}
		}
		return competitionId;
	});
}

export async function addSeason(name: string, startDate: IsoDate): Promise<Id> {
	const id = newId();
	await db.seasons.add({ id, name, startDate, createdAt: now(), updatedAt: now() });
	return id;
}

export async function deleteSeason(id: Id): Promise<void> {
	await db.seasons.delete(id);
}

/** Gelöschte Saison zurückholen (Rückgängig) */
export async function restoreSeason(season: Season): Promise<void> {
	await db.seasons.put(season);
}

export async function exportAll(): Promise<Backup> {
	const [athletes, competitions, races, seasons] = await Promise.all([
		db.athletes.toArray(),
		db.competitions.toArray(),
		db.races.toArray(),
		db.seasons.toArray()
	]);
	return createBackup({ athletes, competitions, races, seasons });
}

/** Ersetzt alle Daten durch das Backup. Alles oder nichts (eine Transaktion). */
export async function importAll(backup: Backup): Promise<void> {
	await db.transaction('rw', db.tables, async () => {
		await Promise.all(db.tables.map((table) => table.clear()));
		await db.athletes.bulkAdd(backup.athletes);
		await db.competitions.bulkAdd(backup.competitions);
		await db.races.bulkAdd(backup.races);
		await db.seasons.bulkAdd(backup.seasons);
	});
}

export async function deleteAllData(): Promise<void> {
	await db.transaction('rw', db.tables, async () => {
		await Promise.all(db.tables.map((table) => table.clear()));
	});
}
