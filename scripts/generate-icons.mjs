// Erzeugt die App-Icons (PNG) ohne fremde Bibliotheken: blauer Hintergrund, drei weisse Wellen.
// Eigenes Werk, darum keine Lizenzfragen. Aufruf: node scripts/generate-icons.mjs
import { deflateSync } from 'node:zlib';
import { mkdirSync, writeFileSync } from 'node:fs';

const BLUE = [11, 79, 138];
const WHITE = [255, 255, 255];

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

// Wellen nur in der inneren Zone, damit "maskable" Icons beim Zuschneiden nichts verlieren
function waves(u, v, size) {
	if (u < 0.22 || u > 0.78) return BLUE;
	let coverage = 0;
	for (const center of [0.38, 0.5, 0.62]) {
		const y = center + 0.03 * Math.sin(((u - 0.22) / 0.28) * Math.PI);
		const dist = Math.abs(v - y) * size;
		const half = 0.03 * size;
		coverage = Math.max(coverage, Math.min(1, Math.max(0, half - dist + 0.5)));
	}
	return BLUE.map((c, i) => Math.round(c + (WHITE[i] - c) * coverage));
}

mkdirSync('static/icons', { recursive: true });
for (const [name, size] of [
	['icon-192.png', 192],
	['icon-512.png', 512],
	['apple-touch-icon.png', 180]
]) {
	writeFileSync(`static/icons/${name}`, png(size, waves));
	console.log(`static/icons/${name}`);
}
