<script lang="ts">
	import { liveQuery } from 'dexie';
	import Loading from '#lib/components/Loading.svelte';
	import { goto } from '$app/navigation';
	import { resolve } from '$app/paths';
	import { page } from '$app/state';
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
	import ProgressChart from '#lib/components/ProgressChart.svelte';
	import SplitCompare from '#lib/components/SplitCompare.svelte';

	const data = liveQuery(async () => ({
		races: await db.races.toArray(),
		competitions: await db.competitions.toArray(),
		seasons: await db.seasons.orderBy('startDate').reverse().toArray()
	}));

	const histories = $derived(
		$data ? buildHistories($data.races, $data.competitions, $data.seasons) : []
	);

	// Bahnlänge und Saison stehen in der Adresse, damit "Zurück" am selben Ort landet
	const bahnParam = $derived(page.url.searchParams.get('bahn'));
	const seasonParam = $derived(page.url.searchParams.get('saison'));

	/** Ohne Wahl: die Bahnlänge des letzten Rennens, nicht immer Kurzbahn */
	const latest = $derived(
		histories
			.flatMap((h) => h.entries.map((e) => ({ h, e })))
			.reduce<{ h: (typeof histories)[number]; e: Entry } | undefined>(
				(best, x) => (!best || x.e.race.date > best.e.race.date ? x : best),
				undefined
			)
	);

	// Kurz- und Langbahn werden nie gemischt: es ist immer genau eine gewählt
	const course = $derived<Course>(
		bahnParam === 'SCM' || bahnParam === 'LCM' ? bahnParam : (latest?.h.course ?? 'SCM')
	);
	const shown = $derived(histories.filter((h) => h.course === course));
	const otherCount = $derived(histories.length - shown.length);

	/** Offen ist nur die Strecke mit dem jüngsten Rennen; die anderen klappt man bei Bedarf auf */
	const openKey = $derived(
		shown
			.map((h) => ({ key: h.key, date: h.entries.at(-1)!.race.date }))
			.sort((a, b) => b.date.localeCompare(a.date))[0]?.key
	);

	// Standard ist die laufende Saison
	const season = $derived(
		$data
			? ($data.seasons.find((s) => s.id === seasonParam) ??
					seasonForDate($data.seasons, todayIso()))
			: undefined
	);

	function href(next: { bahn?: Course; saison?: string }): string {
		const params = new URLSearchParams();
		params.set('bahn', next.bahn ?? course);
		const saison = next.saison ?? seasonParam;
		if (saison) params.set('saison', saison);
		return resolve(`/auswertung?${params}`);
	}

	// Kommt man mit #strecke (z. B. von der Übersicht), diese Strecke aufklappen
	$effect(() => {
		const key = page.url.hash.slice(1);
		if (!key || !$data) return;
		const details = document.getElementById(key);
		if (details instanceof HTMLDetailsElement) {
			details.open = true;
			details.scrollIntoView();
		}
	});

	/** Strecke aus der Übersicht öffnen und hinspringen */
	function open(key: string) {
		const details = document.getElementById(key) as HTMLDetailsElement | null;
		if (details) details.open = true;
	}

	function targetDiff(entry: Entry): string {
		return entry.race.target === undefined ? '–' : formatDiff(entry.time - entry.race.target);
	}
</script>

<!-- Leere Zelle: sichtbar ein Strich, vorgelesen "keine" -->
{#snippet none()}
	<span aria-hidden="true">–</span><span class="visually-hidden">keine</span>
{/snippet}

<!-- Differenz mit Prozent darunter (schmaler auf dem Handy), oder "–" ohne Vergleichszeit -->
{#snippet diff(time: Hs, base: Hs | undefined)}
	{#if base === undefined}{@render none()}{:else}{formatDiff(time - base)}<br /><span class="small"
			>{formatPercent(time - base, base)}</span
		>{/if}
{/snippet}

<svelte:head>
	<title>Auswertung – Schwimmplaner</title>
</svelte:head>

<h1>Auswertung</h1>

{#if $data === undefined}
	<Loading />
{:else if histories.length === 0}
	<p>
		Noch keine geschwommenen Zeiten. Trage bei einem <a href={resolve('/kalender')}>Wettkampf</a> ein
		Resultat ein, dann erscheinen hier Bestzeiten und Verbesserungen.
	</p>
{:else}
	<div class="filters">
		<nav class="tabs" aria-label="Bahnlänge">
			{#each ['SCM', 'LCM'] as const as value (value)}
				<a
					href={href({ bahn: value })}
					aria-current={course === value ? 'page' : undefined}
					data-sveltekit-replacestate
					data-sveltekit-reset="false">{COURSE_LABEL[value]}</a
				>
			{/each}
		</nav>

		{#if $data.seasons.length > 0}
			<div class="field">
				<label for="season">Saison</label>
				<select
					id="season"
					value={season?.id ?? ''}
					onchange={(e) =>
						goto(href({ saison: e.currentTarget.value }), {
							replace: true,
							reset: false
						})}
				>
					{#each $data.seasons as s (s.id)}
						<option value={s.id}>{s.name}</option>
					{/each}
				</select>
			</div>
		{/if}
	</div>

	<p class="visually-hidden" aria-live="polite">
		{COURSE_LABEL[course]}: {shown.length}
		{shown.length === 1 ? 'Strecke' : 'Strecken'}{season ? `, Saison ${season.name}` : ''}
	</p>

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
		<!-- Resultat-Tafel wie auf der Übersicht: Zeiten in Leuchtziffern -->
		<div class="table-wrap board overview">
			<table>
				<caption class="visually-hidden">Bestzeiten {COURSE_LABEL[course]}</caption>
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
							<th scope="row">
								<a href="#{h.key}" onclick={() => open(h.key)}>{raceLabel(h)}</a>
							</th>
							<td class="num">
								<span class="led">{formatTime(pb.time)}</span><br /><span class="small"
									>{formatDate(pb.race.date)}</span
								>
							</td>
							{#if season}
								<td class="num"
									>{#if sb}<span class="led">{formatTime(sb.time)}</span
										>{:else}{@render none()}{/if}</td
								>
								<td class="num">
									{#if sb}{@render diff(
											sb.time,
											bestBeforeDate(h, season.startDate)
										)}{:else}{@render none()}{/if}
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
			<details class="event" id={h.key} open={h.key === openKey}>
				<summary><h2>{raceLabel(h)}, {COURSE_LABEL[h.course]}</h2></summary>
				{#if h.entries.length >= 2}
					<ProgressChart
						entries={h.entries}
						best={pb}
						label="{raceLabel(h)}, {COURSE_LABEL[h.course]}"
					/>
				{:else}
					<p class="hint">Ab zwei Zeiten zeigt hier ein Diagramm die Entwicklung.</p>
				{/if}
				<div class="table-wrap">
					<table>
						<caption class="visually-hidden">Alle Zeiten {raceLabel(h)}, neueste zuerst</caption>
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
										{#if e === pb}<br /><span class="badge pb">Bestzeit</span>{/if}
									</td>
									<td class="num">
										{#if e.race.target !== undefined}{targetDiff(e)}{:else}{@render none()}{/if}
									</td>
									<td class="num">{@render diff(e.time, e.previous)}</td>
									<td class="num">{@render diff(e.time, e.bestBefore)}</td>
								</tr>
							{/each}
						</tbody>
					</table>
				</div>

				{#if h.entries.filter((e) => e.race.splits.length > 0).length >= 2}
					{@const withSplits = h.entries.filter((e) => e.race.splits.length > 0)}
					<details class="compare">
						<summary>Zwischenzeiten zweier Rennen vergleichen</summary>
						<SplitCompare
							entries={withSplits}
							distance={h.distance}
							label="{raceLabel(h)}, {COURSE_LABEL[h.course]}"
						/>
					</details>
				{/if}
			</details>
		{/each}
	{/if}
{/if}

<style>
	.filters {
		display: flex;
		flex-wrap: wrap;
		align-items: flex-end;
		justify-content: space-between;
		gap: 0 var(--space-8);
		border-bottom: 1px solid var(--color-line);
		margin-bottom: var(--space-4);
	}

	.filters .tabs {
		margin-bottom: -1px;
	}

	.filters .field {
		margin-bottom: var(--space-2);
	}

	/* Resultat-Tafel: dunkle Fläche, Beschriftungen grau, Zeiten leuchtgelb */
	.overview {
		padding: var(--space-1) var(--space-2);
	}

	.overview th,
	.overview td {
		border-bottom-color: var(--color-board-line);
		color: var(--color-board-text);
	}

	.overview thead th {
		color: var(--color-board-label);
		font-weight: 500;
		font-size: var(--text-sm);
	}

	.overview tbody tr:last-child th,
	.overview tbody tr:last-child td {
		border-bottom: 0;
	}

	.overview a {
		color: var(--color-board-text);
		font-family: var(--font-display);
		font-size: var(--text-lg);
		font-weight: 500;
	}

	.overview a:focus-visible {
		outline-color: var(--color-led);
	}

	.overview .led {
		font-size: var(--text-xl);
	}

	.overview .small {
		color: var(--color-board-label);
	}

	/* Jede Strecke klappt einzeln auf, damit man nicht an allen vorbeiscrollen muss */
	.event {
		margin-top: var(--space-4);
		border-top: 1px solid var(--color-line);
	}

	.event summary {
		cursor: pointer;
		padding-block: var(--space-2);
	}

	.event summary h2 {
		display: inline;
		margin: 0;
		font-size: var(--text-lg);
	}

	.compare {
		margin-top: var(--space-4);
	}

	.compare summary {
		cursor: pointer;
		color: var(--color-primary);
		font-weight: 600;
	}

	/* Weniger Abstand, damit fünf Spalten auf ein Handy passen */
	th,
	td {
		padding-inline: var(--space-1);
	}

	/* "−0.80 s" nie umbrechen */
	td.num {
		white-space: nowrap;
	}

	.small {
		font-size: var(--text-sm);
		color: var(--color-muted);
	}
</style>
