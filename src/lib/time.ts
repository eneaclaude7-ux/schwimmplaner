import type { Hs } from './model';

/**
 * Liest eine Schwimmzeit ein und gibt Hundertstelsekunden zurück.
 * Erlaubt: "1:09.20", "1:09,20", "1.09.20", "69.20", "34.5", "15:32.10"
 * und nur Ziffern wie "10920" (Handy-Zahlentastatur hat keinen Doppelpunkt).
 * Ungültig: null.
 */
export function parseTime(input: string): Hs | null {
	let text = input.trim().replaceAll(',', '.');

	// "1.09.20": der erste Punkt trennt die Minuten
	if (/^\d{1,2}\.\d{2}\.\d{1,2}$/.test(text)) text = text.replace('.', ':');

	// Nur Ziffern: von rechts Hundertstel, Sekunden, Minuten ("10920" = 1:09.20)
	if (/^\d{3,6}$/.test(text)) {
		const hh = text.slice(-2);
		const ss = text.slice(-4, -2);
		const mm = text.slice(0, -4);
		text = mm ? `${mm}:${ss}.${hh}` : `${ss}.${hh}`;
	}

	// Nach einem Doppelpunkt müssen genau zwei Ziffern für die Sekunden folgen ("1:9" ist ungültig)
	const match = text.match(/^(?:(\d{1,2}):(?=\d{2}(?:\.|$)))?(\d{1,2})(?:\.(\d{1,2}))?$/);
	if (!match) return null;

	const [, min, sec, frac = '0'] = match;
	const minutes = min ? Number(min) : 0;
	const seconds = Number(sec);
	// Mit Minuten müssen die Sekunden unter 60 liegen, sonst ist "1:75.00" ein Tippfehler
	if (min && seconds >= 60) return null;

	const hundredths = Number(frac.padEnd(2, '0'));
	return (minutes * 60 + seconds) * 100 + hundredths;
}

/** Formatiert Hundertstelsekunden: 6920 -> "1:09.20", 3420 -> "34.20" */
export function formatTime(hs: Hs): string {
	const minutes = Math.floor(hs / 6000);
	const seconds = Math.floor((hs % 6000) / 100);
	const hundredths = hs % 100;
	const ss = String(seconds).padStart(minutes > 0 ? 2 : 1, '0');
	const hh = String(hundredths).padStart(2, '0');
	return minutes > 0 ? `${minutes}:${ss}.${hh}` : `${ss}.${hh}`;
}

/** Formatiert eine Differenz mit Vorzeichen in Sekunden: -120 -> "−1.20 s" */
export function formatDiff(hs: Hs): string {
	const sign = hs < 0 ? '−' : hs > 0 ? '+' : '±';
	return `${sign}${formatTime(Math.abs(hs))} s`;
}
