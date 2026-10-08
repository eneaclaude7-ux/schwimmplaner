// Zwischenzeiten (Splits). Gespeichert werden sie kumuliert wie in Lenex,
// Lap-Zeiten, Hälften und Anteile werden berechnet (siehe docs/04-datenmodell.md).
import type { Course, Hs, Split } from './model';
import { formatDiff, formatTime, parseTime } from './time';

/** Abstände der Zwischenzeiten: 25 m nur auf der Kurzbahn (dort ist eine Wende), 100 m erst ab 400 m */
export function splitIntervals(distance: number, course: Course): number[] {
	return [25, 50, 100].filter(
		(i) =>
			i < distance &&
			distance % i === 0 &&
			(i !== 25 || course === 'SCM') &&
			(i !== 100 || distance >= 400)
	);
}

/** Distanzen der Zwischenzeiten vor dem Ziel: 200 m alle 50 m -> 50, 100, 150 */
export function splitDistances(distance: number, interval: number): number[] {
	return Array.from({ length: distance / interval - 1 }, (_, i) => (i + 1) * interval);
}

/** Abstand, der zu gespeicherten Splits passt; ohne Splits 50 m, wenn möglich */
export function detectInterval(
	splits: Split[],
	distance: number,
	course: Course
): number | undefined {
	const options = splitIntervals(distance, course);
	const fitting = options.filter((i) => splits.every((s) => s.distance % i === 0));
	if (splits.length > 0 && fitting.length > 0) return fitting.at(-1);
	return options.includes(50) ? 50 : options[0];
}

/** Ein Abschnitt des Rennens, z. B. 50–100 m */
export interface Segment {
	from: number;
	to: number;
	/** Zeit ab Start bis zum Ende des Abschnitts */
	cumulative: Hs;
	/** Zeit für diesen Abschnitt */
	lap: Hs;
	/** Anteil an der Endzeit in Prozent */
	share: number;
}

/** Abschnitte von Split zu Split, der letzte endet mit der Endzeit */
export function segments(splits: Split[], distance: number, result: Hs): Segment[] {
	const points = splits
		.filter((s) => s.distance < distance)
		.sort((a, b) => a.distance - b.distance)
		.concat({ distance, cumulative: result });
	let previous: Split = { distance: 0, cumulative: 0 };
	return points.map((point) => {
		const lap = point.cumulative - previous.cumulative;
		const segment = {
			from: previous.distance,
			to: point.distance,
			cumulative: point.cumulative,
			lap,
			share: (lap / result) * 100
		};
		previous = point;
		return segment;
	});
}

export interface Halves {
	first: Hs;
	second: Hs;
	/** Zweite minus erste Hälfte: negativ = Negative Split (hinten schneller) */
	diff: Hs;
}

/** Erste und zweite Hälfte, nur wenn es eine Zwischenzeit bei der halben Strecke gibt */
export function halves(splits: Split[], distance: number, result: Hs): Halves | undefined {
	const half = splits.find((s) => s.distance === distance / 2);
	if (!half) return undefined;
	const second = result - half.cumulative;
	return { first: half.cumulative, second, diff: second - half.cumulative };
}

export function halvesLabel(h: Halves): string {
	if (h.diff < 0) return `Negative Split, zweite Hälfte ${formatDiff(h.diff)} schneller`;
	if (h.diff > 0) return `Positive Split, zweite Hälfte ${formatDiff(h.diff)} langsamer`;
	return 'Beide Hälften gleich schnell';
}

/** Ein Abschnitt im Vergleich zweier Rennen derselben Strecke */
export interface ComparedSegment {
	from: number;
	to: number;
	lapA: Hs;
	lapB: Hs;
	/** B minus A: negativ = B war in diesem Abschnitt schneller */
	lapDiff: Hs;
	cumulativeA: Hs;
	cumulativeB: Hs;
	/** Rückstand oder Vorsprung von B bei dieser Distanz */
	cumulativeDiff: Hs;
}

/**
 * Vergleicht zwei Rennen Abschnitt für Abschnitt. Verglichen wird nur bei Distanzen,
 * an denen beide eine Zwischenzeit haben; sonst wären die Abschnitte verschieden lang.
 */
export function compareSplits(
	a: { splits: Split[]; result: Hs },
	b: { splits: Split[]; result: Hs },
	distance: number
): ComparedSegment[] {
	const common = new Set(
		a.splits
			.filter((s) => s.distance < distance && b.splits.some((t) => t.distance === s.distance))
			.map((s) => s.distance)
	);
	const segA = segments(
		a.splits.filter((s) => common.has(s.distance)),
		distance,
		a.result
	);
	const segB = segments(
		b.splits.filter((s) => common.has(s.distance)),
		distance,
		b.result
	);
	return segA.map((sa, i) => {
		const sb = segB[i];
		return {
			from: sa.from,
			to: sa.to,
			lapA: sa.lap,
			lapB: sb.lap,
			lapDiff: sb.lap - sa.lap,
			cumulativeA: sa.cumulative,
			cumulativeB: sb.cumulative,
			cumulativeDiff: sb.cumulative - sa.cumulative
		};
	});
}

/** Plausibilitätsprüfung. Nur Warnungen: speichern darf man trotzdem. */
export function checkSplits(splits: Split[], distance: number, result?: Hs): string[] {
	const warnings: string[] = [];
	const sorted = [...splits].sort((a, b) => a.distance - b.distance);
	sorted.forEach((s, i) => {
		const before = sorted[i - 1];
		if (before && s.cumulative <= before.cumulative) {
			warnings.push(
				`Die Zwischenzeit bei ${s.distance} m ist nicht grösser als die bei ${before.distance} m.`
			);
		}
		if (s.distance > distance) {
			warnings.push(`Die Zwischenzeit bei ${s.distance} m liegt hinter dem Ziel.`);
		} else if (s.distance === distance) {
			if (result !== undefined && s.cumulative !== result) {
				warnings.push(`Die Zwischenzeit bei ${s.distance} m ist nicht gleich der Endzeit.`);
			}
		} else if (result !== undefined && s.cumulative >= result) {
			warnings.push(`Die Zwischenzeit bei ${s.distance} m ist nicht kleiner als die Endzeit.`);
		}
	});
	return warnings;
}

/** Eingabe im Formular: entweder Zeiten ab Start oder einzelne Lap-Zeiten */
export type SplitMode = 'cumulative' | 'laps';

export interface SplitInput {
	mode: SplitMode;
	interval: number;
	/** Text pro Feld, Schlüssel ist die Distanz am Ende des Abschnitts */
	values: Record<number, string>;
}

/** Feld-Schlüssel: kumuliert ohne Ziel, Laps mit der letzten Lap bis ins Ziel */
export function fieldKeys(
	input: Pick<SplitInput, 'mode' | 'interval'>,
	distance: number
): number[] {
	const points = splitDistances(distance, input.interval);
	return input.mode === 'laps' ? [...points, distance] : points;
}

export type SplitResult =
	{ ok: true; splits: Split[]; warnings: string[] } | { ok: false; errors: Record<number, string> };

export function parseSplits(input: SplitInput, distance: number, result?: Hs): SplitResult {
	const keys = fieldKeys(input, distance);
	const texts = keys.map((k) => input.values[k]?.trim() ?? '');
	const errors: Record<number, string> = {};
	const splits: Split[] = [];
	const warnings: string[] = [];

	if (input.mode === 'cumulative') {
		keys.forEach((k, i) => {
			if (!texts[i]) return;
			const time = parseTime(texts[i]);
			if (time === null) errors[k] = 'Zeit nicht lesbar. Beispiel: 34.20';
			else splits.push({ distance: k, cumulative: time });
		});
	} else if (texts.some(Boolean)) {
		// Laps lassen sich nur aufsummieren, wenn alle da sind
		let sum = 0;
		keys.forEach((k, i) => {
			const time = texts[i] ? parseTime(texts[i]) : null;
			if (!texts[i]) errors[k] = 'Bitte alle Laps eingeben oder alle leer lassen.';
			else if (time === null) errors[k] = 'Zeit nicht lesbar. Beispiel: 34.20';
			else {
				sum += time;
				if (k < distance) splits.push({ distance: k, cumulative: sum });
			}
		});
		if (result !== undefined && Object.keys(errors).length === 0 && sum !== result) {
			warnings.push(`Die Laps ergeben ${formatTime(sum)}, die Endzeit ist ${formatTime(result)}.`);
		}
	}

	if (Object.keys(errors).length > 0) return { ok: false, errors };
	return { ok: true, splits, warnings: [...warnings, ...checkSplits(splits, distance, result)] };
}

/** Splits als Formularfelder, z. B. nach dem Wechsel zwischen Zeiten ab Start und Laps */
export function splitsToValues(
	splits: Split[],
	input: Pick<SplitInput, 'mode' | 'interval'>,
	distance: number,
	result?: Hs
): Record<number, string> {
	const byDistance = new Map(splits.map((s) => [s.distance, s.cumulative]));
	if (result !== undefined) byDistance.set(distance, result);
	const values: Record<number, string> = {};
	let previous = 0;
	for (const key of fieldKeys(input, distance)) {
		const cumulative = byDistance.get(key);
		if (cumulative === undefined) {
			// Ohne diese Zwischenzeit lässt sich die nächste Lap nicht berechnen
			if (input.mode === 'laps') break;
			continue;
		}
		values[key] = formatTime(input.mode === 'laps' ? cumulative - previous : cumulative);
		previous = cumulative;
	}
	return values;
}

/** Was sich aus den Feldern lesen lässt, ohne Fehlermeldungen (für den Wechsel der Eingabeart) */
export function valuesToSplits(input: SplitInput, distance: number): Split[] {
	const splits: Split[] = [];
	let sum = 0;
	for (const key of fieldKeys(input, distance)) {
		const time = parseTime(input.values[key] ?? '');
		if (input.mode === 'cumulative') {
			if (time !== null) splits.push({ distance: key, cumulative: time });
			continue;
		}
		if (time === null) break;
		sum += time;
		if (key < distance) splits.push({ distance: key, cumulative: sum });
	}
	return splits;
}

/** "50 m 34.20 | 100 m 1:12.30" für den CSV-Export */
export function splitsText(splits: Split[]): string {
	return [...splits]
		.sort((a, b) => a.distance - b.distance)
		.map((s) => `${s.distance} m ${formatTime(s.cumulative)}`)
		.join(' | ');
}
