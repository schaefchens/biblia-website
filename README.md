# Biblia — Website

Die Website für den christlichen Verein Biblia: gedruckte Flyer online lesen,
weitergeben und als Druckausgabe bestellen.

Dieser Ordner ist gleichzeitig **Inhaltsverwaltung, Quellcode und
Veröffentlichungswerkzeug**. Alles wird auf dem eigenen Rechner erzeugt; auf
dem Server liegen nur fertige Dateien.

---

## Für Mitarbeiter: der Alltag

Es gibt drei Befehle, die im Normalfall genügen. Alle werden im Terminal in
diesem Ordner eingegeben.

```bash
npm run check      # Stimmen alle Inhalte?
npm run preview    # Wie sieht es aus?
npm run publish    # Veröffentlichen
```

### Einen neuen Flyer anlegen

```bash
npm run new
```

Der Assistent fragt nach Titel, Sprache, Kategorie und der PDF-Datei und legt
danach alles Nötige an. Anschliessend:

1. Die Datei `flyer.de.md` im neuen Ordner öffnen und die Beschreibung ergänzen.
2. In `flyer.md` den Eintrag `status: draft` auf `status: published` ändern.
3. `npm run check`
4. `npm run publish`

### Einen Flyer von Hand anlegen

Ein Flyer ist ein Ordner unter `content/flyers/` mit dieser Form:

```
content/flyers/123-hoffnung/
├── flyer.md        Angaben, die für alle Sprachen gelten
├── flyer.de.md     Titel und Beschreibung auf Deutsch
├── flyer.de.pdf    Die Druckdatei
├── flyer.de.txt    Nur bei Bedarf: der Text von Hand (siehe unten)
├── flyer.en.md     Titel und Beschreibung auf Englisch
└── flyer.en.pdf
```

`flyer.md` sieht so aus:

```yaml
---
id: 123                 # Bleibt für immer gleich. Niemals ändern.
slug: hoffnung          # Teil der Adresse. Änderbar.
category: leid-und-hoffnung
topics:
  - hoffnung
  - trost
bible_refs:
  - "Römer 15,13"
status: published       # draft | published | archived
date: 2026-08-14
featured: false
download: false         # true, wenn die PDF-Datei angeboten werden soll
order:
  enabled: true
  price: 0
  currency: EUR
---
```

`flyer.de.md` sieht so aus:

```yaml
---
title: Hoffnung
description: Ein Flyer über Hoffnung in schwierigen Zeiten.
---

Hier kann ein längerer Text stehen. Er erscheint auf der Detailseite.
```

### Wichtige Regeln

* **Die Nummer (`id`) darf nie geändert werden.** Sie steht in den gedruckten
  QR-Codes, und die bleiben jahrelang im Umlauf. Titel und `slug` dürfen
  geändert werden — `npm run check -- --fix` legt dann automatisch eine
  Weiterleitung an, und der Build schreibt sie in die `.htaccess`.
* **Einen Flyer nie löschen.** Soll er nicht mehr erscheinen, genügt
  `status: archived`: er verschwindet aus Übersicht und Suche, bleibt aber
  unter seiner Adresse lesbar. `npm run check` meldet jede Nummer, die es
  einmal gab und heute nicht mehr gibt. War eine Nummer nie im Umlauf — etwa
  ein Versuch beim Ausprobieren —, kann sie in `config/site.json` unter
  `"retiredFlyerIds": [199]` eingetragen werden; dann schweigt die Prüfung.
* **Werte mit Doppelpunkt gehören in Anführungszeichen:**
  `title: "Wer ist Jesus: der Weg"`
* **Keine Tabulatoren** in den Textdateien, nur Leerzeichen.
* `npm run check` erklärt jeden Fehler mit Datei und Zeilennummer.

---

## Einrichtung auf einem neuen Rechner

Einmalig nötig:

1. **Node.js** ab Version 22 von <https://nodejs.org>
2. **Git** von <https://git-scm.com>
3. **Git LFS** von <https://git-lfs.com>, danach einmalig `git lfs install`
   (verwaltet die grossen PDF-Dateien)
4. Im Projektordner:

```bash
npm ci
cp sftp.env.example sftp.env   # danach die Zugangsdaten eintragen
npm run doctor                 # prüft, ob alles bereit ist
```

`npm run doctor` sagt im Klartext, was noch fehlt.

---

## Alle Befehle

| Befehl | Bedeutung |
| --- | --- |
| `npm run check` | Prüft alle Inhalte und meldet Fehler und Hinweise |
| `npm run build` | Erzeugt die fertige Website in `dist/` |
| `npm run preview` | Zeigt die Website lokal im Browser |
| `npm run dev` | Wie `preview`, erzeugt bei jeder Änderung neu |
| `npm run publish` | Prüfen, erzeugen, sichern und hochladen — der Normalfall |
| `npm run deploy` | Nur hochladen |
| `npm run fetch` | Bestellungen und Kontaktanfragen vom Server holen |
| `npm run new` | Assistent für einen neuen Flyer |
| `npm run doctor` | Prüft die Einrichtung dieses Rechners |
| `npm run demo` | Legt Beispielinhalte an (`-- --remove` entfernt sie) |
| `npm run retention` | Löscht abgelaufene Bestell- und Kontaktdaten |
| `npm run clean` | Entfernt erzeugte Dateien |
| `npm test` | Prüft die Werkzeuge selbst |

Fast alle Befehle verstehen `-- --dry-run`: dann wird nur angezeigt, was
geschehen würde.

---

## Wie die Website aufgebaut ist

**Static First.** Alles, was beim Erzeugen schon feststeht, wird als fertige
HTML-Datei abgelegt. Auf dem Server läuft PHP nur dort, wo es wirklich nötig
ist: beim Absenden einer Bestellanfrage und des Kontaktformulars.

```
content/          Die Inhalte — hier wird gearbeitet
  flyers/         Ein Ordner je Flyer
  pages/          Startseite, Über uns, Impressum, Datenschutz
  topics/         Themen
  categories/     Kategorien
config/site.json  Adresse, Sprachen, Routen, Empfängeradressen
src/              Vorlagen, Stilvorlagen, Browser-Skripte
scripts/          Die Werkzeuge (Node.js)
server/api/       Die beiden PHP-Endpunkte
generated/        Zwischenspeicher der Bilder — wird automatisch verwaltet
dist/             Die fertige Website, die hochgeladen wird
print-assets/     QR-Codes für die Druckgestaltung (werden nicht hochgeladen)
app-data/         Vom Server geholte Bestellungen — enthält persönliche Daten
```

### Adressen

| Zweck | Beispiel |
| --- | --- |
| Flyer ansehen | `/de/flyer/hoffnung/` |
| Lesen | `/de/lesen/hoffnung/` |
| Als Text lesen | `/de/text/hoffnung/` |
| Thema | `/de/themen/hoffnung/` |
| **Dauerhafte Kurzadresse** | `/f/123/` |
| Dauerhaft, direkt zum Lesen | `/r/123/` |

Die Kurzadressen sind das, was auf gedruckten Flyern steht. Sie zeigen den
vollständigen Inhalt — nicht nur eine Weiterleitung —, damit ein geteilter
Link in WhatsApp oder Signal auch ein Vorschaubild bekommt.

Wird ein Flyer umbenannt, bleibt seine frühere lesbare Adresse dauerhaft
erreichbar: `npm run check -- --fix` trägt den alten Namen in `slug_history`
ein, und jeder Build erzeugt daraus eine Weiterleitung in der `.htaccess`.

### Bilder

Aus jeder PDF-Datei entstehen beim Erzeugen automatisch: Titelbild,
Leseansicht in mehreren Grössen, ein Bild zum Teilen, ein Bild im Hochformat,
ein QR-Code und der ausgelesene Text.

Das geschieht nur einmal. Beim nächsten Mal wird das Ergebnis
wiederverwendet, solange sich weder die PDF-Datei noch der Titel noch die
Adresse geändert haben.

Ist das Titelblatt nicht die erste Seite — etwa bei einem gefalteten Flyer,
dessen Titel das rechte Drittel ist —, lässt sich das in `flyer.md` angeben:

```yaml
cover:
  page: 3
  crop: { x: 0.6667, y: 0, width: 0.3333, height: 1 }
```

### Wenn sich aus der PDF kein Text lesen lässt

Aus einem Scan oder einer PDF, die nur aus Bildern besteht, lässt sich kein
Text auslesen. Die Seite „Als Text lesen“ wäre dann leer — `npm run check`
meldet das. In diesem Fall den Text in eine Datei neben die PDF legen:

```
content/flyers/123-hoffnung/flyer.de.txt
```

Sie ersetzt die automatische Fassung vollständig. Leerzeilen trennen Absätze.

---

## Umzug auf die endgültige Domain

Zurzeit läuft die Website unter einer Testadresse. Solange das so ist:

* Suchmaschinen werden ausgesperrt,
* Bestellanfragen werden als Testbetrieb gekennzeichnet,
* QR-Codes für den Druck tragen den Vermerk **NICHT DRUCKEN**.

Für den Umzug genügt es, in `config/site.json` die `baseUrl` zu ändern und
`npm run publish` auszuführen. Alle Adressen, QR-Codes und Verweise werden
dabei neu erzeugt.

Sobald die endgültige Domain eingetragen ist, wird streng geprüft. Solange
einer dieser Punkte offen ist, wird weder gebaut noch hochgeladen:

* Es sind noch Beispielinhalte vorhanden (`demo: true`) — entfernen mit
  `npm run demo -- --remove`.
* Impressum oder Datenschutz enthalten noch Platzhalter.
* Eine der Empfängeradressen in `config/site.json` ist nicht zustellbar,
  etwa `bestellung@example.invalid`.
* Es ist kein einziger Flyer veröffentlicht.

`npm run check` zeigt diese Punkte schon vorher an — auf der Testadresse
als Hinweis, danach als Fehler.

---

## Datenschutz

Bestellanfragen und Kontaktnachrichten enthalten **Namen und Postadressen**.

* Sie liegen auf dem Server unter `app-data/` und sind dort für das Web
  gesperrt. Nach jedem Hochladen wird automatisch geprüft, dass das wirklich
  so ist.
* `npm run fetch` holt sie nach `app-data/` auf diesen Rechner. Dieser Ordner
  ist von Git ausgenommen und darf **niemals** in ein Repository, in einen
  geteilten Ordner oder in eine E-Mail gelangen.
* `npm run retention` löscht abgelaufene Einträge — lokal und auf dem Server,
  einschliesslich des Archivs, in das `npm run fetch -- --archive` verschiebt.
  Die Fristen stehen in `config/site.json`.
* Verlangt jemand die Löschung seiner Daten:
  `npm run retention -- --person "name@beispiel.at"`
* Konnte etwas nicht gelöscht werden, endet der Befehl mit einer Fehlermeldung
  und listet auf, was übrig ist. Erst wenn er ohne Fehler durchläuft, ist die
  Löschung wirklich erfolgt.
* Die Website bindet nichts von fremden Servern ein: keine Schriften von
  Google, keine Karten, keine Statistik. Deshalb braucht sie **kein
  Einwilligungsbanner**. Das sollte so bleiben.

Vor dem Start müssen `content/pages/imprint.*.md` und
`content/pages/privacy.*.md` durch die echten Angaben ersetzt werden.

## Zugangsdaten

`sftp.env` enthält ein Passwort im Klartext mit Schreibrechten auf den
gesamten Webspace. Die Datei ist von Git ausgenommen. Sie gehört nicht in
E-Mails, nicht auf USB-Sticks und nicht in geteilte Ordner.
