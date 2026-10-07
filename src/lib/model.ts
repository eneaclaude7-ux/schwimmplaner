// Datenmodell des MVP. Erklärung der Entscheide: docs/04-datenmodell.md

/** crypto.randomUUID(): eindeutig auch über Geräte hinweg (wichtig für Sync in Phase 2) */
export type Id = string;
/** 'YYYY-MM-DD', ohne Uhrzeit */
export type IsoDate = string;
/** Zeit in Hundertstelsekunden als ganze Zahl: 1:09.20 = 6920 */
export type Hs = number;

/** Kurzbahn 25 m / Langbahn 50 m (Codes wie in Lenex) */
export type Course = 'SCM' | 'LCM';
/** Codes wie in Lenex */
export type Stroke = 'FREE' | 'BACK' | 'BREAST' | 'FLY' | 'MEDLEY';
export type RaceStatus = 'planned' | 'finished' | 'dsq' | 'dns' | 'dnf';

interface Timestamps {
	/** ISO-Zeitstempel */
	createdAt: string;
	updatedAt: string;
}

export interface Athlete extends Timestamps {
	id: Id;
	/** nur zur Anzeige, darf auch "Ich" sein */
	name: string;
}

export interface Competition extends Timestamps {
	id: Id;
	name: string;
	startDate: IsoDate;
	/** nur bei mehrtägigen Wettkämpfen */
	endDate?: IsoDate;
	location: string;
	/** Meldeschluss */
	entryDeadline?: IsoDate;
	/** gilt für alle Läufe dieses Wettkampfs */
	course: Course;
}

export interface Split {
	/** Meter ab Start */
	distance: number;
	/** Zeit ab Start (kumuliert), wie in Lenex */
	cumulative: Hs;
}

export interface Race extends Timestamps {
	id: Id;
	athleteId: Id;
	competitionId: Id;
	/** Tag des Starts */
	date: IsoDate;
	stroke: Stroke;
	distance: number;
	/** Zielzeit */
	target?: Hs;
	/** Endzeit, nur bei status 'finished' */
	result?: Hs;
	status: RaceStatus;
	splits: Split[];
}

export interface Season extends Timestamps {
	id: Id;
	/** z. B. "2026/27" */
	name: string;
	/** Die Saison dauert bis zum Start der nächsten */
	startDate: IsoDate;
}

export const COURSE_LABEL: Record<Course, string> = {
	SCM: 'Kurzbahn (25 m)',
	LCM: 'Langbahn (50 m)'
};

export const STROKE_LABEL: Record<Stroke, string> = {
	FREE: 'Freistil',
	BACK: 'Rücken',
	BREAST: 'Brust',
	FLY: 'Delfin',
	MEDLEY: 'Lagen'
};

export const STATUS_LABEL: Record<RaceStatus, string> = {
	planned: 'geplant',
	finished: 'geschwommen',
	dsq: 'disqualifiziert',
	dns: 'nicht angetreten',
	dnf: 'aufgegeben'
};

export function raceLabel(race: Pick<Race, 'distance' | 'stroke'>): string {
	return `${race.distance} m ${STROKE_LABEL[race.stroke]}`;
}

/** Erlaubte Distanzen pro Lage und Bahnlänge (Einzelstarts) */
export function allowedDistances(stroke: Stroke, course: Course): number[] {
	switch (stroke) {
		case 'FREE':
			return [50, 100, 200, 400, 800, 1500];
		case 'MEDLEY':
			return course === 'SCM' ? [100, 200, 400] : [200, 400];
		default:
			return [50, 100, 200];
	}
}
