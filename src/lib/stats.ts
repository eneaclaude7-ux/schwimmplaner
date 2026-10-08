// Auswertung: Bestzeit, Saisonbestzeit, Verbesserung. Alles wird aus den Läufen berechnet,
// nichts davon wird gespeichert (siehe docs/04-datenmodell.md).
import type { Competition, Course, Hs, Id, IsoDate, Race, Season, Stroke } from './model';
import { seasonForDate } from './seasons';

/** Eine Strecke: Lage + Distanz + Bahnlänge. SCM und LCM sind nie dieselbe Strecke. */
export interface EventKey {
	stroke: Stroke;
	distance: number;
	course: Course;
}

/** Ein geschwommener Lauf mit gültiger Endzeit */
export interface Entry {
	race: Race;
	competition: Competition;
	time: Hs;
	season?: Season;
	/** Zeit des letzten Laufs davor auf derselben Strecke */
	previous?: Hs;
	/** Beste Zeit vor diesem Lauf auf derselben Strecke */
	bestBefore?: Hs;
}

export interface EventHistory extends EventKey {
	key: string;
	/** Chronologisch, ältester zuerst */
	entries: Entry[];
}

const STROKE_ORDER: Stroke[] = ['FREE', 'BACK', 'BREAST', 'FLY', 'MEDLEY'];

export function eventKey(e: EventKey): string {
	return `${e.stroke}-${e.distance}-${e.course}`;
}

/** Datum, bei gleichem Tag die Reihenfolge der Erfassung (Vorlauf vor Final) */
function chronological(a: Race, b: Race): number {
	return a.date.localeCompare(b.date) || a.createdAt.localeCompare(b.createdAt);
}

/** Alle Strecken mit mindestens einer Zeit, sortiert nach Lage und Distanz */
export function buildHistories(
	races: Race[],
	competitions: Competition[],
	seasons: Season[]
): EventHistory[] {
	const byId = new Map(competitions.map((c) => [c.id, c]));
	const histories = new Map<string, EventHistory>();

	for (const race of [...races].sort(chronological)) {
		const competition = byId.get(race.competitionId);
		if (!competition || race.status !== 'finished' || race.result === undefined) continue;

		const event = { stroke: race.stroke, distance: race.distance, course: competition.course };
		const key = eventKey(event);
		let history = histories.get(key);
		if (!history) {
			history = { ...event, key, entries: [] };
			histories.set(key, history);
		}

		const earlier = history.entries;
		history.entries.push({
			race,
			competition,
			time: race.result,
			season: seasonForDate(seasons, race.date),
			previous: earlier.at(-1)?.time,
			bestBefore: earlier.length ? Math.min(...earlier.map((e) => e.time)) : undefined
		});
	}

	return [...histories.values()].sort(
		(a, b) =>
			STROKE_ORDER.indexOf(a.stroke) - STROKE_ORDER.indexOf(b.stroke) ||
			a.distance - b.distance ||
			a.course.localeCompare(b.course)
	);
}

/** Schnellster Eintrag; bei gleicher Zeit zählt, wer sie zuerst geschwommen ist */
function fastest(entries: Entry[]): Entry | undefined {
	let best: Entry | undefined;
	for (const entry of entries) if (!best || entry.time < best.time) best = entry;
	return best;
}

/** Persönliche Bestzeit */
export function personalBest(history: EventHistory): Entry | undefined {
	return fastest(history.entries);
}

/** Saisonbestzeit */
export function seasonBest(history: EventHistory, season: Season): Entry | undefined {
	return fastest(history.entries.filter((e) => e.season?.id === season.id));
}

/** Beste Zeit vor einem Datum, z. B. vor dem Saisonstart */
export function bestBeforeDate(history: EventHistory, date: IsoDate): Hs | undefined {
	return fastest(history.entries.filter((e) => e.race.date < date))?.time;
}

/** IDs der Läufe, die aktuell persönliche Bestzeit oder Saisonbestzeit sind */
export function bestMarks(histories: EventHistory[]): { pb: Set<Id>; sb: Set<Id> } {
	const pb = new Set<Id>();
	const sb = new Set<Id>();
	for (const history of histories) {
		const best = personalBest(history);
		if (best) pb.add(best.race.id);
		const seasons = new Map(
			history.entries.flatMap((e) => (e.season ? [[e.season.id, e.season]] : []))
		);
		for (const season of seasons.values()) {
			const entry = seasonBest(history, season);
			if (entry) sb.add(entry.race.id);
		}
	}
	return { pb, sb };
}

/** Verbesserung in Prozent der Vergleichszeit: 7040 -> 6920 ergibt −1.7 % */
export function formatPercent(diff: Hs, base: Hs): string {
	const percent = Math.round((Math.abs(diff) / base) * 1000) / 10;
	const sign = diff < 0 && percent > 0 ? '−' : diff > 0 && percent > 0 ? '+' : '±';
	return `${sign}${percent.toFixed(1)} %`;
}
