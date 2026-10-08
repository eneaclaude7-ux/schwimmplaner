<script lang="ts">
	import { liveQuery } from 'dexie';
	import { tick } from 'svelte';
	import { goto } from '$app/navigation';
	import { resolve } from '$app/paths';
	import { page } from '$app/state';
	import RaceForm from '#lib/components/RaceForm.svelte';
	import SplitTable from '#lib/components/SplitTable.svelte';
	import { db } from '#lib/db.ts';
	import { daysBetween, formatDate, formatDateRange, relativeDays, todayIso } from '#lib/dates.ts';
	import { COURSE_LABEL, raceLabel, STATUS_LABEL, type Id, type Race } from '#lib/model.ts';
	import { deleteCompetition, deleteRace } from '#lib/repo.ts';
	import { bestMarks, buildHistories } from '#lib/stats.ts';
	import { formatDiff, formatTime } from '#lib/time.ts';

	const id = $derived(page.url.searchParams.get('id') ?? '');
	// undefined = lädt noch, null = nicht gefunden
	const competition = $derived(
		liveQuery(async () => (id ? ((await db.competitions.get(id)) ?? null) : null))
	);
	const races = $derived(
		liveQuery(async () =>
			(await db.races.where('competitionId').equals(id).toArray()).sort(
				(a, b) => a.date.localeCompare(b.date) || a.createdAt.localeCompare(b.createdAt)
			)
		)
	);

	// Bestzeiten hängen an allen Läufen, nicht nur an diesem Wettkampf
	const marks = liveQuery(async () =>
		bestMarks(
			buildHistories(
				await db.races.toArray(),
				await db.competitions.toArray(),
				await db.seasons.toArray()
			)
		)
	);

	/** Lauf, der gerade bearbeitet wird */
	let editingId = $state<Id | null>(null);
	/** Meldung für Screenreader nach Speichern/Löschen */
	let status = $state('');

	const multiDay = $derived(!!$competition?.endDate);

	async function removeCompetition() {
		const count = $races?.length ?? 0;
		const extra = count > 0 ? ` und ${count} ${count === 1 ? 'Lauf' : 'Läufe'}` : '';
		if (!confirm(`Diesen Wettkampf${extra} endgültig löschen?`)) return;
		await deleteCompetition(id);
		await goto(resolve('/'));
	}

	/** Formular öffnen und Fokus dorthin setzen, sonst merkt man auf dem Handy nichts */
	async function startEdit(race: Race) {
		editingId = race.id;
		await tick();
		document.getElementById('race-form-heading')?.focus();
	}

	async function removeRace(race: Race) {
		if (!confirm(`${raceLabel(race)} endgültig löschen?`)) return;
		await deleteRace(race.id);
		status = `${raceLabel(race)} gelöscht.`;
	}

	function resultText(race: Race): string {
		return race.status === 'finished' && race.result !== undefined
			? formatTime(race.result)
			: STATUS_LABEL[race.status];
	}

	function deviation(race: Race): string {
		return race.result !== undefined && race.target !== undefined
			? formatDiff(race.result - race.target)
			: '–';
	}
</script>

<svelte:head>
	<title>{$competition?.name ?? 'Wettkampf'} – Schwimmplaner</title>
</svelte:head>

{#if $competition === undefined}
	<p>Lade …</p>
{:else if $competition === null}
	<h1>Nicht gefunden</h1>
	<p>Diesen Wettkampf gibt es nicht (mehr). <a href={resolve('/')}>Zum Kalender</a></p>
{:else}
	{@const c = $competition}
	<h1>{c.name}</h1>

	<dl class="facts">
		<dt>Datum</dt>
		<dd>{formatDateRange(c.startDate, c.endDate)}</dd>
		<dt>Ort</dt>
		<dd>{c.location}</dd>
		<dt>Bahnlänge</dt>
		<dd>{COURSE_LABEL[c.course]}</dd>
		{#if c.entryDeadline}
			<dt>Meldeschluss</dt>
			<dd>
				{formatDate(c.entryDeadline)} ({relativeDays(daysBetween(todayIso(), c.entryDeadline))})
			</dd>
		{/if}
	</dl>

	<div class="actions">
		<a class="button secondary" href={resolve(`/wettkampf/bearbeiten?id=${c.id}`)}>Bearbeiten</a>
		<button class="button secondary" type="button" onclick={removeCompetition}>Löschen</button>
	</div>

	<h2>Läufe</h2>
	<p class="visually-hidden" aria-live="polite">{status}</p>

	{#if $races && $races.length > 0}
		<!-- Karten statt Tabelle: auf dem Handy hat eine Tabelle mit 5 Spalten keinen Platz -->
		<ul class="race-list">
			{#each $races as race (race.id)}
				<li class="card">
					<div class="race-head">
						<strong>{raceLabel(race)}</strong>
						{#if multiDay}<span>{formatDate(race.date)}</span>{/if}
					</div>
					<dl class="race-times">
						<div>
							<dt>Ziel</dt>
							<dd>{race.target !== undefined ? formatTime(race.target) : '–'}</dd>
						</div>
						<div>
							<dt>Resultat</dt>
							<dd>{resultText(race)}</dd>
							{#if $marks?.pb.has(race.id)}
								<dd><span class="badge">Bestzeit</span></dd>
							{:else if $marks?.sb.has(race.id)}
								<dd><span class="badge">Saisonbestzeit</span></dd>
							{/if}
						</div>
						<div>
							<dt>Abweichung</dt>
							<dd>{deviation(race)}</dd>
						</div>
					</dl>
					{#if race.status === 'finished' && race.result !== undefined && race.splits.length > 0}
						<details>
							<summary>Zwischenzeiten</summary>
							<SplitTable splits={race.splits} distance={race.distance} result={race.result} />
						</details>
					{/if}
					<div class="row-actions">
						<button
							class="button secondary small"
							type="button"
							onclick={() => startEdit(race)}
							aria-label="{raceLabel(race)} bearbeiten">Bearbeiten</button
						>
						<button
							class="button secondary small"
							type="button"
							onclick={() => removeRace(race)}
							aria-label="{raceLabel(race)} löschen">Löschen</button
						>
					</div>
				</li>
			{/each}
		</ul>
	{:else if $races}
		<p>Noch keine Läufe.</p>
	{/if}

	{@const editing = $races?.find((r) => r.id === editingId)}
	{#if editing}
		<h3 id="race-form-heading" tabindex="-1">{raceLabel(editing)} bearbeiten</h3>
		{#key editing.id}
			<RaceForm
				competition={c}
				race={editing}
				onsaved={() => {
					status = 'Lauf gespeichert.';
					editingId = null;
				}}
				oncancel={() => (editingId = null)}
			/>
		{/key}
	{:else}
		<h3>Lauf hinzufügen</h3>
		<!-- Nach dem Speichern neu aufbauen, damit das Formular wieder leer ist -->
		{#key $races?.length}
			<RaceForm competition={c} onsaved={() => (status = 'Lauf hinzugefügt.')} />
		{/key}
	{/if}
{/if}

<style>
	.facts {
		display: grid;
		grid-template-columns: max-content 1fr;
		gap: 0.25rem 1rem;
	}

	.facts dt {
		font-weight: 600;
	}

	.facts dd {
		margin: 0;
	}

	.race-list {
		list-style: none;
		padding: 0;
	}

	.race-head {
		display: flex;
		justify-content: space-between;
		gap: 1rem;
	}

	.race-times {
		display: grid;
		grid-template-columns: repeat(3, 1fr);
		gap: 0.5rem;
		margin: 0.5rem 0;
	}

	.race-times dt {
		font-size: 0.85rem;
		color: var(--color-muted);
	}

	.race-times dd {
		margin: 0;
		font-weight: 600;
		font-variant-numeric: tabular-nums;
	}

	details {
		margin-bottom: 0.5rem;
	}

	summary {
		cursor: pointer;
		color: var(--color-primary);
		font-weight: 600;
	}

	.row-actions {
		display: flex;
		flex-wrap: wrap;
		gap: 0.5rem;
	}
</style>
