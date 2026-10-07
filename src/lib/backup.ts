// Export und Import aller Daten als JSON. Das ist zugleich Backup und Datenexport (nDSG/DSGVO).
import { isIsoDate } from './dates';
import type { Athlete, Competition, Race, Season } from './model';

export const SCHEMA_VERSION = 1;

export interface AppData {
	athletes: Athlete[];
	competitions: Competition[];
	races: Race[];
	seasons: Season[];
}

export interface Backup extends AppData {
	schemaVersion: typeof SCHEMA_VERSION;
	exportedAt: string;
}

export function createBackup(data: AppData, now = new Date()): Backup {
	return { schemaVersion: SCHEMA_VERSION, exportedAt: now.toISOString(), ...data };
}

type Check = (value: unknown) => boolean;

const isString: Check = (v) => typeof v === 'string';
const isDate: Check = (v) => typeof v === 'string' && isIsoDate(v);
const isTime: Check = (v) => Number.isInteger(v) && (v as number) >= 0;
const optional =
	(check: Check): Check =>
	(v) =>
		v === undefined || check(v);
const oneOf =
	(...values: string[]): Check =>
	(v) =>
		values.includes(v as string);
const isSplitList: Check = (v) =>
	Array.isArray(v) &&
	v.every((s) => typeof s === 'object' && s !== null && isTime(s.distance) && isTime(s.cumulative));

const timestamps = { createdAt: isString, updatedAt: isString };

const SHAPES: Record<keyof AppData, Record<string, Check>> = {
	athletes: { id: isString, name: isString, ...timestamps },
	competitions: {
		id: isString,
		name: isString,
		startDate: isDate,
		endDate: optional(isDate),
		location: isString,
		entryDeadline: optional(isDate),
		course: oneOf('SCM', 'LCM'),
		...timestamps
	},
	races: {
		id: isString,
		athleteId: isString,
		competitionId: isString,
		date: isDate,
		stroke: oneOf('FREE', 'BACK', 'BREAST', 'FLY', 'MEDLEY'),
		distance: isTime,
		target: optional(isTime),
		result: optional(isTime),
		status: oneOf('planned', 'finished', 'dsq', 'dns', 'dnf'),
		splits: isSplitList,
		...timestamps
	},
	seasons: { id: isString, name: isString, startDate: isDate, ...timestamps }
};

const TABLE_LABEL: Record<keyof AppData, string> = {
	athletes: 'Athleten',
	competitions: 'Wettkämpfe',
	races: 'Läufe',
	seasons: 'Saisons'
};

/** Liest eine Backup-Datei und prüft jeden Datensatz. Fehler werden auf Deutsch beschrieben. */
export function parseBackup(
	text: string
): { ok: true; backup: Backup } | { ok: false; error: string } {
	let data: unknown;
	try {
		data = JSON.parse(text);
	} catch {
		return { ok: false, error: 'Die Datei ist kein gültiges JSON.' };
	}
	if (typeof data !== 'object' || data === null) {
		return { ok: false, error: 'Die Datei ist kein Schwimmplaner-Backup.' };
	}
	const raw = data as Record<string, unknown>;
	if (raw.schemaVersion !== SCHEMA_VERSION) {
		return { ok: false, error: 'Diese Backup-Version wird nicht unterstützt.' };
	}

	for (const table of Object.keys(SHAPES) as (keyof AppData)[]) {
		const rows = raw[table];
		if (!Array.isArray(rows)) {
			return { ok: false, error: `Im Backup fehlen die ${TABLE_LABEL[table]}.` };
		}
		for (const [index, row] of rows.entries()) {
			const fields = Object.entries(SHAPES[table]);
			const bad =
				typeof row !== 'object' || row === null
					? 'Eintrag'
					: fields.find(([field, check]) => !check((row as Record<string, unknown>)[field]))?.[0];
			if (bad) {
				return {
					ok: false,
					error: `${TABLE_LABEL[table]}, Eintrag ${index + 1}: Feld "${bad}" ist ungültig.`
				};
			}
		}
	}

	const backup = raw as unknown as Backup;
	const athleteIds = new Set(backup.athletes.map((a) => a.id));
	const competitionIds = new Set(backup.competitions.map((c) => c.id));
	const orphan = backup.races.findIndex(
		(r) => !athleteIds.has(r.athleteId) || !competitionIds.has(r.competitionId)
	);
	if (orphan >= 0) {
		return {
			ok: false,
			error: `Läufe, Eintrag ${orphan + 1}: gehört zu keinem Wettkampf oder Athleten.`
		};
	}
	return { ok: true, backup };
}
