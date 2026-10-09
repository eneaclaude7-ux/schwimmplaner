<script lang="ts">
	// Ladeanzeige: Die Daten liegen lokal und sind meist in Millisekunden da.
	// Darum erst nach 200 ms zeigen (kein Flackern) und nach 8 s erklären, was los sein könnte.
	import { onMount } from 'svelte';

	let stage = $state<'hidden' | 'loading' | 'slow'>('hidden');

	onMount(() => {
		const show = setTimeout(() => (stage = 'loading'), 200);
		const slow = setTimeout(() => (stage = 'slow'), 8000);
		return () => {
			clearTimeout(show);
			clearTimeout(slow);
		};
	});
</script>

<div class="loading" role="status">
	{#if stage === 'loading'}
		<p>Lade …</p>
	{:else if stage === 'slow'}
		<p>Lädt ungewöhnlich lange.</p>
		<p class="hint">
			Die Daten liegen auf diesem Gerät. Hilft es nicht, die Seite neu zu laden, ist der
			Browser-Speicher eventuell blockiert (zum Beispiel im privaten Modus).
		</p>
		<button class="button secondary small" type="button" onclick={() => location.reload()}
			>Neu laden</button
		>
	{/if}
</div>

<style>
	/* Platz reservieren, damit die Seite beim Erscheinen der Daten nicht springt */
	.loading {
		min-height: 12rem;
	}
</style>
