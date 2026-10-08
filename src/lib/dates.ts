import type { IsoDate } from './model';

const DAY_MS = 24 * 60 * 60 * 1000;

function toUtc(iso: IsoDate): number {
	const [y, m, d] = iso.split('-').map(Number);
	return Date.UTC(y, m - 1, d);
}

/** Prüft 'YYYY-MM-DD' und ob es den Tag gibt (kein 31. Februar) */
export function isIsoDate(value: string): value is IsoDate {
	if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
	const [y, m, d] = value.split('-').map(Number);
	const date = new Date(Date.UTC(y, m - 1, d));
	return date.getUTCFullYear() === y && date.getUTCMonth() === m - 1 && date.getUTCDate() === d;
}

/** Heutiges Datum in lokaler Zeit (nicht UTC, sonst ist es nachts der falsche Tag) */
export function todayIso(now = new Date()): IsoDate {
	const mm = String(now.getMonth() + 1).padStart(2, '0');
	const dd = String(now.getDate()).padStart(2, '0');
	return `${now.getFullYear()}-${mm}-${dd}`;
}

/** Anzahl Tage von `from` bis `to`, negativ wenn `to` früher ist */
export function daysBetween(from: IsoDate, to: IsoDate): number {
	return Math.round((toUtc(to) - toUtc(from)) / DAY_MS);
}

/** '2026-09-26' -> '26.09.2026' */
export function formatDate(iso: IsoDate): string {
	const [y, m, d] = iso.split('-');
	return `${d}.${m}.${y}`;
}

export function formatDateRange(start: IsoDate, end?: IsoDate): string {
	return end && end !== start ? `${formatDate(start)} – ${formatDate(end)}` : formatDate(start);
}

/** Datum plus `days` Tage (auch negativ) */
export function addDays(iso: IsoDate, days: number): IsoDate {
	return new Date(toUtc(iso) + days * DAY_MS).toISOString().slice(0, 10);
}

/** Wochentag mit Montag = 0 bis Sonntag = 6 */
export function weekday(iso: IsoDate): number {
	return (new Date(toUtc(iso)).getUTCDay() + 6) % 7;
}

/** Alle Tage von `start` bis `end` (für mehrtägige Wettkämpfe) */
export function datesInRange(start: IsoDate, end?: IsoDate): IsoDate[] {
	const count = end ? daysBetween(start, end) + 1 : 1;
	return Array.from({ length: Math.max(1, count) }, (_, i) =>
		new Date(toUtc(start) + i * DAY_MS).toISOString().slice(0, 10)
	);
}

/** 0 -> "heute", 1 -> "morgen", 5 -> "in 5 Tagen", negativ -> "vorbei" */
export function relativeDays(days: number): string {
	if (days < 0) return 'vorbei';
	if (days === 0) return 'heute';
	if (days === 1) return 'morgen';
	return `in ${days} Tagen`;
}
