<script lang="ts">
	// Erzeugt mit `npm run licenses` (scripts/generate-licenses.mjs)
	import licenses from '#lib/licenses.json';
</script>

<svelte:head>
	<title>Lizenzen – Schwimmplaner</title>
</svelte:head>

<h1>Lizenzen</h1>

<p>
	Der Schwimmplaner nutzt diese freien Bibliotheken. Ihre Lizenzen erlauben die Nutzung, verlangen
	aber, dass die Lizenztexte mitgeliefert werden. Hier stehen sie vollständig.
</p>
<p>
	Schriften: die Systemschriften deines Geräts, es wird keine Schrift geladen. Icons: selbst
	erstellt. Der Code des Schwimmplaners selbst steht unter keiner freien Lizenz, alle Rechte bleiben
	vorbehalten.
</p>

<ul class="plain">
	{#each licenses as lib (lib.name)}
		<li class="card">
			<strong>{lib.name}</strong>
			{lib.version} · {lib.license}
			{#if lib.url}
				· <a href={lib.url} rel="noopener noreferrer" target="_blank">Website</a>
			{/if}
			<details>
				<summary>Lizenztext</summary>
				<pre>{lib.text}</pre>
				{#if lib.notice}
					<p><strong>NOTICE</strong></p>
					<pre>{lib.notice}</pre>
				{/if}
			</details>
		</li>
	{/each}
</ul>

<style>
	.plain {
		list-style: none;
		padding: 0;
	}

	summary {
		cursor: pointer;
		color: var(--color-primary);
		font-weight: 600;
		margin-top: 0.25rem;
	}

	pre {
		white-space: pre-wrap;
		overflow-wrap: anywhere;
		font-size: 0.8rem;
		background: var(--color-bg);
		padding: 0.5rem;
		border-radius: var(--radius);
	}
</style>
