import { describe, expect, it } from 'vitest';
import type { Season } from './model';
import { seasonForDate } from './seasons';

const season = (name: string, startDate: string): Season => ({
	id: name,
	name,
	startDate,
	createdAt: '',
	updatedAt: ''
});

describe('seasonForDate', () => {
	const seasons = [season('2026/27', '2026-09-26'), season('2025/26', '2025-09-27')];

	it('findet die laufende Saison', () => {
		expect(seasonForDate(seasons, '2026-10-07')?.name).toBe('2026/27');
		expect(seasonForDate(seasons, '2026-09-26')?.name).toBe('2026/27');
		expect(seasonForDate(seasons, '2026-09-25')?.name).toBe('2025/26');
	});

	it('gibt undefined vor der ersten Saison', () => {
		expect(seasonForDate(seasons, '2024-01-01')).toBeUndefined();
		expect(seasonForDate([], '2026-10-07')).toBeUndefined();
	});
});
