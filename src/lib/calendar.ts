// Monatsansicht des Kalenders: Wochen ab Montag, Einträge als Balken über mehrere Tage.
import { addDays, weekday } from './dates';
import type { Competition, IsoDate } from './model';

/** Monat als 'YYYY-MM' */
export type Month = string;

export function isMonth(value: string): value is Month {
	return /^\d{4}-(0[1-9]|1[0-2])$/.test(value);
}

export function monthOf(date: IsoDate): Month {
	return date.slice(0, 7);
}

export function addMonths(month: Month, n: number): Month {
	const [y, m] = month.split('-').map(Number);
	const total = y * 12 + (m - 1) + n;
	return `${Math.floor(total / 12)}-${String((total % 12) + 1).padStart(2, '0')}`;
}

/** "Oktober 2026" */
export function monthLabel(month: Month): string {
	const [y, m] = month.split('-').map(Number);
	return new Intl.DateTimeFormat('de-CH', {
		month: 'long',
		year: 'numeric',
		timeZone: 'UTC'
	}).format(Date.UTC(y, m - 1, 1));
}

/** Alle Wochen, die den Monat berühren, je 7 Tage ab Montag */
export function monthWeeks(month: Month): IsoDate[][] {
	const first = `${month}-01`;
	const last = addDays(`${addMonths(month, 1)}-01`, -1);
	const weeks: IsoDate[][] = [];
	for (let day = addDays(first, -weekday(first)); day <= last; day = addDays(day, 7)) {
		weeks.push(Array.from({ length: 7 }, (_, i) => addDays(day, i)));
	}
	return weeks;
}

/** Ein Eintrag im Kalender: der Wettkampf selbst oder sein Meldeschluss */
export interface CalendarItem {
	key: string;
	kind: 'competition' | 'deadline';
	start: IsoDate;
	end: IsoDate;
	competition: Competition;
}

export function calendarItems(competitions: Competition[]): CalendarItem[] {
	return competitions.flatMap((c) => {
		const items: CalendarItem[] = [
			{
				key: `c-${c.id}`,
				kind: 'competition',
				start: c.startDate,
				end: c.endDate ?? c.startDate,
				competition: c
			}
		];
		if (c.entryDeadline) {
			items.push({
				key: `d-${c.id}`,
				kind: 'deadline',
				start: c.entryDeadline,
				end: c.entryDeadline,
				competition: c
			});
		}
		return items;
	});
}

/** Ein Balken in einer Woche */
export interface Placed {
	item: CalendarItem;
	/** Spalte 0 (Montag) bis 6 (Sonntag) */
	col: number;
	span: number;
	/** Zeile unter der Tageszahl, 0 = oberste */
	lane: number;
	/** Beginnt vor dieser Woche oder endet danach (eckige Kante wie in Notion) */
	continuesBefore: boolean;
	continuesAfter: boolean;
}

/** Verteilt die Einträge einer Woche so auf Zeilen, dass sich keine Balken überlappen */
export function layoutWeek(week: IsoDate[], items: CalendarItem[]): Placed[] {
	const first = week[0];
	const last = week[6];
	const visible = items
		.filter((i) => i.start <= last && i.end >= first)
		.sort(
			(a, b) =>
				a.start.localeCompare(b.start) ||
				b.end.localeCompare(a.end) ||
				(a.kind === b.kind ? 0 : a.kind === 'competition' ? -1 : 1) ||
				a.competition.name.localeCompare(b.competition.name)
		);

	// Pro Zeile die letzte belegte Spalte
	const laneEnds: number[] = [];
	return visible.map((item) => {
		const col = item.start < first ? 0 : week.indexOf(item.start);
		const endCol = item.end > last ? 6 : week.indexOf(item.end);
		let lane = laneEnds.findIndex((end) => end < col);
		if (lane === -1) lane = laneEnds.length;
		laneEnds[lane] = endCol;
		return {
			item,
			col,
			span: endCol - col + 1,
			lane,
			continuesBefore: item.start < first,
			continuesAfter: item.end > last
		};
	});
}

/** Der nächste Meldeschluss, der noch nicht vorbei ist, über alle Monate hinweg */
export function nextDeadline(competitions: Competition[], today: IsoDate): Competition | undefined {
	let next: Competition | undefined;
	for (const c of competitions) {
		if (c.entryDeadline && c.entryDeadline >= today) {
			if (!next || c.entryDeadline < next.entryDeadline!) next = c;
		}
	}
	return next;
}
