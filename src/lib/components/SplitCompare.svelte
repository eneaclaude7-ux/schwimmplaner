<script lang="ts">
	// Zwei Rennen derselben Strecke Abschnitt für Abschnitt vergleichen.
	import { untrack } from 'svelte';
	import { formatDate } from '#lib/dates.ts';
	import { compareSplits, halves, halvesLabel } from '#lib/splits.ts';
	import type { Entry } from '#lib/stats.ts';
	import { formatDiff, formatTime } from '#lib/time.ts';
	import SplitChart from './SplitChart.svelte';

	interface Props {
		/** Nur Rennen mit Zwischenzeiten, chronologisch */
		entries: Entry[];
		distance: number;
		/** z. B. "100 m Brust, Kurzbahn (25 m)" */
		label: string;
	}

	let { entries, distance, label }: Props = $props();

	// Vorauswahl: das vorletzte gegen das letzte Rennen
	const initial = untrack(() => entries);
	let aId = $state(initial.at(-2)?.race.id ?? '');
	let bId = $state(initial.at(-1)?.race.id ?? '');
	const id = $props.id();

	const a = $derived(entries.find((e) => e.race.id === aId));
	const b = $derived(entries.find((e) => e.race.id === bId));
	const rows = $derived(
		a && b
			? compareSplits(
					{ splits: a.race.splits, result: a.time },
					{ splits: b.race.splits, result: b.time },
					distance
				)
			: []
	);

	function option(e: Entry): string {
		return `${formatDate(e.race.date)} · ${e.competition.name} · ${formatTime(e.time)}`;
	}

	function short(e: Entry): string {
		return `${e.competition.name}, ${formatDate(e.race.date)}`;
	}
</script>

<div class="grid-2">
	<div class="field">
		<label for="{id}-a">Rennen A</label>
		<select id="{id}-a" bind:value={aId}>
			{#each entries as e (e.race.id)}<option value={e.race.id}>{option(e)}</option>{/each}
		</select>
	</div>
	<div class="field">
		<label for="{id}-b">Rennen B</label>
		<select id="{id}-b" bind:value={bId}>
			{#each entries as e (e.race.id)}<option value={e.race.id}>{option(e)}</option>{/each}
		</select>
	</div>
</div>

{#if !a || !b}
	<p>Bitte zwei Rennen wählen.</p>
{:else if a === b}
	<p>Bitte zwei verschiedene Rennen wählen.</p>
{:else if rows.length < 2}
	<p>Diese beiden Rennen haben keine Zwischenzeit bei derselben Distanz.</p>
{:else}
	<SplitChart
		title="Lap-Zeiten im Vergleich, {label}"
		labels={rows.map((r) => `${r.from}–${r.to} m`)}
		series={[
			{ key: 'A', name: short(a), laps: rows.map((r) => r.lapA) },
			{ key: 'B', name: short(b), laps: rows.map((r) => r.lapB) }
		]}
	/>

	<div class="table-wrap">
		<table>
			<caption class="visually-hidden">Lap-Zeiten von A und B pro Abschnitt</caption>
			<thead>
				<tr>
					<th scope="col">Abschnitt</th>
					<th scope="col" class="num">A</th>
					<th scope="col" class="num">B</th>
					<th scope="col" class="num">B − A</th>
					<th scope="col" class="num">Stand</th>
				</tr>
			</thead>
			<tbody>
				{#each rows as r (r.to)}
					<tr>
						<th scope="row">{r.from}–{r.to} m</th>
						<td class="num">{formatTime(r.lapA)}</td>
						<td class="num">{formatTime(r.lapB)}</td>
						<td class="num">{formatDiff(r.lapDiff)}</td>
						<td class="num">{formatDiff(r.cumulativeDiff)}</td>
					</tr>
				{/each}
			</tbody>
		</table>
	</div>
	<p class="hint">
		Minus heisst: B war schneller. "Stand" ist der Rückstand oder Vorsprung von B bei dieser
		Distanz.
	</p>

	{@const ha = halves(a.race.splits, distance, a.time)}
	{@const hb = halves(b.race.splits, distance, b.time)}
	{#if ha && hb}
		<ul class="halves">
			<li><strong>A:</strong> {halvesLabel(ha)}</li>
			<li><strong>B:</strong> {halvesLabel(hb)}</li>
		</ul>
	{/if}
{/if}

<style>
	th,
	td {
		padding-block: var(--space-1);
		white-space: nowrap;
	}

	tbody th {
		font-weight: 400;
	}

	.halves {
		padding-left: var(--space-5);
	}
</style>
