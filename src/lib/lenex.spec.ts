// @vitest-environment jsdom
// jsdom liefert den DOMParser, den im Browser die Seite selbst hat
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { zipSync } from 'fflate';
import { describe, expect, it } from 'vitest';
import {
	isSameCompetition,
	mapStatus,
	parseLenex,
	parseSwimTime,
	planImport,
	readLenexFile,
	type LenexMeet
} from './lenex';
import type { Competition, Race } from './model';

// Selbst geschriebene Datei mit erfundenen Personen, keine echten Daten
const bytes = new Uint8Array(readFileSync(join(import.meta.dirname, 'fixtures/beispiel.lef')));
const xml = new TextDecoder().decode(bytes);

function meetOf(text: string): LenexMeet {
	const result = parseLenex(text);
	if (!result.ok) throw new Error(result.error);
	return result.meets[0];
}

describe('parseSwimTime', () => {
	it('liest Lenex-Zeiten in Hundertstel', () => {
		expect(parseSwimTime('00:01:09.20')).toBe(6920);
		expect(parseSwimTime('00:00:28.15')).toBe(2815);
		expect(parseSwimTime('00:16:02.07')).toBe(96207);
	});

	it('gibt null ohne gültige Zeit', () => {
		expect(parseSwimTime('NT')).toBeNull();
		expect(parseSwimTime('')).toBeNull();
		expect(parseSwimTime(null)).toBeNull();
		expect(parseSwimTime('1:09.20')).toBeNull();
		expect(parseSwimTime('00:01:75.00')).toBeNull();
	});
});

describe('mapStatus', () => {
	it('bildet die Lenex-Codes auf den Status ab', () => {
		expect(mapStatus('')).toBe('finished');
		expect(mapStatus(null)).toBe('finished');
		expect(mapStatus('EXH')).toBe('finished');
		expect(mapStatus('DSQ')).toBe('dsq');
		expect(mapStatus('DNS')).toBe('dns');
		expect(mapStatus('SICK')).toBe('dns');
		expect(mapStatus('WDR')).toBe('dns');
		expect(mapStatus('DNF')).toBe('dnf');
		expect(mapStatus('XYZ')).toBeNull();
	});
});

describe('parseLenex', () => {
	it('bildet MEET auf einen Wettkampf ab', () => {
		expect(meetOf(xml).competition).toEqual({
			name: 'Testmeeting Musterstadt',
			location: 'Musterstadt',
			startDate: '2026-11-14',
			endDate: '2026-11-15',
			entryDeadline: '2026-11-01',
			course: 'SCM'
		});
	});

	it('zeigt nur Athleten mit Resultaten, nach Name sortiert', () => {
		const athletes = meetOf(xml).athletes.map(({ name, birthYear, club }) => ({
			name,
			birthYear,
			club
		}));
		expect(athletes).toEqual([
			{ name: 'Beispiel, Lea', birthYear: '2012', club: 'Schwimmverein Testdorf' },
			{ name: 'Muster, Max', birthYear: '2011', club: 'Schwimmclub Bärenstadt' }
		]);
	});

	it('bildet RESULT auf Läufe ab, mit kumulierten Splits', () => {
		const max = meetOf(xml).athletes.find((a) => a.name === 'Muster, Max')!;
		expect(max.races).toEqual([
			{
				stroke: 'BREAST',
				distance: 100,
				date: '2026-11-14',
				status: 'finished',
				result: 6920,
				splits: [{ distance: 50, cumulative: 3260 }]
			},
			{
				stroke: 'FREE',
				distance: 50,
				date: '2026-11-14',
				status: 'finished',
				result: 2815,
				splits: [{ distance: 25, cumulative: 1340 }]
			},
			{
				// Splits sortiert, der Split im Ziel fällt weg (er ist die Endzeit)
				stroke: 'MEDLEY',
				distance: 200,
				date: '2026-11-15',
				status: 'finished',
				result: 15145,
				splits: [
					{ distance: 50, cumulative: 3310 },
					{ distance: 100, cumulative: 7230 },
					{ distance: 150, cumulative: 11780 }
				]
			},
			// Ohne Endzeit, auch wenn die Datei bei DSQ eine Zeit hat
			{ stroke: 'BACK', distance: 100, date: '2026-11-15', status: 'dsq', splits: [] },
			{ stroke: 'FLY', distance: 50, date: '2026-11-15', status: 'dns', splits: [] }
		]);
	});

	it('überspringt Strecken, die es im Schwimmplaner nicht gibt, und nimmt keine Staffeln', () => {
		const max = meetOf(xml).athletes.find((a) => a.name === 'Muster, Max')!;
		expect(max.skipped).toEqual([
			{ label: '25 m Freistil', reason: 'Diese Strecke kennt der Schwimmplaner nicht.' }
		]);
	});

	it('meldet kaputte und fremde Dateien', () => {
		expect(parseLenex('<LENEX><MEETS>')).toEqual({
			ok: false,
			error: 'Die Datei ist kein gültiges XML.'
		});
		expect(parseLenex('<html></html>')).toEqual({
			ok: false,
			error: 'Die Datei ist keine Lenex-Datei.'
		});
		expect(parseLenex('<LENEX><MEETS /></LENEX>')).toEqual({
			ok: false,
			error: 'Die Datei enthält keinen Wettkampf.'
		});
	});

	it('erkennt Ausschreibungen und Meldelisten ohne Resultate', () => {
		const entriesOnly = xml.replace(/<RESULTS>[\s\S]*?<\/RESULTS>/g, '');
		const result = parseLenex(entriesOnly);
		expect(result.ok).toBe(false);
		if (!result.ok) expect(result.error).toMatch(/keine Resultate/);
	});

	it('lehnt Yards und andere Becken ab', () => {
		const result = parseLenex(xml.replace('course="SCM"', 'course="SCY"'));
		expect(result).toEqual({
			ok: false,
			error: 'Testmeeting Musterstadt: Die Bahnlänge "SCY" wird nicht unterstützt, nur 25 und 50 m.'
		});
	});

	it('überspringt Läufe in einem Abschnitt mit anderer Bahnlänge', () => {
		const mixed = xml.replace(
			'<SESSION number="2" date="2026-11-15"',
			'<SESSION number="2" date="2026-11-15" course="LCM"'
		);
		const max = meetOf(mixed).athletes.find((a) => a.name === 'Muster, Max')!;
		expect(max.races.map((r) => r.date)).toEqual(['2026-11-14', '2026-11-14']);
		expect(max.skipped).toHaveLength(4);
	});
});

describe('readLenexFile', () => {
	it('liest .lef und .lxf gleich', () => {
		const lxf = zipSync({ 'readme.txt': new Uint8Array([1]), 'Resultate.LEF': bytes });
		const plain = readLenexFile(bytes);
		expect(plain.ok).toBe(true);
		expect(readLenexFile(lxf)).toEqual(plain);
	});

	it('meldet ZIP-Dateien ohne .lef und beschädigte Dateien', () => {
		expect(readLenexFile(zipSync({ 'a.txt': new Uint8Array([1]) }))).toEqual({
			ok: false,
			error: 'In der .lxf-Datei steckt keine .lef-Datei.'
		});
		const broken = zipSync({ 'a.lef': bytes }).slice(0, 100);
		expect(readLenexFile(broken)).toEqual({
			ok: false,
			error: 'Die .lxf-Datei ist beschädigt.'
		});
	});

	it('liest UTF-8 mit BOM', () => {
		const withBom = new Uint8Array([0xef, 0xbb, 0xbf, ...bytes]);
		expect(readLenexFile(withBom)).toEqual(readLenexFile(bytes));
	});

	it('liest ältere Dateien in ISO-8859-1', () => {
		const latin1 = xml.replace('encoding="UTF-8"', 'encoding="ISO-8859-1"');
		// Jedes Zeichen der Testdatei liegt unter 256, also ein Byte pro Zeichen
		const encoded = Uint8Array.from(latin1, (c) => c.charCodeAt(0));
		const result = readLenexFile(encoded);
		expect(result.ok && result.meets[0].athletes[1].club).toBe('Schwimmclub Bärenstadt');
	});
});

describe('planImport', () => {
	const t = '2026-10-08T20:00:00.000Z';
	const meet = meetOf(xml);
	const max = meet.athletes.find((a) => a.name === 'Muster, Max')!;
	const existing: Competition = {
		id: 'c1',
		name: '  testmeeting   Musterstadt ',
		startDate: '2026-11-14',
		location: 'Hallenbad Musterstadt',
		course: 'SCM',
		createdAt: t,
		updatedAt: t
	};
	const race = (values: Partial<Race>): Race => ({
		id: 'r',
		athleteId: 'a1',
		competitionId: 'c1',
		date: '2026-11-14',
		stroke: 'FREE',
		distance: 50,
		status: 'planned',
		splits: [],
		createdAt: t,
		updatedAt: t,
		...values
	});

	it('erkennt denselben Wettkampf an Name und Startdatum', () => {
		expect(isSameCompetition(existing, meet.competition)).toBe(true);
		expect(isSameCompetition({ ...existing, startDate: '2026-11-15' }, meet.competition)).toBe(
			false
		);
		expect(isSameCompetition({ ...existing, name: 'Anderes Meeting' }, meet.competition)).toBe(
			false
		);
	});

	it('legt einen neuen Wettkampf an, wenn es ihn noch nicht gibt', () => {
		const result = planImport(meet, max, [], []);
		expect(result.ok).toBe(true);
		if (!result.ok) return;
		expect(result.plan.existing).toBeUndefined();
		expect(result.plan.competition).toEqual(meet.competition);
		expect(result.plan.races.map((r) => r.action)).toEqual(['new', 'new', 'new', 'new', 'new']);
	});

	it('legt keinen zweiten Wettkampf an und erkennt schon erfasste Läufe', () => {
		const races = [
			race({ id: 'geplant', stroke: 'BREAST', distance: 100, target: 6900 }),
			race({ id: 'doppelt', stroke: 'FREE', distance: 50, status: 'finished', result: 2815 }),
			// Gehört zu einem anderen Wettkampf und zählt darum nicht
			race({ id: 'fremd', competitionId: 'c2', stroke: 'BACK', distance: 100, status: 'dsq' })
		];
		const result = planImport(meet, max, [existing], races);
		expect(result.ok).toBe(true);
		if (!result.ok) return;
		expect(result.plan.existing).toBe(existing);
		expect(result.plan.races.map((r) => [r.race.stroke, r.action, r.existingId])).toEqual([
			['BREAST', 'complete', 'geplant'],
			['FREE', 'duplicate', undefined],
			['MEDLEY', 'new', undefined],
			['BACK', 'new', undefined],
			['FLY', 'new', undefined]
		]);
		// Erfasst war nur ein Tag, die Datei hat zwei
		expect(result.plan.extendTo).toBe('2026-11-15');
	});

	it('liest dieselbe Datei ein zweites Mal ohne neue Läufe', () => {
		const first = planImport(meet, max, [], []);
		if (!first.ok) throw new Error(first.error);
		const saved = first.plan.races.map((p, i) => race({ ...p.race, id: `r${i}` }));
		const second = planImport(meet, max, [{ ...existing, endDate: '2026-11-15' }], saved);
		expect(second.ok && second.plan.races.every((r) => r.action === 'duplicate')).toBe(true);
		expect(second.ok && second.plan.extendTo).toBeUndefined();
	});

	it('bricht ab, wenn der erfasste Wettkampf eine andere Bahnlänge hat', () => {
		const result = planImport(meet, max, [{ ...existing, course: 'LCM' }], []);
		expect(result.ok).toBe(false);
	});
});
