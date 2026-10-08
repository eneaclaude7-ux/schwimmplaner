import { describe, expect, it } from 'vitest';
import {
	checkSplits,
	detectInterval,
	halves,
	halvesLabel,
	parseSplits,
	segments,
	splitDistances,
	splitIntervals,
	splitsText,
	splitsToValues,
	valuesToSplits
} from './splits';

// Beispiel aus docs/04-datenmodell.md: 200 m Brust in 2:29.80
const splits = [
	{ distance: 50, cumulative: 3420 },
	{ distance: 100, cumulative: 7230 },
	{ distance: 150, cumulative: 11090 }
];

describe('Abstände', () => {
	it('25 m nur auf der Kurzbahn, 100 m erst ab 400 m', () => {
		expect(splitIntervals(50, 'SCM')).toEqual([25]);
		expect(splitIntervals(50, 'LCM')).toEqual([]);
		expect(splitIntervals(200, 'SCM')).toEqual([25, 50]);
		expect(splitIntervals(200, 'LCM')).toEqual([50]);
		expect(splitIntervals(400, 'LCM')).toEqual([50, 100]);
	});

	it('Distanzen vor dem Ziel', () => {
		expect(splitDistances(200, 50)).toEqual([50, 100, 150]);
		expect(splitDistances(50, 25)).toEqual([25]);
	});

	it('erkennt den Abstand gespeicherter Splits', () => {
		expect(detectInterval(splits, 200, 'SCM')).toBe(50);
		expect(detectInterval([{ distance: 25, cumulative: 1500 }], 100, 'SCM')).toBe(25);
		expect(detectInterval([], 100, 'SCM')).toBe(50);
		expect(detectInterval([], 50, 'SCM')).toBe(25);
		expect(detectInterval([], 50, 'LCM')).toBeUndefined();
	});
});

describe('Auswertung', () => {
	it('rechnet Laps und Anteile, letzte Lap bis zur Endzeit', () => {
		const result = segments(splits, 200, 14980);
		expect(result.map((s) => s.lap)).toEqual([3420, 3810, 3860, 3890]);
		expect(result.map((s) => [s.from, s.to])).toEqual([
			[0, 50],
			[50, 100],
			[100, 150],
			[150, 200]
		]);
		expect(result.reduce((sum, s) => sum + s.share, 0)).toBeCloseTo(100);
	});

	it('überspringt fehlende Splits: der Abschnitt wird länger', () => {
		const result = segments([{ distance: 100, cumulative: 7230 }], 200, 14980);
		expect(result.map((s) => [s.from, s.to, s.lap])).toEqual([
			[0, 100, 7230],
			[100, 200, 7750]
		]);
	});

	it('erkennt Positive und Negative Split', () => {
		const h = halves(splits, 200, 14980)!;
		expect(h).toEqual({ first: 7230, second: 7750, diff: 520 });
		expect(halvesLabel(h)).toBe('Positive Split, zweite Hälfte +5.20 s langsamer');
		expect(halvesLabel(halves([{ distance: 50, cumulative: 3100 }], 100, 6100)!)).toBe(
			'Negative Split, zweite Hälfte −1.00 s schneller'
		);
		expect(halves([{ distance: 50, cumulative: 3420 }], 200, 14980)).toBeUndefined();
	});
});

describe('checkSplits', () => {
	it('ist still bei plausiblen Zeiten', () => {
		expect(checkSplits(splits, 200, 14980)).toEqual([]);
	});

	it('warnt bei fallenden Zeiten und Zeiten nach der Endzeit', () => {
		expect(
			checkSplits(
				[
					{ distance: 50, cumulative: 3420 },
					{ distance: 100, cumulative: 3400 },
					{ distance: 150, cumulative: 15000 }
				],
				200,
				14980
			)
		).toEqual([
			'Die Zwischenzeit bei 100 m ist nicht grösser als die bei 50 m.',
			'Die Zwischenzeit bei 150 m ist nicht kleiner als die Endzeit.'
		]);
	});

	it('Split bei der vollen Distanz muss gleich der Endzeit sein', () => {
		expect(checkSplits([{ distance: 200, cumulative: 14980 }], 200, 14980)).toEqual([]);
		expect(checkSplits([{ distance: 200, cumulative: 14900 }], 200, 14980)).toEqual([
			'Die Zwischenzeit bei 200 m ist nicht gleich der Endzeit.'
		]);
	});
});

describe('parseSplits', () => {
	it('liest Zeiten ab Start, leere Felder sind erlaubt', () => {
		const result = parseSplits(
			{ mode: 'cumulative', interval: 50, values: { 50: '34.20', 100: '', 150: '1:50.90' } },
			200,
			14980
		);
		expect(result).toEqual({
			ok: true,
			splits: [
				{ distance: 50, cumulative: 3420 },
				{ distance: 150, cumulative: 11090 }
			],
			warnings: []
		});
	});

	it('rechnet Laps in kumulierte Zeiten um und prüft die Summe', () => {
		const values = { 50: '34.20', 100: '38.10', 150: '38.60', 200: '38.90' };
		expect(parseSplits({ mode: 'laps', interval: 50, values }, 200, 14980)).toEqual({
			ok: true,
			splits,
			warnings: []
		});
		const off = parseSplits({ mode: 'laps', interval: 50, values }, 200, 14990);
		expect(off.ok && off.warnings).toEqual(['Die Laps ergeben 2:29.80, die Endzeit ist 2:29.90.']);
	});

	it('meldet unlesbare Zeiten und unvollständige Laps', () => {
		expect(
			parseSplits({ mode: 'cumulative', interval: 50, values: { 50: '3x' } }, 100, 7000)
		).toEqual({ ok: false, errors: { 50: 'Zeit nicht lesbar. Beispiel: 34.20' } });
		expect(parseSplits({ mode: 'laps', interval: 50, values: { 50: '34.20' } }, 100, 7000)).toEqual(
			{ ok: false, errors: { 100: 'Bitte alle Laps eingeben oder alle leer lassen.' } }
		);
		expect(parseSplits({ mode: 'laps', interval: 50, values: {} }, 100, 7000)).toEqual({
			ok: true,
			splits: [],
			warnings: []
		});
	});
});

describe('Umrechnen zwischen den Eingabearten', () => {
	it('kumuliert -> Laps -> kumuliert', () => {
		const laps = splitsToValues(splits, { mode: 'laps', interval: 50 }, 200, 14980);
		expect(laps).toEqual({ 50: '34.20', 100: '38.10', 150: '38.60', 200: '38.90' });
		expect(valuesToSplits({ mode: 'laps', interval: 50, values: laps }, 200)).toEqual(splits);
		expect(splitsToValues(splits, { mode: 'cumulative', interval: 50 }, 200)).toEqual({
			50: '34.20',
			100: '1:12.30',
			150: '1:50.90'
		});
	});

	it('Laps brechen bei einer Lücke ab', () => {
		const partial = [{ distance: 100, cumulative: 7230 }];
		expect(splitsToValues(partial, { mode: 'laps', interval: 50 }, 200, 14980)).toEqual({});
	});

	it('Text für den CSV-Export', () => {
		expect(splitsText(splits)).toBe('50 m 34.20 | 100 m 1:12.30 | 150 m 1:50.90');
	});
});
