<script lang="ts">
	import type { Hs, Split } from '#lib/model.ts';
	import { halves, halvesLabel, segments } from '#lib/splits.ts';
	import { formatTime } from '#lib/time.ts';

	interface Props {
		splits: Split[];
		distance: number;
		result: Hs;
	}

	let { splits, distance, result }: Props = $props();

	const rows = $derived(segments(splits, distance, result));
	const half = $derived(halves(splits, distance, result));
</script>

<div class="table-wrap">
	<table>
		<thead>
			<tr>
				<th scope="col">Abschnitt</th>
				<th scope="col" class="num">Ab Start</th>
				<th scope="col" class="num">Lap</th>
				<th scope="col" class="num">Anteil</th>
			</tr>
		</thead>
		<tbody>
			{#each rows as row (row.to)}
				<tr>
					<th scope="row">{row.from}–{row.to} m</th>
					<td class="num">{formatTime(row.cumulative)}</td>
					<td class="num">{formatTime(row.lap)}</td>
					<td class="num">{row.share.toFixed(1)} %</td>
				</tr>
			{/each}
		</tbody>
	</table>
</div>

{#if half}
	<p>
		1. Hälfte {formatTime(half.first)} · 2. Hälfte {formatTime(half.second)}<br />
		<strong>{halvesLabel(half)}</strong>
	</p>
{:else}
	<p class="hint">Für Positive/Negative Split braucht es eine Zwischenzeit bei {distance / 2} m.</p>
{/if}

<style>
	th,
	td {
		padding-block: 0.25rem;
		white-space: nowrap;
	}

	tbody th {
		font-weight: 400;
	}
</style>
