import { describe, expect, it } from 'vitest';
import { racesToCsv } from './csv';
import type { Competition, Course, Race, Season } from './model';
import {
	bestBeforeDate,
	bestMarks,
	buildHistories,
	formatPercent,
	personalBest,
	seasonBest
} from './stats';

const competition = (id: string, course: Course, name = id): Competition => ({
	id,
	name,
	startDate: '2026-01-01',
	location: 'Chur',
	course,
	createdAt: '',
	updatedAt: ''
});

let created = 0;
const race = (
	id: string,
	competitionId: string,
	date: string,
	result?: number,
	extra: Partial<Race> = {}
): Race => ({
	id,
	athleteId: 'a',
	competitionId,
	date,
	stroke: 'BREAST',
	distance: 100,
	result,
	status: result === undefined ? 'planned' : 'finished',
	splits: [],
	createdAt: String(created++).padStart(4, '0'),
	updatedAt: '',
	...extra
});

const season = (name: string, startDate: string): Season => ({
	id: name,
	name,
	startDate,
	createdAt: '',
	updatedAt: ''
});

const seasons = [season('2025/26', '2025-09-27'), season('2026/27', '2026-09-26')];
const competitions = [competition('kb', 'SCM'), competition('lb', 'LCM')];

describe('buildHistories', () => {
	const races = [
		race('r3', 'kb', '2026-10-10', 7100),
		race('r1', 'kb', '2026-03-01', 7040),
		race('r2', 'kb', '2026-06-01', 6920),
		race('lang', 'lb', '2026-07-01', 7300),
		race('geplant', 'kb', '2026-11-01'),
		race('dsq', 'kb', '2026-05-01', undefined, { status: 'dsq' })
	];
	const histories = buildHistories(races, competitions, seasons);
	const scm = histories.find((h) => h.course === 'SCM')!;

	it('trennt Kurz- und Langbahn', () => {
		expect(histories.map((h) => h.key)).toEqual(['BREAST-100-LCM', 'BREAST-100-SCM']);
	});

	it('zählt nur geschwommene Läufe, chronologisch', () => {
		expect(scm.entries.map((e) => e.race.id)).toEqual(['r1', 'r2', 'r3']);
	});

	it('rechnet letzte Zeit und Bestzeit davor', () => {
		const [first, second, third] = scm.entries;
		expect(first.previous).toBeUndefined();
		expect(first.bestBefore).toBeUndefined();
		expect(second.previous).toBe(7040);
		expect(third.previous).toBe(6920);
		expect(third.bestBefore).toBe(6920);
	});

	it('findet Bestzeit, Saisonbestzeit und Bestzeit vor Saisonstart', () => {
		const h = scm;
		expect(personalBest(h)?.race.id).toBe('r2');
		expect(seasonBest(h, seasons[1])?.race.id).toBe('r3');
		expect(seasonBest(h, seasons[0])?.race.id).toBe('r2');
		expect(bestBeforeDate(h, '2026-09-26')).toBe(6920);
		expect(bestBeforeDate(h, '2026-01-01')).toBeUndefined();
	});

	it('bei gleicher Zeit gilt die zuerst geschwommene als Bestzeit', () => {
		const tie = buildHistories(
			[race('b', 'kb', '2026-05-01', 7000), race('a', 'kb', '2026-04-01', 7000)],
			competitions,
			seasons
		);
		expect(personalBest(tie[0])?.race.id).toBe('a');
	});

	it('markiert Bestzeit und Saisonbestzeiten', () => {
		const { pb, sb } = bestMarks(histories);
		expect([...pb].sort()).toEqual(['lang', 'r2']);
		expect([...sb].sort()).toEqual(['lang', 'r2', 'r3']);
	});
});

describe('formatPercent', () => {
	it('rechnet mit der alten Zeit als Basis', () => {
		expect(formatPercent(-120, 7040)).toBe('−1.7 %');
		expect(formatPercent(180, 6920)).toBe('+2.6 %');
		expect(formatPercent(0, 6920)).toBe('±0.0 %');
		expect(formatPercent(-1, 100000)).toBe('±0.0 %');
	});
});

describe('racesToCsv', () => {
	it('schreibt Kopfzeile, Semikolons und Bestzeit-Markierung', () => {
		const csv = racesToCsv(
			[
				race('x', 'kb', '2026-10-10', 6920, {
					target: 7000,
					splits: [{ distance: 50, cumulative: 3310 }]
				})
			],
			competitions,
			seasons
		);
		expect(csv.startsWith('\uFEFFDatum;Wettkampf;')).toBe(true);
		const line = csv.trim().split('\r\n')[1];
		expect(line).toBe(
			'10.10.2026;kb;Chur;Kurzbahn (25 m);2026/27;Brust;100;geschwommen;1:10.00;1:09.20;−0.80 s;ja;ja;50 m 33.10'
		);
	});

	it('maskiert Anführungszeichen, Semikolons und Formeln', () => {
		const csv = racesToCsv(
			[race('x', 'f', '2026-10-10', 6920)],
			[competition('f', 'SCM', '=HYPERLINK("x";"y")')],
			seasons
		);
		expect(csv).toContain(`"'=HYPERLINK(""x"";""y"")"`);
	});
});
