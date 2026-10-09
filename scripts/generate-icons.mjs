// Erzeugt die App-Icons (PNG) ohne fremde Bibliotheken. Gleiche Bildmarke wie src/lib/assets/favicon.svg:
// Delfin von der Seite, die Arme tauchen ein, an den Händen spritzt eine Wasserkrone.
// Eigenes Werk, darum keine Lizenzfragen. Aufruf: node scripts/generate-icons.mjs
import { deflateSync } from 'node:zlib';
import { mkdirSync, writeFileSync } from 'node:fs';

const TILE = [27, 34, 40]; // #1b2228, --color-board-tile
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

// Die Bildmarke aus favicon.svg im 64er-Raster, in Zeichenreihenfolge (spätere Formen liegen oben)
function bezier(p0, p1, p2, p3, steps = 24) {
	return Array.from({ length: steps + 1 }, (_, i) => {
		const t = i / steps;
		const m = 1 - t;
		return [0, 1].map(
			(k) => m * m * m * p0[k] + 3 * m * m * t * p1[k] + 3 * m * t * t * p2[k] + t * t * t * p3[k]
		);
	});
}

const SHAPES = [
	// Wasserlinie
	{
		line: [
			...bezier([4, 50], [11, 46], [17, 46], [24, 50]),
			...bezier([24, 50], [31, 54], [37, 54], [44, 50]),
			...bezier([44, 50], [49, 47], [54, 47], [60, 49])
		],
		half: 2,
		color: WAVE
	},
	// Körperbogen, Arme, Kopf
	{ line: bezier([8, 45], [13, 30], [25, 19], [38, 24]), half: 3.5, color: LED },
	{
		line: [
			[38, 24],
			[52, 43]
		],
		half: 2.75,
		color: LED
	},
	{ circle: [45, 21, 5.5], color: LED },
	// Wasserkrone an den Händen und Tropfen
	{ line: bezier([47.5, 45], [46, 42], [45.5, 39.5], [46.5, 37]), half: 1.2, color: WAVE },
	{ line: bezier([57, 45], [59, 42.5], [60, 40], [59.5, 37]), half: 1.2, color: WAVE },
	{ circle: [50, 35.5, 1.5], color: WAVE },
	{ circle: [56, 34, 1.4], color: WAVE },
	{ circle: [60, 33, 1.1], color: WAVE }
];

function distanceToLine(x, y, line) {
	let best = Infinity;
	for (let i = 1; i < line.length; i++) {
		const [ax, ay] = line[i - 1];
		const [bx, by] = line[i];
		const dx = bx - ax;
		const dy = by - ay;
		// Zwei Kurvenstücke teilen sich einen Punkt: Segment der Länge null überspringen (sonst NaN)
		if (dx === 0 && dy === 0) continue;
		const t = Math.max(0, Math.min(1, ((x - ax) * dx + (y - ay) * dy) / (dx * dx + dy * dy)));
		best = Math.min(best, Math.hypot(x - ax - t * dx, y - ay - t * dy));
	}
	return best;
}

function colorAt(x, y) {
	let color = TILE;
	for (const shape of SHAPES) {
		const hit = shape.circle
			? Math.hypot(x - shape.circle[0], y - shape.circle[1]) <= shape.circle[2]
			: distanceToLine(x, y, shape.line) <= shape.half;
		if (hit) color = shape.color;
	}
	return color;
}

/**
 * Ein Pixel des Icons. Der Hintergrund füllt das ganze Quadrat (das System rundet die Ecken selbst ab),
 * die Bildmarke sitzt verkleinert in der Mitte, damit "maskable" Icons beim Zuschneiden nichts verlieren.
 */
function mark(u, v, size) {
	const SCALE = 0.84; // Anteil der Bildmarke an der Icon-Breite
	let r = 0;
	let g = 0;
	let b = 0;
	const SAMPLES = 4; // 4 × 4 Unterabtastung für glatte Kanten
	for (let sy = 0; sy < SAMPLES; sy++) {
		for (let sx = 0; sx < SAMPLES; sx++) {
			const pu = u + (sx + 0.5 - SAMPLES / 2) / (SAMPLES * size);
			const pv = v + (sy + 0.5 - SAMPLES / 2) / (SAMPLES * size);
			const [cr, cg, cb] = colorAt(
				((pu - 0.5) / SCALE + 0.5) * 64,
				((pv - 0.5) / SCALE + 0.5) * 64
			);
			r += cr;
			g += cg;
			b += cb;
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
