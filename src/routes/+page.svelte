<script lang="ts">
	import { liveQuery } from 'dexie';
	import { resolve } from '$app/paths';
	import { db } from '#lib/db.ts';
	import { daysBetween, formatDate, formatDateRange, relativeDays, todayIso } from '#lib/dates.ts';
	import { COURSE_LABEL, type Competition } from '#lib/model.ts';

	// liveQuery aktualisiert die Liste automatisch, sobald sich die Datenbank ändert
	const competitions = liveQuery(() => db.competitions.orderBy('startDate').toArray());
	const today = todayIso();

	const upcoming = $derived(
		($competitions ?? []).filter((c) => (c.endDate ?? c.startDate) >= today)
	);
	const past = $derived(
		($competitions ?? []).filter((c) => (c.endDate ?? c.startDate) < today).reverse()
	);

	/** Meldeschluss nur anzeigen, solange er nicht vorbei ist; Warnung ab 7 Tagen */
	function deadline(c: Competition) {
		if (!c.entryDeadline) return null;
		const days = daysBetween(today, c.entryDeadline);
		return { days, soon: days >= 0 && days <= 7 };
	}
</script>

<svelte:head>
	<title>Kalender – Schwimmplaner</title>
</svelte:head>

<h1>Wettkampfkalender</h1>

<div class="actions">
	<a class="button" href={resolve('/wettkampf/bearbeiten')}>Wettkampf hinzufügen</a>
</div>

{#snippet item(c: Competition, showDeadline: boolean)}
	{@const d = showDeadline ? deadline(c) : null}
	<li class="card">
		<a href={resolve(`/wettkampf?id=${c.id}`)}><strong>{c.name}</strong></a>
		<div>{formatDateRange(c.startDate, c.endDate)} · {c.location}</div>
		<div><span class="badge">{COURSE_LABEL[c.course]}</span></div>
		{#if d && c.entryDeadline}
			<div class:warning={d.soon}>
				Meldeschluss {formatDate(c.entryDeadline)} ({relativeDays(d.days)})
			</div>
		{/if}
	</li>
{/snippet}

{#if $competitions === undefined}
	<p>Lade …</p>
{:else if $competitions.length === 0}
	<p>Noch keine Wettkämpfe. Lege deinen ersten an.</p>
{:else}
	<h2>Kommende Wettkämpfe</h2>
	{#if upcoming.length === 0}
		<p>Keine geplant.</p>
	{:else}
		<ul class="plain">
			{#each upcoming as c (c.id)}{@render item(c, true)}{/each}
		</ul>
	{/if}

	{#if past.length > 0}
		<h2>Vergangene Wettkämpfe</h2>
		<ul class="plain">
			{#each past as c (c.id)}{@render item(c, false)}{/each}
		</ul>
	{/if}
{/if}

<style>
	.plain {
		list-style: none;
		padding: 0;
	}
</style>
