<script lang="ts">
	import { untrack } from 'svelte';
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
		onsaved: () => void;
		oncancel?: () => void;
	}

	let { competition, race, onsaved, oncancel }: Props = $props();

	// Startwerte einmal übernehmen. Wechselt der bearbeitete Lauf, baut die Seite
	// das Formular neu auf ({#key}), darum muss hier nichts nachgeführt werden.
	const initial = untrack(() => race);
	const meet = untrack(() => competition);
	let form = $state<RaceInput>({
		stroke: initial?.stroke ?? '',
		distance: initial ? String(initial.distance) : '',
		date: initial?.date ?? meet.startDate,
		target: initial?.target !== undefined ? formatTime(initial.target) : '',
		status: initial?.status ?? 'planned',
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

	const days = $derived(datesInRange(competition.startDate, competition.endDate));
	const distances = $derived(form.stroke ? allowedDistances(form.stroke, competition.course) : []);
	const prefix = $derived(race ? `race-${race.id}` : 'race-new');

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
			const first = result.ok
				? `split-${Object.keys(splitErrors)[0]}`
				: Object.keys(result.errors)[0];
			document.getElementById(`${prefix}-${first}`)?.focus();
			return;
		}
		errors = {};
		splitErrors = {};
		saving = true;
		try {
			await saveRace({ ...result.value, splits: splits.splits }, competition.id, race?.id);
			onsaved();
		} finally {
			saving = false;
		}
	}
</script>

<form onsubmit={submit} oninput={clearError} onchange={clearError} novalidate>
	<div class="grid-2">
		<div class="field">
			<label for="{prefix}-stroke">Lage</label>
			<select
				id="{prefix}-stroke"
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
			{#if errors.target}<p id="{prefix}-target-error" class="error">{errors.target}</p>{/if}
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
				bind:value={form.result}
				inputmode="decimal"
				autocomplete="off"
				placeholder="1:09.20"
				aria-invalid={!!errors.result}
				aria-describedby="{prefix}-time-hint{errors.result ? ` ${prefix}-result-error` : ''}"
			/>
			{#if errors.result}<p id="{prefix}-result-error" class="error">{errors.result}</p>{/if}
		</div>

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

	<p id="{prefix}-time-hint" class="hint">
		Zeiten als 1:09.20, 1.09.20 oder nur Ziffern (10920). Unter einer Minute: 34.20.
	</p>

	<div class="actions">
		<button class="button" type="submit" disabled={saving}>
			{race ? 'Lauf speichern' : 'Lauf hinzufügen'}
		</button>
		{#if oncancel}
			<button class="button secondary" type="button" onclick={oncancel}>Abbrechen</button>
		{/if}
	</div>
</form>
