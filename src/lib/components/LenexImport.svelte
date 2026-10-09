<script lang="ts">
	import { tick } from 'svelte';
	import { liveQuery } from 'dexie';
	import { resolve } from '$app/paths';
	import { db } from '#lib/db.ts';
	import { formatDate, formatDateRange } from '#lib/dates.ts';
	import {
		ACTION_LABEL,
		planImport,
		readLenexFile,
		type ImportedRace,
		type LenexMeet
	} from '#lib/lenex.ts';
	import { COURSE_LABEL, raceLabel, STATUS_LABEL, type Id } from '#lib/model.ts';
	import { saveImport } from '#lib/repo.ts';
	import { count } from '#lib/text.ts';
	import { formatTime } from '#lib/time.ts';

	// Inhalt der Datei mit allen Schwimmern: nur im Arbeitsspeicher, bis gespeichert
	// oder abgebrochen wird. Danach wird alles verworfen. Roh (ohne Proxy), weil
	// IndexedDB Proxies nicht speichern kann und die Daten sich nicht ändern.
	let meets = $state.raw<LenexMeet[]>([]);
	let meetIndex = $state(0);
	let athleteKey = $state('');
	let search = $state('');
	let fileInput = $state<HTMLInputElement>();
	let saving = $state(false);

	/** Meldung nach dem Lesen oder Speichern, auch für Screenreader */
	let message = $state('');
	let error = $state('');
	let saveError = $state('');
	let savedId = $state<Id>();

	const meet = $derived<LenexMeet | undefined>(meets[meetIndex]);
	const athlete = $derived(meet?.athletes.find((a) => a.key === athleteKey));
	const athletes = $derived.by(() => {
		const query = search.trim().toLocaleLowerCase('de');
		return (meet?.athletes ?? []).filter(
			(a) =>
				a.key === athleteKey ||
				a.name.toLocaleLowerCase('de').includes(query) ||
				a.club.toLocaleLowerCase('de').includes(query)
		);
	});

	// Erfasste Daten, um Duplikate zu erkennen
	const stored = liveQuery(async () => ({
		competitions: await db.competitions.toArray(),
		races: await db.races.toArray()
	}));
	const planned = $derived(
		meet && athlete && $stored
			? planImport(meet, athlete, $stored.competitions, $stored.races)
			: undefined
	);
	const toSave = $derived(
		planned?.ok ? planned.plan.races.filter((r) => r.action !== 'duplicate').length : 0
	);

	function clear() {
		meets = [];
		meetIndex = 0;
		athleteKey = '';
		search = '';
		saveError = '';
		if (fileInput) fileInput.value = '';
	}

	async function read() {
		const file = fileInput?.files?.[0];
		message = '';
		error = '';
		saveError = '';
		savedId = undefined;
		meets = [];
		athleteKey = '';
		search = '';
		if (!file) return;
		const result = readLenexFile(new Uint8Array(await file.arrayBuffer()));
		if (!result.ok) {
			error = `Die Datei lässt sich nicht einlesen: ${result.error}`;
			return;
		}
		meets = result.meets;
		meetIndex = 0;
		const first = result.meets[0];
		message =
			`Datei gelesen: ${first.competition.name}, ` +
			`${count(first.athletes.length, 'Athlet', 'Athleten')} mit Resultaten. Bitte wählen.`;
	}

	async function save() {
		if (!planned?.ok) return;
		saving = true;
		try {
			const id = await saveImport(planned.plan);
			const n = toSave;
			clear();
			savedId = id;
			message = `${count(n, 'Lauf', 'Läufe')} gespeichert.`;
			// Die Knöpfe verschwinden: Fokus auf die Meldung, sonst landet er im Nichts
			await tick();
			document.getElementById('lenex-status')?.focus();
		} catch {
			saveError = 'Speichern fehlgeschlagen. Es wurde nichts gespeichert.';
		} finally {
			saving = false;
		}
	}

	async function cancel() {
		clear();
		message = 'Import abgebrochen. Nichts wurde gespeichert.';
		await tick();
		document.getElementById('lenex-status')?.focus();
	}

	function resultText(race: ImportedRace): string {
		return race.result !== undefined ? formatTime(race.result) : STATUS_LABEL[race.status];
	}
</script>

<p>
	Lenex-Dateien (.lxf oder .lef) enthalten die Resultate eines ganzen Wettkampfs, mit
	Zwischenzeiten, wenn sie elektronisch gemessen wurden. Du bekommst sie oft beim Veranstalter oder
	beim Trainer.
</p>
<p class="hint">
	Die Datei wird nur auf diesem Gerät gelesen. Du wählst, wessen Resultate du übernehmen willst.
	Gespeichert werden nur diese Läufe, ohne Name, Jahrgang und Verein. Alle anderen Schwimmerinnen
	und Schwimmer verwirft die App.
</p>

<div class="field">
	<label for="lenex-file">Lenex-Datei wählen</label>
	<input
		id="lenex-file"
		type="file"
		accept=".lxf,.lef"
		bind:this={fileInput}
		onchange={read}
		aria-describedby={error ? 'lenex-error' : undefined}
	/>
</div>

<!-- Bleibt immer im DOM, sonst lesen Screenreader neue Meldungen nicht vor -->
<div id="lenex-status" tabindex="-1" aria-live="polite">
	{#if error}
		<p id="lenex-error" class="error">{error}</p>
	{:else if message}
		<p>
			{message}
			{#if savedId}<a href={resolve(`/wettkampf?id=${savedId}`)}>Zum Wettkampf</a>{/if}
		</p>
	{/if}
</div>

{#if meet}
	{#if meets.length > 1}
		<div class="field">
			<label for="lenex-meet">Wettkampf</label>
			<select
				id="lenex-meet"
				bind:value={meetIndex}
				onchange={() => {
					athleteKey = '';
					search = '';
				}}
			>
				{#each meets as m, i (i)}
					<option value={i}>{m.competition.name}</option>
				{/each}
			</select>
		</div>
	{/if}

	<div class="grid-2">
		<div class="field">
			<label for="lenex-search">Name oder Verein suchen</label>
			<input id="lenex-search" type="search" bind:value={search} autocomplete="off" />
			<p class="visually-hidden" aria-live="polite">
				{search.trim() ? `${count(athletes.length, 'Treffer', 'Treffer')}` : ''}
			</p>
		</div>
		<div class="field">
			<label for="lenex-athlete">Athlet oder Athletin</label>
			<select id="lenex-athlete" bind:value={athleteKey}>
				<option value="" disabled>
					Bitte wählen ({athletes.length} von {meet.athletes.length})
				</option>
				{#each athletes as a (a.key)}
					<option value={a.key}>
						{a.name}{a.birthYear ? ` (${a.birthYear})` : ''}{a.club ? `, ${a.club}` : ''}
					</option>
				{/each}
			</select>
		</div>
	</div>

	{#if athlete && planned && !planned.ok}
		<p class="error">{planned.error}</p>
	{:else if athlete && planned?.ok}
		{@const plan = planned.plan}
		<h3>Vorschau</h3>
		<p>
			<strong>{plan.competition.name}</strong>,
			{formatDateRange(plan.competition.startDate, plan.competition.endDate)},
			{plan.competition.location}, {COURSE_LABEL[plan.competition.course]}.
			{#if plan.existing}
				Dieser Wettkampf ist schon erfasst, neue Läufe kommen dazu.
				{#if plan.extendTo}Er dauert neu bis {formatDate(plan.extendTo)}.{/if}
			{:else}
				Der Wettkampf wird neu angelegt.
			{/if}
		</p>

		{#if plan.races.length > 0}
			<div class="table-wrap">
				<table>
					<caption class="visually-hidden">Läufe aus der Datei</caption>
					<thead>
						<tr>
							<th scope="col">Lauf</th>
							<th scope="col">Resultat</th>
							<th scope="col">Import</th>
						</tr>
					</thead>
					<tbody>
						{#each plan.races as { race, action }, i (i)}
							<tr>
								<td>
									{raceLabel(race)}<br /><span class="hint">{formatDate(race.date)}</span>
								</td>
								<td>
									{resultText(race)}
									{#if race.splits.length > 0}
										<br /><span class="hint">
											{count(race.splits.length, 'Zwischenzeit', 'Zwischenzeiten')}
										</span>
									{/if}
								</td>
								<td>{ACTION_LABEL[action]}</td>
							</tr>
						{/each}
					</tbody>
				</table>
			</div>
		{/if}

		{#if athlete.skipped.length > 0}
			<p>Nicht übernommen:</p>
			<ul>
				{#each athlete.skipped as skipped, i (i)}
					<li>{skipped.label}: {skipped.reason}</li>
				{/each}
			</ul>
		{/if}

		<p>
			{#if toSave > 0}
				{count(toSave, 'Lauf wird', 'Läufe werden')} gespeichert.
			{:else}
				Es gibt nichts Neues zu speichern, alle Läufe sind schon erfasst.
			{/if}
		</p>
		{#if saveError}<p class="error" role="alert">{saveError}</p>{/if}
		<div class="actions">
			<button class="button" type="button" onclick={save} disabled={saving || toSave === 0}>
				{count(toSave, 'Lauf', 'Läufe')} speichern
			</button>
			<button class="button secondary" type="button" onclick={cancel}>Abbrechen</button>
		</div>
	{/if}
{/if}

<style>
	h3 {
		margin-top: var(--space-6);
	}

	button:disabled {
		opacity: 0.5;
		cursor: not-allowed;
	}
</style>
