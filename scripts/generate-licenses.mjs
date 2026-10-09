// Sammelt die Lizenztexte aller Bibliotheken, die im ausgelieferten App-Code stecken,
// nach src/lib/licenses.json. Die Seite "Lizenzen" zeigt sie an (Apache-2.0 verlangt
// Lizenz und NOTICE bei Weitergabe, MIT und ISC den Copyright-Hinweis).
//
// Aufruf: npm run licenses
//
// Die Liste stammt aus den Sourcemaps eines Builds (`npx vite build --sourcemap`,
// dann alle node_modules-Pfade in build/**/*.map). Nach jeder neuen Abhängigkeit
// neu prüfen und hier ergänzen.
import { existsSync, readdirSync, readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';

const PACKAGES = [
	'svelte',
	'@sveltejs/kit',
	'devalue',
	'dexie',
	'd3-scale',
	'd3-array',
	'd3-color',
	'd3-format',
	'd3-interpolate',
	'd3-time',
	'd3-time-format',
	'fflate',
	'@fontsource/barlow-semi-condensed',
	'@tabler/icons'
];

function readOptional(dir, pattern) {
	const file = readdirSync(dir).find((name) => pattern.test(name));
	return file ? readFileSync(join(dir, file), 'utf8').trim() : undefined;
}

const licenses = PACKAGES.map((name) => {
	const dir = join('node_modules', name);
	if (!existsSync(dir)) throw new Error(`${name} fehlt in node_modules`);
	const pkg = JSON.parse(readFileSync(join(dir, 'package.json'), 'utf8'));
	const repository = typeof pkg.repository === 'string' ? pkg.repository : pkg.repository?.url;
	const text = readOptional(dir, /^licen[cs]e(\.md|\.txt)?$/i);
	if (!text) throw new Error(`${name}: keine Lizenzdatei gefunden`);
	let url = (pkg.homepage ?? repository ?? '')
		.replace(/^git\+/, '')
		.replace(/^github:/, '')
		.replace(/\.git$/, '')
		.replace(/#.*$/, '');
	// Kurzform "besitzer/repo" in package.json meint GitHub
	if (/^[\w-]+\/[\w.-]+$/.test(url)) url = `https://github.com/${url}`;
	return {
		name,
		version: pkg.version,
		license: pkg.license,
		url,
		text,
		notice: readOptional(dir, /^notice(\.md|\.txt)?$/i)
	};
});

writeFileSync('src/lib/licenses.json', JSON.stringify(licenses, null, '\t') + '\n');
console.log(`${licenses.length} Lizenzen nach src/lib/licenses.json geschrieben.`);
