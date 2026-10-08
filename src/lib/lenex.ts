// Lenex-Import: liest Resultatdateien ganz im Browser, nichts wird hochgeladen.
// .lef ist XML, .lxf dasselbe als ZIP. Die Datei enthält alle Teilnehmenden eines Wettkampfs,
// gespeichert werden nur die Läufe des gewählten Athleten, ohne Name, Jahrgang und Verein
// (Datensparsamkeit, README Punkt 1). Format: Lenex 3.0, siehe docs/01-datenquellen-bericht.md
import { unzipSync } from 'fflate';
import { isIsoDate } from './dates';
import {
	allowedDistances,
	COURSE_LABEL,
	raceLabel,
	type Competition,
	type Course,
	type Hs,
	type Id,
	type IsoDate,
	type Race,
	type RaceStatus,
	type Split,
	type Stroke
} from './model';
import type { CompetitionValue, RaceValue } from './validation';

/** Ein Lauf aus der Datei, abgebildet auf das Datenmodell */
export type ImportedRace = RaceValue & { splits: Split[] };

/** Ein Resultat, das sich nicht übernehmen lässt */
export interface SkippedResult {
	label: string;
	reason: string;
}

/** Ein Schwimmer aus der Datei. Name, Jahrgang und Verein dienen nur der Auswahl. */
export interface LenexAthlete {
	/** eindeutig innerhalb des Wettkampfs */
	key: string;
	/** "Muster, Max" */
	name: string;
	birthYear?: string;
	club: string;
	races: ImportedRace[];
	skipped: SkippedResult[];
}

export interface LenexMeet {
	competition: CompetitionValue;
	/** nur Athleten mit mindestens einem Resultat, nach Name sortiert */
	athletes: LenexAthlete[];
}

export type LenexResult = { ok: true; meets: LenexMeet[] } | { ok: false; error: string };

/** Grösser ist keine Resultatdatei, sondern ein Fehler (oder eine ZIP-Bombe) */
const MAX_BYTES = 50 * 1024 * 1024;

/** Liest eine .lef- oder .lxf-Datei. ZIP wird am Inhalt erkannt, nicht an der Endung. */
export function readLenexFile(bytes: Uint8Array): LenexResult {
	if (bytes.length > MAX_BYTES) return { ok: false, error: 'Die Datei ist zu gross.' };
	// ZIP-Dateien beginnen mit "PK"
	if (bytes[0] !== 0x50 || bytes[1] !== 0x4b) return parseLenex(decodeXml(bytes));

	let files: Record<string, Uint8Array>;
	try {
		files = unzipSync(bytes, {
			filter: (file) => /\.lef$/i.test(file.name) && file.originalSize <= MAX_BYTES
		});
	} catch {
		return { ok: false, error: 'Die .lxf-Datei ist beschädigt.' };
	}
	const lef = Object.values(files)[0];
	if (!lef) return { ok: false, error: 'In der .lxf-Datei steckt keine .lef-Datei.' };
	return parseLenex(decodeXml(lef));
}

/** Meist UTF-8, ältere Dateien auch ISO-8859-1. Massgebend ist die XML-Deklaration. */
function decodeXml(bytes: Uint8Array): string {
	// Die Deklaration ist ASCII; ein UTF-8-BOM entfernt der Decoder
	const head = new TextDecoder().decode(bytes.subarray(0, 200));
	const declared = head.match(/^<\?xml[^>]*encoding=["']([\w.:-]+)["']/)?.[1];
	try {
		return new TextDecoder(declared ?? 'utf-8').decode(bytes);
	} catch {
		// Unbekannte Codierung: UTF-8 ist am wahrscheinlichsten
		return new TextDecoder().decode(bytes);
	}
}

/** Lenex-Zeit "00:01:09.20" in Hundertstel. "NT" (keine Zeit) und Ungültiges: null */
export function parseSwimTime(text: string | null): Hs | null {
	const match = text?.trim().match(/^(\d{1,2}):(\d{2}):(\d{2})\.(\d{2})$/);
	if (!match) return null;
	const [h, m, s, hh] = match.slice(1).map(Number);
	if (m >= 60 || s >= 60) return null;
	return ((h * 60 + m) * 60 + s) * 100 + hh;
}

/** Nur 25 und 50 m (Lenex kennt auch Yards und andere Becken) */
export function mapCourse(code: string | null): Course | null {
	return code === 'SCM' || code === 'LCM' ? code : null;
}

const STROKES: readonly string[] = ['FREE', 'BACK', 'BREAST', 'FLY', 'MEDLEY'];

export function mapStroke(code: string | null): Stroke | null {
	return code && STROKES.includes(code) ? (code as Stroke) : null;
}

/**
 * Status eines Resultats. Leer = normal geschwommen, EXH = ausser Konkurrenz (auch geschwommen).
 * SICK (krank) und WDR (abgemeldet) heissen für den Schwimmer: nicht angetreten.
 */
export function mapStatus(code: string | null): Exclude<RaceStatus, 'planned'> | null {
	switch (code ?? '') {
		case '':
		case 'EXH':
			return 'finished';
		case 'DSQ':
			return 'dsq';
		case 'DNS':
		case 'SICK':
		case 'WDR':
			return 'dns';
		case 'DNF':
			return 'dnf';
		default:
			return null;
	}
}

/**
 * Direkte Kinder entlang eines Pfads, z. B. "SESSIONS/SESSION".
 * So landen Staffel-Resultate (CLUB/RELAYS/RELAY/RESULTS) nie bei den Athleten.
 */
function children(parent: Element, path: string): Element[] {
	return path
		.split('/')
		.reduce<Element[]>(
			(elements, tag) =>
				elements.flatMap((el) => Array.from(el.children).filter((c) => c.tagName === tag)),
			[parent]
		);
}

function attr(el: Element, name: string): string {
	return el.getAttribute(name)?.trim() ?? '';
}

/** Teil eines Wettkampfs, auf den ein Resultat über eventid zeigt */
interface LenexEvent {
	date: IsoDate;
	course: string;
	stroke: string;
	distance: number;
	relay: boolean;
	technique: string;
}

export function parseLenex(xml: string): LenexResult {
	let doc: Document;
	try {
		doc = new DOMParser().parseFromString(xml, 'application/xml');
	} catch {
		return { ok: false, error: 'Die Datei ist kein gültiges XML.' };
	}
	if (doc.getElementsByTagName('parsererror').length > 0) {
		return { ok: false, error: 'Die Datei ist kein gültiges XML.' };
	}
	if (doc.documentElement.tagName !== 'LENEX') {
		return { ok: false, error: 'Die Datei ist keine Lenex-Datei.' };
	}

	const meets: LenexMeet[] = [];
	for (const meet of children(doc.documentElement, 'MEETS/MEET')) {
		const result = parseMeet(meet);
		if (!result.ok) return result;
		meets.push(result.meet);
	}
	if (meets.length === 0) return { ok: false, error: 'Die Datei enthält keinen Wettkampf.' };
	if (meets.every((m) => m.athletes.length === 0)) {
		return {
			ok: false,
			error: 'Die Datei enthält keine Resultate. Ist es eine Ausschreibung oder eine Meldeliste?'
		};
	}
	return { ok: true, meets };
}

function parseMeet(meet: Element): { ok: true; meet: LenexMeet } | { ok: false; error: string } {
	const name = attr(meet, 'name');
	if (!name) return { ok: false, error: 'Der Wettkampf in der Datei hat keinen Namen.' };

	const sessions = children(meet, 'SESSIONS/SESSION');
	const dates = sessions
		.map((s) => attr(s, 'date'))
		.filter(isIsoDate)
		.sort();
	if (dates.length === 0) return { ok: false, error: `${name}: In der Datei fehlt das Datum.` };
	const startDate = dates[0];
	const lastDay = dates[dates.length - 1];

	// Ohne Angabe beim Wettkampf gilt die Bahnlänge des ersten Abschnitts
	const courseCode =
		attr(meet, 'course') || sessions.map((s) => attr(s, 'course')).find(Boolean) || '';
	const course = mapCourse(courseCode);
	if (!course) {
		return {
			ok: false,
			error: `${name}: Die Bahnlänge "${courseCode || 'keine'}" wird nicht unterstützt, nur 25 und 50 m.`
		};
	}

	const events = new Map<string, LenexEvent>();
	for (const session of sessions) {
		const date = attr(session, 'date');
		if (!isIsoDate(date)) continue;
		for (const event of children(session, 'EVENTS/EVENT')) {
			const style = children(event, 'SWIMSTYLE')[0];
			if (!style) continue;
			events.set(attr(event, 'eventid'), {
				date,
				course: attr(session, 'course') || courseCode,
				stroke: attr(style, 'stroke'),
				distance: Number(attr(style, 'distance')),
				relay: Number(attr(style, 'relaycount') || 1) > 1,
				technique: attr(style, 'technique')
			});
		}
	}

	const deadline = attr(meet, 'deadline');
	const competition: CompetitionValue = {
		name,
		location: attr(meet, 'city') || 'unbekannt',
		startDate,
		endDate: lastDay !== startDate ? lastDay : undefined,
		entryDeadline: isIsoDate(deadline) && deadline <= lastDay ? deadline : undefined,
		course
	};

	const athletes: LenexAthlete[] = [];
	for (const club of children(meet, 'CLUBS/CLUB')) {
		for (const athlete of children(club, 'ATHLETES/ATHLETE')) {
			const results = children(athlete, 'RESULTS/RESULT');
			if (results.length === 0) continue;
			const races: ImportedRace[] = [];
			const skipped: SkippedResult[] = [];
			for (const result of results) {
				const mapped = mapResult(result, events, course);
				if ('reason' in mapped) skipped.push(mapped);
				else races.push(mapped);
			}
			const birthYear = attr(athlete, 'birthdate').slice(0, 4);
			athletes.push({
				key: String(athletes.length),
				name: [
					[attr(athlete, 'nameprefix'), attr(athlete, 'lastname')].filter(Boolean).join(' '),
					attr(athlete, 'firstname')
				]
					.filter(Boolean)
					.join(', '),
				birthYear: /^\d{4}$/.test(birthYear) ? birthYear : undefined,
				club: attr(club, 'name') || attr(club, 'shortname'),
				races: races.sort((a, b) => a.date.localeCompare(b.date)),
				skipped
			});
		}
	}
	athletes.sort((a, b) => a.name.localeCompare(b.name, 'de'));
	return { ok: true, meet: { competition, athletes } };
}

/** Ein RESULT wird zu einem Lauf, oder es wird mit Grund übersprungen */
function mapResult(
	result: Element,
	events: Map<string, LenexEvent>,
	course: Course
): ImportedRace | SkippedResult {
	const event = events.get(attr(result, 'eventid'));
	if (!event) return { label: 'Unbekannter Lauf', reason: 'Der Lauf fehlt im Programm.' };

	const stroke = mapStroke(event.stroke);
	const label = stroke
		? raceLabel({ distance: event.distance, stroke })
		: `${event.distance} m ${event.stroke || 'unbekannte Lage'}`;
	if (event.relay) return { label, reason: 'Staffeln werden nicht übernommen.' };
	if (!stroke) return { label, reason: 'Diese Lage kennt der Schwimmplaner nicht.' };
	if (event.technique) return { label, reason: 'Technik-Läufe werden nicht übernommen.' };
	if (mapCourse(event.course) !== course) {
		return { label, reason: 'Der Lauf hat eine andere Bahnlänge als der Wettkampf.' };
	}
	if (!allowedDistances(stroke, course).includes(event.distance)) {
		return { label, reason: 'Diese Strecke kennt der Schwimmplaner nicht.' };
	}

	const status = mapStatus(attr(result, 'status'));
	if (!status) return { label, reason: `Unbekannter Status "${attr(result, 'status')}".` };
	const race: ImportedRace = {
		stroke,
		distance: event.distance,
		date: event.date,
		status,
		splits: []
	};
	if (status !== 'finished') return race;

	// Endzeit und Zwischenzeiten gibt es nur bei einem geschwommenen Lauf
	const time = parseSwimTime(attr(result, 'swimtime'));
	if (!time) return { label, reason: 'Das Resultat hat keine gültige Zeit.' };
	const seen = new Set<number>();
	race.result = time;
	race.splits = children(result, 'SPLITS/SPLIT')
		.map((s) => ({
			distance: Number(attr(s, 'distance')),
			cumulative: parseSwimTime(attr(s, 'swimtime')) ?? 0
		}))
		.filter((s) => {
			// Lenex speichert Splits kumuliert, wie das Datenmodell. Ein Split im Ziel ist die Endzeit.
			const ok =
				Number.isInteger(s.distance) &&
				s.distance > 0 &&
				s.distance < event.distance &&
				s.cumulative > 0 &&
				!seen.has(s.distance);
			seen.add(s.distance);
			return ok;
		})
		.sort((a, b) => a.distance - b.distance);
	return race;
}

/** Was mit einem Lauf aus der Datei passiert */
export type RaceAction = 'new' | 'complete' | 'duplicate';

export const ACTION_LABEL: Record<RaceAction, string> = {
	new: 'neu',
	complete: 'ergänzt den geplanten Lauf',
	duplicate: 'schon erfasst'
};

export interface PlannedRace {
	race: ImportedRace;
	action: RaceAction;
	/** bei 'complete' der geplante Lauf, der das Resultat bekommt (die Zielzeit bleibt) */
	existingId?: Id;
}

export interface ImportPlan {
	/** schon erfasster Wettkampf mit gleichem Namen und Startdatum, sonst wird er neu angelegt */
	existing?: Competition;
	competition: CompetitionValue;
	/** neues Enddatum, wenn der erfasste Wettkampf kürzer ist als in der Datei */
	extendTo?: IsoDate;
	races: PlannedRace[];
}

/** Gleicher Name (ohne Gross/klein und Leerzeichen) und gleiches Startdatum */
export function isSameCompetition(
	a: Pick<Competition, 'name' | 'startDate'>,
	b: Pick<Competition, 'name' | 'startDate'>
): boolean {
	const norm = (name: string) => name.trim().replace(/\s+/g, ' ').toLocaleLowerCase('de');
	return a.startDate === b.startDate && norm(a.name) === norm(b.name);
}

/**
 * Plant den Import eines Athleten, ohne etwas zu speichern (für die Vorschau).
 * Ist der Wettkampf schon erfasst, kommen die Läufe dorthin. Ein Lauf mit gleicher Strecke,
 * gleichem Status und gleicher Endzeit gilt als schon erfasst, so lässt sich eine Datei
 * auch zweimal einlesen. Ein geplanter Lauf derselben Strecke bekommt das Resultat.
 */
export function planImport(
	meet: LenexMeet,
	athlete: LenexAthlete,
	competitions: Competition[],
	races: Race[]
): { ok: true; plan: ImportPlan } | { ok: false; error: string } {
	const existing = competitions.find((c) => isSameCompetition(c, meet.competition));
	if (existing && existing.course !== meet.competition.course) {
		return {
			ok: false,
			error:
				`${existing.name} ist schon erfasst, aber mit ${COURSE_LABEL[existing.course]}. ` +
				'Bitte zuerst die Bahnlänge des Wettkampfs prüfen.'
		};
	}

	// Jeder erfasste Lauf passt höchstens zu einem Lauf aus der Datei
	const open = races.filter((r) => existing && r.competitionId === existing.id);
	const take = (match: (r: Race) => boolean) => {
		const index = open.findIndex(match);
		return index >= 0 ? open.splice(index, 1)[0] : undefined;
	};
	const planned: PlannedRace[] = athlete.races.map((race) => {
		const sameEvent = (r: Race) => r.stroke === race.stroke && r.distance === race.distance;
		if (take((r) => sameEvent(r) && r.status === race.status && r.result === race.result)) {
			return { race, action: 'duplicate' };
		}
		const plannedRace = take((r) => sameEvent(r) && r.status === 'planned');
		if (plannedRace) return { race, action: 'complete', existingId: plannedRace.id };
		return { race, action: 'new' };
	});

	// Dauert der Wettkampf in der Datei länger als erfasst, wird das Enddatum verschoben
	const lastDay = existing?.endDate ?? existing?.startDate ?? '';
	const latest =
		athlete.races
			.map((r) => r.date)
			.sort()
			.at(-1) ?? '';
	return {
		ok: true,
		plan: {
			existing,
			competition: meet.competition,
			extendTo: existing && latest > lastDay ? latest : undefined,
			races: planned
		}
	};
}
