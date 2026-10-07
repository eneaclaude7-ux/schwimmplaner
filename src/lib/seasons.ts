import type { IsoDate, Season } from './model';

/**
 * Die Saison, zu der ein Datum gehört: die mit dem spätesten Start,
 * der nicht nach dem Datum liegt. Vor der ersten Saison: undefined.
 */
export function seasonForDate(seasons: Season[], date: IsoDate): Season | undefined {
	let match: Season | undefined;
	for (const season of seasons) {
		if (season.startDate <= date && (!match || season.startDate > match.startDate)) {
			match = season;
		}
	}
	return match;
}
