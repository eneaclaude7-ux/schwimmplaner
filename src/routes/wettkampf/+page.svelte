<script lang="ts">
	import { liveQuery } from 'dexie';
	import { tick } from 'svelte';
	import { goto } from '$app/navigation';
	import { resolve } from '$app/paths';
	import { page } from '$app/state';
	import Icon from '#lib/components/Icon.svelte';
	import Loading from '#lib/components/Loading.svelte';
	import RaceForm from '#lib/components/RaceForm.svelte';
	import SplitTable from '#lib/components/SplitTable.svelte';
	import UndoToast from '#lib/components/UndoToast.svelte';
	import { db } from '#lib/db.ts';
	import { storageErrorText as errorText } from '#lib/forms.ts';
	import { daysBetween, formatDate, formatDateRange, relativeDays, todayIso } from '#lib/dates.ts';
	import { COURSE_LABEL, raceLabel, STATUS_LABEL, type Id, type Race } from '#lib/model.ts';
	import { deleteCompetition, deleteRace, restoreRace } from '#lib/repo.ts';
	import { bestMarks, buildHistories } from '#lib/stats.ts';
	import { deviationText, formatTime } from '#lib/time.ts';

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

	// Vorheriger und nächster Wettkampf, damit man nicht jedes Mal über den Kalender muss
	const all = liveQuery(() => db.competitions.orderBy('startDate').toArray());
	const neighbours = $derived.by(() => {
		const list = $all ?? [];
		const i = list.findIndex((c) => c.id === id);
		return i === -1 ? {} : { prev: list[i - 1], next: list[i + 1] };
	});

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

	/** Lauf, der gerade bearbeitet wird; das Formular erscheint in seiner Karte */
	let editingId = $state<Id | null>(null);
	/** true: "Zeit eintragen", das Formular springt direkt ins Feld Endzeit */
	let enterResult = $state(false);
	/** Zuletzt gespeicherter Lauf: Seine Karte zeigt das Ergebnis sichtbar an */
	let savedId = $state<Id | null>(null);
	/** Meldung für Screenreader nach Speichern/Löschen */
	let status = $state('');

	/** Erst leeren, dann setzen: Sonst wird dieselbe Meldung beim zweiten Mal nicht vorgelesen */
	async function announce(text: string) {
		status = '';
		await tick();
		status = text;
	}

	/**
	 * Name eines Laufs, eindeutig auch bei Vorlauf und Final derselben Strecke:
	 * "100 m Brust", bei mehreren "100 m Brust, 2. Lauf".
	 */
	function raceName(race: Race): string {
		const same = ($races ?? []).filter(
			(r) => r.stroke === race.stroke && r.distance === race.distance
		);
		if (same.length < 2) return raceLabel(race);
		return `${raceLabel(race)}, ${same.indexOf(race) + 1}. Lauf`;
	}

	const multiDay = $derived(!!$competition?.endDate);

	/** Fehlermeldung, wenn Löschen oder Wiederherstellen scheitert (z. B. Speicher voll) */
	let actionError = $state('');

	async function removeCompetition() {
		const name = $competition?.name ?? 'Diesen Wettkampf';
		const count = $races?.length ?? 0;
		const extra = count > 0 ? ` und ${count} ${count === 1 ? 'Lauf' : 'Läufe'}` : '';
		// Ein ganzer Wettkampf mit Läufen: endgültig, darum hier eine Rückfrage statt Rückgängig
		if (!confirm(`«${name}»${extra} endgültig löschen? Das lässt sich nicht rückgängig machen.`))
			return;
		try {
			await deleteCompetition(id);
			await goto(resolve('/kalender'));
		} catch (error) {
			actionError = `Löschen fehlgeschlagen: ${errorText(error)}`;
		}
	}

	/** Formular in der Karte öffnen und Fokus dorthin setzen, sonst merkt man auf dem Handy nichts */
	async function startEdit(race: Race, result = false) {
		editingId = race.id;
		enterResult = result;
		savedId = null;
		await tick();
		// Bei "Zeit eintragen" setzt das Formular den Fokus selbst ins Feld Endzeit
		if (!result) document.getElementById(`race-form-heading-${race.id}`)?.focus();
	}

	/** Nach dem Speichern die Karte mit dem Ergebnis zeigen, nicht das leere Formular unten */
	async function finishEdit(race: Race) {
		editingId = null;
		savedId = race.id;
		announce('Lauf gespeichert.');
		await tick();
		const saved = document.getElementById(`saved-${race.id}`);
		saved?.scrollIntoView({ block: 'center' });
		saved?.focus();
	}

	/** Zuletzt gelöschter Lauf: Er lässt sich 10 Sekunden lang zurückholen */
	let undo = $state<{ race: Race; name: string } | null>(null);

	/** Löschen ohne Rückfrage, dafür mit "Rückgängig": Ein Lauf ist schnell wieder da */
	async function removeRace(race: Race) {
		// Fokus danach auf den nächsten Lauf, sonst auf die Überschrift "Läufe"
		const list = $races ?? [];
		const neighbour = list[list.indexOf(race) + 1] ?? list[list.indexOf(race) - 1];
		const name = raceName(race);
		try {
			await deleteRace(race.id);
		} catch (error) {
			actionError = `Löschen fehlgeschlagen: ${errorText(error)}`;
			return;
		}
		actionError = '';
		undo = { race, name };
		announce(`${name} gelöscht. Rückgängig ist unten 10 Sekunden lang möglich.`);
		await tick();
		document.getElementById(neighbour ? `race-${neighbour.id}` : 'races-heading')?.focus();
	}

	async function undoRemove() {
		if (!undo) return;
		// $state verpackt das Objekt in einen Proxy; IndexedDB braucht eine einfache Kopie
		const { race, name } = $state.snapshot(undo);
		undo = null;
		try {
			await restoreRace(race);
		} catch (error) {
			actionError = `Wiederherstellen fehlgeschlagen: ${errorText(error)}`;
			return;
		}
		announce(`${name} wiederhergestellt.`);
		await tick();
		document.getElementById(`race-${race.id}`)?.focus();
	}

	function resultText(race: Race): string {
		return race.status === 'finished' && race.result !== undefined
			? formatTime(race.result)
			: STATUS_LABEL[race.status];
	}

	/** Die Zeile unter dem Resultat: Abweichung in Worten oder nur das Ziel */
	function targetLine(race: Race): string | undefined {
		if (race.target === undefined) return undefined;
		if (race.status === 'finished' && race.result !== undefined) {
			return `${deviationText(race.result, race.target)} (${formatTime(race.target)})`;
		}
		return `Ziel ${formatTime(race.target)}`;
	}

	function faster(race: Race): boolean {
		return race.result !== undefined && race.target !== undefined && race.result <= race.target;
	}

	/** Was nach dem Speichern sichtbar bestätigt wird */
	function savedText(race: Race): string {
		const parts: string[] = [];
		if (race.status === 'finished' && race.result !== undefined) {
			parts.push(formatTime(race.result));
			if (race.target !== undefined) parts.push(deviationText(race.result, race.target));
			if ($marks?.pb.has(race.id)) parts.push('Neue Bestzeit!');
			else if ($marks?.sb.has(race.id)) parts.push('Neue Saisonbestzeit!');
		}
		return parts.length ? `Gespeichert: ${parts.join(' · ')}` : 'Gespeichert.';
	}

	/** Meldeschluss in den nächsten 7 Tagen hervorheben */
	function deadlineSoon(deadline: string): boolean {
		const days = daysBetween(todayIso(), deadline);
		return days >= 0 && days <= 7;
	}
</script>

<svelte:head>
	<title>{$competition?.name ?? 'Wettkampf'} – Schwimmplaner</title>
</svelte:head>

{#if $competition === undefined}
	<Loading />
{:else if $competition === null}
	<h1>Nicht gefunden</h1>
	<p>Diesen Wettkampf gibt es nicht (mehr). <a href={resolve('/kalender')}>Zum Kalender</a></p>
{:else}
	{@const c = $competition}
	<!-- Zurück in den Monat dieses Wettkampfs, nicht auf heute -->
	<a class="back" href={resolve(`/kalender?monat=${c.startDate.slice(0, 7)}`)}
		><Icon name="arrow-left" size={18} /> Kalender</a
	>
	<h1>{c.name}</h1>

	{#if actionError}
		<p class="error" role="alert">{actionError}</p>
	{/if}

	<dl class="facts">
		<dt>Datum</dt>
		<dd>{formatDateRange(c.startDate, c.endDate)}</dd>
		<dt>Ort</dt>
		<dd>{c.location}</dd>
		<dt>Bahnlänge</dt>
		<dd>{COURSE_LABEL[c.course]}</dd>
		{#if c.entryDeadline}
			<dt>Meldeschluss</dt>
			<dd class:warning={deadlineSoon(c.entryDeadline)}>
				{formatDate(c.entryDeadline)} ({relativeDays(daysBetween(todayIso(), c.entryDeadline))})
			</dd>
		{/if}
	</dl>

	<div class="actions">
		<a class="button secondary" href={resolve(`/wettkampf/bearbeiten?id=${c.id}`)}>Bearbeiten</a>
		<button class="button danger-outline push-end" type="button" onclick={removeCompetition}
			>Wettkampf löschen</button
		>
	</div>

	<h2 id="races-heading" tabindex="-1">Läufe</h2>
	<p class="visually-hidden" aria-live="polite">{status}</p>

	{#if $races && $races.length > 0}
		<!-- Karten statt Tabelle: auf dem Handy hat eine Tabelle mit 5 Spalten keinen Platz -->
		<ul class="race-list">
			{#each $races as race (race.id)}
				<li class="card" class:editing={editingId === race.id}>
					{#if editingId === race.id}
						<h3 id="race-form-heading-{race.id}" tabindex="-1">
							{enterResult ? 'Zeit eintragen' : 'Bearbeiten'}: {raceName(race)}
						</h3>
						{#key race.id}
							<RaceForm
								competition={c}
								{race}
								{enterResult}
								onsaved={() => finishEdit(race)}
								oncancel={() => (editingId = null)}
							/>
						{/key}
					{:else}
						<div class="race-head">
							<h3 id="race-{race.id}" tabindex="-1">{raceName(race)}</h3>
							{#if multiDay}<span class="muted">{formatDate(race.date)}</span>{/if}
						</div>
						{#if race.status === 'finished' && race.result !== undefined}
							<!-- Die Zeit auf der Anzeigetafel: das, worum es nach dem Rennen geht -->
							<div class="board result-board">
								<div class="result-line">
									<span class="led result">{formatTime(race.result)}</span>
									{#if $marks?.pb.has(race.id)}
										<span class="badge pb">Bestzeit</span>
									{:else if $marks?.sb.has(race.id)}
										<span class="badge sb">Saisonbestzeit</span>
									{/if}
								</div>
								{#if targetLine(race)}
									<p class="target-line" class:faster={faster(race)}>{targetLine(race)}</p>
								{/if}
							</div>
						{:else}
							<div class="result-line">
								<span class="result pending">{resultText(race)}</span>
							</div>
							{#if targetLine(race)}
								<p class="target-line">{targetLine(race)}</p>
							{/if}
						{/if}
						{#if savedId === race.id}
							<p id="saved-{race.id}" class="saved" tabindex="-1">{savedText(race)}</p>
						{/if}
						{#if race.status === 'finished' && race.result !== undefined && race.splits.length > 0}
							<details>
								<summary>Zwischenzeiten</summary>
								<SplitTable
									splits={race.splits}
									distance={race.distance}
									result={race.result}
									chart
								/>
							</details>
						{/if}
						<div class="row-actions">
							{#if race.status === 'planned'}
								<button
									class="button small"
									type="button"
									onclick={() => startEdit(race, true)}
									aria-label="Zeit eintragen für {raceName(race)}">Zeit eintragen</button
								>
							{/if}
							<button
								class="button secondary small"
								type="button"
								onclick={() => startEdit(race)}
								aria-label="{raceName(race)} bearbeiten">Bearbeiten</button
							>
							<button
								class="button danger-outline small push-end"
								type="button"
								onclick={() => removeRace(race)}
								aria-label="{raceName(race)} löschen">Löschen</button
							>
						</div>
					{/if}
				</li>
			{/each}
		</ul>
	{:else if $races}
		<p>
			Noch keine Läufe. Trag <a href="#lauf-hinzufuegen">unten</a> ein, welche Strecken du schwimmst und
			mit welcher Zielzeit; die Endzeit kommt nach dem Rennen dazu.
		</p>
	{/if}

	<h2 id="lauf-hinzufuegen">Lauf hinzufügen</h2>
	<!-- Nach dem Speichern neu aufbauen, damit das Formular wieder leer ist -->
	{#key $races?.length}
		<RaceForm
			competition={c}
			onsaved={async (newId) => {
				savedId = newId;
				announce('Lauf hinzugefügt.');
				await tick();
				const saved = document.getElementById(`saved-${newId}`);
				saved?.scrollIntoView({ block: 'center' });
				saved?.focus();
			}}
		/>
	{/key}

	{#if neighbours.prev || neighbours.next}
		<nav class="pager" aria-label="Andere Wettkämpfe">
			{#if neighbours.prev}
				<a href={resolve(`/wettkampf?id=${neighbours.prev.id}`)}>
					<span class="muted"><Icon name="chevron-left" size={16} /> Vorheriger</span>
					{neighbours.prev.name}
				</a>
			{/if}
			{#if neighbours.next}
				<a class="next" href={resolve(`/wettkampf?id=${neighbours.next.id}`)}>
					<span class="muted">Nächster <Icon name="chevron-right" size={16} /></span>
					{neighbours.next.name}
				</a>
			{/if}
		</nav>
	{/if}
{/if}

{#if undo}
	{#key undo.race.id}
		<UndoToast
			message="{undo.name} gelöscht."
			onundo={undoRemove}
			ondismiss={() => (undo = null)}
		/>
	{/key}
{/if}

<style>
	.back {
		display: inline-flex;
		align-items: center;
		gap: var(--space-1);
		margin-top: var(--space-4);
		padding-block: var(--space-2);
	}

	.back + h1 {
		margin-top: var(--space-1);
	}

	/* Vorheriger und nächster Wettkampf: grosse Trefferflächen, links und rechts */
	.pager {
		display: grid;
		grid-template-columns: 1fr 1fr;
		gap: var(--space-3);
		margin-top: var(--space-8);
		padding-top: var(--space-4);
		border-top: 1px solid var(--color-line);
	}

	.pager a {
		display: flex;
		flex-direction: column;
		padding: var(--space-2) 0;
		text-decoration: none;
		overflow-wrap: anywhere;
	}

	.pager .next {
		grid-column: 2;
		text-align: right;
	}

	.pager .muted {
		display: inline-flex;
		align-items: center;
		gap: 2px;
		font-size: var(--text-sm);
	}

	.pager .next .muted {
		justify-content: flex-end;
	}

	.facts {
		display: grid;
		grid-template-columns: max-content 1fr;
		gap: var(--space-1) var(--space-4);
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
		gap: var(--space-4);
	}

	.race-head h3 {
		margin: 0;
		font-size: var(--text-lg);
	}

	.muted {
		color: var(--color-muted);
	}

	/* Das Resultat ist die Zahl, um die es geht */
	.result-line {
		display: flex;
		flex-wrap: wrap;
		align-items: baseline;
		gap: var(--space-2) var(--space-3);
		margin-top: var(--space-1);
	}

	.result-board {
		margin-block: var(--space-2);
		padding: var(--space-2) var(--space-3);
	}

	.result {
		font-size: 2rem;
		line-height: 1.1;
	}

	/* Auf der Tafel: Saisonbestzeit gelb umrandet, Abweichung türkis (schneller) oder grau */
	.result-board .badge.sb {
		border-color: var(--color-led);
		color: var(--color-led);
	}

	.result-board .target-line {
		margin: 0;
		color: var(--color-board-label);
	}

	.result-board .target-line.faster {
		color: var(--color-board-accent);
	}

	.result.pending {
		font-size: var(--text-base);
		font-weight: 400;
		color: var(--color-muted);
	}

	.target-line {
		margin: 0 0 var(--space-2);
		color: var(--color-muted);
		font-variant-numeric: tabular-nums;
	}

	.target-line.faster {
		color: var(--color-primary);
		font-weight: 600;
	}

	.saved {
		margin: 0 0 var(--space-2);
		padding: var(--space-2) var(--space-3);
		background: var(--color-bg);
		border-radius: var(--radius-md);
		font-weight: 600;
	}

	.card.editing {
		background: var(--color-bg);
		border: 1px solid var(--color-line);
	}

	details {
		margin-bottom: var(--space-2);
	}

	summary {
		cursor: pointer;
		color: var(--color-primary);
		font-weight: 600;
	}

	.row-actions {
		display: flex;
		flex-wrap: wrap;
		gap: var(--space-2);
	}

	/* Löschen weg von Bearbeiten, damit man mit nassen Fingern nicht daneben tippt */
	.push-end {
		margin-left: auto;
	}
</style>
