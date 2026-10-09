<script module lang="ts">
	// Icons aus Tabler Icons (MIT, siehe Seite "Lizenzen"), mit der App ausgeliefert.
	// Nur die hier aufgeführten landen im Build. Eine Familie für die ganze App.
	import alertTriangle from '@tabler/icons/outline/alert-triangle.svg?raw';
	import arrowLeft from '@tabler/icons/outline/arrow-left.svg?raw';
	import calendar from '@tabler/icons/outline/calendar.svg?raw';
	import chartLine from '@tabler/icons/outline/chart-line.svg?raw';
	import chevronLeft from '@tabler/icons/outline/chevron-left.svg?raw';
	import chevronRight from '@tabler/icons/outline/chevron-right.svg?raw';
	import clock from '@tabler/icons/outline/clock.svg?raw';
	import database from '@tabler/icons/outline/database.svg?raw';
	import flag from '@tabler/icons/outline/flag.svg?raw';
	import home from '@tabler/icons/outline/home.svg?raw';
	import plus from '@tabler/icons/outline/plus.svg?raw';
	import trophy from '@tabler/icons/outline/trophy.svg?raw';

	const ICONS = {
		'alert-triangle': alertTriangle,
		'arrow-left': arrowLeft,
		calendar,
		'chart-line': chartLine,
		'chevron-left': chevronLeft,
		'chevron-right': chevronRight,
		clock,
		database,
		flag,
		home,
		plus,
		trophy
	};

	export type IconName = keyof typeof ICONS;

	/** Nur die Pfade aus der Tabler-Datei, ohne das äussere <svg> und den leeren Rahmen */
	function paths(svg: string): string {
		return svg
			.replace(/^[\s\S]*?<svg[^>]*>/, '')
			.replace(/<\/svg>\s*$/, '')
			.replace(/<path stroke="none" d="M0 0h24v24H0z" fill="none"\s*\/>/, '');
	}
</script>

<script lang="ts">
	interface Props {
		name: IconName;
		size?: number;
	}

	let { name, size = 20 }: Props = $props();
</script>

<!-- Strichstärke 1.75 passt zur Fliesstext-Stärke 400; die Bedeutung trägt immer der Text daneben -->
<svg
	width={size}
	height={size}
	viewBox="0 0 24 24"
	fill="none"
	stroke="currentColor"
	stroke-width="1.75"
	stroke-linecap="round"
	stroke-linejoin="round"
	aria-hidden="true"
	focusable="false">{@html paths(ICONS[name])}</svg
>
