<script lang="ts">
	// Lap-Zeiten pro Abschnitt als Linie, für ein Rennen oder zwei im Vergleich.
	// Die Tabelle daneben enthält dieselben Werte; das SVG ist für Screenreader ausgeblendet.
	import { scaleLinear } from 'd3-scale';
	import type { Hs } from '#lib/model.ts';
	import { formatDiff, formatTime } from '#lib/time.ts';

	export interface SplitSeries {
		/** Kurzname im Diagramm, z. B. "A" */
		key: string;
		/** Für Legende und Tooltip */
		name: string;
		laps: Hs[];
	}

	interface Props {
		/** Abschnitte, z. B. ["0–50 m", "50–100 m"] */
		labels: string[];
		/** Ein oder zwei Rennen, gleich viele Laps wie Abschnitte */
		series: SplitSeries[];
		/** z. B. "Lap-Zeiten 200 m Brust" */
		title: string;
	}

	let { labels, series, title }: Props = $props();

	const HEIGHT = 200;
	const M = { top: 30, right: 26, bottom: 28, left: 52 };
	const COLORS = ['var(--color-series-a)', 'var(--color-series-b)'];

	let width = $state(0);
	let active = $state<number | null>(null);
	const id = $props.id();

	const single = $derived(series.length === 1);
	const step = $derived((width - M.left - M.right) / labels.length);
	const x = (i: number) => M.left + (i + 0.5) * step;

	// Schnellere Laps oben, wie beim Entwicklungsdiagramm
	const y = $derived.by(() => {
		const all = series.flatMap((s) => s.laps);
		const min = Math.min(...all);
		const max = Math.max(...all);
		const pad = Math.max(30, (max - min) * 0.15);
		return scaleLinear()
			.domain([min - pad, max + pad])
			.range([M.top, HEIGHT - M.bottom])
			.nice(4);
	});

	function color(i: number): string {
		return single ? 'var(--color-primary)' : COLORS[i];
	}

	function path(laps: Hs[]): string {
		return laps.map((lap, i) => `${i ? 'L' : 'M'}${x(i)},${y(lap)}`).join('');
	}

	function pointer(event: PointerEvent) {
		const box = (event.currentTarget as HTMLElement).getBoundingClientRect();
		const i = Math.floor((event.clientX - box.left - M.left) / step);
		active = Math.min(labels.length - 1, Math.max(0, i));
	}

	function key(event: KeyboardEvent) {
		const last = labels.length - 1;
		const moves: Record<string, number> = {
			ArrowLeft: Math.max(0, (active ?? last + 1) - 1),
			ArrowRight: Math.min(last, (active ?? -1) + 1),
			Home: 0,
			End: last
		};
		if (event.key === 'Escape') active = null;
		else if (event.key in moves) active = moves[event.key];
		else return;
		event.preventDefault();
	}

	function valueText(i: number | null): string {
		if (i === null) return 'Pfeiltasten zeigen die einzelnen Abschnitte';
		return `${labels[i]}: ` + series.map((s) => `${s.key} ${formatTime(s.laps[i])}`).join(', ');
	}

	/** Wenige Beschriftungen auf der x-Achse, wenn es viele Abschnitte sind (1500 m) */
	const labelEvery = $derived(Math.max(1, Math.ceil(labels.length / Math.max(1, width / 70))));
</script>

{#if !single}
	<ul class="legend" aria-label="Legende">
		{#each series as s, i (s.key)}
			<li>
				<svg width="22" height="10" aria-hidden="true">
					<line x1="0" x2="22" y1="5" y2="5" stroke={color(i)} stroke-width="2" />
					{#if i === 0}
						<circle cx="11" cy="5" r="4" fill={color(i)} />
					{:else}
						<rect x="7" y="1" width="8" height="8" fill={color(i)} />
					{/if}
				</svg>
				<strong>{s.key}</strong>
				{s.name}
			</li>
		{/each}
	</ul>
{/if}

<div
	class="chart"
	bind:clientWidth={width}
	tabindex="0"
	role="slider"
	aria-label={title}
	aria-valuemin={1}
	aria-valuemax={labels.length}
	aria-valuenow={(active ?? 0) + 1}
	aria-valuetext={valueText(active)}
	onkeydown={key}
	onblur={() => (active = null)}
	onpointermove={pointer}
	onpointerdown={pointer}
	onpointerleave={() => (active = null)}
>
	{#if width > 0}
		<svg {width} height={HEIGHT} aria-hidden="true">
			{#each y.ticks(4) as t (t)}
				<line class="grid" x1={M.left} x2={width - M.right} y1={y(t)} y2={y(t)} />
				<text class="tick" x={M.left - 8} y={y(t)} text-anchor="end" dominant-baseline="middle"
					>{formatTime(t)}</text
				>
			{/each}
			{#each labels as label, i (label)}
				{#if i % labelEvery === 0 || i === labels.length - 1}
					<text class="tick" x={x(i)} y={HEIGHT - 8} text-anchor="middle"
						>{label.replace(' m', '')}</text
					>
				{/if}
			{/each}
			<text class="tick" x={M.left - 8} y={12} text-anchor="end">↑ schneller</text>

			{#if active !== null}
				<rect
					class="band"
					x={M.left + active * step}
					y={M.top}
					width={step}
					height={HEIGHT - M.top - M.bottom}
				/>
			{/if}

			{#each series as s, si (s.key)}
				<path class="line" d={path(s.laps)} stroke={color(si)} />
				{#each s.laps as lap, i (i)}
					{#if si === 0}
						<circle class="mark" cx={x(i)} cy={y(lap)} r={4} fill={color(si)} />
					{:else}
						<rect class="mark" x={x(i) - 4} y={y(lap) - 4} width={8} height={8} fill={color(si)} />
					{/if}
				{/each}
				{#if !single}
					<!-- Direkte Beschriftung am Ende: nur der Kurzname -->
					<text
						class="end-label"
						x={x(s.laps.length - 1) + 9}
						y={y(s.laps.at(-1)!)}
						dominant-baseline="middle">{s.key}</text
					>
				{/if}
			{/each}
		</svg>

		{#if active !== null}
			<div
				class="tooltip"
				style:left="{Math.min(Math.max(x(active), 85), width - 85)}px"
				style:top="{M.top - 4}px"
			>
				<div class="muted">{labels[active]}</div>
				{#each series as s, si (s.key)}
					<div class="row">
						<span class="key" style:background={color(si)}></span>
						<strong>{formatTime(s.laps[active])}</strong>
						{#if !single}<span class="muted">{s.key}</span>{/if}
					</div>
				{/each}
				{#if series.length === 2}
					<div class="muted">
						B − A: {formatDiff(series[1].laps[active] - series[0].laps[active])}
					</div>
				{/if}
			</div>
		{/if}
	{/if}
</div>
<p id="{id}-hint" class="hint">
	Lap-Zeit pro Abschnitt, schnellere Laps oben. Mit der Maus, dem Finger oder den Pfeiltasten
	einzelne Abschnitte anzeigen.
</p>

<style>
	.legend {
		display: flex;
		flex-wrap: wrap;
		gap: 0.25rem 1.25rem;
		list-style: none;
		padding: 0;
		margin: 0.5rem 0 0;
		font-size: 0.85rem;
	}

	.legend li {
		display: flex;
		align-items: center;
		gap: 0.35rem;
	}

	.chart {
		position: relative;
		min-height: 200px;
		margin-top: 0.25rem;
		touch-action: pan-y;
		cursor: crosshair;
	}

	svg {
		display: block;
		overflow: visible;
	}

	.grid {
		stroke: var(--color-line);
		stroke-width: 1;
	}

	.tick {
		fill: var(--color-muted);
		font-size: 0.75rem;
		font-variant-numeric: tabular-nums;
	}

	.band {
		fill: var(--color-surface);
	}

	.line {
		fill: none;
		stroke-width: 2;
		stroke-linejoin: round;
		stroke-linecap: round;
	}

	/* Ring in Hintergrundfarbe, damit sich Punkte und Linien nicht verschmieren */
	.mark {
		stroke: var(--color-bg);
		stroke-width: 2;
	}

	.end-label {
		fill: var(--color-text);
		font-size: 0.8rem;
		font-weight: 700;
	}

	.tooltip {
		position: absolute;
		transform: translateX(-50%);
		min-width: 8rem;
		padding: 0.35rem 0.6rem;
		background: var(--color-bg);
		border: 1px solid var(--color-border);
		border-radius: var(--radius);
		box-shadow: 0 2px 8px rgb(0 0 0 / 0.12);
		font-size: 0.85rem;
		pointer-events: none;
		z-index: 2;
	}

	.row {
		display: flex;
		align-items: center;
		gap: 0.4rem;
		font-variant-numeric: tabular-nums;
	}

	/* Kurzer Strich in Serienfarbe statt Kästchen */
	.key {
		display: inline-block;
		width: 0.9rem;
		height: 2px;
	}

	.muted {
		color: var(--color-muted);
	}
</style>
