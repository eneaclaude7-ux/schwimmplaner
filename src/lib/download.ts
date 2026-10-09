// Dateien im Browser erzeugen und herunterladen. Nichts geht an einen Server.
import { todayIso } from './dates';
import { exportAll, setLastBackup } from './repo';

export function saveFile(text: string, type: string, filename: string): void {
	const url = URL.createObjectURL(new Blob([text], { type }));
	const link = document.createElement('a');
	link.href = url;
	link.download = filename;
	link.click();
	URL.revokeObjectURL(url);
}

/** Lädt alle Daten als JSON-Backup herunter und merkt sich den Zeitpunkt */
export async function downloadBackup(): Promise<void> {
	const backup = await exportAll();
	saveFile(JSON.stringify(backup, null, 2), 'application/json', `schwimmplaner-${todayIso()}.json`);
	await setLastBackup(backup.exportedAt);
}
