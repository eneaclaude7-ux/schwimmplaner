// Prüft Formulareingaben. Reine Funktionen ohne Datenbank, darum gut testbar.
import { isIsoDate } from './dates';
import {
	allowedDistances,
	type Competition,
	type Course,
	type Hs,
	type IsoDate,
	type RaceStatus,
	type Stroke
} from './model';
import { parseTime } from './time';

/** Entweder ein gültiger Wert oder Fehlermeldungen pro Feld */
export type Result<Value, Field extends string> =
	{ ok: true; value: Value } | { ok: false; errors: Partial<Record<Field, string>> };

export interface CompetitionInput {
	name: string;
	startDate: string;
	endDate: string;
	location: string;
	entryDeadline: string;
	course: Course | '';
}

export type CompetitionValue = Pick<
	Competition,
	'name' | 'startDate' | 'endDate' | 'location' | 'entryDeadline' | 'course'
>;

export function validateCompetition(
	input: CompetitionInput
): Result<CompetitionValue, keyof CompetitionInput> {
	const errors: Partial<Record<keyof CompetitionInput, string>> = {};
	const name = input.name.trim();
	const location = input.location.trim();

	if (!name) errors.name = 'Bitte einen Namen eingeben.';
	if (!location) errors.location = 'Bitte einen Ort eingeben.';
	if (!isIsoDate(input.startDate)) errors.startDate = 'Bitte ein gültiges Datum wählen.';
	if (input.endDate && !isIsoDate(input.endDate)) {
		errors.endDate = 'Bitte ein gültiges Datum wählen.';
	} else if (input.endDate && input.endDate < input.startDate) {
		errors.endDate = 'Das Ende liegt vor dem Beginn.';
	}
	const lastDay = input.endDate || input.startDate;
	if (input.entryDeadline && !isIsoDate(input.entryDeadline)) {
		errors.entryDeadline = 'Bitte ein gültiges Datum wählen.';
	} else if (input.entryDeadline && input.entryDeadline > lastDay) {
		errors.entryDeadline = 'Der Meldeschluss liegt nach dem Wettkampf.';
	}
	if (input.course !== 'SCM' && input.course !== 'LCM')
		errors.course = 'Bitte die Bahnlänge wählen.';

	if (Object.keys(errors).length > 0) return { ok: false, errors };
	return {
		ok: true,
		value: {
			name,
			location,
			startDate: input.startDate,
			endDate: input.endDate && input.endDate !== input.startDate ? input.endDate : undefined,
			entryDeadline: input.entryDeadline || undefined,
			course: input.course as Course
		}
	};
}

export interface RaceInput {
	stroke: Stroke | '';
	distance: string;
	date: string;
	target: string;
	status: RaceStatus;
	result: string;
}

export interface RaceValue {
	stroke: Stroke;
	distance: number;
	date: IsoDate;
	target?: Hs;
	result?: Hs;
	status: RaceStatus;
}

export function validateRace(
	input: RaceInput,
	competition: Pick<Competition, 'startDate' | 'endDate' | 'course'>
): Result<RaceValue, keyof RaceInput> {
	const errors: Partial<Record<keyof RaceInput, string>> = {};
	const distance = Number(input.distance);

	if (!input.stroke) {
		errors.stroke = 'Bitte die Lage wählen.';
	} else if (!allowedDistances(input.stroke, competition.course).includes(distance)) {
		errors.distance = 'Diese Strecke gibt es für diese Lage und Bahnlänge nicht.';
	}

	const lastDay = competition.endDate ?? competition.startDate;
	if (!isIsoDate(input.date) || input.date < competition.startDate || input.date > lastDay) {
		errors.date = 'Der Tag muss innerhalb des Wettkampfs liegen.';
	}

	const target = input.target.trim() ? parseTime(input.target) : undefined;
	if (target === null) errors.target = 'Zeit nicht lesbar. Beispiel: 1:09.20';

	// Ein Resultat gibt es nur bei einem geschwommenen Lauf
	let result: Hs | undefined;
	if (input.status === 'finished') {
		const parsed = parseTime(input.result);
		if (!input.result.trim()) errors.result = 'Bitte die Endzeit eingeben.';
		else if (parsed === null) errors.result = 'Zeit nicht lesbar. Beispiel: 1:09.20';
		else result = parsed;
	}

	if (Object.keys(errors).length > 0) return { ok: false, errors };
	return {
		ok: true,
		value: {
			stroke: input.stroke as Stroke,
			distance,
			date: input.date,
			target: target ?? undefined,
			result,
			status: input.status
		}
	};
}
