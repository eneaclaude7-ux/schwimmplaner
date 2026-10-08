<script lang="ts">
	import { untrack } from 'svelte';
	import type { Competition, Id, IsoDate } from '#lib/model.ts';
	import { saveCompetition } from '#lib/repo.ts';
	import { validateCompetition, type CompetitionInput } from '#lib/validation.ts';

	interface Props {
		/** Leer = neuer Wettkampf */
		competition?: Competition;
		/** Erster Tag für einen neuen Wettkampf, z. B. aus dem Kalender */
		startDate?: IsoDate;
		onsaved: (id: Id) => void;
	}

	let { competition, startDate, onsaved }: Props = $props();

	// Startwerte einmal aus dem Wettkampf übernehmen; danach gehört der Zustand dem Formular
	const initial = untrack(() => competition);
	let form = $state<CompetitionInput>({
		name: initial?.name ?? '',
		startDate: initial?.startDate ?? untrack(() => startDate) ?? '',
		endDate: initial?.endDate ?? '',
		location: initial?.location ?? '',
		entryDeadline: initial?.entryDeadline ?? '',
		course: initial?.course ?? ''
	});
	let errors = $state<Partial<Record<keyof CompetitionInput, string>>>({});
	let saving = $state(false);

	/** Die Fehlermeldung eines Feldes verschwindet, sobald man es ändert */
	function clearError(event: Event) {
		const target = event.target as HTMLInputElement;
		const field = (
			target.type === 'radio' ? 'course' : target.id.replace('competition-', '')
		) as keyof CompetitionInput;
		if (errors[field]) errors = { ...errors, [field]: undefined };
	}

	async function submit(event: SubmitEvent) {
		event.preventDefault();
		const result = validateCompetition(form);
		if (!result.ok) {
			errors = result.errors;
			// Fokus auf das erste fehlerhafte Feld, damit man es sofort sieht und hört
			const first = Object.keys(result.errors)[0];
			document.getElementById(`competition-${first}`)?.focus();
			return;
		}
		errors = {};
		saving = true;
		try {
			onsaved(await saveCompetition(result.value, competition?.id));
		} finally {
			saving = false;
		}
	}
</script>

<form onsubmit={submit} oninput={clearError} onchange={clearError} novalidate>
	<div class="field">
		<label for="competition-name">Name</label>
		<input
			id="competition-name"
			bind:value={form.name}
			autocomplete="off"
			aria-invalid={!!errors.name}
			aria-describedby={errors.name ? 'competition-name-error' : undefined}
		/>
		{#if errors.name}<p id="competition-name-error" class="error">{errors.name}</p>{/if}
	</div>

	<div class="grid-2">
		<div class="field">
			<label for="competition-startDate">Erster Tag</label>
			<input
				id="competition-startDate"
				type="date"
				bind:value={form.startDate}
				aria-invalid={!!errors.startDate}
				aria-describedby={errors.startDate ? 'competition-startDate-error' : undefined}
			/>
			{#if errors.startDate}
				<p id="competition-startDate-error" class="error">{errors.startDate}</p>
			{/if}
		</div>

		<div class="field">
			<label for="competition-endDate">Letzter Tag <span class="hint">(optional)</span></label>
			<input
				id="competition-endDate"
				type="date"
				bind:value={form.endDate}
				min={form.startDate || undefined}
				aria-invalid={!!errors.endDate}
				aria-describedby={errors.endDate ? 'competition-endDate-error' : 'competition-endDate-hint'}
			/>
			<p id="competition-endDate-hint" class="hint">Nur bei mehrtägigen Wettkämpfen.</p>
			{#if errors.endDate}
				<p id="competition-endDate-error" class="error">{errors.endDate}</p>
			{/if}
		</div>
	</div>

	<div class="field">
		<label for="competition-location">Ort</label>
		<input
			id="competition-location"
			bind:value={form.location}
			aria-invalid={!!errors.location}
			aria-describedby={errors.location ? 'competition-location-error' : undefined}
		/>
		{#if errors.location}
			<p id="competition-location-error" class="error">{errors.location}</p>
		{/if}
	</div>

	<div class="field">
		<label for="competition-entryDeadline">
			Meldeschluss <span class="hint">(optional)</span>
		</label>
		<input
			id="competition-entryDeadline"
			type="date"
			bind:value={form.entryDeadline}
			aria-invalid={!!errors.entryDeadline}
			aria-describedby={errors.entryDeadline ? 'competition-entryDeadline-error' : undefined}
		/>
		{#if errors.entryDeadline}
			<p id="competition-entryDeadline-error" class="error">{errors.entryDeadline}</p>
		{/if}
	</div>

	<fieldset aria-describedby={errors.course ? 'competition-course-error' : undefined}>
		<legend>Bahnlänge</legend>
		<div class="radio-row">
			<label>
				<input id="competition-course" type="radio" bind:group={form.course} value="SCM" />
				Kurzbahn (25 m)
			</label>
			<label>
				<input type="radio" bind:group={form.course} value="LCM" />
				Langbahn (50 m)
			</label>
		</div>
		{#if errors.course}<p id="competition-course-error" class="error">{errors.course}</p>{/if}
	</fieldset>

	<div class="actions">
		<button class="button" type="submit" disabled={saving}>Speichern</button>
	</div>
</form>
