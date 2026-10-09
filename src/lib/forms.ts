// Gemeinsames Verhalten der Formulare bei Fehlern.

/**
 * Setzt den Fokus auf das oberste Feld mit Fehler, in der Reihenfolge auf dem Bildschirm
 * (nicht in der Reihenfolge der Prüfung). Fehlermeldungen haben die ID des Feldes plus "-error".
 */
export function focusFirstError(form: HTMLFormElement): void {
	const error = form.querySelector<HTMLElement>('.error[id$="-error"]');
	if (!error) return;
	document.getElementById(error.id.replace(/-error$/, ''))?.focus();
}

/** Text für den Screenreader: Er wird auch vorgelesen, wenn der Fokus schon im Feld war */
export function errorAnnouncement(messages: string[]): string {
	if (messages.length === 0) return '';
	if (messages.length === 1) return `Bitte korrigieren: ${messages[0]}`;
	return `${messages.length} Felder sind nicht korrekt. Erstes: ${messages[0]}`;
}

/** Lesbarer Grund, wenn die lokale Datenbank einen Fehler meldet */
export function storageErrorText(error: unknown): string {
	const name = error instanceof Error ? error.name : '';
	if (name === 'QuotaExceededError') return 'Der Speicher auf diesem Gerät ist voll.';
	if (name === 'InvalidStateError' || name === 'SecurityError') {
		return 'Der Browser-Speicher ist nicht verfügbar (privater Modus oder blockierte Website-Daten?).';
	}
	return error instanceof Error && error.message ? error.message : 'Unbekannter Fehler.';
}

export const DISCARD_QUESTION = 'Du hast Eingaben, die noch nicht gespeichert sind. Verwerfen?';
