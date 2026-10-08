// CSV-Export aller Läufe, z. B. für Excel oder den Trainer.
import { formatDate } from './dates';
import {
	COURSE_LABEL,
	STATUS_LABEL,
	STROKE_LABEL,
	type Competition,
	type Race,
	type Season
} from './model';
import { seasonForDate } from './seasons';
import { bestMarks, buildHistories } from './stats';
import { formatDiff, formatTime } from './time';

/** Ein Feld für CSV. Semikolon, weil Excel mit Schweizer Einstellungen das erwartet. */
function field(value: string): string {
	return /[";\n\r]/.test(value) ? `"${value.replaceAll('"', '""')}"` : value;
}

/** Selbst eingegebener Text: beginnt er mit = + - @, führt Excel ihn sonst als Formel aus */
function userText(value: string): string {
	return /^[=+\-@\t\r]/.test(value) ? `'${value}` : value;
}

const HEADER = [
	'Datum',
	'Wettkampf',
	'Ort',
	'Bahnlänge',
	'Saison',
	'Lage',
	'Distanz (m)',
	'Status',
	'Zielzeit',
	'Endzeit',
	'Abweichung vom Ziel',
	'Persönliche Bestzeit',
	'Saisonbestzeit'
];

/** Alle Läufe als CSV-Text, chronologisch. Mit BOM, damit Excel die Umlaute richtig liest. */
export function racesToCsv(races: Race[], competitions: Competition[], seasons: Season[]): string {
	const byId = new Map(competitions.map((c) => [c.id, c]));
	const marks = bestMarks(buildHistories(races, competitions, seasons));

	const rows = [...races]
		.sort((a, b) => a.date.localeCompare(b.date) || a.createdAt.localeCompare(b.createdAt))
		.flatMap((race) => {
			const c = byId.get(race.competitionId);
			if (!c) return [];
			const finished = race.status === 'finished' && race.result !== undefined;
			return [
				[
					formatDate(race.date),
					userText(c.name),
					userText(c.location),
					COURSE_LABEL[c.course],
					userText(seasonForDate(seasons, race.date)?.name ?? ''),
					STROKE_LABEL[race.stroke],
					String(race.distance),
					STATUS_LABEL[race.status],
					race.target !== undefined ? formatTime(race.target) : '',
					finished ? formatTime(race.result!) : '',
					finished && race.target !== undefined ? formatDiff(race.result! - race.target) : '',
					marks.pb.has(race.id) ? 'ja' : '',
					marks.sb.has(race.id) ? 'ja' : ''
				]
			];
		});

	return '﻿' + [HEADER, ...rows].map((row) => row.map(field).join(';')).join('\r\n') + '\r\n';
}
