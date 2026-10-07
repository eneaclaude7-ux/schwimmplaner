/** "1 Lauf", "3 Läufe", "0 Läufe" */
export function count(n: number, singular: string, plural: string): string {
	return `${n} ${n === 1 ? singular : plural}`;
}
