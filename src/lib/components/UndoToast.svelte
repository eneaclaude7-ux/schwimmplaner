<script lang="ts">
	// Statt "Wirklich löschen?" vorher: sofort löschen, danach 10 Sekunden "Rückgängig".
	// Die Zeit läuft nicht, solange der Knopf den Fokus hat oder die Maus darauf liegt (WCAG 2.2.1).
	import { onMount } from 'svelte';

	interface Props {
		/** z. B. "100 m Brust gelöscht." */
		message: string;
		onundo: () => void;
		ondismiss: () => void;
	}

	let { message, onundo, ondismiss }: Props = $props();

	const DURATION = 10_000;
	let remaining = DURATION;
	let started = 0;
	let timer: ReturnType<typeof setTimeout> | undefined;

	function run() {
		started = Date.now();
		timer = setTimeout(ondismiss, remaining);
	}

	function pause() {
		clearTimeout(timer);
		remaining -= Date.now() - started;
	}

	onMount(() => {
		run();
		return () => clearTimeout(timer);
	});
</script>

<div
	class="toast"
	role="status"
	onmouseenter={pause}
	onmouseleave={run}
	onfocusin={pause}
	onfocusout={run}
>
	<span>{message}</span>
	<button class="button small" type="button" onclick={onundo}>Rückgängig</button>
</div>

<style>
	/* Unten am Bildschirm, wo der Daumen ist; gleich breit wie der Inhalt */
	.toast {
		position: fixed;
		inset-inline: 0;
		/* Über der Navigation unten (auf dem Handy), sonst am unteren Rand */
		bottom: calc(var(--bottom-nav) + var(--space-4));
		z-index: var(--z-overlay);
		box-sizing: border-box;
		width: min(46rem, calc(100% - 2 * var(--space-4)));
		margin-inline: auto;
		display: flex;
		flex-wrap: wrap;
		align-items: center;
		justify-content: space-between;
		gap: var(--space-2) var(--space-4);
		padding: var(--space-3) var(--space-4);
		background: var(--color-text);
		color: var(--color-bg);
		border-radius: var(--radius-lg);
		box-shadow: var(--shadow-overlay);
	}

	.toast .button {
		border-color: var(--color-bg);
		background: var(--color-bg);
		color: var(--color-text);
	}

	.toast .button:hover {
		border-color: var(--color-surface);
		background: var(--color-surface);
	}

	/* Auf der dunklen Leiste reicht der türkise Fokusrahmen nicht: hier gelb */
	.toast .button:focus-visible {
		outline-color: var(--color-led);
	}
</style>
