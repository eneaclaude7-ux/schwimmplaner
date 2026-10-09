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
	Schriften: Barlow Semi Condensed für Überschriften und Zeiten (wird mit der App ausgeliefert,
	nicht von einem fremden Server geladen) und die Systemschrift deines Geräts. Logo und App-Icons:
	selbst erstellt. Symbole in der Navigation: Tabler Icons, ebenfalls mitgeliefert. Der Code des
	Schwimmplaners selbst steht unter keiner freien Lizenz, alle Rechte bleiben vorbehalten.
</p>

<ul class="plain">
	{#each licenses as lib (lib.name)}
		<li class="card">
			<strong>{lib.name}</strong>
			{lib.version} · {lib.license}
			{#if lib.url}
				· <a href={lib.url} rel="noopener noreferrer" target="_blank"
					>Website<span class="visually-hidden"> von {lib.name}, öffnet ein neues Fenster</span></a
				>
			{/if}
			<details>
				<summary>Lizenztext<span class="visually-hidden"> {lib.name}</span></summary>
				<!-- Die Lizenztexte sind englisch: Screenreader sollen sie nicht mit deutscher Stimme lesen -->
				<pre lang="en">{lib.text}</pre>
				{#if lib.notice}
					<p lang="en"><strong>NOTICE</strong></p>
					<pre lang="en">{lib.notice}</pre>
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
		margin-top: var(--space-1);
	}

	pre {
		white-space: pre-wrap;
		overflow-wrap: anywhere;
		font-size: var(--text-xs);
		background: var(--color-bg);
		padding: var(--space-2);
		border-radius: var(--radius-md);
	}
</style>
