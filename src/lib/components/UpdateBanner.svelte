<script lang="ts">
	// Zeigt einen Hinweis, wenn eine neue Version der App bereitliegt.
	// Ablauf: Der Browser lädt die neue Version im Hintergrund (Service Worker "installed"),
	// sie wartet aber, bis man sie übernimmt. Der Knopf übernimmt sie und lädt neu.
	let waiting = $state<ServiceWorker | null>(null);

	$effect(() => {
		if (!('serviceWorker' in navigator)) return;
		let registration: ServiceWorkerRegistration | undefined;

		function track(worker: ServiceWorker | null) {
			// Nur ein Update, wenn schon eine Version läuft (nicht beim allerersten Besuch)
			if (worker && navigator.serviceWorker.controller) waiting = worker;
		}

		function onUpdateFound() {
			const worker = registration?.installing;
			worker?.addEventListener('statechange', () => {
				if (worker.state === 'installed') track(worker);
			});
		}

		// Beim Zurückkehren in die App nach einer neuen Version fragen
		function onVisible() {
			if (document.visibilityState === 'visible') registration?.update().catch(() => {});
		}

		navigator.serviceWorker.ready.then((reg) => {
			registration = reg;
			track(reg.waiting);
			reg.addEventListener('updatefound', onUpdateFound);
		});
		document.addEventListener('visibilitychange', onVisible);

		return () => {
			registration?.removeEventListener('updatefound', onUpdateFound);
			document.removeEventListener('visibilitychange', onVisible);
		};
	});

	function applyUpdate() {
		if (!waiting) return;
		navigator.serviceWorker.addEventListener('controllerchange', () => location.reload(), {
			once: true
		});
		waiting.postMessage({ type: 'SKIP_WAITING' });
	}
</script>

<div role="status">
	{#if waiting}
		<div class="banner">
			<span>Eine neue Version ist da.</span>
			<button class="button small" type="button" onclick={applyUpdate}>Jetzt aktualisieren</button>
		</div>
	{/if}
</div>

<style>
	.banner {
		display: flex;
		flex-wrap: wrap;
		align-items: center;
		justify-content: space-between;
		gap: var(--space-2);
		/* Gleich breit wie der Inhalt darunter, auch auf dem Handy mit Rand */
		box-sizing: border-box;
		width: min(46rem, calc(100% - 2 * var(--space-4)));
		margin: var(--space-2) auto 0;
		padding: var(--space-2) var(--space-4);
		background: var(--color-surface);
		border: 1px solid var(--color-line);
		border-radius: var(--radius-lg);
	}
</style>
