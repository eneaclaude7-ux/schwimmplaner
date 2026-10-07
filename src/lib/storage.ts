/**
 * Bittet den Browser, die lokalen Daten nicht automatisch zu löschen.
 * Ohne diese Bitte darf der Browser IndexedDB bei Speichermangel leeren.
 * Gibt zurück, ob der Speicher jetzt dauerhaft ist.
 */
export async function requestPersistentStorage(): Promise<boolean> {
	if (!navigator.storage?.persist) return false;
	if (await navigator.storage.persisted()) return true;
	return navigator.storage.persist();
}
