import { describe, expect, it } from 'vitest';
import { backupDue, createBackup, lastBackupText, parseBackup, type AppData } from './backup';

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

describe('Erinnerung ans Backup', () => {
	const now = new Date('2026-10-20T12:00:00.000Z');
	const daysAgo = (days: number) => new Date(now.getTime() - days * 86_400_000).toISOString();

	it('erinnert nicht, solange es keine Daten gibt', () => {
		expect(backupDue([], undefined, now)).toBe(false);
	});

	it('erinnert, wenn eine Änderung 7 Tage alt ist und es kein Backup gibt', () => {
		expect(backupDue([{ updatedAt: daysAgo(7) }], undefined, now)).toBe(true);
	});

	it('wartet bei frischen Änderungen, damit nicht jeder Eintrag eine Meldung bringt', () => {
		expect(backupDue([{ updatedAt: daysAgo(6) }], undefined, now)).toBe(false);
	});

	it('erinnert nicht, wenn das Backup nach der Änderung kam', () => {
		expect(backupDue([{ updatedAt: daysAgo(10) }], daysAgo(9), now)).toBe(false);
	});

	it('erinnert, wenn eine Änderung nach dem Backup 7 Tage alt ist', () => {
		const records = [{ updatedAt: daysAgo(20) }, { updatedAt: daysAgo(8) }];
		expect(backupDue(records, daysAgo(15), now)).toBe(true);
	});

	it('wartet nach einem alten Backup, bis die neue Änderung 7 Tage alt ist', () => {
		expect(backupDue([{ updatedAt: daysAgo(1) }], daysAgo(30), now)).toBe(false);
	});

	it('beschreibt das Alter des letzten Backups', () => {
		expect(lastBackupText(undefined, now)).toBe('Noch kein Backup');
		expect(lastBackupText(daysAgo(0), now)).toBe('Letztes Backup heute');
		expect(lastBackupText(daysAgo(1), now)).toBe('Letztes Backup gestern');
		expect(lastBackupText(daysAgo(12), now)).toBe('Letztes Backup vor 12 Tagen');
	});
});
