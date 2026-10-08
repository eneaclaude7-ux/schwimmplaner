<script lang="ts">
	import { liveQuery } from 'dexie';
	import { goto } from '$app/navigation';
	import { resolve } from '$app/paths';
	import { page } from '$app/state';
	import CompetitionForm from '#lib/components/CompetitionForm.svelte';
	import { db } from '#lib/db.ts';
	import { isIsoDate } from '#lib/dates.ts';

	// Ohne ?id= wird ein neuer Wettkampf angelegt, ?datum= kommt vom "+" im Kalender
	const id = $derived(page.url.searchParams.get('id'));
	const date = $derived.by(() => {
		const param = page.url.searchParams.get('datum') ?? '';
		return isIsoDate(param) ? param : undefined;
	});
	// undefined = lädt noch, null = nicht gefunden
	const competition = $derived(
		liveQuery(async () => (id ? ((await db.competitions.get(id)) ?? null) : null))
	);

	function backHref() {
		return id ? resolve(`/wettkampf?id=${id}`) : resolve('/');
	}
</script>

<svelte:head>
	<title>{id ? 'Wettkampf bearbeiten' : 'Neuer Wettkampf'} – Schwimmplaner</title>
</svelte:head>

<h1>{id ? 'Wettkampf bearbeiten' : 'Neuer Wettkampf'}</h1>

{#if !id}
	<CompetitionForm startDate={date} onsaved={(newId) => goto(resolve(`/wettkampf?id=${newId}`))} />
{:else if $competition === undefined}
	<p>Lade …</p>
{:else if $competition === null}
	<p>Diesen Wettkampf gibt es nicht (mehr).</p>
{:else}
	{#key $competition.id}
		<CompetitionForm competition={$competition} onsaved={() => goto(backHref())} />
	{/key}
{/if}

<p><a href={backHref()}>Zurück</a></p>
