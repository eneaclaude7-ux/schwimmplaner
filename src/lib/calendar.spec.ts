import { describe, expect, it } from 'vitest';
import {
	addMonths,
	calendarItems,
	isMonth,
	layoutWeek,
	monthLabel,
	monthWeeks,
	nextCompetition,
	nextDeadline
} from './calendar';
import { addDays, weekday } from './dates';
import type { Competition } from './model';

const competition = (
	id: string,
	startDate: string,
	endDate?: string,
	entryDeadline?: string
): Competition => ({
	id,
	name: id,
	startDate,
	endDate,
	entryDeadline,
	location: 'Chur',
	course: 'SCM',
	createdAt: '',
	updatedAt: ''
});

describe('Monate', () => {
	it('prüft und rechnet Monate', () => {
		expect(isMonth('2026-10')).toBe(true);
		expect(isMonth('2026-13')).toBe(false);
		expect(addMonths('2026-12', 1)).toBe('2027-01');
		expect(addMonths('2026-01', -1)).toBe('2025-12');
		expect(addMonths('2026-10', -14)).toBe('2025-08');
	});

	it('schreibt den Monat aus', () => {
		expect(monthLabel('2026-10')).toBe('Oktober 2026');
		expect(monthLabel('2027-03')).toBe('März 2027');
	});

	it('Wochentag und Tage addieren', () => {
		expect(weekday('2026-10-05')).toBe(0); // Montag
		expect(weekday('2026-10-11')).toBe(6); // Sonntag
		expect(addDays('2026-10-31', 1)).toBe('2026-11-01');
		expect(addDays('2026-03-01', -1)).toBe('2026-02-28');
	});
});

describe('monthWeeks', () => {
	it('Oktober 2026: beginnt am Montag 28.9., endet am Sonntag 1.11.', () => {
		const weeks = monthWeeks('2026-10');
		expect(weeks).toHaveLength(5);
		expect(weeks[0][0]).toBe('2026-09-28');
		expect(weeks.at(-1)![6]).toBe('2026-11-01');
		expect(weeks.every((w) => w.length === 7)).toBe(true);
	});

	it('Februar 2027 beginnt an einem Montag und hat genau 4 Wochen', () => {
		expect(monthWeeks('2027-02')).toHaveLength(4);
		expect(monthWeeks('2027-02')[0][0]).toBe('2027-02-01');
	});
});

describe('layoutWeek', () => {
	const week = monthWeeks('2026-10')[1]; // 5.10. bis 11.10.

	it('mehrtägig als ein Balken, Meldeschluss als eigener Eintrag', () => {
		const placed = layoutWeek(
			week,
			calendarItems([competition('A', '2026-10-09', '2026-10-11', '2026-10-05')])
		);
		expect(placed.map((p) => [p.item.key, p.col, p.span, p.lane])).toEqual([
			['d-A', 0, 1, 0],
			['c-A', 4, 3, 0]
		]);
	});

	it('überlappende Einträge kommen in verschiedene Zeilen', () => {
		const placed = layoutWeek(
			week,
			calendarItems([
				competition('A', '2026-10-06', '2026-10-08'),
				competition('B', '2026-10-07'),
				competition('C', '2026-10-09')
			])
		);
		expect(placed.map((p) => [p.item.key, p.lane])).toEqual([
			['c-A', 0],
			['c-B', 1],
			['c-C', 0]
		]);
	});

	it('Balken über die Wochengrenze werden abgeschnitten und markiert', () => {
		const [placed] = layoutWeek(
			week,
			calendarItems([competition('A', '2026-10-03', '2026-10-06')])
		);
		expect(placed).toMatchObject({ col: 0, span: 2, continuesBefore: true, continuesAfter: false });
		const [next] = layoutWeek(week, calendarItems([competition('B', '2026-10-10', '2026-10-13')]));
		expect(next).toMatchObject({ col: 5, span: 2, continuesBefore: false, continuesAfter: true });
	});

	it('ignoriert Einträge ausserhalb der Woche', () => {
		expect(layoutWeek(week, calendarItems([competition('A', '2026-10-20')]))).toEqual([]);
	});
});

describe('nextDeadline', () => {
	const list = [
		competition('Vorbei', '2026-10-20', undefined, '2026-10-01'),
		competition('Später', '2026-11-20', undefined, '2026-11-02'),
		competition('Bald', '2026-10-25', undefined, '2026-10-12'),
		competition('Ohne', '2026-10-30')
	];

	it('findet den nächsten offenen Meldeschluss über alle Monate', () => {
		expect(nextDeadline(list, '2026-10-09')?.name).toBe('Bald');
		expect(nextDeadline(list, '2026-10-12')?.name).toBe('Bald');
		expect(nextDeadline(list, '2026-10-13')?.name).toBe('Später');
	});

	it('gibt undefined, wenn kein Meldeschluss mehr offen ist', () => {
		expect(nextDeadline(list, '2026-11-03')).toBeUndefined();
		expect(nextDeadline([], '2026-10-09')).toBeUndefined();
	});
});

describe('nextCompetition', () => {
	const list = [
		competition('Vorbei', '2026-10-01'),
		competition('Läuft', '2026-10-08', '2026-10-10'),
		competition('Später', '2026-11-20'),
		competition('Bald', '2026-10-17')
	];

	it('nimmt den nächsten Wettkampf, auch einen, der gerade läuft', () => {
		expect(nextCompetition(list, '2026-10-09')?.name).toBe('Läuft');
		expect(nextCompetition(list, '2026-10-11')?.name).toBe('Bald');
	});

	it('gibt undefined, wenn keiner mehr kommt', () => {
		expect(nextCompetition(list, '2026-12-01')).toBeUndefined();
	});
});
