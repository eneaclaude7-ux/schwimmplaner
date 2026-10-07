import { describe, expect, it } from 'vitest';
import {
	validateCompetition,
	validateRace,
	type CompetitionInput,
	type RaceInput
} from './validation';

const competition: CompetitionInput = {
	name: '  Bündner Meisterschaften ',
	startDate: '2026-11-14',
	endDate: '2026-11-15',
	location: 'Chur',
	entryDeadline: '2026-10-30',
	course: 'SCM'
};

describe('validateCompetition', () => {
	it('akzeptiert gültige Eingaben und trimmt Text', () => {
		const result = validateCompetition(competition);
		expect(result.ok).toBe(true);
		if (result.ok) expect(result.value.name).toBe('Bündner Meisterschaften');
	});

	it('lässt optionale Felder leer', () => {
		const result = validateCompetition({ ...competition, endDate: '', entryDeadline: '' });
		expect(result).toMatchObject({ ok: true, value: { endDate: undefined } });
	});

	it('meldet fehlende Pflichtfelder', () => {
		const result = validateCompetition({ ...competition, name: ' ', course: '' });
		expect(result).toMatchObject({ ok: false, errors: { name: expect.any(String) } });
		if (!result.ok) expect(result.errors.course).toBeDefined();
	});

	it('meldet unmögliche Daten', () => {
		const result = validateCompetition({
			...competition,
			endDate: '2026-11-13',
			entryDeadline: '2026-11-20'
		});
		expect(result.ok).toBe(false);
		if (!result.ok) {
			expect(result.errors.endDate).toBeDefined();
			expect(result.errors.entryDeadline).toBeDefined();
		}
	});
});

const meet = { startDate: '2026-11-14', endDate: '2026-11-15', course: 'LCM' as const };
const race: RaceInput = {
	stroke: 'BREAST',
	distance: '100',
	date: '2026-11-15',
	target: '1:09.00',
	status: 'finished',
	result: '1:09.20'
};

describe('validateRace', () => {
	it('wandelt Zeiten in Hundertstel um', () => {
		expect(validateRace(race, meet)).toEqual({
			ok: true,
			value: {
				stroke: 'BREAST',
				distance: 100,
				date: '2026-11-15',
				target: 6900,
				result: 6920,
				status: 'finished'
			}
		});
	});

	it('verlangt bei geschwommenen Läufen eine Endzeit', () => {
		const result = validateRace({ ...race, result: '' }, meet);
		expect(result.ok).toBe(false);
		if (!result.ok) expect(result.errors.result).toBeDefined();
	});

	it('ignoriert das Resultat bei geplanten Läufen', () => {
		const result = validateRace({ ...race, status: 'planned', result: '1:09.20' }, meet);
		expect(result).toMatchObject({ ok: true, value: { result: undefined } });
	});

	it('lehnt Strecken ab, die es nicht gibt', () => {
		// 100 m Lagen gibt es nur auf der Kurzbahn
		const result = validateRace({ ...race, stroke: 'MEDLEY', distance: '100' }, meet);
		expect(result.ok).toBe(false);
		if (!result.ok) expect(result.errors.distance).toBeDefined();
	});

	it('lehnt Tage ausserhalb des Wettkampfs und unlesbare Zeiten ab', () => {
		const result = validateRace({ ...race, date: '2026-11-16', target: '1:9' }, meet);
		expect(result.ok).toBe(false);
		if (!result.ok) {
			expect(result.errors.date).toBeDefined();
			expect(result.errors.target).toBeDefined();
		}
	});
});
