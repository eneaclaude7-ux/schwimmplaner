import { describe, expect, it } from 'vitest';
import {
	datesInRange,
	daysBetween,
	formatDate,
	formatDateRange,
	isIsoDate,
	relativeDays,
	todayIso
} from './dates';

describe('isIsoDate', () => {
	it('akzeptiert gültige Tage und lehnt unmögliche ab', () => {
		expect(isIsoDate('2026-09-26')).toBe(true);
		expect(isIsoDate('2028-02-29')).toBe(true);
		expect(isIsoDate('2026-02-29')).toBe(false);
		expect(isIsoDate('26.09.2026')).toBe(false);
		expect(isIsoDate('')).toBe(false);
	});
});

describe('todayIso', () => {
	it('nimmt das lokale Datum', () => {
		expect(todayIso(new Date(2026, 9, 7, 23, 30))).toBe('2026-10-07');
	});
});

describe('daysBetween', () => {
	it('zählt Tage, auch über die Zeitumstellung', () => {
		expect(daysBetween('2026-10-07', '2026-10-12')).toBe(5);
		expect(daysBetween('2026-10-20', '2026-10-30')).toBe(10);
		expect(daysBetween('2026-10-12', '2026-10-07')).toBe(-5);
	});
});

describe('Formatierung', () => {
	it('formatiert Schweizer Datum', () => {
		expect(formatDate('2026-09-26')).toBe('26.09.2026');
		expect(formatDateRange('2026-11-14')).toBe('14.11.2026');
		expect(formatDateRange('2026-11-14', '2026-11-15')).toBe('14.11.2026 – 15.11.2026');
	});

	it('beschreibt Abstände in Worten', () => {
		expect(relativeDays(-1)).toBe('vorbei');
		expect(relativeDays(0)).toBe('heute');
		expect(relativeDays(1)).toBe('morgen');
		expect(relativeDays(5)).toBe('in 5 Tagen');
	});
});

describe('datesInRange', () => {
	it('liefert alle Wettkampftage', () => {
		expect(datesInRange('2026-11-14')).toEqual(['2026-11-14']);
		expect(datesInRange('2026-11-14', '2026-11-16')).toEqual([
			'2026-11-14',
			'2026-11-15',
			'2026-11-16'
		]);
	});
});
