<script lang="ts">
	import { liveQuery } from 'dexie';
	import { resolve } from '$app/paths';
	import { page } from '$app/state';
	import {
		addMonths,
		calendarItems,
		isMonth,
		layoutWeek,
		monthLabel,
		monthOf,
		monthWeeks,
		type CalendarItem
	} from '#lib/calendar.ts';
	import { db } from '#lib/db.ts';
	import { daysBetween, formatDate, formatDateRange, relativeDays, todayIso } from '#lib/dates.ts';
	import { COURSE_LABEL, type Competition } from '#lib/model.ts';

	// liveQuery aktualisiert die Ansicht automatisch, sobald sich die Datenbank ändert
	const competitions = liveQuery(() => db.competitions.orderBy('startDate').toArray());
	const today = todayIso();

	// Ansicht und Monat stehen in der Adresse, damit "Zurück" am selben Ort landet
	const view = $derived(page.url.searchParams.get('ansicht') === 'liste' ? 'liste' : 'monat');
	const month = $derived.by(() => {
		const param = page.url.searchParams.get('monat') ?? '';
		return isMonth(param) ? param : monthOf(today);
	});

	function href(next: { monat?: string; ansicht?: 'monat' | 'liste' }) {
		const params = new URLSearchParams();
		const m = next.monat ?? month;
		if ((next.ansicht ?? view) === 'liste') params.set('ansicht', 'liste');
		else if (m !== monthOf(today)) params.set('monat', m);
		const query = params.toString();
		return query ? resolve(`/?${query}`) : resolve('/');
	}

	// Monatsansicht
	const items = $derived(calendarItems($competitions ?? []));
	const weeks = $derived(
		monthWeeks(month).map((days) => {
			const placed = layoutWeek(days, items);
			return { days, placed, lanes: Math.max(0, ...placed.map((p) => p.lane + 1)) };
		})
	);
	/** Wettkämpfe, die im Monat stattfinden oder deren Meldeschluss im Monat liegt */
	const inMonth = $derived(
		($competitions ?? []).filter(
			(c) =>
				(monthOf(c.startDate) <= month && monthOf(c.endDate ?? c.startDate) >= month) ||
				(c.entryDeadline && monthOf(c.entryDeadline) === month)
		)
	);

	// Listenansicht
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

	function chipLabel(item: CalendarItem): string {
		const c = item.competition;
		return item.kind === 'deadline'
			? `Meldeschluss ${c.name}, ${formatDate(item.start)}`
			: `${c.name}, ${formatDateRange(c.startDate, c.endDate)}, ${COURSE_LABEL[c.course]}`;
	}

	const WEEKDAYS = ['Mo', 'Di', 'Mi', 'Do', 'Fr', 'Sa', 'So'];
</script>

<svelte:head>
	<title>Kalender – Schwimmplaner</title>
</svelte:head>

<h1>Wettkampfkalender</h1>

<div class="toolbar">
	<nav class="views" aria-label="Ansicht">
		<a
			href={href({ ansicht: 'monat' })}
			aria-current={view === 'monat' ? 'page' : undefined}
			data-sveltekit-replacestate
			data-sveltekit-noscroll>Monat</a
		>
		<a
			href={href({ ansicht: 'liste' })}
			aria-current={view === 'liste' ? 'page' : undefined}
			data-sveltekit-replacestate
			data-sveltekit-noscroll>Liste</a
		>
	</nav>
	<a class="button small" href={resolve('/wettkampf/bearbeiten')}>Wettkampf hinzufügen</a>
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
{:else if view === 'monat'}
	<div class="month-head">
		<h2 aria-live="polite">{monthLabel(month)}</h2>
		<div class="month-nav">
			<a
				class="button secondary small"
				href={href({ monat: monthOf(today) })}
				data-sveltekit-replacestate
				data-sveltekit-noscroll
				data-sveltekit-keepfocus>Heute</a
			>
			<a
				class="button secondary small arrow"
				href={href({ monat: addMonths(month, -1) })}
				aria-label="Vorheriger Monat"
				data-sveltekit-replacestate
				data-sveltekit-noscroll
				data-sveltekit-keepfocus>‹</a
			>
			<a
				class="button secondary small arrow"
				href={href({ monat: addMonths(month, 1) })}
				aria-label="Nächster Monat"
				data-sveltekit-replacestate
				data-sveltekit-noscroll
				data-sveltekit-keepfocus>›</a
			>
		</div>
	</div>

	<div class="calendar">
		<div class="weekdays" aria-hidden="true">
			{#each WEEKDAYS as day (day)}<div>{day}</div>{/each}
		</div>
		{#each weeks as week (week.days[0])}
			<div class="week" style:--lanes={week.lanes}>
				{#each week.days as day, i (day)}
					<div
						class="day"
						class:outside={monthOf(day) !== month}
						class:weekend={i >= 5}
						style:grid-column={i + 1}
					>
						<span class="num" class:today={day === today} aria-hidden="true"
							>{Number(day.slice(8))}</span
						>
						<!-- Nur für die Maus: per Tastatur gibt es oben "Wettkampf hinzufügen", sonst wären es 35 Tabstopps -->
						<a
							class="add"
							tabindex="-1"
							href={resolve(`/wettkampf/bearbeiten?datum=${day}`)}
							aria-label="Wettkampf am {formatDate(day)} hinzufügen">+</a
						>
					</div>
				{/each}
				{#each week.placed as p (p.item.key)}
					<a
						class="chip {p.item.kind} {p.item.competition.course.toLowerCase()}"
						class:before={p.continuesBefore}
						class:after={p.continuesAfter}
						style:grid-column="{p.col + 1} / span {p.span}"
						style:grid-row={p.lane + 2}
						href={resolve(`/wettkampf?id=${p.item.competition.id}`)}
						aria-label={chipLabel(p.item)}
						title={chipLabel(p.item)}
					>
						<!-- Meldeschluss erkennt man am gestrichelten Rahmen (Legende), der volle Text steht im Label -->
						{p.item.competition.name}
					</a>
				{/each}
			</div>
		{/each}
	</div>

	<ul class="legend" aria-label="Legende">
		<li><span class="swatch scm"></span>{COURSE_LABEL.SCM}</li>
		<li><span class="swatch lcm"></span>{COURSE_LABEL.LCM}</li>
		<li><span class="swatch deadline"></span>Meldeschluss (gestrichelt)</li>
	</ul>

	<h2>Im {monthLabel(month)}</h2>
	{#if inMonth.length === 0}
		<p>Keine Wettkämpfe in diesem Monat.</p>
	{:else}
		<ul class="plain">
			{#each inMonth as c (c.id)}{@render item(c, true)}{/each}
		</ul>
	{/if}
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

	.toolbar {
		display: flex;
		flex-wrap: wrap;
		align-items: center;
		justify-content: space-between;
		gap: 0.75rem;
		margin: 1rem 0;
		border-bottom: 1px solid var(--color-line);
	}

	/* Ansichten wie die Tabs in Notion */
	.views {
		display: flex;
		gap: 1rem;
	}

	.views a {
		padding: 0.4rem 0;
		color: var(--color-muted);
		text-decoration: none;
		border-bottom: 2px solid transparent;
		margin-bottom: -1px;
	}

	.views a[aria-current='page'] {
		color: var(--color-text);
		font-weight: 600;
		border-bottom-color: var(--color-text);
	}

	.toolbar .button {
		margin-bottom: 0.5rem;
	}

	.month-head {
		display: flex;
		flex-wrap: wrap;
		align-items: center;
		justify-content: space-between;
		gap: 0.5rem;
	}

	.month-head h2 {
		margin: 0.5rem 0;
	}

	.month-nav {
		display: flex;
		gap: 0.35rem;
	}

	.month-nav .button {
		min-width: 2.25rem;
		text-align: center;
	}

	.month-nav .arrow {
		font-size: 1.2rem;
		line-height: 1.1;
	}

	.calendar {
		margin-top: 0.75rem;
		border-top: 1px solid var(--color-line);
		border-right: 1px solid var(--color-line);
	}

	.weekdays,
	.week {
		display: grid;
		grid-template-columns: repeat(7, minmax(0, 1fr));
	}

	.weekdays div {
		padding: 0.25rem 0.5rem;
		font-size: 0.8rem;
		color: var(--color-muted);
		border-left: 1px solid var(--color-line);
		border-bottom: 1px solid var(--color-line);
	}

	/* Zeile 1 = Tageszahl, darunter eine Zeile pro Balken, der Rest füllt die Höhe */
	.week {
		grid-template-rows: 1.9rem repeat(var(--lanes), auto) 1fr;
		min-height: 6.5rem;
	}

	.day {
		grid-row: 1 / -1;
		position: relative;
		border-left: 1px solid var(--color-line);
		border-bottom: 1px solid var(--color-line);
	}

	.day.weekend {
		background: var(--color-weekend);
	}

	/* Tage aus dem Vor- und Folgemonat: grau, aber mit genug Kontrast (7:1) */
	.day.outside {
		background: var(--color-weekend);
	}

	.day.outside .num {
		color: var(--color-muted);
	}

	.num {
		display: inline-grid;
		place-items: center;
		min-width: 1.5rem;
		height: 1.5rem;
		margin: 0.2rem 0.3rem;
		font-size: 0.85rem;
		font-variant-numeric: tabular-nums;
		border-radius: 999px;
	}

	.num.today {
		background: var(--color-today);
		color: #fff;
		font-weight: 700;
	}

	/* "+" erscheint wie in Notion erst beim Darüberfahren */
	.add {
		position: absolute;
		top: 0.2rem;
		right: 0.3rem;
		width: 1.5rem;
		height: 1.5rem;
		display: grid;
		place-items: center;
		border-radius: 4px;
		color: var(--color-muted);
		text-decoration: none;
		font-size: 1.1rem;
		line-height: 1;
		opacity: 0;
	}

	.add:hover {
		background: var(--color-surface);
	}

	@media (hover: hover) {
		.day:hover .add,
		.add:focus-visible {
			opacity: 1;
		}
	}

	@media (hover: none) {
		.add {
			display: none;
		}
	}

	/* Mindestens 24 px hoch, damit man auch auf dem Handy sicher trifft (WCAG 2.5.8) */
	.chip {
		position: relative;
		z-index: 1;
		display: block;
		line-height: 22px;
		margin: 1px 4px;
		padding: 1px 0.35rem;
		border-radius: 4px;
		font-size: 0.8rem;
		white-space: nowrap;
		overflow: hidden;
		text-overflow: ellipsis;
		text-decoration: none;
		color: var(--color-text);
	}

	.chip:hover {
		filter: brightness(0.95);
	}

	.chip.scm {
		background: var(--color-scm);
	}

	.chip.lcm {
		background: var(--color-lcm);
	}

	/* Rahmen statt Innenabstand oben und unten, die Höhe bleibt 24 px */
	.chip.deadline {
		padding-block: 0;
		background: var(--color-bg);
		border: 1px dashed var(--color-warning);
		color: var(--color-warning);
	}

	/* Balken, die in der Woche davor oder danach weiterlaufen, haben eckige Kanten */
	.chip.before {
		margin-left: 0;
		border-top-left-radius: 0;
		border-bottom-left-radius: 0;
	}

	.chip.after {
		margin-right: 0;
		border-top-right-radius: 0;
		border-bottom-right-radius: 0;
	}

	.legend {
		display: flex;
		flex-wrap: wrap;
		gap: 0.25rem 1.25rem;
		list-style: none;
		padding: 0;
		font-size: 0.85rem;
		color: var(--color-muted);
	}

	.legend li {
		display: flex;
		align-items: center;
		gap: 0.4rem;
	}

	.swatch {
		display: inline-block;
		width: 1rem;
		height: 0.75rem;
		border-radius: 3px;
	}

	.swatch.scm {
		background: var(--color-scm);
	}

	.swatch.lcm {
		background: var(--color-lcm);
	}

	.swatch.deadline {
		border: 1px dashed var(--color-warning);
	}

	/* Auf dem Handy sind die Tage nur gut 3 rem breit */
	@media (max-width: 30rem) {
		.week {
			min-height: 4.5rem;
			grid-template-rows: 1.6rem repeat(var(--lanes), auto) 1fr;
		}

		.weekdays div {
			padding: 0.2rem;
			text-align: center;
		}

		/* Feste Grösse, sonst wird der Kreis für "heute" zum Balken */
		.num {
			display: grid;
			width: 1.3rem;
			min-width: 0;
			height: 1.3rem;
			margin: 0.15rem auto;
			padding: 0;
			font-size: 0.75rem;
		}

		.chip {
			margin: 1px 1px;
			padding: 1px 0.15rem;
			font-size: 0.65rem;
			text-overflow: clip;
		}
	}
</style>
