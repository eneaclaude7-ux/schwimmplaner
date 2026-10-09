// Erzeugt die App-Icons (PNG) ohne fremde Bibliotheken. Gleiche Bildmarke wie src/lib/assets/favicon.svg:
// "SP" in Leuchtsegmenten wie auf der Anzeigetafel, darunter die Welle.
// Eigenes Werk, darum keine Lizenzfragen. Aufruf: node scripts/generate-icons.mjs
import { deflateSync } from 'node:zlib';
import { mkdirSync, writeFileSync } from 'node:fs';

const BOARD = [16, 20, 24]; // #101418, --color-board
const LED = [245, 197, 24]; // #f5c518, --color-led
const WAVE = [31, 162, 184]; // #1fa2b8, --color-wave

const CRC_TABLE = Array.from({ length: 256 }, (_, n) => {
	let c = n;
	for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
	return c >>> 0;
});

function crc32(buf) {
	let c = 0xffffffff;
	for (const byte of buf) c = CRC_TABLE[(c ^ byte) & 0xff] ^ (c >>> 8);
	return (c ^ 0xffffffff) >>> 0;
}

function chunk(type, data) {
	const len = Buffer.alloc(4);
	len.writeUInt32BE(data.length);
	const body = Buffer.concat([Buffer.from(type, 'ascii'), data]);
	const crc = Buffer.alloc(4);
	crc.writeUInt32BE(crc32(body));
	return Buffer.concat([len, body, crc]);
}

function png(size, pixel) {
	const raw = Buffer.alloc(size * (size * 3 + 1));
	for (let y = 0; y < size; y++) {
		const row = y * (size * 3 + 1);
		raw[row] = 0; // Filter: keiner
		for (let x = 0; x < size; x++) {
			const [r, g, b] = pixel((x + 0.5) / size, (y + 0.5) / size, size);
			raw.set([r, g, b], row + 1 + x * 3);
		}
	}
	const ihdr = Buffer.alloc(13);
	ihdr.writeUInt32BE(size, 0);
	ihdr.writeUInt32BE(size, 4);
	ihdr.set([8, 2, 0, 0, 0], 8); // 8 Bit, RGB
	return Buffer.concat([
		Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
		chunk('IHDR', ihdr),
		chunk('IDAT', deflateSync(raw)),
		chunk('IEND', Buffer.alloc(0))
	]);
}

// Die Bildmarke aus favicon.svg im 64er-Raster: zehn abgerundete Segmente und eine Wellenlinie
const SEGMENTS = [
	[14, 13, 12, 5],
	[11, 15, 5, 13],
	[14, 27.5, 12, 5],
	[24, 31, 5, 13],
	[14, 41, 12, 5],
	[38, 13, 12, 5],
	[35, 15, 5, 13],
	[48, 15, 5, 13],
	[38, 27.5, 12, 5],
	[35, 31, 5, 13]
];
const CORNER = 1.5;

function inRoundedRect(x, y, [rx, ry, w, h]) {
	if (x < rx || x > rx + w || y < ry || y > ry + h) return false;
	// Abstand zur Ecke nur prüfen, wenn der Punkt im Eckbereich liegt
	const cx = Math.min(Math.max(x, rx + CORNER), rx + w - CORNER);
	const cy = Math.min(Math.max(y, ry + CORNER), ry + h - CORNER);
	return Math.hypot(x - cx, y - cy) <= CORNER;
}

function bezier(p0, p1, p2, p3, steps = 24) {
	return Array.from({ length: steps + 1 }, (_, i) => {
		const t = i / steps;
		const m = 1 - t;
		return [0, 1].map(
			(k) => m * m * m * p0[k] + 3 * m * m * t * p1[k] + 3 * m * t * t * p2[k] + t * t * t * p3[k]
		);
	});
}
const WAVE_LINE = [
	...bezier([11, 54], [17, 50], [23, 50], [29, 54]),
	...bezier([29, 54], [35, 58], [41, 58], [53, 52])
];
const WAVE_HALF = 1.75; // halbe Linienbreite (3.5 im SVG)

function distanceToWave(x, y) {
	let best = Infinity;
	for (let i = 1; i < WAVE_LINE.length; i++) {
		const [ax, ay] = WAVE_LINE[i - 1];
		const [bx, by] = WAVE_LINE[i];
		const dx = bx - ax;
		const dy = by - ay;
		// Zwei Kurvenstücke teilen sich einen Punkt: Segment der Länge null überspringen (sonst NaN)
		if (dx === 0 && dy === 0) continue;
		const t = Math.max(0, Math.min(1, ((x - ax) * dx + (y - ay) * dy) / (dx * dx + dy * dy)));
		best = Math.min(best, Math.hypot(x - ax - t * dx, y - ay - t * dy));
	}
	return best;
}

/**
 * Ein Pixel des Icons. Der Hintergrund füllt das ganze Quadrat (das System rundet die Ecken selbst ab),
 * die Bildmarke sitzt verkleinert in der Mitte, damit "maskable" Icons beim Zuschneiden nichts verlieren.
 */
function mark(u, v, size) {
	const SCALE = 0.8; // Anteil der Bildmarke an der Icon-Breite
	let r = 0;
	let g = 0;
	let b = 0;
	const SAMPLES = 4; // 4 × 4 Unterabtastung für glatte Kanten
	for (let sy = 0; sy < SAMPLES; sy++) {
		for (let sx = 0; sx < SAMPLES; sx++) {
			const pu = u + (sx + 0.5 - SAMPLES / 2) / (SAMPLES * size);
			const pv = v + (sy + 0.5 - SAMPLES / 2) / (SAMPLES * size);
			const x = ((pu - 0.5) / SCALE + 0.5) * 64;
			const y = ((pv - 0.5) / SCALE + 0.5) * 64;
			let color = BOARD;
			if (SEGMENTS.some((seg) => inRoundedRect(x, y, seg))) color = LED;
			else if (distanceToWave(x, y) <= WAVE_HALF) color = WAVE;
			r += color[0];
			g += color[1];
			b += color[2];
		}
	}
	const n = SAMPLES * SAMPLES;
	return [Math.round(r / n), Math.round(g / n), Math.round(b / n)];
}

mkdirSync('static/icons', { recursive: true });
for (const [name, size] of [
	['icon-192.png', 192],
	['icon-512.png', 512],
	['apple-touch-icon.png', 180]
]) {
	writeFileSync(`static/icons/${name}`, png(size, mark));
	console.log(`static/icons/${name}`);
}
