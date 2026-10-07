// Service Worker: hält die App-Dateien im Cache, damit die App in der Halle
// auch ohne Empfang startet. Er speichert keine Nutzerdaten und sendet nichts.
// Grundlage: https://svelte.dev/docs/kit/service-workers
import { self } from '$app/service-worker';
import { version } from '$app/env';
import { immutable, assets, prerendered } from '$app/manifest';
import { resolve } from '$app/paths';

// Pro Deployment ein eigener Cache, alte werden beim Aktivieren gelöscht
const CACHE = `cache-${version}`;

const APP_SHELL = resolve('/');
const ASSETS = [
	...immutable.map((file) => resolve(file.path)),
	// Versteckte Dateien (.xyz) liefern viele Server nicht aus; eine fehlende Datei
	// würde die ganze Installation scheitern lassen
	...assets.filter((file) => !/(^|\/)\./.test(file.path)).map((file) => resolve(file.path)),
	...prerendered.map((page) => resolve(page.path))
];

self.addEventListener('install', (event) => {
	async function addFilesToCache() {
		const cache = await caches.open(CACHE);
		await cache.addAll([...new Set([APP_SHELL, ...ASSETS])]);
	}
	event.waitUntil(addFilesToCache());
});

self.addEventListener('activate', (event) => {
	async function deleteOldCaches() {
		for (const key of await caches.keys()) {
			if (key !== CACHE) await caches.delete(key);
		}
	}
	event.waitUntil(deleteOldCaches());
});

// Die App fragt per Nachricht, ob die neue Version sofort übernehmen soll
// (Knopf "Jetzt aktualisieren"). Ohne das wartet sie, bis alle Tabs zu sind.
self.addEventListener('message', (event) => {
	if (event.data?.type === 'SKIP_WAITING') self.skipWaiting();
});

self.addEventListener('fetch', (event) => {
	if (event.request.method !== 'GET') return;

	async function respond() {
		const url = new URL(event.request.url);
		const cache = await caches.open(CACHE);

		// App-Dateien kommen immer aus dem Cache
		if (ASSETS.includes(url.pathname)) {
			const cached = await cache.match(url.pathname);
			if (cached) return cached;
		}

		try {
			return await fetch(event.request);
		} catch (error) {
			// Offline: Seitenaufrufe bekommen die App-Hülle, der Router im Browser
			// zeigt dann die richtige Seite an
			if (event.request.mode === 'navigate') {
				const shell = await cache.match(APP_SHELL);
				if (shell) return shell;
			}
			throw error;
		}
	}

	event.respondWith(respond());
});
