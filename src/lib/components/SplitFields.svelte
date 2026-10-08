<script lang="ts">
	import type { Course, Hs } from '#lib/model.ts';
	import {
		fieldKeys,
		parseSplits,
		splitIntervals,
		splitsToValues,
		valuesToSplits,
		type SplitInput,
		type SplitMode
	} from '#lib/splits.ts';
	import SplitTable from './SplitTable.svelte';

	interface Props {
		distance: number;
		course: Course;
		/** Endzeit, sobald sie lesbar ist */
		result?: Hs;
		input: SplitInput;
		errors: Record<number, string>;
		/** Präfix für eindeutige IDs */
		prefix: string;
	}

	let {
		distance,
		course,
		result,
		input = $bindable(),
		errors = $bindable(),
		prefix
	}: Props = $props();

	const intervals = $derived(splitIntervals(distance, course));
	const keys = $derived(fieldKeys(input, distance));
	// Vorschau und Warnungen schon beim Tippen
	const preview = $derived(result !== undefined ? parseSplits(input, distance, result) : undefined);

	/** Eingegebene Zeiten beim Wechsel der Eingabeart oder des Abstands mitnehmen */
	function change(next: { mode?: SplitMode; interval?: number }) {
		const splits = valuesToSplits(input, distance);
		const target = { mode: next.mode ?? input.mode, interval: next.interval ?? input.interval };
		input = { ...target, values: splitsToValues(splits, target, distance, result) };
		errors = {};
	}

	function label(key: number): string {
		return input.mode === 'laps' ? `${key - input.interval}–${key} m` : `${key} m`;
	}
</script>

<fieldset class="splits">
	<legend>Zwischenzeiten <span class="hint">(optional)</span></legend>

	{#if intervals.length === 0}
		<p class="hint">Über {distance} m auf der Langbahn gibt es keine Zwischenzeiten.</p>
	{:else}
		<div class="grid-2">
			{#if intervals.length > 1}
				<div class="field">
					<label for="{prefix}-split-interval">Abstand</label>
					<select
						id="{prefix}-split-interval"
						value={input.interval}
						onchange={(e) => change({ interval: Number(e.currentTarget.value) })}
					>
						{#each intervals as interval (interval)}
							<option value={interval}>alle {interval} m</option>
						{/each}
					</select>
				</div>
			{/if}

			<fieldset>
				<legend>Eingabe als</legend>
				<div class="radio-row">
					<label>
						<input
							type="radio"
							name="{prefix}-split-mode"
							checked={input.mode === 'cumulative'}
							onchange={() => change({ mode: 'cumulative' })}
						/>
						Zeit ab Start
					</label>
					<label>
						<input
							type="radio"
							name="{prefix}-split-mode"
							checked={input.mode === 'laps'}
							onchange={() => change({ mode: 'laps' })}
						/>
						Lap-Zeiten
					</label>
				</div>
			</fieldset>
		</div>

		<p class="hint">
			{input.mode === 'laps'
				? 'Jeder Abschnitt einzeln, auch der letzte. Die Summe muss die Endzeit ergeben.'
				: 'Die Zeit, die die Uhr bei dieser Distanz zeigt. Leere Felder sind erlaubt.'}
		</p>

		<div class="split-grid">
			{#each keys as key (key)}
				<div class="field">
					<label for="{prefix}-split-{key}">{label(key)}</label>
					<input
						id="{prefix}-split-{key}"
						bind:value={input.values[key]}
						oninput={() => {
							if (errors[key]) errors = { ...errors, [key]: '' };
						}}
						inputmode="decimal"
						autocomplete="off"
						aria-invalid={!!errors[key]}
						aria-describedby={errors[key] ? `${prefix}-split-${key}-error` : undefined}
					/>
					{#if errors[key]}
						<p id="{prefix}-split-{key}-error" class="error">{errors[key]}</p>
					{/if}
				</div>
			{/each}
		</div>

		{#if preview?.ok}
			{#if preview.warnings.length > 0}
				<ul class="warning" aria-live="polite">
					{#each preview.warnings as warning (warning)}<li>{warning}</li>{/each}
				</ul>
				<p class="hint">Speichern geht trotzdem, falls die Zeiten so stimmen.</p>
			{/if}
			{#if preview.splits.length > 0 && result !== undefined}
				<SplitTable splits={preview.splits} {distance} {result} />
			{/if}
		{/if}
	{/if}
</fieldset>

<style>
	.splits {
		border-top: 1px solid var(--color-border);
		padding-top: 0.75rem;
	}

	.split-grid {
		display: grid;
		grid-template-columns: repeat(auto-fill, minmax(6.5rem, 1fr));
		column-gap: 0.75rem;
	}

	.split-grid label {
		font-weight: 400;
	}
</style>
