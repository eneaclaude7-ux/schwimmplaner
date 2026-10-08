<script lang="ts">
	import { liveQuery } from 'dexie';
	import { resolve } from '$app/paths';
	import { db } from '#lib/db.ts';
	import { formatDate, todayIso } from '#lib/dates.ts';
	import { COURSE_LABEL, raceLabel, type Course, type Hs } from '#lib/model.ts';
	import { seasonForDate } from '#lib/seasons.ts';
	import {
		bestBeforeDate,
		buildHistories,
		formatPercent,
		personalBest,
		seasonBest,
		type Entry
	} from '#lib/stats.ts';
	import { formatDiff, formatTime } from '#lib/time.ts';

	const data = liveQuery(async () => ({
		races: await db.races.toArray(),
		competitions: await db.competitions.toArray(),
		seasons: await db.seasons.orderBy('startDate').reverse().toArray()
	}));

	const histories = $derived(
		$data ? buildHistories($data.races, $data.competitions, $data.seasons) : []
	);

	// Kurz- und Langbahn werden nie gemischt: es ist immer genau eine gewählt
	let course = $state<Course>('SCM');
	const shown = $derived(histories.filter((h) => h.course === course));
	const otherCount = $derived(histories.length - shown.length);

	// Standard ist die laufende Saison
	let seasonId = $state<string | null>(null);
	const season = $derived(
		$data
			? ($data.seasons.find((s) => s.id === seasonId) ?? seasonForDate($data.seasons, todayIso()))
			: undefined
	);

	function targetDiff(entry: Entry): string {
		return entry.race.target === undefined ? '–' : formatDiff(entry.time - entry.race.target);
	}
</script>

<!-- Differenz mit Prozent darunter (schmaler auf dem Handy), oder "–" ohne Vergleichszeit -->
{#snippet diff(time: Hs, base: Hs | undefined)}
	{#if base === undefined}–{:else}{formatDiff(time - base)}<br /><span class="small"
			>{formatPercent(time - base, base)}</span
		>{/if}
{/snippet}

<svelte:head>
	<title>Auswertung – Schwimmplaner</title>
</svelte:head>

<h1>Auswertung</h1>

{#if $data === undefined}
	<p>Lade …</p>
{:else if histories.length === 0}
	<p>
		Noch keine geschwommenen Zeiten. Trage bei einem <a href={resolve('/')}>Wettkampf</a> ein Resultat
		ein, dann erscheinen hier Bestzeiten und Verbesserungen.
	</p>
{:else}
	<div class="filters">
		<fieldset>
			<legend>Bahnlänge</legend>
			<div class="radio-row">
				{#each ['SCM', 'LCM'] as const as value (value)}
					<label><input type="radio" bind:group={course} {value} /> {COURSE_LABEL[value]}</label>
				{/each}
			</div>
		</fieldset>

		{#if $data.seasons.length > 0}
			<div class="field">
				<label for="season">Saison</label>
				<select
					id="season"
					value={season?.id ?? ''}
					onchange={(e) => (seasonId = e.currentTarget.value)}
				>
					{#each $data.seasons as s (s.id)}
						<option value={s.id}>{s.name}</option>
					{/each}
				</select>
			</div>
		{/if}
	</div>

	{#if !season}
		<p class="hint">
			Für Saisonbestzeiten zuerst unter <a href={resolve('/daten')}>Daten</a> eine Saison erfassen.
		</p>
	{/if}

	{#if shown.length === 0}
		<p>
			Auf der {COURSE_LABEL[course]} gibt es noch keine Zeiten.
			{#if otherCount > 0}Wechsle oben die Bahnlänge.{/if}
		</p>
	{:else}
		<h2>Übersicht {COURSE_LABEL[course]}</h2>
		<div class="table-wrap">
			<table>
				<thead>
					<tr>
						<th scope="col">Strecke</th>
						<th scope="col" class="num">Bestzeit</th>
						{#if season}
							<th scope="col" class="num">Saison&shy;bestzeit</th>
							<th scope="col" class="num">Seit Saisonstart</th>
						{/if}
					</tr>
				</thead>
				<tbody>
					{#each shown as h (h.key)}
						{@const pb = personalBest(h)!}
						{@const sb = season ? seasonBest(h, season) : undefined}
						<tr>
							<th scope="row"><a href="#{h.key}">{raceLabel(h)}</a></th>
							<td class="num">
								{formatTime(pb.time)}<br /><span class="small">{formatDate(pb.race.date)}</span>
							</td>
							{#if season}
								<td class="num">{sb ? formatTime(sb.time) : '–'}</td>
								<td class="num">
									{#if sb}{@render diff(sb.time, bestBeforeDate(h, season.startDate))}{:else}–{/if}
								</td>
							{/if}
						</tr>
					{/each}
				</tbody>
			</table>
		</div>
		<p class="hint">
			"Seit Saisonstart" vergleicht die Saisonbestzeit mit der besten Zeit vor dem Start der Saison.
			Minus heisst schneller.
		</p>

		{#each shown as h (h.key)}
			{@const pb = personalBest(h)!}
			<section aria-labelledby={h.key}>
				<h2 id={h.key}>{raceLabel(h)}, {COURSE_LABEL[h.course]}</h2>
				<div class="table-wrap">
					<table>
						<thead>
							<tr>
								<th scope="col">Datum, Wettkampf</th>
								<th scope="col" class="num">Zeit</th>
								<th scope="col" class="num">Zum Ziel</th>
								<th scope="col" class="num">Zur letzten Zeit</th>
								<th scope="col" class="num">Zur Best&shy;zeit davor</th>
							</tr>
						</thead>
						<tbody>
							{#each [...h.entries].reverse() as e (e.race.id)}
								<tr>
									<td
										>{formatDate(e.race.date)}<br /><span class="small"
											><a href={resolve(`/wettkampf?id=${e.competition.id}`)}
												>{e.competition.name}</a
											></span
										></td
									>
									<td class="num">
										<strong>{formatTime(e.time)}</strong>
										{#if e === pb}<br /><span class="badge">Bestzeit</span>{/if}
									</td>
									<td class="num">{targetDiff(e)}</td>
									<td class="num">{@render diff(e.time, e.previous)}</td>
									<td class="num">{@render diff(e.time, e.bestBefore)}</td>
								</tr>
							{/each}
						</tbody>
					</table>
				</div>
			</section>
		{/each}
	{/if}
{/if}

<style>
	.filters {
		display: flex;
		flex-wrap: wrap;
		align-items: flex-end;
		gap: 0 2rem;
	}

	section {
		margin-top: 2rem;
	}

	/* Weniger Abstand, damit fünf Spalten auf ein Handy passen */
	th,
	td {
		padding-inline: 0.2rem;
	}

	/* "−0.80 s" nie umbrechen */
	td.num {
		white-space: nowrap;
	}

	.small {
		font-size: 0.85rem;
		color: var(--color-muted);
	}
</style>
