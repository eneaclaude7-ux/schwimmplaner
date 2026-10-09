<script lang="ts">
	// Bildmarke Schwimmplaner: Delfin von der Seite. Der Körper schnellt im Bogen aus dem Wasser,
	// die Hände tauchen vorne ein, links und rechts steigt eine Wasserkrone auf.
	// Gleiche Form wie favicon.svg und die App-Icons (scripts/generate-icons.mjs).
	interface Props {
		size?: number;
	}

	let { size = 32 }: Props = $props();
</script>

<svg width={size} height={size} viewBox="0 0 64 64" aria-hidden="true" focusable="false">
	<rect width="64" height="64" rx="14" fill="var(--color-board-tile)" />
	<path
		d="M8 45 C13 30 25 19 38 24"
		fill="none"
		stroke="var(--color-led)"
		stroke-width="7"
		stroke-linecap="round"
	/>
	<path
		d="M38 24 L54 46"
		fill="none"
		stroke="var(--color-led)"
		stroke-width="5.5"
		stroke-linecap="round"
	/>
	<circle cx="45" cy="21" r="5.5" fill="var(--color-led)" />
	<g fill="var(--color-wave)">
		<path d="M45.5 47 C46 43 45.2 40.5 43.8 37.8 C47 39.5 49.3 42.5 50.5 46.5 Z" />
		<path d="M57.5 46.5 C58.3 43 59.8 40.4 61.6 38.8 C60.8 41.4 60.6 43.8 60.9 47 Z" />
		<circle cx="40" cy="37.5" r="1.6" />
		<circle cx="60.2" cy="35.2" r="1.4" />
	</g>
	<!-- Wasserlinie zuletzt: Sie liegt über den Händen, die damit eintauchen -->
	<path
		d="M4 50 C11 46 17 46 24 50 C31 54 37 54 44 50 C49 47 54 47 60 49"
		fill="none"
		stroke="var(--color-wave)"
		stroke-width="4"
		stroke-linecap="round"
	/>
</svg>
