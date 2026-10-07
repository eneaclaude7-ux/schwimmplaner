import { describe, expect, it } from 'vitest';
import { createBackup, parseBackup, type AppData } from './backup';

const t = '2026-10-07T20:00:00.000Z';
const data: AppData = {
	athletes: [{ id: 'a1', name: 'Ich', createdAt: t, updatedAt: t }],
	competitions: [
		{
			id: 'c1',
			name: 'Bündner Meisterschaften',
			startDate: '2026-11-14',
			location: 'Chur',
			course: 'SCM',
			createdAt: t,
			updatedAt: t
		}
	],
	races: [
		{
			id: 'r1',
			athleteId: 'a1',
			competitionId: 'c1',
			date: '2026-11-14',
			stroke: 'BREAST',
			distance: 100,
			target: 6900,
			result: 6920,
			status: 'finished',
			splits: [{ distance: 50, cumulative: 3260 }],
			createdAt: t,
			updatedAt: t
		}
	],
	seasons: [{ id: 's1', name: '2026/27', startDate: '2026-09-26', createdAt: t, updatedAt: t }]
};

describe('Backup', () => {
	it('liest ein exportiertes Backup unverändert wieder ein', () => {
		const text = JSON.stringify(createBackup(data, new Date(t)));
		const result = parseBackup(text);
		expect(result.ok).toBe(true);
		if (result.ok) expect(result.backup).toEqual({ schemaVersion: 1, exportedAt: t, ...data });
	});

	it('lehnt kaputte oder fremde Dateien ab', () => {
		expect(parseBackup('{kaputt')).toEqual({
			ok: false,
			error: 'Die Datei ist kein gültiges JSON.'
		});
		expect(parseBackup('[]').ok).toBe(false);
		expect(parseBackup('{"schemaVersion": 2}').ok).toBe(false);
	});

	it('nennt den ungültigen Eintrag', () => {
		const broken = { ...createBackup(data), races: [{ ...data.races[0], result: 69.2 }] };
		expect(parseBackup(JSON.stringify(broken))).toEqual({
			ok: false,
			error: 'Läufe, Eintrag 1: Feld "result" ist ungültig.'
		});
	});

	it('lehnt Läufe ohne Wettkampf ab', () => {
		const broken = { ...createBackup(data), competitions: [] };
		expect(parseBackup(JSON.stringify(broken)).ok).toBe(false);
	});
});
