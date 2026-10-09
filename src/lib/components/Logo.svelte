<script lang="ts">
	// Bildmarke Schwimmplaner: "SP" in Leuchtsegmenten wie auf der Anzeigetafel in der Halle,
	// darunter die Welle. Gleiche Form wie favicon.svg und die App-Icons (scripts/generate-icons.mjs).
	interface Props {
		size?: number;
	}

	let { size = 32 }: Props = $props();

	/** Segmente von "S" und "P" (x, y, Breite, Höhe) im 64er-Raster */
	const SEGMENTS = [
		[14, 13, 12, 5],
		[11, 15, 5, 13],
		[14, 27.5, 12, 5],
		[24, 31, 5, 13],
		[14, 41, 12, 5],
		[38, 13, 12, 5],
		[35, 15, 5, 13],
		[48, 15, 5, 13],
		[38, 27.5, 12, 5],
		[35, 31, 5, 13]
	];
</script>

<svg width={size} height={size} viewBox="0 0 64 64" aria-hidden="true" focusable="false">
	<rect width="64" height="64" rx="12" fill="var(--color-board-tile)" />
	{#each SEGMENTS as [x, y, w, h], i (i)}
		<rect {x} {y} width={w} height={h} rx="1.5" fill="var(--color-led)" />
	{/each}
	<path
		d="M11 54 C17 50 23 50 29 54 C35 58 41 58 53 52"
		fill="none"
		stroke="var(--color-wave)"
		stroke-width="3.5"
		stroke-linecap="round"
	/>
</svg>
