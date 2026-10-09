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
