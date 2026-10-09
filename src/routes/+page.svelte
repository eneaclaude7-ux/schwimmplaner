<script lang="ts">
	import { liveQuery } from 'dexie';
	import Loading from '#lib/components/Loading.svelte';
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
		nextDeadline,
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

	/** Der nächste offene Meldeschluss, egal in welchem Monat: das Erste, was man sehen soll */
	const next = $derived(nextDeadline($competitions ?? [], today));
	const nextInfo = $derived(next?.entryDeadline ? deadline(next) : null);

	/** Der nächste kommende Wettkampf wird in der Liste hervorgehoben */
	const nextUpId = $derived(upcoming[0]?.id);

	const WEEKDAYS = ['Mo', 'Di', 'Mi', 'Do', 'Fr', 'Sa', 'So'];
</script>

<svelte:head>
	<title>Kalender – Schwimmplaner</title>
</svelte:head>

<!-- Der Seitentitel steht schon in der Navigation; sichtbar ist zuerst der nächste Meldeschluss -->
<h1 class="visually-hidden">Wettkampfkalender</h1>

{#if next && nextInfo}
	<a
		class="next-deadline board"
		class:soon={nextInfo.soon}
		href={resolve(`/wettkampf?id=${next.id}`)}
	>
		<span class="label board-label">Nächster Meldeschluss</span>
		<span class="what"><strong>{next.name}</strong></span>
		<span class="when led">{formatDate(next.entryDeadline!)} · {relativeDays(nextInfo.days)}</span>
	</a>
{/if}

<div class="toolbar">
	<nav class="tabs" aria-label="Ansicht">
		<a
			href={href({ ansicht: 'monat' })}
			aria-current={view === 'monat' ? 'page' : undefined}
			data-sveltekit-replacestate
			data-sveltekit-reset="false">Monat</a
		>
		<a
			href={href({ ansicht: 'liste' })}
			aria-current={view === 'liste' ? 'page' : undefined}
			data-sveltekit-replacestate
			data-sveltekit-reset="false">Liste</a
		>
	</nav>
	<a class="button small" href={resolve('/wettkampf/bearbeiten')}>Wettkampf hinzufügen</a>
</div>

{#snippet item(c: Competition, showDeadline: boolean)}
	{@const d = showDeadline ? deadline(c) : null}
	{@const isPast = (c.endDate ?? c.startDate) < today}
	<li class="card meet" class:next={c.id === nextUpId} class:past={isPast}>
		<a class="stretched" href={resolve(`/wettkampf?id=${c.id}`)}><strong>{c.name}</strong></a>
		<div>{formatDateRange(c.startDate, c.endDate)} · {c.location}</div>
		<div><span class="badge">{COURSE_LABEL[c.course]}</span></div>
		{#if d && c.entryDeadline}
			<div class:warning={d.soon}>
				Meldeschluss {formatDate(c.entryDeadline)} ({relativeDays(d.days)})
			</div>
		{/if}
	</li>
{/snippet}

{#snippet empty()}
	<div class="empty">
		<p><strong>Noch keine Wettkämpfe erfasst.</strong></p>
		<p>
			Trag den nächsten Wettkampf mit Datum und Meldeschluss ein. Resultate von früheren Wettkämpfen
			kannst du auch aus einer Lenex-Datei übernehmen.
		</p>
		<div class="actions">
			<a class="button" href={resolve('/wettkampf/bearbeiten')}>Ersten Wettkampf eintragen</a>
			<a class="button secondary" href={resolve('/daten')}>Lenex-Datei einlesen</a>
		</div>
	</div>
{/snippet}

{#if $competitions === undefined}
	<Loading />
{:else if view === 'monat'}
	<div class="month-head">
		<h2 aria-live="polite">{monthLabel(month)}</h2>
		<div class="month-nav">
			<a
				class="button secondary small"
				href={href({ monat: monthOf(today) })}
				data-sveltekit-replacestate
				data-sveltekit-reset="false">Heute</a
			>
			<a
				class="button secondary small arrow"
				href={href({ monat: addMonths(month, -1) })}
				aria-label="Vorheriger Monat"
				data-sveltekit-replacestate
				data-sveltekit-reset="false">‹</a
			>
			<a
				class="button secondary small arrow"
				href={href({ monat: addMonths(month, 1) })}
				aria-label="Nächster Monat"
				data-sveltekit-replacestate
				data-sveltekit-reset="false">›</a
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
							aria-hidden="true"
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
						class:short={p.span < 3}
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
	{#if $competitions.length === 0}
		{@render empty()}
	{:else if inMonth.length === 0}
		<p>Keine Wettkämpfe in diesem Monat.</p>
	{:else}
		<ul class="plain">
			{#each inMonth as c (c.id)}{@render item(c, true)}{/each}
		</ul>
	{/if}
{:else if $competitions.length === 0}
	{@render empty()}
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
		gap: var(--space-3);
		margin: var(--space-4) 0;
		border-bottom: 1px solid var(--color-line);
	}

	/* Die Reiter sitzen auf der Linie der Werkzeugleiste */
	.toolbar .tabs {
		margin-bottom: -1px;
	}

	/* Nächster Meldeschluss: das Erste auf der Startseite, als Anzeigetafel */
	.next-deadline {
		display: grid;
		grid-template-columns: 1fr auto;
		align-items: baseline;
		gap: 0 var(--space-4);
		margin-top: var(--space-6);
		padding: var(--space-3) var(--space-4);
		text-decoration: none;
	}

	.next-deadline:hover {
		outline: 2px solid var(--color-board-line);
	}

	.next-deadline .label {
		grid-column: 1 / -1;
		font-size: var(--text-sm);
	}

	.next-deadline .what {
		font-family: var(--font-display);
		font-size: 1.375rem;
		color: var(--color-board-text);
	}

	.next-deadline .what strong {
		font-weight: 600;
	}

	.next-deadline .when {
		font-size: 1.25rem;
	}

	/* Ohne Dringlichkeit leuchtet das Datum nicht, bei 7 Tagen oder weniger schon */
	.next-deadline:not(.soon) .when {
		color: var(--color-board-text);
	}

	/* Ganze Karte antippbar: der Link spannt sich über die Karte */
	.meet {
		position: relative;
	}

	/* Wettkampfnamen in der Tafel-Schrift, wie die Überschriften */
	.meet .stretched strong {
		font-family: var(--font-display);
		font-size: var(--text-lg);
		font-weight: 600;
	}

	.stretched::after {
		content: '';
		position: absolute;
		inset: 0;
		border-radius: inherit;
	}

	.meet.next {
		background: var(--color-bg);
		border: 1px solid var(--color-primary);
	}

	.meet.past {
		background: transparent;
		border: 1px solid var(--color-line);
		color: var(--color-muted);
	}

	.empty {
		padding: var(--space-4);
		border: 1px dashed var(--color-border);
		border-radius: var(--radius-lg);
	}

	.empty p {
		margin: 0 0 var(--space-2);
	}

	.toolbar .button {
		margin-bottom: var(--space-2);
	}

	.month-head {
		display: flex;
		flex-wrap: wrap;
		align-items: center;
		justify-content: space-between;
		gap: var(--space-2);
	}

	.month-head h2 {
		margin: var(--space-2) 0;
	}

	.month-nav {
		display: flex;
		gap: var(--space-2);
	}

	.month-nav .button {
		min-width: 2.25rem;
		text-align: center;
	}

	.month-nav .arrow {
		font-size: var(--text-lg);
		line-height: 1.1;
	}

	.calendar {
		margin-top: var(--space-3);
		border-top: 1px solid var(--color-line);
		border-right: 1px solid var(--color-line);
	}

	.weekdays,
	.week {
		display: grid;
		grid-template-columns: repeat(7, minmax(0, 1fr));
	}

	.weekdays div {
		padding: var(--space-1) var(--space-2);
		font-size: var(--text-xs);
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
		background: var(--color-outside);
	}

	.day.outside .num {
		color: var(--color-muted);
	}

	.num {
		display: inline-grid;
		place-items: center;
		min-width: 1.5rem;
		height: 1.5rem;
		margin: var(--space-1) var(--space-1);
		font-size: var(--text-sm);
		font-variant-numeric: tabular-nums;
		border-radius: var(--radius-full);
	}

	.num.today {
		background: var(--color-today);
		color: var(--color-on-today);
		font-weight: 700;
	}

	/* "+" erscheint wie in Notion erst beim Darüberfahren */
	.add {
		position: absolute;
		top: var(--space-1);
		right: var(--space-1);
		width: 1.5rem;
		height: 1.5rem;
		display: grid;
		place-items: center;
		border-radius: var(--radius-sm);
		color: var(--color-muted);
		text-decoration: none;
		font-size: var(--text-lg);
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
		z-index: var(--z-raised);
		display: block;
		line-height: 22px;
		margin: 1px 4px;
		padding: 1px var(--space-2);
		border-radius: var(--radius-sm);
		font-size: var(--text-xs);
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
		gap: var(--space-1) var(--space-5);
		list-style: none;
		padding: 0;
		font-size: var(--text-sm);
		color: var(--color-muted);
	}

	.legend li {
		display: flex;
		align-items: center;
		gap: var(--space-2);
	}

	.swatch {
		display: inline-block;
		width: 1rem;
		height: 0.75rem;
		border-radius: var(--radius-sm);
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
		/* Datum unter den Namen statt daneben, sonst bricht der Name mehrfach um */
		.next-deadline {
			grid-template-columns: 1fr;
		}

		.week {
			min-height: 4.5rem;
			grid-template-rows: 1.6rem repeat(var(--lanes), auto) 1fr;
		}

		.weekdays div {
			padding: var(--space-1);
			text-align: center;
		}

		/* Feste Grösse, sonst wird der Kreis für "heute" zum Balken */
		.num {
			display: grid;
			width: 1.3rem;
			min-width: 0;
			height: 1.3rem;
			margin: var(--space-1) auto;
			padding: 0;
			font-size: var(--text-xs);
		}

		.chip {
			margin: 1px 1px;
			padding: 1px var(--space-1);
			font-size: var(--text-2xs);
		}

		/* Kurze Balken sind zu schmal für lesbaren Text: nur Farbe, der Name steht in der Liste darunter */
		.chip.short {
			color: transparent;
		}
	}
</style>
