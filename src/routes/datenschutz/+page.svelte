<script lang="ts">
	import { resolve } from '$app/paths';
</script>

<svelte:head>
	<title>Datenschutz – Schwimmplaner</title>
</svelte:head>

<h1>Datenschutz</h1>

<p class="draft" role="note">
	<strong>Entwurf.</strong> Dieser Text ist noch nicht rechtlich geprüft. Angaben zum Verantwortlichen
	und zum Kontakt werden vor dem öffentlichen Start ergänzt.
</p>

<p>Stand: 8. Oktober 2026</p>

<h2>Kurz gesagt</h2>
<ul>
	<li>Deine Daten bleiben auf deinem Gerät. Es gibt keinen Server, der sie speichert.</li>
	<li>Es gibt kein Konto, keine Cookies, kein Tracking und keine Werbung.</li>
	<li>Beim Laden der App sieht der Hoster GitHub technisch deine IP-Adresse.</li>
</ul>

<h2>Verantwortlich</h2>
<p>Wird vor dem öffentlichen Start ergänzt (Name und Kontaktadresse).</p>

<h2>Welche Daten die App speichert</h2>
<p>
	Was du eingibst: Wettkämpfe (Name, Datum, Ort, Meldeschluss, Bahnlänge), Läufe (Lage, Strecke,
	Zielzeit, Endzeit, Status, Zwischenzeiten) und Saisons. Dazu einen Anzeigenamen ("Ich"). Jahrgang,
	Geschlecht oder Verein fragt die App nicht ab.
</p>
<p>
	Diese Daten liegen nur im Speicher deines Browsers (IndexedDB) auf diesem Gerät. Sie werden nicht
	übertragen, auch nicht an uns. Darum können wir sie weder sehen noch wiederherstellen.
</p>

<h2>Resultate aus einer Lenex-Datei</h2>
<p>
	Eine Lenex-Datei enthält die Resultate aller Teilnehmenden eines Wettkampfs, mit Name, Jahrgang
	und Verein. Die App liest die Datei nur in deinem Browser, sie wird nirgends hochgeladen. Du
	wählst eine Person aus. Gespeichert werden nur deren Läufe (Lage, Strecke, Tag, Endzeit, Status,
	Zwischenzeiten) und die Angaben zum Wettkampf. Name, Jahrgang und Verein werden nicht gespeichert.
	Sobald du speicherst oder abbrichst, verwirft die App den Inhalt der Datei.
</p>

<h2>Was lokal gespeichert wird und warum</h2>
<ul>
	<li><strong>Deine Daten</strong> in IndexedDB: Das ist die Funktion der App.</li>
	<li>
		<strong>Die App-Dateien</strong> im Cache des Service Workers: Damit die App auch ohne Internet läuft,
		zum Beispiel in der Schwimmhalle.
	</li>
	<li>
		Die App bittet den Browser um <strong>dauerhaften Speicher</strong>, damit er die Daten nicht
		von selbst löscht.
	</li>
</ul>
<p>Cookies setzt die App keine.</p>

<h2>Hosting bei GitHub</h2>
<p>
	Die App-Dateien liefert GitHub Pages aus (GitHub, Inc., USA, gehört zu Microsoft). Beim Abruf
	verarbeitet GitHub technisch nötige Daten wie deine IP-Adresse, die Uhrzeit und den Browser, zum
	Beispiel für die Sicherheit. Dabei können Daten in die USA übermittelt werden. Deine
	Wettkampfdaten erreichen GitHub nicht. Mehr dazu in der
	<a
		href="https://docs.github.com/de/site-policy/privacy-policies/github-general-privacy-statement"
		rel="noopener noreferrer"
		target="_blank">Datenschutzerklärung von GitHub</a
	>.
</p>

<h2>Keine Dritten</h2>
<p>
	Die App lädt nichts von fremden Servern: keine Schriften, keine Karten, keine Videos, keine
	Analyse-Werkzeuge. Die verwendeten Bibliotheken laufen nur in deinem Browser und senden nichts
	(siehe <a href={resolve('/lizenzen')}>Lizenzen</a>).
</p>

<h2>Deine Rechte und Möglichkeiten</h2>
<p>
	Weil die Daten nur bei dir liegen, hast du sie selbst in der Hand. Unter
	<a href={resolve('/daten')}>Daten</a> kannst du:
</p>
<ul>
	<li>alle Daten als Backup (JSON) oder als Tabelle (CSV) herunterladen,</li>
	<li>alle Daten auf diesem Gerät löschen.</li>
</ul>
<p>
	Du kannst die Daten auch löschen, indem du in den Browser-Einstellungen die Website-Daten dieser
	Seite entfernst oder die installierte App deinstallierst.
</p>
<p>
	Zu den Daten, die GitHub beim Abruf bearbeitet, kannst du dich an GitHub wenden. Du hast nach dem
	Schweizer Datenschutzgesetz (DSG) und, wenn es anwendbar ist, nach der DSGVO das Recht auf
	Auskunft, Berichtigung und Löschung sowie das Recht, dich bei einer Aufsichtsbehörde zu
	beschweren. In der Schweiz ist das der Eidgenössische Datenschutz- und Öffentlichkeitsbeauftragte
	(EDÖB).
</p>

<h2>Kinder und Jugendliche</h2>
<p>
	Die App braucht kein Konto und schickt keine Daten an uns. Darum gibt es in dieser Version nichts,
	wofür eine Zustimmung der Eltern nötig wäre. Das ändert sich, wenn später Konten oder ein Sync
	dazukommen. Diese Erklärung wird dann vorher angepasst.
</p>

<style>
	.draft {
		padding: 0.75rem 1rem;
		border: 2px solid var(--color-warning);
		border-radius: var(--radius);
		color: var(--color-warning);
	}

	h2 {
		margin-top: 1.75rem;
	}
</style>
