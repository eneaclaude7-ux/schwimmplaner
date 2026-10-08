<script lang="ts">
	import '../app.css';
	import { page } from '$app/state';
	import { resolve } from '$app/paths';
	import favicon from '#lib/assets/favicon.svg';
	import UpdateBanner from '#lib/components/UpdateBanner.svelte';
	import { requestPersistentStorage } from '#lib/storage.ts';
	import type { LayoutProps } from './$types';

	let { children }: LayoutProps = $props();

	$effect(() => {
		requestPersistentStorage();
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
	<nav aria-label="Hauptnavigation">
		{#each links as link (link.href)}
			<a href={link.href} aria-current={isCurrent(link.href) ? 'page' : undefined}>{link.label}</a>
		{/each}
	</nav>
</header>

<UpdateBanner />

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
		padding: 0 1rem;
	}

	header {
		display: flex;
		flex-wrap: wrap;
		align-items: center;
		justify-content: space-between;
		gap: 0.5rem 1rem;
		padding-block: 0.75rem;
		border-bottom: 1px solid var(--color-border);
	}

	.app-name {
		font-weight: 700;
		text-decoration: none;
	}

	nav {
		display: flex;
		gap: 1rem;
	}

	nav a {
		padding: 0.25rem 0;
	}

	nav a[aria-current='page'] {
		font-weight: 700;
		text-decoration-thickness: 3px;
	}

	footer {
		margin-top: 3rem;
		color: var(--color-muted);
		font-size: 0.9rem;
	}

	footer .links {
		margin-top: -0.5rem;
	}
</style>
