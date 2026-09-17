Erstelle eine vollständige Website inklusive Projektstruktur, Content-System, statischem Build-Tooling, minimalem PHP-Backend und Deployment-Konzept für den österreichischen christlichen Verein „Biblia“.

Biblia ist ein christlicher Verein, der sich auf Dienst und Werke zu Gott versteht. Ein zentraler Schwerpunkt liegt auf der Erstellung, Veröffentlichung und Verbreitung von gedruckten Medien, insbesondere Flyern. Diese Flyer sollen künftig nicht nur physisch verteilt, sondern auch digital gelesen, geteilt und als Druckausgabe bestellt werden können.

Die Website soll keine klassische Vereinswebsite und kein klassischer Onlineshop sein, sondern eine hochwertige digitale Plattform für christliche Druckmedien.

Das konzeptionelle Leitprinzip lautet:

Entdecken → Lesen → Teilen → Bestellen

Die Website darf sich visuell an einem modernen Store orientieren, soll jedoch nicht kommerziell wirken.

Begriffe wie „Produkte“ oder „Warenkorb“ sollen möglichst vermieden werden. Stattdessen sollen Begriffe wie „Flyer“, „Schriften“, „Themen“, „Bestellliste“, „Meine Auswahl“ oder „Druckausgabe bestellen“ verwendet werden.

## Zentrale technische Architektur

Die Website soll nach dem Prinzip **Static First** aufgebaut werden.

Das bedeutet:

* Alle Inhalte, die bereits beim Build bekannt sind, werden lokal als statische Dateien vorgeneriert.
* Normale Inhaltsseiten werden als fertige `.html`-Dateien erzeugt.
* Flyer-Detailseiten werden als fertige statische HTML-Seiten erzeugt.
* Flyer-Leseansichten werden als fertige statische HTML-Seiten erzeugt.
* Themenseiten, Kategorien, Sprachvarianten, Archivseiten und SEO-Seiten werden statisch erzeugt.
* Suchindizes und Katalogdaten werden lokal erzeugt.
* Social-Media-Bilder, QR-Codes, Cover und Reader-Seiten werden lokal erzeugt.
* Auf dem Server soll PHP **nur dort eingesetzt werden, wo echte serverseitige Dynamik notwendig ist**.

PHP darf insbesondere verwendet werden für:

* Kontaktformular
* Bestellanfragen
* serverseitige Validierung
* Speichern von Bestellungen
* E-Mail-Versand
* Rate-Limiting
* CSRF-Schutz
* eventuell einzelne kleine API-Endpunkte

PHP soll **nicht** für Seiten verwendet werden, die bereits lokal vollständig erzeugt werden können.

Beispiel:

Nicht:

```text
/de/flyer/hoffnung.php
```

sondern statisch:

```text
/de/flyer/hoffnung/index.html
```

oder:

```text
/de/flyer/hoffnung.html
```

Ebenso:

```text
/de/lesen/hoffnung/index.html
```

und:

```text
/de/themen/hoffnung/index.html
```

Der Server soll im Wesentlichen nur fertige HTML-, CSS-, JavaScript-, Bild- und Mediendateien ausliefern.

## Ziel

Die Website soll langfristig wartbar, performant und einfach hostbar sein.

Das gesamte Projektverzeichnis ist gleichzeitig:

* Source-Code
* Content-Management-System
* Static Site Generator
* Medienpipeline
* Build-System
* Deployment-System
* Git-Repository

## Grundanforderungen

Die Website soll:

* modern, hochwertig, ruhig und zeitlos gestaltet sein
* stark grafisch arbeiten
* sehr wenig klassischen Text-Content benötigen
* Flyer großflächig visuell präsentieren
* vollständig responsiv funktionieren
* auf Mobilgeräten besonders gut funktionieren
* Hellmodus und Dunkelmodus unterstützen
* standardmäßig den Systemmodus übernehmen
* einen manuellen Theme-Selektor anbieten
* mehrsprachig sein
* standardmäßig die Systemsprache bzw. Browsersprache erkennen
* trotzdem feste sprachabhängige URLs besitzen
* suchmaschinenoptimiert sein
* barrierearm gestaltet sein
* auf einem Hetzner Webhosting S laufen
* ohne Node.js oder SSH auf dem Server auskommen
* alle Build-Prozesse lokal ausführen
* lokal auf Windows, macOS und Linux funktionieren

## Static-Site-Prinzip

Der Build-Prozess soll aus dem Content-Verzeichnis eine vollständig browsbare statische Website erzeugen.

Beispiel:

```text
content/
    ↓
lokaler Build
    ↓
dist/
    ├── index.html
    ├── de/
    │   ├── index.html
    │   ├── flyer/
    │   │   └── hoffnung/
    │   │       └── index.html
    │   ├── lesen/
    │   │   └── hoffnung/
    │   │       └── index.html
    │   └── themen/
    │       └── hoffnung/
    │           └── index.html
    ├── en/
    ├── assets/
    ├── media/
    ├── sitemap.xml
    └── robots.txt
```

Der `dist/`-Ordner soll im Wesentlichen direkt auf das Webhosting hochgeladen werden können.

PHP-Endpunkte können zusätzlich beispielsweise unter:

```text
/api/order.php
/api/contact.php
```

existieren.

## Design

Das Design soll „biblisch“ wirken, aber nicht kitschig oder historisierend.

Vermeide:

* Pergamentoptik
* übermäßige Kreuzsymbolik
* goldene Ornamente
* überladene christliche Symbolik
* altmodische kirchliche Gestaltung

Stattdessen:

* sehr große Typografie
* viel Weißraum
* warme, neutrale Farbtöne
* hochwertige Serifenschrift für Überschriften
* klare Sans-Serif-Schrift für UI-Elemente
* dezente Gestaltung
* die Flyer selbst sollen die visuelle Hauptrolle spielen

Die Website soll eher wie eine hochwertige Galerie oder ein Editorial Store wirken.

Grundprinzip:

Website = Rahmen
Flyer = visueller Hauptinhalt

## Startseite

Die Startseite darf nicht nur aus einem endlosen Grid bestehen.

Sie soll kuratierte Bereiche enthalten.

Beispielstruktur:

1. großer Hero-Bereich
2. aktueller oder besonders relevanter Flyer
3. ausgewählte Flyer
4. Themenbereiche
5. zum Weitergeben empfohlene Flyer
6. neu erschienene Flyer
7. Link zu „Alle Flyer“

Beispiele für Themen:

* Hoffnung
* Glaube
* Jesus Christus
* Lebensfragen
* Leid
* Tod
* Vergebung
* Gebet
* Familie
* Weihnachten
* Ostern
* Auferstehung
* Evangelisation

## Flyer-Archiv

Es soll eine dedizierte Flyer-Seite geben, auf der langfristig hunderte Flyer verwaltet werden können.

Auch diese Seite soll nach Möglichkeit statisch erzeugt werden.

Für größere Datenbestände sollen zwei sinnvolle Varianten berücksichtigt werden:

1. statisch vorgenerierte paginierte Archivseiten
2. clientseitige Suche und Filterung auf Basis eines lokal erzeugten JSON-Suchindex

Es soll kein PHP erforderlich sein, nur um Flyer zu durchsuchen oder zu filtern.

Die Archivseite soll bieten:

* Suche
* Filter nach Kategorie
* Filter nach Thema
* Filter nach Sprache
* Filter nach Tags
* Paging
* performante Darstellung großer Datenmengen

Die Suche soll möglichst durchsuchen:

* Titel
* Beschreibung
* Kategorien
* Themen
* Tags
* Keywords
* Bibelstellen
* optional extrahierten PDF-Text

## Flyer-Karten

Flyer-Karten sollen sehr reduziert sein.

Primär sichtbar:

* Cover
* Titel
* eventuell kleine Zusatzinformation wie Thema oder Seitenanzahl

Beispiel:

Hoffnung
8 Seiten · Lebensfragen

Nicht auf jeder Karte gleichzeitig anzeigen:

* Bestellen
* Download
* Teilen
* Sprache
* Preis
* Kategorien
* sämtliche Tags

Diese Informationen gehören primär auf die Detailseite.

## Flyer-Detailseite

Jede Flyer-Detailseite wird beim Build als statische HTML-Seite erzeugt.

Beispielroute:

```text
/de/flyer/hoffnung/
```

oder:

```text
/de/flyer/123-hope/
```

Sie soll enthalten:

* großes Cover
* Titel
* kurze Beschreibung
* eventuell Bibelvers
* Hauptaktion „Jetzt lesen“
* „Auf WhatsApp teilen“
* „Druckausgabe bestellen“

Visuelle Priorität:

1. Lesen
2. Teilen
3. Bestellen

Unterhalb:

* Beschreibung
* weitere Vorschauseiten
* Informationen zur Druckausgabe
* verwandte Flyer
* Themen
* optional PDF-Download

Für diese Seite ist kein PHP notwendig.

## Vollbild-Lesemodus

Jeder Flyer soll einen statisch erzeugten Vollbild-Lesemodus besitzen.

Beispiel:

```text
/de/lesen/hoffnung/
```

oder:

```text
/de/lesen/123-hope/
```

Dieser Modus soll stark reduziert sein.

Keine normale Website-Navigation.

Nur Funktionen wie:

* schließen
* nächste Seite
* vorherige Seite
* Seitennummer
* teilen
* bestellen
* Zoom

Unterstützung für:

* 1-seitige Flyer
* mehrseitige Flyer
* Tastatursteuerung
* Swipe-Gesten auf Mobilgeräten
* Tippen links/rechts
* Zoom
* optional Seitenübersicht

Die Navigation zwischen den Seiten kann vollständig clientseitig mit JavaScript erfolgen.

Es soll dafür kein PHP notwendig sein.

Optional kann die aktuelle Seite im URL-Fragment gespeichert werden:

```text
/de/lesen/123-hope/#seite=4
```

## PDF-Verarbeitung

PDF-Dateien sollen nicht primär direkt im Browser geöffnet werden.

PDFs sind die Quelldateien.

Beim lokalen Build sollen daraus automatisch Web-Assets erzeugt werden.

Beispiel:

```text
flyer.de.pdf
```

wird zu:

```text
cover.webp
page-01.webp
page-02.webp
page-03.webp
share.webp
status.webp
```

Der Reader verwendet optimierte Web-Bilder.

Optional bleibt ein direkter PDF-Download verfügbar.

## Social Sharing

Jeder Flyer soll teilbar sein.

Insbesondere wichtig:

* WhatsApp
* native Systemfreigabe
* Link kopieren
* optional Signal, Telegram etc.

Die Website darf nicht versprechen, einen WhatsApp-Status vollständig automatisch erzeugen zu können, wenn das technisch nicht zuverlässig möglich ist.

Stattdessen:

„Auf WhatsApp teilen“

Auf unterstützten Geräten soll möglichst die native Web Share API verwendet werden.

Dabei sollen möglichst geteilt werden:

* Flyer-Cover oder Status-Bild
* kurzer Text
* direkter Link zum Flyer

Zusätzlich soll ein WhatsApp-Fallback existieren, der Text und Link über WhatsApp öffnet.

Es soll ein Share-Menü geben:

* WhatsApp
* Bild teilen
* Link kopieren
* QR-Code anzeigen

Diese Funktionalität soll clientseitig umgesetzt werden und kein PHP benötigen.

## Social-Media-Bilder

Für jeden Flyer sollen automatisch optimierte Social-Bilder erzeugt werden.

Beispiel:

```text
share.webp
```

1200 × 630

und:

```text
status.webp
```

1080 × 1920

Diese Bilder sollen nicht nur das Cover enthalten, sondern eine automatisch generierte Komposition:

* Flyer-Cover
* Titel
* kurze Handlungsaufforderung
* Biblia-Branding
* URL
* optional QR-Code

Beispieltext:

„Online lesen oder als Druckausgabe bestellen“

## QR-Codes und kurze URLs

QR-Codes sind zentraler Bestandteil des Konzepts.

Physische Flyer sollen langfristig auf die digitale Version verweisen können.

Jeder Flyer braucht deshalb eine permanente Kurz-URL.

Beispiel:

```text
biblia.at/f/123
```

Diese URL muss langfristig stabil bleiben.

Die ID darf niemals geändert werden.

Titel und Slug dürfen geändert werden.

Zusätzlich können lesbare URLs existieren:

```text
/de/flyer/hoffnung/
```

und:

```text
/de/lesen/hoffnung/
```

Permanente technische URLs:

```text
/f/123
```

optional direkt zum Reader:

```text
/r/123
```

Wenn möglich, sollen auch diese Kurz-URLs ohne PHP funktionieren.

Bevorzugte Varianten:

* statisch erzeugte Redirect-Dateien
* Webserver-Rewrite-Regeln
* statische HTML-Redirectseiten
* `.htaccess`, wenn auf dem Hosting sinnvoll

PHP nur verwenden, wenn eine serverseitige Sprachentscheidung tatsächlich erforderlich ist.

Noch besser ist, neutrale Kurz-URLs auf eine statische Zwischenseite zu führen, die clientseitig anhand der Browsersprache zur passenden Sprachversion weiterleitet.

Dadurch bleibt auch die Kurz-URL-Funktion weitgehend statisch.

## Mehrsprachigkeit

Die Website soll von Anfang an multilingual aufgebaut sein.

Beispielsprachen:

* Deutsch
* Englisch
* Italienisch
* weitere später

Inhalte sollen über Dateien verwaltet werden.

Beispiel:

```text
/content/about-us.md
/content/about-us.de.md
/content/about-us.it.md
```

Für Flyer:

```text
/content/flyers/123-hope/
```

mit:

```text
flyer.md
flyer.de.md
flyer.en.md
flyer.it.md

flyer.de.pdf
flyer.en.pdf
flyer.it.pdf
```

Die allgemeine `flyer.md` soll sprachunabhängige Informationen enthalten.

Beispiel:

```yaml
id: 123
slug: hope
category: evangelisation
tags:
  - hope
  - suffering
featured: true
status: published
```

Die Sprachdateien enthalten sprachabhängige Daten.

Beispiel:

```yaml
title: Hoffnung
description: Ein Flyer über Hoffnung in schwierigen Zeiten.
```

Für jede Sprachvariante werden beim Build eigene statische HTML-Seiten erzeugt.

## Spracherkennung

Sprachabhängige URLs bleiben immer stabil.

Beispiel:

```text
/de/flyer/hoffnung/
```

bleibt Deutsch.

Nur neutrale Einstiegspunkte wie:

```text
/
```

oder:

```text
/f/123
```

dürfen automatisch eine Sprache bestimmen.

Bevorzugt soll dies clientseitig über JavaScript und Browser-Sprache erfolgen, damit kein PHP nötig ist.

Optional kann die gewählte Sprache in `localStorage` oder Cookie gespeichert werden.

## Content-System

Das gesamte Projektverzeichnis ist gleichzeitig:

* Source-Code
* Content-Management-System
* Static-Site-Generator
* lokales Medienarchiv
* Deployment-System
* Git-Repository

Beispielstruktur:

```text
/src
/content
/content/flyers
/generated
/dist
/scripts
/config
/server
/data
```

Die Mitarbeiter von Biblia sollen hauptsächlich im `/content`-Ordner arbeiten.

Kein Online-CMS.

Kein Browser-Editor.

Keine Datenbank für redaktionelle Inhalte.

Normale Texteditoren sollen ausreichen.

## Einfacher Mitarbeiter-Workflow

> **Nachtrag zur Umsetzung.** Die Befehle werden im Inhaltsordner
> ausgeführt; die Mitarbeiter sehen nur ihn. Die Namen sind unverändert.

Die Mitarbeiter sind nicht technisch versiert.

Der normale Arbeitsablauf soll so einfach wie möglich sein:

1. PDF in den Content-Ordner kopieren
2. Textdatei bearbeiten
3. Vorschau öffnen
4. prüfen
5. veröffentlichen

Dafür sollen vor allem diese Befehle existieren:

```bash
npm run check
npm run preview
npm run publish
```

Zusätzlich:

```bash
npm run build
npm run deploy
npm run fetch
npm run dev
npm run doctor
npm run new
```

## Build

`npm run build` soll lokal mindestens folgende Aufgaben erledigen:

1. Content validieren
2. Markdown lesen
3. Sprachvarianten erkennen
4. PDF-Seiten rendern
5. Covers erzeugen
6. Reader-Bilder optimieren
7. Social-Bilder erzeugen
8. QR-Codes erzeugen
9. Suchindex erzeugen
10. Flyer-Katalog erzeugen
11. HTML-Seiten erzeugen
12. Archivseiten erzeugen
13. Themenseiten erzeugen
14. Sitemap erzeugen
15. hreflang-Verknüpfungen erzeugen
16. OpenGraph-Metadaten erzeugen
17. finale statische Website nach `/dist` schreiben

Am Ende soll `/dist` möglichst vollständig als statische Website funktionieren.

## Content-Validierung

`npm run check` soll verständliche Meldungen liefern.

Beispiel:

```text
✓ 128 Flyer gefunden
✓ 124 vollständig

Warnungen:

002-wer-ist-jesus
  EN PDF vorhanden
  EN Beschreibung fehlt

045-weihnachten
  Cover konnte nicht erzeugt werden

089-hoffnung
  Titel fehlt in flyer.it.md
```

Keine kryptischen technischen Fehlermeldungen.

## Neuer Flyer Wizard

`npm run new`

soll einen einfachen interaktiven Workflow ermöglichen.

Beispiel:

```text
Titel:
Wer ist Jesus?

Sprache:
Deutsch

PDF:
C:\Flyer\Jesus.pdf
```

Anschließend soll automatisch erstellt werden:

```text
/content/flyers/129-wer-ist-jesus/
```

inklusive Markdown-Vorlagen.

## Veröffentlichung

`npm run publish`

soll möglichst den vollständigen Ablauf kapseln:

* check
* build
* git status
* git add
* git commit
* deploy

Beispielausgabe:

```text
Biblia Veröffentlichung

128 Flyer geprüft
3 neue Flyer gefunden
1 Flyer geändert

Statische Website wird erzeugt...
Website wird hochgeladen...

Fertig.
https://biblia.at
```

Git bleibt im Hintergrund als technische Grundlage bestehen.

Mitarbeiter sollen Git nicht zwingend direkt bedienen müssen.

## Git und Datenhoheit

> **Nachtrag zur Umsetzung.** Inhalte und Werkzeug liegen seit V3 in zwei
> getrennten Repositories: der *Inhaltsordner* enthält `content/`,
> `config/site.json`, `sftp.env` und die erzeugten Dateien, das *Werkzeug*
> enthält `scripts/`, `src/` und `server/` und liegt im Inhaltsordner als
> Submodul unter `werkzeug/`. Der Gedanke unten gilt unverändert — er
> bezieht sich jetzt auf den Inhaltsordner.

Der Inhaltsordner ist die zentrale Datenquelle.

Lokale Daten haben Vorrang.

Content wird ausschließlich lokal gepflegt.

Der Server darf niemals die lokale Content-Version überschreiben.

Keine bidirektionale Synchronisation für Website-Content.

Klare Richtungen:

```bash
npm run deploy
```

lokal → Server

```bash
npm run fetch
```

Serverdaten → lokal

`fetch` darf nur dynamisch erzeugte Serverdaten herunterladen, zum Beispiel:

* Bestellungen
* Kontaktanfragen

## Hosting

Zielplattform:

Hetzner Webhosting S

Daher:

* statisches HTML als Standard
* statische Assets als Standard
* PHP nur für notwendige dynamische Funktionen
* SFTP-Deployment
* keine Abhängigkeit von Node.js auf dem Server
* kein SSH erforderlich
* keine Build-Prozesse auf dem Server

Alle Build-Prozesse laufen lokal.

Deployment-Daten werden aus:

```text
sftp.env
```

gelesen.

Die Datei darf nicht ins Git-Repository aufgenommen werden.

Vorlage:

```text
sftp.env.example
```

## Serverstruktur

Bevorzugte Serverstruktur:

```text
/
├── index.html
├── de/
├── en/
├── it/
├── assets/
├── media/
├── sitemap.xml
├── robots.txt
└── api/
    ├── order.php
    └── contact.php
```

Wenn dynamische Daten außerhalb des Webroots gespeichert werden können:

```text
/private-data/
    orders/
    contact/
```

Falls das Hosting dies nicht erlaubt, müssen diese Verzeichnisse über `.htaccess` vollständig gegen Webzugriff geschützt werden.

## Deployment-Skripte

Es soll geben:

```text
/scripts/deploy.sh
/scripts/fetch.sh
```

Diese Shell-Skripte sollen nur dünne Wrapper sein.

Die eigentliche Logik soll in plattformübergreifenden Node.js-Skripten implementiert werden.

Dadurch funktionieren dieselben Befehle auf:

* Windows
* macOS
* Linux

## Bestellung

Flyer können als gedruckte Version bestellt werden.

Viele Flyer sind kostenlos.

Ein kleiner Preis zur Kostendeckung soll möglich sein.

V1 benötigt noch kein Online-Payment.

Der Nutzer kann mehrere Flyer auswählen.

Die Auswahl kann vollständig clientseitig verwaltet werden.

Beispielsweise über:

```text
localStorage
```

Dadurch ist kein PHP notwendig, solange die Auswahl nur lokal im Browser verwaltet wird.

Erst beim tatsächlichen Absenden der Bestellanfrage wird PHP verwendet.

Es soll keine klassische Warenkorb-Sprache verwendet werden.

Begriffe:

„Meine Auswahl“

oder:

„Bestellliste“

Pro Flyer:

* Menge
* kostenlos oder Preis
* optional maximale Menge

Beispiel:

```yaml
order:
  enabled: true
  price: 0
  currency: EUR
  min_quantity: 1
  max_quantity: 100
```

## Bestellablauf

In V1 wird keine Zahlung verarbeitet.

Der Nutzer sendet eine Bestellanfrage.

Formulierung:

„Bestellanfrage senden“

nicht:

„Kauf abschließen“

Die Bestellseite selbst kann statisch sein.

JavaScript sammelt die ausgewählten Flyer und Formularinformationen.

Beim Absenden wird ein PHP-Endpunkt aufgerufen:

```text
/api/order.php
```

Dieser übernimmt:

* Validierung
* CSRF-Prüfung
* Rate-Limit
* Speicherung
* E-Mail-Versand

Die Daten sollen zuerst serverseitig gespeichert werden.

Danach wird optional eine E-Mail versendet.

Wichtig:

Fehlschlagen der E-Mail darf nicht zum Verlust der Bestellung führen.

Ablauf:

```text
saveOrder()
sendEmail()
```

Bestellungen sollen als strukturierte JSON-Dateien gespeichert werden.

Beispiel:

```json
{
  "id": "...",
  "created_at": "...",
  "status": "new",
  "language": "de",
  "items": []
}
```

## Kontaktformular

Auch die Kontaktseite selbst soll statisch sein.

Nur die Formularverarbeitung benötigt PHP.

Beispiel:

```text
/de/kontakt/index.html
```

sendet an:

```text
/api/contact.php
```

## Schutz der Bestelldaten

Bestell- und Kontaktdateien dürfen nicht öffentlich erreichbar sein.

Keine Speicherung in einem frei zugänglichen `/public/orders/`-Ordner.

Stattdessen außerhalb des Webroots oder durch Webserver-Regeln geschützt.

## Spam-Schutz

Formulare sollen mindestens besitzen:

* Honeypot
* CSRF-Token
* serverseitige Validierung
* Rate-Limit
* minimale Zeit zwischen Formularladen und Absenden

Captcha nur wenn wirklich nötig.

## Content-Lifecycle

Flyer brauchen einen Status.

Beispiel:

```yaml
status: draft
```

Mögliche Werte:

```text
draft
published
archived
```

Optional:

```yaml
publish_date: 2026-10-01
```

Zusätzlich:

```yaml
featured: true
featured_order: 3
```

und:

```yaml
date: 2026-09-01
```

Dadurch kann die Reihenfolge sauber gesteuert werden.

## Permanente IDs

Jeder Flyer erhält eine dauerhafte numerische oder stabile ID.

Beispiel:

```text
123
```

Diese ID darf niemals geändert werden.

Auch nicht bei:

* Titeländerung
* Slug-Änderung
* sprachlichen Änderungen
* Designänderungen

Alte URLs müssen gegebenenfalls auf neue Slugs weiterleiten.

Das ist besonders wichtig, da gedruckte QR-Codes möglicherweise viele Jahre im Umlauf bleiben.

## Kategorien und Themen

Kategorien sollen wenige, stabile Hauptbereiche sein.

Beispiel:

* Glaube
* Jesus Christus
* Lebensfragen
* Leid & Hoffnung
* Evangelisation
* Feste
* Kinder & Familie

Themen sind flexibler.

Beispiel:

* Angst
* Tod
* Vergebung
* Gebet
* Weihnachten
* Auferstehung

## Themenseiten

SEO-relevante Themenseiten sollen beim Build automatisch als statische HTML-Seiten erzeugt werden.

Beispiel:

```text
/de/themen/hoffnung/
/de/themen/tod/
/de/themen/jesus-christus/
```

Diese Seiten enthalten:

* redaktionelle Einleitung
* passende Flyer
* interne Verlinkung

Kein PHP notwendig.

## SEO

Die Website muss suchmaschinenfreundlich sein.

Weil die Inhalte statisch erzeugt werden, soll der HTML-Inhalt bereits vollständig im ausgelieferten Dokument enthalten sein.

Nicht erst nach JavaScript-Ausführung erzeugen.

Benötigt:

* semantisches HTML
* vollständiger statischer Content
* klare Überschriftenstruktur
* Canonical URLs
* hreflang
* Sitemap
* robots.txt
* OpenGraph
* strukturierte Daten, wo sinnvoll
* gute interne Verlinkung
* sprechende URLs
* schnelle Ladezeiten
* optimierte Bilder
* serverseitig nicht notwendige Seiten vollständig statisch

Optional sollen beim Build Texte aus PDFs extrahiert werden.

Diese können verwendet werden für:

* Suchindex
* SEO
* Barrierefreiheit
* „Als Text lesen“

## Barrierefreiheit

Mindestens:

* Tastatursteuerung
* sichtbare Fokuszustände
* ausreichender Kontrast
* ARIA-Beschriftungen
* Alt-Texte
* Reader-Navigation per Tastatur
* Zoom
* Screenreader-freundliche Navigation

Optional:

„Als Text lesen“

mithilfe des aus dem PDF extrahierten Textes.

## Performance

Da es langfristig hunderte Flyer geben kann:

* statische HTML-Auslieferung
* Bilder lazy laden
* WebP oder AVIF verwenden
* mehrere Bildgrößen generieren
* Reader-Seiten erst bei Bedarf laden
* Suchindex optimieren
* paginierte Archivseiten erzeugen
* möglichst wenig JavaScript
* PHP nur für dynamische Schreibvorgänge oder zwingend serverseitige Funktionen einsetzen

## JavaScript

JavaScript soll für clientseitige Interaktion verwendet werden:

* Theme-Wechsel
* Sprachpräferenz
* Reader
* Suche
* Filter
* Bestellliste
* Share-Funktionen
* localStorage
* UI-Interaktionen

Die Website soll jedoch möglichst auch ohne komplexe Client-Frameworks auskommen.

Kein React/Vue/Svelte erforderlich, wenn Vanilla JavaScript ausreicht.

Bevorzuge einfache, wartbare Lösungen.

## Analytics

Keine aggressive Nutzerverfolgung.

Wenn Analytics verwendet wird, dann möglichst datenschutzfreundlich und anonym.

Interessante Events:

* flyer_view
* reader_open
* share_click
* order_add
* order_submit
* qr_visit

Wichtige Kennzahlen:

* Reader Opens
* Shares
* Bestellanfragen
* Shares pro 100 Reads

Keine Nutzerprofile.

## Technische Architektur

Das System ist ein Hybrid aus:

* lokalem dateibasiertem CMS
* Static Site Generator
* Medienpipeline
* statischem Frontend
* sehr kleinem PHP-Backend
* SFTP-Deployment-System

Architektur:

```text
BIBLIA CONTENT REPOSITORY
        │
        ├── PDFs / Bilder
        ├── Markdown
        │
        ▼
      BUILD
        │
        ├── HTML
        ├── Reader Assets
        ├── Katalogdaten
        ├── Suchindex
        ├── SEO-Daten
        ├── Social Assets
        ├── QR-Codes
        ▼
       DIST
        │
        ├── statische Website
        └── PHP API
                │
                ├── Bestellung
                └── Kontakt
```

## Grundsatz zur PHP-Nutzung

PHP soll immer die Ausnahme sein, nicht der Standard.

Vor jeder PHP-Funktion soll geprüft werden:

„Kann diese Funktion bereits lokal beim Build oder clientseitig im Browser gelöst werden?“

Wenn ja, verwende kein PHP.

Beispiele:

| Funktion                          | Umsetzung                          |
| --------------------------------- | ---------------------------------- |
| Startseite                        | statisches HTML                    |
| Flyer-Detailseite                 | statisches HTML                    |
| Reader                            | statisches HTML + JavaScript       |
| Kategorien                        | statisches HTML                    |
| Themenseiten                      | statisches HTML                    |
| Sprachseiten                      | statisches HTML                    |
| Suche                             | statischer JSON-Index + JavaScript |
| Filter                            | JavaScript                         |
| Bestellliste                      | localStorage + JavaScript          |
| Theme                             | CSS + JavaScript                   |
| Teilen                            | Web Share API / JavaScript         |
| QR-Code                           | beim Build erzeugen                |
| Sitemap                           | beim Build erzeugen                |
| Kontakt speichern                 | PHP                                |
| Bestellung speichern              | PHP                                |
| E-Mail versenden                  | PHP                                |
| serverseitige Formularvalidierung | PHP                                |

## V1-Funktionsumfang

V1 soll bewusst fokussiert bleiben.

Enthalten:

1. Flyer importieren
2. statische Flyer-Seiten erzeugen
3. Flyer darstellen
4. Flyer suchen und filtern
5. Vollbild lesen
6. mehrseitige Flyer
7. Teilen
8. QR-Code
9. mehrere Flyer auswählen
10. Bestellanfrage senden
11. Mehrsprachigkeit
12. Hell/Dunkel/System-Modus
13. SEO
14. Build
15. Preview
16. Deployment
17. Fetch von Bestell- und Kontaktdaten
18. Content-Validierung
19. einfacher Mitarbeiterworkflow

Noch nicht notwendig:

* Benutzerkonten
* Online-Payment
* Admin-Dashboard
* komplexe Lagerverwaltung
* Online-CMS
* Kommentare
* Newsletter-System
* umfangreiche Analytics
* komplexe Rollenverwaltung

## Projektstruktur

> **Nachtrag zur Umsetzung.** Der Baum unten beschreibt den ursprünglichen
> Entwurf mit einem einzigen Verzeichnis. Umgesetzt ist er in zwei
> Repositories: `content/`, `config/`, `generated/`, `dist/`, `app-data/`,
> `print-assets/` und `sftp.env` liegen im Inhaltsordner, `scripts/`, `src/`
> und `server/` im Werkzeug. Siehe README.md.

Erstelle eine klare, wartbare Struktur.

Beispiel:

```text
/
├── src/
│   ├── templates/
│   ├── components/
│   ├── css/
│   └── js/
│
├── content/
│   ├── home.md
│   ├── home.de.md
│   ├── about-us.md
│   ├── about-us.de.md
│   ├── imprint.md
│   ├── privacy.md
│   └── flyers/
│
├── generated/
│   ├── catalog/
│   ├── search/
│   ├── images/
│   ├── reader/
│   ├── social/
│   └── qr/
│
├── server/
│   └── api/
│       ├── order.php
│       └── contact.php
│
├── dist/
│   ├── index.html
│   ├── de/
│   ├── en/
│   ├── assets/
│   ├── media/
│   └── api/
│
├── app-data/
│   ├── orders/
│   └── contact/
│
├── scripts/
│   ├── build.*
│   ├── check.*
│   ├── deploy.*
│   ├── fetch.*
│   ├── new.*
│   ├── deploy.sh
│   └── fetch.sh
│
├── config/
│   └── site.json
│
├── package.json
├── sftp.env.example
├── .gitignore
└── README.md
```

## Anforderungen an die Umsetzung

Erzeuge keinen bloßen Mockup-Prototypen.

Erstelle eine echte, strukturierte, wartbare V1-Anwendung.

Wichtig:

* Static First
* PHP nur wo notwendig
* kein unnötiges Framework
* möglichst wenig externe Abhängigkeiten
* verständlicher Quellcode
* klare Trennung zwischen Content, generierten Daten, statischen Ausgabedaten und Runtime-Daten
* sichere PHP-Endpunkte
* sichere Dateispeicherung
* portables Node-Tooling
* verständliche CLI-Ausgaben
* saubere Fehlerbehandlung
* gute README
* Beispiel-Content
* `.gitignore`
* `sftp.env.example`
* vollständige npm-Skripte
* Git-Repository vorbereiten

Die Website soll langfristig wartbar sein und nicht nur kurzfristig funktionieren.

Die wichtigste Zielgruppe für das Tooling sind nicht Entwickler, sondern Biblia-Mitarbeiter, die hauptsächlich Dateien kopieren und Markdown-Dateien bearbeiten.

Der gesamte technische Workflow soll daher möglichst fehlertolerant, verständlich und sicher sein.

Das zentrale Ziel des Projekts lautet:

Gedruckte christliche Medien sollen digital lesbar, einfach teilbar und wieder als physische Druckmedien bestellbar werden.

Dadurch entsteht ein Kreislauf:

Gedruckter Flyer
→ QR-Code
→ statische Website
→ online lesen
→ teilen
→ weitere Leser
→ Druckversion bestellen
→ erneut physisch weitergeben

Der wichtigste Architekturgrundsatz lautet:

**Alles, was beim lokalen Build bekannt ist, wird statisch erzeugt. PHP wird auf dem Server nur für Funktionen eingesetzt, die tatsächlich serverseitige Verarbeitung benötigen.**

