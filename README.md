# Biblia — Werkzeug

Dies ist das **Werkzeug**: das Programm, das aus einem Inhaltsordner die
fertige Website erzeugt, prüft und hochlädt.

Hier liegen keine Inhalte. Flyer, Texte, Einstellungen und Zugangsdaten
gehören in einen **Inhaltsordner** — ein eigenes Repository, in dem das
Werkzeug als Submodul unter `werkzeug/` liegt.

```
biblia-inhalte/          ← hier arbeiten die Mitarbeiter
├── content/             Flyer, Seiten, Themen, Kategorien
├── config/site.json     Adresse, Sprachen, Empfängeradressen
├── sftp.env             Zugangsdaten (nicht in Git)
├── i18n/                eigene Oberflächentexte (freiwillig)
├── theme.css            eigene Farben (freiwillig)
├── werkzeug/            ← dieses Repository, als Submodul
└── dist/ generated/ print-assets/ app-data/    (nicht in Git)
```

Diese Trennung hat drei Gründe:

1. Das Werkzeug lässt sich aktualisieren, ohne Inhalte anzufassen.
2. Passwort und Postadressen liegen nicht im Quelltext-Verzeichnis.
3. Mitarbeiter öffnen nur einen Ordner, und darin steht nichts, was sie
   nicht angeht.

Für Mitarbeiter ist die Anleitung die `README.md` **ihres Inhaltsordners**.
Diese hier richtet sich an die Betreuung des Projekts.

---

## Einen Inhaltsordner anlegen

```bash
npm ci
npm run init -- ~/Biblia-Inhalte
```

Das legt `package.json`, `.gitignore`, `.gitattributes`, eine
`README.md` für Mitarbeiter, `config/site.json` und das Gerüst unter
`content/` an, macht daraus ein Git-Repository, aktiviert Git LFS und fügt
dieses Werkzeug als Submodul hinzu.

Warum ein Befehl und keine Anleitung: zwei der Dateien dulden keinen Fehler.
`.gitignore` muss `app-data/` und `sftp.env` aussperren — sonst landen
Namen, Postadressen und ein Passwort im Klartext in der Versionsgeschichte.
`.gitattributes` muss Git LFS einrichten, **bevor** die erste Druckdatei
eingecheckt wird.

Optionen:

| Option | Bedeutung |
| --- | --- |
| `--werkzeug <adresse>` | Andere Herkunft des Submoduls, auch ein lokaler Pfad |
| `--name <name>` | Name in der `package.json` |
| `--no-git` | Kein `git init`, kein Submodul |
| `--force` | Auch in einen nicht leeren Ordner schreiben |

Danach:

```bash
cd ~/Biblia-Inhalte
npm run setup                  # Programmbibliotheken des Werkzeugs
cp sftp.env.example sftp.env   # Zugangsdaten eintragen
# baseUrl in config/site.json eintragen
npm run doctor
```

## Am Werkzeug arbeiten

Das Werkzeug braucht zum Ausprobieren einen Inhaltsordner. Gesucht wird er
in dieser Reihenfolge:

1. `--home <pfad>`
2. `BIBLIA_HOME`
3. das aktuelle Verzeichnis oder eines darüber mit `config/site.json`
4. `home/` neben diesem Werkzeug — der Entwicklungsfall

Für Punkt 4 genügt einmalig:

```bash
npm run init -- home --no-git
node scripts/demo.mjs --home home
```

`home/` ist von Git ausgenommen. Danach laufen alle Befehle ohne weitere
Angabe:

```bash
npm run check
npm run build
npm run preview
npm test
```

## Eine neue Fassung ausliefern

Das Werkzeug wird nicht automatisch aktualisiert. Jeder Inhaltsordner hält
fest, welcher Stand für ihn gilt.

```bash
# im Werkzeug
git commit … && git push
git tag v3 && git push --tags

# im Inhaltsordner
cd werkzeug && git fetch && git checkout v3 && cd ..
npm run setup
npm run check          # prüft die Inhalte gegen die neue Fassung
git add werkzeug && git commit -m "Werkzeug auf v3"
git push
```

Für alle anderen kommt die Änderung dann mit `git pull && git submodule
update && npm run setup`. `npm run doctor` meldet, wenn ein Inhaltsordner
nicht auf dem festgehaltenen Stand steht.

Braucht eine neue Fassung einen anderen Aufbau des Inhaltsordners, wird
`FORMAT_VERSION` in `scripts/lib/config.mjs` erhöht und `formatVersion` in
`config/site.json` nachgezogen. Ein Inhaltsordner, der neuer ist als das
Werkzeug, sagt dann, was zu tun ist, statt unverständlich abzubrechen.

---

## Aufbau

```
scripts/           Die Befehle
  lib/             Die Bausteine — hier steckt die Logik
  templates/home/  Vorlagen für einen neuen Inhaltsordner
src/
  templates/       Seitenvorlagen
  components/      Wiederverwendete Teile
  css/             Stilvorlagen
  js/              Browser-Skripte
  i18n/            Oberflächentexte (Vorgaben)
server/api/        Die beiden PHP-Endpunkte
```

`src/` und `scripts/` müssen Geschwister bleiben: die Vorlagen binden
`../../scripts/lib/html.mjs` ein.

### Die zwei Verzeichnisbäume

`scripts/lib/paths.mjs` ist die einzige Stelle, an der Pfade entstehen.

* `SYS` — das Werkzeug. Feststehend, aus `import.meta.url` abgeleitet.
* `resolveHome()` — der Inhaltsordner. Wird von jedem Befehl einmal
  aufgelöst und weitergereicht; Bausteine bekommen ihn als Parameter.

`findHome()` ist dasselbe, bricht aber nicht ab — `npm run doctor` benutzt
es, weil es gerade dann noch etwas sagen soll, wenn nichts eingerichtet ist.

### Warum Git zweimal vorkommt

Inhalte und Werkzeug sind zwei Repositories, und Git sucht von sich aus nach
oben weiter. Ein Aufruf ohne ausdrückliches Arbeitsverzeichnis liefert
deshalb klaglos die falsche Versionsgeschichte — mit leerer Ausgabe statt
einer Fehlermeldung.

Daran hängen zwei Zusagen: dass eine einmal vergebene Nummer nie
verschwindet (`/f/123/` steht auf gedruckten Flyern), und dass ein
umbenannter Flyer eine Weiterleitung bekommt. `scripts/lib/repo.mjs` prüft
deshalb nicht, ob Git antwortet, sondern ob es das richtige Repository ist.

### Alle Befehle

| Befehl | Bedeutung |
| --- | --- |
| `npm run init -- <pfad>` | Neuen Inhaltsordner anlegen |
| `npm run check` | Inhalte prüfen |
| `npm run build` | Website erzeugen |
| `npm run preview` | Lokal ansehen |
| `npm run dev` | Vorschau, die sich selbst neu erzeugt |
| `npm run publish` | Prüfen, erzeugen, sichern, hochladen |
| `npm run deploy` | Nur hochladen |
| `npm run fetch` | Bestellungen vom Server holen |
| `npm run new` | Assistent für einen neuen Flyer |
| `npm run doctor` | Einrichtung prüfen |
| `npm run demo` | Beispielinhalte anlegen |
| `npm run retention` | Aufbewahrungsfristen anwenden |
| `npm run clean` | Erzeugte Dateien entfernen |
| `npm test` | Die Werkzeuge selbst prüfen |

Alle verstehen `--home <pfad>`.

---

## Was das Werkzeug zusichert

Diese Punkte sind der Grund für den grössten Teil der Prüfungen. Wer hier
etwas ändert, sollte sie kennen.

* **Nummern sind dauerhaft.** `/f/123/` steht auf gedruckten Flyern und muss
  jahrelang funktionieren. `npm run check` vergleicht dafür die
  Versionsgeschichte des Inhaltsordners mit den heutigen Nummern.
* **Lesbare Adressen überleben Umbenennungen.** `slug_history` wird beim
  Build zu `RedirectMatch`-Regeln in der `.htaccess`.
* **Bestellungen werden gegen einen erzeugten Bestand geprüft.** Was der
  Browser mitschickt, ist eine Behauptung; `api/catalog.generated.php` ist
  die einzige gültige Liste.
* **Nichts wird von fremden Servern geladen.** Das ist die Grundlage dafür,
  ohne Einwilligungsbanner auszukommen, und wird beim Build geprüft.
* **`app-data/` enthält Namen und Postadressen.** Es ist von Git
  ausgenommen, auf dem Server gesperrt, und beides wird nach jedem
  Hochladen geprüft.
* **Unter der endgültigen Domain wird streng geprüft.** Beispielinhalte,
  Platzhalter im Impressum und unzustellbare Empfängeradressen verhindern
  dann Build und Veröffentlichung.

`CONCEPT.md` beschreibt die ursprünglichen Überlegungen zum Entwurf.
