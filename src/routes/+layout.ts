// Die App läuft komplett im Browser, weil die Daten in IndexedDB liegen.
// prerender erzeugt für jede Seite eine leere HTML-Hülle, die offline gecacht werden kann.
export const ssr = false;
export const prerender = true;
