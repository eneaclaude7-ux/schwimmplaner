<script lang="ts">
	import { liveQuery } from 'dexie';
	import { tick } from 'svelte';
	import LenexImport from '#lib/components/LenexImport.svelte';
	import UndoToast from '#lib/components/UndoToast.svelte';
	import { lastBackupText, parseBackup } from '#lib/backup.ts';
	import { racesToCsv } from '#lib/csv.ts';
	import { db } from '#lib/db.ts';
	import { downloadBackup, saveFile } from '#lib/download.ts';
	import { formatDate, isIsoDate, todayIso } from '#lib/dates.ts';
	import { storageErrorText } from '#lib/forms.ts';
	import type { Season } from '#lib/model.ts';
	import {
		addSeason,
		deleteAllData,
		deleteSeason,
		exportAll,
		importAll,
		restoreSeason
	} from '#lib/repo.ts';
	import { seasonForDate } from '#lib/seasons.ts';
	import { requestPersistentStorage } from '#lib/storage.ts';
	import { count } from '#lib/text.ts';

	const seasons = liveQuery(() => db.seasons.orderBy('startDate').reverse().toArray());
	const counts = liveQuery(async () => ({
		competitions: await db.competitions.count(),
		races: await db.races.count()
	}));
	const current = $derived(seasonForDate($seasons ?? [], todayIso()));
	// null heisst: geladen, aber noch nie ein Backup (undefined: lädt noch)
	const lastBackup = liveQuery(async () => (await db.meta.get('lastBackup'))?.value ?? null);

	/**
	 * Meldungen stehen direkt beim Knopf, der sie auslöst, nicht oben auf der Seite:
	 * Auf dem Handy wären sie sonst nicht im Bild.
	 */
	type Section = 'backup' | 'restore' | 'seasons' | 'wipe';
	let messages = $state<Record<Section, string>>({
		backup: '',
		restore: '',
		seasons: '',
		wipe: ''
	});

	/** Erst leeren, dann setzen: So wird auch dieselbe Meldung ein zweites Mal vorgelesen */
	async function notify(section: Section, text: string) {
		messages[section] = '';
		await tick();
		messages[section] = text;
	}

	// Saison anlegen
	let seasonName = $state('');
	let seasonStart = $state('');
	let seasonError = $state('');

	async function submitSeason(event: SubmitEvent) {
		event.preventDefault();
		const name = seasonName.trim();
		if (!name || !isIsoDate(seasonStart)) {
			seasonError = 'Bitte Name und Startdatum eingeben.';
			await tick();
			// Fokus ins erste leere Feld, damit man den Fehler sieht und hört
			document.getElementById(name ? 'season-start' : 'season-name')?.focus();
			return;
		}
		if ($seasons?.some((s) => s.startDate === seasonStart)) {
			seasonError = 'An diesem Datum beginnt schon eine Saison.';
			await tick();
			document.getElementById('season-start')?.focus();
			return;
		}
		seasonError = '';
		try {
			await addSeason(name, seasonStart);
		} catch (error) {
			seasonError = `Speichern fehlgeschlagen: ${storageErrorText(error)}`;
			return;
		}
		notify('seasons', `Saison ${name} angelegt.`);
		seasonName = '';
		seasonStart = '';
	}

	/** Zuletzt gelöschte Saison: 10 Sekunden lang zurückholbar, darum keine Rückfrage vorher */
	let undoSeason = $state<Season | null>(null);

	async function removeSeason(season: Season) {
		try {
			await deleteSeason(season.id);
		} catch (error) {
			notify('seasons', `Löschen fehlgeschlagen: ${storageErrorText(error)}`);
			return;
		}
		undoSeason = season;
		await notify(
			'seasons',
			`Saison ${season.name} gelöscht. Läufe und Wettkämpfe bleiben erhalten.`
		);
		// Der Knopf ist weg: Fokus auf die Überschrift des Abschnitts
		document.getElementById('saisons')?.focus();
	}

	async function undoRemoveSeason() {
		if (!undoSeason) return;
		// $state verpackt das Objekt in einen Proxy; IndexedDB braucht eine einfache Kopie
		const season = $state.snapshot(undoSeason);
		undoSeason = null;
		try {
			await restoreSeason(season);
			notify('seasons', `Saison ${season.name} wiederhergestellt.`);
		} catch (error) {
			notify('seasons', `Wiederherstellen fehlgeschlagen: ${storageErrorText(error)}`);
		}
	}

	async function download() {
		try {
			await downloadBackup();
			notify('backup', 'Backup heruntergeladen.');
		} catch (error) {
			notify('backup', `Backup fehlgeschlagen: ${storageErrorText(error)}`);
		}
	}

	async function downloadCsv() {
		try {
			const { races, competitions, seasons } = await exportAll();
			saveFile(
				racesToCsv(races, competitions, seasons),
				'text/csv;charset=utf-8',
				`schwimmplaner-laeufe-${todayIso()}.csv`
			);
			notify('backup', 'Läufe als CSV heruntergeladen.');
		} catch (error) {
			notify('backup', `Export fehlgeschlagen: ${storageErrorText(error)}`);
		}
	}

	let fileInput = $state<HTMLInputElement>();
	let restoreError = $state('');

	async function restore() {
		const file = fileInput?.files?.[0];
		if (!file) {
			restoreError = 'Bitte zuerst eine Backup-Datei wählen.';
			fileInput?.focus();
			return;
		}
		const result = parseBackup(await file.text());
		if (!result.ok) {
			restoreError = `Einlesen abgebrochen: ${result.error}`;
			fileInput?.focus();
			return;
		}
		restoreError = '';
		const { competitions, races } = result.backup;
		const ok = confirm(
			`Backup mit ${count(competitions.length, 'Wettkampf', 'Wettkämpfen')} und ` +
				`${count(races.length, 'Lauf', 'Läufen')} einlesen? ` +
				'Alle Daten auf diesem Gerät werden dabei ersetzt.'
		);
		if (!ok) return;
		try {
			await importAll(result.backup);
		} catch (error) {
			// importAll ist eine Transaktion: Bei einem Fehler bleiben die alten Daten unverändert
			restoreError = `Einlesen fehlgeschlagen, deine bisherigen Daten sind unverändert: ${storageErrorText(error)}`;
			return;
		}
		if (fileInput) fileInput.value = '';
		notify('restore', 'Backup eingelesen.');
	}

	/** Alles löschen ist endgültig: erst nach einem bewussten Häkchen, nicht nach einem Fehltipp */
	let wipeConfirmed = $state(false);

	async function wipe() {
		if (!wipeConfirmed) return;
		try {
			await deleteAllData();
		} catch (error) {
			notify('wipe', `Löschen fehlgeschlagen: ${storageErrorText(error)}`);
			return;
		}
		wipeConfirmed = false;
		notify('wipe', 'Alle Daten wurden gelöscht.');
	}

	let persisted = $state<boolean | null>(null);
	$effect(() => {
		requestPersistentStorage().then((value) => (persisted = value));
	});
</script>

<svelte:head>
	<title>Daten – Schwimmplaner</title>
</svelte:head>

<h1>Daten</h1>

<nav class="toc" aria-label="Auf dieser Seite">
	<a href="#backup">Sichern</a>
	<a href="#saisons">Saisons</a>
	<a href="#lenex">Lenex</a>
	<a href="#loeschen">Alles löschen</a>
</nav>

<!-- Zuerst sichern: Dieses Gerät hat die einzige Kopie -->
<section aria-labelledby="backup">
	<h2 id="backup">Sichern und übertragen</h2>
	<p>
		Deine Daten liegen nur auf diesem Gerät
		{#if $counts}({count($counts.competitions, 'Wettkampf', 'Wettkämpfe')}, {count(
				$counts.races,
				'Lauf',
				'Läufe'
			)}){/if}. Lade regelmässig ein Backup herunter. Mit derselben Datei kannst du die Daten auf
		ein anderes Gerät übertragen.
	</p>
	{#if $lastBackup !== undefined}
		<p class="hint">{lastBackupText($lastBackup ?? undefined)} auf diesem Gerät.</p>
	{/if}
	{#if persisted === true}
		<p class="hint">
			Dauerhafter Speicher ist aktiv: Der Browser löscht deine Daten nicht von selbst.
		</p>
	{:else if persisted === false}
		<p class="warning">
			Der Browser hat keinen dauerhaften Speicher gewährt. Installiere die App auf dem Homescreen
			und lade regelmässig ein Backup herunter.
		</p>
	{/if}
	<div class="actions">
		<button class="button" type="button" onclick={download}>Backup herunterladen (JSON)</button>
		<button class="button secondary" type="button" onclick={downloadCsv}
			>Läufe als Tabelle (CSV)</button
		>
	</div>
	<p class="status" aria-live="polite">{messages.backup}</p>
	<p class="hint">
		Die CSV-Datei öffnet sich in Excel oder Numbers, zum Beispiel für den Trainer. Einlesen lässt
		sich nur das JSON-Backup.
	</p>

	<h3>Backup einlesen</h3>
	<div class="field">
		<label for="backup-file">Backup-Datei (JSON)</label>
		<input
			id="backup-file"
			type="file"
			accept="application/json,.json"
			bind:this={fileInput}
			onchange={() => (restoreError = '')}
			aria-invalid={!!restoreError}
			aria-describedby="backup-file-hint{restoreError ? ' backup-file-error' : ''}"
		/>
		<p id="backup-file-hint" class="hint">Ersetzt alle Daten auf diesem Gerät.</p>
		{#if restoreError}
			<p id="backup-file-error" class="error" role="alert">{restoreError}</p>
		{/if}
	</div>
	<button class="button secondary" type="button" onclick={restore}>Backup einlesen</button>
	<p class="status" aria-live="polite">{messages.restore}</p>
</section>

<section aria-labelledby="saisons">
	<h2 id="saisons" tabindex="-1">Saisons</h2>
	<p class="hint">
		Eine Saison dauert bis zum Start der nächsten. Sie bestimmt die Saisonbestzeit.
	</p>

	{#if $seasons && $seasons.length > 0}
		<ul class="season-list">
			{#each $seasons as season (season.id)}
				<li>
					<span>
						<strong>{season.name}</strong> ab {formatDate(season.startDate)}
						{#if current?.id === season.id}<span class="badge">aktuell</span>{/if}
					</span>
					<button
						class="button danger-outline small"
						type="button"
						onclick={() => removeSeason(season)}
						aria-label="Saison {season.name} löschen">Löschen</button
					>
				</li>
			{/each}
		</ul>
	{:else if $seasons}
		<p>Noch keine Saison erfasst.</p>
	{/if}

	<form onsubmit={submitSeason} novalidate>
		<div class="grid-2">
			<div class="field">
				<label for="season-name">Name</label>
				<input
					id="season-name"
					bind:value={seasonName}
					placeholder="2026/27"
					autocomplete="off"
					aria-required="true"
					aria-invalid={!!seasonError && !seasonName.trim()}
					aria-describedby={seasonError ? 'season-error' : undefined}
				/>
			</div>
			<div class="field">
				<label for="season-start">Startdatum</label>
				<input
					id="season-start"
					type="date"
					bind:value={seasonStart}
					aria-required="true"
					aria-invalid={!!seasonError && !isIsoDate(seasonStart)}
					aria-describedby={seasonError ? 'season-error' : undefined}
				/>
			</div>
		</div>
		{#if seasonError}<p id="season-error" class="error" role="alert">{seasonError}</p>{/if}
		<button class="button" type="submit">Saison hinzufügen</button>
	</form>
	<p class="status" aria-live="polite">{messages.seasons}</p>
</section>

<section aria-labelledby="lenex">
	<h2 id="lenex">Lenex-Datei einlesen</h2>
	<LenexImport />
</section>

<section aria-labelledby="loeschen">
	<h2 id="loeschen">Alle Daten löschen</h2>
	<p>
		Löscht alle Wettkämpfe, Läufe und Saisons auf diesem Gerät
		{#if $counts}({count($counts.competitions, 'Wettkampf', 'Wettkämpfe')}, {count(
				$counts.races,
				'Lauf',
				'Läufe'
			)}){/if}. Auf keinem Server liegt eine Kopie, das lässt sich nicht rückgängig machen.
	</p>
	<label class="ack">
		<input type="checkbox" bind:checked={wipeConfirmed} />
		Ich habe ein Backup heruntergeladen oder will die Daten wirklich verlieren.
	</label>
	<button
		class="button danger-outline"
		type="button"
		onclick={wipe}
		disabled={!wipeConfirmed}
		aria-describedby="wipe-why">Alle Daten endgültig löschen</button
	>
	{#if !wipeConfirmed}
		<p id="wipe-why" class="hint">Zuerst das Häkchen oben setzen.</p>
	{/if}
	<p class="status" aria-live="polite">{messages.wipe}</p>
</section>

{#if undoSeason}
	{#key undoSeason.id}
		<UndoToast
			message="Saison {undoSeason.name} gelöscht."
			onundo={undoRemoveSeason}
			ondismiss={() => (undoSeason = null)}
		/>
	{/key}
{/if}

<style>
	.toc {
		display: flex;
		flex-wrap: wrap;
		gap: var(--space-1) var(--space-4);
	}

	.toc a {
		padding-block: var(--space-2);
	}

	.ack {
		display: flex;
		align-items: flex-start;
		gap: var(--space-2);
		margin-bottom: var(--space-3);
		padding-block: var(--space-2);
	}

	.ack input {
		margin-top: 0.3em;
	}

	section {
		margin-top: var(--space-8);
	}

	/* Bleibt immer im DOM, sonst lesen Screenreader neue Meldungen nicht vor */
	/* Nicht display: none, sonst ist die Region für Screenreader nicht da */
	.status:empty {
		margin: 0;
		padding: 0;
	}

	.status {
		margin: var(--space-2) 0;
		padding: var(--space-2) var(--space-4);
		background: var(--color-surface);
		border-radius: var(--radius-lg);
		font-weight: 600;
	}

	.season-list {
		list-style: none;
		padding: 0;
	}

	.season-list li {
		display: flex;
		align-items: center;
		justify-content: space-between;
		gap: var(--space-4);
		padding: var(--space-2) 0;
		border-bottom: 1px solid var(--color-line);
	}
</style>
