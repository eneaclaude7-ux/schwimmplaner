<script lang="ts">
	import { liveQuery } from 'dexie';
	import LenexImport from '#lib/components/LenexImport.svelte';
	import { parseBackup } from '#lib/backup.ts';
	import { racesToCsv } from '#lib/csv.ts';
	import { db } from '#lib/db.ts';
	import { formatDate, isIsoDate, todayIso } from '#lib/dates.ts';
	import type { Season } from '#lib/model.ts';
	import { addSeason, deleteAllData, deleteSeason, exportAll, importAll } from '#lib/repo.ts';
	import { seasonForDate } from '#lib/seasons.ts';
	import { requestPersistentStorage } from '#lib/storage.ts';
	import { count } from '#lib/text.ts';

	const seasons = liveQuery(() => db.seasons.orderBy('startDate').reverse().toArray());
	const counts = liveQuery(async () => ({
		competitions: await db.competitions.count(),
		races: await db.races.count()
	}));
	const current = $derived(seasonForDate($seasons ?? [], todayIso()));

	/** Meldung für alle, auch Screenreader (aria-live) */
	let message = $state('');

	// Saison anlegen
	let seasonName = $state('');
	let seasonStart = $state('');
	let seasonError = $state('');

	async function submitSeason(event: SubmitEvent) {
		event.preventDefault();
		const name = seasonName.trim();
		if (!name || !isIsoDate(seasonStart)) {
			seasonError = 'Bitte Name und Startdatum eingeben.';
			return;
		}
		if ($seasons?.some((s) => s.startDate === seasonStart)) {
			seasonError = 'An diesem Datum beginnt schon eine Saison.';
			return;
		}
		seasonError = '';
		await addSeason(name, seasonStart);
		message = `Saison ${name} angelegt.`;
		seasonName = '';
		seasonStart = '';
	}

	async function removeSeason(season: Season) {
		if (!confirm(`Saison ${season.name} löschen? Läufe und Wettkämpfe bleiben erhalten.`)) return;
		await deleteSeason(season.id);
		message = `Saison ${season.name} gelöscht.`;
	}

	// Export: Datei im Browser erzeugen, nichts geht an einen Server
	function save(text: string, type: string, filename: string) {
		const url = URL.createObjectURL(new Blob([text], { type }));
		const link = document.createElement('a');
		link.href = url;
		link.download = filename;
		link.click();
		URL.revokeObjectURL(url);
	}

	async function download() {
		const backup = await exportAll();
		save(JSON.stringify(backup, null, 2), 'application/json', `schwimmplaner-${todayIso()}.json`);
		message = 'Backup heruntergeladen.';
	}

	async function downloadCsv() {
		const { races, competitions, seasons } = await exportAll();
		save(
			racesToCsv(races, competitions, seasons),
			'text/csv;charset=utf-8',
			`schwimmplaner-laeufe-${todayIso()}.csv`
		);
		message = 'Läufe als CSV heruntergeladen.';
	}

	let fileInput = $state<HTMLInputElement>();

	async function restore() {
		const file = fileInput?.files?.[0];
		if (!file) {
			message = 'Bitte zuerst eine Backup-Datei wählen.';
			return;
		}
		const result = parseBackup(await file.text());
		if (!result.ok) {
			message = `Import abgebrochen: ${result.error}`;
			return;
		}
		const { competitions, races } = result.backup;
		const ok = confirm(
			`Backup mit ${count(competitions.length, 'Wettkampf', 'Wettkämpfen')} und ` +
				`${count(races.length, 'Lauf', 'Läufen')} einlesen? ` +
				'Alle Daten auf diesem Gerät werden dabei ersetzt.'
		);
		if (!ok) return;
		await importAll(result.backup);
		if (fileInput) fileInput.value = '';
		message = 'Backup eingelesen.';
	}

	async function wipe() {
		const ok = confirm(
			'Wirklich alle Daten auf diesem Gerät löschen? Das kann nicht rückgängig gemacht werden. ' +
				'Exportiere vorher ein Backup, wenn du die Daten behalten willst.'
		);
		if (!ok) return;
		await deleteAllData();
		message = 'Alle Daten wurden gelöscht.';
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

<p class="status" aria-live="polite">{message}</p>

<section aria-labelledby="saisons">
	<h2 id="saisons">Saisons</h2>
	<p class="hint">
		Eine Saison dauert bis zum Start der nächsten. Sie bestimmt später die Saisonbestzeit.
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
						class="button secondary small"
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
					aria-invalid={!!seasonError && !isIsoDate(seasonStart)}
					aria-describedby={seasonError ? 'season-error' : undefined}
				/>
			</div>
		</div>
		{#if seasonError}<p id="season-error" class="error">{seasonError}</p>{/if}
		<button class="button" type="submit">Saison hinzufügen</button>
	</form>
</section>

<section aria-labelledby="lenex">
	<h2 id="lenex">Resultate einlesen (Lenex)</h2>
	<LenexImport />
</section>

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
	<div class="actions">
		<button class="button" type="button" onclick={download}>Backup herunterladen (JSON)</button>
		<button class="button secondary" type="button" onclick={downloadCsv}
			>Läufe als Tabelle (CSV)</button
		>
	</div>
	<p class="hint">
		Die CSV-Datei öffnet sich in Excel oder Numbers, zum Beispiel für den Trainer. Einlesen lässt
		sich nur das JSON-Backup.
	</p>

	<div class="field">
		<label for="backup-file">Backup einlesen</label>
		<input
			id="backup-file"
			type="file"
			accept="application/json,.json"
			bind:this={fileInput}
			aria-describedby="backup-file-hint"
		/>
		<p id="backup-file-hint" class="hint">Ersetzt alle Daten auf diesem Gerät.</p>
	</div>
	<button class="button secondary" type="button" onclick={restore}>Einlesen</button>
</section>

<section aria-labelledby="speicher">
	<h2 id="speicher">Speicher</h2>
	{#if persisted === true}
		<p>Dauerhafter Speicher ist aktiv. Der Browser löscht deine Daten nicht von selbst.</p>
	{:else if persisted === false}
		<p class="warning">
			Der Browser hat keinen dauerhaften Speicher gewährt. Installiere die App auf dem Homescreen
			und lade regelmässig ein Backup herunter.
		</p>
	{/if}
</section>

<section aria-labelledby="loeschen">
	<h2 id="loeschen">Alle Daten löschen</h2>
	<p>
		Löscht alle Wettkämpfe, Läufe und Saisons auf diesem Gerät. Auf keinem Server liegt eine Kopie.
	</p>
	<button class="button danger" type="button" onclick={wipe}>Alle Daten löschen</button>
</section>

<style>
	section {
		margin-top: 2rem;
	}

	/* Bleibt immer im DOM, sonst lesen Screenreader neue Meldungen nicht vor */
	.status:empty {
		padding: 0;
	}

	.status {
		padding: 0.5rem 1rem;
		background: var(--color-surface);
		border-radius: var(--radius);
	}

	.season-list {
		list-style: none;
		padding: 0;
	}

	.season-list li {
		display: flex;
		align-items: center;
		justify-content: space-between;
		gap: 1rem;
		padding: 0.5rem 0;
		border-bottom: 1px solid var(--color-border);
	}
</style>
