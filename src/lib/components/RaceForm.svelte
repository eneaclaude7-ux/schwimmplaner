<script lang="ts">
	import { onMount, tick, untrack } from 'svelte';
	import { errorAnnouncement, focusFirstError } from '#lib/forms.ts';
	import { datesInRange, formatDate } from '#lib/dates.ts';
	import {
		allowedDistances,
		STATUS_LABEL,
		STROKE_LABEL,
		type Competition,
		type Race,
		type RaceStatus,
		type Stroke
	} from '#lib/model.ts';
	import { saveRace } from '#lib/repo.ts';
	import { detectInterval, parseSplits, splitsToValues, type SplitInput } from '#lib/splits.ts';
	import { formatTime, parseTime } from '#lib/time.ts';
	import { validateRace, type RaceInput } from '#lib/validation.ts';
	import SplitFields from './SplitFields.svelte';

	interface Props {
		competition: Competition;
		/** Leer = neuer Lauf */
		race?: Race;
		/** Direkt die Endzeit erfassen: Status steht auf geschwommen, Fokus im Feld Endzeit */
		enterResult?: boolean;
		/** Bekommt die ID des gespeicherten Laufs */
		onsaved: (id: string) => void;
		oncancel?: () => void;
	}

	let { competition, race, enterResult = false, onsaved, oncancel }: Props = $props();

	// Startwerte einmal übernehmen. Wechselt der bearbeitete Lauf, baut die Seite
	// das Formular neu auf ({#key}), darum muss hier nichts nachgeführt werden.
	const initial = untrack(() => race);
	const meet = untrack(() => competition);
	let form = $state<RaceInput>({
		stroke: initial?.stroke ?? '',
		distance: initial ? String(initial.distance) : '',
		date: initial?.date ?? meet.startDate,
		target: initial?.target !== undefined ? formatTime(initial.target) : '',
		status: untrack(() => enterResult) ? 'finished' : (initial?.status ?? 'planned'),
		result: initial?.result !== undefined ? formatTime(initial.result) : ''
	});
	let errors = $state<Partial<Record<keyof RaceInput, string>>>({});

	// Zwischenzeiten: gespeichert kumuliert, im Formular wahlweise als Laps
	function freshSplits(distance: number): SplitInput {
		return {
			mode: 'cumulative',
			interval: detectInterval([], distance, meet.course) ?? 50,
			values: {}
		};
	}
	let splitInput = $state<SplitInput>(
		initial && initial.splits.length > 0
			? (() => {
					const interval = detectInterval(initial.splits, initial.distance, meet.course) ?? 50;
					const values = splitsToValues(
						initial.splits,
						{ mode: 'cumulative', interval },
						initial.distance
					);
					return { mode: 'cumulative' as const, interval, values };
				})()
			: freshSplits(initial?.distance ?? 0)
	);
	let splitErrors = $state<Record<number, string>>({});
	const resultHs = $derived(parseTime(form.result) ?? undefined);
	let saving = $state(false);
	let formEl = $state<HTMLFormElement>();
	/** Meldung für Screenreader, falls der Fokus schon im fehlerhaften Feld war */
	let alert = $state('');

	const days = $derived(datesInRange(competition.startDate, competition.endDate));
	const distances = $derived(form.stroke ? allowedDistances(form.stroke, competition.course) : []);
	const prefix = $derived(race ? `race-${race.id}` : 'race-new');

	onMount(() => {
		if (enterResult) document.getElementById(`${prefix}-result`)?.focus();
	});

	/** Zeigt, wie eine Eingabe gelesen wird ("10920" = 1:09.20), wenn das nicht offensichtlich ist */
	function echo(text: string): string | undefined {
		const parsed = parseTime(text);
		if (parsed === null || !text.trim()) return undefined;
		const formatted = formatTime(parsed);
		return formatted === text.trim() ? undefined : `= ${formatted}`;
	}

	const strokes = Object.entries(STROKE_LABEL) as [Stroke, string][];
	const statuses = Object.entries(STATUS_LABEL) as [RaceStatus, string][];

	/** Die Fehlermeldung eines Feldes verschwindet, sobald man es ändert */
	function clearError(event: Event) {
		const field = (event.target as HTMLElement).id.slice(prefix.length + 1) as keyof RaceInput;
		if (errors[field]) errors = { ...errors, [field]: undefined };
	}

	async function submit(event: SubmitEvent) {
		event.preventDefault();
		const result = validateRace(form, competition);
		// Zwischenzeiten gibt es nur bei einem geschwommenen Lauf
		const splits =
			result.ok && result.value.status === 'finished'
				? parseSplits(splitInput, result.value.distance, result.value.result)
				: { ok: true as const, splits: [], warnings: [] };
		if (!result.ok || !splits.ok) {
			errors = result.ok ? {} : result.errors;
			splitErrors = splits.ok ? {} : splits.errors;
			alert = '';
			await tick();
			// Fokus auf das oberste fehlerhafte Feld, in der Reihenfolge auf dem Bildschirm
			if (formEl) focusFirstError(formEl);
			alert = errorAnnouncement(
				[...Object.values(errors), ...Object.values(splitErrors)].filter((m): m is string => !!m)
			);
			return;
		}
		errors = {};
		splitErrors = {};
		saving = true;
		try {
			onsaved(await saveRace({ ...result.value, splits: splits.splits }, competition.id, race?.id));
		} finally {
			saving = false;
		}
	}
</script>

<form bind:this={formEl} onsubmit={submit} oninput={clearError} onchange={clearError} novalidate>
	<p class="visually-hidden" aria-live="assertive">{alert}</p>
	<div class="grid-2">
		<div class="field">
			<label for="{prefix}-stroke">Lage</label>
			<select
				id="{prefix}-stroke"
				aria-required="true"
				bind:value={form.stroke}
				onchange={() => {
					// Strecke zurücksetzen, wenn es sie für die neue Lage nicht gibt (z. B. 1500 m Brust)
					if (!distances.includes(Number(form.distance))) {
						form.distance = '';
						splitInput = freshSplits(0);
					}
				}}
				aria-invalid={!!errors.stroke}
				aria-describedby={errors.stroke ? `${prefix}-stroke-error` : undefined}
			>
				<option value="" disabled>Bitte wählen</option>
				{#each strokes as [value, label] (value)}
					<option {value}>{label}</option>
				{/each}
			</select>
			{#if errors.stroke}<p id="{prefix}-stroke-error" class="error">{errors.stroke}</p>{/if}
		</div>

		<div class="field">
			<label for="{prefix}-distance">Strecke</label>
			<select
				id="{prefix}-distance"
				aria-required="true"
				bind:value={form.distance}
				onchange={() => {
					// Andere Strecke, andere Zwischenzeiten
					splitInput = freshSplits(Number(form.distance));
					splitErrors = {};
				}}
				disabled={!form.stroke}
				aria-invalid={!!errors.distance}
				aria-describedby={errors.distance ? `${prefix}-distance-error` : undefined}
			>
				<option value="" disabled>{form.stroke ? 'Bitte wählen' : 'Zuerst Lage wählen'}</option>
				{#each distances as distance (distance)}
					<option value={String(distance)}>{distance} m</option>
				{/each}
			</select>
			{#if errors.distance}
				<p id="{prefix}-distance-error" class="error">{errors.distance}</p>
			{/if}
		</div>
	</div>

	{#if days.length > 1}
		<div class="field">
			<label for="{prefix}-date">Tag</label>
			<select
				id="{prefix}-date"
				bind:value={form.date}
				aria-invalid={!!errors.date}
				aria-describedby={errors.date ? `${prefix}-date-error` : undefined}
			>
				{#each days as day (day)}
					<option value={day}>{formatDate(day)}</option>
				{/each}
			</select>
			{#if errors.date}<p id="{prefix}-date-error" class="error">{errors.date}</p>{/if}
		</div>
	{/if}

	<div class="grid-2">
		<div class="field">
			<label for="{prefix}-target">Zielzeit <span class="hint">(optional)</span></label>
			<input
				id="{prefix}-target"
				bind:value={form.target}
				inputmode="decimal"
				autocomplete="off"
				placeholder="1:09.20"
				aria-invalid={!!errors.target}
				aria-describedby="{prefix}-time-hint{errors.target ? ` ${prefix}-target-error` : ''}"
			/>
			{#if errors.target}
				<p id="{prefix}-target-error" class="error">{errors.target}</p>
			{:else if echo(form.target)}
				<p class="echo">{echo(form.target)}</p>
			{/if}
		</div>

		<div class="field">
			<label for="{prefix}-status">Status</label>
			<select id="{prefix}-status" bind:value={form.status}>
				{#each statuses as [value, label] (value)}
					<option {value}>{label}</option>
				{/each}
			</select>
		</div>
	</div>

	{#if form.status === 'finished'}
		<div class="field">
			<label for="{prefix}-result">Endzeit</label>
			<input
				id="{prefix}-result"
				aria-required="true"
				bind:value={form.result}
				inputmode="decimal"
				autocomplete="off"
				placeholder="1:09.20"
				aria-invalid={!!errors.result}
				aria-describedby="{prefix}-time-hint{errors.result ? ` ${prefix}-result-error` : ''}"
			/>
			{#if errors.result}
				<p id="{prefix}-result-error" class="error">{errors.result}</p>
			{:else if echo(form.result)}
				<p class="echo">{echo(form.result)}</p>
			{/if}
		</div>
	{/if}

	<p id="{prefix}-time-hint" class="hint">
		Zeiten als 1:09.20, 1.09.20 oder nur Ziffern (10920). Unter einer Minute: 34.20.
	</p>

	{#if form.status === 'finished'}
		{#if form.distance}
			<SplitFields
				distance={Number(form.distance)}
				course={competition.course}
				result={resultHs}
				bind:input={splitInput}
				bind:errors={splitErrors}
				{prefix}
			/>
		{/if}
	{/if}

	<div class="actions">
		<button class="button" type="submit" disabled={saving}>
			{race ? 'Lauf speichern' : 'Lauf hinzufügen'}
		</button>
		{#if oncancel}
			<button class="button secondary" type="button" onclick={oncancel}>Abbrechen</button>
		{/if}
	</div>
</form>

<style>
	/* Wie die Eingabe gelesen wird, direkt unter dem Feld */
	.echo {
		margin: 0;
		color: var(--color-muted);
		font-size: var(--text-sm);
		font-variant-numeric: tabular-nums;
	}
</style>
