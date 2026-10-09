<script lang="ts">
	// Bildmarke Schwimmplaner: Delfin von der Seite. Der Körper schnellt im Bogen aus dem Wasser,
	// die Arme tauchen vorne ein, an den Händen spritzt eine Wasserkrone.
	// Gleiche Form wie favicon.svg und die App-Icons (scripts/generate-icons.mjs).
	interface Props {
		size?: number;
	}

	let { size = 32 }: Props = $props();
</script>

<svg width={size} height={size} viewBox="0 0 64 64" aria-hidden="true" focusable="false">
	<rect width="64" height="64" rx="14" fill="var(--color-board-tile)" />
	<path
		d="M4 50 C11 46 17 46 24 50 C31 54 37 54 44 50 C49 47 54 47 60 49"
		fill="none"
		stroke="var(--color-wave)"
		stroke-width="4"
		stroke-linecap="round"
	/>
	<path
		d="M8 45 C13 30 25 19 38 24"
		fill="none"
		stroke="var(--color-led)"
		stroke-width="7"
		stroke-linecap="round"
	/>
	<path
		d="M38 24 L52 43"
		fill="none"
		stroke="var(--color-led)"
		stroke-width="5.5"
		stroke-linecap="round"
	/>
	<circle cx="45" cy="21" r="5.5" fill="var(--color-led)" />
	<g fill="none" stroke="var(--color-wave)" stroke-width="2.4" stroke-linecap="round">
		<path d="M47.5 45 C46 42 45.5 39.5 46.5 37" />
		<path d="M57 45 C59 42.5 60 40 59.5 37" />
	</g>
	<g fill="var(--color-wave)">
		<circle cx="50" cy="35.5" r="1.5" />
		<circle cx="56" cy="34" r="1.4" />
		<circle cx="60" cy="33" r="1.1" />
	</g>
</svg>
