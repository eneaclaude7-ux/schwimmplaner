<script lang="ts">
	import '../app.css';
	import { page } from '$app/state';
	import { resolve } from '$app/paths';
	import favicon from '#lib/assets/favicon.svg';
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

<header>
	<a class="app-name" href={resolve('/')}>Schwimmplaner</a>
	<nav class="tabs" aria-label="Hauptnavigation">
		{#each links as link (link.href)}
			<a href={link.href} aria-current={isCurrent(link.href) ? 'page' : undefined}>{link.label}</a>
		{/each}
	</nav>
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
	header,
	main,
	footer {
		max-width: 48rem;
		margin: 0 auto;
		padding: 0 var(--space-4);
	}

	header {
		display: flex;
		flex-wrap: wrap;
		align-items: center;
		justify-content: space-between;
		gap: var(--space-2) var(--space-4);
		padding-block: var(--space-1) 0;
		border-bottom: 1px solid var(--color-line);
	}

	.app-name {
		font-weight: 700;
		text-decoration: none;
	}

	/* Die Reiter sitzen auf der Linie unter dem Kopf */
	nav {
		margin-bottom: -1px;
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
