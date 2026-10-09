<script lang="ts">
	// Übersicht: das Wichtigste auf einen Blick, wie die Resultat-Tafel in der Halle.
	import { liveQuery } from 'dexie';
	import { tick } from 'svelte';
	import { resolve } from '$app/paths';
	import Icon from '#lib/components/Icon.svelte';
	import Loading from '#lib/components/Loading.svelte';
	import { backupDue, lastBackupText } from '#lib/backup.ts';
	import { monthWeeks, monthOf, nextCompetition, nextDeadline } from '#lib/calendar.ts';
	import { db } from '#lib/db.ts';
	import { downloadBackup } from '#lib/download.ts';
	import { storageErrorText } from '#lib/forms.ts';
	import { daysBetween, formatDate, formatShortDate, relativeDays, todayIso } from '#lib/dates.ts';
	import { COURSE_LABEL, raceLabel, type Course } from '#lib/model.ts';
	import { seasonForDate } from '#lib/seasons.ts';
	import { bestMarks, buildHistories, latestEntries, seasonOverview } from '#lib/stats.ts';
	import { formatDiff, formatTime } from '#lib/time.ts';

	const data = liveQuery(async () => ({
		competitions: await db.competitions.orderBy('startDate').toArray(),
		races: await db.races.toArray(),
		seasons: await db.seasons.toArray(),
		lastBackup: (await db.meta.get('lastBackup'))?.value
	}));
	const today = todayIso();

	// Die Daten liegen nur auf diesem Gerät: nach 7 Tagen ohne Backup daran erinnern
	const remind = $derived(
		$data
			? backupDue([...$data.competitions, ...$data.races, ...$data.seasons], $data.lastBackup)
			: false
	);
	let backupMessage = $state('');
	let backupStatus = $state<HTMLElement>();

	async function backupNow() {
		try {
			await downloadBackup();
			backupMessage =
				'Backup heruntergeladen. Leg die Datei an einen sicheren Ort, etwa in die Cloud oder auf den Computer.';
		} catch (error) {
			backupMessage = `Backup fehlgeschlagen: ${storageErrorText(error)}`;
		}
		// Der Hinweis mit dem Knopf verschwindet: Fokus auf die Rückmeldung
		await tick();
		backupStatus?.focus();
	}

	const histories = $derived(
		$data ? buildHistories($data.races, $data.competitions, $data.seasons) : []
	);
	const marks = $derived(bestMarks(histories));
	const season = $derived($data ? seasonForDate($data.seasons, today) : undefined);
	const latest = $derived(latestEntries(histories, 3));

	// Kurz- und Langbahn nie gemischt; ohne Wahl die Bahn des letzten Rennens
	let chosen = $state<Course | null>(null);
	const course = $derived<Course>(chosen ?? latest[0]?.competition.course ?? 'SCM');
	const rows = $derived(season ? seasonOverview(histories, course, season) : []);

	const next = $derived($data ? nextCompetition($data.competitions, today) : undefined);
	const plannedCount = $derived(
		next
			? ($data?.races ?? []).filter((r) => r.competitionId === next.id && r.status === 'planned')
					.length
			: 0
	);
	const deadlineFor = $derived($data ? nextDeadline($data.competitions, today) : undefined);
	const deadlineDays = $derived(
		deadlineFor?.entryDeadline ? daysBetween(today, deadlineFor.entryDeadline) : undefined
	);

	// Diese Woche: die Woche von heute aus dem Monatsraster
	const week = $derived(monthWeeks(monthOf(today)).find((days) => days.includes(today)) ?? []);
	function meetsOn(day: string) {
		return ($data?.competitions ?? []).filter(
			(c) => c.startDate <= day && (c.endDate ?? c.startDate) >= day
		);
	}

	const isEmpty = $derived($data && $data.competitions.length === 0 && $data.races.length === 0);
	const WEEKDAYS = ['Mo', 'Di', 'Mi', 'Do', 'Fr', 'Sa', 'So'];
</script>

<svelte:head>
	<title>Übersicht – Schwimmplaner</title>
</svelte:head>

<h1 class="visually-hidden">Übersicht</h1>

{#if $data === undefined}
	<Loading />
{:else if isEmpty}
	<div class="welcome">
		<h2>Willkommen</h2>
		<p>
			Trag deinen nächsten Wettkampf mit Datum und Meldeschluss ein. Nach dem Rennen erfasst du die
			Zeit, und hier erscheinen deine Saisonbestzeiten wie auf der Anzeigetafel.
		</p>
		<div class="actions">
			<a class="button" href={resolve('/wettkampf/bearbeiten')}>Ersten Wettkampf eintragen</a>
			<a class="button secondary" href={resolve('/daten')}>Lenex-Datei einlesen</a>
		</div>
	</div>
{:else}
	{#if remind}
		<section class="reminder" aria-labelledby="backup-reminder">
			<span class="reminder-icon"><Icon name="alert-triangle" size={22} /></span>
			<div>
				<h2 id="backup-reminder">Zeit für ein Backup</h2>
				<p>
					{#if $data.lastBackup}
						{lastBackupText($data.lastBackup)}, seither hast du Neues erfasst.
					{:else}
						Deine Daten liegen nur auf diesem Gerät, und es gibt noch kein Backup.
					{/if}
				</p>
			</div>
			<button class="button small" type="button" onclick={backupNow}>Backup herunterladen</button>
		</section>
	{/if}
	<p class="status" tabindex="-1" aria-live="polite" bind:this={backupStatus}>{backupMessage}</p>

	<!-- Die Resultat-Tafel: Saisonbestzeiten der gewählten Bahnlänge -->
	<section class="board scoreboard" aria-labelledby="tafel">
		<div class="board-head">
			<h2 id="tafel">Saisonbestzeiten{season ? ` ${season.name}` : ''}</h2>
			<div class="board-tabs" role="group" aria-label="Bahnlänge">
				{#each ['SCM', 'LCM'] as const as value (value)}
					<button type="button" aria-pressed={course === value} onclick={() => (chosen = value)}
						>{value === 'SCM' ? 'Kurzbahn' : 'Langbahn'}</button
					>
				{/each}
			</div>
		</div>

		{#if !season}
			<p class="board-note">
				Für Saisonbestzeiten zuerst unter <a href={resolve('/daten')}>Daten</a> eine Saison erfassen.
			</p>
		{:else if rows.length === 0}
			<p class="board-note">
				Auf der {COURSE_LABEL[course]} gibt es in dieser Saison noch keine Zeiten.
			</p>
		{:else}
			<div class="table-wrap">
				<table>
					<caption class="visually-hidden">
						Saisonbestzeiten {season.name}, {COURSE_LABEL[course]}, mit Verbesserung seit
						Saisonstart
					</caption>
					<thead class="visually-hidden">
						<tr
							><th scope="col">Strecke</th><th scope="col">Zeit</th><th scope="col"
								>Seit Saisonstart</th
							></tr
						>
					</thead>
					<tbody>
						{#each rows as row (row.history.key)}
							<tr>
								<th scope="row">
									<a href={resolve(`/auswertung?bahn=${course}#${row.history.key}`)}
										>{raceLabel(row.history)}</a
									>
								</th>
								<td class="led time">{formatTime(row.best.time)}</td>
								<td class="delta" class:faster={row.diff !== undefined && row.diff < 0}>
									{row.diff === undefined ? 'neu' : formatDiff(row.diff)}
								</td>
							</tr>
						{/each}
					</tbody>
				</table>
			</div>
		{/if}
		<a class="board-more" href={resolve(`/auswertung?bahn=${course}`)}>
			Alle Strecken in der Auswertung <Icon name="chevron-right" size={16} />
		</a>
	</section>

	<!-- Was als Nächstes kommt (Prinzip 4) -->
	<div class="tiles">
		{#if next}
			<a class="tile" href={resolve(`/wettkampf?id=${next.id}`)}>
				<span class="tile-label"><Icon name="flag" size={16} /> Nächster Start</span>
				<span class="tile-value">{formatShortDate(next.startDate)}</span>
				<span class="tile-text">{next.name}</span>
				<span class="tile-text muted">
					{relativeDays(daysBetween(today, next.startDate))}{plannedCount > 0
						? ` · ${plannedCount} ${plannedCount === 1 ? 'Lauf' : 'Läufe'} geplant`
						: ''}
				</span>
			</a>
		{:else}
			<a class="tile" href={resolve('/wettkampf/bearbeiten')}>
				<span class="tile-label"><Icon name="flag" size={16} /> Nächster Start</span>
				<span class="tile-value">Keiner geplant</span>
				<span class="tile-text">Wettkampf eintragen</span>
			</a>
		{/if}

		{#if deadlineFor && deadlineDays !== undefined}
			<a
				class="tile"
				class:soon={deadlineDays <= 7}
				href={resolve(`/wettkampf?id=${deadlineFor.id}`)}
			>
				<span class="tile-label"><Icon name="clock" size={16} /> Meldeschluss</span>
				<span class="tile-value">{relativeDays(deadlineDays)}</span>
				<span class="tile-text">{deadlineFor.name}</span>
				<span class="tile-text muted">{formatDate(deadlineFor.entryDeadline!)}</span>
			</a>
		{:else}
			<div class="tile">
				<span class="tile-label"><Icon name="clock" size={16} /> Meldeschluss</span>
				<span class="tile-value">Keiner offen</span>
			</div>
		{/if}
	</div>

	{#if latest.length > 0}
		<section aria-labelledby="letzte">
			<h2 id="letzte">Letzte Resultate</h2>
			<ul class="results">
				{#each latest as e (e.race.id)}
					<li>
						<a href={resolve(`/wettkampf?id=${e.competition.id}`)}>
							<span class="result-what">
								<strong>{raceLabel(e.race)}</strong>
								<span class="muted">{e.competition.name} · {formatShortDate(e.race.date)}</span>
							</span>
							<span class="result-time">
								<span class="board led">{formatTime(e.time)}</span>
								{#if marks.pb.has(e.race.id)}
									<span class="badge pb">Bestzeit</span>
								{:else if marks.sb.has(e.race.id)}
									<span class="badge sb">Saisonbestzeit</span>
								{/if}
							</span>
						</a>
					</li>
				{/each}
			</ul>
		</section>
	{/if}

	<section aria-labelledby="woche">
		<div class="section-head">
			<h2 id="woche">Diese Woche</h2>
			<a href={resolve('/kalender')}>Ganzer Kalender <Icon name="chevron-right" size={16} /></a>
		</div>
		<ol class="week">
			{#each week as day, i (day)}
				{@const meets = meetsOn(day)}
				<li class:today={day === today} class:weekend={i >= 5}>
					<span class="wd">{WEEKDAYS[i]}</span>
					<span class="num">{Number(day.slice(8))}</span>
					{#each meets as c (c.id)}
						<a
							class="mark {c.course.toLowerCase()}"
							href={resolve(`/wettkampf?id=${c.id}`)}
							aria-label="{c.name}, {formatDate(day)}">{c.name}</a
						>
					{/each}
				</li>
			{/each}
		</ol>
	</section>
{/if}

<style>
	/* Resultat-Tafel */
	.scoreboard {
		margin-top: var(--space-6);
		padding: var(--space-3) var(--space-4) var(--space-2);
	}

	.board-head {
		display: flex;
		flex-wrap: wrap;
		align-items: center;
		justify-content: space-between;
		gap: var(--space-2);
	}

	.board-head h2 {
		margin: 0;
		font-size: var(--text-base);
		font-weight: 500;
		color: var(--color-board-label);
	}

	.board-tabs {
		display: flex;
		gap: var(--space-1);
	}

	.board-tabs button {
		min-height: 32px;
		padding: 0 var(--space-3);
		border: 1px solid var(--color-board-line);
		border-radius: var(--radius-full);
		background: transparent;
		color: var(--color-board-label);
		font: inherit;
		font-size: var(--text-sm);
		cursor: pointer;
	}

	.board-tabs button[aria-pressed='true'] {
		border-color: var(--color-led);
		color: var(--color-led);
		font-weight: 600;
	}

	.board-tabs button:focus-visible,
	.scoreboard a:focus-visible {
		outline-color: var(--color-led);
	}

	.scoreboard table {
		margin-top: var(--space-2);
	}

	.scoreboard th,
	.scoreboard td {
		padding: var(--space-2) 0;
		border-bottom: 1px solid var(--color-board-line);
		vertical-align: baseline;
	}

	.scoreboard tr:last-child th,
	.scoreboard tr:last-child td {
		border-bottom: 0;
	}

	.scoreboard th a {
		font-family: var(--font-display);
		font-size: var(--text-lg);
		font-weight: 500;
		color: var(--color-board-text);
		text-decoration: none;
	}

	.scoreboard th a:hover {
		text-decoration: underline;
	}

	.time {
		font-size: 1.625rem;
		text-align: right;
		padding-inline: var(--space-3) !important;
	}

	.delta {
		width: 4.5rem;
		text-align: right;
		font-size: var(--text-sm);
		color: var(--color-board-label);
		font-variant-numeric: tabular-nums;
		white-space: nowrap;
	}

	.delta.faster {
		color: var(--color-board-accent);
	}

	.board-note {
		margin: var(--space-3) 0;
		color: var(--color-board-label);
	}

	.board-note a {
		color: var(--color-board-accent);
	}

	.board-more {
		display: inline-flex;
		align-items: center;
		gap: var(--space-1);
		padding-block: var(--space-2);
		color: var(--color-board-accent);
		font-size: var(--text-sm);
		text-decoration: none;
	}

	/* Kacheln: nächster Start und Meldeschluss */
	.tiles {
		display: grid;
		grid-template-columns: 1fr 1fr;
		gap: var(--space-3);
		margin-top: var(--space-4);
	}

	.tile {
		display: flex;
		flex-direction: column;
		gap: var(--space-1);
		padding: var(--space-3);
		border: 1px solid var(--color-line);
		border-radius: var(--radius-lg);
		color: var(--color-text);
		text-decoration: none;
		overflow-wrap: anywhere;
	}

	a.tile:hover {
		border-color: var(--color-border);
	}

	.tile-label {
		display: flex;
		align-items: center;
		gap: var(--space-1);
		font-size: var(--text-sm);
		color: var(--color-muted);
	}

	.tile-value {
		font-family: var(--font-display);
		font-size: 1.375rem;
		font-weight: 600;
		line-height: 1.2;
	}

	.tile-text {
		font-size: var(--text-sm);
	}

	.muted {
		color: var(--color-muted);
	}

	.tile.soon {
		border-color: var(--color-warning);
	}

	.tile.soon .tile-label,
	.tile.soon .tile-value {
		color: var(--color-warning);
	}

	/* Letzte Resultate */
	.results {
		list-style: none;
		padding: 0;
		margin: 0;
	}

	.results a {
		display: flex;
		align-items: center;
		justify-content: space-between;
		gap: var(--space-3);
		padding: var(--space-2) 0;
		border-bottom: 1px solid var(--color-line);
		color: var(--color-text);
		text-decoration: none;
	}

	.result-what {
		display: flex;
		flex-direction: column;
		min-width: 0;
	}

	.result-what strong {
		font-family: var(--font-display);
		font-size: var(--text-lg);
		font-weight: 600;
	}

	.result-what .muted {
		font-size: var(--text-sm);
	}

	.result-time {
		display: flex;
		flex-direction: column;
		align-items: flex-end;
		gap: var(--space-1);
	}

	.result-time .board {
		padding: 2px var(--space-2);
		border-radius: var(--radius-md);
		font-size: var(--text-xl);
	}

	/* Diese Woche */
	.section-head {
		display: flex;
		align-items: baseline;
		justify-content: space-between;
		gap: var(--space-3);
	}

	.section-head a {
		display: inline-flex;
		align-items: center;
		gap: var(--space-1);
		padding-block: var(--space-2);
		font-size: var(--text-sm);
	}

	.week {
		display: grid;
		grid-template-columns: repeat(7, minmax(0, 1fr));
		list-style: none;
		padding: 0;
		margin: 0;
		border: 1px solid var(--color-line);
		border-radius: var(--radius-lg);
		overflow: hidden;
	}

	.week li {
		display: flex;
		flex-direction: column;
		align-items: center;
		gap: 2px;
		min-height: 80px;
		padding: var(--space-1) 2px var(--space-2);
		border-left: 1px solid var(--color-line);
	}

	.week li:first-child {
		border-left: 0;
	}

	.week li.weekend {
		background: var(--color-weekend);
	}

	.wd {
		font-size: var(--text-xs);
		color: var(--color-muted);
	}

	.num {
		display: grid;
		place-items: center;
		width: 1.6rem;
		height: 1.6rem;
		border-radius: var(--radius-full);
		font-family: var(--font-display);
		font-weight: 600;
		font-variant-numeric: tabular-nums;
	}

	.today .num {
		background: var(--color-today);
		color: var(--color-on-today);
	}

	.mark {
		align-self: stretch;
		min-height: 24px;
		padding: 0 2px;
		border-radius: var(--radius-sm);
		font-size: var(--text-2xs);
		line-height: 24px;
		color: var(--color-text);
		text-decoration: none;
		white-space: nowrap;
		overflow: hidden;
		text-overflow: ellipsis;
	}

	.mark.scm {
		background: var(--color-scm);
	}

	.mark.lcm {
		background: var(--color-lcm);
	}

	/* Erinnerung ans Backup: ruhig, aber vor der Tafel, weil ohne Backup alles verloren gehen kann */
	.reminder {
		display: flex;
		flex-wrap: wrap;
		align-items: flex-start;
		gap: var(--space-2) var(--space-3);
		margin-top: var(--space-6);
		padding: var(--space-3) var(--space-4);
		border: 1px solid var(--color-warning);
		border-radius: var(--radius-lg);
	}

	.reminder > div {
		flex: 1 1 14rem;
	}

	.reminder h2 {
		margin: 0;
		color: var(--color-warning);
		font-size: var(--text-lg);
	}

	.reminder p {
		margin: var(--space-1) 0 0;
	}

	.reminder-icon {
		display: inline-flex;
		color: var(--color-warning);
	}

	.reminder .button {
		align-self: center;
	}

	.status {
		margin: var(--space-3) 0 0;
	}

	.status:empty {
		display: none;
	}

	.welcome {
		margin-top: var(--space-6);
		padding: var(--space-4);
		border: 1px dashed var(--color-border);
		border-radius: var(--radius-lg);
	}

	.welcome h2 {
		margin-top: 0;
	}

	@media (max-width: 30rem) {
		.tiles {
			gap: var(--space-2);
		}

		.tile {
			padding: var(--space-2) var(--space-3);
		}
	}
</style>
