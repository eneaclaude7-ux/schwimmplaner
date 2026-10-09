import { describe, expect, it } from 'vitest';
import { deviationText, formatDiff, formatTime, parseTime } from './time';

describe('parseTime', () => {
	it('liest Minuten, Sekunden und Hundertstel', () => {
		expect(parseTime('1:09.20')).toBe(6920);
		expect(parseTime('15:32.10')).toBe(93210);
	});

	it('liest Zeiten unter einer Minute', () => {
		expect(parseTime('34.20')).toBe(3420);
		expect(parseTime('69.20')).toBe(6920);
	});

	it('akzeptiert Komma und eine Nachkommastelle', () => {
		expect(parseTime('1:09,20')).toBe(6920);
		expect(parseTime('34.5')).toBe(3450);
	});

	it('versteht Eingaben ohne Doppelpunkt (Handy-Tastatur)', () => {
		expect(parseTime('1.09.20')).toBe(6920);
		expect(parseTime('1,09,20')).toBe(6920);
		expect(parseTime('10920')).toBe(6920);
		expect(parseTime('3420')).toBe(3420);
		expect(parseTime('153210')).toBe(93210);
		expect(parseTime('905')).toBe(905);
	});

	it('lehnt ungültige Eingaben ab', () => {
		expect(parseTime('')).toBeNull();
		expect(parseTime('abc')).toBeNull();
		expect(parseTime('1:75.00')).toBeNull();
		expect(parseTime('1:09.205')).toBeNull();
		expect(parseTime('1:9')).toBeNull();
		expect(parseTime('1:9.20')).toBeNull();
	});
});

describe('formatTime', () => {
	it('formatiert mit und ohne Minuten', () => {
		expect(formatTime(6920)).toBe('1:09.20');
		expect(formatTime(3420)).toBe('34.20');
		expect(formatTime(93210)).toBe('15:32.10');
		expect(formatTime(905)).toBe('9.05');
	});

	it('ist die Umkehrung von parseTime', () => {
		for (const t of ['1:09.20', '34.20', '2:29.80', '0.99']) {
			expect(formatTime(parseTime(t)!)).toBe(t);
		}
	});
});

describe('formatDiff', () => {
	it('zeigt das Vorzeichen', () => {
		// Beispiel aus dem Projektplan: 1:10.40 -> 1:09.20
		expect(formatDiff(parseTime('1:09.20')! - parseTime('1:10.40')!)).toBe('−1.20 s');
		expect(formatDiff(85)).toBe('+0.85 s');
		expect(formatDiff(0)).toBe('±0.00 s');
	});
});

describe('deviationText', () => {
	it('sagt in Worten, ob schneller oder langsamer als das Ziel', () => {
		expect(deviationText(6920, 7000)).toBe('0.80 s schneller als Ziel');
		expect(deviationText(7120, 7000)).toBe('1.20 s langsamer als Ziel');
		expect(deviationText(7000, 7000)).toBe('genau im Ziel');
	});
});
