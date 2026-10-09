<script lang="ts">
	// Entwicklung einer Strecke als Liniendiagramm. Die Tabelle darunter (Auswertung)
	// enthält dieselben Werte, darum ist das SVG für Screenreader ausgeblendet.
	import { scaleLinear, scaleUtc } from 'd3-scale';
	import { formatDate } from '#lib/dates.ts';
	import type { Entry } from '#lib/stats.ts';
	import { formatDiff, formatTime } from '#lib/time.ts';

	interface Props {
		/** Chronologisch, ältester zuerst */
		entries: Entry[];
		/** Der Eintrag mit der persönlichen Bestzeit */
		best: Entry;
		/** z. B. "100 m Brust, Kurzbahn (25 m)" */
		label: string;
	}

	let { entries, best, label }: Props = $props();

	const HEIGHT = 232;
	const M = { top: 34, right: 18, bottom: 28, left: 58 };
	const DAY_MS = 24 * 60 * 60 * 1000;

	let width = $state(0);
	/** Punkt unter dem Zeiger oder per Pfeiltaste gewählt */
	let active = $state<number | null>(null);

	const toMs = (iso: string) => Date.parse(`${iso}T00:00:00Z`);

	const x = $derived.by(() => {
		const first = toMs(entries[0].race.date);
		const last = toMs(entries.at(-1)!.race.date);
		// Alle am selben Tag: zwei Wochen Luft auf jeder Seite
		const pad = last === first ? 14 * DAY_MS : (last - first) * 0.04;
		return scaleUtc()
			.domain([first - pad, last + pad])
			.range([M.left, Math.max(M.left + 1, width - M.right)]);
	});

	// Schnellere Zeiten oben: kleinere Zahl = höher im Diagramm
	const y = $derived.by(() => {
		const times = entries.map((e) => e.time);
		const min = Math.min(...times);
		const max = Math.max(...times);
		const pad = Math.max(50, (max - min) * 0.15);
		return scaleLinear()
			.domain([min - pad, max + pad])
			.range([M.top, HEIGHT - M.bottom])
			.nice(4);
	});

	/** Läufe am selben Tag (Vorlauf, Final) leicht nebeneinander statt übereinander */
	const points = $derived.by(() => {
		const perDay = new Map<string, number>();
		for (const e of entries) perDay.set(e.race.date, (perDay.get(e.race.date) ?? 0) + 1);
		const seen = new Map<string, number>();
		return entries.map((e) => {
			const n = perDay.get(e.race.date)!;
			const i = seen.get(e.race.date) ?? 0;
			seen.set(e.race.date, i + 1);
			return { entry: e, px: x(toMs(e.race.date)) + (i - (n - 1) / 2) * 8, py: y(e.time) };
		});
	});

	const path = $derived(points.map((p, i) => `${i ? 'L' : 'M'}${p.px},${p.py}`).join(''));
	const yTicks = $derived(y.ticks(4));
	const xTicks = $derived(x.ticks(Math.max(2, Math.floor(width / 110))));
	const xFormat = $derived.by(() => {
		const [a, b] = x.domain();
		const long = b.getTime() - a.getTime() > 150 * DAY_MS;
		const format = new Intl.DateTimeFormat('de-CH', {
			timeZone: 'UTC',
			...(long ? { month: 'short', year: '2-digit' } : { day: 'numeric', month: 'short' })
		});
		return (d: Date) => format.format(d);
	});

	const bestPoint = $derived(points.find((p) => p.entry === best)!);
	const shown = $derived(active === null ? null : points[active]);

	function nearest(px: number): number {
		let index = 0;
		points.forEach((p, i) => {
			if (Math.abs(p.px - px) < Math.abs(points[index].px - px)) index = i;
		});
		return index;
	}

	function pointer(event: PointerEvent) {
		const box = (event.currentTarget as HTMLElement).getBoundingClientRect();
		active = nearest(event.clientX - box.left);
	}

	function key(event: KeyboardEvent) {
		const last = points.length - 1;
		// Wie ein Schieberegler: links/unten zurück, rechts/oben vor, Bild-Tasten in Dreierschritten
		const back = (step: number) => Math.max(0, (active ?? last + 1) - step);
		const forward = (step: number) => Math.min(last, (active ?? -1) + step);
		const moves: Record<string, number> = {
			ArrowLeft: back(1),
			ArrowDown: back(1),
			ArrowRight: forward(1),
			ArrowUp: forward(1),
			PageDown: back(3),
			PageUp: forward(3),
			Home: 0,
			End: last
		};
		if (event.key === 'Escape') active = null;
		else if (event.key in moves) active = moves[event.key];
		else return;
		event.preventDefault();
	}

	const summary = $derived(
		`${entries.length} Zeiten von ${formatDate(entries[0].race.date)} ` +
			`bis ${formatDate(entries.at(-1)!.race.date)}, Bestzeit ${formatTime(best.time)} ` +
			`am ${formatDate(best.race.date)}. Alle Werte stehen auch in der Tabelle darunter.`
	);

	/** Was ein Screenreader beim Blättern mit den Pfeiltasten vorliest */
	function valueText(i: number | null): string {
		const e = points[i ?? points.length - 1].entry;
		return (
			`${formatTime(e.time)}, ${formatDate(e.race.date)}, ${e.competition.name}` +
			(e === best ? ', Bestzeit' : '')
		);
	}

	const id = $props.id();
</script>

<!--
	Ein Schieberegler über die Zeiten: Pfeiltasten wählen eine Zeit, der Screenreader liest sie vor.
	Maus und Finger wählen die Zeit, die dem Zeiger am nächsten ist.
-->
<div
	class="chart"
	bind:clientWidth={width}
	tabindex="0"
	role="slider"
	aria-label="Entwicklung {label}"
	aria-describedby="{id}-summary"
	aria-valuemin={1}
	aria-valuemax={points.length}
	aria-valuenow={(active ?? points.length - 1) + 1}
	aria-valuetext={valueText(active)}
	onkeydown={key}
	onblur={() => (active = null)}
	onpointermove={pointer}
	onpointerdown={pointer}
	onpointerleave={(e) => {
		// Mit dem Finger bleibt der Wert nach dem Loslassen stehen; weg mit Tippen daneben oder Esc
		if (e.pointerType === 'mouse') active = null;
	}}
>
	{#if width > 0}
		<svg {width} height={HEIGHT} aria-hidden="true">
			<!-- Raster: feine, durchgezogene Linien -->
			{#each yTicks as t (t)}
				<line class="grid" x1={M.left} x2={width - M.right} y1={y(t)} y2={y(t)} />
				<text class="tick" x={M.left - 8} y={y(t)} text-anchor="end" dominant-baseline="middle"
					>{formatTime(t)}</text
				>
			{/each}
			{#each xTicks as t (t.getTime())}
				<text class="tick" x={x(t)} y={HEIGHT - 8} text-anchor="middle">{xFormat(t)}</text>
			{/each}
			<text class="axis-note" x={M.left - 8} y={10} text-anchor="end">↑ schneller</text>

			<path class="line" d={path} />

			{#if shown}
				<line class="crosshair" x1={shown.px} x2={shown.px} y1={M.top} y2={HEIGHT - M.bottom} />
			{/if}

			{#each points as p, i (p.entry.race.id)}
				<circle
					class="dot"
					class:best={p === bestPoint}
					class:active={i === active}
					cx={p.px}
					cy={p.py}
					r={p === bestPoint ? 6 : i === active ? 5.5 : 4}
				/>
			{/each}

			<!-- Nur die Bestzeit wird direkt beschriftet -->
			<text
				class="best-label"
				x={bestPoint.px}
				y={bestPoint.py - 12}
				text-anchor={bestPoint.px > width - 90
					? 'end'
					: bestPoint.px < M.left + 60
						? 'start'
						: 'middle'}>Bestzeit {formatTime(best.time)}</text
			>
		</svg>

		{#if shown}
			{@const e = shown.entry}
			<div
				class="tooltip"
				style:left="{Math.min(Math.max(shown.px, 90), width - 90)}px"
				style:top="{shown.py > HEIGHT / 2 ? shown.py - 92 : shown.py + 14}px"
			>
				<strong>{formatTime(e.time)}</strong>
				{#if e === best}<span class="badge">Bestzeit</span>{/if}
				<div>{formatDate(e.race.date)} · {e.competition.name}</div>
				{#if e.previous !== undefined}
					<div class="muted">Zur letzten Zeit {formatDiff(e.time - e.previous)}</div>
				{/if}
			</div>
		{/if}
	{/if}
</div>
<!-- Die ausführliche Beschreibung ist für Screenreader; sichtbar reicht ein kurzer Hinweis -->
<p id="{id}-summary" class="visually-hidden">{summary}</p>
<p class="hint">Tippen oder Pfeiltasten für einzelne Zeiten.</p>

<style>
	.chart {
		position: relative;
		min-height: 232px;
		margin-top: var(--space-2);
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

	.tick,
	.axis-note {
		fill: var(--color-muted);
		font-size: var(--text-xs);
		font-variant-numeric: tabular-nums;
	}

	.line {
		fill: none;
		stroke: var(--color-primary);
		stroke-width: 2;
		stroke-linejoin: round;
		stroke-linecap: round;
	}

	/* Ring in Hintergrundfarbe, damit Punkte auf der Linie lesbar bleiben */
	.dot {
		fill: var(--color-primary);
		stroke: var(--color-bg);
		stroke-width: 2;
	}

	.best-label {
		fill: var(--color-text);
		font-size: var(--text-xs);
		font-weight: 600;
		paint-order: stroke;
		stroke: var(--color-bg);
		stroke-width: 4px;
	}

	.crosshair {
		stroke: var(--color-muted);
		stroke-width: 1;
	}

	.tooltip {
		position: absolute;
		transform: translateX(-50%);
		min-width: 11rem;
		max-width: 15rem;
		padding: var(--space-2) var(--space-2);
		background: var(--color-bg);
		border: 1px solid var(--color-border);
		border-radius: var(--radius-lg);
		box-shadow: var(--shadow-overlay);
		font-size: var(--text-sm);
		pointer-events: none;
		z-index: var(--z-overlay);
	}

	.tooltip strong {
		font-size: var(--text-base);
		font-variant-numeric: tabular-nums;
	}

	.muted {
		color: var(--color-muted);
	}
</style>
