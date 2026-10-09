<script lang="ts">
	// Anzeigetafel-Schrift, mit der App ausgeliefert (nur lateinische Zeichen, zwei Stärken)
	import '@fontsource/barlow-semi-condensed/latin-500.css';
	import '@fontsource/barlow-semi-condensed/latin-600.css';
	import '../app.css';
	import { page } from '$app/state';
	import { resolve } from '$app/paths';
	import favicon from '#lib/assets/favicon.svg';
	import Logo from '#lib/components/Logo.svelte';
	import UpdateBanner from '#lib/components/UpdateBanner.svelte';
	import { db } from '#lib/db.ts';
	import { storageErrorText } from '#lib/forms.ts';
	import { requestPersistentStorage } from '#lib/storage.ts';
	import type { LayoutProps } from './$types';

	let { children }: LayoutProps = $props();

	$effect(() => {
		requestPersistentStorage();
	});

	/** Ohne Browser-Speicher geht nichts: sofort sagen, statt endlos "Lade …" */
	let storageError = $state('');
	$effect(() => {
		db.open().catch((error) => (storageError = storageErrorText(error)));
	});

	const links = [
		{ href: resolve('/'), label: 'Kalender' },
		{ href: resolve('/auswertung'), label: 'Auswertung' },
		{ href: resolve('/daten'), label: 'Daten' }
	];

	function isCurrent(href: string): boolean {
		const path = page.url.pathname;
		// Wettkampfseiten gehören zum Kalender
		return href === resolve('/')
			? path === href || path.startsWith(resolve('/wettkampf'))
			: path.startsWith(href);
	}
</script>

<svelte:head>
	<link rel="icon" href={favicon} />
</svelte:head>

<a class="skip-link" href="#inhalt">Zum Inhalt springen</a>

<!-- Kopf wie die Anzeigetafel in der Halle: über die ganze Breite dunkel -->
<header class="site-header">
	<div class="inner">
		<a class="brand" href={resolve('/')}>
			<Logo size={34} />
			<span class="wordmark">Schwimmplaner</span>
		</a>
		<nav class="tabs" aria-label="Hauptnavigation">
			{#each links as link (link.href)}
				<a href={link.href} aria-current={isCurrent(link.href) ? 'page' : undefined}>{link.label}</a
				>
			{/each}
		</nav>
	</div>
</header>

<UpdateBanner />

{#if storageError}
	<div class="storage-error" role="alert">
		<p><strong>Die App kann keine Daten speichern.</strong> {storageError}</p>
		<p>
			Öffne die App in einem normalen (nicht privaten) Fenster und erlaube Website-Daten für diese
			Seite. Deine bisherigen Daten liegen nur dort, wo du sie erfasst hast.
		</p>
	</div>
{/if}

<main id="inhalt">
	{@render children()}
</main>

<footer>
	<p>Deine Daten bleiben auf diesem Gerät. Kein Konto, kein Tracking.</p>
	<p class="links">
		<a href={resolve('/datenschutz')}>Datenschutz</a> · <a href={resolve('/lizenzen')}>Lizenzen</a>
	</p>
</footer>

<style>
	.inner,
	main,
	footer {
		max-width: 48rem;
		margin: 0 auto;
		padding: 0 var(--space-4);
	}

	.site-header {
		background: var(--color-board);
		color: var(--color-board-text);
		border-bottom: 1px solid var(--color-board-line);
	}

	.inner {
		display: flex;
		flex-wrap: wrap;
		align-items: center;
		justify-content: space-between;
		gap: var(--space-1) var(--space-4);
		padding-top: var(--space-3);
	}

	.brand {
		display: flex;
		align-items: center;
		gap: var(--space-2);
		text-decoration: none;
	}

	/* Schriftzug wie auf der Anzeigetafel: Leuchtgelb, gesperrt, in Grossbuchstaben (nur das Logo) */
	.wordmark {
		font-family: var(--font-display);
		font-weight: 600;
		font-size: 1.375rem;
		letter-spacing: 0.08em;
		text-transform: uppercase;
		color: var(--color-led);
	}

	/* Reiter auf der dunklen Tafel: hellgrau, der aktive weiss mit gelber Leuchtleiste */
	.site-header .tabs a {
		color: var(--color-board-label);
	}

	.site-header .tabs a:hover {
		color: var(--color-board-text);
	}

	.site-header .tabs a[aria-current='page'] {
		color: var(--color-board-text);
		border-bottom-color: var(--color-led);
	}

	/* Türkiser Fokusrahmen hat auf Schwarz zu wenig Kontrast: hier gelb */
	.site-header :focus-visible {
		outline-color: var(--color-led);
	}

	.storage-error {
		box-sizing: border-box;
		width: min(46rem, calc(100% - 2 * var(--space-4)));
		margin: var(--space-4) auto 0;
		padding: var(--space-3) var(--space-4);
		border: 2px solid var(--color-danger);
		border-radius: var(--radius-lg);
		color: var(--color-danger);
	}

	.storage-error p {
		margin: 0 0 var(--space-2);
	}

	footer {
		margin-top: var(--space-12);
		color: var(--color-muted);
		font-size: var(--text-sm);
	}

	footer .links a {
		display: inline-block;
		padding-block: var(--space-2);
	}
</style>
